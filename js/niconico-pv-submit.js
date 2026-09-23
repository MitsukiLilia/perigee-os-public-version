// niconico-pv-submit.js — 从 js/niconico.js 纯搬运拆出（v2.270.0）：投稿提交（软闸·频道追加·指南骨架·_pvSubmit）与生成任务卡·成片入库·播放·删除。
// 内容零改动；加载顺序：niconico.js → pv-form → pv-media → pv-storyboard → pv-submit → pv-frames（见 index.html）。
Object.assign(Niconico, {

    // 软闸确认弹窗の共通骨架（v2.244 参考図なし確認から抽出、v2.246 図N不整合確認と共用）：window.confirm ではなく
    // 既存 nico-modal の骨架を流用（選段弾窗/画廊決定と同じ姿勢）。Promise 化して _pvSubmit から await するだけの
    // 薄いラッパー。2つの软闸は _pvSubmit 内で順番に（同時ではなく）呼ばれるので、同じ resolve 変数/モーダル id を
    // 使い回して問題ない
    _pvOpenConfirm(messageHtml) {
        return new Promise(resolve => {
            this._pvConfirmNoRefResolve = resolve;
            const html = `
            <div class="nico-modal-overlay nico-pv-confirm-overlay" id="nicoPvNoRefConfirmModal" onclick="if(event.target===this)Niconico._pvNoRefConfirmChoose(false)">
                <div class="nico-modal nico-pv-confirm-modal">
                    <div class="nico-modal-title">${messageHtml}</div>
                    <div class="nico-modal-buttons nico-pv-actions">
                        <button class="glass-btn nico-modal-close" onclick="Niconico._pvNoRefConfirmChoose(false)">${I18n.t('nico.pv_btn_cancel', 'キャンセル')}</button>
                        <button class="glass-btn nico-pv-submit-btn" onclick="Niconico._pvNoRefConfirmChoose(true)">${I18n.t('nico.pv_gallery_confirm', '決定')}</button>
                    </div>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', html);
        });
    },

    // 参考図なし软闸确认弹窗（v2.244）
    _pvOpenNoRefConfirm() {
        return this._pvOpenConfirm(I18n.t('nico.pv_no_ref_confirm', '参考図がありません。人物の一致性が保てませんが、このまま投稿しますか？'));
    },

    // 絵コンテが図N（参考画像）まで参照しているのに、選択済みの参考図がそれより少ない時の软闸（v2.246 review A1）
    _pvOpenFigMismatchConfirm(n, m) {
        return this._pvOpenConfirm(I18n.t('nico.pv_fig_mismatch_confirm', { n, m }));
    },

    _pvNoRefConfirmChoose(ok) {
        document.getElementById('nicoPvNoRefConfirmModal')?.remove();
        const resolve = this._pvConfirmNoRefResolve;
        this._pvConfirmNoRefResolve = null;
        if (resolve) resolve(ok);
    },

    // 公式チャンネル手動追加（v2.245）：AI生成チャンネルは全部ファン系統になりがち、かつ無チャンネル時は
    // フォームが行き止まりになる問題への出口。既存 nico-modal 骨架を流用（_pvOpenNoRefConfirm と同じ姿勢）
    _pvOpenChannelAddModal() {
        const html = `
        <div class="nico-modal-overlay nico-pv-confirm-overlay" id="nicoPvChannelAddModal" onclick="if(event.target===this)Niconico._pvCloseChannelAddModal()">
            <div class="nico-modal nico-pv-confirm-modal">
                <div class="nico-modal-title">${I18n.t('nico.pv_channel_add_title', '公式チャンネルを追加')}</div>
                <input type="text" id="nicoPvChannelAddInput" class="nico-pv-channel-add-input" maxlength="40" placeholder="${I18n.t('nico.pv_channel_add_ph', '例：〇〇公式チャンネル')}">
                <div class="nico-modal-buttons nico-pv-actions">
                    <button class="glass-btn nico-modal-close" onclick="Niconico._pvCloseChannelAddModal()">${I18n.t('nico.pv_btn_cancel', 'キャンセル')}</button>
                    <button class="glass-btn nico-pv-submit-btn" onclick="Niconico._pvConfirmChannelAdd()">${I18n.t('nico.pv_gallery_confirm', '決定')}</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        document.getElementById('nicoPvChannelAddInput')?.focus();
    },

    _pvCloseChannelAddModal() {
        document.getElementById('nicoPvChannelAddModal')?.remove();
    },

    _pvConfirmChannelAdd() {
        const input = document.getElementById('nicoPvChannelAddInput');
        const name = (input && input.value || '').trim();
        if (!name) {
            Utils.showToast(I18n.t('nico.pv_channel_add_empty', 'チャンネル名を入力してください'));
            return; // 空なら窓は閉じない（入力を促す）
        }
        const n = this._ensureData();
        if ((n.channels || []).some(c => c.name === name)) {
            Utils.showToast(I18n.t('nico.pv_channel_add_dup', '同じ名前のチャンネルが既にあります'));
            return;
        }
        // フィールドは _generateChannels の AI生成チャンネルと同じ schema（avatarEmoji/avatarColor/subscriberCount/videoCount/createdAt）
        // に合わせる——チャンネルカード/PV選択肢のレンダリングが両者を区別せず扱えるように。official:true だけが手動追加の印
        const newChannel = {
            id: Utils.generateId(),
            name,
            description: '公式チャンネル',   // AI生成チャンネルの description と同じく常に日本語（コンテンツ、UIチロムではない）
            avatarEmoji: '📺',
            avatarColor: this._AVATAR_COLORS[Math.floor(Math.random() * this._AVATAR_COLORS.length)],
            subscriberCount: 8000 + Math.floor(Math.random() * (60000 - 8000 + 1)),
            videoCount: 0,
            createdAt: Date.now(),
            official: true
        };
        n.channels.push(newChannel);
        Utils.saveData();
        this._pvCloseChannelAddModal();
        this._pvRefreshChannelRow(newChannel.id);
        Utils.showToast(I18n.t('nico.pv_channel_add_success', '✓ 公式チャンネルを追加しました'));
    },

    // PVフォームのチャンネル行を再描画（select 有効化+選択肢再生成+新チャンネル選択、hint 除去、投稿ボタン有効化）
    // ——チャンネル0件からの「無チャンネル行き止まり」を「+」経由で抜け出す唯一の出口
    _pvRefreshChannelRow(selectChannelId) {
        const n = this._ensureData();
        const channels = n.channels || [];
        const sel = document.getElementById('nicoPvChannel');
        if (sel) {
            sel.innerHTML = channels.map(c => `<option value="${c.id}" ${c.id === selectChannelId ? 'selected' : ''}>${this._escHtml(c.name)}</option>`).join('');
            sel.disabled = false;
        }
        const hint = document.getElementById('nicoPvChannelHint');
        if (hint) hint.style.display = 'none';
        const submitBtn = document.getElementById('nicoPvSubmitBtn');
        if (submitBtn) submitBtn.disabled = false;
    },

    // 画风追加の純関数（六期）：脚本文字列に該当画风锚句がまだ無ければ末尾に1行足す。判定は「锚句の
    // 先頭8字が本文中に出現するか」——AIにおまかせ側は既に概述/整体氛围行に锚句原文を書く指示が入っている
    // ので、その場合はここで二重に足さない。artStyleKey が空/未知（'不指定'含む）なら何もしない
    _pvApplyArtStyle(prompt, artStyleKey) {
        const anchor = this._PV_ART_STYLES[artStyleKey];
        if (!anchor) return prompt;
        const marker = anchor.slice(0, 8);
        if (prompt && prompt.includes(marker)) return prompt;
        const sep = (prompt && !prompt.endsWith('\n')) ? '\n' : '';
        return `${prompt || ''}${sep}画风：${anchor}`;
    },

    // 投稿直前に脚本を「指南骨架」で包む純関数（六期）：【素材指代】（図N の説明行＋参考音声の秒数）→
    // 本文（画风锚追加込み）→【负向控制】の順。参考図も参考音声も無い時は【素材指代】ブロックごと省略——
    // 何も指し示すものが無いのに見出しだけ出るのは骨架として不自然なため。手書き脚本にも同じ包みが掛かる
    // （_pvSubmit がここを通すだけで、AIにおまかせ経由かどうかは問わない）
    _pvWrapPromptForSubmit(prompt, opts) {
        // frameShots（六期 P1 review）：实际带上的分镜图各自对应的镜头号（按参考图顺序）。中途删过某张时不再是 1〜F 连号，
        // 逐张写「图K：镜头n」才不会指错；仍是 1〜F 连号时用一行区间写法。frameCount 只作向后兼容（无 frameShots 时按连号处理）
        const { assetLines = [], hasAudio = false, audioSeconds = 0, artStyleKey = '', frameCount = 0 } = opts || {};
        const frameShots = (opts && Array.isArray(opts.frameShots)) ? opts.frameShots : Array.from({ length: frameCount }, (_, i) => i + 1);
        const lines = [];
        const hasMaterial = (assetLines && assetLines.length > 0) || hasAudio || frameShots.length > 0;
        if (hasMaterial) {
            lines.push('【素材指代】');
            (assetLines || []).forEach(l => lines.push(l));
            // 分镜图映射行（六期 P1）：K = 立绘数+1，紧跟在立绘的 assetLines 之后、参考音乐行之前
            if (frameShots.length > 0) {
                const k = (assetLines || []).length + 1;
                const consecutive = frameShots.every((n, i) => n === i + 1);
                if (frameShots.length === 1) {
                    lines.push(`图${k}：镜头${frameShots[0]} 的分镜参考图，作为该镜头的构图·画面·色调参照`);
                } else if (consecutive) {
                    lines.push(`图${k}〜图${k + frameShots.length - 1}：镜头1〜镜头${frameShots.length} 的分镜参考图，按顺序一一对应，作为各镜头的构图·画面·色调参照`);
                } else {
                    frameShots.forEach((n, i) => lines.push(`图${k + i}：镜头${n} 的分镜参考图，作为该镜头的构图·画面·色调参照`));
                }
            }
            if (hasAudio) lines.push(`音频1：参考音乐（约${Math.round(audioSeconds || 0)}秒）`);
        }
        lines.push(this._pvApplyArtStyle(prompt, artStyleKey));
        let negLine = '【负向控制】不要字幕、不要额外的画面文字';
        if (hasAudio) negLine += '；不要额外 bgm，音乐以音频1 为准';
        lines.push(negLine);
        return lines.join('\n');
    },

    // 参考図から assetLines（図N：〜の立ち絵/参考插画）を組み立てる純関数（六期に _pvAiWrite から抽出）。
    // 挙動は抽出前と一字一句同じ——_pvAiWrite 側の呼び出しをこれに差し替えるだけで、_pvSubmit 側の
    // 【素材指代】ブロックにも同じ文言を再利用できる
    _pvBuildAssetLines(refImgIds, charRefs) {
        return (refImgIds || []).map((id, i) => {
            const ref = (charRefs || []).find(c => c.blobId === id);
            return (ref && ref.name)
                ? `图${i + 1}：${ref.name}的立绘（外貌参照）`
                : `图${i + 1}：用户提供的参考插画`;
        });
    },

    // ===== 投稿提出 =====
    // v2.246 review（D1 铁律 + C3）：整体改用 Utils.withLock 包裹，旧 _pvSubmitting 布尔旗撤销（CLAUDE.md「生成类
    // 按钮并发防呆」铁律）。旧旗子是表单会话级字段，showPVModal 每次重开表单都会把它复位成 false——用户提交后、
    // createTask 请求还在飞的时候把表单关了再重开，旗子被静默复位，「投稿する」又能点了，绕开并发上限的判断
    // （C3）。Utils 级锁按固定 key 走、不挂在表单 DOM/session 状态上，跨表单关闭重开依然认得「上一次还没提交完」
    async _pvSubmit() {
        await Utils.withLock('nicoPvSubmit', async () => {
            const n = this._ensureData();

            const promptEl = document.getElementById('nicoPvPrompt');
            const prompt = (promptEl && promptEl.value || '').trim();
            if (!prompt) {
                Utils.showToast(I18n.t('nico.pv_prompt_required', 'PVスクリプトを入力してください'));
                return;
            }
            // 分镜图还在生成（批量/单张重生成）时不收投稿——生成途中 _pvFrames 的 blobId 一直在变（新图落地、
            // 旧图被删），这时候拍快照，带出去的参考图和映射行对不上
            if (Utils.isLocked('nicoPvFrames')) {
                Utils.showToast(I18n.t('nico.pv_frames_busy', '分镜图生成中，请稍候'));
                return;
            }

            const channelSel = document.getElementById('nicoPvChannel');
            const channelId = channelSel ? channelSel.value : '';
            if (!channelId) {
                // v2.246 review（B3）：兜底文案对齐 v2.245.0「+」手动加频道入口上线后的三语新文案
                Utils.showToast(I18n.t('nico.pv_channel_empty_hint', 'チャンネルを生成するか、「＋」で公式チャンネルを追加してください'));
                return;
            }

            const provider = (VideoGen.config().provider) || 'ark';
            const modelSel = document.getElementById('nicoPvModel');
            const model = modelSel ? modelSel.value : ((VideoGen.models()[0] && VideoGen.models()[0].id) || '');
            const modelInfo = this._pvModelInfo(model);
            // 歌词字幕（六期 P2）：hideForType 与参考音声·歌词字段显隐用同一套判断口径（_pvUpdateAudioLyricsVisibility）。
            // 参考音声超出当前模型上限的硬校验——例如 2.5 系选了 30 秒的段，再切到 H3/2.0（上限降到15秒）后点投稿：
            // _pvOnModelChange 只负责显示警告 hint（用户可能没注意到），这里才是真正挡投稿的最后一道闸，直接拦、
            // 不是像软闸①②那样弹窗确认后可放行。v1(Hailuo) 恒不使用参考音声，排除在外防止误伤
            // （表单已经切到 v1 时，残留的 _pvRefAudio 状态本就与当前模型无关，不该挡住投稿）
            const pvStyleTypeNow = document.getElementById('nicoPvStyleType')?.value || '';
            const hideAudioLyricForType = (pvStyleTypeNow === 'yokoku' || pvStyleTypeNow === 'highlight');
            const pvAudioFieldHidden = hideAudioLyricForType || provider === 'minimax_v1';
            if (!pvAudioFieldHidden && this._pvRefAudio && this._pvRefAudioMaxSec && this._pvRefAudio.duration > this._pvRefAudioMaxSec() + 0.05) {
                Utils.showToast(I18n.t('nico.pv_lyric_audio_over_limit_hint', { n: this._pvRefAudioMaxSec() }));
                return;
            }
            // 优先读 select 的实时值（_pvOnModelChange 已按 provider 灌好选项+默认值）；DOM 异常拿不到值时才落到按 provider 兜底，
            // 不写死单一 '720p'（minimax/minimax_v1 的合法档位是大写 '768P'，各 provider 的字面量各管各的，不在这里"猜"）
            const resSel = document.getElementById('nicoPvResolution');
            const resolution = (resSel && resSel.value)
                || (provider === 'minimax' ? '768P' : provider === 'minimax_v1' ? '768P' : '720p');
            const duration = parseInt(document.getElementById('nicoPvDuration')?.value, 10) || 10;
            const generateAudio = modelInfo.audio ? !!(document.getElementById('nicoPvAudio') && document.getElementById('nicoPvAudio').checked) : false;
            // v2.246 review（C1 critical）：快照拷贝——不 slice() 的话，下面两道软闸弹窗等待用户点击的这段时间里，
            // 用户对同一个 _pvRefImgIds 数组做的任何原地修改（出演キャラ chips 增删/画廊「決定」回写/继续从相册加图）
            // 都会原地穿透进后面 refImgIds.includes(id) 的过滤判断和即将发给 createTask 的请求内容——快照后这些
            // 判断/请求只认「点下投稿する那一刻」的状态，跟弹窗期间用户还在动的表单互不干扰
            const refImgIds = (modelInfo.ref ? (this._pvRefImgIds || []) : []).slice();   // ref:false 模型不带参考图，但不清空已选（切回2.0还在）
            // 分镜图（六期 P1）：立绘在前、分镜图按镜头顺序在后，一并受 modelInfo.ref 门控（模型不支持参考图时
            // 分镜图也没有意义）。只带已经生成成功（有 blobId）的项——还在排队/生成中/失败的镜头不带进去。
            // frameBlobIds 在这里就地 snapshot（.map 产生新数组），跟 refImgIds 的 .slice() 一个道理：下面两道
            // 软闸等用户点击确认的这段时间、以及 createTask 飞行中用户把表单关掉，都不应该让后续状态变化回灌进来
            // 歌词字幕（六期 P2）：同在快照阶段算好——条件是参考音声·歌词字段没被隐藏（演出类型/v1 渠道）&& 有参考音声
            // && 歌词非空（没有配乐的字幕没有意义）。解析用的 duration 是本次投稿选定的成片时长、不是参考音声自身的
            // 时长——各模型最长时长不一样（2.5 系 30 秒、其余 15 秒），字幕一律裁到成片长度，见 niconico-pv-lyrics.js
            let lyricCues = null;
            if (!pvAudioFieldHidden && this._pvRefAudio && this._pvParseLyricCues) {
                const pvLyricsText = (document.getElementById('nicoPvLyrics')?.value || '').trim();
                if (pvLyricsText) {
                    const lyricOffset = parseFloat(document.getElementById('nicoPvLyricOffset')?.value) || 0;
                    const parsedLyrics = this._pvParseLyricCues(pvLyricsText, { offset: lyricOffset, duration });
                    if (parsedLyrics.cues.length > 0) lyricCues = parsedLyrics.cues;
                }
            }
            // 镜头号（映射行用）跟 blobId 同一次拍下——分两处各读一遍 _pvFrames 的话，中间隔着软闸弹窗，两份可能对不上
            const frameSnap = modelInfo.ref ? (this._pvFrames || []).filter(f => f.blobId).map(f => ({ blobId: f.blobId, n: f.shot.n })) : [];
            const frameBlobIds = frameSnap.map(f => f.blobId);
            const submitRefImgIds = refImgIds.concat(frameBlobIds);
            // B（六期 P1）：立绘+分镜图合计不能超过当前模型的参考图上限——画廊选择器只卡立绘自己的张数，
            // 「生成分镜图」的确认弹窗只是提醒，这里才是硬校验，超了直接挡、不投稿
            const maxRefTotal = this._pvMaxRefImages(model);
            if (submitRefImgIds.length > maxRefTotal) {
                Utils.showToast(I18n.t('nico.pv_ref_total_exceeded', { a: refImgIds.length, b: frameBlobIds.length, n: maxRefTotal }), 4000);
                return;
            }
            // 画面比率（v2.240）：既定 16:9——PV は基本この尺寸。行が非表示（v1/参考図非対応）でも読んで問題ない：
            // createTask 側で参考図なし＝恒 16:9、v1 分岐＝ratio 不使用なので、この値は実際に効く場面でだけ効く
            const ratio = document.getElementById('nicoPvRatio')?.value || '16:9';
            const tweetSel = document.getElementById('nicoPvTweetAccount');
            const tweetAccountId = (tweetSel && tweetSel.value) ? tweetSel.value : null;

            // 指南骨架（六期）：手写脚本与「AIにおまかせ」出稿同样要过这一层——assetLines 复用与 _pvAiWrite
            // 同一份纯函数（_pvBuildAssetLines），画风锚 key 读法也复用 _pvGetArtStyleKey（表单实时值优先，
            // DOM 缺失才落到持久化默认）。真正的包装动作放在 createTask 之前（软闸通过之后），figMatches
            // 软闸②仍按用户手写的原始 prompt 判断，不受这里影响
            const charRefs = (typeof Broadcast !== 'undefined' && Broadcast.getAllCharRefs) ? Broadcast.getAllCharRefs() : [];
            const assetLines = this._pvBuildAssetLines(refImgIds, charRefs);
            const artStyleKey = this._pvGetArtStyleKey();

            const btn = document.getElementById('nicoPvSubmitBtn');
            if (btn) btn.disabled = true;
            try {
                // 软闸①（v2.244）：模型支持参考图但一张都没选——人物一致性没法保证，弹一次确认，不阻断（可能就是要纯文生）
                if (modelInfo.ref && refImgIds.length === 0) {
                    const ok = await this._pvOpenNoRefConfirm();
                    if (!ok) return;
                }

                // 软闸②（v2.246 review A4）：絵コンテ本文引用到図N，但快照里的参考图不够 N 张——多半是「AIにおまかせ」
                // 六期修：v2.263 分镜中文化后正文写的是「图N」，此前只匹配日文「図」等于闸一直没生效，现在两种都认
                // 生成后又手改了参考图选择、或者手写脚本时写了図N却忘了配图。两道软闸各判各的，顺序都触发时按序各弹一次
                const figMatches = prompt.match(/[図图](\d+)/g) || [];
                const maxFigN = figMatches.reduce((max, m) => Math.max(max, parseInt(m.slice(1), 10) || 0), 0);
                if (maxFigN > refImgIds.length) {
                    const ok2 = await this._pvOpenFigMismatchConfirm(maxFigN, refImgIds.length);
                    if (!ok2) return;
                }

                // v2.246 review（C2 critical）：createTask 前把这次要用的 pvtemp_ id 标记为 in-flight——创建任务请求
                // 窗口最长 5 分钟（_providerFetch 的 base64 大载荷超时），这段时间里表单关闭清理 / 缩略图 × 删除都要
                // 跳过它们（_pvCleanupTempRefImgs / _pvRemoveRefImg 已按此 Set 判断），不能让并发清理抢先删掉请求已经
                // 读入、即将被新任务持有的 blob
                const tempIds = refImgIds.filter(id => typeof id === 'string' && id.startsWith('pvtemp_'));
                tempIds.forEach(id => this._pvInFlightTempIds.add(id));
                // 分镜图 blob 同样标记 in-flight（六期 P1）：createTask 飞行中用户把表单关掉会触发 _closePVModal
                // 的 _pvClearFrames() 清理，那边同样按这个 Set 跳过正在被本次请求持有的 blob（同 tempIds 的姿势）
                frameBlobIds.forEach(id => this._pvInFlightTempIds.add(id));
                try {
                    // 指南骨架包装（六期）：【素材指代】+（画风追加过的）正文+【负向控制】。没有参考图也没有
                    // 参考音声时 _pvWrapPromptForSubmit 内部会省掉【素材指代】整块，只剩画风追加与负向控制。
                    // frameCount（P1）：有分镜图时追加一行图K〜图K+F-1 的映射说明，K 按立绘数量（assetLines.length）算
                    const wrappedPrompt = this._pvWrapPromptForSubmit(prompt, {
                        assetLines,
                        hasAudio: !!this._pvRefAudio,
                        audioSeconds: this._pvRefAudio ? this._pvRefAudio.duration : 0,
                        artStyleKey,
                        frameShots: frameSnap.map(f => f.n)
                    });
                    await VideoGen.createTask({
                        prompt: wrappedPrompt, refImgIds: submitRefImgIds, model, resolution, duration, ratio,
                        generateAudio, channelId, tweetAccountId,
                        refAudio: this._pvRefAudio || null,   // v1(Hailuo) 时 UI 已隐藏该区域、恒为 null；createTask 内部按渠道分支处理
                        lyricCues
                    });
                    n.lastPvChannelId = channelId;
                    Utils.saveData();
                    // 提交成功：把「这次真的发出去了」的 id 从会话态里摘掉，防 _closePVModal 的临时图清理误删任务刚接手、
                    // 还要留着重试用的 pvtemp blob。只摘发出去的那部分——如果切到不支持参考图的模型导致 refImgIds 没带上
                    // 之前相册选的临时图，它们会留在 _pvRefImgIds 里，随表单关闭被正常当作「未使用的临时图」清理掉
                    this._pvRefImgIds = (this._pvRefImgIds || []).filter(id => !refImgIds.includes(id));
                    // 分镜图（六期 P1）：同上——只摘会话态跟踪，不删 blob。任务的 refImgIds 里带着这些 pvframe_ id，
                    // 失败重试（VideoGen.retryTask）还要用；真正的孤儿判定交给 VideoGen.abandonTask 内的
                    // _cleanupTempRefImgs（已扩展支持 pvframe_ 前缀）
                    this._pvFrames = [];
                    this._closePVModal();
                    Utils.showToast(I18n.t('nico.pv_toast_started', '生成開始！'));
                    this.refreshGenCard();   // 占位卡即时出现（不等第一次轮询）
                } catch (e) {
                    console.error('[Niconico] PV submit error:', e);
                    Utils.showToast(I18n.t('t.nico_gen_error', '⚠️ 生成エラー: ') + e.message, 4000);
                } finally {
                    tempIds.forEach(id => this._pvInFlightTempIds.delete(id));
                    frameBlobIds.forEach(id => this._pvInFlightTempIds.delete(id));
                    // v2.246 review（C2 变体）：settle 后（in-flight 标记摘掉之后）再查一次表单还在不在——createTask
                    // 这几分钟窗口期间表单被关掉了的话，按「有没有任务接手」做一次真正的孤儿清理：成功路径新任务的
                    // refImgIds 里带着这些 id（stillUsed=true，保留）；失败路径没有任何任务引用（stillUsed=false，删）
                    if (tempIds.length > 0 && !document.getElementById('nicoPvModal')) {
                        for (const id of tempIds) {
                            const stillUsed = VideoGen.tasks().some(t => (t.refImgIds || []).includes(id));
                            if (!stillUsed) await VideoGen.removeBlob(id).catch(e => console.warn('[Niconico] orphan temp blob cleanup failed', e));
                        }
                    }
                    // 分镜图孤儿清理（六期 P1）：同上逻辑，但 pvframe_ blob 落在 IllustGallery（不是 VideoGen.store()）
                    if (frameBlobIds.length > 0 && !document.getElementById('nicoPvModal')) {
                        for (const id of frameBlobIds) {
                            const stillUsed = VideoGen.tasks().some(t => (t.refImgIds || []).includes(id));
                            if (!stillUsed) await IllustGallery.remove(id).catch(e => console.warn('[Niconico] orphan pv frame blob cleanup failed', e));
                        }
                    }
                }
            } finally {
                if (btn) btn.disabled = false;
            }
        }, () => Utils.showToast(I18n.t('nico.pv_submit_busy', '投稿処理中です。少々お待ちください')));
    },

    // ═══════════════════════════════════════════════════════════
    // PV投稿：占位卡 / 入库 / 真プレイヤー / 削除カスケード（Task 8）
    // ═══════════════════════════════════════════════════════════

    // VideoGen._notifyUI から呼ばれる。新着タブが前面にある時だけ再描画（前面じゃない時は静かに何もしない）
    // task 引数の中身は使わない（粗暴に全リスト再描画——モジュールの既存の再描画慣習に倣う）
    refreshGenCard(task) {
        if (AppState.currentScreen !== 'niconico' || this.currentTab !== 'new') return;
        const container = document.getElementById('niconicoContent');
        if (!container) return;
        this.renderNewVideos(container);
    },

    // 生成中タスクの占位卡：queued/running/downloading/paused は骨架アニメ、failed/expired は赤枠+再試行/削除
    _renderGenCard(task) {
        const isError = task.status === 'failed' || task.status === 'expired';
        const statusText = this._pvStatusText(task.status);
        const titleText = this._escHtml(VideoGen.promptBody(task.prompt).slice(0, 24));

        if (isError) {
            return `
            <div class="nico-video-card nico-gencard nico-gencard-error">
                <div class="nico-thumbnail nico-gencard-thumb">
                    <span class="nico-thumb-icon">${this._SVG.film}</span>
                </div>
                <div class="nico-video-info">
                    <div class="nico-video-title">${titleText}</div>
                    <div class="nico-gencard-error-msg">${this._escHtml(task.error || statusText)}</div>
                    <div class="nico-gencard-actions">
                        <button class="glass-btn mini" onclick="event.stopPropagation();Niconico._retryGenTask('${task.id}')">${I18n.t('nico.pv_btn_retry', '再試行')}</button>
                        <button class="glass-btn mini danger-text" onclick="event.stopPropagation();Niconico._abandonGenTask('${task.id}')">${I18n.t('nico.pv_btn_discard', '削除')}</button>
                    </div>
                </div>
            </div>`;
        }

        return `
        <div class="nico-video-card nico-gencard">
            <div class="nico-thumbnail nico-gencard-thumb nico-gencard-skeleton">
                <span class="nico-thumb-icon">${this._SVG.film}</span>
            </div>
            <div class="nico-video-info">
                <div class="nico-video-title">${titleText}</div>
                <div class="nico-gencard-status">${statusText}</div>
                <div class="nico-gencard-actions">
                    <button class="glass-btn mini danger-text" onclick="event.stopPropagation();Niconico._abandonGenTask('${task.id}')">${I18n.t('nico.pv_btn_cancel', 'キャンセル')}</button>
                </div>
            </div>
        </div>`;
    },

    _pvStatusText(status) {
        switch (status) {
            case 'queued': return I18n.t('nico.pv_status_queued', '順番待ち…');
            case 'running': return I18n.t('nico.pv_status_running', '生成中…');
            case 'downloading': return I18n.t('nico.pv_status_downloading', 'ダウンロード中…');
            case 'paused': return I18n.t('nico.pv_status_paused', 'ネットワーク待ち');
            case 'failed': return I18n.t('nico.pv_status_failed', '生成失敗');
            case 'expired': return I18n.t('nico.pv_status_expired', '期限切れ');
            default: return I18n.t('nico.pv_status_unknown', '状態不明');
        }
    },

    // v2.246 review（C5 critical）：入口挡 VideoGen._retryingIds——retryTask 内部自己会在结尾调 abandonTask 删掉
    // localId 这个旧任务（先建新任务成功才删旧的，见 video-gen.js retryTask 注释），如果「再試行」按钮本身允许双击，
    // 或者用户在 retryTask 跑到一半时又点了「削除」，就会跟 retryTask 内部即将发生的 abandonTask 撞车。
    // 守卫必须放在这两个 UI 入口（而不是 abandonTask 内部）——因为 retryTask 对同一个 localId 的 abandonTask
    // 调用是合法的、不该被自己的守卫拦下
    async _retryGenTask(taskId) {
        if (VideoGen._retryingIds.has(taskId)) {
            Utils.showToast(I18n.t('vg.retry_in_progress', '再試行の処理中です。完了までお待ちください'));
            return;
        }
        try {
            await VideoGen.retryTask(taskId);
            Utils.showToast(I18n.t('nico.pv_toast_retrying', '再試行しています…'));
        } catch (e) {
            Utils.showToast(String((e && e.message) || e));
        }
        this.refreshGenCard({ id: taskId });
    },

    async _abandonGenTask(taskId) {
        if (VideoGen._retryingIds.has(taskId)) {
            Utils.showToast(I18n.t('vg.retry_in_progress', '再試行の処理中です。完了までお待ちください'));
            return;
        }
        if (!confirm(I18n.t('nico.pv_confirm_discard', 'この生成タスクを削除しますか？'))) return;
        await VideoGen.abandonTask(taskId).catch(() => {});
        this.refreshGenCard({ id: taskId });
    },

    // 真動画の入库（VideoGen._onSucceeded から呼ばれる）：_generateVideos の落库形态と同構にする
    // task: VideoGen タスク / pk: packaging（LLM生成 or _onSucceeded 側の既定フォールバック）/ videoBlobId: 'vid-'+task.id
    addRealVideo(task, pk, videoBlobId) {
        const n = this._ensureData();
        const ch = this._getChannel(task.channelId);
        const videoId = Utils.generateId();
        const duration = this._fmtDuration(task.duration);

        const video = {
            id: videoId,
            title: pk.title || VideoGen.promptBody(task.prompt).slice(0, 20) || I18n.t('nico.detail_title_default', '動画'),
            titleTl: pk.titleTl || null,
            uploaderName: ch ? ch.name : I18n.t('nico.pv_default_uploader', '公式チャンネル'),
            channelId: task.channelId || null,
            genre: 'anime',
            emoji: '🎬',
            tags: pk.tags || [],
            description: pk.description || '',
            descTl: pk.descTl || null,
            // views/commentCount/mylists は _generateVideos の落库形态（数値）に合わせる。pk側はLLM出力の文字列 or フォールバックの数値、どちらも parseInt で吸収
            views: parseInt(pk.views, 10) || 1000,
            commentCount: parseInt(pk.commentCount, 10) || 0,
            mylists: parseInt(pk.mylists, 10) || 0,
            duration,
            uploadedAt: Date.now(),
            videoBlobId,   // ← 真動画マーク（真プレイヤー判定・削除カスケードに使う）
        };
        // 歌词字幕（六期 P2）：task 上有才写这个字段（可选字段，读取侧一律 v.lyricCues && v.lyricCues.length 兜底判空）
        if (task.lyricCues) video.lyricCues = task.lyricCues;
        n.videos.push(video);

        // 弾幕/コメントは n.comments[videoId] に統合する（_generateVideos と同じ落库形态。v.danmaku という独立フィールドは持たない）
        const allComments = [];
        (pk.danmaku || []).forEach(text => {
            if (!text) return;
            allComments.push({
                id: Utils.generateId(),
                authorName: '',
                text,
                timestamp: this._randomTimestamp(duration),
                color: this._DANMAKU_COLORS[Math.floor(Math.random() * this._DANMAKU_COLORS.length)]
            });
        });
        (pk.comments || []).forEach(c => {
            allComments.push({
                id: Utils.generateId(),
                authorName: (c && c.author) || I18n.t('nico.anonymous', '匿名'),
                text: (c && c.text) || '',
                timestamp: '',
                color: null
            });
        });
        if (allComments.length) n.comments[videoId] = allComments;

        Utils.saveData();
        if (AppState.currentScreen === 'niconico' && this.currentTab === 'new') this._renderCurrentTab();
        return video;
    },

    // 包装 LLM が視頻生成より遅かった場合の補救（VideoGen._generatePackaging から呼ばれる）：
    // task が既にキューから出ている（_onSucceeded が占位値で入库済み）時、videoBlobId で逆引きして
    // 本物の title/desc/tags/弾幕/コメントを埋め直す。videoBlobId = 'vid-' + taskId（_onSucceeded と同じ規則）。
    // 動画が既に削除済みなら何もしない（結果は破棄）。
    applyPackagingBackfill(taskId, pk) {
        const n = this._ensureData();
        const videoBlobId = 'vid-' + taskId;
        const v = (n.videos || []).find(x => x.videoBlobId === videoBlobId);
        if (!v) return;   // 動画は既に削除済み

        if (pk.title) v.title = pk.title;
        if (pk.titleTl) v.titleTl = pk.titleTl;
        if (pk.description) v.description = pk.description;
        if (pk.descTl) v.descTl = pk.descTl;
        if (pk.tags && pk.tags.length) v.tags = pk.tags;

        // 弾幕/コメントは addRealVideo と同じ落库形态で n.comments[v.id] に追記
        const extra = [];
        (pk.danmaku || []).forEach(text => {
            if (!text) return;
            extra.push({
                id: Utils.generateId(),
                authorName: '',
                text,
                timestamp: this._randomTimestamp(v.duration),
                color: this._DANMAKU_COLORS[Math.floor(Math.random() * this._DANMAKU_COLORS.length)]
            });
        });
        (pk.comments || []).forEach(c => {
            extra.push({
                id: Utils.generateId(),
                authorName: (c && c.author) || I18n.t('nico.anonymous', '匿名'),
                text: (c && c.text) || '',
                timestamp: '',
                color: null
            });
        });
        if (extra.length) {
            if (!n.comments[v.id]) n.comments[v.id] = [];
            n.comments[v.id].push(...extra);
            v.commentCount = (v.commentCount || 0) + extra.length;
        }

        Utils.saveData();
        if (AppState.currentScreen === 'niconico-detail' && this.currentVideoId === v.id) {
            this.renderVideoDetail();
        } else if (AppState.currentScreen === 'niconico' && this.currentTab === 'new') {
            this._renderCurrentTab();
        }
    },

    // 動画詳細ページのプレイヤーエリア：videoBlobId 持ちは真プレイヤー、それ以外は既存の弾幕クリック再生プレースホルダー
    _renderPlayerArea(v) {
        if (v.videoBlobId) {
            return `
            <div class="nico-player-area nico-player-real">
                <video id="nicoRealPlayer" controls playsinline webkit-playsinline preload="metadata" onplay="Niconico.startDanmaku('${v.id}')"></video>
                <div class="nico-danmaku-track nico-danmaku-overlay" id="nicoDanmakuTrack"></div>
                ${(v.lyricCues && v.lyricCues.length && this._pvLyricOverlayHtml) ? this._pvLyricOverlayHtml() : ''}
            </div>`;
        }
        return `
        <div class="nico-player-area">
            <div class="nico-danmaku-track" id="nicoDanmakuTrack">
                <div class="nico-danmaku-placeholder">${I18n.t('nico.player_hint', '▶ クリックで弾幕再生')}</div>
            </div>
            <div class="nico-player-emoji">${this._SVG.video}</div>
            <div class="nico-player-overlay" onclick="Niconico.startDanmaku('${v.id}')"></div>
        </div>`;
    },

    // 真動画の src を非同期で埋める。取得できない（IDB 真損壊）場合はエラー占位を出すが条目は削除しない（設計 §10）
    _loadRealPlayer(v) {
        const videoId = v.id;
        const blobId = v.videoBlobId;
        // renderVideoDetail が退避した再生位置（同じ動画への粗暴re-render対策。他の動画に切替時は null）
        const pending = (this._pendingPlayerState && videoId === this.currentVideoId) ? this._pendingPlayerState : null;
        this._pendingPlayerState = null;
        VideoGen.getUrl(blobId).then(url => {
            if (this.currentVideoId !== videoId) return;   // 別の動画に切替済み — 竞态防護
            const videoEl = document.getElementById('nicoRealPlayer');
            if (!videoEl) return;
            if (url) {
                videoEl.src = url;
                if (window.AudioCoordinator) AudioCoordinator.register(videoEl);   // widget/Music Lab/audio-drama/LINE voice と同じ互斥に参加
                // 歌词字幕（六期 P2，niconico-pv-lyrics.js）：src 就绪后挂上字幕循环——_pvLyricAttach 内部会先
                // 自行 detach 一次，同视频重渲染（renderVideoDetail 反复调用）不会留下重复循环
                if (this._pvLyricAttach) this._pvLyricAttach(videoEl, v);
                if (pending && pending.time > 0) {
                    const applyState = () => {
                        try { videoEl.currentTime = pending.time; } catch (e) { }
                        if (pending.playing) videoEl.play().catch(() => {});
                    };
                    if (videoEl.readyState >= 1) applyState();
                    else videoEl.addEventListener('loadedmetadata', applyState, { once: true });
                }
            } else {
                const area = videoEl.closest('.nico-player-area');
                if (area) area.innerHTML = `<div class="nico-player-error">${this._escHtml(I18n.t('nico.pv_video_missing', '動画データが見つかりません（削除はされていません）'))}</div>`;
            }
        }).catch(() => {});
    },

    // PV投稿の実動画を削除（真動画のみ — 通常のAI生成動画には削除UIが無い）：blob をカスケード削除して孤児を残さない
    async deleteVideo(videoId) {
        const n = this._ensureData();
        const v = (n.videos || []).find(x => x.id === videoId);
        if (!v) return;
        if (!confirm(I18n.t('nico.pv_confirm_delete_video', 'この動画を削除しますか？\n動画ファイルも削除されます。'))) return;

        this._stopRealPlayer();   // blob を revoke する前に再生を止めておく

        if (v.videoBlobId && typeof VideoGen !== 'undefined') {
            await VideoGen.removeBlob(v.videoBlobId).catch(() => {});
            await VideoGen.removeBlob('thumb:' + v.videoBlobId).catch(() => {});
        }

        n.videos = n.videos.filter(x => x.id !== videoId);
        n.mylist = (n.mylist || []).filter(id => id !== videoId);
        delete n.comments[videoId];

        Utils.saveData();
        this._stopDanmaku();
        Utils.showToast(I18n.t('t.nico_deleted', '削除しました'));
        Navigation.goTo('niconico');
    },
});
