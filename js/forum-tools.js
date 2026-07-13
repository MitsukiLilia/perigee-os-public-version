// forum-tools.js — 从 js/forum.js 纯搬运拆出（v2.203.0）。
// 内容零改动；加载顺序：forum.js → generate → npc → goods → plot → tools（见 index.html）。
Object.assign(Forum, {
    // ===== 论坛设置 =====
    initSettings() {
        const data = AppState.data.forumData;
        document.getElementById('forumRules').value = data.forumRules || '';
        document.getElementById('forumAnonymous').checked = data.isAnonymous !== false;
        document.getElementById('forumUserName').value = data.userName || '';
        document.getElementById('forumUserName').disabled = data.isAnonymous !== false;

        document.getElementById('forumAnonymous').onchange = (e) => {
            document.getElementById('forumUserName').disabled = e.target.checked;
        };

        const fontSlider = document.getElementById('forumFontSize');
        const fontLabel = document.getElementById('forumFontSizeLabel');
        const savedSize = parseInt(data.fontSize) || 15;
        fontSlider.value = savedSize;
        fontLabel.textContent = I18n.t('forum.font_size_current', { n: savedSize });
        fontSlider.oninput = () => {
            fontLabel.textContent = I18n.t('forum.font_size_current', { n: fontSlider.value });
            document.documentElement.style.setProperty('--fch-font-size', fontSlider.value + 'px');
        };

        this.renderLegendNpcList();
        this.updateStorageBar();
    },

    // 从楼层 HTML 内容中提取纯日语文本（去掉 <details> 翻译块）
    _extractJapanese(html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        tmp.querySelectorAll('details.tl, details[class*="tl"]').forEach(el => el.remove());
        return tmp.textContent.replace(/\s+/g, ' ').trim();
    },

    // ===== TTS 语音朗读 =====
    speakPost(number) {
        const tts = AppState.data.ttsConfig || {};
        if (!tts.provider || tts.provider === 'none') {
            Utils.showToast(I18n.t('t.forum_tts_not_configured', '请先在设置中配置语音朗读'));
            return;
        }
        // 再次点击同一楼层 → 停止
        if (this._ttsCurrentNumber === number) {
            this._stopTTS();
            return;
        }
        this._stopTTS();

        const thread = this._findThread();
        if (!thread) return;
        const rawContent = number === 1
            ? thread.content
            : (thread.replies[number - 2] || {}).content || '';
        const text = this._extractJapanese(rawContent);
        if (!text) return;

        this._ttsCurrentNumber = number;
        this._updateTtsBtn(number, 'playing');

        if (tts.provider === 'minimax') {
            this._callMinimaxTTS(text, number);
        } else if (tts.provider === 'webspeech') {
            this._callWebSpeechTTS(text, number);
        } else if (tts.provider === 'custom') {
            this._callCustomTTS(text, number);
        }
    },

    async _callMinimaxTTS(text, number) {
        const tts = AppState.data.ttsConfig || {};
        try {
            const base = (typeof TTSSettings !== 'undefined')
                ? TTSSettings.getMinimaxBase(tts.minimaxRegion, tts.minimaxCustomBase)
                : 'https://api.minimax.io';
            // 当て字读音替换（与广播剧使用同一张表）
            const finalText = (typeof TTSEngine !== 'undefined' && TTSEngine.applyReadingMap)
                ? TTSEngine.applyReadingMap(text)
                : text;
            const body = {
                model: tts.speechModel || 'speech-2.8-hd',
                text: finalText,
                stream: false,
                voice_setting: { voice_id: tts.voiceId || 'Japanese_HikaruMale_Calm', speed: tts.speed || 1.0, vol: 1.0, pitch: 0 },
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
            if (data.base_resp && data.base_resp.status_code !== 0) throw new Error(data.base_resp.status_msg || '请求失败');

            // hex → Uint8Array → Blob → Audio
            const hex = data.data?.audio;
            if (!hex) throw new Error('TTS 响应格式错误：audio 数据为空');
            const bytes = new Uint8Array(hex.length / 2);
            for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
            const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mp3' }));

            // 异步竞态：fetch 期间用户已切换/停止朗读，这是个孤儿请求 → 直接释放并退出，别覆盖现役播放
            if (this._ttsCurrentNumber !== number) { URL.revokeObjectURL(url); return; }
            // 防御：若上一个 url 未释放，先 revoke 再记录新的
            this._revokeTtsUrl();
            this._ttsCurrentUrl = url;
            this._ttsAudio = new Audio(url);
            this._ttsAudio.onended = () => { this._revokeTtsUrl(); this._ttsCurrentNumber = null; this._updateTtsBtn(number, 'idle'); };
            this._ttsAudio.onerror = () => { this._revokeTtsUrl(); this._ttsCurrentNumber = null; this._updateTtsBtn(number, 'idle'); };
            this._ttsAudio.play();
        } catch (e) {
            Utils.showToast(I18n.t('t.forum_tts_failed', 'TTS 失败：') + e.message);
            this._ttsCurrentNumber = null;
            this._updateTtsBtn(number, 'idle');
        }
    },

    _callWebSpeechTTS(text, number) {
        if (!('speechSynthesis' in window)) {
            Utils.showToast(I18n.t('t.forum_tts_unsupported', '该设备不支持语音合成'));
            this._ttsCurrentNumber = null;
            this._updateTtsBtn(number, 'idle');
            return;
        }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ja-JP';
        utterance.rate = 0.9;
        const tts = AppState.data.ttsConfig || {};
        const voices = speechSynthesis.getVoices();
        const voice = tts.webSpeechVoice
            ? voices.find(v => v.name === tts.webSpeechVoice)
            : voices.find(v => v.lang.startsWith('ja'));
        if (voice) utterance.voice = voice;
        utterance.onend = () => { this._ttsCurrentNumber = null; this._updateTtsBtn(number, 'idle'); };
        utterance.onerror = () => { this._ttsCurrentNumber = null; this._updateTtsBtn(number, 'idle'); };
        speechSynthesis.speak(utterance);
    },

    async _callCustomTTS(text, number) {
        const tts = AppState.data.ttsConfig || {};
        try {
            let endpoint = (tts.customUrl || '').trim();
            if (!endpoint) throw new Error('未配置 TTS API URL');
            while (endpoint.endsWith('/')) endpoint = endpoint.slice(0, -1);
            if (!endpoint.endsWith('/v1/audio/speech')) {
                endpoint = endpoint.endsWith('/v1') ? `${endpoint}/audio/speech` : `${endpoint}/v1/audio/speech`;
            }
            const headers = { 'Content-Type': 'application/json' };
            if (tts.customApiKey) headers['Authorization'] = `Bearer ${tts.customApiKey}`;
            const res = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    model: tts.customModel || 'tts-1',
                    input: text,
                    voice: tts.customVoice || 'alloy'
                })
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            // 异步竞态：fetch 期间用户已切换/停止朗读，这是个孤儿请求 → 直接释放并退出，别覆盖现役播放
            if (this._ttsCurrentNumber !== number) { URL.revokeObjectURL(url); return; }
            // 防御：若上一个 url 未释放，先 revoke 再记录新的
            this._revokeTtsUrl();
            this._ttsCurrentUrl = url;
            this._ttsAudio = new Audio(url);
            this._ttsAudio.onended = () => { this._revokeTtsUrl(); this._ttsCurrentNumber = null; this._updateTtsBtn(number, 'idle'); };
            this._ttsAudio.onerror = () => { this._revokeTtsUrl(); this._ttsCurrentNumber = null; this._updateTtsBtn(number, 'idle'); };
            this._ttsAudio.play();
        } catch (e) {
            Utils.showToast(I18n.t('t.forum_tts_failed', 'TTS 失败：') + e.message);
            this._ttsCurrentNumber = null;
            this._updateTtsBtn(number, 'idle');
        }
    },

    // 释放当前 Audio 持有的 Blob ObjectURL（幂等：重复调用是 no-op）
    _revokeTtsUrl() {
        if (this._ttsCurrentUrl) {
            URL.revokeObjectURL(this._ttsCurrentUrl);
            this._ttsCurrentUrl = null;
        }
    },

    _stopTTS() {
        const prev = this._ttsCurrentNumber;
        if (this._ttsAudio) { this._ttsAudio.pause(); this._ttsAudio = null; }
        this._revokeTtsUrl();
        if ('speechSynthesis' in window) speechSynthesis.cancel();
        this._ttsCurrentNumber = null;
        if (prev) this._updateTtsBtn(prev, 'idle');
    },

    _updateTtsBtn(number, state) {
        const btn = document.getElementById(`tts-btn-${number}`);
        if (!btn) return;
        if (state === 'playing') {
            btn.style.color = 'var(--accent-color)';
            btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" style="width:13px;height:13px;"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
        } else {
            btn.style.color = '';
            btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
        }
    },

    // ===== 导出帖子 =====

    exportThread() {
        document.getElementById('exportModal').style.display = 'flex';
    },

    _exportText() {
        document.getElementById('exportModal').style.display = 'none';
        const thread = this._findThread();
        if (!thread) return;

        const title = this.stripTranslationTags(thread.title);
        let lines = [];
        lines.push(`■ ${title}`);
        lines.push(`${'─'.repeat(40)}`);

        const allPosts = [
            { number: 1, author: thread.author, authorId: thread.authorId, timestamp: thread.timestamp, content: thread.content },
            ...(thread.replies || [])
        ];

        const _nameLabel = I18n.t('forum.export_field_name', '名前：');
        const _idPrefix = I18n.t('forum.id_prefix', 'ID:');
        allPosts.forEach(p => {
            const dateStr = this.formatDate(p.timestamp);
            lines.push(`${p.number} ${_nameLabel}${p.author} ${dateStr} ${_idPrefix}${p.authorId}`);
            // 去除翻译标签，只保留日语原文
            const { jpText } = this.extractTranslations(p.content);
            lines.push((jpText || p.content).trim());
            lines.push('');
        });

        const text = lines.join('\n');
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title.slice(0, 30)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    },

    async _exportImage() {
        document.getElementById('exportModal').style.display = 'none';
        const thread = this._findThread();
        if (!thread) return;

        Utils.showToast(I18n.t('t.forum_generating_image', '生成图片中...'));

        // 动态加载 html2canvas
        if (!window.html2canvas) {
            await new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
                s.onload = resolve;
                s.onerror = () => reject(new Error('html2canvas 加载失败，请检查网络'));
                document.head.appendChild(s);
            }).catch(e => { Utils.showToast(e.message); throw e; });
        }

        // 创建离屏渲染容器
        const wrap = document.createElement('div');
        wrap.style.cssText = `
            position:fixed; left:-9999px; top:0;
            width:390px; background:#efefef;
            font-family:-apple-system,sans-serif;
            padding-bottom:16px;
        `;

        // 标题栏
        const titleBar = document.createElement('div');
        titleBar.style.cssText = 'background:#789922;color:white;padding:10px 14px;font-size:14px;font-weight:700;';
        titleBar.textContent = this.stripTranslationTags(thread.title);
        wrap.appendChild(titleBar);

        // 各帖
        const allPosts = [
            { number: 1, author: thread.author, authorId: thread.authorId, timestamp: thread.timestamp, content: thread.content },
            ...(thread.replies || [])
        ];
        allPosts.forEach(p => {
            const post = document.createElement('div');
            post.style.cssText = 'padding:10px 14px;border-bottom:1px solid #ddd;background:#efefef;';

            const header = document.createElement('div');
            header.style.cssText = 'font-size:12px;color:#666;margin-bottom:4px;';
            const _escH = s => Utils.escapeHtml(s || '');
            const _nameLabelH = I18n.t('forum.export_field_name', '名前：');
            const _idPrefixH = I18n.t('forum.id_prefix', 'ID:');
            header.innerHTML = `<b style="color:#000">${p.number}</b> ${_nameLabelH}<span style="color:#008000;font-weight:700;">${_escH(p.author)}</span> ${this.formatDate(p.timestamp)} <span style="color:#999">${_idPrefixH}${_escH(p.authorId)}</span>`;
            post.appendChild(header);

            const body = document.createElement('div');
            body.style.cssText = `font-size:14px;line-height:1.65;color:#333;padding-left:8px;white-space:pre-wrap;word-break:break-word;`;
            const { jpText } = this.extractTranslations(p.content);
            body.textContent = (jpText || p.content).trim();
            post.appendChild(body);
            wrap.appendChild(post);
        });

        document.body.appendChild(wrap);

        try {
            const canvas = await html2canvas(wrap, { scale: 2, useCORS: true, backgroundColor: '#efefef' });
            const url = canvas.toDataURL('image/png');
            const a = document.createElement('a');
            a.href = url;
            const safeTitle = this.stripTranslationTags(thread.title).slice(0, 30).replace(/[\\/:*?"<>|]/g, '_');
            a.download = `${safeTitle}.png`;
            a.click();
            Utils.showToast(I18n.t('t.forum_image_downloaded', '✓ 图片已下载'));
        } catch (e) {
            Utils.showToast(I18n.t('t.forum_image_gen_failed', '图片生成失败：') + e.message);
        } finally {
            wrap.remove();
        }
    },

    // ===== 论坛 + Pixiv 专项备份 =====

    exportForumData() {
        const payload = {
            _type: 'perigee-all-modules-backup',
            _version: 2,
            _exportedAt: new Date().toISOString(),
            forumData: AppState.data.forumData || {},
            pixivData: AppState.data.pixivData || {},
            magazineData: AppState.data.magazineData || {},
            twitterData: AppState.data.twitterData || {}
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const date = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = `perigee-backup-${date}.json`;
        a.click();
        URL.revokeObjectURL(url);
        Utils.showToast(I18n.t('t.forum_data_exported', '✓ 论坛+Pixiv+杂志+推特 数据已导出'));
    },

    importForumData(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const parsed = JSON.parse(e.target.result);
                // 兼容旧版 v1 和新版 v2
                if (parsed._type !== 'perigee-forum-pixiv-backup' && parsed._type !== 'perigee-all-modules-backup') {
                    Utils.showToast(I18n.t('t.forum_invalid_backup_file', '文件格式不正确，请选择备份文件'));
                    return;
                }
                const modules = [];
                if (parsed.forumData) modules.push(I18n.t('data_export.forum', '论坛'));
                if (parsed.pixivData) modules.push(I18n.t('data_export.pixiv', 'Pixiv'));
                if (parsed.magazineData) modules.push(I18n.t('data_export.magazine', '杂志'));
                if (parsed.twitterData) modules.push(I18n.t('data_export.twitter', '推特'));
                if (!confirm(I18n.t('forum.confirm_import_modules', { modules: modules.join('+') }))) return;
                if (parsed.forumData) AppState.data.forumData = parsed.forumData;
                if (parsed.pixivData) AppState.data.pixivData = parsed.pixivData;
                if (parsed.magazineData) AppState.data.magazineData = parsed.magazineData;
                if (parsed.twitterData) AppState.data.twitterData = parsed.twitterData;
                AppState.data._v = 0;   // 分板块导入可能往新 _v 的树里塞旧结构板块数据：重置 _v，reload 后全量重跑迁移（各条自带幂等守卫，重跑无害）
                Utils.showToast(I18n.t('t.forum_import_success', '✓ 导入成功，即将刷新'));
                // 落盘完成后再刷新，防 reload 掉防抖窗口内的导入数据
                Utils.flushSave().then(() => setTimeout(() => location.reload(), 1000));
            } catch (err) {
                Utils.showToast(I18n.t('t.forum_import_failed', '导入失败：文件格式错误'));
            }
        };
        reader.readAsText(file);
    },

    // 全データクリア → 已迁移到 Utils.resetAllData()，此处保留薄壳供旧调用点使用
    clearAllModuleData() {
        return Utils.resetAllData();
    },

    updateStorageBar() {
        const bar = document.getElementById('storageBar');
        const text = document.getElementById('storageText');
        if (!bar || !text) return;

        // 迁移到 IndexedDB 后，直接估算 AppState.data 序列化大小
        let totalBytes = 0;
        try {
            totalBytes = JSON.stringify(AppState.data).length * 2; // UTF-16: 2 bytes/char
        } catch (e) { return; }

        const usedKB = (totalBytes / 1024).toFixed(1);
        const usedMB = (totalBytes / 1024 / 1024).toFixed(2);
        const LIMIT_MB = 50; // IndexedDB 可用容量保守估计 50MB
        const pct = Math.min((totalBytes / 1024 / 1024 / LIMIT_MB) * 100, 100);

        bar.style.width = pct + '%';
        const rs = getComputedStyle(document.documentElement);
        if (pct < 60) {
            bar.style.background = rs.getPropertyValue('--success-color').trim() || '#34c759';
        } else if (pct < 85) {
            bar.style.background = rs.getPropertyValue('--warning-color').trim() || '#ff9500';
        } else {
            bar.style.background = rs.getPropertyValue('--danger-color').trim() || '#ff3b30';
        }

        const warning = pct >= 85 ? I18n.t('data.storage_warning') : '';
        text.textContent = I18n.t('data.storage_used', {
            usedMB,
            limitMB: LIMIT_MB,
            pct: pct.toFixed(1),
            usedKB,
            warning
        });
    },

    saveSettings() {
        const data = AppState.data.forumData;
        data.forumRules = document.getElementById('forumRules').value.trim();
        data.isAnonymous = document.getElementById('forumAnonymous').checked;
        data.userName = document.getElementById('forumUserName').value.trim();
        data.fontSize = parseInt(document.getElementById('forumFontSize').value) || 15;
        this.applyFontSize();

        Utils.saveData();
        Utils.showToast(I18n.t('t.forum_settings_saved', '✓ 论坛设置已保存'));
    },

});
