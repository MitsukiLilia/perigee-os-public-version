// Seedance 视频生成 — 任务生命周期（提交/轮询/恢复/下载/存储）。UI 归 niconico，推文归 twitter。
const VideoGen = {
    MODELS: [
        { id: 'doubao-seedance-2-0-260128',        label: 'Seedance 2.0（音画·4K·参考图）', ref: true,  audio: true },
        { id: 'doubao-seedance-2-0-fast-260128',   label: 'Seedance 2.0 Fast（音画·参考图）', ref: true,  audio: true },
        { id: 'doubao-seedance-2-0-mini-260615',   label: 'Seedance 2.0 Mini（音画·参考图）', ref: true,  audio: true },
        { id: 'doubao-seedance-1-5-pro-251215',    label: 'Seedance 1.5 Pro（音画）',        ref: false, audio: true },
        { id: 'doubao-seedance-1-0-pro-250528',    label: 'Seedance 1.0 Pro（无声）',        ref: false, audio: false },
        { id: 'doubao-seedance-1-0-pro-fast-251015', label: 'Seedance 1.0 Pro Fast（无声·便宜）', ref: false, audio: false },
    ],
    POLL_INTERVAL: 15000,
    MAX_NET_FAILS: 5,
    MAX_CONCURRENT: 3,

    _store: null,
    _urlCache: new Map(),   // videoBlobId -> ObjectURL（会话级缓存，照 IllustGallery）
    _timers: new Map(),     // task.id -> setTimeout handle

    store() {
        if (!this._store) this._store = localforage.createInstance({ name: 'PerigeeVideo', storeName: 'clips' });
        return this._store;
    },
    async saveBlob(id, blob) { await this.store().setItem(id, blob); },
    async getBlob(id) { return await this.store().getItem(id); },
    async getUrl(id) {
        if (this._urlCache.has(id)) return this._urlCache.get(id);
        const blob = await this.getBlob(id);
        if (!blob) return null;
        const u = URL.createObjectURL(blob);
        this._urlCache.set(id, u);
        return u;
    },
    async removeBlob(id) {
        const u = this._urlCache.get(id);
        if (u) { URL.revokeObjectURL(u); this._urlCache.delete(id); }
        await this.store().removeItem(id);
    },

    config() { return AppState.data.videoApiConfig || {}; },
    tasks() {
        if (!AppState.data.videoGenTasks) AppState.data.videoGenTasks = [];
        return AppState.data.videoGenTasks;
    },
    activeTasks() { return this.tasks().filter(t => !['failed', 'expired'].includes(t.status)); },

    // params: {prompt, refImgIds[], model, resolution, duration, generateAudio, channelId, tweetAccountId}
    // tweetAccountId: officialNpcs 里的 npc.id | 'AUTO_CREATE' | null(不发推)
    async createTask(params) {
        const cfg = this.config();
        if (!cfg.workerUrl || !cfg.key) throw new Error(I18n.t('vg.err_no_config', '先在设置里配置视频生成 API'));
        if (this.activeTasks().length >= this.MAX_CONCURRENT) throw new Error(I18n.t('vg.err_concurrent', '同时最多 3 个生成任务'));

        const content = [{ type: 'text', text: params.prompt }];
        for (const imgId of (params.refImgIds || [])) {
            const blob = await IllustGallery.getBlob(imgId);
            if (!blob) continue;
            content.push({ type: 'image_url', image_url: { url: await this._blobToDataUrl(blob) }, role: 'reference_image' });
        }

        // ratio：1.0 系文生视频不接受 adaptive（联调实测报错），无参考图统一 16:9；有参考图 adaptive 跟图走
        const hasRef = content.some(c => c.role === 'reference_image');
        const body = {
            model: params.model, content,
            resolution: params.resolution, duration: params.duration,
            generate_audio: params.generateAudio, ratio: hasRef ? 'adaptive' : '16:9',
            execution_expires_after: 3600, watermark: false,
        };
        const resp = await this._arkFetch('/api/v3/contents/generations/tasks', {
            method: 'POST', body: JSON.stringify(body),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.id) throw new Error(data.error?.message || `HTTP ${resp.status}`);

        const task = {
            id: Utils.generateId(), taskId: data.id, status: 'queued',
            prompt: params.prompt, refImgIds: params.refImgIds || [],
            model: params.model, resolution: params.resolution,
            duration: params.duration, generateAudio: params.generateAudio,
            channelId: params.channelId, tweetAccountId: params.tweetAccountId,
            packaging: null, error: null, netFails: 0,
            createdAt: Date.now(), updatedAt: Date.now(),
        };
        this.tasks().push(task);
        Utils.saveData();
        this._generatePackaging(task);   // Task 4：并行、不 await
        this._schedulePoll(task.id, this.POLL_INTERVAL);
        return task;
    },

    _arkFetch(path, opts = {}) {
        const cfg = this.config();
        const base = (cfg.workerUrl || '').replace(/\/+$/, '');
        const headers = Object.assign({ 'Authorization': 'Bearer ' + cfg.key, 'Content-Type': 'application/json' }, opts.headers);
        return Utils._fetchWithTimeout(`${base}/ark${path}`, Object.assign({}, opts, { headers }), 60000);
    },

    _blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result);
            r.onerror = reject;
            r.readAsDataURL(blob);
        });
    },

    // 包装生成（PV のタイトル/説明/タグ/弾幕/コメント/告知ツイート文面）
    // LLM 呼び出しと世界観注入は niconico._generateVideos と同じ作法。失敗しても投稿自体は止めない
    // （_onSucceeded に既定値のフォールバックがある）。
    async _generatePackaging(task) {
        try {
            const autoCreate = task.tweetAccountId === 'AUTO_CREATE';
            const worldContext = (typeof Forum !== 'undefined' && Forum.getWorldContext) ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');

            const systemPrompt = `あなたはニコニコ動画のPV投稿情報とSNS告知文をシミュレートするAIです。
以下のPV映像の内容と作品世界に基づいて、投稿情報一式を生成してください。

## 作品世界の情報
${worldContext || '（世界観未設定 — キャラクター名・CP・ストーリーイベントなど具体的な作品情報を捏造しないこと。一般的なアニメ関連コンテンツとして生成すること）'}
${Utils.PROMPTS.infoAccessRule()}
${typeof Utils !== 'undefined' && Utils.getEventContextPrompt ? Utils.getEventContextPrompt(3) : ''}

## PV映像の内容（映像生成に使ったプロンプト原文）
${task.prompt}

## 出力形式（厳守）
以下のフォーマットのみを出力すること。

TITLE: 動画タイトル
TITLE_TL: TITLEの中国語（簡体字）翻訳
DESCRIPTION: 動画説明文（50〜100字）
DESC_TL: DESCRIPTIONの中国語（簡体字）翻訳
TAGS: タグ1,タグ2,タグ3,タグ4
VIEWS: 再生数（数値）
COMMENTS_COUNT: コメント数（数値）
MYLISTS: マイリスト数（数値）
DANMAKU_1: 弾幕コメント1
DANMAKU_2: 弾幕コメント2
DANMAKU_3: 弾幕コメント3
DANMAKU_4: 弾幕コメント4
DANMAKU_5: 弾幕コメント5
COMMENT_1: 通常コメント1（投稿者名:コメント内容）
COMMENT_2: 通常コメント2（投稿者名:コメント内容）
COMMENT_3: 通常コメント3（投稿者名:コメント内容）
TWEET_TEXT: 公式アカウントがこのPV公開を告知するツイート文面（日本語、ハッシュタグを1〜2個含める）
${autoCreate ? 'OFFICIAL_HANDLE: 告知する公式アカウントのハンドル名（英数字、@なし）\nOFFICIAL_NAME: 同アカウントの表示名' : ''}

## ルール
- タイトルはニコニコ動画らしい装飾を意識すること
- 弾幕コメントはニコニコ動画特有の短い合いの手のノリで
- 再生数は100〜500000の範囲でリアルに
- コメント数は再生数の1〜5%程度
- マイリスト数はコメント数の10〜50%程度
- 作品世界のキャラ名・設定を積極的に反映すること
- 🚫 設定にないストーリーを捏造するな`;

            const messages = [{ role: 'user', content: 'PVの投稿情報を生成してください。' }];
            const raw = await Utils.callChatAPI(messages, systemPrompt);
            task.packaging = VideoGen.parsePackaging(raw);
            Utils.saveData();
        } catch (e) {
            // 包装失败不阻塞视频（_onSucceeded 有占位默认值兜底）
            console.warn('[VideoGen] packaging LLM failed', e);
        }
    },

    // 纯函数：LLM 原文 → packaging 对象。挂在 VideoGen 上但不碰 DOM/AppState。
    parsePackaging(raw) {
        const get = (key) => {
            const m = String(raw).match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
            return m ? m[1].trim() : '';
        };
        const danmaku = [];
        for (let i = 1; i <= 5; i++) { const d = get(`DANMAKU_${i}`); if (d) danmaku.push(d); }
        const comments = [];
        for (let i = 1; i <= 3; i++) {
            const c = get(`COMMENT_${i}`);
            if (!c) continue;
            const idx = c.indexOf(':');
            comments.push(idx > 0 ? { author: c.slice(0, idx).trim(), text: c.slice(idx + 1).trim() } : { author: '匿名', text: c });
        }
        return {
            title: get('TITLE'), titleTl: get('TITLE_TL') || null,
            description: get('DESCRIPTION'), descTl: get('DESC_TL') || null,
            tags: get('TAGS') ? get('TAGS').split(',').map(s => s.trim()).filter(Boolean) : [],
            views: get('VIEWS') || '1000', commentCount: get('COMMENTS_COUNT') || '10', mylists: get('MYLISTS') || '50',
            danmaku, comments,
            tweetText: get('TWEET_TEXT') || null,
            officialHandle: get('OFFICIAL_HANDLE') || null,
            officialName: get('OFFICIAL_NAME') || null,
        };
    },

    init() {
        // App 启动恢复：所有未终态任务续查（关 App 期间任务照跑，火山侧 7 天可查）
        for (const t of this.tasks()) {
            if (['queued', 'running', 'downloading', 'paused'].includes(t.status)) {
                t.status = t.status === 'paused' ? 'queued' : t.status;
                t.netFails = 0;
                this._schedulePoll(t.id, 2000);
            }
        }
    },

    _schedulePoll(localId, delay) {
        clearTimeout(this._timers.get(localId));
        this._timers.set(localId, setTimeout(() => this._poll(localId), delay));
    },

    async _poll(localId) {
        const task = this.tasks().find(t => t.id === localId);
        if (!task) return;                                    // 用户已本地放弃 → 静默停
        try {
            // ?t= 防缓存：火山网关对 GET 有按 URL 的缓存变体，浏览器轮询会拿到陈旧 running（联调实测）
            const resp = await this._arkFetch(`/api/v3/contents/generations/tasks/${task.taskId}?t=${Date.now()}`, { method: 'GET' });
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok) throw new Error(data.error?.message || `HTTP ${resp.status}`);
            task.netFails = 0;

            if (data.status === 'succeeded') {
                task.status = 'downloading'; task.updatedAt = Date.now(); Utils.saveData();
                this._notifyUI(task);
                await this._onSucceeded(task, data);
            } else if (data.status === 'failed' || data.status === 'expired' || data.status === 'cancelled') {
                task.status = data.status === 'failed' ? 'failed' : 'expired';
                task.error = data.error?.message || data.status;
                task.updatedAt = Date.now(); Utils.saveData();
                this._notifyUI(task);
            } else {   // queued / running
                task.status = data.status; task.updatedAt = Date.now(); Utils.saveData();
                this._notifyUI(task);
                this._schedulePoll(localId, this.POLL_INTERVAL);
            }
        } catch (e) {
            task.netFails = (task.netFails || 0) + 1;
            if (task.netFails >= this.MAX_NET_FAILS) {
                task.status = 'paused'; task.updatedAt = Date.now(); Utils.saveData();   // 等待网络，init/手动重试续查
                this._notifyUI(task);
            } else {
                this._schedulePoll(localId, this.POLL_INTERVAL);
            }
        }
    },

    _notifyUI(task) {
        // niconico 占位卡就地刷新（模块不在前台时静默）
        if (typeof Niconico !== 'undefined' && Niconico.refreshGenCard) Niconico.refreshGenCard(task);
    },

    async _onSucceeded(task, data) {
        try {
            const videoUrl = data.content?.video_url;
            if (!videoUrl) throw new Error('no video_url');
            const blob = await this._download(videoUrl);

            // 竞态防护：下载期间用户可能已删任务
            if (!this.tasks().find(t => t.id === task.id)) return;

            // 配额检查（拿不到 estimate 的浏览器直接放行）
            const est = await (navigator.storage?.estimate?.() || Promise.resolve(null));
            if (est && est.quota - est.usage < blob.size * 1.5) {
                Utils.showToast(I18n.t('vg.err_quota', '存储空间不足，请清理后重试'));
            }

            const videoBlobId = 'vid-' + task.id;
            await this.saveBlob(videoBlobId, blob);
            const thumbBlob = await this._extractThumb(blob).catch(() => null);   // 抽帧失败不阻塞
            if (thumbBlob) await this.saveBlob('thumb:' + videoBlobId, thumbBlob);

            // 包装未就绪（LLM 慢/失败）→ 占位默认值，标题=提示词前 20 字
            const pk = task.packaging || { title: task.prompt.slice(0, 20), description: task.prompt, tags: [], danmaku: [], comments: [], views: 1000, tweetText: null };

            const video = Niconico.addRealVideo(task, pk, videoBlobId);           // Task 8
            if (task.tweetAccountId) Twitter.postOfficialPVTweet(task, pk, video); // Task 9

            AppState.data.videoGenTasks = this.tasks().filter(t => t.id !== task.id);
            Utils.saveData();
            Utils.showToast(I18n.t('vg.done', 'PV 投稿完了！'));
            this._notifyUI({ id: task.id, status: 'done' });
        } catch (e) {
            task.status = 'failed';
            task.error = String(e && e.message || e);
            task.updatedAt = Date.now(); Utils.saveData();
            this._notifyUI(task);
        }
    },

    async _download(videoUrl) {
        // 直连优先（TOS 可能本身带 CORS），失败走 worker /fetch 兜底
        try {
            const r = await fetch(videoUrl);
            if (r.ok) return await r.blob();
            throw new Error('direct ' + r.status);
        } catch (_) {
            const base = (this.config().workerUrl || '').replace(/\/+$/, '');
            const r2 = await fetch(`${base}/fetch?url=${encodeURIComponent(videoUrl)}`);
            if (!r2.ok) throw new Error(I18n.t('vg.err_download', '视频下载失败') + ` (${r2.status})`);
            return await r2.blob();
        }
    },

    _extractThumb(videoBlob) {
        return new Promise((resolve, reject) => {
            const v = document.createElement('video');
            v.muted = true; v.playsInline = true; v.preload = 'auto';
            v.src = URL.createObjectURL(videoBlob);
            v.onloadeddata = () => {
                v.currentTime = 0.1;   // iOS 首帧黑屏规避
            };
            v.onseeked = () => {
                const c = document.createElement('canvas');
                c.width = v.videoWidth; c.height = v.videoHeight;
                c.getContext('2d').drawImage(v, 0, 0);
                URL.revokeObjectURL(v.src);
                c.toBlob(b => b ? resolve(b) : reject(new Error('toBlob null')), 'image/jpeg', 0.8);
            };
            v.onerror = () => { URL.revokeObjectURL(v.src); reject(new Error('video load fail')); };
        });
    },

    // 本地放弃（火山无取消 API）：停轮询、删任务、清残留
    async abandonTask(localId) {
        clearTimeout(this._timers.get(localId));
        this._timers.delete(localId);
        AppState.data.videoGenTasks = this.tasks().filter(t => t.id !== localId);
        await this.removeBlob('vid-' + localId).catch(() => {});
        await this.removeBlob('thumb:vid-' + localId).catch(() => {});
        Utils.saveData();
    },

    // 失败/过期任务重试：复用原参数重新提交（packaging 保留不重新生成）
    async retryTask(localId) {
        const old = this.tasks().find(t => t.id === localId);
        if (!old) return;
        await this.abandonTask(localId);
        const task = await this.createTask(old);   // old 字段是 createTask params 超集
        if (old.packaging) { task.packaging = old.packaging; Utils.saveData(); }
        return task;
    },
};
