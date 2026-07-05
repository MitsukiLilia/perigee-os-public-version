// 工具模块 - 包含数据持久化和API调用功能
const Utils = {
    generateId: () => Date.now().toString(36) + Math.random().toString(36).substr(2),
    // parseFloat + 有限性兜底：v 解析为有限数则用之，否则 fallback（修「temperature 显式 0 被 || 吞成 0.7」）
    _num(v, fallback) { const n = parseFloat(v); return Number.isFinite(n) ? n : fallback; },
    // fire-and-forget：86处调用无需改动
    saveData() {
        localforage.setItem('PerigeeOS', JSON.parse(JSON.stringify(AppState.data)))
            .catch(e => { console.error('[Save Error]', e); Utils.showToast('⚠️ 保存失败：' + e.message, 6000); });
    },
    // async：在 app.js DOMContentLoaded 里 await 一次
    async loadData() {
        try {
            // ── 数据迁移：localStorage → IndexedDB（只执行一次）──
            const legacy = localStorage.getItem('PerigeeOS');
            if (legacy) {
                const legacyData = JSON.parse(legacy);
                await localforage.setItem('PerigeeOS', legacyData);
                localStorage.removeItem('PerigeeOS');
                console.log('[Migration] localStorage → IndexedDB 完成，旧数据已清除');
            }
            // ── 从 localforage 加载 ──
            const saved = await localforage.getItem('PerigeeOS');
            if (saved) AppState.data = { ...AppState.data, ...saved };

            // ── 放送局重构迁移（v2.60）：扁平化 forumSlots + forumData → broadcast 抽离 + officialPosts 合并到 threads ──
            // 触发条件：forumData 里还残留旧字段（worldSetting / plotProgress / officialInfo / officialNpcs / officialPosts），即从 v2.59 及更早升级上来
            const _fd = AppState.data.forumData || {};
            const _hasLegacy = (_fd.worldSetting !== undefined)
                || (_fd.plotProgress !== undefined)
                || (_fd.officialInfo !== undefined)
                || (_fd.officialNpcs !== undefined)
                || (_fd.officialPosts !== undefined)
                || (AppState.data.forumSlotsMeta !== undefined && AppState.data.forumSlotsMeta !== null);
            if (_hasLegacy) {
                // 1. 扁平化多板块：取 currentForumSlotId 对应的 archive 作为唯一 forumData
                if (AppState.data.forumSlotsArchive && AppState.data.currentForumSlotId) {
                    const _active = AppState.data.forumSlotsArchive[AppState.data.currentForumSlotId];
                    if (_active && typeof _active === 'object') {
                        AppState.data.forumData = _active;
                    }
                }
                delete AppState.data.forumSlotsMeta;
                delete AppState.data.forumSlotsArchive;
                delete AppState.data.currentForumSlotId;

                const fd = AppState.data.forumData || (AppState.data.forumData = {});

                // 2. broadcast 字段抽离
                AppState.data.broadcast = {
                    worldSetting: fd.worldSetting || '',
                    worldBookId: fd.worldBookId || '',
                    worldBookIds: Array.isArray(fd.worldBookIds) && fd.worldBookIds.length
                        ? fd.worldBookIds
                        : (fd.worldBookId ? [fd.worldBookId] : []),
                    plotProgress: Array.isArray(fd.plotProgress) ? fd.plotProgress : [],
                    plotDrafts: Array.isArray(fd.plotDrafts) ? fd.plotDrafts : [],
                    officialInfo: Array.isArray(fd.officialInfo) ? fd.officialInfo : [],
                    officialNpcs: Array.isArray(fd.officialNpcs) ? fd.officialNpcs : [],
                    mergedSummaries: Array.isArray(fd.mergedSummaries) ? fd.mergedSummaries : [],
                    plotSummaries: Array.isArray(fd.plotSummaries) ? fd.plotSummaries : [],
                    officialSummaries: Array.isArray(fd.officialSummaries) ? fd.officialSummaries : [],
                    seriesEnded: typeof fd.seriesEnded === 'boolean' ? fd.seriesEnded : false   // v2.126.0 完結フラグ（ワンドロ 完結後ペース切替；未定義は falsy=連載中）
                };

                // 3. 旧 officialPosts → 合并进 threads（按 timestamp 倒序）
                if (Array.isArray(fd.officialPosts) && fd.officialPosts.length > 0) {
                    if (!Array.isArray(fd.threads)) fd.threads = [];
                    fd.threads = [...fd.officialPosts, ...fd.threads]
                        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                }

                // 4. 从 forumData 删抽走的字段
                ['worldSetting', 'worldBookId', 'worldBookIds',
                 'plotProgress', 'plotDrafts',
                 'officialInfo', 'officialNpcs', 'officialPosts',
                 'mergedSummaries', 'plotSummaries', 'officialSummaries']
                    .forEach(k => delete fd[k]);

                Utils.saveData();
                console.log('[Migration v2.60] forumData → broadcast 抽离 + slots 扁平化 + officialPosts 合并 完成');
            }

            // ── v2.128.0 一次性去重：修复链路A 历史重复自宣 ──
            // 链路B 生成的小说曾漏进链路A 反查池被反复自宣 → 同一 pixivNovelId 出现多条 fan 推。
            // 清掉冗余：点赞过的全留（回味用），否则只留最早一条（含链路B 原始安利推）。只碰 source==='fan'，npc 推不动。
            const _twd = AppState.data.twitterData;
            if (_twd && !_twd._dedupePromoV128) {
                const _tws = Array.isArray(_twd.npcTweets) ? _twd.npcTweets : [];
                const _likedIds = new Set((_twd.likedTweetIds || []).map(l => l.id));
                const _byNovel = {};
                _tws.forEach(tw => {
                    if (tw && tw.source === 'fan' && tw.pixivNovelId) {
                        (_byNovel[tw.pixivNovelId] = _byNovel[tw.pixivNovelId] || []).push(tw);
                    }
                });
                const _dropIds = new Set();
                Object.keys(_byNovel).forEach(nid => {
                    const group = _byNovel[nid];
                    if (group.length <= 1) return;   // 没重复
                    const _liked = group.filter(tw => _likedIds.has(tw.id));
                    const _keep = _liked.length
                        ? _liked   // 点赞过的全留
                        : [group.slice().sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))[0]];   // 否则留最早一条
                    const _keepSet = new Set(_keep.map(tw => tw.id));
                    group.forEach(tw => { if (!_keepSet.has(tw.id)) _dropIds.add(tw.id); });
                });
                if (_dropIds.size) {
                    _twd.npcTweets = _tws.filter(tw => !_dropIds.has(tw.id));
                    console.log(`[Migration v2.128] 链路A 重复自宣去重：清掉 ${_dropIds.size} 条冗余推文`);
                }
                _twd._dedupePromoV128 = true;
                Utils.saveData();
            }
        } catch (e) {
            console.error('[Load Error]', e);
            // fallback：迁移失败时保底从 localStorage 读取
            try {
                const fallback = localStorage.getItem('PerigeeOS');
                if (fallback) {
                    AppState.data = { ...AppState.data, ...JSON.parse(fallback) };
                    setTimeout(() => Utils.showToast('⚠️ データベース読み込み失敗。旧バックアップから復元しました。'), 1000);
                } else {
                    setTimeout(() => Utils.showToast('⚠️ データ読み込みに失敗しました。設定からバックアップを確認してください。', 5000), 1000);
                }
            } catch (e2) {
                console.error('[Fallback Load Error]', e2);
                setTimeout(() => Utils.showToast('⚠️ データ読み込みに失敗しました。設定からバックアップを確認してください。', 5000), 1000);
            }
        }
    },
    scrollToBottom: (el) => setTimeout(() => el.scrollTop = el.scrollHeight, 50),

    // 导出数据
    exportData() {
        const dataStr = JSON.stringify(AppState.data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const timestamp = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = `perigee-os-backup-${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert('✓ Data exported successfully');
    },

    // 导入数据
    importData(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (confirm('This will replace all current data. Continue?')) {
                    AppState.data = { ...AppState.data, ...importedData };
                    await localforage.setItem('PerigeeOS', JSON.parse(JSON.stringify(AppState.data)));
                    alert('✓ Data imported successfully. Refreshing...');
                    location.reload();
                }
            } catch (err) {
                alert('✗ Import failed: Invalid file format');
                console.error('Import error:', err);
            }
        };
        reader.readAsText(file);
    },

    // 统一的 API 调用方法（确保 endpoint 正确）
    buildChatEndpoint(baseUrl) {
        let url = baseUrl.trim();
        while (url.endsWith('/')) url = url.slice(0, -1);

        // 如果已经包含 /chat/completions，直接返回
        if (url.endsWith('/chat/completions')) return url;

        // 如果包含 /v1，在后面加 /chat/completions
        if (url.endsWith('/v1')) return `${url}/chat/completions`;

        // 否则加 /v1/chat/completions
        return `${url}/v1/chat/completions`;
    },

    // 调用不同模式的 Chat API
    // overrideConfig: { enabled, baseUrl, apiKey, model } — Pixiv 等模块的独立 API 配置
    // options（v2.73.7 新增、可选）：{ temperature, maxTokens } — caller 想要覆盖默认值时传入
    //   不传 options 或字段缺失时、各 API 函数走原有 fallback（全局 config.temperature → 0.7、max_tokens → 50000）
    async callChatAPI(messages, systemPrompt = null, overrideConfig = null, options = null) {
        // 若传入有效的独立配置，直接走 OpenAI 兼容路径
        if (overrideConfig && overrideConfig.enabled && overrideConfig.apiKey && overrideConfig.model) {
            const endpoint = this.buildChatEndpoint(overrideConfig.baseUrl || '');
            const res = await this._fetchWithTimeout(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${overrideConfig.apiKey}`
                },
                body: JSON.stringify({
                    model: overrideConfig.model,
                    messages: systemPrompt
                        ? [{ role: 'system', content: systemPrompt }, ...messages]
                        : messages,
                    temperature: options?.temperature ?? 0.7,
                    max_tokens: options?.maxTokens ?? 50000
                })
            });
            if (!res.ok) {
                const errorText = await res.text();
                const err = new Error(`API 请求失败 (${res.status}): ${errorText}`);
                err.code = 'api';
                err.status = res.status;
                throw err;
            }
            const data = await res.json();
            if (data.error) { const err = new Error(data.error.message || JSON.stringify(data.error)); err.code = 'api'; throw err; }
            if (!data.choices || !data.choices[0]) { const err = new Error('API 返回格式错误'); err.code = 'parse'; throw err; }
            return data.choices[0].message.content;
        }

        // 否则走全局配置
        const config = AppState.data.apiConfig;
        if (!config.key) throw new Error('请先在设置中配置 API Key');
        if (!config.model) throw new Error('请先在设置中选择模型');

        const mode = config.mode || 'openai';

        switch(mode) {
            case 'google':
                return await this.callGoogleAPI(messages, systemPrompt, options);
            case 'claude':
                return await this.callClaudeAPI(messages, systemPrompt, options);
            case 'deepseek':
            case 'openrouter':  // OpenRouter 文字聚合站，OpenAI 兼容
            case 'pioneer':     // Pioneer 官方中转站，OpenAI 兼容（callOpenAICompatibleAPI 内对 pioneer 双发 X-API-Key）
            case 'openai':
            default:
                return await this.callOpenAICompatibleAPI(messages, systemPrompt, options);
        }
    },

    // OpenAI 兼容 API (包括 DeepSeek)
    async callOpenAICompatibleAPI(messages, systemPrompt = null, options = null) {
        const config = AppState.data.apiConfig;
        const endpoint = this.buildChatEndpoint(config.url);

        // console.log('[API Call] Endpoint:', endpoint);
        // console.log('[API Call] Model:', config.model);

        // 支持 message.audio = { data: base64, mimeType }（OpenAI 兼容多模态格式）
        // 支持 message.image = { data: base64, mimeType }（data URI 形式的 image_url）
        const transformed = messages.map(m => {
            if (m.audio) {
                return {
                    role: m.role,
                    content: [
                        { type: 'text', text: m.content || '' },
                        { type: 'input_audio', input_audio: { data: m.audio.data, format: this._audioFormatFromMime(m.audio.mimeType) } }
                    ]
                };
            }
            if (m.image && m.image.data) {
                return {
                    role: m.role,
                    content: [
                        { type: 'text', text: m.content || '' },
                        { type: 'image_url', image_url: { url: `data:${m.image.mimeType || 'image/png'};base64,${m.image.data}` } }
                    ]
                };
            }
            return { role: m.role, content: m.content };
        });

        const requestBody = {
            model: config.model,
            messages: systemPrompt
                ? [{ role: 'system', content: systemPrompt }, ...transformed]
                : transformed,
            max_tokens: options?.maxTokens ?? 50000
        };
        // Pioneer 中转对部分上游模型（尤其 Claude）不接受采样参数，带 temperature 会报 upstream provider error
        // → Pioneer 模式省略 temperature（用模型默认采样）；其它 provider 照旧发
        if (config.mode !== 'pioneer') {
            requestBody.temperature = options?.temperature ?? Utils._num(config.temperature, 0.7);
        }

        // 鉴权头：标准 Bearer；Pioneer 中转站文档示例用 X-API-Key，双发兜底（服务器取其一）
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.key}`
        };
        if (config.mode === 'pioneer') headers['X-API-Key'] = config.key;

        const res = await this._fetchWithTimeout(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody)
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error('[API Call] Error Response:', errorText);
            const err = new Error(`API 请求失败 (${res.status}): ${errorText}`);
            err.code = 'api';
            err.status = res.status;
            throw err;
        }

        const data = await res.json();
        console.log('[API Call] Response:', data);

        if (data.error) { const err = new Error(data.error.message || JSON.stringify(data.error)); err.code = 'api'; throw err; }
        if (!data.choices || !data.choices[0]) { const err = new Error('API 返回格式错误'); err.code = 'parse'; throw err; }

        return data.choices[0].message.content;
    },

    // mimeType → format string for OpenAI input_audio (audio/mp4 → mp4; audio/webm;codecs=opus → webm)
    _audioFormatFromMime(mime) {
        const m = String(mime || '').toLowerCase();
        if (m.includes('mp4') || m.includes('m4a') || m.includes('aac')) return 'mp4';
        if (m.includes('mp3') || m.includes('mpeg')) return 'mp3';
        if (m.includes('wav')) return 'wav';
        if (m.includes('webm')) return 'webm';
        if (m.includes('ogg')) return 'ogg';
        if (m.includes('flac')) return 'flac';
        return 'webm';
    },

    // v2.68.10 长生成 timeout 友好处理：浏览器默认 5 min 抛 load failed，长篇 pixiv 需要更长窗口
    LLM_FETCH_TIMEOUT_MS: 600000, // 10 min
    async _fetchWithTimeout(url, options = {}, timeoutMs = null) {
        const ms = timeoutMs || Utils.LLM_FETCH_TIMEOUT_MS;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), ms);
        try {
            const res = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(timeoutId);
            return res;
        } catch (e) {
            clearTimeout(timeoutId);
            if (e.name === 'AbortError') {
                const err = new Error(`Request timed out after ${Math.round(ms / 1000)}s`);
                err.code = 'timeout';
                throw err;
            }
            // fetch 抛 TypeError(load failed) → 网络层错误
            const err = new Error(e.message || 'Network error');
            err.code = 'network';
            throw err;
        }
    },

    // Google AI Studio API
    async callGoogleAPI(messages, systemPrompt = null, options = null) {
        const config = AppState.data.apiConfig;
        const endpoint = `${config.url}/v1beta/models/${config.model}:generateContent?key=${config.key}`;

        // 转换消息格式
        let contents = [];
        if (systemPrompt) {
            contents.push({
                role: 'user',
                parts: [{ text: `[System Instructions]\n${systemPrompt}\n\n[Start of Conversation]` }]
            });
        }

        messages.forEach(msg => {
            const parts = [];
            if (msg.content) parts.push({ text: msg.content });
            if (msg.audio && msg.audio.data) {
                parts.push({ inline_data: { mime_type: msg.audio.mimeType || 'audio/webm', data: msg.audio.data } });
            }
            if (msg.image && msg.image.data) {
                parts.push({ inline_data: { mime_type: msg.image.mimeType || 'image/png', data: msg.image.data } });
            }
            if (parts.length === 0) parts.push({ text: '' });
            contents.push({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts
            });
        });

        const requestBody = {
            contents: contents,
            generationConfig: {
                temperature: options?.temperature ?? Utils._num(config.temperature, 0.7),
                maxOutputTokens: options?.maxTokens ?? 50000
            }
        };

        // 不打印 endpoint（含 ?key=）与 requestBody，避免明文 key / 用户内容进控制台
        const res = await this._fetchWithTimeout(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error('[Google API Error]', errorText);
            const err = new Error(`Google API 请求失败 (${res.status}): ${errorText}`);
            err.code = 'api';
            err.status = res.status;
            throw err;
        }

        const data = await res.json();
        console.log('[Google API Response]', data);

        const cand = data.candidates && data.candidates[0];
        const text = cand && cand.content && cand.content.parts && cand.content.parts[0] && cand.content.parts[0].text;
        if (!text) {
            const reason = cand && cand.finishReason;
            if (reason === 'MAX_TOKENS') { const err = new Error('Google API 返回被截断（生成内容过长）'); err.code = 'truncated'; throw err; }
            if (reason === 'SAFETY' || (data.promptFeedback && data.promptFeedback.blockReason)) { const err = new Error('Google API 内容被安全策略拦截'); err.code = 'safety'; throw err; }
            const err = new Error('Google API 返回格式错误'); err.code = 'parse'; throw err;
        }
        return text;
    },

    // Toast 轻量提示
    showToast(message, duration = 3000) {
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            document.body.appendChild(container);
        }
        const toast = document.createElement('div');
        toast.className = 'toast-item';
        toast.textContent = message;
        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    // Claude API
    async callClaudeAPI(messages, systemPrompt = null, options = null) {
        const config = AppState.data.apiConfig;
        const endpoint = `${config.url}/v1/messages`;

        // 支持 message.image = { data: base64, mimeType }（Anthropic base64 图片格式）
        const transformed = messages.map(m => {
            if (m.image && m.image.data) {
                return {
                    role: m.role,
                    content: [
                        { type: 'image', source: { type: 'base64', media_type: m.image.mimeType || 'image/png', data: m.image.data } },
                        { type: 'text', text: m.content || '' }
                    ]
                };
            }
            return m;
        });

        const requestBody = {
            model: config.model,
            max_tokens: options?.maxTokens ?? 50000,
            messages: transformed,
            temperature: options?.temperature ?? Utils._num(config.temperature, 0.7)
        };

        if (systemPrompt) {
            requestBody.system = systemPrompt;
        }

        console.log('[Claude API Call]', endpoint, requestBody);

        const res = await this._fetchWithTimeout(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': config.key,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify(requestBody)
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error('[Claude API Error]', errorText);
            const err = new Error(`Claude API 请求失败 (${res.status}): ${errorText}`);
            err.code = 'api';
            err.status = res.status;
            throw err;
        }

        const data = await res.json();
        console.log('[Claude API Response]', data);

        if (!data.content || !data.content[0]) {
            const err = new Error('Claude API 返回格式错误'); err.code = 'parse'; throw err;
        }

        return data.content[0].text;
    },

    // ===== 事件总线 =====
    emitEvent(type, source, data) {
        if (!AppState.data.recentEvents) AppState.data.recentEvents = [];
        const event = {
            id: Utils.generateId(),
            type,        // 'plot_published' | 'goods_announced' | 'official_info_added' | 'novel_published' | 'tweet_event' | 'magazine_published'
            timestamp: Date.now(),
            source,      // 'forum' | 'twitter' | 'pixiv' | 'magazine'
            data: data || {}
        };
        AppState.data.recentEvents.unshift(event);
        this.pruneEvents();
        this.saveData();
        console.log(`[EventBus] ${type} from ${source}:`, data?.title || '');
    },

    getRecentEvents({ source, type, since, limit } = {}) {
        const events = AppState.data.recentEvents || [];
        let filtered = events;
        if (source) filtered = filtered.filter(e => e.source === source);
        if (type) filtered = filtered.filter(e => e.type === type);
        if (since) filtered = filtered.filter(e => e.timestamp >= since);
        if (limit) filtered = filtered.slice(0, limit);
        return filtered;
    },

    pruneEvents() {
        if (!AppState.data.recentEvents) return;
        const TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
        const MAX = 20;
        const cutoff = Date.now() - TTL;
        AppState.data.recentEvents = AppState.data.recentEvents
            .filter(e => e.timestamp >= cutoff)
            .slice(0, MAX);
    },

    // 跨模块联动 prompt 片段
    getEventContextPrompt(limit = 5) {
        const events = this.getRecentEvents({ limit });
        if (events.length === 0) return '';
        const TYPE_LABELS = {
            plot_published: '新話公開',
            goods_announced: 'グッズ情報',
            official_info_added: '公式情報',
            novel_published: '二次創作',
            tweet_event: 'SNS話題',
            magazine_published: '雑誌記事',
            doujin_published: '同人誌新刊',
            doujin_event: '即売会情報',
            nico_video_published: 'ニコ動投稿',
            nico_trending: 'ニコ動話題',
            leak_posted: 'リーク情報'
        };
        const lines = events.map(e => {
            const label = TYPE_LABELS[e.type] || e.type;
            return `- [${label}] ${e.data.title || ''}${e.data.summary ? ': ' + e.data.summary : ''}`;
        });
        return `\n【最近のコミュニティ動向】\n${lines.join('\n')}\n`;
    },

    // ═══════════════════════════════════════════════════════
    // 共享 AI prompt 片段（避免在 6 个仿真模块里重复定义）
    // ═══════════════════════════════════════════════════════
    PROMPTS: {
        // 情報アクセス制限（厳守）— 防止 AI 引用未公开设定资料
        // 用法：${Utils.PROMPTS.infoAccessRule()} 或 ${Utils.PROMPTS.infoAccessRule('forum')}
        infoAccessRule(mode) {
            const intro = mode === 'forum'
                ? '掲示板のNPCは「作品の視聴者・ファン」です。'
                : 'あなたは「作品の視聴者・ファン」の視点です。';
            return `
