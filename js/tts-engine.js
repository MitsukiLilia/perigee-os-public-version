// ═══════════════════════════════════════════════════════════
// TTS Engine — 共用语音合成 + 角色对谈/访谈解析 + 多段音频生成
// ═══════════════════════════════════════════════════════════
// 数据模型：
//   - audioStore（独立 localforage 实例）：键 = audioId，值 = audio Blob
//   - 推动力：Utils.saveData 走 JSON 序列化会吞掉 Blob，所以音频 blob 走独立通道
//   - segments 在 niconicoData.videos[].audioSegments 里只存 audioId 引用
// ═══════════════════════════════════════════════════════════

const TTSEngine = {

    // 独立的音频存储（不走主数据 JSON 序列化）
    _audioStore: null,
    _initStore() {
        if (!this._audioStore && typeof localforage !== 'undefined') {
            this._audioStore = localforage.createInstance({
                name: 'PerigeeAudio',
                storeName: 'segments',
                description: '广播剧 / 访谈音频 segment Blob 存储'
            });
        }
        return this._audioStore;
    },

    async storeAudio(audioId, blob) {
        const store = this._initStore();
        if (!store) throw new Error('audioStore 未初始化');
        await store.setItem(audioId, blob);
    },

    async getAudio(audioId) {
        const store = this._initStore();
        if (!store) return null;
        return await store.getItem(audioId);
    },

    async removeAudio(audioId) {
        const store = this._initStore();
        if (!store) return;
        await store.removeItem(audioId);
    },

    async removeAudios(audioIds) {
        for (const id of audioIds || []) {
            try { await this.removeAudio(id); } catch (e) { console.warn('[TTS] remove failed', id, e); }
        }
    },

    // ─── 身份解析 ─────────────────────────────────────────────
    // 根据 speaker 名字反查 voice 信息
    // 入口 A: NPC.name 直接匹配（声優访谈 — speaker 就是声優本人）
    // 入口 B: NPC.voicedCharacters 反查（角色对谈 — speaker 是角色，找谁配音）
    // 返回 {voiceId, npcId, npcName} 或 null
    resolveSpeakerVoice(speakerName) {
        if (!speakerName) return null;
        const npcs = AppState.data.broadcast.officialNpcs || [];
        const target = String(speakerName).trim();
        if (!target) return null;

        // A. NPC.name 严格匹配
        const exact = npcs.find(n => n.voiceId && (n.name || '').trim() === target);
        if (exact) return { voiceId: exact.voiceId, npcId: exact.id, npcName: exact.name };

        // B. voicedCharacters 严格匹配（角色名）
        const byChar = npcs.find(n =>
            n.voiceId && (n.voicedCharacters || []).some(c => String(c).trim() === target)
        );
        if (byChar) return { voiceId: byChar.voiceId, npcId: byChar.id, npcName: byChar.name };

        // 部分匹配兜底（避免标点/称谓后缀差异）
        const partialName = npcs.find(n =>
            n.voiceId && (
                (n.name || '').includes(target) ||
                target.includes((n.name || '').trim())
            )
        );
        if (partialName) return { voiceId: partialName.voiceId, npcId: partialName.id, npcName: partialName.name };

        const partialChar = npcs.find(n =>
            n.voiceId && (n.voicedCharacters || []).some(c => {
                const ch = String(c).trim();
                return ch && (ch.includes(target) || target.includes(ch));
            })
        );
        if (partialChar) return { voiceId: partialChar.voiceId, npcId: partialChar.id, npcName: partialChar.name };

        return null;
    },

    // ─── 文本解析 ─────────────────────────────────────────────
    // 解析 chara talk 格式：[名前]「セリフ」 / 名前「セリフ」
    // 旁白（不在「」里的纯叙述）跳过
    parseCharaTalk(content) {
        const lines = String(content || '').split('\n').map(l => l.trim()).filter(Boolean);
        const segments = [];
        for (const line of lines) {
            const m = line.match(/^(?:\[([^\]]+)\]|([^「]+))「(.+?)」?$/);
            if (m) {
                const speaker = (m[1] || m[2] || '').trim();
                const text = (m[3] || '').replace(/」$/, '').trim();
                if (speaker && text) segments.push({ speaker, text, kind: 'dialogue' });
            }
            // 非「」行 = 旁白 → 跳过
        }
        return segments;
    },

    // 解析 interview 格式：[受訪者]：[回答] / ―― 質問
    // 質問用 interviewerVoiceId（采访人音色，TTS 设置可配）
    parseInterview(content) {
        const lines = String(content || '').split('\n').map(l => l.trim()).filter(Boolean);
        const segments = [];
        for (const line of lines) {
            // 質問行（―― / —— / — 开头）
            if (/^[―—–]+/.test(line)) {
                const text = line.replace(/^[―—–]+\s*/, '').trim();
                if (text) segments.push({ speaker: '__interviewer__', text, kind: 'question' });
                continue;
            }
            // 回答行：可能有方括号 [名前]：内容 或 名前：内容
            const m = line.match(/^\[?([^\]：:]+?)\]?[：:]\s*(.+)$/);
            if (m) {
                const speaker = m[1].trim();
                const text = m[2].trim();
                if (speaker && text) segments.push({ speaker, text, kind: 'answer' });
            }
        }
        return segments;
    },

    // 给 segments 解析 voice，返回 {segments, missing[], summary[]}
    // segments: 原 segments 加上 voiceId / npcId / npcName
    // missing: 没匹配到 voice 的 speaker 名字列表（去重）
    // summary: speaker 维度的 [{speaker, npcName, count, hasVoice}]
    resolveSegmentVoices(segments) {
        const tts = AppState.data.ttsConfig || {};
        const interviewerVoice = (tts.interviewerVoiceId || '').trim() || tts.voiceId || 'Japanese_HikaruMale_Calm';
        const cache = new Map();
        const missing = new Set();
        const speakerStats = new Map();

        const resolved = segments.map(seg => {
            if (seg.kind === 'question') {
                const enriched = { ...seg, voiceId: interviewerVoice, npcName: 'インタビュアー' };
                this._tallySpeaker(speakerStats, '__interviewer__', 'インタビュアー', true);
                return enriched;
            }
            let lookup;
            if (cache.has(seg.speaker)) {
                lookup = cache.get(seg.speaker);
            } else {
                lookup = this.resolveSpeakerVoice(seg.speaker);
                cache.set(seg.speaker, lookup);
            }
            if (!lookup) {
                missing.add(seg.speaker);
                this._tallySpeaker(speakerStats, seg.speaker, null, false);
                return { ...seg, voiceId: null, npcId: null, npcName: null };
            }
            this._tallySpeaker(speakerStats, seg.speaker, lookup.npcName, true);
            return { ...seg, voiceId: lookup.voiceId, npcId: lookup.npcId, npcName: lookup.npcName };
        });

        const summary = [...speakerStats.values()].sort((a, b) => b.count - a.count);
        return { segments: resolved, missing: [...missing], summary };
    },

    _tallySpeaker(map, key, npcName, hasVoice) {
        if (!map.has(key)) {
            map.set(key, { speaker: key, npcName, hasVoice, count: 0 });
        }
        map.get(key).count++;
    },

    // ─── 読音対照（当て字 → カナ）整词替换 ─────────────────────
    // 按 from 长度倒序，避免短词替换后吞掉长词的匹配
    applyReadingMap(text) {
        if (!text) return text;
        const map = AppState.data.ttsConfig?.readingMap || [];
        if (!Array.isArray(map) || map.length === 0) return text;
        const sorted = [...map].sort((a, b) => (b.from || '').length - (a.from || '').length);
        let result = String(text);
        for (const { from, to } of sorted) {
            if (from && to != null) {
                result = result.split(from).join(to);
            }
        }
        return result;
    },

    // ─── MiniMax T2A 调用 ─────────────────────────────────────
    // 单段合成：文本 + voiceId → audio Blob
    async synthesize(text, voiceId, opts = {}) {
        const tts = AppState.data.ttsConfig || {};
        if (tts.provider !== 'minimax') {
            throw new Error('需要在「设置 → API → TTS」里把 Provider 选为 MiniMax');
        }
        if (!tts.apiKey || !tts.groupId) {
            throw new Error('MiniMax API Key / Group ID 未配置');
        }
        const base = (typeof TTSSettings !== 'undefined')
            ? TTSSettings.getMinimaxBase(tts.minimaxRegion, tts.minimaxCustomBase)
            : 'https://api.minimax.io';

        // 当て字读音替换
        const finalText = this.applyReadingMap(text);

        const body = {
            model: tts.speechModel || 'speech-2.8-hd',
            text: finalText,
            stream: false,
            voice_setting: {
                voice_id: voiceId || tts.voiceId || 'Japanese_HikaruMale_Calm',
                speed: opts.speed != null ? opts.speed : (tts.speed || 1.0),
                vol: 1.0,
                pitch: 0
            },
            audio_setting: { audio_sample_rate: 32000, bitrate: 128000, format: 'mp3', channel: 1 }
        };
        if (tts.languageBoost) body.language_boost = tts.languageBoost;

        const res = await fetch(`${base}/v1/t2a_v2?GroupId=${tts.groupId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tts.apiKey}`
            },
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.base_resp && data.base_resp.status_code !== 0) {
            throw new Error(data.base_resp.status_msg || 'MiniMax 请求失败');
        }
        const hex = data.data?.audio;
        if (!hex) throw new Error('音频数据为空');
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
        return new Blob([bytes], { type: 'audio/mp3' });
    },

    // 批量合成：依次合成 segments，返回 segments + audioId（已存进 audioStore）
    // onProgress(done, total, currentSpeaker) — 进度回调
    // skipMissing=true 时无 voiceId 的段直接跳过；默认 true
    async synthesizeBatch(segments, opts = {}) {
        const onProgress = opts.onProgress || (() => {});
        const skipMissing = opts.skipMissing !== false;
        const result = [];
        for (let i = 0; i < segments.length; i++) {
            const seg = segments[i];
            if (!seg.voiceId) {
                if (skipMissing) {
                    result.push({ ...seg, audioId: null, skipped: true });
                    onProgress(i + 1, segments.length, seg, 'skipped');
                    continue;
                }
            }
            try {
                const blob = await this.synthesize(seg.text, seg.voiceId);
                const audioId = 'aud_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
                await this.storeAudio(audioId, blob);
                result.push({ ...seg, audioId });
                onProgress(i + 1, segments.length, seg, 'done');
            } catch (e) {
                console.error('[TTS] segment failed', seg, e);
                result.push({ ...seg, audioId: null, error: e.message });
                onProgress(i + 1, segments.length, seg, 'error');
            }
        }
        return result;
    }
};
