// niconico-pv-media.js — 从 js/niconico.js 纯搬运拆出（v2.270.0）：参考图（选择器·相册临时图·出演 chips）与参考音声（选段裁剪·WAV 编码）。
// 内容零改动；加载顺序：niconico.js → pv-form → pv-media → pv-storyboard → pv-submit → pv-frames（见 index.html）。
Object.assign(Niconico, {

    // 参考図サムネ行の再描画（_pvRefImgIds が真値、選択は禁用時も保持——切回2.0系不丢）
    async _pvRenderRefThumbs() {
        const wrap = document.getElementById('nicoPvRefThumbs');
        if (!wrap) return;
        const ids = this._pvRefImgIds || [];
        if (ids.length === 0) { wrap.innerHTML = ''; return; }
        const items = await Promise.all(ids.map(async id => ({ id, url: await this._pvResolveRefUrl(id) })));
        const wrap2 = document.getElementById('nicoPvRefThumbs');   // 渲染中弹窗可能已被关闭
        if (!wrap2) return;
        wrap2.innerHTML = items.map(it => `
            <div class="nico-pv-ref-thumb" style="background-image:url('${it.url || ''}')">
                <button class="nico-pv-ref-remove" onclick="event.stopPropagation();Niconico._pvRemoveRefImg('${it.id}')" title="${I18n.t('nico.pv_ref_remove_title', '削除')}">${this._SVG.close}</button>
            </div>`).join('');
    },

    // v2.246 review（B2 泄漏修复 + C2 skip）：pvtemp_ 项从数组摘除的同时把底层 blob 一并删掉——之前只摘数组、
    // 从不清 IndexedDB，点 × 删的临时相册图会永久占地方。in-flight（_pvSubmit 正在用这个 id 提交）时只摘数组、
    // 不动 blob——那是当前请求还在读的存储，删了会让即将创建的任务指向空 blob
    _pvRemoveRefImg(id) {
        this._pvRefImgIds = (this._pvRefImgIds || []).filter(x => x !== id);
        if (typeof id === 'string' && id.startsWith('pvtemp_') && !this._pvInFlightTempIds.has(id)) {
            VideoGen.removeBlob(id).catch(e => console.warn('[Niconico] temp blob cleanup failed', e));
            delete this._pvTempUrlCache[id];
        }
        this._pvRenderRefThumbs();
        this._pvRenderCastChips();
    },

    // 参考図 URL 解決の統一入口（v2.244）：pvtemp_ 前缀は本表单自身の一時 store（アルバムから選択・_pvOnAlbumFilesChange
    // が VideoGen.store() に保存したもの）、それ以外は既存どおり IllustGallery（放送局立ち絵/Pixivイラスト）。
    // ObjectURL は Utils.trackBlobUrl で scope 登記し、表单セッション内キャッシュ（_pvTempUrlCache）で使い回す——
    // 閉じる時に revokeBlobScope('nico-pv-temp') で一括回収（工程铁律）
    async _pvResolveRefUrl(id) {
        if (typeof id === 'string' && id.startsWith('pvtemp_')) {
            if (this._pvTempUrlCache[id]) return this._pvTempUrlCache[id];
            const blob = await VideoGen.getBlob(id);
            if (!blob) return '';
            const url = Utils.trackBlobUrl(URL.createObjectURL(blob), 'nico-pv-temp');
            this._pvTempUrlCache[id] = url;
            return url;
        }
        return await IllustGallery.getUrl(id);
    },

    // 出演キャラ chips（v2.244）：立ち絵があるキャラだけ表示、クリックで _pvRefImgIds に直接足し引きする——
    // 画廊選択器の「決定」を経由しない即時確定型。状態のソースは _pvRefImgIds 一本（二重の状態管理はしない）——
    // 画廊選択器を開く時は毎回 _pvGallerySelection = _pvRefImgIds.slice() で作り直すので、チップでの選択も
    // 画廊での選択/決定も、双方が同じ配列を経由して自然に一致する
    async _pvRenderCastChips() {
        const row = document.getElementById('nicoPvCastRow');
        const wrap = document.getElementById('nicoPvCastChips');
        if (!row || !wrap) return;
        const charRefs = (typeof Broadcast !== 'undefined' && Broadcast.getAllCharRefs) ? Broadcast.getAllCharRefs() : [];
        if (charRefs.length === 0) { row.style.display = 'none'; return; }
        // getUrl が空（blob 丢失/未上传）の项目は _pvRenderGalleryGrid と同じ作法で除外
        const items = (await Promise.all(charRefs.map(async c =>
            ({ blobId: c.blobId, name: c.name, url: await IllustGallery.getUrl(c.blobId) })))).filter(x => x.url);
        const row2 = document.getElementById('nicoPvCastRow');   // await 期间弹窗可能已被关闭
        if (!row2) return;
        if (items.length === 0) { row2.style.display = 'none'; return; }
        row2.style.display = '';
        const wrap2 = document.getElementById('nicoPvCastChips');
        const ids = this._pvRefImgIds || [];
        const esc = s => Utils.escapeHtml(s || '');
        wrap2.innerHTML = items.map(it => `
            <button type="button" class="nico-pv-cast-chip ${ids.includes(it.blobId) ? 'selected' : ''}" onclick="Niconico._pvToggleCastChip('${esc(it.blobId)}')">${esc(it.name)}</button>`).join('');
    },

    _pvToggleCastChip(blobId) {
        const ids = this._pvRefImgIds || (this._pvRefImgIds = []);
        const idx = ids.indexOf(blobId);
        if (idx >= 0) {
            ids.splice(idx, 1);
        } else {
            const max = this._pvMaxRefImages();
            if (ids.length >= max) { Utils.showToast(I18n.t('nico.pv_gallery_max_hint', { n: max })); return; }
            ids.push(blobId);
        }
        this._pvRenderRefThumbs();
        this._pvRenderCastChips();
    },

    // ===== 参考画像ピッカー（放送局立ち絵 + Pixivイラストギャラリー・上限は provider 依存：v1(Hailuo)=1枚、他=9枚混選） =====
    // v2.244: 画廊が空でも「アルバムから選択」だけは使いたいケースがあるので、旧・空ゲート（両方空なら弾いて開かせない）は撤去
    async _pvOpenGalleryPicker() {
        const illusts = (AppState.data.pixivData && AppState.data.pixivData.illustrations) || [];
        const charRefs = (typeof Broadcast !== 'undefined' && Broadcast.getAllCharRefs) ? Broadcast.getAllCharRefs() : [];
        this._pvGallerySelection = (this._pvRefImgIds || []).slice();

        const html = `
        <div class="nico-modal-overlay nico-pv-gallery-overlay" id="nicoPvGalleryModal" onclick="if(event.target===this)Niconico._closeGalleryPicker()">
            <div class="nico-modal nico-pv-gallery-modal">
                <div class="nico-modal-title">${I18n.t('nico.pv_gallery_title', { n: this._pvMaxRefImages() })}</div>
                <div class="nico-pv-gallery-grid" id="nicoPvGalleryGrid"></div>
                <input type="file" id="nicoPvAlbumInput" accept="image/*" multiple style="display:none" onchange="Niconico._pvOnAlbumFilesChange(this.files); this.value='';">
                <button class="glass-btn nico-pv-ai-btn nico-pv-gallery-album-btn" onclick="document.getElementById('nicoPvAlbumInput').click()">
                    <span class="nico-pv-btn-icon">${this._SVG.image}</span>${I18n.t('nico.pv_gallery_album', 'アルバムから選択')}
                </button>
                <div class="nico-modal-buttons nico-pv-actions">
                    <button class="glass-btn nico-modal-close" onclick="Niconico._closeGalleryPicker()">${I18n.t('nico.menu_close', '閉じる')}</button>
                    <button class="glass-btn nico-pv-submit-btn" onclick="Niconico._confirmGalleryPicker()">${I18n.t('nico.pv_gallery_confirm', '決定')}</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        await this._pvRenderGalleryGrid(charRefs, illusts);
    },

    async _pvRenderGalleryGrid(charRefs, illusts) {
        const grid = document.getElementById('nicoPvGalleryGrid');
        if (!grid) return;
        // 立ち絵組：getUrl null（blob 丢失/未上传）过滤——跨设备导入后引用悬空的条目不显示
        const refItems = (await Promise.all(charRefs.map(async c =>
            ({ id: c.blobId, badge: c.name, url: await IllustGallery.getUrl(c.blobId) })))).filter(x => x.url);
        const illustItems = (await Promise.all(illusts.map(async it =>
            ({ id: it.id, badge: null, url: await IllustGallery.getUrl(it.id) })))).filter(x => x.url);
        const grid2 = document.getElementById('nicoPvGalleryGrid');
        if (!grid2) return;   // await 期间被关闭
        const esc = s => Utils.escapeHtml(s || '');
        const renderItem = (item) => {
            const selected = this._pvGallerySelection.includes(item.id);
            return `
            <div class="nico-pv-gallery-item ${selected ? 'selected' : ''}" data-illust-id="${esc(item.id)}" style="background-image:url('${item.url}')" onclick="Niconico._pvToggleGalleryItem('${esc(item.id)}')">
                ${item.badge ? `<span class="nico-pv-gallery-badge">${esc(item.badge)}</span>` : ''}
                <span class="nico-pv-gallery-check">${this._SVG.check}</span>
            </div>`;
        };
        const section = (titleHtml, items) => items.length
            ? `<div class="nico-pv-gallery-section-title">${titleHtml}</div>` + items.map(renderItem).join('')
            : '';
        grid2.innerHTML =
            section(I18n.t('nico.pv_gallery_sect_refs', '放送局の立ち絵'), refItems) +
            section(I18n.t('nico.pv_gallery_sect_pixiv', 'Pixiv イラスト'), illustItems);
    },

    _pvToggleGalleryItem(id) {
        const sel = this._pvGallerySelection;
        const idx = sel.indexOf(id);
        if (idx >= 0) {
            sel.splice(idx, 1);
        } else {
            const max = this._pvMaxRefImages();
            if (sel.length >= max) { Utils.showToast(I18n.t('nico.pv_gallery_max_hint', { n: max })); return; }
            sel.push(id);
        }
        const el = document.querySelector(`#nicoPvGalleryGrid [data-illust-id="${CSS.escape(id)}"]`);
        if (el) el.classList.toggle('selected', sel.includes(id));
    },

    // v2.246 review（A2 兜底钳制）：正常操作下 _pvToggleGalleryItem 已经卡着 max 上限，这里只是万一
    // （比如出演キャラ chips 和相册选择在同一会话里交替把 _pvGallerySelection 推过上限）的兜底裁剪
    _confirmGalleryPicker() {
        const max = this._pvMaxRefImages();
        const sel = this._pvGallerySelection || [];
        this._pvRefImgIds = sel.slice(0, max);
        if (sel.length > max) Utils.showToast(I18n.t('nico.pv_gallery_max_hint', { n: max }));
        this._closeGalleryPicker();
        this._pvRenderRefThumbs();
        this._pvRenderCastChips();
    },

    _closeGalleryPicker() {
        document.getElementById('nicoPvGalleryModal')?.remove();
    },

    // アルバムから選択（v2.244）：選んだ画像を localforage に「一時 blob」として保存し pvtemp_ 前缀の id を発行、
    // そのまま _pvRefImgIds に混ぜる（画廊の「決定」を待たず即座に確定——放送局立ち絵/Pixivイラストの選択とは別経路。
    // _pvGallerySelection にも同じ id を足しておく——後で「決定」を押されても上書きで消えないようにするため）。
    // 保存先は VideoGen.store()（refaud- と同じ localforage インスタンス、並列で新しい store を建てる必要はない）
    async _pvOnAlbumFilesChange(fileList) {
        const files = Array.from(fileList || []);
        if (files.length === 0) return;
        const max = this._pvMaxRefImages();
        let added = 0, skipped = 0;
        for (const file of files) {
            // v2.246 review（A2）：上限检查同时看 _pvRefImgIds 和 _pvGallerySelection——两者在画廊会话里可能
            // 暂时不同步（比如出演キャラ chip 直接改了 _pvRefImgIds、画廊还没「決定」回写），单看一个会漏判
            if (Math.max((this._pvRefImgIds || []).length, (this._pvGallerySelection || []).length) >= max) { skipped++; continue; }
            const id = 'pvtemp_' + Utils.generateId();
            try {
                await VideoGen.saveBlob(id, file);
            } catch (e) {
                console.error('[Niconico] album temp blob save failed', e);
                continue;
            }
            // v2.246 review（C4）：saveBlob 这个 await 期间表单可能已被关闭——关窗清理（_pvCleanupTempRefImgs）
            // 只扫这轮 saveBlob 之前就已经在 _pvRefImgIds 里的项，这里刚存的 blob 还没 push 进数组，不会被它扫到，
            // 需要自己查一次、发现表单没了就地删掉刚存的 blob 并停止后续文件（不再 push、不再渲染）
            if (!document.getElementById('nicoPvModal')) {
                await VideoGen.removeBlob(id).catch(e => console.warn('[Niconico] orphan temp blob cleanup failed', e));
                break;
            }
            this._pvRefImgIds = this._pvRefImgIds || [];
            this._pvRefImgIds.push(id);
            this._pvGallerySelection = this._pvGallerySelection || [];
            if (!this._pvGallerySelection.includes(id)) this._pvGallerySelection.push(id);
            added++;
        }
        if (skipped > 0) Utils.showToast(I18n.t('nico.pv_gallery_max_hint', { n: max }));
        if (added > 0) {
            await this._pvRenderRefThumbs();
            this._pvRenderCastChips();
        }
    },

    // 表单关闭且未提交时的临时图清理（v2.244）：只清 _pvRefImgIds 里还挂着的 pvtemp_ 项——已提交成功的路径
    // 在调用 _closePVModal 前会先把 _pvRefImgIds 清空，不会走到这里误删任务自己还需要留着重试用的 blob。
    // v2.246 review（C2）：额外跳过 _pvInFlightTempIds——_pvSubmit 的 createTask 请求还在飞（最长 5 分钟窗口，
    // 见 video-gen.js _providerFetch 注释）期间用户把表单关了，这里不能抢着删掉请求已经读进去、成功后任务
    // 对象还要引用的 blob；_pvSubmit 自己的 finally 会在请求settle 后按"有没有任务接手"做真正的孤儿清理
    _pvCleanupTempRefImgs() {
        const ids = (this._pvRefImgIds || []).filter(id => typeof id === 'string' && id.startsWith('pvtemp_') && !this._pvInFlightTempIds.has(id));
        ids.forEach(id => VideoGen.removeBlob(id).catch(() => {}));
    },

    // ═══════════════════════════════════════════════════════════
    // 参考音声（v2.241）：選択 → decodeAudioData 検査 → モデル上限超は選段弾窗でトリム
    // 上限は _pvRefAudioMaxSec() に一本化（v2.267：2.5 系 30s / それ以外 15s）
    // ═══════════════════════════════════════════════════════════

    // ファイル選択ハンドラ。処理順は仕様通り「①デコードして実時長を取る（失敗→フォーマット非対応）
    // ②ファイルサイズ>15MB→拒否 ③時長<=上限→原ファイルそのまま採用 ④時長>上限→選段弾窗」
    // 上限秒数はファイル選択時点で選ばれているモデルで決まる（後からモデルを切り替えて超過した場合は
    // ハード制限をかけず API のエラーをそのまま見せる——時長セレクトと同じ方針）
    async _pvOnRefAudioFileChange(file) {
        if (!file) return;
        // サイズ検査はデコードより先（15MB 級ファイルの decodeAudioData は数秒+メモリを食う——拒否確定なら解かない）
        if (file.size > 15 * 1024 * 1024) {
            Utils.showToast(I18n.t('nico.pv_ref_audio_err_size', { size: (file.size / 1024 / 1024).toFixed(1) }));
            return;
        }
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) {
            Utils.showToast(I18n.t('nico.pv_ref_audio_err_format', 'この音声フォーマットを読み込めません。mp3かwavをご利用ください'));
            return;
        }
        if (!this._pvDecodeCtx) this._pvDecodeCtx = new Ctor();   // 懒建単例、セッション中使い回す（play() する試聴と共用）

        let audioBuffer;
        try {
            const arrayBuffer = await file.arrayBuffer();
            audioBuffer = await this._pvDecodeCtx.decodeAudioData(arrayBuffer);
        } catch (e) {
            Utils.showToast(I18n.t('nico.pv_ref_audio_err_format', 'この音声フォーマットを読み込めません。mp3かwavをご利用ください'));
            return;
        }

        const duration = audioBuffer.duration;
        const maxSec = this._pvRefAudioMaxSec();
        if (duration <= maxSec) {
            this._pvRefAudio = { blob: file, name: file.name, duration, url: null };   // 原ファイル Blob 直採用（原エンコード音質を保つ）
            await this._pvRenderRefAudio();
            // 歌词字幕（六期 P2）：直接采用整首＝偏移 0（见 niconico-pv-lyrics.js の _pvOnRefAudioOffsetChanged）
            if (this._pvOnRefAudioOffsetChanged) this._pvOnRefAudioOffsetChanged(0);
        } else {
            this._pvOpenTrimModal(audioBuffer, duration, file.name, maxSec);
        }
    },

    // 参考音声の上限秒数（v2.267）：公式ドキュメント（ModelArk「Create a video generation task」）の値——
    // Seedance 2.5 系は単条 2〜30s・合計 30s、2.0 系は単条 2〜15s・合計 15s。minimax 系は未検証のため
    // 従来の 15s のまま。2.5 判定は _pvOnModelChange と同じ id 部分一致（拉取した新 id も拾う）
    _pvRefAudioMaxSec() {
        const modelSel = document.getElementById('nicoPvModel');
        return (modelSel && /seedance-2-5/.test(modelSel.value)) ? 30 : 15;
    },

    // 参考音声フィールドの表示更新：未選択時は空、選択済みならファイル名+時長+試聴/削除ボタン
    async _pvRenderRefAudio() {
        const info = document.getElementById('nicoPvRefAudioInfo');
        if (!info) return;
        const ra = this._pvRefAudio;
        if (!ra) { info.style.display = 'none'; info.innerHTML = ''; return; }
        // 試聴用 ObjectURL は初回描画時に一度だけ生成してキャッシュ（Utils.trackBlobUrl 登記、
        // フォーム閉じる時に revokeBlobScope('nico-pv-refaudio') で一括回収——工程铁律）
        if (!ra.url) ra.url = Utils.trackBlobUrl(URL.createObjectURL(ra.blob), 'nico-pv-refaudio');
        const durText = I18n.t('nico.pv_duration_unit', { n: ra.duration.toFixed(1) });
        info.style.display = 'flex';
        info.innerHTML = `
            <span class="nico-pv-refaudio-name">${I18n.t('nico.pv_ref_audio_info_format', { name: this._escHtml(ra.name), duration: durText })}</span>
            <button class="nico-pv-icon-btn" id="nicoPvRefAudioPreviewBtn" onclick="Niconico._pvToggleRefAudioPreview()" title="${I18n.t('nico.pv_ref_audio_preview_title', '試聴')}">
                <span id="nicoPvRefAudioPreviewIcon">${this._SVG.play}</span>
            </button>
            <button class="nico-pv-icon-btn" onclick="Niconico._pvRemoveRefAudio()" title="${I18n.t('nico.pv_ref_remove_title', '削除')}">${this._SVG.close}</button>
        `;
    },

    _pvRemoveRefAudio() {
        this._pvStopAllAudioPreviews();
        this._pvRefAudio = null;
        this._pvRenderRefAudio();
        // 歌词字幕（六期 P2）：移除参考音声＝偏移归零、清警告 hint（见 niconico-pv-lyrics.js）
        if (this._pvOnRefAudioOffsetChanged) this._pvOnRefAudioOffsetChanged(0);
    },

    // 表単主区の試聴トグル（既に選ばれている _pvRefAudio.blob をそのまま再生。上限秒数以内保証済みなので
    // 自動停止タイマーは不要——最後まで鳴らせば ended イベントで自然に止まる）
    async _pvToggleRefAudioPreview() {
        const ra = this._pvRefAudio;
        if (!ra) return;
        if (this._pvAudioPreviewEl && !this._pvAudioPreviewEl.paused) {
            this._pvAudioPreviewEl.pause();   // 'pause' リスナーがボタン状態を戻す
            return;
        }
        this._pvStopTrimPreview();   // 互斥防御（通常は選段弾窗と同時に見えないが念のため）
        if (!ra.url) ra.url = Utils.trackBlobUrl(URL.createObjectURL(ra.blob), 'nico-pv-refaudio');
        if (!this._pvAudioPreviewEl) {
            this._pvAudioPreviewEl = new Audio();
            if (window.AudioCoordinator) AudioCoordinator.register(this._pvAudioPreviewEl);   // widget/TTS/LINE voice と同じ互斥に参加
            this._pvAudioPreviewEl.addEventListener('play', () => this._pvSetPreviewBtnState('nicoPvRefAudioPreview', true));
            this._pvAudioPreviewEl.addEventListener('pause', () => this._pvSetPreviewBtnState('nicoPvRefAudioPreview', false));
            this._pvAudioPreviewEl.addEventListener('ended', () => this._pvSetPreviewBtnState('nicoPvRefAudioPreview', false));
        }
        this._pvAudioPreviewEl.src = ra.url;
        try { await this._pvAudioPreviewEl.play(); } catch (e) { console.warn('[Niconico] ref audio preview failed', e); }
    },

    _pvStopAudioPreview() {
        if (this._pvAudioPreviewEl && !this._pvAudioPreviewEl.paused) {
            try { this._pvAudioPreviewEl.pause(); } catch (e) { }
        }
    },

    // 選段弾窗のプレビュー停止：先に参照を null に落としてから stop() する（stop() が非同期に発火させる
    // onended コールバック内の自己参照チェックと組み合わせて、新しい再生が始まった後に古い onended が
    // 誤ってボタン状態を「停止」に巻き戻すレースを防ぐ）
    _pvStopTrimPreview() {
        const src = this._pvTrimPreviewSource;
        if (!src) return;
        this._pvTrimPreviewSource = null;
        try { src.stop(); } catch (e) { }
        this._pvSetPreviewBtnState('nicoPvTrimPreview', false);
    },

    _pvStopAllAudioPreviews() {
        this._pvStopAudioPreview();
        this._pvStopTrimPreview();
    },

    // 試聴ボタンの見た目（アイコン + title、選段弾窗のボタンはラベルテキストも）を再生/停止で切替
    // idPrefix: 'nicoPvRefAudioPreview'（表単主区・アイコンのみ） | 'nicoPvTrimPreview'（選段弾窗・アイコン+ラベル）
    _pvSetPreviewBtnState(idPrefix, playing) {
        const btn = document.getElementById(idPrefix + 'Btn');
        const icon = document.getElementById(idPrefix + 'Icon');
        const label = document.getElementById(idPrefix + 'Label');
        const title = playing ? I18n.t('nico.pv_ref_audio_stop_title', '停止') : I18n.t('nico.pv_ref_audio_preview_title', '試聴');
        if (btn) btn.title = title;
        if (icon) icon.innerHTML = playing ? this._SVG.stop : this._SVG.play;
        if (label) label.textContent = title;
    },

    // ===== 選段弾窗（上限超の音声から範囲選択・OfflineAudioContext でトリム→WAV 再エンコード） =====
    // 窓幅 maxSec は開く側（_pvOnRefAudioFileChange）が渡す——弾窗が開いている間にモデルが変わっても幅は固定

    _pvOpenTrimModal(audioBuffer, duration, fileName, maxSec = 15) {
        this._pvTrimCtx = { audioBuffer, duration, fileName, start: 0, maxSec };
        const maxStart = Math.max(0, duration - maxSec);
        const html = `
        <div class="nico-modal-overlay nico-pv-trim-overlay" id="nicoPvTrimModal" onclick="if(event.target===this)Niconico._closeTrimModal()">
            <div class="nico-modal nico-pv-trim-modal">
                <div class="nico-modal-title">${I18n.t('nico.pv_trim_title', { n: maxSec })}</div>
                <div class="nico-pv-trim-range" id="nicoPvTrimRange">${this._pvTrimRangeText()}</div>
                <input type="range" id="nicoPvTrimSlider" class="nico-pv-trim-slider"
                    min="0" max="${maxStart}" step="0.5" value="0"
                    oninput="Niconico._pvOnTrimSliderInput(this.value)">
                <button class="glass-btn nico-pv-ai-btn nico-pv-trim-preview" id="nicoPvTrimPreviewBtn" onclick="Niconico._pvToggleTrimPreview()" title="${I18n.t('nico.pv_ref_audio_preview_title', '試聴')}">
                    <span class="nico-pv-btn-icon" id="nicoPvTrimPreviewIcon">${this._SVG.play}</span><span id="nicoPvTrimPreviewLabel">${I18n.t('nico.pv_ref_audio_preview_title', '試聴')}</span>
                </button>
                <div class="nico-modal-buttons nico-pv-actions">
                    <button class="glass-btn nico-modal-close" onclick="Niconico._closeTrimModal()">${I18n.t('nico.pv_btn_cancel', 'キャンセル')}</button>
                    <button class="glass-btn nico-pv-submit-btn" onclick="Niconico._pvConfirmTrim()">${I18n.t('nico.pv_gallery_confirm', '決定')}</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
    },

    _pvTrimRangeText() {
        const ctx = this._pvTrimCtx;
        if (!ctx) return '';
        const start = ctx.start;
        const end = Math.min(ctx.duration, start + ctx.maxSec);
        return I18n.t('nico.pv_trim_range_format', { start: start.toFixed(1), end: end.toFixed(1) });
    },

    _pvOnTrimSliderInput(val) {
        if (!this._pvTrimCtx) return;
        this._pvTrimCtx.start = parseFloat(val) || 0;
        const el = document.getElementById('nicoPvTrimRange');
        if (el) el.textContent = this._pvTrimRangeText();
        this._pvStopTrimPreview();   // ドラッグ中に鳴ってた分は捨てる（古い位置のまま鳴り続けると紛らわしい）
    },

    // 選段弾窗の試聴：Blob化せず AudioBufferSourceNode で直接 [start, start+maxSec) を再生
    // （デコード済み AudioBuffer がメモリ上にあるのでこれが一番シンプル。start(when, offset, duration)
    // が自動的に指定秒数で止めてくれるので手動タイマー不要）
    async _pvToggleTrimPreview() {
        if (this._pvTrimPreviewSource) {
            this._pvStopTrimPreview();
            return;
        }
        const ctx = this._pvTrimCtx;
        const audioCtx = this._pvDecodeCtx;
        if (!ctx || !audioCtx) return;
        this._pvStopAudioPreview();   // 互斥防御
        if (audioCtx.state === 'suspended') { try { await audioCtx.resume(); } catch (e) { } }

        const src = audioCtx.createBufferSource();
        src.buffer = ctx.audioBuffer;
        src.connect(audioCtx.destination);
        const playLen = Math.min(ctx.maxSec, ctx.duration - ctx.start);
        src.onended = () => {
            // 自己参照チェック：_pvStopTrimPreview が already null 化してから stop() した場合や、
            // 新しい再生が既に始まっている場合はこの古いコールバックを無視（レース防止、上のコメント参照）
            if (this._pvTrimPreviewSource === src) {
                this._pvTrimPreviewSource = null;
                this._pvSetPreviewBtnState('nicoPvTrimPreview', false);
            }
        };
        src.start(0, ctx.start, playLen);
        this._pvTrimPreviewSource = src;
        this._pvSetPreviewBtnState('nicoPvTrimPreview', true);
    },

    async _pvConfirmTrim() {
        const ctx = this._pvTrimCtx;
        if (!ctx) return;
        this._pvStopAllAudioPreviews();
        const start = ctx.start;
        const dur = Math.min(ctx.maxSec, ctx.duration - start);
        try {
            const blob = await this._pvRenderTrimWav(ctx.audioBuffer, start, dur);
            this._pvRefAudio = { blob, name: ctx.fileName, duration: dur, url: null };
            this._closeTrimModal();
            await this._pvRenderRefAudio();
            // 歌词字幕（六期 P2）：选段起点即歌词偏移的初始值，重新选段会覆盖成新起点（见 niconico-pv-lyrics.js）
            if (this._pvOnRefAudioOffsetChanged) this._pvOnRefAudioOffsetChanged(start);
        } catch (e) {
            console.error('[Niconico] trim render failed', e);
            Utils.showToast(String((e && e.message) || e));
        }
    },

    _closeTrimModal() {
        this._pvStopAllAudioPreviews();
        this._pvTrimCtx = null;
        document.getElementById('nicoPvTrimModal')?.remove();
    },

    // OfflineAudioContext で [startSec, startSec+durSec) を原サンプリングレート/チャンネル数のまま
    // レンダリング → 16bit PCM WAV にエンコード（再生も投稿もこの WAV を使う——編码后の音質はここで確定）
    async _pvRenderTrimWav(audioBuffer, startSec, durSec) {
        const sr = audioBuffer.sampleRate;
        const channels = audioBuffer.numberOfChannels;
        const frameCount = Math.max(1, Math.round(durSec * sr));
        const OfflineCtor = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        const offlineCtx = new OfflineCtor(channels, frameCount, sr);
        const src = offlineCtx.createBufferSource();
        src.buffer = audioBuffer;
        src.connect(offlineCtx.destination);
        src.start(0, startSec, durSec);
        const rendered = await offlineCtx.startRendering();
        return this._encodeWav(rendered);
    },

    // 手写 WAV エンコーダ（RIFF ヘッダ + interleaved 16bit PCM）。依存ゼロ、~35行。
    _encodeWav(audioBuffer) {
        const numCh = audioBuffer.numberOfChannels;
        const sr = audioBuffer.sampleRate;
        const numFrames = audioBuffer.length;
        const blockAlign = numCh * 2;   // 2 bytes/sample（16bit）
        const dataSize = numFrames * blockAlign;
        const buffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(buffer);
        const writeStr = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };

        writeStr(0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        writeStr(8, 'WAVE');
        writeStr(12, 'fmt ');
        view.setUint32(16, 16, true);              // fmt チャンクサイズ（PCM=16）
        view.setUint16(20, 1, true);                // audioFormat = 1（PCM）
        view.setUint16(22, numCh, true);
        view.setUint32(24, sr, true);
        view.setUint32(28, sr * blockAlign, true);  // byteRate
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, 16, true);               // bitsPerSample
        writeStr(36, 'data');
        view.setUint32(40, dataSize, true);

        const channelData = [];
        for (let c = 0; c < numCh; c++) channelData.push(audioBuffer.getChannelData(c));
        let offset = 44;
        for (let i = 0; i < numFrames; i++) {
            for (let c = 0; c < numCh; c++) {
                const s = Math.max(-1, Math.min(1, channelData[c][i]));
                view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
                offset += 2;
            }
        }
        return new Blob([buffer], { type: 'audio/wav' });
    },
});