⚠️ 情報アクセス制限（厳守）:
${intro}以下の情報階層を厳守すること。

【参照してよい情報】
- キャラクターの外見（容姿・服装・髪型など、PVや公式ビジュアルで確認できるもの）
- キャラクターの性別・年齢層・公式プロフィールに記載の基本情報
- 公式情報・スタッフインタビュー・PVで言及された内容
- 劇中で実際に描写・放送済みのシーンやイベント
- 上記に基づく合理的な推測や感想

【絶対に参照・言及・暗示してはならない情報】
- 設定資料に記載されているが劇中未公開のバックストーリーや過去
- キャラクター間の隠された関係性（劇中で明示されていないもの）
- 今後の展開・伏線の真相・隠された能力や正体
- 設定上のみ存在し、まだ物語で描写されていない情報全般

原則: 「設定資料に書いてある」≠「視聴者が知っている」。劇中で実際に描写されたかどうかだけが判断基準。
`;
        }
    },

    // ═══════════════════════════════════════════════════════
    // 共享 HTML 转义工具（新代码用，老 _esc/_escAttr 保留）
    // ═══════════════════════════════════════════════════════
    escHtml(s) {
        return String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    },

    // 放送局当前激活的世界书 ID 数组（兼容旧 worldBookId 单字段）
    getActiveWorldBookIds() {
        const bc = AppState.data.broadcast || {};
        if (Array.isArray(bc.worldBookIds) && bc.worldBookIds.length > 0) return bc.worldBookIds;
        return bc.worldBookId ? [bc.worldBookId] : [];
    },

    escAttr(s) {
        return String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/'/g, '&#39;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    },

    // 读取并压缩图片文件（File → dataURL）
    // opts: { maxSize: 边长上限px, quality: JPEG 质量 0~1 }
    async readImageFile(file, opts = {}) {
        if (!file || !file.type.startsWith('image/')) return null;
        const maxSize = opts.maxSize || 800;
        const quality = opts.quality ?? 0.85;
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    let { width, height } = img;
                    if (width > maxSize || height > maxSize) {
                        const ratio = Math.min(maxSize / width, maxSize / height);
                        width = Math.round(width * ratio);
                        height = Math.round(height * ratio);
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.onerror = () => reject(new Error('画像の読み込みに失敗'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('ファイル読み込み失敗'));
            reader.readAsDataURL(file);
        });
    },

    // 时间格式化（默认日式 'X分前'，opts 支持 short=去掉「前」，nowText=覆盖「たった今」，months=>30 日改ヶ月前）
    timeAgo(ts, opts = {}) {
        if (!ts) return '';
        const diff = Date.now() - ts;
        const m = Math.floor(diff / 60000);
        const h = Math.floor(diff / 3600000);
        const d = Math.floor(diff / 86400000);
        const suffix = opts.short ? '' : '前';
        const nowText = opts.nowText || 'たった今';
        if (m < 1) return nowText;
        if (m < 60) return `${m}分${suffix}`;
        if (h < 24) return `${h}時間${suffix}`;
        if (opts.months && d >= 30) return `${Math.floor(d / 30)}ヶ月${suffix}`;
        return `${d}日${suffix}`;
    },

    // ═══════════════════════════════════════════════════════
    // 全データクリア — 之前藏在 forum.js 里，移过来集中维护
    // 加新模块时只在下方 _DATA_DEFAULTS 里补一行即可
    // ═══════════════════════════════════════════════════════

    // 重置时**保留**的字段（API/系统配置/世界书/桌面布局/外部API/TTS）
    _PRESERVED_KEYS: ['apiConfig', 'systemConfig', 'worldBooks', 'desktopLayout', 'widgets', 'imageApiConfig', 'ttsConfig', '_clockWidgetMigrated', 'videoApiConfig'],

    // 各模块的"出厂默认"。新增模块时在这里补一行就够。
    _DATA_DEFAULTS() {
        return {
            characters: [],
            groups: [],
            conversations: {},
            chatMeta: {},
            chatSettings: { useLineGreen: true, bgColor: '#8cabd9', bgImageUrl: '', showRead: true, showTyping: true, fontSize: 'normal' },
            dictionary: [],
            knowledgeBase: [],
            writerData: { title: '', content: '', writingField: '', materialType: '' },
            userProfile: { name: 'User', dept: '', role: '', bio: '' },
            myPersonaPresets: [],
            activePersonaId: null,
            music: { songs: [] },
            wallet: null,
            voom: null,
            stickers: null,
            forumData: {
                forumRules: '', userName: '', isAnonymous: true, fontSize: 15,
                threads: [], favorites: [], legendNpcs: []
            },
            broadcast: {
                worldSetting: '', worldBookId: '', worldBookIds: [],
                plotProgress: [], plotDrafts: [],
                officialInfo: [], officialNpcs: [],
                mergedSummaries: [], plotSummaries: [], officialSummaries: [], seriesEnded: false
            },
            twitterData: {
                userName: '公式アカウント', userHandle: 'official', userAvatarLetter: 'M',
                tweets: [], npcTweets: [], dms: {}
            },
            pixivData: {
                settings: { cp: '', forumLinked: true, additionalWorldBookIds: [], customPrompt: '', novelRules: '', language: 'jp-cn', apiOverride: { enabled: false, baseUrl: '', apiKey: '', model: '' } },
                novels: [], favorites: [], illustrations: [], recentNovelAngles: []
            },
            magazineData: null,
            melonbooksData: null,
            niconicoData: null,
            videoGenTasks: [],
            tarotData: null,
            fortuneData: null,
            travelData: null,
            paymentData: null,
            calendarEvents: [],
            recentEvents: []
        };
    },

    // 论坛模块要保留绑定（世界书/规则/官方 NPC 等），传进来覆盖到 fresh 上
    resetAllData(opts = {}) {
        if (!confirm('⚠️ 全データをクリアしますか？\n（API設定・世界書・システム設定・デスクトップレイアウト以外すべて）\nこの操作は取り消せません。')) return false;
        if (!confirm('最終確認：本当にすべてのデータを消去しますか？')) return false;

        // 1. 备份要保留的全局配置
        const keep = {};
        for (const k of this._PRESERVED_KEYS) {
            if (AppState.data[k] !== undefined) {
                keep[k] = JSON.parse(JSON.stringify(AppState.data[k]));
            }
        }

        // 2. 论坛偏好字段保留（规则、用户名、匿名、字号）
        const forumKeep = {
            forumRules: AppState.data.forumData?.forumRules || '',
            userName: AppState.data.forumData?.userName || '',
            isAnonymous: AppState.data.forumData?.isAnonymous ?? true,
            fontSize: AppState.data.forumData?.fontSize
        };

        // 2.5 放送局整体保留（世界设定、世界书、剧情、情报、官方NPC、总结全部）
        const broadcastKeep = AppState.data.broadcast
            ? JSON.parse(JSON.stringify(AppState.data.broadcast))
            : null;

        // 3. 构建出厂默认 + 覆盖保留项
        const fresh = this._DATA_DEFAULTS();
        Object.assign(fresh, keep);
        fresh.forumData = { ...fresh.forumData, ...forumKeep };
        if (broadcastKeep) fresh.broadcast = { ...fresh.broadcast, ...broadcastKeep };
        if (opts.extraKeep) Object.assign(fresh, opts.extraKeep);

        // 4. 替换整个 data 对象
        Object.keys(AppState.data).forEach(k => delete AppState.data[k]);
        Object.assign(AppState.data, fresh);

        Utils.saveData();
        Utils.showToast('✓ 全データをクリアしました（API・世界書・設定は保持）');
        setTimeout(() => location.reload(), 800);
        return true;
    },
};
