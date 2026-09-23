// niconico-pv-form.js — 从 js/niconico.js 纯搬运拆出（v2.270.0）：表单状态与模型联动（状态字段·菜单入口·showPVModal·_pvOnModelChange）。
// 内容零改动；加载顺序：niconico.js → pv-form → pv-media → pv-storyboard → pv-submit → pv-frames（见 index.html）。
Object.assign(Niconico, {

    // ===== PV投稿（Seedance動画生成） =====
    _pvRefImgIds: [],        // 本次投稿表单里已选的参考图 id（会话级、非持久）——放送局立ち絵/Pixivイラストの id の他、
                              // pvtemp_ 前缀（v2.244・アルバムから直接選択した一時画像）も同じ配列に混在する
    _pvGallerySelection: [], // 画廊选择器内的临时选择（点「決定」才回写 _pvRefImgIds）
    _pvTempUrlCache: {},     // pvtemp_ id → ObjectURL（表单会话级キャッシュ、showPVModal で毎回リセット）
    _pvConfirmNoRefResolve: null,   // 软闸确认弹窗（参考図なし/図N不整合共用）の resolve（開いている間だけ非 null）
    // v2.246 review（C2）：_pvSubmit 正在提交中的 pvtemp_ id 集合。表单关闭清理（_pvCleanupTempRefImgs）/
    // 缩略图 × 删除（_pvRemoveRefImg）在此期间都要跳过这些 id——防止「请求已经把 blob 读进去了，
    // 但存储层的 blob 被并发清理删掉」这种竞态（成功后任务对象还引用着这个 id，届时会指向一个空 blob）
    _pvInFlightTempIds: new Set(),

    // ===== 参考音声（v2.241） =====
    _pvRefAudio: null,       // 本次投稿表单里已选的参考音频（会话级、非持久）：{blob, name, duration, url?} | null
    _pvAudioPreviewEl: null, // 表单主区试听用 <audio>（懒建单例、整个会话复用；跟 AudioCoordinator 互斥其它音频）
    _pvDecodeCtx: null,      // decodeAudioData / トリムプレビュー用の AudioContext（懒建単例、セッション中使い回す）
    _pvTrimCtx: null,        // 選段弾窗の会话态：{ audioBuffer, duration, fileName, start } | null（開く時に建て、閉じる/決定で clear）
    _pvTrimPreviewSource: null, // 選段弾窗のプレビュー再生中の AudioBufferSourceNode | null

    // 生成メニュー「PV投稿」项：未配置 videoApiConfig 时不开表单、引导去设置
    _pvMenuEntry() {
        this.closeGenerateModal();
        const cfg = (typeof VideoGen !== 'undefined') ? VideoGen.config() : {};
        if (!cfg.workerUrl || !cfg.key) {
            Utils.showToast(I18n.t('nico.pv_need_config', 'まず設定で動画生成APIを設定してください'));
            Navigation.goTo('settings-api');
            setTimeout(() => {
                document.getElementById('videoApiSettingsCard')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 200);
            return;
        }
        this.showPVModal();
    },

    _pvModelInfo(id) {
        const models = (typeof VideoGen !== 'undefined' && VideoGen.models) ? VideoGen.models() : [];
        return models.find(m => m.id === id) || models[0] || { id: '', ref: false, audio: false };
    },

    // 台词语言是耐久偏好（照 lastPvChannelId 的姿势存 n 上）——与会话级的演出タイプ/ムード不同，开窗不重置
    _pvOnDialogueLangChange() {
        const v = document.getElementById('nicoPvDialogueLang')?.value || 'ja';
        this._ensureData().pvDialogueLang = v;
        Utils.saveData();
    },

    // 画风锚（PV六期）也是耐久偏好，姿势同上。注意：'' (不指定) 是合法值——不能用 `|| 'cel'` 兜底，
    // 否则用户选「不指定」的意图会在这里被静默改回 cel
    _pvOnArtStyleChange() {
        const el = document.getElementById('nicoPvArtStyle');
        this._ensureData().pvArtStyle = el ? el.value : 'cel';
        Utils.saveData();
    },

    // 读取当前画风锚 key：优先读表单实时值（'' 合法，不兜底）；DOM 缺失（表单未开）时才回落到持久化值，默认 'cel'
    _pvGetArtStyleKey() {
        const el = document.getElementById('nicoPvArtStyle');
        if (el) return el.value;
        const v = this._ensureData().pvArtStyle;
        return (v != null) ? v : 'cel';
    },

    // min/max/selected 可覆写——1.0 系模型只支持 [4,12]s，其他系列 [4,15]s（_pvOnModelChange 按系列重建时传入）
    _pvDurationOptionsHtml(min = 4, max = 15, selected = 10) {
        let html = '';
        for (let s = min; s <= max; s++) {
            html += `<option value="${s}" ${s === selected ? 'selected' : ''}>${I18n.t('nico.pv_duration_unit', { n: s })}</option>`;
        }
        return html;
    },

    // 离散档位专用（v1/Hailuo 只有 6/10 两档，不是连续区间——直接传 min=6/max=10 给上面的连续 helper
    // 会渲染出 7/8/9 三个非法档）。复用同一份 <option> 渲染片段，values 传啥就渲染啥
    _pvDurationOptionsHtmlDiscrete(values, selected) {
        return values.map(s => `<option value="${s}" ${s === selected ? 'selected' : ''}>${I18n.t('nico.pv_duration_unit', { n: s })}</option>`).join('');
    },

    // 参考図の同時選択上限（六期 P1，2026-09-18 拡張）：v1(Hailuo)だけ1枚（語義は"動画の最初のフレーム"）、
    // Seedance 2.5 系（分镜图を含めた合計）は50枚に開放、それ以外は既存の9枚のまま。
    // 画廊選択器の上限強制 + タイトル/トースト文言（{n} 補間）に使う。modelId 省略時は現在の #nicoPvModel
    // の選択値を読む（showPVModal の初回描画時は DOM がまだ無いので modelId を明示的に渡す）
    _pvMaxRefImages(modelId) {
        if (VideoGen.config().provider === 'minimax_v1') return 1;
        const id = modelId || (document.getElementById('nicoPvModel')?.value) || '';
        const model = this._pvModelInfo(id);
        return /seedance-2-5/.test(model.id) ? 50 : 9;
    },

    showPVModal() {
        const n = this._ensureData();
        this._pvRefImgIds = [];
        this._pvGallerySelection = [];
        this._pvRefAudio = null;   // 重开表单清空（会话级、非持久——照 _pvRefImgIds 的姿势）
        this._pvTrimCtx = null;
        this._pvTempUrlCache = {};
        if (this._pvClearFrames) this._pvClearFrames();   // 分镜图（六期 P1）：同上，重开表单清空并删掉遗留 blob

        const cfg = VideoGen.config();
        const models = VideoGen.models();
        const defaultModel = models.some(m => m.id === cfg.model) ? cfg.model : ((models[0] && models[0].id) || '');

        const channels = n.channels || [];
        const hasChannels = channels.length > 0;
        const lastChId = n.lastPvChannelId;
        const channelOptionsHtml = hasChannels
            ? channels.map(c => `<option value="${c.id}" ${c.id === lastChId ? 'selected' : ''}>${this._escHtml(c.name)}</option>`).join('')
            : `<option value="">${I18n.t('nico.pv_channel_empty_option', 'チャンネルがありません')}</option>`;

        const officialNpcs = ((AppState.data.broadcast && AppState.data.broadcast.officialNpcs) || [])
            .filter(np => typeof Forum !== 'undefined' && Forum._isOfficialTwitterRole(np.role));
        const tweetOptions = [];
        if (officialNpcs.length > 0) {
            officialNpcs.forEach(np => {
                const label = np.handle ? ('@' + np.handle) : (np.name || np.role);
                tweetOptions.push(`<option value="${np.id}">${this._escHtml(label)}</option>`);
            });
        } else {
            tweetOptions.push(`<option value="AUTO_CREATE">${I18n.t('nico.pv_tweet_auto_create', '公式アカウントを自動作成')}</option>`);
        }
        tweetOptions.push(`<option value="">${I18n.t('nico.pv_tweet_none', 'ツイートしない')}</option>`);

        const modelOptionsHtml = models.map(m => `<option value="${m.id}" ${m.id === defaultModel ? 'selected' : ''}>${this._escHtml(m.label)}</option>`).join('');

        // 時長初期テンプレート：provider ごとに正しい既定値を選んで selected を打っておかないと、直後に走る
        // _pvOnModelChange の「範囲内なら現在値を保つ」ロジックがこのテンプレート値をユーザー選択と誤認して
        // 保持してしまい、minimax/v1 の既定値（6）が落ちない（旧バグ：固定10だった）
        const durationProvider = cfg.provider || 'ark';
        const durationOptionsHtml = durationProvider === 'minimax_v1'
            ? this._pvDurationOptionsHtmlDiscrete([6, 10], 6)
            : this._pvDurationOptionsHtml(4, 15, durationProvider === 'minimax' ? 6 : 10);

        const html = `
        <div class="nico-modal-overlay" id="nicoPvModal" onclick="if(event.target===this)Niconico._closePVModal()">
            <div class="nico-modal nico-pv-modal">
                <div class="nico-modal-title">${I18n.t('nico.pv_modal_title', 'PV投稿（動画生成）')}</div>
                <div class="nico-pv-body">
                    <div class="nico-pv-field">
                        <label class="nico-pv-label">${I18n.t('nico.pv_prompt_label', 'PVスクリプト')}</label>
                        <textarea id="nicoPvPrompt" class="nico-pv-textarea" rows="5" placeholder="${I18n.t('nico.pv_prompt_placeholder', 'カット割り・セリフ・雰囲気を書く（「」内のセリフが読み上げられます）')}" oninput="if(Niconico._pvUpdateFramesBtnState)Niconico._pvUpdateFramesBtnState()"></textarea>

                        <!-- 演出スタイル二軸（v2.243）：セッション限定・非持久——モーダル再構築のたび自然に「指定なし」に戻る -->
                        <div class="nico-pv-row">
                            <div class="nico-pv-field nico-pv-field-half">
                                <label class="nico-pv-label">${I18n.t('nico.pv_style_type_label', '演出タイプ')}</label>
                                <select id="nicoPvStyleType" class="nico-pv-select" onchange="Niconico._pvUpdateAudioLyricsVisibility()">
                                    <option value="">${I18n.t('nico.pv_style_none', '指定なし')}</option>
                                    <option value="op">${I18n.t('nico.pv_style_type_op', 'OP')}</option>
                                    <option value="ed">${I18n.t('nico.pv_style_type_ed', 'ED')}</option>
                                    <option value="insert">${I18n.t('nico.pv_style_type_insert', '挿入歌')}</option>
                                    <option value="yokoku">${I18n.t('nico.pv_style_type_yokoku', '次回予告')}</option>
                                    <option value="highlight">${I18n.t('nico.pv_style_type_highlight', '今期ハイライト')}</option>
                                    <option value="battle">${I18n.t('nico.pv_style_type_battle', 'バトル')}</option>
                                    <option value="mv">${I18n.t('nico.pv_style_type_mv', 'MV')}</option>
                                </select>
                            </div>
                            <div class="nico-pv-field nico-pv-field-half">
                                <label class="nico-pv-label">${I18n.t('nico.pv_style_mood_label', 'ムード')}</label>
                                <select id="nicoPvStyleMood" class="nico-pv-select">
                                    <option value="">${I18n.t('nico.pv_style_none', '指定なし')}</option>
                                    <option value="iyashi">${I18n.t('nico.pv_style_mood_iyashi', '癒し')}</option>
                                    <option value="setsunai">${I18n.t('nico.pv_style_mood_setsunai', '切ない')}</option>
                                    <option value="moeru">${I18n.t('nico.pv_style_mood_moeru', '燃え')}</option>
                                    <option value="kibou">${I18n.t('nico.pv_style_mood_kibou', '希望')}</option>
                                    <option value="shukufuku">${I18n.t('nico.pv_style_mood_shukufuku', '祝福')}</option>
                                </select>
                            </div>
                        </div>

                        <!-- 台词·旁白语言（2026-08-23）：耐久偏好，照 lastPvChannelId 的姿势存 n 上，开窗不重置 -->
                        <div class="nico-pv-field">
                            <label class="nico-pv-label">${I18n.t('nico.pv_dialogue_lang_label', 'セリフ・ナレーションの言語')}</label>
                            <select id="nicoPvDialogueLang" class="nico-pv-select" onchange="Niconico._pvOnDialogueLangChange()">
                                <option value="ja" ${(n.pvDialogueLang || 'ja') === 'ja' ? 'selected' : ''}>日本語</option>
                                <option value="zh" ${(n.pvDialogueLang || 'ja') === 'zh' ? 'selected' : ''}>中文</option>
                                <option value="en" ${(n.pvDialogueLang || 'ja') === 'en' ? 'selected' : ''}>English</option>
                            </select>
                        </div>

                        <!-- 画风锚（PV六期，2026-09-18）：耐久偏好，照 pvDialogueLang 的姿势存 n 上，开窗不重置 -->
                        <div class="nico-pv-field">
                            <label class="nico-pv-label">${I18n.t('nico.pv_art_style_label', '画風')}</label>
                            <select id="nicoPvArtStyle" class="nico-pv-select" onchange="Niconico._pvOnArtStyleChange()">
                                <option value="cel" ${(n.pvArtStyle != null ? n.pvArtStyle : 'cel') === 'cel' ? 'selected' : ''}>${I18n.t('nico.pv_art_style_cel', 'アニメ原画・セル塗り2D')}</option>
                                <option value="flat" ${(n.pvArtStyle != null ? n.pvArtStyle : 'cel') === 'flat' ? 'selected' : ''}>${I18n.t('nico.pv_art_style_flat', 'フラットイラスト')}</option>
                                <option value="painterly" ${(n.pvArtStyle != null ? n.pvArtStyle : 'cel') === 'painterly' ? 'selected' : ''}>${I18n.t('nico.pv_art_style_painterly', '厚塗り・水彩')}</option>
                                <option value="realistic" ${(n.pvArtStyle != null ? n.pvArtStyle : 'cel') === 'realistic' ? 'selected' : ''}>${I18n.t('nico.pv_art_style_realistic', '実写・3D CG')}</option>
                                <option value="" ${(n.pvArtStyle != null ? n.pvArtStyle : 'cel') === '' ? 'selected' : ''}>${I18n.t('nico.pv_style_none', '指定なし')}</option>
                            </select>
                        </div>

                        <!-- AIにおまかせ：クリックでまず内联浮层（そのまま生成／推敲つき生成）を出す。既存の npc-role-dropdown と同じ
                             姿勢（position:relative の wrap + 外部クリックで閉じる） -->
                        <div class="nico-pv-ai-wrap" id="nicoPvAiWrap">
                            <button class="glass-btn nico-pv-ai-btn" id="nicoPvAiWriteBtn" onclick="Niconico._pvAiWriteToggleMenu(event)">
                                <span class="nico-pv-btn-icon">${this._SVG.sparkle}</span><span id="nicoPvAiWriteLabel">${I18n.t('nico.pv_ai_write_btn', 'AIにおまかせ')}</span>
                            </button>
                            <div class="nico-pv-ai-menu" id="nicoPvAiMenu" style="display:none;">
                                <button type="button" class="nico-pv-ai-menu-opt" onclick="Niconico._pvAiWriteChoose(false)">${I18n.t('nico.pv_ai_direct', 'そのまま生成')}</button>
                                <button type="button" class="nico-pv-ai-menu-opt" onclick="Niconico._pvAiWriteChoose(true)">
                                    <span>${I18n.t('nico.pv_ai_polish', '推敲つき生成')}</span>
                                    <span class="nico-pv-ai-menu-opt-hint">${I18n.t('nico.pv_ai_polish_hint', 'AIチェックを1回追加')}</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- 出演キャラ chips（v2.244）：立ち絵があるキャラだけ表示、クリックで _pvRefImgIds に直接足し引きする。
                         状態のソースは _pvRefImgIds 一本——画廊選択器で同じ立ち絵を選択/解除した時もこのチップは自然に一致する -->
                    <div class="nico-pv-field nico-pv-cast-wrap" id="nicoPvCastRow" style="display:none;">
                        <label class="nico-pv-label">${I18n.t('nico.pv_cast_label', '出演キャラ')}</label>
                        <div class="nico-pv-cast-chips" id="nicoPvCastChips"></div>
                    </div>

                    <div class="nico-pv-field">
                        <label class="nico-pv-label" id="nicoPvRefLabel">${I18n.t('nico.pv_ref_label', '参考画像（0〜9枚）')}</label>
                        <div class="nico-pv-ref-row" id="nicoPvRefRow">
                            <div class="nico-pv-ref-thumbs" id="nicoPvRefThumbs"></div>
                            <button class="nico-pv-ref-add" id="nicoPvRefAddBtn" onclick="Niconico._pvOpenGalleryPicker()" title="${I18n.t('nico.pv_ref_add_title', '画像を追加')}">${this._SVG.plus}</button>
                        </div>
                        <p class="nico-pv-hint" id="nicoPvRefHint" style="display:none;">${I18n.t('nico.pv_ref_disabled_hint', 'このモデルは参考画像に対応していません')}</p>
                    </div>

                    ${this._pvFramesFieldHtml ? this._pvFramesFieldHtml() : ''}

                    <!-- 参考音声（v2.241）：ark/H3 は content 配列に audio_url 要素として乗る。v1(Hailuo) は対応しないので
                         provider 連動でこの区画ごと隠す（_pvOnModelChange）。model.ref とは無連動——音声は参考図と独立 -->
                    <div class="nico-pv-field" id="nicoPvRefAudioField">
                        <label class="nico-pv-label">${I18n.t('nico.pv_ref_audio_label', '参考音声（任意）')}</label>
                        <input type="file" id="nicoPvRefAudioInput" accept="audio/mpeg,audio/wav,audio/x-wav,.mp3,.wav" style="display:none" onchange="Niconico._pvOnRefAudioFileChange(this.files[0]); this.value='';">
                        <div class="nico-pv-refaudio-row" id="nicoPvRefAudioRow">
                            <button class="glass-btn nico-pv-ai-btn" onclick="document.getElementById('nicoPvRefAudioInput').click()">
                                <span class="nico-pv-btn-icon">${this._SVG.mic}</span>${I18n.t('nico.pv_ref_audio_select_btn', '音声ファイルを選択')}
                            </button>
                            <div class="nico-pv-refaudio-info" id="nicoPvRefAudioInfo" style="display:none;"></div>
                        </div>
                        <!-- 歌词字幕（六期 P2）：切模型后参考音声超出新上限的警告——见 niconico-pv-lyrics.js の _pvUpdateRefAudioLimitWarning -->
                        <p class="nico-pv-hint" id="nicoPvRefAudioLimitHint" style="display:none;"></p>
                    </div>

                    <!-- 歌詞（v2.242）：参考音声の有無に関わらず全渠道で表示（歌詞だけあれば文生視頻でも同期の手がかりになる）。
                         セッション限定・非持久——_pvRefImgIds と同じ姿勢で、モーダル再構築のたび自然に空になる -->
                    <div class="nico-pv-field" id="nicoPvLyricsField">
                        <label class="nico-pv-label">${I18n.t('nico.pv_lyrics_label', '歌詞（任意）')}</label>
                        <textarea id="nicoPvLyrics" class="nico-pv-textarea" rows="4" placeholder="${I18n.t('nico.pv_lyrics_ph', '参考音声の区間に対応する歌詞を貼り付けると、カット割りが歌詞に同期します（LRCタイムスタンプに対応）')}" oninput="if(Niconico._pvUpdateLyricPreview)Niconico._pvUpdateLyricPreview()"></textarea>
                        ${this._pvLyricOffsetFieldHtml ? this._pvLyricOffsetFieldHtml() : ''}
                    </div>

                    <div class="nico-pv-row">
                        <div class="nico-pv-field nico-pv-field-half">
                            <label class="nico-pv-label">${I18n.t('nico.pv_model_label', 'モデル')}</label>
                            <select id="nicoPvModel" class="nico-pv-select" onchange="Niconico._pvOnModelChange()">${modelOptionsHtml}</select>
                        </div>
                        <div class="nico-pv-field nico-pv-field-half">
                            <label class="nico-pv-label">${I18n.t('nico.pv_resolution_label', '解像度')}</label>
                            <select id="nicoPvResolution" class="nico-pv-select"></select>
                        </div>
                    </div>

                    <div class="nico-pv-row">
                        <div class="nico-pv-field nico-pv-field-half">
                            <label class="nico-pv-label">${I18n.t('nico.pv_duration_label', '長さ')}</label>
                            <select id="nicoPvDuration" class="nico-pv-select" onchange="if(Niconico._pvUpdateLyricPreview)Niconico._pvUpdateLyricPreview()">${durationOptionsHtml}</select>
                            <!-- 30秒枠（三期）は Seedance 2.5 系限定——他モデル選択中はここで案内、_pvOnModelChange が表示切替 -->
                            <p class="nico-pv-hint" id="nicoPvDurationHint" style="display:none;">${I18n.t('nico.pv_duration_seedance25_hint', '30秒までの長尺は現在Seedance 2.5のみ対応')}</p>
                        </div>
                        <div class="nico-pv-field nico-pv-field-half nico-pv-audio-field">
                            <label class="nico-pv-checkbox-label">
                                <input type="checkbox" id="nicoPvAudio" checked>
                                ${I18n.t('nico.pv_audio_label', '音声を生成')}
                            </label>
                            <p class="nico-pv-hint" id="nicoPvAudioHint" style="display:none;">${I18n.t('nico.pv_audio_disabled_hint', 'このモデルは音声に対応していません')}</p>
                        </div>
                    </div>

                    <!-- 画面比例：只在有参考图的生成里实际生效（文生恒 16:9，createTask 兜底）。v1(Hailuo) 无 ratio 参数，_pvOnModelChange 里整行隐藏 -->
                    <div class="nico-pv-row" id="nicoPvRatioRow">
                        <div class="nico-pv-field nico-pv-field-half">
                            <label class="nico-pv-label">${I18n.t('nico.pv_ratio_label', '画面比率（参考画像あり時）')}</label>
                            <select id="nicoPvRatio" class="nico-pv-select">
                                <option value="16:9" selected>16:9</option>
                                <option value="adaptive">${I18n.t('nico.pv_ratio_adaptive', '参考画像に合わせる')}</option>
                            </select>
                        </div>
                    </div>

                    <div class="nico-pv-field">
                        <label class="nico-pv-label">${I18n.t('nico.pv_channel_label', '投稿チャンネル')}</label>
                        <div class="nico-pv-channel-row">
                            <select id="nicoPvChannel" class="nico-pv-select" ${!hasChannels ? 'disabled' : ''}>${channelOptionsHtml}</select>
                            <button type="button" class="nico-pv-channel-add" id="nicoPvChannelAddBtn" onclick="Niconico._pvOpenChannelAddModal()" title="${I18n.t('nico.pv_channel_add_title', '公式チャンネルを追加')}">${this._SVG.plus}</button>
                        </div>
                        <p class="nico-pv-hint" id="nicoPvChannelHint" ${hasChannels ? 'style="display:none;"' : ''}>${I18n.t('nico.pv_channel_empty_hint', 'チャンネルを生成するか、「＋」で公式チャンネルを追加してください')}</p>
                    </div>

                    <div class="nico-pv-field">
                        <label class="nico-pv-label">${I18n.t('nico.pv_tweet_label', '告知ツイート')}</label>
                        <select id="nicoPvTweetAccount" class="nico-pv-select">${tweetOptions.join('')}</select>
                    </div>
                </div>
                <div class="nico-modal-buttons nico-pv-actions">
                    <button class="glass-btn nico-modal-close" onclick="Niconico._closePVModal()">${I18n.t('nico.menu_close', '閉じる')}</button>
                    <button class="glass-btn nico-pv-submit-btn" id="nicoPvSubmitBtn" onclick="Niconico._pvSubmit()" ${!hasChannels ? 'disabled' : ''}>${I18n.t('nico.pv_submit_btn', '投稿する')}</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        this._pvOnModelChange();
        this._pvRenderRefThumbs();
        this._pvRenderRefAudio();
        this._pvRenderCastChips();
        if (this._pvRenderFrames) this._pvRenderFrames();   // 分镜图（六期 P1）：会话级、每次开表单都是空数组，渲染出空态即可
        if (this._pvUpdateLyricPreview) this._pvUpdateLyricPreview();   // 歌词字幕（六期 P2）：歌词框空，预览行会自然隐藏
    },

    _closePVModal() {
        this._pvStopAllAudioPreviews();
        Utils.revokeBlobScope('nico-pv-refaudio');
        Utils.revokeBlobScope('nico-pv-temp');
        this._pvCleanupTempRefImgs();   // 未提交时清理相册临时图（v2.244）——提交成功路径在关闭前已把 _pvRefImgIds 清空，不会误删任务仍需要的 blob
        // 分镜图（六期 P1）：表单已经是完全会话级的（脚本文本本身也不持久化），关闭后没有任何路径能再引用到
        // 这批分镜图——提交成功路径在关闭前已把 _pvFrames 清空（保留 blob 给任务/重试用），这里再清一次是安全的
        // 空操作；真正被清掉 blob 的是「用户没提交就关闭表单」这种此前从未持久化过的草稿
        if (this._pvClearFrames) this._pvClearFrames();
        document.getElementById('nicoPvModal')?.remove();
    },

    // モデル切替：分辨率/時長/参考図可否/有声可否の四点連動。provider ごとに三様——ark は既存ロジックそのまま、
    // minimax(H3) は別枠（768P/2K・4-15s・音声は常時オン&固定）、minimax_v1(Hailuo) はさらに別枠
    // （512P/768P/1080P・6/10sの二択のみ・参考図1枚・音声は既存の audio:false 分岐にそのまま乗る）——
    // provider は現在の設定から読む（PVモーダル内で渠道が変わることはない）
    _pvOnModelChange() {
        const modelSel = document.getElementById('nicoPvModel');
        if (!modelSel) return;
        const model = this._pvModelInfo(modelSel.value);
        const provider = (VideoGen.config().provider) || 'ark';

        const resSel = document.getElementById('nicoPvResolution');
        if (resSel) {
            const prevRes = resSel.value;
            let resOptions, defaultRes;
            if (provider === 'minimax') {
                resOptions = ['768P', '2K'];   // H3 は大文字リテラル固定（API 仕様）
                defaultRes = '768P';
            } else if (provider === 'minimax_v1') {
                resOptions = ['512P', '768P', '1080P'];   // Hailuo も大文字リテラル固定（実測確認）
                defaultRes = '768P';
            } else {
                const is4kModel = model.id === 'doubao-seedance-2-0-260128';
                // 2.0 Fast / 2.0 Mini 不支持 1080p（火山文档明确）——改动前就漏的既有缺口，v2.240 review 补
                const no1080p = model.id === 'doubao-seedance-2-0-fast-260128' || model.id === 'doubao-seedance-2-0-mini-260615';
                resOptions = no1080p ? ['480p', '720p'] : ['480p', '720p', '1080p'].concat(is4kModel ? ['4k'] : []);
                defaultRes = '720p';
            }
            resSel.innerHTML = resOptions.map(r => `<option value="${r}">${r}</option>`).join('');
            resSel.value = resOptions.includes(prevRes) ? prevRes : defaultRes;
        }

        // 時長：ark は 1.0 系列モデルのみ短尺（[4,12]s）、2.5 系だけ [4,30]s に拡張（三期・実測確認済み：
        // doubao-seedance-2-5-260628 は duration=16/30 とも作成成功、31 は InvalidParameter で弾かれる——
        // 他の ark モデルは未検証のため触らない）、それ以外は[4,15]s。minimax(H3) は常に[4,15]s・既定6s
        // （実測メモ：MiniMax は純テキスト生成 duration=6 が稀に system error で弾かれる・5s や参考画像付き6sは正常。
        //  ハード制限はかけず、API のエラーメッセージをそのままユーザーに見せる方針——ここでは既定値のみ6に倣う）。
        // minimax_v1(Hailuo) は 6/10 の二択のみ（連続区間ではない——_pvDurationOptionsHtmlDiscrete を使う）
        // 2.5系判定：isSeedance1 と同じ姿勢で id 部分一致にする（「拉取モデル一覧」で内蔵表に無い新しい
        // 2.5系idが来ても拾えるよう、完全一致の白名单にしない）。provider に関わらず先に出しておき、
        // 下の durHint（ark限定の案内）でも使い回す
        const isSeedance25 = /seedance-2-5/.test(model.id);
        const durSel = document.getElementById('nicoPvDuration');
        if (durSel) {
            const prevDur = parseInt(durSel.value, 10);
            if (provider === 'minimax_v1') {
                const values = [6, 10];
                const fallbackD = values.includes(prevDur) ? prevDur : 6;
                durSel.innerHTML = this._pvDurationOptionsHtmlDiscrete(values, fallbackD);
            } else {
                let minD, maxD, defaultD;
                if (provider === 'minimax') {
                    minD = 4; maxD = 15; defaultD = 6;
                } else {
                    const isSeedance1 = /^doubao-seedance-1-0-/.test(model.id);
                    minD = 4;
                    maxD = isSeedance1 ? 12 : (isSeedance25 ? 30 : 15);
                    // 30秒はコストが高い——2.5でもユーザーが明示的に選んだ時だけ使う想定なので、既定値は他モデルと
                    // 同じ15止まり（maxDには乗せない）
                    defaultD = isSeedance25 ? 15 : maxD;
                }
                const fallbackD = (prevDur >= minD && prevDur <= maxD) ? prevDur : defaultD;
                durSel.innerHTML = this._pvDurationOptionsHtml(minD, maxD, fallbackD);
            }
        }

        // 長尺(30秒)対応の案内（三期）：ark渠道かつ2.5系以外の時だけ表示——2.5選択中は30秒が既にドロップダウンに
        // 出ているので案内不要、minimax/v1は30秒という概念自体が無いので出すと逆に混乱させる
        const durHint = document.getElementById('nicoPvDurationHint');
        if (durHint) durHint.style.display = (provider === 'ark' && !isSeedance25) ? '' : 'none';

        // 画面比率行：v1(Hailuo) は API に ratio パラメータ自体が無い（首帧の比率に従う）ので整行隠す；
        // 参考図非対応モデル（Seedance 1.x）は文生恒 16:9 で選択の意味が無いのでこれも隠す
        const ratioRow = document.getElementById('nicoPvRatioRow');
        if (ratioRow) ratioRow.style.display = (provider === 'minimax_v1' || !model.ref) ? 'none' : '';

        // 参考音声区画＋歌詞：v1(Hailuo) と 演出タイプ(yokoku/highlight) の二条件 OR で隠す（v2.244）——
        // 具体ロジックは _pvUpdateAudioLyricsVisibility に集約（演出タイプ select の onchange からも呼ばれる共有関数）
        this._pvUpdateAudioLyricsVisibility();

        const refRow = document.getElementById('nicoPvRefRow');
        const refAddBtn = document.getElementById('nicoPvRefAddBtn');
        const refHint = document.getElementById('nicoPvRefHint');
        const castRow = document.getElementById('nicoPvCastRow');
        // 固定 label 的枚数表記も provider/モデル連動（v1 は上限1枚、Seedance 2.5 系は50枚——六期 P1で
        // _pvMaxRefImages 自体がモデル判定に変わったので、ここも {n} 補間に統一する。v2.240 review 修の延伸）
        const refLabel = document.getElementById('nicoPvRefLabel');
        if (refLabel) {
            refLabel.textContent = (provider === 'minimax_v1')
                ? I18n.t('nico.pv_ref_label_v1', '参考画像（0〜1枚）')
                : I18n.t('nico.pv_ref_label', { n: this._pvMaxRefImages(model.id) });
        }
        if (refRow) refRow.classList.toggle('disabled', !model.ref);
        if (refAddBtn) refAddBtn.disabled = !model.ref;
        if (castRow) castRow.classList.toggle('disabled', !model.ref);   // 出演キャラ chips も参考図と同じ可否に従う
        if (refHint) {
            if (!model.ref) {
                refHint.textContent = I18n.t('nico.pv_ref_disabled_hint', 'このモデルは参考画像に対応していません');
                refHint.style.display = 'block';
            } else if (provider === 'minimax_v1') {
                // Hailuo は 1 枚のみ・語義が「風格参考」ではなく「動画の最初のフレーム」——H3/ark と違うので専用文言
                refHint.textContent = I18n.t('nico.pv_ref_single_frame_hint', 'Hailuo渠道は参考画像1枚のみ対応、動画の最初のフレームとして使われます');
                refHint.style.display = 'block';
            } else {
                refHint.style.display = 'none';
            }
        }

        const audioCb = document.getElementById('nicoPvAudio');
        const audioHint = document.getElementById('nicoPvAudioHint');
        if (provider === 'minimax') {
            // H3 恒有声：勾选框强制勾选并禁用（不给"不生成音声"这个选项），提示文案换成"常时生成音声"而非"该模型不支持音声"
            if (audioCb) { audioCb.checked = true; audioCb.disabled = true; }
            if (audioHint) {
                audioHint.textContent = I18n.t('nico.pv_audio_always_hint', 'MiniMax-H3 は常に音声付きで生成されます');
                audioHint.style.display = 'block';
            }
        } else {
            // ark は model.audio で柔軟切替；minimax_v1(Hailuo) は全系 audio:false なので、
            // このまま「無声モデル」の既存ロジック（禁用+チェック外し+既存ヒント文言）に自然に乗る——新規分岐不要
            if (audioCb) {
                const wasDisabled = audioCb.disabled;
                audioCb.disabled = !model.audio;
                if (!model.audio) audioCb.checked = false;          // 不支持音声的模型强制取消勾选
                else if (wasDisabled) audioCb.checked = true;       // 从禁用状态恢复 → 回到默认开（两个有声模型间切换保留用户手动勾选）
            }
            if (audioHint) {
                audioHint.textContent = I18n.t('nico.pv_audio_disabled_hint', 'このモデルは音声に対応していません');
                audioHint.style.display = model.audio ? 'none' : 'block';
            }
        }

        // 分镜图「生成」按钮の可否も参考図可否に連動（六期 P1：定義は js/niconico-pv-frames.js）
        if (this._pvUpdateFramesBtnState) this._pvUpdateFramesBtnState();
        // 歌词字幕（六期 P2：定義は js/niconico-pv-lyrics.js）：模型切换后参考音声上限可能变短，刷新警告 hint；
        // 时长档位也可能随模型联动改变，字幕预览的窗口长度要跟着重算
        if (this._pvUpdateRefAudioLimitWarning) this._pvUpdateRefAudioLimitWarning();
        if (this._pvUpdateLyricPreview) this._pvUpdateLyricPreview();
    },

    // 参考音声＋歌詞の表示条件（v2.244）：v1(Hailuo) 渠道 OR 演出タイプが yokoku/highlight のどちらかで参考音声を隠す
    // （二条件の OR）。歌詞はタイプ条件のみで判定——v1 でも歌詞欄自体は既存どおり出す（2.242「全渠道表示」を保つ）。
    // 値そのものはここでは触らない（display:none だけ）——タイプを切り戻せば入力済みの内容がそのまま戻る
    _pvUpdateAudioLyricsVisibility() {
        const styleType = document.getElementById('nicoPvStyleType')?.value || '';
        const hideForType = (styleType === 'yokoku' || styleType === 'highlight');
        const provider = (VideoGen.config().provider) || 'ark';

        const refAudioField = document.getElementById('nicoPvRefAudioField');
        if (refAudioField) refAudioField.style.display = (provider === 'minimax_v1' || hideForType) ? 'none' : '';

        const lyricsField = document.getElementById('nicoPvLyricsField');
        if (lyricsField) lyricsField.style.display = hideForType ? 'none' : '';
    },
});
