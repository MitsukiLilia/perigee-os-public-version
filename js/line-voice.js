// ===== LINE Voice Messages =====
// AI 主动发语音（{"type":"voice_message","content":"..."}）解析、TTS 合成、缓存、播放

const LineVoice = {
    // IndexedDB 单独一个 store，不与主数据混合
    _storeInst: null,
    _getStore() {
        if (!this._storeInst) {
            this._storeInst = localforage.createInstance({
                name: 'PerigeeOS',
                storeName: 'voiceCache'
            });
        }
        return this._storeInst;
    },

    _currentAudio: null,
    _currentMsgId: null,
    _queue: [],

    // ── 文本清洗：剥掉动作/旁白不让 TTS 读 ──
    cleanForTts(text) {
        return String(text || '')
            .replace(/\[TL\][\s\S]*?\[\/TL\]/g, '')  // [TL]中国語訳[/TL] は丸ごと除去（標签だけ剥がすと訳文が残って読まれる）
            .replace(/\(.*?\)|（.*?）|【.*?】|\[.*?\]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    },

    // ── 缓存 key：文本 + 音色 + 模型 + 语速 + 语言增强 ──
    _cacheKey(text, voiceId, tts) {
        const sig = `${voiceId}|${tts.speechModel||''}|${tts.speed||1}|${tts.languageBoost||''}|${text}`;
        // 简单 hash（djb2 变体），IndexedDB key 短一点
        let h = 5381;
        for (let i = 0; i < sig.length; i++) h = ((h << 5) + h + sig.charCodeAt(i)) | 0;
        return `v_${voiceId}_${Math.abs(h).toString(36)}`;
    },

    // ── 获取或生成音频 Blob ──
    async getOrGenerate(text, voiceId) {
        const tts = AppState.data.ttsConfig || {};
        if (tts.provider !== 'minimax') throw new Error(I18n.t('line.voice_err_minimax_only', '仅支持 MiniMax TTS（在 TTS 设置里切换）'));
        if (!tts.groupId || !tts.apiKey) throw new Error(I18n.t('line.voice_err_no_credentials', '未配置 GroupId / API Key'));

        const cleaned = this.cleanForTts(text);
        if (!cleaned) throw new Error(I18n.t('line.voice_err_empty_text', '文本为空（可能被清洗规则过滤掉了）'));

        const key = this._cacheKey(cleaned, voiceId, tts);
        const store = this._getStore();

        // 查缓存
        const cached = await store.getItem(key);
        if (cached instanceof Blob) return cached;

        // 生成
        const base = TTSSettings.getMinimaxBase(tts.minimaxRegion, tts.minimaxCustomBase);
        const body = {
            model: tts.speechModel || 'speech-2.8-hd',
            text: cleaned,
            stream: false,
            voice_setting: { voice_id: voiceId, speed: tts.speed || 1.0, vol: 1.0, pitch: 0 },
            audio_setting: { audio_sample_rate: 32000, bitrate: 128000, format: 'mp3', channel: 1 }
        };
        if (tts.languageBoost) body.language_boost = tts.languageBoost;

        const res = await fetch(`${base}/v1/t2a_v2?GroupId=${tts.groupId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tts.apiKey}` },
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.base_resp && data.base_resp.status_code !== 0) throw new Error(data.base_resp.status_msg || I18n.t('line.voice_err_tts_failed', 'TTS 合成失败'));
        const hex = data.data?.audio;
        if (!hex) throw new Error(I18n.t('line.voice_err_no_audio', 'API 返回没有音频数据'));

        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
        const blob = new Blob([bytes], { type: 'audio/mp3' });

        // 存缓存（失败不阻断）
        try { await store.setItem(key, blob); } catch (e) { console.warn('[Voice] cache save failed', e); }
        return blob;
    },

    // ── 解析 AI 回复：抽出 {"type":"voice_message",...} 行 ──
    // 返回 [{kind:'voice'|'text', content:string}, ...]
    parseReply(reply) {
        const segments = [];
        const lines = String(reply || '').split(/\r?\n/);
        let textBuf = '';

        const flushText = () => {
            const t = textBuf.trim();
            if (t) segments.push({ kind: 'text', content: t });
            textBuf = '';
        };

        for (const line of lines) {
            // 尝试解析为 JSON voice_message
            const trimmed = line.trim();
            if (trimmed.startsWith('{') && trimmed.includes('voice_message')) {
                try {
                    const obj = JSON.parse(trimmed);
                    if (obj && obj.type === 'voice_message' && typeof obj.content === 'string') {
                        flushText();
                        // 音声 content に [TL]…[/TL] が混じっても丸ごと除去（表示も読み上げも日本語のみに）
                        segments.push({ kind: 'voice', content: obj.content.replace(/\[TL\][\s\S]*?\[\/TL\]/g, '').trim() });
                        continue;
                    }
                } catch (e) { /* fall through as text */ }
            }
            textBuf += (textBuf ? '\n' : '') + line;
        }
        flushText();
        return segments;
    },

    // ── 决定某个角色该用哪个 voiceId ──
    resolveVoiceId(char) {
        // 必须显式勾选「启用语音」才触发，否则静默（哪怕全局 TTS 填了 voiceId）
        if (!char || !char.enableVoice) return '';
        if (char.voiceId && char.voiceId.trim()) return char.voiceId.trim();
        const tts = AppState.data.ttsConfig || {};
        return (tts.voiceId || '').trim();
    },

    // ── 气泡 HTML（语音消息）──
    renderBubble(msg, isUser) {
        const preview = this._esc(this.cleanForTts(msg.content).slice(0, 80));
        const duration = msg.duration ? `${Math.ceil(msg.duration)}″` : '—';
        return `<div class="line-voice-bubble ${isUser ? 'voice-user' : 'voice-ai'}" data-msg-id="${msg.id}" onclick="LineVoice.togglePlay('${msg.id}')">
            <div class="line-voice-play">
                <svg class="voice-play-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
                <svg class="voice-pause-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="display:none"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>
                <svg class="voice-loading-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" style="display:none"><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/></svg>
            </div>
            <div class="line-voice-wave">
                ${Array.from({length:14}).map((_,i)=>`<span style="animation-delay:${i*0.08}s"></span>`).join('')}
            </div>
            <div class="line-voice-duration">${duration}</div>
            <button class="line-voice-expand" onclick="event.stopPropagation();LineVoice.toggleExpand('${msg.id}')" title="${I18n.t('line.voice_toggle_text_title', '显示/隐藏文字')}">${I18n.t('line.voice_text_btn', '字')}</button>
        </div>
        ${msg.expanded ? `<div class="line-voice-text-expanded">${preview}</div>` : ''}`;
    },

    _esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }, // ⚠️ 保留独立实现勿收编 Utils.escapeHtml：模块内有先转义后 .slice() 的预览截断，多转义 ' 会挪动截断点

    // ── 展开/收起文字 ──
    toggleExpand(msgId) {
        const msg = this._findMsg(msgId);
        if (!msg) return;
        msg.expanded = !msg.expanded;
        Utils.saveData();
        if (typeof Line !== 'undefined') Line.render();
    },

    // ── 点击播放/暂停 ──
    async togglePlay(msgId) {
        // 如果正在播这条 → 暂停
        if (this._currentMsgId === msgId && this._currentAudio && !this._currentAudio.paused) {
            this._currentAudio.pause();
            this._setState(msgId, 'idle');
            this._currentMsgId = null;
            return;
        }
        // 播其他条或重新播
        await this.play(msgId);
    },

    async play(msgId) {
        const msg = this._findMsg(msgId);
        if (!msg) return;
        const char = this._findCharForMsg(msgId);
        const voiceId = this.resolveVoiceId(char);
        if (!voiceId) {
            Utils.showToast(I18n.t('t.lv_no_voice_id', '请先在 TTS 设置或角色里填 voice_id'));
            return;
        }

        this._stopCurrent();
        this._setState(msgId, 'loading');

        try {
            const blob = await this.getOrGenerate(msg.content, voiceId);
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            if (window.AudioCoordinator) AudioCoordinator.register(audio);
            this._currentAudio = audio;
            this._currentMsgId = msgId;

            audio.onloadedmetadata = () => {
                if (!msg.duration && isFinite(audio.duration)) {
                    msg.duration = audio.duration;
                    Utils.saveData();
                    if (typeof Line !== 'undefined') Line.render();
                }
            };
            audio.onended = () => {
                URL.revokeObjectURL(url);
                this._setState(msgId, 'idle');
                this._currentMsgId = null;
                this._currentAudio = null;
                // 继续播放队列
                this._playNextInQueue();
            };
            audio.onerror = () => {
                URL.revokeObjectURL(url);
                this._setState(msgId, 'idle');
                this._currentMsgId = null;
                this._currentAudio = null;
            };
            this._setState(msgId, 'playing');
            await audio.play();
        } catch (e) {
            console.error('[Voice] play failed', e);
            Utils.showToast(I18n.t('t.lv_play_failed', '语音播放失败: ') + e.message);
            this._setState(msgId, 'idle');
        }
    },

    _stopCurrent() {
        if (this._currentAudio) {
            try { this._currentAudio.pause(); } catch (e) {}
            this._currentAudio = null;
        }
        if (this._currentMsgId) this._setState(this._currentMsgId, 'idle');
        this._currentMsgId = null;
    },

    _setState(msgId, state) {
        const el = document.querySelector(`.line-voice-bubble[data-msg-id="${msgId}"]`);
        if (!el) return;
        el.classList.remove('is-loading', 'is-playing');
        const play = el.querySelector('.voice-play-icon');
        const pause = el.querySelector('.voice-pause-icon');
        const loading = el.querySelector('.voice-loading-icon');
        if (state === 'loading') {
            el.classList.add('is-loading');
            play.style.display = 'none'; pause.style.display = 'none'; loading.style.display = 'block';
        } else if (state === 'playing') {
            el.classList.add('is-playing');
            play.style.display = 'none'; pause.style.display = 'block'; loading.style.display = 'none';
        } else {
            play.style.display = 'block'; pause.style.display = 'none'; loading.style.display = 'none';
        }
    },

    // ── 自动播放队列（AI 回复后连续 voice 消息自动连播）──
    enqueueAutoPlay(msgIds) {
        this._queue = [...msgIds];
        this._playNextInQueue();
    },
    _playNextInQueue() {
        if (this._queue.length === 0) return;
        const next = this._queue.shift();
        // 稍微等一下再播下一条，自然一点
        setTimeout(() => this.play(next).catch(() => {}), 400);
    },

    // ── helpers ──
    _findMsg(msgId) {
        const convs = AppState.data.conversations || {};
        for (const key of Object.keys(convs)) {
            const m = (convs[key] || []).find(x => String(x.id) === String(msgId));
            if (m) return m;
        }
        return null;
    },
    _findCharForMsg(msgId) {
        const convs = AppState.data.conversations || {};
        for (const key of Object.keys(convs)) {
            const arr = convs[key] || [];
            if (arr.some(x => String(x.id) === String(msgId))) {
                // key = charId（单聊）或 'grp_' + groupId
                if (key.startsWith('grp_')) return null; // 群聊先不支持
                return (AppState.data.characters || []).find(c => c.id === key);
            }
        }
        return null;
    },

    // ── Prompt 协议片段（triggerAI 调用）──
    getProtocolPrompt(char) {
        const voiceId = this.resolveVoiceId(char);
        if (!voiceId) return ''; // 没 voice_id 不启用协议

        return `

[Voice Message Protocol]
You CAN send voice messages when it feels natural. Output them as a standalone JSON line:
{"type":"voice_message","content":"ここに話す内容"}

Use voice for:
- Greetings, casual reactions ("おはよう！" "ほんと！？" "ただいま〜")
- Emotional moments (laughter, surprise, sleepy voice)
- Things you'd naturally *say* out loud rather than type

Use text (no JSON wrapper) for:
- Long explanations, lists, links, URLs
- Texting-style casual banter (lol, kwsk, etc.)

Rules:
- Voice content must be naturally spoken, no brackets/parens/action descriptions (those won't be read aloud)
- Mix freely: some text lines, some voice lines in one reply
- Don't announce that you're sending voice, just do it
- Output JSON line alone, no explanations around it`;
    }
};
