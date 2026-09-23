// ===== PV投稿：歌词字幕（六期 P2，2026-09-19） =====
// 「サビ MV」最小形态：在现有单次 PV 投稿上加「带时间轴的歌词 → 播放器字幕叠加 → 带字幕导出」。
// 独立成文件（不塞进已经很大的 niconico.js / niconico-pv-submit.js，见项目 CLAUDE.md 单文件拆分铁律）：
// 用 Object.assign 挂到既有 Niconico 对象上，复用它的 _pvRefAudio / _pvRefAudioMaxSec / _ensureData 等
// 既有状态与方法。既有分片（form/media/storyboard/submit）与主文件 niconico.js 里只各加了几行「钩子」
// （`if (this._pvXxx) this._pvXxx(...)` 的守卫写法，照 niconico-pv-frames.js 的先例），大段逻辑都在这里。
// 索引/加载顺序：index.html 紧跟在 <script src="js/niconico-pv-frames.js"> 之后加载，sw.js coreUrls /
// deploy.sh DEFAULT_FILES 也登记在同一位置——三处任一遗漏都会导致离线缓存/静态部署缺文件。
//
// 数据形状：video.lyricCues = [{ t, end, text, sub }, ...] | undefined（可选字段，读取侧一律
// `v.lyricCues && v.lyricCues.length` 兜底判空，不需要 schema 迁移）。t/end 为相对成片开头的秒数。

// 补一枚字幕/保存图标到既有 _SVG 表（放在 Object.assign 之外——Object.assign 里写 _SVG 会整个覆盖掉
// niconico.js 里已有的图标表，只能用赋值属性的写法追加）
Niconico._SVG.lyric = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 10h4M6 14h8M13 10h5"/></svg>';
Niconico._SVG.save = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0-4-4m4 4 4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>';

