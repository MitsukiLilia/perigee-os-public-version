// 视频生成 — 任务生命周期（提交/轮询/恢复/下载/存储）。UI 归 niconico，推文归 twitter。
// 多渠道（2026-08-09）：火山方舟 Seedance（provider='ark'，原有唯一渠道）+ MiniMax H3（provider='minimax'）
// + MiniMax v1/Hailuo 系（provider='minimax_v1'，订阅 Plan 可用——H3 要付费 key，v1 老接口 Plan 吃得动）。
// AppState.data.videoApiConfig.provider 决定当前生效渠道；videoApiPresets 是配置快照，UI 在 settings.js VideoAPISettings。
const VideoGen = {
    // 保留：火山模型列表，向后兼容既有直接引用（settings.js 拉取模型合并逻辑等）。PROVIDERS.ark.models 转发本表。
    MODELS: [
        // 2.5 分辨率三档（480p/720p/1080p）：文档明确 4k 仅 2.0 支持，_pvOnModelChange 的 is4kModel 只认 2.0 正主即可
        { id: 'doubao-seedance-2-5-260628',        label: 'Seedance 2.5（音画·运镜强·参考图）', ref: true, audio: true },
        { id: 'doubao-seedance-2-0-260128',        label: 'Seedance 2.0（音画·4K·参考图）', ref: true,  audio: true },
        { id: 'doubao-seedance-2-0-fast-260128',   label: 'Seedance 2.0 Fast（音画·参考图）', ref: true,  audio: true },
        { id: 'doubao-seedance-2-0-mini-260615',   label: 'Seedance 2.0 Mini（音画·参考图）', ref: true,  audio: true },
        { id: 'doubao-seedance-1-5-pro-251215',    label: 'Seedance 1.5 Pro（音画）',        ref: false, audio: true },
        { id: 'doubao-seedance-1-0-pro-250528',    label: 'Seedance 1.0 Pro（无声）',        ref: false, audio: false },
        { id: 'doubao-seedance-1-0-pro-fast-251015', label: 'Seedance 1.0 Pro Fast（无声·便宜）', ref: false, audio: false },
    ],

    // Provider 元数据表：label（设置面板展示）/ models（models() 消费）/ pathPrefix（_providerFetch 拼 URL）。
    // ark.models 用 getter 转发 VideoGen.MODELS，避免同一份火山模型列表维护两份；getter 里引用外层 const VideoGen
    // 是安全的——getter 函数体只在真正被访问时才执行，那时整个对象字面量早已构造完毕，不受 TDZ 影响。
    PROVIDERS: {
        ark: {
            label: '火山方舟 Seedance',
            get models() { return VideoGen.MODELS; },
            pathPrefix: '/ark'
        },
        minimax: {
            label: 'MiniMax H3',
            // H3 恒有声（无 audio:false 版本），文档实测核对：768P/2K 两档分辨率、4-15s 整数时长、≤9 张参考图
            models: [
                { id: 'MiniMax-H3', label: 'MiniMax-H3（音画·2K·参考图）', ref: true, audio: true }
            ],
            pathPrefix: '/minimax'
        },
        minimax_v1: {
            label: 'MiniMax Hailuo（订阅Plan可用）',
            // v1（Hailuo 系）走 MiniMax 老接口，API 形状跟 v2/H3 完全不同（扁平 body、query 参数轮询、
            // 拿产物多一跳 files/retrieve——见 _createTaskV1/_poll/_onSucceeded 里的 provider 分支）。
            // 全系无声（实测成片零音轨）、512P/768P/1080P 三档分辨率、时长只有 6/10 两档离散值（非连续区间）、
            // 参考图只吃 1 张（语义是"视频首帧" first_frame_image，不是风格参考）。
            // 好处：TokenPlan/订阅额度吃得动这系——H3 要付费 key 才行，实测 plan key 打 H3 报
            // "TokenPlan 或 Credit 暂不支持 MiniMax-H3 系列模型 (2013)"，是 H3 专属限制，不影响 v1（2026-08-09 实测）
            models: [
                { id: 'MiniMax-Hailuo-2.3',      label: 'MiniMax-Hailuo-2.3（无声·可首帧图）',      ref: true, audio: false },
                { id: 'MiniMax-Hailuo-2.3-Fast',  label: 'MiniMax-Hailuo-2.3-Fast（无声·可首帧图）',  ref: true, audio: false },
                { id: 'MiniMax-Hailuo-02',        label: 'MiniMax-Hailuo-02（无声·可首帧图）',        ref: true, audio: false }
            ],
            pathPrefix: '/minimax'   // 同一 upstream api.minimaxi.com，worker 路由不用改
        }
    },

    POLL_INTERVAL: 15000,
    MAX_NET_FAILS: 5,
    MAX_CONCURRENT: 3,
    MAX_REF_IMG_BYTES: 30 * 1024 * 1024,      // 单图上限（火山文档：单图 <30MB；MiniMax H3 无更严格限制，两家共用同一上限沿用）
    MAX_REF_REQUEST_BYTES: 60 * 1024 * 1024,  // 累计请求体上限（ark/H3 文档都是 <64MB，留余量；v1 只吃单张，见下方独立常量）
    MAX_REF_IMG_BYTES_V1: 20 * 1024 * 1024,   // v1(Hailuo) 单图上限更严：官方文档 <20MB（另两家 30MB），且只吃 1 张，无需另设累计上限

    _store: null,
    _urlCache: new Map(),   // videoBlobId -> ObjectURL（会话级缓存，照 IllustGallery）
    _timers: new Map(),     // task.id -> setTimeout handle
    // v2.246 review（C5）：正在 retryTask() 中的旧任务 localId 集合。retryTask 结尾会自己调 abandonTask 删掉
    // localId——niconico.js 的「再試行」/「削除」按钮入口据此挡双击和撞车的删除，见 retryTask 注释
    _retryingIds: new Set(),

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

    // 参考図 blob 解析口径統一（v2.244）：pvtemp_ 前缀（PV 表単のアルバムから選択・niconico._pvOnAlbumFilesChange
    // が保存したもの）は本モジュール自身の store()（refaud- と同じ localforage インスタンス）から読む——
    // 一時アップロード画像を IllustGallery（Pixiv 収蔵）に混ぜたくない。それ以外は既存どおり IllustGallery
    async _resolveRefBlob(imgId) {
        return (typeof imgId === 'string' && imgId.startsWith('pvtemp_'))
            ? await this.getBlob(imgId)
            : await IllustGallery.getBlob(imgId);
    },

    config() { return AppState.data.videoApiConfig || {}; },
    // 当前（或指定）provider 的模型列表；provider 未知时兜底火山列表，行为等同旧版只有一家渠道时的默认值
    models(provider) {
        const p = provider || this.config().provider || 'ark';
        const entry = this.PROVIDERS[p];
        return (entry && entry.models) || this.MODELS;
    },
    tasks() {
        if (!AppState.data.videoGenTasks) AppState.data.videoGenTasks = [];
        return AppState.data.videoGenTasks;
    },
    activeTasks() { return this.tasks().filter(t => !['failed', 'expired'].includes(t.status)); },

    // params: {prompt, refImgIds[], model, resolution, duration, generateAudio, channelId, tweetAccountId}
    // tweetAccountId: officialNpcs 里的 npc.id | 'AUTO_CREATE' | null(不发推)
    // provider 恒从当前生效配置（cfg.provider）取，不读 params——重投/retryTask 必须跟着"现在配的是哪家"走，
    // 不能沿用任务当初创建时的渠道（那正是下面模型校验要防的场景：切换渠道后重投旧任务，模型 id 对不上新渠道）
    async createTask(params) {
        const cfg = this.config();
        const provider = cfg.provider || 'ark';
        if (!cfg.workerUrl || !cfg.key) throw new Error(I18n.t('vg.err_no_config', '先在设置里配置视频生成 API'));
        if (this.activeTasks().length >= this.MAX_CONCURRENT) throw new Error(I18n.t('vg.err_concurrent', '同时最多 3 个生成任务'));

        // 防切换 provider 后 retryTask 拿着旧渠道的模型 id 重投给新渠道：只在模型明确属于**另一家**渠道的
        // 内置表时才拒。不能反过来要求"必须在当前渠道内置表里"——ark 的「拉取模型列表」允许选到内置表之外的
        // 新 seedance 模型 id（旧行为一直放行），白名单式校验会误杀这类合法配置
        const belongsToOther = Object.entries(this.PROVIDERS).some(([key, p]) =>
            key !== provider && (p.models || []).some(m => m.id === params.model));
        if (belongsToOther) {
            throw new Error(I18n.t('vg.err_model_provider_mismatch', { model: params.model }));
        }

        // v1(Hailuo) 的请求体形状跟下面 ark/H3 的 content 数组式完全不同（扁平 body、单张首帧图），
        // 独立分支处理，不往下面的 content 数组逻辑里硬塞
        if (provider === 'minimax_v1') {
            return await this._createTaskV1(params, cfg);
        }

        const content = [{ type: 'text', text: params.prompt }];
        let refBytesTotal = 0, refIndex = 0;
        for (const imgId of (params.refImgIds || [])) {
            const blob = await this._resolveRefBlob(imgId);
            if (!blob) continue;
            refIndex++;
            const dataUrl = await this._blobToDataUrl(blob);
            const base64Len = dataUrl.length - (dataUrl.indexOf(',') + 1);   // 去掉 'data:...;base64,' 头部再估算
            const bytes = Math.floor(base64Len * 3 / 4);
            if (bytes > this.MAX_REF_IMG_BYTES) {
                throw new Error(I18n.t('vg.err_img_too_large', { n: refIndex, size: (bytes / 1024 / 1024).toFixed(1) }));
            }
            refBytesTotal += bytes;
            if (refBytesTotal > this.MAX_REF_REQUEST_BYTES) {
                throw new Error(I18n.t('vg.err_req_too_large', { size: (refBytesTotal / 1024 / 1024).toFixed(1) }));
            }
            content.push({ type: 'image_url', image_url: { url: dataUrl }, role: 'reference_image' });
        }

        // 参考音声（v2.241）：ark/H3 都吃 content 数组里的 audio_url 元素（实测两家都跑通，2026-08-09）。
        // v1(Hailuo) 走不到这里（上面已 return _createTaskV1）——不支持音频参考，UI 层也已隐藏该区域。
        // 约束（两家一致）：mp3/wav、单段 [2,15]s、单文件 <=15MB（UI 选择时已校验+裁剪，这里只管字节计入总量）、
        // 请求体总量 <=64MB（沿用上面图片累计的 refBytesTotal/MAX_REF_REQUEST_BYTES，图+音共用同一顶）
        if (params.refAudio && params.refAudio.blob) {
            const rawDataUrl = await this._blobToDataUrl(params.refAudio.blob);
            const base64Len = rawDataUrl.length - (rawDataUrl.indexOf(',') + 1);
            const bytes = Math.floor(base64Len * 3 / 4);
            refBytesTotal += bytes;
            if (refBytesTotal > this.MAX_REF_REQUEST_BYTES) {
                throw new Error(I18n.t('vg.err_req_too_large', { size: (refBytesTotal / 1024 / 1024).toFixed(1) }));
            }
            // MIME 归一化：FileReader/浏览器给出的 blob.type 可能是 audio/mpeg、audio/x-wav 等，
            // 但两家文档要求 dataUrl 里的格式名字面量是 audio/mp3 或 audio/wav——正则替换掉 dataUrl 头部的 MIME 段
            const mime = /mpeg|mp3/i.test(params.refAudio.blob.type || '') ? 'audio/mp3' : 'audio/wav';
            const audioDataUrl = rawDataUrl.replace(/^data:[^;]+;/, `data:${mime};`);
            content.push({ type: 'audio_url', audio_url: { url: audioDataUrl }, role: 'reference_audio' });
        }

        // ratio：无参考图恒 16:9（1.0 系文生不接受 adaptive，联调实测报错；文生场景 UI 也不给选）；
        // 有参考图时用表单选的 params.ratio（v2.240 起默认 16:9——PV 基本都是这个尺寸，方形立绘做参考时
        // adaptive 会跟图出方形视频，2026-08-09 实测；选 16:9 时平台对参考图居中裁剪适配）。
        // params.ratio 缺省兜 adaptive = 旧版任务 retryTask 重投时保持旧行为。两家渠道枚举通用（实测核对过）
        const hasRef = content.some(c => c.role === 'reference_image');
        const body = {
            model: params.model, content,
            resolution: params.resolution, duration: params.duration,
            ratio: hasRef ? (params.ratio || 'adaptive') : '16:9',
        };
        let createPath;
        if (provider === 'minimax') {
            // H3 恒有声，不发 generate_audio；无 execution_expires_after/watermark 概念，改发 aigc_watermark
            body.aigc_watermark = false;
            createPath = '/v2/video_generation';
        } else {
            body.generate_audio = params.generateAudio;
            body.execution_expires_after = 3600;
            body.watermark = false;
            createPath = '/api/v3/contents/generations/tasks';
        }

        const resp = await this._providerFetch(createPath, {
            method: 'POST', body: JSON.stringify(body),
        }, provider, null, 300000);   // 创建任务带 base64 媒体大载荷，5 分钟窗口（v2.245.1）
        const data = await resp.json().catch(() => ({}));
        // 创建响应：ark 是 data.id，minimax 是 data.task_id；创建失败两家都是 OpenAI 风格 data.error?.message
        const remoteTaskId = provider === 'minimax' ? data.task_id : data.id;
        if (!resp.ok || !remoteTaskId) throw new Error(data.error?.message || `HTTP ${resp.status}`);

        const task = {
            id: Utils.generateId(), taskId: remoteTaskId, status: 'queued',
            provider,
            // 凭据快照：飞行中任务的轮询/下载用创建时的 workerUrl/key，不受之后切换预设影响（_providerFetch auth 参数）。
            // key 与 videoApiConfig 同库存储、任务终态即出列删除，不构成新的暴露面
            workerUrl: cfg.workerUrl, key: cfg.key,
            prompt: params.prompt, refImgIds: params.refImgIds || [],
            model: params.model, resolution: params.resolution, ratio: params.ratio,
            duration: params.duration, generateAudio: params.generateAudio,
            channelId: params.channelId, tweetAccountId: params.tweetAccountId,
            // 参考音声元数据（v2.241）：只存文件名/时长这两个轻量字段，绝不把 dataUrl/base64 存进 task 对象——
            // task 活在 AppState.data 里，每次 saveData 全量序列化，几 MB 的 base64 字符串会拖慢全局保存。
            // 音频 blob 真身落 VideoGen.store()（下面单独 saveBlob），跟 vid-*/thumb:* 用同一个 localforage 实例
            refAudioName: (params.refAudio && params.refAudio.blob) ? (params.refAudio.name || '') : null,
            refAudioDuration: (params.refAudio && params.refAudio.blob) ? (params.refAudio.duration || 0) : null,
            packaging: null, error: null, netFails: 0,
            createdAt: Date.now(), updatedAt: Date.now(),
        };
        this.tasks().push(task);
        Utils.saveData();
        if (params.refAudio && params.refAudio.blob) {
            // best-effort：写失败也不阻断任务创建——retryTask 读不到 blob 时会走降级提示继续生成
            await this.saveBlob('refaud-' + task.id, params.refAudio.blob).catch(e => console.warn('[VideoGen] refAudio store failed', e));
        }
        this._generatePackaging(task);   // Task 4：并行、不 await
        this._schedulePoll(task.id, this.POLL_INTERVAL);
        return task;
    },

    // path 前缀按 provider 拼（/ark 或 /minimax）。provider 显式传参优先于当前配置——
    // _poll/_onSucceeded 用它按"任务创建时的渠道"而非"现在配的渠道"请求，防用户在任务进行中于设置里切换
    // provider 后，飞行中任务的轮询/下载被错误地按新渠道的 URL 形状和响应形状解析。
    // auth：凭据快照（{workerUrl, key}，实际传 task 对象）。只钉 URL 形状不钉凭据是不够的——切换预设保存后
    // 当前配置的 key 已经是另一家的，拿它打旧渠道的轮询必 401，5 次后任务假死 paused（v2.240 review 修）。
    // 快照不完整（升级前创建的老任务无此字段）时回落当前配置 = 修复前行为。
    // timeoutMs：默认 60s（轮询/查询够用）；createTask 类带 base64 媒体大载荷的调用要显式传更长窗口——
    // 参考音声 WAV+立绘 base64 后数 MB，上传+渠道侧同步接收媒体常超 60s（v2.245.1 真机实锤 timeout）
    _providerFetch(path, opts = {}, provider, auth, timeoutMs = 60000) {
        const cfg = this.config();
        const p = provider || cfg.provider || 'ark';
        const prefix = (this.PROVIDERS[p] && this.PROVIDERS[p].pathPrefix) || '/ark';
        const a = (auth && auth.workerUrl && auth.key) ? auth : cfg;
        const base = (a.workerUrl || '').replace(/\/+$/, '');
        const headers = Object.assign({ 'Authorization': 'Bearer ' + a.key, 'Content-Type': 'application/json' }, opts.headers);
        return Utils._fetchWithTimeout(`${base}${prefix}${path}`, Object.assign({}, opts, { headers }), timeoutMs);
    },

    // MiniMax v1（Hailuo 系，订阅 Plan 可用）：请求体是扁平结构，不是 ark/H3 那种 content 数组；
    // 参考图最多 1 张、语义是"视频首帧"（first_frame_image），不是风格参考；无 ratio/音频相关字段。
    // 只被上面 createTask 在 provider === 'minimax_v1' 时调用，params 形状与 createTask 完全一致。
    async _createTaskV1(params, cfg) {
        const body = {
            model: params.model,
            prompt: params.prompt,
            duration: params.duration,
            resolution: params.resolution,
        };

        // UI 层（niconico._pvMaxRefImages）已经把画廊选择上限做成 1，这里再裁一刀保险——
        // 防止有其它调用路径（比如未来别的入口）带着多张图片参数进来
        const refImgIds = (params.refImgIds || []).slice(0, 1);
        if (refImgIds.length) {
            const blob = await this._resolveRefBlob(refImgIds[0]);
            if (blob) {
                const dataUrl = await this._blobToDataUrl(blob);
                const base64Len = dataUrl.length - (dataUrl.indexOf(',') + 1);
                const bytes = Math.floor(base64Len * 3 / 4);
                if (bytes > this.MAX_REF_IMG_BYTES_V1) {
                    throw new Error(I18n.t('vg.err_img_too_large', { n: 1, size: (bytes / 1024 / 1024).toFixed(1) }));
                }
                body.first_frame_image = dataUrl;
            }
        }

        const resp = await this._providerFetch('/v1/video_generation', {
            method: 'POST', body: JSON.stringify(body),
        }, 'minimax_v1', null, 300000);   // 同 createTask：首帧图 base64 大载荷，5 分钟窗口（v2.245.1）
        const data = await resp.json().catch(() => ({}));
        const remoteTaskId = data.task_id;
        // v1 走 MiniMax 的老式 base_resp 信封（{status_code, status_msg}），不一定是 v2/H3 那种 OpenAI 风格
        // error.message——两个都兜一下，防止猜错信封形状时把错误消息整个丢掉
        if (!resp.ok || !remoteTaskId) {
            throw new Error(data.base_resp?.status_msg || data.error?.message || `HTTP ${resp.status}`);
        }

        const task = {
            id: Utils.generateId(), taskId: remoteTaskId, status: 'queued',
            provider: 'minimax_v1',
            workerUrl: cfg.workerUrl, key: cfg.key,   // 凭据快照，理由同 createTask 主分支
            prompt: params.prompt, refImgIds,
            model: params.model, resolution: params.resolution,
            duration: params.duration, generateAudio: false,   // v1 全系无声，不存在"是否生成音声"这回事
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
            const pk = VideoGen.parsePackaging(raw);
            const stillPending = this.tasks().find(t => t.id === task.id);
            if (stillPending) {
                stillPending.packaging = pk;
                Utils.saveData();
            } else if (typeof Niconico !== 'undefined' && Niconico.applyPackagingBackfill) {
                // 包装 LLM 比視頻生成慢：_onSucceeded 已用占位値把視頻入库、task 已出列。
                // 按 videoBlobId 逆引きして本物の情報を埋め直す（見つからなければ動画削除済み=放弃）
                Niconico.applyPackagingBackfill(task.id, pk);
            }
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
        // provider 取任务自己记的（而不是当前配置）：轮询用的 URL 形状 + 响应字段路径都得跟"创建时是哪家"一致，
        // 不受用户之后在设置里切换 provider 影响。老任务（升级前创建、无 provider 字段）落 ark，正是当时唯一渠道
        const provider = task.provider || 'ark';
        try {
            let resp;
            if (provider === 'minimax_v1') {
                // v1 是 query 参数不是路径段；实测同 H3 一样无网关缓存问题，不用加 ?t=
                resp = await this._providerFetch(`/v1/query/video_generation?task_id=${encodeURIComponent(task.taskId)}`, { method: 'GET' }, provider, task);
            } else if (provider === 'minimax') {
                // 实测 MiniMax 轮询无网关缓存问题，不用像火山那样加 ?t= 防缓存
                resp = await this._providerFetch(`/v2/query/video_generation/${task.taskId}`, { method: 'GET' }, provider, task);
            } else {
                // ?t= 防缓存：火山网关对 GET 有按 URL 的缓存变体，浏览器轮询会拿到陈旧 running（联调实测）
                resp = await this._providerFetch(`/api/v3/contents/generations/tasks/${task.taskId}?t=${Date.now()}`, { method: 'GET' }, provider, task);
            }
            const data = await resp.json().catch(() => ({}));
            // data.error?.message 是 ark/H3 的形状，data.base_resp?.status_msg 是 v1 的老式信封——两个都兜一下，
            // 不按 provider 分叉也无害（对方字段本来就不存在，链式可选访问直接落空）
            if (!resp.ok) throw new Error(data.error?.message || data.base_resp?.status_msg || `HTTP ${resp.status}`);
            task.netFails = 0;

            // 状态路径 + 取值按 provider 分叉：ark 是顶层 data.status，minimax(H3) 是 data.task.status，
            // minimax_v1(Hailuo) 是顶层 data.status 但值是大写单词（Preparing/Queueing/Processing/Success/Fail），
            // 要映射到本模块统一用的 queued/running/succeeded/failed 状态机
            let status;
            if (provider === 'minimax_v1') {
                const raw = data.status;
                status = raw === 'Success' ? 'succeeded'
                    : raw === 'Fail' ? 'failed'
                    : (raw === 'Preparing' || raw === 'Queueing') ? 'queued'
                    : raw === 'Processing' ? 'running'
                    : raw;   // 未知值原样透传，落进下面 else(queued/running) 分支当"仍在跑"处理，不会误判成功/失败
            } else if (provider === 'minimax') {
                status = data.task?.status;
            } else {
                status = data.status;
            }

            if (status === 'succeeded') {
                task.status = 'downloading'; task.updatedAt = Date.now(); Utils.saveData();
                this._notifyUI(task);
                // 终态：这次轮询后不会再有 _schedulePoll，清掉 Map 里的句柄引用（v2.178.0 P2-3-8）
                clearTimeout(this._timers.get(localId)); this._timers.delete(localId);
                await this._onSucceeded(task, data);
            } else if (status === 'failed' || status === 'expired' || status === 'cancelled') {
                // minimax(H3)/v1 都没有 expired 状态；cancelled 三家都沿用归入 expired 分支的既有处理（本地视为"任务没了"，可重投）
                task.status = status === 'failed' ? 'failed' : 'expired';
                // v1 失败响应基本没有详细错误对象，实测只有 base_resp.status_msg（比如 plan 额度不支持某模型时的提示）
                task.error = provider === 'minimax_v1' ? (data.base_resp?.status_msg || status)
                    : provider === 'minimax' ? (data.task?.error?.message || status)
                    : (data.error?.message || status);
                task.updatedAt = Date.now(); Utils.saveData();
                this._notifyUI(task);
                clearTimeout(this._timers.get(localId)); this._timers.delete(localId);
            } else {   // queued / running
                task.status = status; task.updatedAt = Date.now(); Utils.saveData();
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
            // 产物 URL 路径按 provider 分叉：ark 是 data.content.video_url，minimax(H3) 是 data.task.content.url，
            // minimax_v1(Hailuo) 拿产物多一跳——poll 成功响应只给 file_id，要再调 files/retrieve 换 download_url
            // （1 小时时效，拿到立刻用掉进 _download，不做额外缓存）
            const provider = task.provider || 'ark';
            let videoUrl;
            if (provider === 'minimax_v1') {
                const fileId = data.file_id;
                if (!fileId) throw new Error('no file_id');
                const fResp = await this._providerFetch(`/v1/files/retrieve?file_id=${encodeURIComponent(fileId)}`, { method: 'GET' }, provider, task);
                const fData = await fResp.json().catch(() => ({}));
                if (!fResp.ok) throw new Error(fData.error?.message || fData.base_resp?.status_msg || `HTTP ${fResp.status}`);
                videoUrl = fData.file?.download_url;
            } else {
                videoUrl = provider === 'minimax' ? data.task?.content?.url : data.content?.video_url;
            }
            if (!videoUrl) throw new Error('no video_url');
            const blob = await this._download(videoUrl, task);

            // 竞态防护：下载期间用户可能已删任务
            if (!this.tasks().find(t => t.id === task.id)) return;

            // 配额检查（拿不到 estimate 的浏览器直接放行）——空间不足直接中止，不写入 blob（走 failed 分支，用户可重试）
            const est = await (navigator.storage?.estimate?.() || Promise.resolve(null));
            if (est && est.quota - est.usage < blob.size * 1.5) {
                Utils.showToast(I18n.t('vg.err_quota', '存储空间不足，请清理后重试'));
                throw new Error(I18n.t('vg.err_quota', '存储空间不足，请清理后重试'));
            }

            const videoBlobId = 'vid-' + task.id;
            await this.saveBlob(videoBlobId, blob);
            const thumbBlob = await this._extractThumb(blob).catch(() => null);   // 抽帧失败不阻塞
            if (thumbBlob) await this.saveBlob('thumb:' + videoBlobId, thumbBlob);

            // 竞态防护二查：saveBlob→抽帧（iOS 最长 8s）→saveBlob 这条 await 链是取消窗口，
            // 期间 abandonTask 会先删 blob 再被上面重写（孤儿）、或视频落库指向已删 blob（死视频）。
            // 任务没了=用户已取消：清掉本函数刚写的两个 blob（与 abandonTask 交错时 remove 幂等）后静默退出
            if (!this.tasks().find(t => t.id === task.id)) {
                await this.removeBlob(videoBlobId).catch(() => {});
                await this.removeBlob('thumb:' + videoBlobId).catch(() => {});
                return;
            }

            // 包装未就绪（LLM 慢/失败）→ 占位默认值，标题=提示词前 20 字
            const pk = task.packaging || { title: task.prompt.slice(0, 20), description: task.prompt, tags: [], danmaku: [], comments: [], views: 1000, tweetText: null };

            const video = Niconico.addRealVideo(task, pk, videoBlobId);           // Task 8
            if (task.tweetAccountId) {
                // 发推单独兜底：视频已成功入库，发推失败不该把这条任务连累成 failed（否则重试=重复付费生成）
                try {
                    Twitter.postOfficialPVTweet(task, pk, video);                 // Task 9
                } catch (tweetErr) {
                    console.warn('[VideoGen] PV tweet failed', tweetErr);
                }
            }

            AppState.data.videoGenTasks = this.tasks().filter(t => t.id !== task.id);
            // 参考音声 blob 只为重试而存在——任务已成功入库出列，不再需要，跟 vid-*/thumb:* 一样幂等清理
            if (task.refAudioName) await this.removeBlob('refaud-' + task.id).catch(() => {});
            await this._cleanupTempRefImgs(task).catch(e => console.warn('[VideoGen] temp ref cleanup failed', e));   // 相册临时参考图（v2.244）同理收尾清理
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

    async _download(videoUrl, auth) {
        // 直连优先（TOS 可能本身带 CORS），失败走 worker /fetch 兜底；视频文件大，超时给足 120s 余量。
        // auth=任务的凭据快照：/fetch 的 workerUrl 也要用任务创建时的，理由同 _providerFetch（切预设后当前 workerUrl 可能已换）
        try {
            const r = await Utils._fetchWithTimeout(videoUrl, {}, 120000);
            if (r.ok) return await r.blob();
            throw new Error('direct ' + r.status);
        } catch (_) {
            const base = (((auth && auth.workerUrl) || this.config().workerUrl) || '').replace(/\/+$/, '');
            const r2 = await Utils._fetchWithTimeout(`${base}/fetch?url=${encodeURIComponent(videoUrl)}`, {}, 120000);
            if (!r2.ok) throw new Error(I18n.t('vg.err_download', '视频下载失败') + ` (${r2.status})`);
            return await r2.blob();
        }
    },

    _extractThumb(videoBlob) {
        // v2.177.0 P1-3: video 元素挂进 DOM（部分 iOS Safari 版本对未挂载的 video 不可靠触发解码事件）
        // + 8s 超时兜底（onloadeddata/onseeked 不触发时 reject，避免上游 await 永久挂起）
        // + 所有退出路径（成功/onerror/超时）都清理一次：revoke objectURL、移除 DOM 节点、settle promise
        return new Promise((resolve, reject) => {
            const v = document.createElement('video');
            v.muted = true; v.playsInline = true; v.preload = 'auto';
            v.style.cssText = 'position:fixed; left:-9999px; width:1px; height:1px;';
            let settled = false;
            let objectUrl = null;

            const cleanup = () => {
                clearTimeout(timer);
                if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
                if (v.parentNode) v.parentNode.removeChild(v);
            };
            const settle = (isResolve, value) => {
                if (settled) return;
                settled = true;
                cleanup();
                isResolve ? resolve(value) : reject(value);
            };

            const timer = setTimeout(() => settle(false, new Error('extract thumb timeout')), 8000);

            v.onloadeddata = () => {
                v.currentTime = 0.1;   // iOS 首帧黑屏规避
            };
            v.onseeked = () => {
                const c = document.createElement('canvas');
                c.width = v.videoWidth; c.height = v.videoHeight;
                c.getContext('2d').drawImage(v, 0, 0);
                c.toBlob(b => settle(!!b, b || new Error('toBlob null')), 'image/jpeg', 0.8);
            };
            v.onerror = () => settle(false, new Error('video load fail'));

            document.body.appendChild(v);
            objectUrl = URL.createObjectURL(videoBlob);
            v.src = objectUrl;
        });
    },

    // 相册临时参考图（v2.244）收尾清理：只删「除了 task 自己之外，没有任何任务还在引用」的 pvtemp blob——
    // retryTask「先建后删」顺序下，新任务可能复用同一批临时图 id（createTask 时 params.refImgIds 直接沿用 old
    // 的数组内容），这时旧任务的收尾清理不能把新任务正用着的 blob 削掉，所以先查一遍剩余任务列表里还有没有别的引用
    async _cleanupTempRefImgs(task) {
        const ids = (task.refImgIds || []).filter(id => typeof id === 'string' && id.startsWith('pvtemp_'));
        for (const id of ids) {
            const stillUsed = this.tasks().some(t => t.id !== task.id && (t.refImgIds || []).includes(id));
            // v2.246 review（C6）：这条 catch 不再静默吞掉——pvtemp 清理失败意味着一个孤儿 blob 会永久占着
            // IndexedDB 空间，console.warn 留痕方便真机排查（vid-/thumb:/refaud- 的既有 catch 姿势不动，
            // 那几处失败是幂等收尾、吞错是刻意的既定行为，不在本次改动范围内）
            if (!stillUsed) await this.removeBlob(id).catch(e => console.warn('[VideoGen] temp ref cleanup failed', e));
        }
    },

    // 本地放弃（三家渠道都无取消 API）：停轮询、删任务、清残留
    async abandonTask(localId) {
        clearTimeout(this._timers.get(localId));
        this._timers.delete(localId);
        const task = this.tasks().find(t => t.id === localId);
        AppState.data.videoGenTasks = this.tasks().filter(t => t.id !== localId);
        await this.removeBlob('vid-' + localId).catch(() => {});
        await this.removeBlob('thumb:vid-' + localId).catch(() => {});
        await this.removeBlob('refaud-' + localId).catch(() => {});   // 参考音声 blob（v2.241）跟视频/缩略图一样幂等清理，不存在也无害
        if (task) await this._cleanupTempRefImgs(task).catch(e => console.warn('[VideoGen] temp ref cleanup failed', e));   // 相册临时参考图（v2.244）同理，retryTask 内部调用时不会误删新任务复用的 blob
        Utils.saveData();
    },

    // 失败/过期任务重试：复用原参数重新提交（packaging 保留不重新生成）
    // provider 不沿用 old.provider——createTask 内部永远读当前生效配置（cfg.provider），如果这期间用户在设置里
    // 切换了渠道，old.model 多半不属于新渠道，会被 createTask 的模型归属校验挡下并报清晰错误（而不是带着旧渠道
    // 的模型 id 静默投给新渠道）
    async retryTask(localId) {
        const old = this.tasks().find(t => t.id === localId);
        if (!old) return;
        // v2.246 review（C5）：整个重试流程（含结尾的 abandonTask 删旧任务）标记为进行中——niconico.js 的
        // 「再試行」/「削除」按钮入口据此挡双击和撞车删除。add 在 if(!old) 判断之后、任何 await 之前同步执行，
        // 跟按钮入口的同步 has() 检查之间没有可插入的事件循环缝隙
        this._retryingIds.add(localId);
        try {
            // 参考音声（v2.241）：old 任务对象本身不存 blob（只存 refAudioName/refAudioDuration 元数据），
            // 真身在 store() 里按 'refaud-'+old.id 落着——重试要显式取回、拼成 createTask 期望的 {blob,name,duration}
            // 形状。取不到（老任务被清理过、或跨版本升级前创建的任务压根没这两个字段）就温和降级：toast 提示一句，
            // 不带音频继续重投，不因为一个附属素材的丢失挡掉整个重试
            const params = Object.assign({}, old);
            if (old.refAudioName) {
                const blob = await this.getBlob('refaud-' + old.id).catch(() => null);
                params.refAudio = blob ? { blob, name: old.refAudioName, duration: old.refAudioDuration || 0 } : null;
                if (!blob) Utils.showToast(I18n.t('vg.err_ref_audio_stale', '参考音声が失われたため、今回は音声参照なしで生成します'));
            }
            // 先建后删（v2.240 review 修）：createTask 现在多了模型归属校验这个抛错路径，而它恰好会在
            // "切换渠道后重试旧任务"时触发——旧顺序（先 abandonTask 再 createTask）下抛错发生在删除之后，
            // "重试"就变成了不可恢复的"删除"（prompt/包装/参考图全丢）。改为创建成功才删旧任务；
            // 抛错时旧任务原样保留，用户看到 toast 后可以换回渠道再试。
            // 并发位无碍：retryTask 只对 failed/expired 任务调用，它们本就不算 activeTasks
            const task = await this.createTask(params);   // params = old 字段超集 + 复原的 refAudio
            if (old.packaging) task.packaging = old.packaging;
            await this.abandonTask(localId);           // abandonTask 内部已 saveData，把 packaging 一并落盘（含 refaud- 旧 blob 清理）
            return task;
        } finally {
            this._retryingIds.delete(localId);
        }
    },
};
