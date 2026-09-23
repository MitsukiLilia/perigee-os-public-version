// ===== PV投稿：分镜图（六期 P1，2026-09-18） =====
// 「生成分镜图」可选按钮：把已经解析出的分镜脚本逐镜头喂给现有生图入口（PixivIllust.dispatchGenerate），
// 每镜出一张横版参考图（OpenRouter=16:9，其它渠道=各自的法定横版档位），立绘作外貌参照、画风锚同句；投稿时随立绘一起作为参考图，
// 解决「分镜图参照」这条 P0 实战里最关键的一条差异（人物一致性/画风稳定/构图落地三件一次解决）。
// 独立成文件（不塞进已经 200KB+ 的 niconico.js，见项目 CLAUDE.md 单文件拆分铁律）：用 Object.assign 挂到
// 既有 Niconico 对象上，复用它的 _pvRefImgIds / _pvModelInfo / _pvGetArtStyleKey / _pvOpenConfirm 等既有状态与方法。
// 索引/加载顺序：index.html 紧跟在 <script src="js/niconico.js"> 之后加载，sw.js coreUrls / deploy.sh
// DEFAULT_FILES 也登记在 niconico.js 同一位置——三处任一遗漏都会导致离线缓存/静态部署缺文件。
Object.assign(Niconico, {

    // 会话级、非持久——照 _pvRefAudio 的姿势。元素 { shot:{n,a,b,body}, blobId, status, error }
    // status: 'pending'（已解析出镜头、还没开始生成）/ 'generating' / 'done' / 'error'
    _pvFrames: [],

    // ===== 纯函数：分镜脚本 → 镜头结构 =====
    // 识别「镜头N（a-b秒）」——全角/半角括号都认（（）/()），秒数分隔用半角「-」「~」、全角「〜」「～」「－」、
    // 以及模型偶尔会写出来的 en/em dash（–/—）都认。
    // body 为该镜头到下一镜头前的文本，去掉「使用的素材」那一行（其它内容原样保留，包括「最后姿态定格」一行——
    // 分镜图的镜头内容提示词要靠它判定「最具代表性的一瞬」）。「使用的素材」行本身描述的是图N映射关系，
    // 图K的引用其它 bullet（比如①主体外观指代）里同样会写，不会因为去掉这一行就丢失
    _pvParseShots(text) {
        const str = text || '';
        const headerRe = /镜头\s*(\d+)\s*[（(]\s*(\d+)\s*[-~〜～–—－]\s*(\d+)\s*秒\s*[）)]/g;
        const heads = [];
        let m;
        while ((m = headerRe.exec(str))) {
            heads.push({ n: parseInt(m[1], 10), a: parseInt(m[2], 10), b: parseInt(m[3], 10), start: m.index, end: m.index + m[0].length });
        }
        return heads.map((h, i) => {
            const next = heads[i + 1];
            const segEnd = next ? next.start : str.length;
            const raw = str.slice(h.end, segEnd);
            const body = raw.split('\n').filter(line => !/^\s*[-*•・]?\s*使用的素材/.test(line)).join('\n').trim();
            return { n: h.n, a: h.a, b: h.b, body };
        });
    },

    // body 里出现的「图K」编号，按首次出现顺序去重（不排序——保持在文本中的先后关系）
    _pvShotFigNums(body) {
        const nums = [];
        const re = /[図图](\d+)/g;   // 「図」也认——跟 _pvSubmit 软闸②同一口径
        let m;
        while ((m = re.exec(body || ''))) {
            const n = parseInt(m[1], 10);
            if (!nums.includes(n)) nums.push(n);
        }
        return nums;
    },

    // ===== 表单区块：HTML / 渲染 =====
    // showPVModal 的模板在参考图区块之后拼这段 HTML；按钮初始 disabled，_pvUpdateFramesBtnState 按
    // 「模型支持参考图 且 脚本里解析到 ≥1 镜头」实时开关（showPVModal 末尾 / _pvOnModelChange 末尾 /
    // textarea oninput / AI帮写完成后 都会调用一次，见 niconico.js 里对应位置）
    _pvFramesFieldHtml() {
        return `
        <div class="nico-pv-field" id="nicoPvFramesField">
            <label class="nico-pv-label">${I18n.t('nico.pv_frames_label', '分镜图')}</label>
            <div class="nico-pv-frames-row" id="nicoPvFramesThumbs"></div>
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                <button class="glass-btn nico-pv-ai-btn" id="nicoPvFramesGenBtn" onclick="Niconico._pvGenerateFrames()" disabled>${I18n.t('nico.pv_frames_gen_btn', '生成分镜图')}</button>
                <button class="glass-btn mini" id="nicoPvFramesClearBtn" onclick="Niconico._pvClearFrames()" disabled>${I18n.t('nico.pv_frames_clear_btn', '清空分镜图')}</button>
                <span class="nico-pv-frames-progress" id="nicoPvFramesProgress" style="display:none;"></span>
            </div>
        </div>`;
    },

    // 「生成分镜图」按钮の可否だけを軽く更新（縮略图は再描画しない）——textarea の毎入力で呼ばれる想定なので
    // Promise.all(getUrl…) を含む _pvRenderFrames をフルで回すと無駄が多い
    _pvUpdateFramesBtnState() {
        const btn = document.getElementById('nicoPvFramesGenBtn');
        if (!btn) return;
        if (typeof Utils !== 'undefined' && Utils.isLocked && Utils.isLocked('nicoPvFrames')) {
            btn.disabled = true;
            return;
        }
        const modelSel = document.getElementById('nicoPvModel');
        const modelInfo = this._pvModelInfo(modelSel ? modelSel.value : '');
        const promptEl = document.getElementById('nicoPvPrompt');
        const shots = this._pvParseShots(promptEl ? promptEl.value : '');
        btn.disabled = !(modelInfo.ref && shots.length > 0);
    },

    // 縮略图 + 進捗 + 各ボタンの disabled 状態をまとめて再描画。CLAUDE.md「生成类按钮并发防呆」铁律：
    // disabled 视觉态用 Utils.isLocked('nicoPvFrames') 投影，不新写 _xxxRefreshing 布尔旗。
    // 生成中/一括実行中は「重生成」「削除」も一律无效化——_pvRunFrameQueue はインデックスで _pvFrames を
    // 触るので、生成中に splice される（削除される）とインデックスがズレて別の镜头を上書きしかねない
    async _pvRenderFrames() {
        this._pvUpdateFramesBtnState();
        const locked = (typeof Utils !== 'undefined' && Utils.isLocked) ? Utils.isLocked('nicoPvFrames') : false;
        const clearBtn = document.getElementById('nicoPvFramesClearBtn');
        if (clearBtn) clearBtn.disabled = locked || (this._pvFrames || []).length === 0;
        const wrap = document.getElementById('nicoPvFramesThumbs');
        if (!wrap) return;
        const frames = this._pvFrames || [];
        // 并发 2 的队列会让多次渲染交错：状态是 await 之前拍的快照，先发起的那次可能后落地，拿旧状态盖掉新状态。
        // 只让最后发起的一次写 DOM
        const seq = (this._pvFramesRenderSeq = (this._pvFramesRenderSeq || 0) + 1);
        const items = await Promise.all(frames.map(async (f, i) => ({
            i,
            status: f.status,
            error: f.error || '',
            url: (f.status === 'done' && f.blobId) ? await IllustGallery.getUrl(f.blobId) : ''
        })));
        if (seq !== this._pvFramesRenderSeq) return;
        const wrap2 = document.getElementById('nicoPvFramesThumbs');   // 渲染中弹窗可能已被关闭
        if (!wrap2) return;
        wrap2.innerHTML = items.map(it => {
            const bgStyle = it.url ? ` style="background-image:url('${it.url}')"` : '';
            let inner = '';
            if (it.status !== 'done') inner = this._SVG.film;
            const openAttr = it.status === 'done' ? `onclick="Niconico._pvOpenFrameViewer(${it.i})"` : '';
            // 失败时把错误信息放 title 提示——AI/上游返回的文本先经 _escHtml，防止破坏属性边界（工程铁律：
            // 拼进 innerHTML 的文本一律过 Utils.escapeHtml，_escHtml 是它的转发别名）
            const titleAttr = (it.status === 'error' && it.error) ? ` title="${this._escHtml(it.error)}"` : '';
            const btnDisabled = (locked || it.status === 'generating') ? 'disabled' : '';
            return `
            <div class="nico-pv-frame-item">
                <div class="nico-pv-frame-thumb ${it.status}"${bgStyle}${titleAttr} ${openAttr}>${inner}</div>
                <div class="nico-pv-frame-actions">
                    <button class="glass-btn mini" onclick="event.stopPropagation();Niconico._pvRegenerateFrame(${it.i})" ${btnDisabled}>${I18n.t('nico.pv_frame_regen_btn', '重生成')}</button>
                    <button class="glass-btn mini danger-text" onclick="event.stopPropagation();Niconico._pvRemoveFrame(${it.i})" ${btnDisabled}>${I18n.t('nico.pv_btn_discard', '削除')}</button>
                </div>
            </div>`;
        }).join('');
        this._pvRenderFramesProgress();
    },

    // 進捗文字「分镜图 k/N」：还有未完结（pending/generating）的项时才显示，全部 settle（done/error）后隐藏——
    // 完成与否已经靠缩略图状态和结束时的 toast 传达，不需要进度条一直占位
    _pvRenderFramesProgress() {
        const el = document.getElementById('nicoPvFramesProgress');
        if (!el) return;
        const frames = this._pvFrames || [];
        const total = frames.length;
        const doneCount = frames.filter(f => f.status === 'done' || f.status === 'error').length;
        if (total > 0 && doneCount < total) {
            el.textContent = I18n.t('nico.pv_frames_progress', { k: doneCount, n: total });
            el.style.display = '';
        } else {
            el.style.display = 'none';
        }
    },

    // 删掉一批分镜图 blob（IllustGallery）——in-flight（正被 _pvSubmit 的 createTask 请求持有）的跳过，
    // 姿势同 niconico.js 里 _pvRemoveRefImg 对 pvtemp_ 的处理：_pvSubmit 提交时把用到的 frameBlobId
    // 也临时塞进 _pvInFlightTempIds，settle 后才摘掉
    _pvDeleteFrameBlobs(frames) {
        (frames || []).forEach(f => {
            if (f && f.blobId && !this._pvInFlightTempIds.has(f.blobId)) {
                IllustGallery.remove(f.blobId).catch(e => console.warn('[Niconico] pv frame blob cleanup failed', e));
            }
        });
    },

    // 清空分镜图：表单打开（showPVModal）/ 表单关闭（_closePVModal，含未提交的草稿）/「清空分镜图」按钮
    // 三处调用。投稿成功路径不走这里——那边只清会话态跟踪、不删 blob（任务的 refImgIds 还要用，重试也要用），
    // 交给 VideoGen.abandonTask 里扩展过的 _cleanupTempRefImgs 做真正的孤儿判定删除
    _pvClearFrames() {
        const old = this._pvFrames || [];
        this._pvFrames = [];
        this._pvDeleteFrameBlobs(old);
        this._pvRenderFrames();
    },

    // ===== 生成 =====
    // 点击「生成分镜图」：确认弹窗（复用既有 nico-modal 软闸骨架 _pvOpenConfirm，不用 window.confirm——
    // 见 _pvOpenConfirm 自己的注释，项目里软闸弹窗一律走这条，不裸用浏览器原生 confirm）→ 按当前脚本重新解析
    // 镜头、丢弃旧分镜图重建 → 并发2跑生成队列。每次点击都是「用当前脚本状态重新来一遍」，不是增量补漏——
    // 脚本改过之后镜头数/内容都可能变了，保留旧的对应关系没有意义
    async _pvGenerateFrames() {
        await Utils.withLock('nicoPvFrames', async () => {
            const promptEl = document.getElementById('nicoPvPrompt');
            const text = (promptEl && promptEl.value) || '';
            const shots = this._pvParseShots(text);
            if (shots.length === 0) {
                Utils.showToast(I18n.t('nico.pv_frames_no_shots', '未解析到镜头，请先写好分镜脚本'));
                return;
            }
            const modelSel = document.getElementById('nicoPvModel');
            const modelInfo = this._pvModelInfo(modelSel ? modelSel.value : '');
            if (!modelInfo.ref) {
                Utils.showToast(I18n.t('nico.pv_ref_disabled_hint', 'このモデルは参考画像に対応していません'));
                return;
            }
            // 立绘+分镜图合计超过模型上限的话投稿时会被硬校验挡下——花钱生成之前就说清楚，由用户决定
            // 是照样生成再删掉几张、还是先回去合并镜头/减立绘
            const maxRef = this._pvMaxRefImages(modelInfo.id);
            const refCount = (this._pvRefImgIds || []).length;
            let confirmMsg = I18n.t('nico.pv_frames_confirm', { n: shots.length });
            if (refCount + shots.length > maxRef) {
                confirmMsg += '<br>' + I18n.t('nico.pv_frames_confirm_over', { a: refCount, b: shots.length, n: maxRef, x: refCount + shots.length - maxRef });
            }
            const ok = await this._pvOpenConfirm(confirmMsg);
            if (!ok) return;

            this._pvDeleteFrameBlobs(this._pvFrames || []);
            this._pvFrames = shots.map(s => ({ shot: s, blobId: null, status: 'pending', error: null }));
            await this._pvRenderFrames();

            await this._pvRunFrameQueue();
        }, () => Utils.showToast(I18n.t('nico.pv_frames_busy', '分镜图生成中，请稍候')));
        this._pvRenderFrames();   // withLock 内最后一次渲染时锁还没放，这里在锁释放后再刷一次按钮的 disabled 态
    },

    // 并发 2 跑完 _pvFrames 里所有 pending/error 的项（重生成场景下 error 项也会被这个队列捡起——
    // 目前只有 _pvGenerateFrames 整批重建后调用，届时全部都是 pending，但保留 error 判定不算多余）
    async _pvRunFrameQueue() {
        const frames = this._pvFrames || [];
        const idxs = frames.map((f, i) => i).filter(i => frames[i].status === 'pending' || frames[i].status === 'error');
        let cursor = 0;
        const worker = async () => {
            for (;;) {
                const i = idxs[cursor++];
                if (i === undefined) return;
                await this._pvGenerateOneFrame(i);
            }
        };
        await Promise.all([worker(), worker()]);
        const failed = (this._pvFrames || []).filter(f => f.status === 'error').length;
        if (failed > 0) {
            Utils.showToast(I18n.t('nico.pv_frames_done_with_errors', { n: failed }));
        } else if ((this._pvFrames || []).length > 0) {
            Utils.showToast(I18n.t('nico.pv_frames_done', '分镜图生成完成'));
        }
    },

    // 单镜头重生成：走同一把锁（跟批量生成互斥，避免并发写同一个 index）。UI 层已经在锁定时把按钮置灰，
    // 这里的 withLock 是双重保险（万一直接被脚本调用）
    async _pvRegenerateFrame(i) {
        await Utils.withLock('nicoPvFrames', async () => {
            await this._pvGenerateOneFrame(i);
        }, () => Utils.showToast(I18n.t('nico.pv_frames_busy', '分镜图生成中，请稍候')));
        this._pvRenderFrames();
    },

    // 单个镜头的实际生成：解析该镜头引用的图K → 取对应立绘 blob → 拼提示词 → 走 PixivIllust.dispatchGenerate
    // （横版、count 1、moduleKey 'pixiv' 借用 pixiv 板块的全局生图配置，不新增板块预设）→
    // 结果存 IllustGallery（pvframe_ 前缀，VideoGen._resolveRefBlob 不用改就能取到）。
    // 失败只标红当前这一格，不影响队列里其它并发中的镜头
    async _pvGenerateOneFrame(i) {
        const entry = (this._pvFrames || [])[i];
        if (!entry) return;
        entry.status = 'generating';
        entry.error = null;
        await this._pvRenderFrames();
        try {
            const { figNums, blobs } = await this._pvResolveShotRefBlobs(entry.shot);
            const prompt = this._pvBuildFramePrompt(entry.shot, figNums);
            // refBlobs 始终显式传数组（哪怕是空的）——dispatchGenerate 下游三个 provider 分支据此判断
            // 「调用方已经明确接管参考图逻辑」，空数组＝这一镜没引用任何图K、就该是纯文生图，不会静默回退
            // 去捞 Broadcast 的 CP 参考立绘（那是另一个跟分镜图无关的概念，混进来会污染没有人物参照的镜头）
            // 尺寸：OpenRouter 走 aspect_ratio 就近映射，给 1920x1080 才落到 16:9（1536x1024 会就近落到 3:2）；
            // 其它渠道维持 1536x1024，由各自的 snap 落到法定横版档位
            const imgProvider = PixivIllust.resolveModuleConfig('pixiv').provider;
            const genBlobs = await PixivIllust.dispatchGenerate({
                positivePrompt: prompt,
                negativePrompt: '',
                size: imgProvider === 'openrouter' ? '1920x1080' : '1536x1024',
                count: 1,
                moduleKey: 'pixiv',
                refBlobs: blobs
            });
            if (!genBlobs || genBlobs.length === 0) {
                throw new Error(I18n.t('t.pi_gen_no_image', '未返回图片，请重试或调整提示词'));
            }
            // 生成期间表单被关掉/分镜图被清空（_pvClearFrames 换了一个新数组）的话，这个 entry 已经不在册——
            // 这时再存就是一个谁也不会去删的孤儿 blob，结果直接丢掉
            if ((this._pvFrames || [])[i] !== entry) return;
            const oldBlobId = entry.blobId;
            const newId = 'pvframe_' + Utils.generateId();
            await IllustGallery.save(newId, genBlobs[0]);
            entry.blobId = newId;
            entry.status = 'done';
            entry.error = null;
            // 重生成场景：新图存成功后再删旧图，且同样跳过 in-flight（虽然此刻不太可能命中，防御性对齐其它清理点）
            if (oldBlobId && oldBlobId !== newId && !this._pvInFlightTempIds.has(oldBlobId)) {
                await IllustGallery.remove(oldBlobId).catch(e => console.warn('[Niconico] pv frame old blob cleanup failed', e));
            }
        } catch (e) {
            const msg = (e && e.message) || String(e);
            if (entry.blobId) {
                // 重生成失败但旧图还在：退回旧图的 done 态——投稿时带的就是这张，缩略图不能显示成失败格
                entry.status = 'done';
                entry.error = null;
                Utils.showToast(I18n.t('t.nico_gen_error', '⚠️ 生成エラー: ') + msg, 4000);
            } else {
                entry.status = 'error';
                entry.error = msg;
            }
        }
        await this._pvRenderFrames();
    },

    // 删除单张分镜图：直接从数组摘除（不留空位）。渲染层已经在任何生成/批量运行进行中时把这个按钮置灰，
    // 避免删除引发的 index 位移撞上仍在跑的并发队列
    _pvRemoveFrame(i) {
        const frames = this._pvFrames || [];
        const entry = frames[i];
        if (!entry) return;
        frames.splice(i, 1);
        if (entry.blobId && !this._pvInFlightTempIds.has(entry.blobId)) {
            IllustGallery.remove(entry.blobId).catch(e => console.warn('[Niconico] pv frame blob cleanup failed', e));
        }
        this._pvRenderFrames();
    },

    // 点开看大图：复用既有 nico-modal-overlay 骨架（跟画廊/软闸弹窗同款背板），点击背板关闭
    async _pvOpenFrameViewer(i) {
        const entry = (this._pvFrames || [])[i];
        if (!entry || entry.status !== 'done' || !entry.blobId) return;
        const url = await IllustGallery.getUrl(entry.blobId);
        if (!url) return;
        const html = `
        <div class="nico-modal-overlay" id="nicoPvFrameViewerModal" onclick="Niconico._pvCloseFrameViewer()">
            <img class="nico-pv-frame-viewer-img" src="${url}" alt="">
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
    },

    _pvCloseFrameViewer() {
        document.getElementById('nicoPvFrameViewerModal')?.remove();
    },

    // 该镜头引用的图K → 对应立绘/参考图的 Blob（K 按 _pvRefImgIds 的顺序，1-based，跟 _pvBuildAssetLines
    // 的「图${i+1}」编号是同一套）。K 超出当前 _pvRefImgIds 范围（脚本写超了、或后来减少了参考图）就跳过，
    // 不让整个镜头的生成因此失败——figNums/blobs 保持一一对应，方便 _pvBuildFramePrompt 报「第几张=图K」
    async _pvResolveShotRefBlobs(shot) {
        const rawFigNums = this._pvShotFigNums(shot && shot.body);
        const ids = this._pvRefImgIds || [];
        const figNums = [];
        const blobs = [];
        for (const n of rawFigNums) {
            if (n < 1 || n > ids.length) continue;
            const blob = await VideoGen._resolveRefBlob(ids[n - 1]);
            if (blob) { figNums.push(n); blobs.push(blob); }
        }
        return { figNums, blobs };
    },

    // 每镜提示词：画风锚句（取 _PV_ART_STYLES[_pvGetArtStyleKey()]，无则省略）。人物说明——有参考图时
    // 「参考图是这位角色的立绘（第K张=图K），严格保持发型·瞳色·服装细节」，没有时「按描述画」。
    // 镜头内容取这一镜最具代表性的一瞬，若写了"最后姿态定格"以其为准（原样把 body 交给生图模型判断，
    // 不在这里再做取舍）。末尾固定带「干净输出」否定清单（不要颗粒/灰雾/泛黄/做旧/暗角/光晕）
    _pvBuildFramePrompt(shot, figNums) {
        const artStyleKey = this._pvGetArtStyleKey();
        const anchor = this._PV_ART_STYLES[artStyleKey] || '';
        const charNote = (figNums && figNums.length > 0)
            ? `参考图是这位角色的立绘（${figNums.map((n, idx) => `第${idx + 1}张=图${n}`).join('、')}），严格保持发型·瞳色·服装细节`
            : '按描述画';
        const segs = [];
        if (anchor) segs.push(anchor);
        segs.push(charNote);
        segs.push(`镜头内容（取这一镜最具代表性的一瞬，若写了"最后姿态定格"以其为准）：${(shot && shot.body) || ''}`);
        // 画幅比例交给生图接口的尺寸参数，这里不写死「16:9」——有的渠道横版只有 3:2 一档，提示词硬说 16:9 容易换来上下黑边
        segs.push('只画这一帧本身：横向画幅，画面铺满整个画布（不要上下黑边或留白边框），不要任何文字、字幕、水印、分镜框、多格拼贴；画面干净（不要颗粒、灰雾、泛黄、做旧、暗角、光晕）');
        return segs.join('。') + '。';
    }
});