Object.assign(Niconico, {

    // 播放中的字幕循环状态（会话级、非持久）：{ videoEl, cues, overlay, rafId, onPlay, onPauseOrSeek } | null
    _pvLyricState: null,
    // 导出进行中的取消回调（会话级）：{_pvExportWithLyrics} 运行期间非 null，供 _pvCancelExport 调用
    _pvExportCancelCb: null,
    // 录完待保存的成品 { blob, filename }（会话级）：停在「导出完成」弹窗期间非 null，关弹窗即丢
    _pvExportResult: null,

    // ═══════════════════════════════════════════════════════════
    // 纯函数：歌词解析
    // ═══════════════════════════════════════════════════════════

    // 行尾括号译文拆分：只有括号在行尾且括号前还有正文时才拆（半角/全角括号都认）。贪婪匹配确保多组括号时
    // 只拆最后一组；括号前修剪后为空（整行只是"（译文）"）或括号内为空则不拆，原样返回
    _pvSplitLyricParen(text) {
        const str = String(text || '');
        const m = str.match(/^(.*)[（(]([^()（）]+)[)）]$/);
        if (!m) return { main: str, sub: null };
        const main = m[1].trim();
        const sub = m[2].trim();
        if (!main || !sub) return { main: str, sub: null };
        return { main, sub };
    },

    // LRC 解析核心。text：原始歌词文本；opts.offset：秒数偏移（默认0，用于把参考音声的选段起点换算成
    // 相对成片开头的时间）；opts.duration：成片时长（秒），非正数直接判空
    // 返回 { timed, cues: [{t, end, text, sub}] }。timed=false 时按字符数加权平均铺满 [0, duration)
    _pvParseLyricCues(text, opts) {
        const offset = (opts && typeof opts.offset === 'number' && isFinite(opts.offset)) ? opts.offset : 0;
        const duration = opts && opts.duration;
        const str = text || '';
        if (!str.trim() || !(duration > 0)) return { timed: false, cues: [] };

        const rawLines = str.split(/\r\n|\r|\n/);
        // 元标签行（整行只有一个识别名单内的标签）忽略——不算时间戳也不进入无时间戳兜底的正文集合
        const metaLineRe = /^\s*\[(ti|ar|al|by|offset|re|ve|length|id|kana)\s*:[^\]]*\]\s*$/i;

        // entries：每个 LRC 时间戳展开成一条（重复句处理），空歌词行（只有时间戳、无正文）也保留在内——
        // 它们不产生 cue，但要作为"上一句结束点"参与 end 的计算
        const entries = [];
        let anyTimestamp = false;
        const plainLines = [];

        for (const rawLine of rawLines) {
            if (metaLineRe.test(rawLine)) continue;
            // 逐行用一个新 RegExp 实例，避免 exec 的 lastIndex 状态跨行/跨 replace 残留
            const timeTagRe = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
            const times = [];
            let m;
            while ((m = timeTagRe.exec(rawLine))) {
                const min = parseInt(m[1], 10);
                const sec = parseInt(m[2], 10);
                let frac = 0;
                if (m[3]) frac = parseInt(m[3], 10) / Math.pow(10, m[3].length);
                times.push(min * 60 + sec + frac);
            }
            if (times.length > 0) {
                anyTimestamp = true;
                const strippedText = rawLine.replace(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g, '').trim();
                times.forEach(t => entries.push({ t, text: strippedText }));
            } else {
                const trimmed = rawLine.trim();
                if (trimmed) plainLines.push(trimmed);
            }
        }

        if (anyTimestamp) {
            // 同一时间戳（完全相同的秒数）分组：同组内第一条为正文，第二条（如有）作为其译文（sub）——
            // 一行多个时间戳已经在上面展开成多条独立 entry，这里按数值分组是为了识别"两行时间戳完全相同"
            const byT = new Map();
            entries.forEach(e => {
                if (!byT.has(e.t)) byT.set(e.t, []);
                byT.get(e.t).push(e.text);
            });
            const times = Array.from(byT.keys()).sort((a, b) => a - b);
            const boundary = times.map(t => {
                const texts = byT.get(t);
                let mainText = texts[0];
                let sub = null;
                if (texts.length >= 2 && texts[1]) {
                    sub = texts[1];
                } else {
                    const split = this._pvSplitLyricParen(mainText);
                    if (split.sub) { mainText = split.main; sub = split.sub; }
                }
                return { t: t - offset, text: mainText, sub };
            });

            const cues = [];
            for (let i = 0; i < boundary.length; i++) {
                const cur = boundary[i];
                if (!cur.text) continue;   // 空歌词行（只有时间戳）本身不产生 cue，只用于给前一句定 end
                let start = cur.t;
                const nextT = (i + 1 < boundary.length) ? boundary[i + 1].t : duration;
                let end = Math.min(nextT, duration);
                if (start >= duration) continue;         // 完全在窗口之后
                if (end <= 0) continue;                   // 完全在窗口之前
                if (start < 0) start = 0;                 // 片头正在唱的那句：夹到 0 保留
                if (end <= start) continue;                // 钳制后长度非正，异常数据兜底丢弃
                cues.push({ t: Math.round(start * 10) / 10, end: Math.round(end * 10) / 10, text: cur.text, sub: cur.sub || null });
            }
            return { timed: true, cues };
        }

        // 无时间戳：按字符数（正文部分，不含译文）加权平均铺满 [0, duration)
        if (plainLines.length === 0) return { timed: false, cues: [] };
        const items = plainLines.map(line => {
            const { main, sub } = this._pvSplitLyricParen(line);
            return { text: main, sub, weight: Math.max(1, main.length) };
        });
        const totalWeight = items.reduce((s, it) => s + it.weight, 0);
        let cursor = 0;
        const cues = items.map(it => {
            const t = cursor;
            cursor += duration * (it.weight / totalWeight);
            return { t: Math.round(t * 10) / 10, end: Math.round(Math.min(cursor, duration) * 10) / 10, text: it.text, sub: it.sub || null };
        });
        cues[cues.length - 1].end = Math.round(duration * 10) / 10;   // 消除浮点误差，末句精确顶到 duration
        return { timed: false, cues };
    },

    // 去掉时间戳和元标签行后的纯歌词（保留行尾括号译文——不做二次拆分，保证输出稳定可预测）
    _pvLyricsPlainText(text) {
        const str = text || '';
        const metaLineRe = /^\s*\[(ti|ar|al|by|offset|re|ve|length|id|kana)\s*:[^\]]*\]\s*$/i;
        const lines = str.split(/\r\n|\r|\n/);
        const out = [];
        for (const raw of lines) {
            if (metaLineRe.test(raw)) continue;
            const stripped = raw.replace(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g, '').trim();
            if (stripped) out.push(stripped);
        }
        return out.join('\n');
    },

    // 给定 cues 与当前时刻，找出应显示的那一条（半开区间 [t, end)）；命中 end 边界视为已结束（落到下一条或 null）
    _pvFindCueAt(cues, time) {
        if (!cues || cues.length === 0) return null;
        for (let i = 0; i < cues.length; i++) {
            const c = cues[i];
            if (time >= c.t && time < c.end) return c;
        }
        return null;
    },

    // ═══════════════════════════════════════════════════════════
    // 表单：偏移输入 + 预览行（钩在 niconico-pv-form.js 的歌词字段下面）
    // ═══════════════════════════════════════════════════════════

    _pvLyricOffsetFieldHtml() {
        return `
        <div class="nico-pv-lyric-offset-row" id="nicoPvLyricOffsetRow" style="display:none;">
            <label class="nico-pv-lyric-offset-label" for="nicoPvLyricOffset">${I18n.t('nico.pv_lyric_offset_label', '歌词时间偏移')}</label>
            <input type="number" id="nicoPvLyricOffset" class="nico-pv-lyric-offset-input" step="0.1" value="0" oninput="if(Niconico._pvUpdateLyricPreview)Niconico._pvUpdateLyricPreview()">
            <span class="nico-pv-lyric-preview" id="nicoPvLyricPreview"></span>
        </div>`;
    },

    // 歌词非空才显示这一行；否则连预览文字都不必算，直接隐藏——duration 来自表单当前选的时长档位
    _pvUpdateLyricPreview() {
        const row = document.getElementById('nicoPvLyricOffsetRow');
        const previewEl = document.getElementById('nicoPvLyricPreview');
        if (!row || !previewEl) return;
        const lyricsEl = document.getElementById('nicoPvLyrics');
        const lyrics = ((lyricsEl && lyricsEl.value) || '').trim();
        if (!lyrics) { row.style.display = 'none'; return; }
        row.style.display = '';
        const offset = parseFloat(document.getElementById('nicoPvLyricOffset')?.value) || 0;
        const duration = parseInt(document.getElementById('nicoPvDuration')?.value, 10) || 10;
        const parsed = this._pvParseLyricCues(lyrics, { offset, duration });
        if (parsed.cues.length === 0) {
            previewEl.textContent = I18n.t('nico.pv_lyric_preview_empty', '未解析到可用歌词');
        } else if (!parsed.timed) {
            previewEl.textContent = I18n.t('nico.pv_lyric_preview_untimed', '未检测到时间戳，将按字数平均分配');
        } else {
            previewEl.textContent = I18n.t('nico.pv_lyric_preview_timed', { n: parsed.cues.length, t: parsed.cues[0].t.toFixed(1) });
        }
    },

    // 参考音声变化钩子：offsetSec 为这次变化对应的偏移量（直接采用整首/移除参考音声=0，选段确认=区间起点秒数）。
    // 由 niconico-pv-media.js 的三处参考音声状态变更点各调用一次。用户手动改过输入框后，若又发生一次新的
    // 选段/移除操作，这里会用新值覆盖——"重新选段会再次覆盖成新起点"是产品明确要的行为
    _pvOnRefAudioOffsetChanged(offsetSec) {
        const input = document.getElementById('nicoPvLyricOffset');
        if (input) input.value = String(offsetSec || 0);
        if (this._pvUpdateRefAudioLimitWarning) this._pvUpdateRefAudioLimitWarning();
        if (this._pvUpdateLyricPreview) this._pvUpdateLyricPreview();
    },

    // 切模型后参考音声超出新上限的警告：只是提示（真正挡投稿的硬校验在 niconico-pv-submit.js 的 _pvSubmit 里，
    // 判断条件同一套 +0.05 浮点容差）
    _pvUpdateRefAudioLimitWarning() {
        const hint = document.getElementById('nicoPvRefAudioLimitHint');
        if (!hint) return;
        const ra = this._pvRefAudio;
        const maxSec = this._pvRefAudioMaxSec ? this._pvRefAudioMaxSec() : 15;
        if (ra && ra.duration > maxSec + 0.05) {
            hint.textContent = I18n.t('nico.pv_lyric_audio_over_limit_hint', { n: maxSec });
            hint.style.display = 'block';
        } else {
            hint.style.display = 'none';
            hint.textContent = '';
        }
    },

    // ═══════════════════════════════════════════════════════════
    // 播放器字幕叠加
    // ═══════════════════════════════════════════════════════════

    _pvLyricOverlayHtml() {
        return '<div class="nico-lyric-overlay" id="nicoLyricOverlay"><div class="nico-lyric-main"></div><div class="nico-lyric-sub"></div></div>';
    },

    // 挂上字幕循环：videoEl 就绪、video.lyricCues 非空时才生效。播放中用 rAF 驱动（timeupdate 每秒只有
    // 4 次左右，字幕起句会明显迟到）；暂停/结束/跳转时用事件驱动刷一帧即可，不需要 rAF 空转
    _pvLyricAttach(videoEl, video) {
        this._pvLyricDetach();   // 保险：先清掉可能残留的旧循环（同视频重渲染/连续调用时）
        if (!videoEl || !video || !(video.lyricCues && video.lyricCues.length)) return;
        const overlay = document.getElementById('nicoLyricOverlay');
        if (!overlay) return;

        const state = { videoEl, cues: video.lyricCues, overlay, rafId: null, onPlay: null, onPauseOrSeek: null, shown: undefined };
        this._pvLyricState = state;
        overlay.style.display = this._ensureData().pvLyricOverlayOff ? 'none' : '';

        const tick = () => {
            const st = this._pvLyricState;
            if (!st || st.videoEl !== videoEl) return;   // 已被 detach 或换了新视频，静默退出
            this._pvRenderLyricFrame();
            if (!videoEl.paused && !videoEl.ended) {
                st.rafId = requestAnimationFrame(tick);
            } else {
                st.rafId = null;
            }
        };
        state.onPlay = () => {
            if (this._pvLyricState === state && state.rafId == null) {
                state.rafId = requestAnimationFrame(tick);
            }
        };
        state.onPauseOrSeek = () => this._pvRenderLyricFrame();
        videoEl.addEventListener('play', state.onPlay);
        videoEl.addEventListener('pause', state.onPauseOrSeek);
        videoEl.addEventListener('seeked', state.onPauseOrSeek);
        videoEl.addEventListener('ended', state.onPauseOrSeek);

        this._pvRenderLyricFrame();   // 初始一帧（同视频重渲染时可能已经播放到中途）
        if (!videoEl.paused) state.onPlay();
    },

    _pvLyricDetach() {
        const st = this._pvLyricState;
        if (!st) return;
        if (st.rafId != null) cancelAnimationFrame(st.rafId);
        try {
            st.videoEl.removeEventListener('play', st.onPlay);
            st.videoEl.removeEventListener('pause', st.onPauseOrSeek);
            st.videoEl.removeEventListener('seeked', st.onPauseOrSeek);
            st.videoEl.removeEventListener('ended', st.onPauseOrSeek);
        } catch (e) { /* 元素已卸载等，忽略 */ }
        this._pvLyricState = null;
    },

    _pvRenderLyricFrame() {
        const st = this._pvLyricState;
        if (!st) return;
        const cue = this._pvFindCueAt(st.cues, st.videoEl.currentTime || 0);
        if (cue === st.shown) return;   // rAF 每帧都会进来，同一句期间不重复写 DOM
        st.shown = cue;
        const mainEl = st.overlay.querySelector('.nico-lyric-main');
        const subEl = st.overlay.querySelector('.nico-lyric-sub');
        if (mainEl) mainEl.textContent = cue ? (cue.text || '') : '';
        if (subEl) subEl.textContent = (cue && cue.sub) ? cue.sub : '';
    },

    // 详情页操作按钮区的字幕开关（钩在 niconico.js 的 renderVideoDetail 里，仅 v.lyricCues 非空时渲染）。
    // 按钮文案是"点了会怎样"（显示/隐藏字幕），不是像マイリスト那样的状态描述——对二元开关更直观
    _pvLyricToggleBtnHtml() {
        const off = !!this._ensureData().pvLyricOverlayOff;
        return `
        <button class="glass-btn nico-action-btn ${off ? '' : 'active'}" id="nicoLyricToggleBtn" onclick="Niconico._pvToggleLyricOverlay()">
            <span class="nico-btn-icon">${this._SVG.lyric}</span>${off ? I18n.t('nico.pv_lyric_toggle_show', '显示字幕') : I18n.t('nico.pv_lyric_toggle_hide', '隐藏字幕')}
        </button>`;
    },

    _pvToggleLyricOverlay() {
        const n = this._ensureData();
        n.pvLyricOverlayOff = !n.pvLyricOverlayOff;
        Utils.saveData();
        // 只动覆盖层和按钮自己，不整页重渲染——renderVideoDetail 会重建 <video>，播放中切字幕画面会卡一下
        const overlay = document.getElementById('nicoLyricOverlay');
        if (overlay) overlay.style.display = n.pvLyricOverlayOff ? 'none' : '';
        const btn = document.getElementById('nicoLyricToggleBtn');
        if (btn) btn.outerHTML = this._pvLyricToggleBtnHtml();
    },

    // ═══════════════════════════════════════════════════════════
    // 保存 / 带字幕导出
    // ═══════════════════════════════════════════════════════════

    _pvSaveBtnHtml(videoId) {
        return `
        <button class="glass-btn nico-action-btn" onclick="Niconico._pvOpenSaveMenu('${this._escHtml(videoId)}')">
            <span class="nico-btn-icon">${this._SVG.save}</span>${I18n.t('nico.pv_save_btn', '保存')}
        </button>`;
    },

    _pvSanitizeFilename(s) {
        return String(s || '').replace(/[\\/:*?"<>|]/g, '_');
    },

    // forceExt 优先（导出侧已经知道实际编码出的容器格式）；否则按 mimeType 猜（默认 mp4）
    _pvVideoFilename(title, mimeType, forceExt) {
        const base = this._pvSanitizeFilename((title || 'video').slice(0, 20)) || 'video';
        const ext = forceExt || ((mimeType && /webm/i.test(mimeType)) ? 'webm' : 'mp4');
        return `${base}_pv.${ext}`;
    },

    // 保存文件的统一出口：优先系统分享（iOS PWA 里这是唯一能把文件存进相册/文件 App 的路），否则 <a download> 兜底。
    // 返回 'shared' / 'aborted'（用户在分享面板里取消）/ 'downloaded'。
    // ⚠️ navigator.share 要求调用时还在用户点击的有效期内——调用方不能在一段很长的异步之后才走到这里
    // （带字幕导出要实时录几十秒，所以它录完先停在「导出完成」，让用户再点一次「保存」才进来）
    async _pvSaveBlob(blob, filename) {
        try {
            if (navigator.canShare && typeof File === 'function') {
                const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({ files: [file] });
                    return 'shared';
                }
            }
        } catch (e) {
            if (e && e.name === 'AbortError') return 'aborted';   // 主动取消不算失败，不再兜底下载一次
            console.warn('[Niconico] navigator.share failed, falling back to download', e);
        }
        const url = Utils.trackBlobUrl(URL.createObjectURL(blob), 'nico-pv-save');
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);   // 不挂进 DOM 的 <a> 在部分浏览器里 click() 不触发下载
        a.click();
        a.remove();
        // 下载是异步开始的，click() 后立刻回收 URL 会让大文件在部分浏览器里下载失败——留一分钟再收
        setTimeout(() => Utils.revokeBlobScope('nico-pv-save'), 60000);
        return 'downloaded';
    },

    async _pvOpenSaveMenu(videoId) {
        const n = this._ensureData();
        const v = (n.videos || []).find(x => x.id === videoId);
        if (!v || !v.videoBlobId) return;
        if (!v.lyricCues || v.lyricCues.length === 0) {
            await this._pvSaveOriginalVideo(videoId);
            return;
        }
        // 骨架照 showGenerateMenu：纵向选项列表（.nico-gen-btn）+ 独立的关闭按钮，不用两按钮一行的 .nico-pv-actions
        const html = `
        <div class="nico-modal-overlay nico-pv-confirm-overlay" id="nicoPvSaveMenuModal" onclick="if(event.target===this)Niconico._pvCloseSaveMenu()">
            <div class="nico-modal nico-pv-confirm-modal">
                <div class="nico-modal-title">${I18n.t('nico.pv_save_menu_title', '保存视频')}</div>
                <div class="nico-modal-buttons">
                    <button class="glass-btn nico-gen-btn" onclick="Niconico._pvCloseSaveMenu();Niconico._pvSaveOriginalVideo('${this._escHtml(videoId)}')">${I18n.t('nico.pv_save_original', '原视频')}</button>
                    <button class="glass-btn nico-gen-btn" onclick="Niconico._pvCloseSaveMenu();Niconico._pvExportWithLyrics('${this._escHtml(videoId)}')">${I18n.t('nico.pv_save_with_lyrics', '带字幕导出')}</button>
                </div>
                <button class="glass-btn nico-modal-close" onclick="Niconico._pvCloseSaveMenu()">${I18n.t('nico.pv_btn_cancel', 'キャンセル')}</button>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
    },

    _pvCloseSaveMenu() {
        document.getElementById('nicoPvSaveMenuModal')?.remove();
    },

    async _pvSaveOriginalVideo(videoId) {
        const n = this._ensureData();
        const v = (n.videos || []).find(x => x.id === videoId);
        if (!v || !v.videoBlobId) return;
        const blob = await VideoGen.getBlob(v.videoBlobId);
        if (!blob) { Utils.showToast(I18n.t('nico.pv_video_missing', '動画データが見つかりません（削除はされていません）')); return; }
        await this._pvSaveBlob(blob, this._pvVideoFilename(v.title, blob.type));
    },

    // 给定画布宽高、cue 内容与一个测量函数 measureFn(text, fontSizePx)=>宽度px，算出主行/译文行的字号与
    // 竖直位置。纯函数（不碰 canvas/ctx），便于 node 测试注入假测量函数
    _pvLyricCaptionLayout(canvasW, canvasH, cue, measureFn) {
        if (!cue || !cue.text) return null;
        const marginBottom = canvasH * 0.08;
        const maxWidth = canvasW * 0.9;
        const fit = (text, sizeBase) => {
            let size = sizeBase;
            if (measureFn && text) {
                let w = measureFn(text, size);
                while (w > maxWidth && size > sizeBase * 0.4) {
                    size -= 1;
                    w = measureFn(text, size);
                }
            }
            return size;
        };
        const mainSize = fit(cue.text, canvasH * 0.055);
        const hasSub = !!cue.sub;
        const subSize = hasSub ? fit(cue.sub, canvasH * 0.036) : 0;
        const gap = hasSub ? subSize * 0.3 : 0;
        const mainY = canvasH - marginBottom - (hasSub ? (subSize + gap) : 0);
        const subY = canvasH - marginBottom;
        return {
            main: { text: cue.text, size: mainSize, x: canvasW / 2, y: mainY },
            sub: hasSub ? { text: cue.sub, size: subSize, x: canvasW / 2, y: subY } : null
        };
    },

    // canvas 上实际画字：描边（纯色深色，不是渐变/发光）+ 填充白字。字体栈同一套用于主行/译文行
    _pvDrawLyricCaption(ctx, canvasW, canvasH, cue) {
        if (!cue || !cue.text) return;
        const fontFamily = '"Hiragino Sans","Noto Sans JP","PingFang SC","Microsoft YaHei",sans-serif';
        const measureFn = (text, size) => {
            ctx.font = `700 ${size}px ${fontFamily}`;
            return ctx.measureText(text).width;
        };
        const layout = this._pvLyricCaptionLayout(canvasW, canvasH, cue, measureFn);
        if (!layout) return;
        const drawLine = (line) => {
            if (!line) return;
            ctx.font = `700 ${line.size}px ${fontFamily}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';
            ctx.lineWidth = Math.max(2, line.size * 0.12);
            ctx.strokeStyle = 'rgba(0,0,0,0.85)';
            ctx.fillStyle = '#fff';
            ctx.strokeText(line.text, line.x, line.y);
            ctx.fillText(line.text, line.x, line.y);
        };
        drawLine(layout.main);
        drawLine(layout.sub);
    },

    _pvOpenExportProgress(onCancel) {
        this._pvExportCancelCb = onCancel;
        const html = `
        <div class="nico-modal-overlay nico-pv-confirm-overlay" id="nicoPvExportProgressModal">
            <div class="nico-modal nico-pv-confirm-modal">
                <div class="nico-modal-title" id="nicoPvExportProgressTitle">${I18n.t('nico.pv_export_progress_title', '正在导出…')}</div>
                <div class="nico-pv-export-progress-text" id="nicoPvExportProgressText">0%</div>
                <p class="nico-pv-hint" id="nicoPvExportProgressHint">${I18n.t('nico.pv_export_progress_hint', '导出中请保持本页面在前台')}</p>
                <div class="nico-modal-buttons nico-pv-actions" id="nicoPvExportProgressBtns">
                    <button class="glass-btn nico-modal-close" onclick="Niconico._pvCancelExport()">${I18n.t('nico.pv_btn_cancel', 'キャンセル')}</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
    },

    _pvCancelExport() {
        const cb = this._pvExportCancelCb;
        this._pvExportCancelCb = null;
        this._pvExportResult = null;
        document.getElementById('nicoPvExportProgressModal')?.remove();
        if (cb) cb();
    },

    _pvUpdateExportProgress(ratio) {
        const el = document.getElementById('nicoPvExportProgressText');
        if (!el) return;
        el.textContent = Math.max(0, Math.min(100, Math.round((ratio || 0) * 100))) + '%';
    },

    _pvCloseExportProgress() {
        this._pvExportCancelCb = null;
        this._pvExportResult = null;
        document.getElementById('nicoPvExportProgressModal')?.remove();
    },

    // 录完之后不直接保存，弹窗切到「导出完成」等用户再点一次「保存」：系统分享（navigator.share）只在用户点击的
    // 有效期内放行，而实时录制动辄几十秒，录完直接调会被浏览器拒掉、落到 <a download>——那条路在 iOS 的
    // 主屏幕 PWA 里存不进相册。多点一下换一条稳的路
    _pvShowExportDone(blob, filename) {
        this._pvExportCancelCb = null;
        this._pvExportResult = { blob, filename };
        const title = document.getElementById('nicoPvExportProgressTitle');
        const text = document.getElementById('nicoPvExportProgressText');
        const hint = document.getElementById('nicoPvExportProgressHint');
        const btns = document.getElementById('nicoPvExportProgressBtns');
        if (title) title.textContent = I18n.t('nico.pv_export_done_title', '导出完成');
        if (text) text.textContent = (blob.size / 1024 / 1024).toFixed(1) + ' MB';
        if (hint) hint.style.display = 'none';
        if (btns) {
            btns.innerHTML = `
                <button class="glass-btn nico-modal-close" onclick="Niconico._pvCloseExportProgress()">${I18n.t('nico.menu_close', '閉じる')}</button>
                <button class="glass-btn nico-pv-submit-btn" onclick="Niconico._pvSaveExportResult()">${I18n.t('nico.pv_save_btn', '保存')}</button>`;
        }
    },

    async _pvSaveExportResult() {
        const r = this._pvExportResult;
        if (!r) return;
        const outcome = await this._pvSaveBlob(r.blob, r.filename);
        if (outcome !== 'aborted') this._pvCloseExportProgress();   // 在分享面板里取消的话留着弹窗，可以再点一次
    },

    // 带字幕导出：离屏 <video> + <canvas> 逐帧描字 + MediaRecorder 实时录制。全程 Utils.withLock 防重入
    // （同一视频短时间内点两次「带字幕导出」）。任何一步不支持/抛错都清理干净、toast 提示可以保存原视频
    async _pvExportWithLyrics(videoId) {
        // AudioContext 必须在点击的同步调用栈里创建并 resume——等过了下面的 await（读 blob、等视频就绪）再建，
        // Safari 会把它留在 suspended，音轨一路都是静音
        let audioCtx = null;
        if (!Utils.isLocked('nicoPvExport')) {
            const AudioCtor = window.AudioContext || window.webkitAudioContext;
            try {
                if (AudioCtor) {
                    audioCtx = new AudioCtor();
                    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
                }
            } catch (e) { audioCtx = null; }
        }
        await Utils.withLock('nicoPvExport', async () => {
            const n = this._ensureData();
            const v = (n.videos || []).find(x => x.id === videoId);
            let videoEl = null, stream = null, recorder = null, objectUrl = null, bufSrc = null;
            let cancelled = false, keepModal = false;
            let cancelResolve;
            const cancelPromise = new Promise(resolve => { cancelResolve = resolve; });

            const cleanupAll = () => {
                try { if (recorder && recorder.state && recorder.state !== 'inactive') recorder.stop(); } catch (e) { /* noop */ }
                try { bufSrc && bufSrc.stop(); } catch (e) { /* noop */ }
                try { videoEl && videoEl.pause(); } catch (e) { /* noop */ }
                try { stream && stream.getTracks().forEach(t => t.stop()); } catch (e) { /* noop */ }
                try { audioCtx && audioCtx.close(); } catch (e) { /* noop */ }
                try { objectUrl && Utils.revokeBlobScope('nico-pv-export'); } catch (e) { /* noop */ }
                try { videoEl && videoEl.parentNode && videoEl.parentNode.removeChild(videoEl); } catch (e) { /* noop */ }
                if (!keepModal) this._pvCloseExportProgress();
            };

            try {
                if (!v || !v.videoBlobId) return;
                const cues = v.lyricCues || [];
                const srcBlob = await VideoGen.getBlob(v.videoBlobId);
                if (!srcBlob) { Utils.showToast(I18n.t('nico.pv_video_missing', '動画データが見つかりません（削除はされていません）')); return; }

                videoEl = document.createElement('video');
                videoEl.muted = true;          // 静音播放不受自动播放策略限制；音轨另走下面的 AudioBuffer，不从这个元素上接
                videoEl.playsInline = true;
                videoEl.preload = 'auto';
                videoEl.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;';
                objectUrl = Utils.trackBlobUrl(URL.createObjectURL(srcBlob), 'nico-pv-export');
                document.body.appendChild(videoEl);

                await new Promise((resolve, reject) => {
                    videoEl.onloadeddata = resolve;      // 等到首帧可画（loadedmetadata 时还画不出东西）
                    videoEl.onerror = () => reject(new Error('video load fail'));
                    videoEl.src = objectUrl;
                });

                const canvas = document.createElement('canvas');
                canvas.width = videoEl.videoWidth || 1280;
                canvas.height = videoEl.videoHeight || 720;
                const ctx = canvas.getContext('2d');
                if (!canvas.captureStream || !window.MediaRecorder) throw new Error('unsupported');

                const tracks = [...canvas.captureStream(30).getVideoTracks()];
                // 音轨：不从 <video> 元素上接——muted 的元素接进 Web Audio 也是静音，取消 muted 又会撞上自动播放策略。
                // 直接把文件解码成 AudioBuffer，和画面同时起播。无声模型的成片没有音轨，解码会失败，那就只录画面
                if (audioCtx) {
                    let audioBuffer = null;
                    try { audioBuffer = await audioCtx.decodeAudioData(await srcBlob.arrayBuffer()); } catch (e) { audioBuffer = null; }
                    if (audioBuffer) {
                        const dest = audioCtx.createMediaStreamDestination();   // 不接扬声器，导出过程本身静音
                        bufSrc = audioCtx.createBufferSource();
                        bufSrc.buffer = audioBuffer;
                        bufSrc.connect(dest);
                        tracks.push(...dest.stream.getAudioTracks());
                    }
                }
                stream = new MediaStream(tracks);

                const mimeCandidates = [
                    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
                    'video/mp4',
                    'video/webm;codecs=vp9,opus',
                    'video/webm;codecs=vp8,opus',
                    'video/webm'
                ];
                const mimeType = mimeCandidates.find(mt => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(mt));
                if (!mimeType) throw new Error('unsupported');
                recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8000000 });
                const chunks = [];
                recorder.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };
                const recordedBlobPromise = new Promise((resolve, reject) => {
                    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
                    recorder.onerror = (e) => reject((e && e.error) || new Error('recorder error'));
                });

                this._pvOpenExportProgress(() => { cancelled = true; cancelResolve(); });

                const drawFrame = () => {
                    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
                    this._pvDrawLyricCaption(ctx, canvas.width, canvas.height, this._pvFindCueAt(cues, videoEl.currentTime || 0));
                };
                const drawLoop = () => {
                    if (cancelled || !videoEl) return;
                    try { drawFrame(); } catch (e) { /* 单帧绘制失败不致命，跳过这一帧 */ }
                    this._pvUpdateExportProgress((videoEl.currentTime || 0) / (videoEl.duration || 1));
                    if (!videoEl.ended && !cancelled) {
                        if (videoEl.requestVideoFrameCallback) videoEl.requestVideoFrameCallback(drawLoop);
                        else requestAnimationFrame(drawLoop);
                    }
                };

                try { drawFrame(); } catch (e) { /* noop */ }   // 开录之前先把首帧画上，成品开头不会闪一下空画布
                recorder.start();
                if (videoEl.requestVideoFrameCallback) videoEl.requestVideoFrameCallback(drawLoop);
                else requestAnimationFrame(drawLoop);
                await videoEl.play();
                if (bufSrc) bufSrc.start(0, videoEl.currentTime || 0);

                await Promise.race([
                    new Promise((resolve, reject) => {
                        videoEl.onended = resolve;
                        videoEl.onerror = () => reject(new Error('playback error'));
                    }),
                    cancelPromise
                ]);
                if (cancelled) return;   // finally 统一清理，不保存

                try { recorder.stop(); } catch (e) { /* noop */ }
                const outBlob = await recordedBlobPromise;
                if (cancelled) return;

                const ext = /mp4/.test(mimeType) ? 'mp4' : 'webm';
                keepModal = true;
                this._pvShowExportDone(outBlob, this._pvVideoFilename(v.title, null, ext));
            } catch (e) {
                if (!cancelled) {
                    console.warn('[Niconico] export with lyrics failed', e);
                    Utils.showToast(I18n.t('nico.pv_export_unsupported', '当前浏览器不支持带字幕导出，可以保存原视频'));
                }
            } finally {
                cleanupAll();
            }
        }, () => Utils.showToast(I18n.t('nico.pv_export_busy', '正在导出，请稍候')));
    },
});
