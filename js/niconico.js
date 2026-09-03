// ========================================================
// ニコニコ動画 (Niconico) — 動画プラットフォームシミュレーター
// ========================================================

const Niconico = {
    // 情報アクセス制限ルール → 见 Utils.PROMPTS.infoAccessRule()

    currentTab: 'new',
    currentVideoId: null,
    currentChannelId: null,
    _danmakuTimer: null,
    _danmakuActive: false,

    // ===== 定数 =====
    // _GENRES_JA：日文原文（用于 AI prompt、保持原汁原味）
    _GENRES_JA: {
        utatte: '歌ってみた',
        mad: 'MAD',
        game: 'ゲーム実況',
        vtuber: 'VTuber切り抜き',
        odotte: '踊ってみた',
        vocaloid: 'VOCALOID',
        cooking: '料理',
        doujin_pv: '同人PV',
        anime: 'アニメ',
        music: '音楽',
        other: 'その他'
    },
    // _GENRES 通过 getter 包装，切语言时跟随 i18n（仅用于 UI 显示）
    get _GENRES() {
        return {
            utatte: I18n.t('nico.category_utatte', '歌ってみた'),
            mad: I18n.t('nico.category_mad', 'MAD'),
            game: I18n.t('nico.category_game', 'ゲーム実況'),
            vtuber: I18n.t('nico.category_vtuber', 'VTuber切り抜き'),
            odotte: I18n.t('nico.category_odotte', '踊ってみた'),
            vocaloid: I18n.t('nico.category_vocaloid', 'VOCALOID'),
            cooking: I18n.t('nico.category_cooking', '料理'),
            doujin_pv: I18n.t('nico.category_doujin_pv', '同人PV'),
            anime: I18n.t('nico.category_anime', 'アニメ'),
            music: I18n.t('nico.category_music', '音楽'),
            other: I18n.t('nico.category_other', 'その他')
        };
    },
    // 验证用的固定 key 列表（parser 用 — 不可改 key）
    _GENRE_KEYS: ['utatte', 'mad', 'game', 'vtuber', 'odotte', 'vocaloid', 'cooking', 'doujin_pv', 'anime', 'music', 'other'],
    _GENRE_EMOJIS: {
        utatte: '🎤', mad: '🎬', game: '🎮', vtuber: '📺',
        odotte: '💃', vocaloid: '🎵', cooking: '🍳', doujin_pv: '🎨',
        anime: '📡', music: '🎶', other: '📦'
    },
    _AVATAR_COLORS: [
        '#e8530e', '#d63384', '#6f42c1', '#0d6efd', '#198754',
        '#20c997', '#fd7e14', '#6610f2', '#0dcaf0', '#dc3545'
    ],
    _DANMAKU_COLORS: ['#fff', '#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff', '#44ffff', '#ff8800', '#88ff00'],

    // ===== インライン SVG アイコン（emoji 廃止・currentColor で配色追従） =====
    _SVG: {
        // 再生（三角）
        play: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M8 5.5v13l11-6.5z"/></svg>',
        // コメント（吹き出し）
        comment: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-9 8.5 9.5 9.5 0 0 1-4-.9L3 21l1.9-5a8.5 8.5 0 0 1-.9-4 8.38 8.38 0 0 1 8.5-9 8.38 8.38 0 0 1 8.5 8.4z"/></svg>',
        // マイリスト（フォルダ）
        folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
        // 動画サムネ占位（フィルム + 再生三角）
        video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9.5v5l4-2.5z" fill="currentColor" stroke="none"/></svg>',
        // 排名标题（柱状图）
        chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4v16h16"/><rect x="7" y="11" width="3" height="6"/><rect x="12" y="7" width="3" height="10"/><rect x="17" y="13" width="3" height="4"/></svg>',
        // 奖牌（リボン付きメダル）
        medal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3 6 9M15 3l3 6"/><circle cx="12" cy="15" r="6"/><path d="M12 12.5l1 2 2.2.3-1.6 1.5.4 2.2-2-1.1-2 1.1.4-2.2-1.6-1.5 2.2-.3z" fill="currentColor" stroke="none"/></svg>',
        // 排行（トロフィー）
        trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v1.5a3 3 0 0 0 3 3M17 6h3v1.5a3 3 0 0 1-3 3"/><path d="M9.5 16h5M10 20h4M12 14v6"/></svg>',
        // 频道（アンテナ/放送）
        antenna: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21l7-9 7 9"/><path d="M12 12V6"/><path d="M7.5 7.5a6 6 0 0 1 0-3M16.5 7.5a6 6 0 0 0 0-3M5 9a9 9 0 0 1 0-6M19 9a9 9 0 0 0 0-6"/></svg>',
        // 動画生成（フィルム）
        film: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 15h18M8 4v16M16 4v16"/></svg>',
        // 音频/ドラマ（マイク）
        mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/></svg>',
        // 削除（ゴミ箱）
        trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 11v6M14 11v6"/></svg>',
        // 空状态：テレビ（新着なし）
        tv: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 3l4 4 4-4"/><path d="M11 11.5v5l4-2.5z" fill="currentColor" stroke="none"/></svg>',
        // PV投稿メニュー（カチンコ）
        clapper: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="9" width="18" height="12" rx="2"/><path d="M3 9l1.5-4.5L19 3l1 4z"/><path d="M7 4.5 9 9M12.5 4l2 4.5"/></svg>',
        // 追加（+）
        plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
        // 削除/閉じる（×）
        close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
        // 選択済み（チェック）
        check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg>',
        // AIおまかせ（きらめき）
        sparkle: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8z"/><path d="M19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9z"/></svg>',
        // 停止（試聴トグルの「再生中」状態・四角）
        stop: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg>',
        // アルバムから選択（山+太陽の写真アイコン、v2.244）
        image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>'
    },
    // 排名前三的奖牌色（金/银/铜 — 语义色、非渐变，按 SVG 规范允许的例外）
    _MEDAL_COLORS: ['#ffd700', '#c0c0c0', '#cd7f32'],

    // 标题 hash → 稳定 HSL 颜色（无渐变铁律、参考 pixiv-novel._hashColor）
    _hashColor(s) {
        let h = 0;
        const str = s || '';
        for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
        const hue = Math.abs(h) % 360;
        return `hsl(${hue}, 32%, 42%)`;
    },

    // 動画サムネ占位 HTML（hash 色背景 + 中性 video SVG、emoji 廃止）
    // videoBlobId 持ちのリアルPV動画は thumb: blob を非同期で重ねる（_loadVideoThumbs 参照）、無ければ hash色+SVGのまま
    _thumbPlaceholder(v, cls) {
        const bg = this._hashColor((v && v.title) || '');
        const thumbImg = (v && v.videoBlobId) ? `<img src="" data-nico-thumb-id="${this._escHtml(v.videoBlobId)}" class="nico-thumb-img" alt="">` : '';
        return `<div class="${cls}" style="background:${bg}"><span class="nico-thumb-icon">${this._SVG.video}</span>${thumbImg}</div>`;
    },

    // リアルPV動画のサムネを非同期で埋める（Task 8）：data-nico-thumb-id 持ちの <img> を container 内から拾って getUrl
    // thumb blob が無い（抽帧失敗 or 通常のAI生成動画）場合は何もしない → hash色+SVGのまま自然にフォールバック
    async _loadVideoThumbs(container) {
        if (!container || typeof VideoGen === 'undefined') return;
        const imgs = container.querySelectorAll('img[data-nico-thumb-id]');
        for (const img of imgs) {
            const blobId = img.dataset.nicoThumbId;
            if (!blobId) continue;
            try {
                const url = await VideoGen.getUrl('thumb:' + blobId);
                if (url) img.src = url;
            } catch (e) { /* 読み込み失敗は無視、hash色のまま */ }
        }
    },

    // ===== データ初期化 =====
    _ensureData() {
        const d = AppState.data;
        if (!d.niconicoData) d.niconicoData = {};
        const n = d.niconicoData;
        if (!n.videos) n.videos = [];
        if (!n.channels) n.channels = [];
        if (!n.comments) n.comments = {};
        if (!n.mylist) n.mylist = [];
        if (!n.followedChannels) n.followedChannels = [];
        if (!n.rankings) n.rankings = [];
        if (!n.settings) n.settings = { userName: 'ユーザー' };
        return n;
    },

    // ===== 初期化 =====
    init() {
        this._ensureData();
        this.switchTab(this.currentTab, true);
    },

    // ===== タブ切替 =====
    switchTab(tab, rerender = true) {
        this.currentTab = tab;
        ['new', 'ranking', 'mylist', 'channel'].forEach(t => {
            const btn = document.getElementById(`nicoTab${t.charAt(0).toUpperCase() + t.slice(1)}`);
            if (btn) btn.classList.toggle('active', t === tab);
        });
        if (rerender) this._renderCurrentTab();
    },

    _renderCurrentTab() {
        const container = document.getElementById('niconicoContent');
        if (!container) return;
        switch (this.currentTab) {
            case 'new': this.renderNewVideos(container); break;
            case 'ranking': this.renderRankings(container); break;
            case 'mylist': this.renderMylist(container); break;
            case 'channel': this.renderChannels(container); break;
        }
    },

    // ===== 新着動画タブ =====
    renderNewVideos(container) {
        const n = this._ensureData();
        const videos = (n.videos || []).slice().reverse();
        // PV投稿の生成中タスクを占位卡として最前に挿入（Task 8）
        const genTasks = (typeof VideoGen !== 'undefined' ? VideoGen.tasks() : []).slice().reverse();
        const genCardsHtml = genTasks.map(t => this._renderGenCard(t)).join('');

        if (videos.length === 0 && genTasks.length === 0) {
            container.innerHTML = `
                <div class="nico-empty">
                    <div class="empty-state-icon">${this._SVG.tv}</div>
                    <div class="empty-state-text">${I18n.t('nico.empty_no_videos', 'まだ動画がありません')}</div>
                    <div class="empty-state-hint">${I18n.t('nico.empty_hint', '右上の「+」から動画を生成できます')}</div>
                </div>`;
            return;
        }

        container.innerHTML = `
            <div class="nico-video-grid">
                ${genCardsHtml}
                ${videos.map(v => this._renderVideoCard(v)).join('')}
            </div>`;
        this._loadVideoThumbs(container);
    },

    _renderVideoCard(v) {
        const channel = this._getChannel(v.channelId);
        const inMylist = (this._ensureData().mylist || []).includes(v.id);
        const thumbImg = v.videoBlobId ? `<img src="" data-nico-thumb-id="${this._escHtml(v.videoBlobId)}" class="nico-thumb-img" alt="">` : '';
        return `
        <div class="nico-video-card" onclick="Niconico.openVideo('${v.id}')">
            <div class="nico-thumbnail" style="background:${this._hashColor(v.title || '')}">
                <span class="nico-thumb-icon">${this._SVG.video}</span>
                ${thumbImg}
                <span class="nico-duration">${this._escHtml(v.duration || '0:00')}</span>
                ${inMylist ? `<span class="nico-mylist-badge">${I18n.t('nico.mylist_badge', 'マイリスト')}</span>` : ''}
            </div>
            <div class="nico-video-info">
                <div class="nico-video-title">${this._escHtml(v.title)}</div>
                <div class="nico-video-uploader">${this._escHtml(v.uploaderName || (channel ? channel.name : ''))}</div>
                <div class="nico-video-stats">
                    <span class="nico-stat"><span class="nico-stat-icon">${this._SVG.play}</span>${this._fmtNum(v.views || 0)}</span>
                    <span class="nico-stat"><span class="nico-stat-icon">${this._SVG.comment}</span>${this._fmtNum(v.commentCount || 0)}</span>
                    <span>${this._timeAgo(v.uploadedAt)}</span>
                </div>
            </div>
        </div>`;
    },

    // ===== ランキングタブ =====
    renderRankings(container) {
        const n = this._ensureData();
        const rankings = n.rankings || [];

        if (rankings.length === 0) {
            container.innerHTML = `
                <div class="nico-empty">
                    <div class="empty-state-icon">${this._SVG.trophy}</div>
                    <div class="empty-state-text">${I18n.t('nico.empty_no_ranking', 'ランキングがありません')}</div>
                    <div class="empty-state-hint">${I18n.t('nico.empty_ranking_hint', '「+」からランキングを生成できます')}</div>
                </div>`;
            return;
        }

        const latest = rankings[rankings.length - 1];
        const periodText = latest.period || I18n.t('nico.ranking_period_default', '週間');
        const rankingTitle = I18n.t('nico.ranking_period_format', { period: periodText });

        container.innerHTML = `
            <div class="nico-ranking-header">
                <div class="nico-ranking-title"><span class="nico-ranking-title-icon">${this._SVG.chart}</span>${this._escHtml(rankingTitle)}</div>
            </div>
            <div class="nico-ranking-list">
                ${(latest.items || []).map((item, i) => {
                    const video = (n.videos || []).find(v => v.id === item.videoId);
                    if (!video) return '';
                    const rank = i < 3
                        ? `<span class="nico-rank-medal" style="color:${this._MEDAL_COLORS[i]}">${this._SVG.medal}</span>`
                        : `<span class="nico-rank-num">${i + 1}</span>`;
                    return `
                    <div class="nico-ranking-item" onclick="Niconico.openVideo('${video.id}')">
                        <div class="nico-rank">${rank}</div>
                        ${this._thumbPlaceholder(video, 'nico-ranking-thumb')}
                        <div class="nico-ranking-info">
                            <div class="nico-ranking-item-title">${this._escHtml(video.title)}</div>
                            <div class="nico-ranking-item-uploader">${this._escHtml(video.uploaderName || '')}</div>
                            <div class="nico-ranking-item-stats"><span class="nico-stat"><span class="nico-stat-icon">${this._SVG.play}</span>${this._fmtNum(video.views || 0)}</span><span class="nico-stat"><span class="nico-stat-icon">${this._SVG.comment}</span>${this._fmtNum(video.commentCount || 0)}</span><span class="nico-stat"><span class="nico-stat-icon">${this._SVG.folder}</span>${this._fmtNum(video.mylists || 0)}</span></div>
                        </div>
                    </div>`;
                }).join('')}
            </div>`;
        this._loadVideoThumbs(container);
    },

    // ===== マイリストタブ =====
    renderMylist(container) {
        const n = this._ensureData();
        const mylistIds = n.mylist || [];

        if (mylistIds.length === 0) {
            container.innerHTML = `
                <div class="nico-empty">
                    <div class="empty-state-icon">${this._SVG.folder}</div>
                    <div class="empty-state-text">${I18n.t('nico.mylist_empty', 'マイリストは空です')}</div>
                    <div class="empty-state-hint">${I18n.t('nico.mylist_hint', '動画詳細から「マイリスト追加」できます')}</div>
                </div>`;
            return;
        }

        const videos = mylistIds.map(id => (n.videos || []).find(v => v.id === id)).filter(Boolean).reverse();

        container.innerHTML = `
            <div class="nico-mylist-header">
                <span>${I18n.t('nico.mylist_count_format', { n: videos.length })}</span>
            </div>
            <div class="nico-video-list">
                ${videos.map(v => `
                    <div class="nico-video-list-item" onclick="Niconico.openVideo('${v.id}')">
                        ${this._thumbPlaceholder(v, 'nico-list-thumb')}
                        <div class="nico-list-info">
                            <div class="nico-list-title">${this._escHtml(v.title)}</div>
                            <div class="nico-list-meta">${this._escHtml(v.uploaderName || '')} · ▶ ${this._fmtNum(v.views || 0)} · ${this._escHtml(v.duration || '0:00')}</div>
                        </div>
                    </div>`).join('')}
            </div>`;
        this._loadVideoThumbs(container);
    },

    // ===== チャンネルタブ =====
    renderChannels(container) {
        const n = this._ensureData();
        const channels = (n.channels || []).slice().reverse();

        if (channels.length === 0) {
            container.innerHTML = `
                <div class="nico-empty">
                    <div class="empty-state-icon">${this._SVG.antenna}</div>
                    <div class="empty-state-text">${I18n.t('nico.empty_no_channels', 'チャンネルがありません')}</div>
                    <div class="empty-state-hint">${I18n.t('nico.empty_channels_hint', '「+」からチャンネルを生成できます')}</div>
                </div>`;
            return;
        }

        container.innerHTML = channels.map(ch => {
            const isFollowed = (n.followedChannels || []).includes(ch.id);
            const videoCount = (n.videos || []).filter(v => v.channelId === ch.id).length;
            return `
            <div class="nico-channel-card" onclick="Niconico.openChannel('${ch.id}')">
                <div class="nico-channel-avatar" style="background:${ch.avatarColor || '#e8530e'}">${this._escHtml(ch.avatarEmoji || ch.name.charAt(0))}</div>
                <div class="nico-channel-info">
                    <div class="nico-channel-name">${isFollowed ? '★ ' : ''}${this._escHtml(ch.name)}${ch.official ? `<span class="nico-channel-badge-official">${I18n.t('nico.channel_official_badge', '公式')}</span>` : ''}</div>
                    <div class="nico-channel-meta">${I18n.t('nico.subscribers_short', { n: this._fmtNum(ch.subscriberCount || 0), videos: videoCount })}</div>
                    <div class="nico-channel-desc">${this._escHtml((ch.description || '').substring(0, 60))}</div>
                </div>
            </div>`;
        }).join('');
    },

    // ===== オーディオドラマ投稿（Magazine から） =====
    // payload: { article, segments: [{speaker, text, audioId, voiceId, npcName, kind, skipped?}] }
    async publishAudioDrama(payload) {
        const n = this._ensureData();
        const { article, segments } = payload;
        const playableSegments = segments.filter(s => s.audioId);

        // article.npcIds の最初の NPC をチャンネル候補に（声優インタビューの場合）
        const npcs = AppState.data.broadcast.officialNpcs || [];
        const firstNpcId = (article.npcIds || [])[0];
        const firstNpc = firstNpcId ? npcs.find(n => n.id === firstNpcId) : null;
        const uploaderName = firstNpc ? (firstNpc.name || firstNpc.role) : '雑誌編集部';

        // 时长粗算（每段平均按 4 秒，足够当占位）
        const totalSec = playableSegments.length * 4;
        const min = Math.floor(totalSec / 60);
        const sec = totalSec % 60;
        const duration = `${min}:${sec.toString().padStart(2, '0')}`;

        const articleType = article.type === 'charatalk' ? 'キャラ対談' : '声優座談会';
        const videoObj = {
            id: Utils.generateId(),
            type: 'audio-drama',
            title: `${article.title || article.theme} (${articleType})`,
            description: `『${AppState.data.magazineData?.magazineName || 'Animage'}』掲載 ${articleType} の音声ドラマ版`,
            uploaderName,
            channelId: null,
            genre: 'doujin_pv',
            tags: ['オーディオドラマ', articleType, ...(article.theme ? [article.theme] : [])],
            emoji: '🎙️',
            duration,
            views: 0,
            commentCount: 0,
            mylists: 0,
            uploadedAt: Date.now(),
            audioSegments: segments.map(s => ({
                speaker: s.speaker === '__interviewer__' ? 'インタビュアー' : s.speaker,
                text: s.text,
                kind: s.kind || 'dialogue',
                audioId: s.audioId || null,
                npcId: s.npcId || null,
                npcName: s.npcName || null
            })),
            sourceArticleId: article.id
        };
        n.videos.push(videoObj);
        Utils.saveData();

        // イベント発射
        if (typeof Utils !== 'undefined' && Utils.emitEvent) {
            Utils.emitEvent('nico_video_published', 'niconico', { title: videoObj.title, summary: 'オーディオドラマ' });
        }
        return videoObj.id;
    },

    // 删除视频时清掉关联音频
    async _cleanupAudioDramaAudio(video) {
        if (video?.type !== 'audio-drama' || !video.audioSegments) return;
        const audioIds = video.audioSegments.map(s => s.audioId).filter(Boolean);
        if (typeof TTSEngine !== 'undefined' && TTSEngine.removeAudios) {
            await TTSEngine.removeAudios(audioIds);
        }
    },

    // ===== 動画詳細ページ =====
    openVideo(id) {
        this.currentVideoId = id;
        this._stopDanmaku();
        this._stopAudioDrama();
        this._stopRealPlayer();
        Navigation.goTo('niconico-detail');
    },

    renderVideoDetail() {
        const n = this._ensureData();
        const v = (n.videos || []).find(x => x.id === this.currentVideoId);
        if (!v) { Navigation.goTo('niconico'); return; }

        // 真プレイヤーの再生位置を退避（Task 8）：addComment/toggleMylist等はこの関数を丸ごと呼び直す既存の刷新習慣で、
        // 何もしないと再生中の真動画が毎回 0:00 に巻き戻ってしまう。同じ動画への再描画に限り currentTime/再生状態を持ち越す
        const prevPlayer = document.getElementById('nicoRealPlayer');
        this._pendingPlayerState = prevPlayer ? { time: prevPlayer.currentTime || 0, playing: !prevPlayer.paused && !prevPlayer.ended } : null;

        const titleEl = document.getElementById('nicoDetailTitle');
        if (titleEl) titleEl.textContent = v.title || I18n.t('nico.detail_title_default', '動画');

        const content = document.getElementById('nicoDetailContent');
        if (!content) return;

        // オーディオドラマ専用 detail
        if (v.type === 'audio-drama') {
            return this._renderAudioDramaDetail(content, v, n);
        }

        const comments = (n.comments[v.id] || []);
        const inMylist = (n.mylist || []).includes(v.id);
        const channel = this._getChannel(v.channelId);
        const tags = (v.tags || []);

        // 関連動画（同ジャンル、最大5件）
        const related = (n.videos || [])
            .filter(rv => rv.id !== v.id && rv.genre === v.genre)
            .slice(0, 5);

        content.innerHTML = `
        ${this._renderPlayerArea(v)}

        <div class="nico-detail-info">
            <h2 class="nico-detail-title">${this._escHtml(v.title)}</h2>
            ${v.titleTl ? `<details class="tw-tl-block"><summary class="tw-tl-btn">${I18n.t('melon.tl_label', '訳')}</summary><div class="tw-tl-content">${this._escHtml(v.titleTl)}</div></details>` : ''}
            <div class="nico-detail-stats">
                <span class="nico-stat"><span class="nico-stat-icon">${this._SVG.play}</span>${I18n.t('nico.view_format', { n: this._fmtNum(v.views || 0) })}</span>
                <span class="nico-stat"><span class="nico-stat-icon">${this._SVG.comment}</span>${I18n.t('nico.comment_count_format', { n: this._fmtNum(v.commentCount || 0) })}</span>
                <span class="nico-stat"><span class="nico-stat-icon">${this._SVG.folder}</span>${I18n.t('nico.mylist_count_short', { n: this._fmtNum(v.mylists || 0) })}</span>
                <span>${this._timeAgo(v.uploadedAt)}</span>
            </div>

            ${channel ? `
            <div class="nico-detail-uploader" onclick="Niconico.openChannel('${channel.id}')">
                <div class="nico-channel-avatar-sm" style="background:${channel.avatarColor || '#e8530e'}">${this._escHtml(channel.avatarEmoji || channel.name.charAt(0))}</div>
                <span>${this._escHtml(channel.name)}</span>
            </div>` : `
            <div class="nico-detail-uploader">
                <span>${this._escHtml(v.uploaderName || I18n.t('nico.uploader_unknown', '投稿者不明'))}</span>
            </div>`}

            ${tags.length > 0 ? `
            <div class="nico-detail-tags">
                ${tags.map(t => `<span class="nico-tag">${this._escHtml(t)}</span>`).join('')}
            </div>` : ''}

            ${v.description ? `
            <div class="nico-detail-desc">${this._escHtml(v.description).replace(/\n/g, '<br>')}
            ${v.descTl ? `<details class="tw-tl-block" style="margin-top:6px;"><summary class="tw-tl-btn">${I18n.t('melon.tl_label', '訳')}</summary><div class="tw-tl-content">${this._escHtml(v.descTl)}</div></details>` : ''}
            </div>` : ''}

            <div class="nico-detail-actions">
                <button class="glass-btn nico-action-btn ${inMylist ? 'active' : ''}" onclick="Niconico.toggleMylist('${v.id}')">
                    ${inMylist ? I18n.t('nico.btn_mylist_added', '★ マイリスト済') : I18n.t('nico.btn_mylist_add', '☆ マイリスト追加')}
                </button>
                <button class="glass-btn nico-action-btn" onclick="Niconico._generateMoreComments('${v.id}')">
                    <span class="nico-btn-icon">${this._SVG.comment}</span>${I18n.t('nico.btn_gen_comments', 'コメント生成')}
                </button>
                <button class="glass-btn nico-action-btn" onclick="Niconico.shareToLine('${v.id}')" style="background:#06c755;color:#fff;">
                    ${I18n.t('nico.btn_share_line', 'LINEで共有')}
                </button>
                ${v.videoBlobId ? `
                <button class="glass-btn nico-action-btn danger-text" onclick="Niconico.deleteVideo('${v.id}')">
                    <span class="nico-btn-icon">${this._SVG.trash}</span>${I18n.t('nico.pv_btn_delete_video', '削除')}
                </button>` : ''}
            </div>
        </div>

        <div class="nico-comment-section">
            <h3 class="nico-section-title">${I18n.t('nico.section_comments', { n: comments.length })}</h3>
            <div class="nico-comment-input-area">
                <input type="text" class="nico-comment-input" id="nicoCommentInput" placeholder="${I18n.t('nico.comment_placeholder', 'コメントを入力...')}" maxlength="100">
                <button class="glass-btn nico-comment-send" onclick="Niconico.addComment('${v.id}')">${I18n.t('nico.btn_send', '送信')}</button>
            </div>
            <div class="nico-comment-list" id="nicoCommentList">
                ${comments.length > 0 ? comments.slice().reverse().map(c => `
                    <div class="nico-comment-item">
                        <div class="nico-comment-author">${this._escHtml(c.authorName || I18n.t('nico.anonymous', '匿名'))}</div>
                        <div class="nico-comment-text" ${c.color ? `style="color:${c.color}"` : ''}>${this._escHtml(c.text)}</div>
                        <div class="nico-comment-time">${c.timestamp || ''}</div>
                    </div>`).join('') : `<div class="nico-comment-empty">${I18n.t('nico.no_comments', 'まだコメントがありません')}</div>`}
            </div>
        </div>

        ${related.length > 0 ? `
        <div class="nico-related-section">
            <h3 class="nico-section-title">${I18n.t('nico.section_related', '関連動画')}</h3>
            <div class="nico-video-list">
                ${related.map(rv => `
                    <div class="nico-video-list-item" onclick="Niconico.openVideo('${rv.id}')">
                        ${this._thumbPlaceholder(rv, 'nico-list-thumb')}
                        <div class="nico-list-info">
                            <div class="nico-list-title">${this._escHtml(rv.title)}</div>
                            <div class="nico-list-meta">${this._escHtml(rv.uploaderName || '')} · ▶ ${this._fmtNum(rv.views || 0)}</div>
                        </div>
                    </div>`).join('')}
            </div>
        </div>` : ''}`;

        // コメント入力でEnterキーで送信
        const input = document.getElementById('nicoCommentInput');
        if (input) {
            input.onkeyup = (e) => {
                if (e.key === 'Enter') this.addComment(v.id);
            };
        }

        if (v.videoBlobId) this._loadRealPlayer(v);   // Task 8：真動画の src を非同期で埋める
        this._loadVideoThumbs(content);                // 関連動画欄のサムネ
    },

    // ===== チャンネルページ =====
    openChannel(id) {
        this.currentChannelId = id;
        this._stopDanmaku();
        Navigation.goTo('niconico-channel');
    },

    renderChannelPage() {
        const n = this._ensureData();
        const ch = (n.channels || []).find(x => x.id === this.currentChannelId);
        if (!ch) { Navigation.goTo('niconico'); return; }

        const titleEl = document.getElementById('nicoChannelTitle');
        if (titleEl) titleEl.textContent = ch.name;

        const content = document.getElementById('nicoChannelContent');
        if (!content) return;

        const videos = (n.videos || []).filter(v => v.channelId === ch.id).reverse();
        const isFollowed = (n.followedChannels || []).includes(ch.id);

        content.innerHTML = `
        <div class="nico-channel-header">
            <div class="nico-channel-avatar-lg" style="background:${ch.avatarColor || '#e8530e'}">${this._escHtml(ch.avatarEmoji || ch.name.charAt(0))}</div>
            <div class="nico-channel-header-info">
                <h2 class="nico-channel-header-name">${this._escHtml(ch.name)}</h2>
                <div class="nico-channel-header-stats">${I18n.t('nico.subscribers_format', { n: this._fmtNum(ch.subscriberCount || 0), videos: videos.length })}</div>
                <button class="glass-btn nico-follow-btn ${isFollowed ? 'following' : ''}" onclick="event.stopPropagation();Niconico.toggleFollowChannel('${ch.id}')">
                    ${isFollowed ? I18n.t('nico.btn_follow_following', '★ フォロー中') : I18n.t('nico.btn_follow', '☆ フォローする')}
                </button>
            </div>
        </div>
        ${ch.description ? `<div class="nico-channel-desc">${this._escHtml(ch.description).replace(/\n/g, '<br>')}</div>` : ''}
        <h3 class="nico-section-title" style="margin-top:16px;">${I18n.t('nico.posted_videos', { n: videos.length })}</h3>
        ${videos.length > 0
            ? `<div class="nico-video-grid">${videos.map(v => this._renderVideoCard(v)).join('')}</div>`
            : `<div class="nico-empty"><div class="empty-state-text">${I18n.t('nico.empty_no_videos', 'まだ動画がありません')}</div></div>`}`;
        this._loadVideoThumbs(content);
    },

    // ===== 生成メニュー =====
    showGenerateMenu() {
        const n = this._ensureData();
        const hasChannels = n.channels.length > 0;
        const hasVideos = n.videos.length > 0;

        const html = `
        <div class="nico-modal-overlay" id="nicoGenerateModal" onclick="if(event.target===this)Niconico.closeGenerateModal()">
            <div class="nico-modal">
                <div class="nico-modal-title">${I18n.t('nico.menu_title', '生成メニュー')}</div>
                <div class="nico-modal-buttons">
                    <button class="glass-btn nico-gen-btn" onclick="Niconico._pvMenuEntry()">
                        <span class="nico-gen-icon">${this._SVG.clapper}</span> ${I18n.t('nico.pv_menu_label', 'PV投稿（動画生成）')}
                        <small>${I18n.t('nico.pv_menu_desc', 'Seedanceで動画を生成して投稿')}</small>
                    </button>
                    <button class="glass-btn nico-gen-btn" onclick="Niconico._doGenerate('channels')">
                        <span class="nico-gen-icon">${this._SVG.antenna}</span> ${I18n.t('nico.menu_channel', 'チャンネル生成')}
                        <small>${I18n.t('nico.menu_channel_desc', '投稿者チャンネルを自動生成')}</small>
                    </button>
                    <button class="glass-btn nico-gen-btn" onclick="Niconico._doGenerate('videos')">
                        <span class="nico-gen-icon">${this._SVG.film}</span> ${I18n.t('nico.menu_video', '動画生成')}
                        <small>${I18n.t('nico.menu_video_desc', 'ニコニコ動画を自動生成')}</small>
                    </button>
                    <button class="glass-btn nico-gen-btn" onclick="Niconico._doGenerate('rankings')" ${!hasVideos ? `disabled title="${I18n.t('nico.menu_ranking_disabled_hint', '先に動画を生成してください')}"` : ''}>
                        <span class="nico-gen-icon">${this._SVG.trophy}</span> ${I18n.t('nico.menu_ranking', 'ランキング生成')}
                        <small>${I18n.t('nico.menu_ranking_desc', '週間再生数ランキング')}</small>
                    </button>
                </div>
                <button class="glass-btn nico-modal-close" onclick="Niconico.closeGenerateModal()">${I18n.t('nico.menu_close', '閉じる')}</button>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
    },

    closeGenerateModal() {
        document.getElementById('nicoGenerateModal')?.remove();
    },

    async _doGenerate(type) {
        this.closeGenerateModal();
        try {
            switch (type) {
                case 'channels': await this._generateChannels(); break;
                case 'videos': await this._generateVideos(); break;
                case 'rankings': await this._generateRankings(); break;
            }
        } catch (e) {
            console.error('[Niconico] Generation error:', e);
            Utils.showToast(I18n.t('t.nico_gen_error', '⚠️ 生成エラー: ') + e.message, 4000);
        }
    },

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

    // 参考図の同時選択上限：v1(Hailuo)だけ1枚（語義は"動画の最初のフレーム"）、他は9枚。
    // 画廊選択器の上限強制 + タイトル/トースト文言（{n} 補間）に使う
    _pvMaxRefImages() {
        return (VideoGen.config().provider === 'minimax_v1') ? 1 : 9;
    },

    showPVModal() {
        const n = this._ensureData();
        this._pvRefImgIds = [];
        this._pvGallerySelection = [];
        this._pvRefAudio = null;   // 重开表单清空（会话级、非持久——照 _pvRefImgIds 的姿势）
        this._pvTrimCtx = null;
        this._pvTempUrlCache = {};

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
                        <textarea id="nicoPvPrompt" class="nico-pv-textarea" rows="5" placeholder="${I18n.t('nico.pv_prompt_placeholder', 'カット割り・セリフ・雰囲気を書く（「」内のセリフが読み上げられます）')}"></textarea>

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
                    </div>

                    <!-- 歌詞（v2.242）：参考音声の有無に関わらず全渠道で表示（歌詞だけあれば文生視頻でも同期の手がかりになる）。
                         セッション限定・非持久——_pvRefImgIds と同じ姿勢で、モーダル再構築のたび自然に空になる -->
                    <div class="nico-pv-field" id="nicoPvLyricsField">
                        <label class="nico-pv-label">${I18n.t('nico.pv_lyrics_label', '歌詞（任意）')}</label>
                        <textarea id="nicoPvLyrics" class="nico-pv-textarea" rows="4" placeholder="${I18n.t('nico.pv_lyrics_ph', '参考音声の区間に対応する歌詞を貼り付けると、カット割りが歌詞に同期します')}"></textarea>
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
                            <select id="nicoPvDuration" class="nico-pv-select">${durationOptionsHtml}</select>
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
    },

    _closePVModal() {
        this._pvStopAllAudioPreviews();
        Utils.revokeBlobScope('nico-pv-refaudio');
        Utils.revokeBlobScope('nico-pv-temp');
        this._pvCleanupTempRefImgs();   // 未提交时清理相册临时图（v2.244）——提交成功路径在关闭前已把 _pvRefImgIds 清空，不会误删任务仍需要的 blob
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
        // 固定 label 的枚数表記も provider 連動（v1 は上限1枚——下の hint だけ直しても、この見出しが
        // 「0〜9枚」のままだと矛盾する。v2.240 review 修）
        const refLabel = document.getElementById('nicoPvRefLabel');
        if (refLabel) {
            refLabel.textContent = (provider === 'minimax_v1')
                ? I18n.t('nico.pv_ref_label_v1', '参考画像（0〜1枚）')
                : I18n.t('nico.pv_ref_label', '参考画像（0〜9枚）');
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
    // 参考音声（v2.241）：選択 → decodeAudioData 検査 → 15秒超は選段弾窗でトリム
    // ═══════════════════════════════════════════════════════════

    // ファイル選択ハンドラ。処理順は仕様通り「①デコードして実時長を取る（失敗→フォーマット非対応）
    // ②ファイルサイズ>15MB→拒否 ③時長<=15s→原ファイルそのまま採用 ④時長>15s→選段弾窗」
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
        if (duration <= 15) {
            this._pvRefAudio = { blob: file, name: file.name, duration, url: null };   // 原ファイル Blob 直採用（原エンコード音質を保つ）
            await this._pvRenderRefAudio();
        } else {
            this._pvOpenTrimModal(audioBuffer, duration, file.name);
        }
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
    },

    // 表単主区の試聴トグル（既に選ばれている _pvRefAudio.blob をそのまま再生。15秒以内保証済みなので
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

    // ===== 選段弾窗（15秒超の音声から範囲選択・OfflineAudioContext でトリム→WAV 再エンコード） =====

    _pvOpenTrimModal(audioBuffer, duration, fileName) {
        this._pvTrimCtx = { audioBuffer, duration, fileName, start: 0 };
        const maxStart = Math.max(0, duration - 15);
        const html = `
        <div class="nico-modal-overlay nico-pv-trim-overlay" id="nicoPvTrimModal" onclick="if(event.target===this)Niconico._closeTrimModal()">
            <div class="nico-modal nico-pv-trim-modal">
                <div class="nico-modal-title">${I18n.t('nico.pv_trim_title', '音声区間を選択（最大15秒）')}</div>
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
        const end = Math.min(ctx.duration, start + 15);
        return I18n.t('nico.pv_trim_range_format', { start: start.toFixed(1), end: end.toFixed(1) });
    },

    _pvOnTrimSliderInput(val) {
        if (!this._pvTrimCtx) return;
        this._pvTrimCtx.start = parseFloat(val) || 0;
        const el = document.getElementById('nicoPvTrimRange');
        if (el) el.textContent = this._pvTrimRangeText();
        this._pvStopTrimPreview();   // ドラッグ中に鳴ってた分は捨てる（古い位置のまま鳴り続けると紛らわしい）
    },

    // 選段弾窗の試聴：Blob化せず AudioBufferSourceNode で直接 [start, start+15) を再生
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
        const playLen = Math.min(15, ctx.duration - ctx.start);
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
        const dur = Math.min(15, ctx.duration - start);
        try {
            const blob = await this._pvRenderTrimWav(ctx.audioBuffer, start, dur);
            this._pvRefAudio = { blob, name: ctx.fileName, duration: dur, url: null };
            this._closeTrimModal();
            await this._pvRenderRefAudio();
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

    // ===== AIにおまかせ：演出タイプ×ムード 二軸カード（v2.243） =====
    // 定番演出語彙は自前で攢めたもの——タイプ選択時は persona も差し替える（音楽PV演出監督／シリーズ構成）、
    // ムードは色調・運鏡のトーンだけを足す。「指定なし」時は _pvAiWrite 側で一切参照されない
    _PV_STYLE_CARDS: {
        op: {
            persona: '音乐PV演出导演',
            text: '这是一段动画OP风格的影像。可将OP的惯用演出语汇用于判断：充满疾走感的起跑／角色回眸·望向镜头／主要角色依次登场的介绍镜头／全员集合的拉远画面／副歌前一瞬的静止（蓄势）／最后以一张定格决胜画收尾。注意乐曲的能量曲线（主歌=铺垫、副歌=最高潮），据此分配镜头密度。'
        },
        ed: {
            persona: '音乐PV演出导演',
            // カット数の具体的な数字は二期で cutRange（duration 連動）に一元化——ここに数字を残すと
            // cutRange の指示と食い違った時に二重指示の矛盾が生まれるため、方向性の言及だけ残す
            text: '这是一段动画ED风格的影像。可运用ED的惯用语汇：定机位或缓慢移动的长镜头／背影·远景·剪影／带着日常余韵的小动作／沉稳统一的色调／最后缓缓拉远、或如静静闭眼般收束。镜头数可以偏少。'
        },
        insert: {
            persona: '音乐PV演出导演',
            text: '这是一段插入歌场景风格的影像。要意识到“乐曲与故事情感最高潮重叠”的演出：插入回忆闪回／现在与过去的对比镜头／向高潮层层推进的蒙太奇／让乐曲的高涨与情感的顶点重合。'
        },
        yokoku: {
            persona: '系列构成（宣传担当）',
            text: '这是一段下集预告风格的影像。可运用预告的惯用语汇：短促摘要镜头的连续堆叠／一两句引人遐想的台词「」／点到为止、不亮出核心／最后以黑场或定格画制造对下一集的期待。可以基于既有设定·伏笔暗示下一集篇幅的展开，但不得明示重大转折或结局。'
        },
        highlight: {
            persona: '系列构成（宣传担当）',
            text: '这是一段本季高光（总集篇PV）风格的影像。从已播出的事件中挑选名场面进行蒙太奇：把情感起伏排成波浪／需要时可加入体现关系变化的对比（初遇时→现在）／最后以象征整个故事的一张画收尾。'
        },
        // バトル（三期）：B文書（社区参考プロンプト）の骨架を踏襲——空間提示→動作の一方向エスカレーション→
        // クライマックス直前の静止→最大の一撃→決め画。styleMenuRule が後段に必ず付くので、ここでは
        // 「〜すること」を連発せず highlight カードと同じ「〜してもよい」緩和句式に寄せる（引き出し口調の護り）
        battle: {
            persona: '动作戏演出导演',
            text: '这是一段战斗场景风格的影像。可运用战斗演出的惯用语汇：先交代作为战场的空间／动作无论徒手·武器·异能，都单向地逐级升温（挑衅→首击→交锋→逼入绝境，等）／高潮前可插入一瞬静止（蓄势·半秒的静默）／随后向最重的一击层层压上／最后以定格决胜画收尾（若能回收开头展示过的武器·架势·背景等要素更佳）。斩击轨迹·冲击波·残影·瓦砾碎片飞散·撞击火花·速度线式的速度感——这些语汇也可作为演出工具选用。时长较短时，不要害怕短镜头的连续堆叠。'
        }
    },
    _PV_MOOD_CARDS: {
        iyashi: '基调是「治愈」：柔和的光·暖色·舒缓的运镜。镜头偏长，动作是微风、光尘般轻柔的东西。',
        setsunai: '基调是「揪心」：黄昏·雨·逆光·偏蓝的色调。运用体现错过与距离感的构图，善用舒缓的留白。',
        moeru: '基调是「燃」：快速的镜头切换·仰角或倾斜的构图·突进疾驰等有气势的单向动作。对比强烈的色彩。',
        kibou: '基调是「希望」：朝阳·不断上升的运镜·开阔的远景。营造画面从阴影走向光的变化。',
        shukufuku: '基调是「祝福」：光尘与花瓣·温暖的白·聚拢的人群。用柔和的推近捕捉表情。'
    },

    // AIにおまかせ・seedText 三態のしきい値（二期）：400字は「この尺（15秒PV基準）では原作全文を
    // 映像化しきれない」水準の目安（丁寧に描けるのはワンシーン程度）であり、同時に「方向性」用途の
    // 短文にも十分な余地を残すために選んだ境界値。この値未満は加筆で尺を満たす方向性、以上は選段の対象
    _PV_EXCERPT_THRESHOLD: 400,

    // 台词·旁白语言（2026-08-23）：分镜描述恒中文（目标视频模型均为中文模型），
    // 「」内要朗读的文字跟用户选择走。pace 是台词字数/秒的换算（检品⑨同源）
    _PV_DIALOGUE_LANGS: {
        ja: { name: '日语', pace: '按日语计每秒6个字左右' },
        zh: { name: '中文', pace: '按中文计每秒4个字左右' },
        en: { name: '英语', pace: '按英语计每秒2〜3个单词' }
    },

    // 内联浮层（そのまま生成／推敲つき生成）：npc-role-dropdown と同じ姿勢——position:relative の wrap + 外部クリックで閉じる
    _pvAiWriteToggleMenu(e) {
        if (e) e.stopPropagation();
        const menu = document.getElementById('nicoPvAiMenu');
        if (!menu) return;
        const willShow = menu.style.display === 'none' || !menu.style.display;
        menu.style.display = willShow ? 'block' : 'none';
        if (willShow && !this._pvAiMenuOutsideBound) {
            this._pvAiMenuOutsideBound = true;
            document.addEventListener('click', e => this._pvAiWriteMenuOutsideClick(e));
        }
    },

    _pvAiWriteMenuOutsideClick(e) {
        const menu = document.getElementById('nicoPvAiMenu');
        if (!menu || menu.style.display === 'none') return;
        const wrap = menu.closest('.nico-pv-ai-wrap');
        if (wrap && !wrap.contains(e.target)) menu.style.display = 'none';
    },

    _pvAiWriteChoose(polish) {
        const menu = document.getElementById('nicoPvAiMenu');
        if (menu) menu.style.display = 'none';
        this._pvAiWrite(polish);
    },

    // ===== AIにおまかせ：世界観から絵コンテ（複数カットの演出台本）を書く（_generateVideos と同じ注入三件套） =====
    // 選択済みの参考図/参考音声/歌詞をそのまま演出素材として認識させる——参考図は容姿参照であって構図の指定ではない
    // （冒頭カットが必ず正面立ち絵になるとは限らない）。並発防呆は Utils.withLock（CLAUDE.md 铁律）
    // polish（v2.243、任意）：true なら生成後に「制作進行」人格で一回だけ検品パスを追加する
    async _pvAiWrite(polish) {
        const textarea = document.getElementById('nicoPvPrompt');
        if (!textarea) return;
        const btn = document.getElementById('nicoPvAiWriteBtn');
        const label = document.getElementById('nicoPvAiWriteLabel');

        await Utils.withLock('nicoPvAiWrite', async () => {
            if (btn) btn.disabled = true;
            if (label) label.textContent = I18n.t('nico.pv_ai_writing', '生成中…');

            try {
                const worldContext = (typeof Forum !== 'undefined' && Forum.getWorldContext) ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');
                const seedText = (textarea.value || '').trim();

                // 台词·旁白语言（2026-08-23）：分镜描述恒中文，「」内跟这个走
                const dialogueLang = document.getElementById('nicoPvDialogueLang')?.value || this._ensureData().pvDialogueLang || 'ja';
                const langInfo = this._PV_DIALOGUE_LANGS[dialogueLang] || this._PV_DIALOGUE_LANGS.ja;

                // 演出タイプ×ムード（v2.243）：どちらも「指定なし」なら以下は全部空になり、通用演出監督の prompt と一字一句同じまま
                const styleType = document.getElementById('nicoPvStyleType')?.value || '';
                const styleMood = document.getElementById('nicoPvStyleMood')?.value || '';
                // v2.246 review（A3）：予告/ハイライトはフィールド自体を隠しているだけで this._pvRefAudio や
                // textarea の値はまだ残っている（_pvUpdateAudioLyricsVisibility は表示切替のみで値は消さない）。
                // 隠れている間の AI 生成にその残留値を読ませない——底の値そのものは触らない、この回の生成でだけ無視する
                const hideForType = (styleType === 'yokoku' || styleType === 'highlight');
                const typeCard = this._PV_STYLE_CARDS[styleType] || null;
                const moodCardText = this._PV_MOOD_CARDS[styleMood] || '';
                const directorIdentity = typeCard ? typeCard.persona : '操刀官方PV的演出导演';
                const duration = parseInt(document.getElementById('nicoPvDuration')?.value, 10) || 10;
                // カット数は尺（duration）に比例させる（二期）：下限は「4秒に1カットは切れる」目安、
                // 上限は ED は「少なめ」の演出意図をそのまま反映して下限+1に詰め、それ以外は
                // 「2.5秒に1カットまで詰めてよい」目安。ED カードが「少なめ」を明言するので出力形式の
                // 指示もそちらに合わせる（二重指示の矛盾を残さない）
                const cutMin = Math.max(2, Math.ceil(duration / 4));
                const cutMax = (styleType === 'ed') ? cutMin + 1 : Math.max(cutMin + 1, Math.floor(duration / 2.5));
                const cutRange = `${cutMin}〜${cutMax}`;
                // 字数上限随尺缩放（2026-08-23 中文化重标定）：中文信息密度高于日语假名混写，
                // 30秒按官方 2.5 指南的长例约 900 字级封顶；「中文500字以内」是 1.x 时代旧文档的警告，不再适用
                const charBudget = Math.min(900, Math.max(300, duration * 35));
                const styleCardTexts = [typeCard ? typeCard.text : '', moodCardText].filter(Boolean);
                // v2.246.1：定番語彙は引き出しでありチェックリストではない——総則を必ず添える。
                // カードの「〜すること」口調がユーザーの seedText（軟性区画）より強く読まれ、
                // 「ただ踊るだけの片段」にも対比フラッシュバックが毎回挿入される実測があった
                const styleMenuRule = '以上惯用语汇是演出的工具抽屉，没有全部塞进片子的义务。用户的方向性足够具体时以它为最优先，不合适的语汇不要用。';
                const styleSection = styleCardTexts.length ? `\n## 演出风格\n${styleCardTexts.join('\n\n')}\n\n${styleMenuRule}\n` : '';
                const eventLimit = (styleType === 'highlight') ? 8 : 3;   // ハイライトは名場面の材料を厚めに

                // 撮影の引き出し：既存の「カメラワーク（寄り・引き・パンなど）」一文だけだと
                // 運鏡の語彙がその数語に寄りがち（2026-08-18 社区プロンプト対比で判明した弱点）——
                // 景別・運鏡・つなぎの定番術語を常時注入して選択肢を広げる。styleMenuRule と同じ理由で、
                // 末尾の護りの一文は必須（語彙表を「全部使うべきチェックリスト」と誤読させない）
                const cinematographySection = `\n## 拍摄手法工具箱\n景别·构图：特写／半身近景／远景（拉开的画面）／俯拍／仰拍／过肩镜头／剪影／主观视角\n运镜：推镜·拉镜／横移（跟踪）／上升·下降（升降镜头）／环绕／手持晃动感／移焦（焦点从前景平滑转到背景）\n镜头衔接：匹配剪辑／闪白转场／淡入淡出／动作衔接\n\n以上术语是演出的工具抽屉，没有全部用上的义务。只挑选符合各镜头演出意图的手法，写成具体的运动。\n`;

                // 素材リスト（図N）：createTask が content 配列に積む順番は refImgIds 配列の順番そのまま
                // （画廊選択器は url 解決できない項目をすでに選択肢から弾いている——欠番は基本起きない想定）。
                // modelInfo.ref が false（Seedance 1.x 系）の時は createTask 側も画像を一切送らないので、ここも空扱いにする
                const modelSel = document.getElementById('nicoPvModel');
                const modelInfo = this._pvModelInfo(modelSel ? modelSel.value : '');
                const refImgIds = modelInfo.ref ? (this._pvRefImgIds || []) : [];
                const charRefs = (typeof Broadcast !== 'undefined' && Broadcast.getAllCharRefs) ? Broadcast.getAllCharRefs() : [];
                const assetLines = refImgIds.map((id, i) => {
                    const ref = charRefs.find(c => c.blobId === id);
                    return (ref && ref.name)
                        ? `图${i + 1}：${ref.name}的立绘（外貌参照）`
                        : `图${i + 1}：用户提供的参考插画`;
                });
                const hasAssets = assetLines.length > 0;
                const assetSection = hasAssets ? `\n## 素材列表\n${assetLines.join('\n')}\n` : '';

                // 参考音声＋歌詞：時長は _pvRefAudio.duration（秒）。歌詞は台詞ではないので「」規則の対象外（下のルールで明示禁止）
                // hideForType 時は null/空扱い（A3）——フィールドが隠れている演出タイプでは音声・歌詞を無視する
                const refAudio = hideForType ? null : this._pvRefAudio;
                const lyrics = hideForType ? '' : (document.getElementById('nicoPvLyrics')?.value || '').trim();
                let audioSection = '';
                if (refAudio) {
                    audioSection = `\n参考音声（BGM）：约${Math.round(refAudio.duration)}秒的乐曲区间\n`;
                    if (lyrics) audioSection += `歌词:\n${lyrics}\n`;
                }
                const hasLyrics = !!(refAudio && lyrics);

                const materialBullet = hasAssets ? '- 使用的素材（图N。只引用上方素材列表里存在的素材，不涉及的镜头省略此项）\n' : '';
                // 参考図なし版は「外見的特徴で示すこと」だけだと多カット間の容姿一貫性を何も
                // 保証していない——冒頭カットで容姿を確立し全カットで一貫させる要求を同じ文に流し込む
                // （図N機制がある版は既にそれで一貫性が担保されているため一字も変えない）
                const characterRefRule = hasAssets
                    ? '- 影像描述中不要直接写角色名。指代人物时用“图N的人物”或外貌特征来表示\n'
                    : '- 影像描述中不要直接写角色名。指代人物时用外貌特征表示，并在开头的镜头里确立其外貌（发型·服装的要点），此后所有镜头保持同一外貌\n';
                const compositionFreedomRule = hasAssets
                    ? '- 参考图只是外貌的参照，构图可按演出意图自由决定。开头镜头不必是立绘式的正面构图——侧脸·背影·远景·局部特写等，选那一瞬间演出效果最好的构图\n'
                    : '';
                // 時間配分は「## 尺」に一元化（参考音声の時長と duration 選択が食い違う場合に矛盾指示を出さない）
                const lyricsRule = hasLyrics
                    ? '- 歌词不是台词，绝对不要放进「」。镜头切换尽量对齐歌词行与行的分界，每个镜头的画面呼应对应歌词的意象（具体或隐喻均可）。时间分配遵循上方的时长\n'
                    : '';
                // 見せ場の骨架意識：「必ず入れるべきカット」として義務化せず引き出しとして添える——
                // 演出タイプ卡（OP/ED/挿入歌など）やユーザーの seedText と矛盾する場合はそちらが優先
                const showcaseRule = '- 注意PV应有的看点（人物面孔清晰可见的镜头、情绪的特写、定格的决胜画）。与演出类型或用户方向性不合时，以后者优先\n';
                // 音響設計：modelInfo.audio は _pvModelInfo() が具体的な model id で判定済み
                // （ark は 1.0系のみ無声、H3 は恒有声、minimax_v1 は全系無声）——有声モデルにだけ注入し、
                // 無声モデルではプロンプトが改修前と一字一句変わらないようにする
                const soundSection = modelInfo.audio
                    ? '\n## 声音设计\n- 每个镜头末尾视需要补一句环境音·动作音效\n- 注意音乐性的起伏：高潮镜头做足声势，高潮前的一瞬静默与结尾的余韵也是演出手段\n'
                    : '';

                // 4刀：seedText の三態（空／短中=方向性のヒント／長文=原作選段モード）。
                // isExcerptMode は _pvPolishStoryboard 側にも ctx で渡し、検品 checklist の①判定を分岐させる
                const isExcerptMode = seedText.length >= this._PV_EXCERPT_THRESHOLD;
                let seedSection = '';
                if (seedText && isExcerptMode) {
                    // 長文（原作選段モード）：全文を通読させ、尺に合う一場面だけを選ばせる。
                    // 選定結果は絵コンテ本文の前に「選定場面：〜」一行だけ許可する（出力形式側にも例外を反映）
                    seedSection = `\n## 原作文本（从中选取一个场面）\n${seedText}\n把全文在${duration}秒内全部影像化是不够的。请先通读全文，按「有视觉上的动感／有情感的高峰／在单一地点·时间内完结／不需要前后文说明也能看懂」的标准，选出最能出效果的一个场面。在分镜正文之前单独写一行“选定场面：〜”，只把这个场面分镜化。原作中的台词尽量使用原文原句（保持原文的语言，此规则优先于台词语言设定）。\n`;
                } else if (seedText) {
                    // 短中文：方向性の意図を核に、設定と矛盾しない範囲でディテールを補って尺を満たす（捏造とは別軸の要求）
                    seedSection = `\n## 用户已想好的方向性\n${seedText}\n用户的方向性较短时，以其意图为核心，在不与作品世界矛盾的范围内，把场面细节（地点·时间段·光线·小道具·人物举止）具体化以填满时长。不得发明设定中不存在的事件·角色·关系。\n`;
                }
                const outputFormatIntro = isExcerptMode
                    ? '不要添加说明文或标题，只输出分镜正文（第一行“选定场面：〜”、第二行“概述：〜”与结尾的“整体氛围：〜”一行是格式的一部分，必须保留）。'
                    : '不要添加说明文或标题，只输出分镜正文（开头的“概述：〜”一行与结尾的“整体氛围：〜”一行是格式的一部分，必须保留）。';

                const systemPrompt = `你是这部番剧的${directorIdentity}。你不是撰写提示词的助手，而是基于以下作品世界、实际负责画面判断的主创。请为视频生成AI撰写分镜（多个镜头的演出台本）。分镜的画面·动作·运镜描述一律用中文书写；「」内的台词·旁白一律用${langInfo.name}书写。

## 作品世界信息
${worldContext || '（世界观未设定——不得捏造角色名·CP·故事事件等具体作品信息。按一般的动画PV来构成）'}
${Utils.PROMPTS.infoAccessRule()}
${typeof Utils !== 'undefined' && Utils.getEventContextPrompt ? Utils.getEventContextPrompt(eventLimit) : ''}
${assetSection}${audioSection}${seedSection}
## 时长
总计 ${duration} 秒

## 输出格式（严格遵守）
${outputFormatIntro}按「镜头1（0-4秒）」「镜头2（4-8秒）」的格式，起止秒数连续、总和为${duration}秒，分成${cutRange}个镜头。正文第一行写“概述：〜”——用一句话概括整体（主体+地点+事件+风格）；正文最后一行写“整体氛围：〜”——贯穿全片的画风·色调·光线·画质。每个镜头包含：
${materialBullet}- 画面的构图·画面营造，写明画面主体及其动作（谁/什么在画面里、在做什么）
- 摄影机运动（推·拉·摇·移·跟等，必须指定明确的运动）
- 单向推进的动作链（用2〜3个连续动作填满秒数）
- 只有台词·旁白才放进「」（钩括号）——音声生成模型只朗读「」内的文字，一律用${langInfo.name}书写
- 台词长度要与该镜头的秒数相称（${langInfo.pace}）
${cinematographySection}${styleSection}${soundSection}
## 规则
- 不要写静止的镜头（“静止”“保持原样”等描述）——所有镜头都要有明确的摄影机运动
- 动作必须单向推进。不要写“迈出一步又收回”这类往复·回退的动作
- 情绪要通过身体动作·表情·画面营造来呈现。不要直接写“悲伤”“开心”等抽象情感词
- 场景中按剧情应有人物时，不得用纯道具·空镜代替人物；群像场面用概括性的群体动作描写（例：一群少女随乐声起舞、衣袖翻飞），不要把有人的场面简化成静物。空镜只在有明确演出意图时使用
${characterRefRule}${compositionFreedomRule}${lyricsRule}- 全篇以${charBudget}字以内为准
${showcaseRule}- 🚫 不得捏造设定中不存在的角色·故事`;

                const messages = [{ role: 'user', content: '请写分镜。' }];
                let raw = (await Utils.callChatAPI(messages, systemPrompt) || '').trim();

                if (polish) {
                    if (label) label.textContent = I18n.t('nico.pv_ai_polishing', '推敲中…');
                    raw = await this._pvPolishStoryboard(raw, { duration, hasAssets, assetLines, hasLyrics, lyrics, charBudget, isExcerptMode, seedText, langInfo });
                }

                textarea.value = raw;
            } catch (e) {
                console.error('[Niconico] PV AI write error:', e);
                Utils.showToast(I18n.t('t.nico_gen_error', '⚠️ 生成エラー: ') + e.message, 4000);
            } finally {
                if (btn) btn.disabled = false;
                if (label) label.textContent = I18n.t('nico.pv_ai_write_btn', 'AIにおまかせ');
            }
        }, () => Utils.showToast(I18n.t('nico.pv_ai_writing', '生成中…')));
    },

    // 推敲：分镜生成后的可选检品通道。用「制作进行」这一干净人格只修正违规之处——不传世界观全文
    // （检品不需要，节省 token）。ctx 沿用 _pvAiWrite 已经拼好的值。2026-08-23 中文化：产出与检品 prompt
    // 均改中文书写，新增⑩对照用户方向性抓主体丢失（对症カット2 事故：群像被压缩成静物道具）
    async _pvPolishStoryboard(storyboard, ctx) {
        const { duration, hasAssets, assetLines, hasLyrics, lyrics, charBudget, isExcerptMode, seedText, langInfo } = ctx;
        const assetSection = hasAssets ? `\n## 素材列表\n${assetLines.join('\n')}\n` : '';
        const lyricsSection = hasLyrics ? `\n歌词:\n${lyrics}\n` : '';
        const item5 = hasAssets ? '没有直写角色名（只用图N·外貌特征指代）' : '没有直写角色名（用外貌特征指代）';
        const item7 = hasAssets ? '没有添加素材列表之外的人物·明显突兀的专有名词' : '没有添加对作品而言明显突兀的专有名词';
        // ⑩（2026-08-23）：只在「方向性」形态且有 seedText 时启用——对照用户构想抓主体丢失
        //（群像被简化成静物一类）。选段模式不传全文（token 考量），⑩不出现
        const hasSeedCheck = !!(seedText && !isExcerptMode);
        const item10 = hasSeedCheck ? ' ⑩对照下方用户的方向性，关键的画面主体·事件没有丢失、没有被道具或空镜替代' : '';
        const seedSectionForPolish = hasSeedCheck ? `\n## 用户的方向性（⑩的对照基准）\n${seedText}\n` : '';
        const excerptNote = isExcerptMode
            ? '※第一行“选定场面：〜”也是格式的一部分，不得删除，①的秒数检查同样不包含该行。'
            : '';

        const systemPrompt = `你是这部番剧的制作进行。请对照检查清单检验以下分镜，只对违规之处做最小限度的修正，输出修正后的完成稿。没有问题就原样输出。只输出分镜正文。

## 检查清单
①秒数连续且总和与时长一致 ②每个镜头都有明确的摄影机运动 ③动作单向推进 ④没有直写抽象情感词 ⑤${item5} ⑥歌词没有被放进「」 ⑦${item7} ⑧全篇${charBudget}字以内 ⑨台词长度与镜头秒数相称（${langInfo.pace}）${item10}
※开头的“概述：〜”一行与结尾的“整体氛围：〜”一行是格式的一部分，不得删除；①的秒数检查不包含这些行。${excerptNote}

## 时长
总计 ${duration} 秒
${assetSection}${lyricsSection}${seedSectionForPolish}
## 待检分镜
${storyboard}`;

        const messages = [{ role: 'user', content: '请检品。' }];
        const raw = await Utils.callChatAPI(messages, systemPrompt);
        return (raw || '').trim() || storyboard;   // 空应答保底不变
    },

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
            // 画面比率（v2.240）：既定 16:9——PV は基本この尺寸。行が非表示（v1/参考図非対応）でも読んで問題ない：
            // createTask 側で参考図なし＝恒 16:9、v1 分岐＝ratio 不使用なので、この値は実際に効く場面でだけ効く
            const ratio = document.getElementById('nicoPvRatio')?.value || '16:9';
            const tweetSel = document.getElementById('nicoPvTweetAccount');
            const tweetAccountId = (tweetSel && tweetSel.value) ? tweetSel.value : null;

            const btn = document.getElementById('nicoPvSubmitBtn');
            if (btn) btn.disabled = true;
            try {
                // 软闸①（v2.244）：模型支持参考图但一张都没选——人物一致性没法保证，弹一次确认，不阻断（可能就是要纯文生）
                if (modelInfo.ref && refImgIds.length === 0) {
                    const ok = await this._pvOpenNoRefConfirm();
                    if (!ok) return;
                }

                // 软闸②（v2.246 review A4）：絵コンテ本文引用到図N，但快照里的参考图不够 N 张——多半是「AIにおまかせ」
                // 生成后又手改了参考图选择、或者手写脚本时写了図N却忘了配图。两道软闸各判各的，顺序都触发时按序各弹一次
                const figMatches = prompt.match(/図(\d+)/g) || [];
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
                try {
                    await VideoGen.createTask({
                        prompt, refImgIds, model, resolution, duration, ratio,
                        generateAudio, channelId, tweetAccountId,
                        refAudio: this._pvRefAudio || null   // v1(Hailuo) 时 UI 已隐藏该区域、恒为 null；createTask 内部按渠道分支处理
                    });
                    n.lastPvChannelId = channelId;
                    Utils.saveData();
                    // 提交成功：把「这次真的发出去了」的 id 从会话态里摘掉，防 _closePVModal 的临时图清理误删任务刚接手、
                    // 还要留着重试用的 pvtemp blob。只摘发出去的那部分——如果切到不支持参考图的模型导致 refImgIds 没带上
                    // 之前相册选的临时图，它们会留在 _pvRefImgIds 里，随表单关闭被正常当作「未使用的临时图」清理掉
                    this._pvRefImgIds = (this._pvRefImgIds || []).filter(id => !refImgIds.includes(id));
                    this._closePVModal();
                    Utils.showToast(I18n.t('nico.pv_toast_started', '生成開始！'));
                    this.refreshGenCard();   // 占位卡即时出现（不等第一次轮询）
                } catch (e) {
                    console.error('[Niconico] PV submit error:', e);
                    Utils.showToast(I18n.t('t.nico_gen_error', '⚠️ 生成エラー: ') + e.message, 4000);
                } finally {
                    tempIds.forEach(id => this._pvInFlightTempIds.delete(id));
                    // v2.246 review（C2 变体）：settle 后（in-flight 标记摘掉之后）再查一次表单还在不在——createTask
                    // 这几分钟窗口期间表单被关掉了的话，按「有没有任务接手」做一次真正的孤儿清理：成功路径新任务的
                    // refImgIds 里带着这些 id（stillUsed=true，保留）；失败路径没有任何任务引用（stillUsed=false，删）
                    if (tempIds.length > 0 && !document.getElementById('nicoPvModal')) {
                        for (const id of tempIds) {
                            const stillUsed = VideoGen.tasks().some(t => (t.refImgIds || []).includes(id));
                            if (!stillUsed) await VideoGen.removeBlob(id).catch(e => console.warn('[Niconico] orphan temp blob cleanup failed', e));
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
        const titleText = this._escHtml((task.prompt || '').slice(0, 24));

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
            title: pk.title || (task.prompt || '').slice(0, 20) || I18n.t('nico.detail_title_default', '動画'),
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

    // ===== AI生成: 動画 =====
    async _generateVideos() {
        Utils.showToast(I18n.t('t.nico_generating_videos', '⏳ 動画生成中...'));
        const n = this._ensureData();
        const forumData = AppState.data.forumData || {};
        const worldContext = (typeof Forum !== 'undefined' && Forum.getWorldContext) ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');
        const channelList = (n.channels || []).map(c => `${c.name}（${c.avatarEmoji}）`).join('、');
        const existingTitles = (n.videos || []).slice(-40).map(v => v.title).join('、');  // 只取最近40条去重、防 prompt 无上限膨胀

        const systemPrompt = `あなたはニコニコ動画のコンテンツをシミュレートするAIです。
以下の作品世界に基づいて、リアルなニコニコ動画の投稿情報を生成してください。

## 作品世界の情報
${worldContext || '（世界観未設定 — キャラクター名・CP・ストーリーイベントなど具体的な作品情報を捏造しないこと。一般的なアニメ関連コンテンツとして生成すること）'}
${Utils.PROMPTS.infoAccessRule()}
${typeof Utils !== 'undefined' && Utils.getEventContextPrompt ? Utils.getEventContextPrompt(3) : ''}

## 登録済みチャンネル
${channelList || '（なし — 投稿者名を自由に設定してよい）'}

## 既存動画タイトル（重複禁止）
${existingTitles || '（なし）'}

## 出力形式（厳守）
以下のフォーマットのみを出力すること。各動画を ---VIDEO--- で区切る。

---VIDEO---
TITLE: 動画タイトル
UPLOADER: 投稿者名（既存チャンネルがあればそこから選択）
GENRE: utatte|mad|game|vtuber|odotte|vocaloid|cooking|doujin_pv|anime|music|other
EMOJI: 動画を象徴する絵文字1つ
TAGS: タグ1,タグ2,タグ3,タグ4
DESCRIPTION: 動画説明文（50〜100字）
VIEWS: 再生数（数値）
COMMENTS_COUNT: コメント数（数値）
MYLISTS: マイリスト数（数値）
DURATION: M:SS形式
DANMAKU_1: 弾幕コメント1
DANMAKU_2: 弾幕コメント2
DANMAKU_3: 弾幕コメント3
DANMAKU_4: 弾幕コメント4
DANMAKU_5: 弾幕コメント5
COMMENT_1: 通常コメント1（投稿者名:コメント内容）
COMMENT_2: 通常コメント2（投稿者名:コメント内容）
COMMENT_3: 通常コメント3（投稿者名:コメント内容）
TITLE_TL: TITLEの中国語（簡体字）翻訳
DESC_TL: DESCRIPTIONの中国語（簡体字）翻訳

## ルール
- 3〜5本の動画を生成すること
- ジャンルは歌ってみた、MAD、ゲーム実況、VTuber切り抜き、踊ってみた、VOCALOID、料理、同人PV等を混ぜること
- タイトルはニコニコ動画のノリで（【】や☆を使うなど）
- 弾幕コメントはニコニコのノリで短く（草、888、ここすき、うぽつ等）
- 再生数は100〜500000の範囲でリアルに
- コメント数は再生数の1〜5%程度
- マイリスト数はコメント数の10〜50%程度
- 作品世界のキャラ名・設定を積極的に反映すること
- 既存動画タイトルと重複しないこと
- 🚫 設定にないストーリーを捏造するな`;

        const messages = [{ role: 'user', content: 'ニコニコ動画のコンテンツを生成してください。' }];
        const response = await Utils.callChatAPI(messages, systemPrompt);

        const videos = this._parseVideos(response);
        if (videos.length === 0) {
            throw new Error('動画が生成されませんでした');
        }

        videos.forEach(v => {
            const channel = (n.channels || []).find(c => c.name === v.uploaderName);
            const videoId = Utils.generateId();
            const videoObj = {
                id: videoId,
                title: v.title || 'untitled',
                titleTl: v.titleTl || null,
                description: v.description || '',
                descTl: v.descTl || null,
                uploaderName: v.uploaderName || '名無し投稿者',
                channelId: channel ? channel.id : null,
                genre: v.genre || 'other',
                tags: v.tags || [],
                emoji: v.emoji || '🎬',
                duration: v.duration || '3:00',
                views: parseInt(v.views) || Math.floor(Math.random() * 50000),
                commentCount: parseInt(v.commentCount) || 0,
                mylists: parseInt(v.mylists) || 0,
                uploadedAt: Date.now() - Math.floor(Math.random() * 86400000 * 7)
            };
            n.videos.push(videoObj);

            // チャンネルの動画数を更新
            if (channel) {
                channel.videoCount = (channel.videoCount || 0) + 1;
            }

            // 弾幕コメントと通常コメントを保存
            const allComments = [];
            (v.danmaku || []).forEach((text, i) => {
                allComments.push({
                    id: Utils.generateId(),
                    authorName: '',
                    text: text,
                    timestamp: this._randomTimestamp(v.duration),
                    color: this._DANMAKU_COLORS[Math.floor(Math.random() * this._DANMAKU_COLORS.length)]
                });
            });
            (v.comments || []).forEach(c => {
                allComments.push({
                    id: Utils.generateId(),
                    authorName: c.author || '匿名',
                    text: c.text || '',
                    timestamp: '',
                    color: null
                });
            });
            if (allComments.length > 0) {
                n.comments[videoId] = allComments;
            }
        });

        Utils.saveData();

        // イベント発射
        if (videos.length > 0 && typeof Utils !== 'undefined' && Utils.emitEvent) {
            const titles = videos.slice(0, 3).map(v => v.title).join('、');
            Utils.emitEvent('nico_video_published', 'niconico', { title: `新着${videos.length}本`, summary: titles });
        }

        Utils.showToast(I18n.t('t.nico_videos_generated', {n: videos.length}));
        this.switchTab('new', true);
    },

    // ===== AI生成: チャンネル =====
    async _generateChannels() {
        const forumData = AppState.data.forumData || {};
        const worldContext = (typeof Forum !== 'undefined' && Forum.getWorldContext) ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');
        Utils.showToast(I18n.t('t.nico_generating_channels', '⏳ チャンネル生成中...'));
        const n = this._ensureData();
        const existingChannels = (n.channels || []).map(c => c.name).join('、');

        const systemPrompt = `あなたはニコニコ動画のチャンネルをシミュレートするAIです。
以下の作品世界に対して、リアルなニコニコ動画チャンネル情報を生成してください。

## 作品世界の情報
${worldContext || '（世界観未設定 — キャラクター名・CP・ストーリーイベントなど具体的な作品情報を捏造しないこと。一般的なアニメ関連コンテンツとして生成すること）'}
${Utils.PROMPTS.infoAccessRule()}
${typeof Utils !== 'undefined' && Utils.getEventContextPrompt ? Utils.getEventContextPrompt(3) : ''}

## 既存チャンネル（重複禁止）
${existingChannels || '（なし）'}

## 出力形式（厳守）
各チャンネルを ---CHANNEL--- で区切る。

---CHANNEL---
NAME: チャンネル名
EMOJI: チャンネルアイコン絵文字1つ
COLOR: アバター背景色（#hex）
DESCRIPTION: チャンネル紹介文（50〜100字）
SUBSCRIBERS: 登録者数（数値）

## ルール
- 2〜3チャンネルを生成すること
- チャンネル名はニコニコらしい名前（歌い手、実況者、MAD職人、VTuberっぽい名前など）
- 紹介文はニコニコのチャンネルページにありそうな雰囲気で
- 登録者数は100〜100000の範囲でリアルに
- 作品世界に関連した活動内容にすること
- 既存チャンネルと名前が重複しないこと
- 🚫 設定にないストーリーを捏造するな`;

        const messages = [{ role: 'user', content: 'ニコニコ動画チャンネルを生成してください。' }];
        const response = await Utils.callChatAPI(messages, systemPrompt);

        const channels = this._parseChannels(response);
        if (channels.length === 0) {
            throw new Error('チャンネルが生成されませんでした');
        }

        channels.forEach(c => {
            n.channels.push({
                id: Utils.generateId(),
                name: c.name || 'unnamed',
                description: c.description || '',
                avatarEmoji: c.emoji || '📺',
                avatarColor: c.color || this._AVATAR_COLORS[Math.floor(Math.random() * this._AVATAR_COLORS.length)],
                subscriberCount: parseInt(c.subscribers) || Math.floor(Math.random() * 10000),
                videoCount: 0,
                createdAt: Date.now()
            });
        });

        Utils.saveData();
        Utils.showToast(I18n.t('t.nico_channels_generated', {n: channels.length}));
        this.switchTab('channel', true);
    },

    // ===== ランキング生成（既存動画から算出）=====
    _generateRankings() {
        const n = this._ensureData();
        const videos = (n.videos || []).slice();

        if (videos.length === 0) {
            Utils.showToast(I18n.t('t.nico_no_videos', '⚠️ 動画がありません'));
            return;
        }

        // 再生数でソートして上位10件
        videos.sort((a, b) => (b.views || 0) - (a.views || 0));
        const topVideos = videos.slice(0, 10);

        const ranking = {
            period: '週間',
            createdAt: Date.now(),
            items: topVideos.map((v, i) => ({
                videoId: v.id,
                rank: i + 1
            }))
        };

        n.rankings.push(ranking);
        Utils.saveData();
        Utils.showToast(I18n.t('t.nico_ranking_generated', '✓ ランキング生成完了'));
        this.switchTab('ranking', true);
    },

    // ===== AI生成: 追加コメント =====
    async _generateMoreComments(videoId) {
        const n = this._ensureData();
        const v = (n.videos || []).find(x => x.id === videoId);
        if (!v) return;

        Utils.showToast(I18n.t('t.nico_generating_comments', '⏳ コメント生成中...'));
        const forumData = AppState.data.forumData || {};
        const worldContext = (typeof Forum !== 'undefined' && Forum.getWorldContext) ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');
        const existingComments = (n.comments[videoId] || []).slice(-50).map(c => c.text).join('、');  // 只取最近50条去重、防 prompt 无上限膨胀

        const systemPrompt = `あなたはニコニコ動画のコメント欄をシミュレートするAIです。
以下の動画に対するリアルなコメントを生成してください。

## 作品世界の情報
${worldContext || '（世界観未設定）'}
${Utils.PROMPTS.infoAccessRule()}

## 動画情報
タイトル: ${v.title}
ジャンル: ${this._GENRES_JA[v.genre] || v.genre}
説明: ${v.description || ''}
タグ: ${(v.tags || []).join(', ')}

## 既存コメント（重複を避けること）
${existingComments || '（なし）'}

## 出力形式（厳守）
各コメントを1行ずつ出力。弾幕コメントとテキストコメントを混ぜる。
フォーマット: DANMAKU:コメント本文 または COMMENT:投稿者名:コメント本文

## ルール
- 5〜8件のコメントを生成すること
- 弾幕コメントはニコニコのノリで短く（草、888、ここすき、うぽつ、キタ━━━等）
- テキストコメントは感想、考察、ネタなど
- ニコニコ動画のコメント文化を反映すること
- 作品世界のキャラ名やネタを積極的に使うこと
- 🚫 設定にないストーリーを捏造するな`;

        const messages = [{ role: 'user', content: `「${v.title}」のコメントを生成してください。` }];
        const response = await Utils.callChatAPI(messages, systemPrompt);

        const lines = response.split('\n').filter(l => l.trim());
        const newComments = [];

        lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith('DANMAKU:')) {
                newComments.push({
                    id: Utils.generateId(),
                    authorName: '',
                    text: trimmed.replace('DANMAKU:', '').trim(),
                    timestamp: this._randomTimestamp(v.duration),
                    color: this._DANMAKU_COLORS[Math.floor(Math.random() * this._DANMAKU_COLORS.length)]
                });
            } else if (trimmed.startsWith('COMMENT:')) {
                const rest = trimmed.replace('COMMENT:', '').trim();
                const colonIdx = rest.indexOf(':');
                if (colonIdx > 0) {
                    newComments.push({
                        id: Utils.generateId(),
                        authorName: rest.substring(0, colonIdx).trim(),
                        text: rest.substring(colonIdx + 1).trim(),
                        timestamp: '',
                        color: null
                    });
                } else {
                    newComments.push({
                        id: Utils.generateId(),
                        authorName: '匿名',
                        text: rest,
                        timestamp: '',
                        color: null
                    });
                }
            }
        });

        if (newComments.length === 0) {
            Utils.showToast(I18n.t('t.nico_comments_failed', '⚠️ コメント生成に失敗しました'));
            return;
        }

        if (!n.comments[videoId]) n.comments[videoId] = [];
        n.comments[videoId].push(...newComments);

        // コメント数を更新
        v.commentCount = (v.commentCount || 0) + newComments.length;

        Utils.saveData();
        Utils.showToast(I18n.t('t.nico_comments_added', {n: newComments.length}));

        // 動画詳細画面なら再描画
        if (AppState.currentScreen === 'niconico-detail' && this.currentVideoId === videoId) {
            this.renderVideoDetail();
        }
    },

    // ===== ユーザーコメント投稿 =====
    addComment(videoId) {
        const input = document.getElementById('nicoCommentInput');
        if (!input) return;
        const text = input.value.trim();
        if (!text) return;

        const n = this._ensureData();
        if (!n.comments[videoId]) n.comments[videoId] = [];

        const userName = n.settings.userName || 'ユーザー';
        n.comments[videoId].push({
            id: Utils.generateId(),
            authorName: userName,
            text: text,
            timestamp: '',
            color: null
        });

        // コメント数を更新
        const v = (n.videos || []).find(x => x.id === videoId);
        if (v) v.commentCount = (v.commentCount || 0) + 1;

        Utils.saveData();
        input.value = '';
        Utils.showToast(I18n.t('t.nico_commented', '💬 コメントしました'));

        // 再描画
        if (AppState.currentScreen === 'niconico-detail') {
            this.renderVideoDetail();
        }
    },

    // ===== マイリスト操作 =====
    toggleMylist(videoId) {
        const n = this._ensureData();
        const idx = n.mylist.indexOf(videoId);
        if (idx >= 0) {
            n.mylist.splice(idx, 1);
            const v = (n.videos || []).find(x => x.id === videoId);
            if (v) v.mylists = Math.max(0, (v.mylists || 0) - 1);
            Utils.showToast(I18n.t('t.nico_mylist_removed', 'マイリストから削除しました'));
        } else {
            n.mylist.push(videoId);
            const v = (n.videos || []).find(x => x.id === videoId);
            if (v) v.mylists = (v.mylists || 0) + 1;
            Utils.showToast(I18n.t('t.nico_mylist_added', '★ マイリストに追加しました'));
        }
        Utils.saveData();

        // 再描画
        if (AppState.currentScreen === 'niconico-detail') {
            this.renderVideoDetail();
        }
    },

    // ===== LINEで共有 =====
    shareToLine(videoId) {
        const n = this._ensureData();
        const video = (n.videos || []).find(v => v.id === videoId);
        if (!video) return;
        if (typeof LineTalk !== 'undefined') {
            LineTalk.showShareCharSelect('niconico', {
                title: video.title || '',
                emoji: video.emoji || '🎬',
                views: this._fmtNum(video.views || 0),
                videoId: video.id
            });
        }
    },

    // ===== チャンネルフォロー =====
    toggleFollowChannel(channelId) {
        const n = this._ensureData();
        const idx = (n.followedChannels || []).indexOf(channelId);
        if (idx >= 0) {
            n.followedChannels.splice(idx, 1);
            Utils.showToast(I18n.t('t.nico_unfollowed', 'フォロー解除しました'));
        } else {
            n.followedChannels.push(channelId);
            Utils.showToast(I18n.t('t.nico_followed', '★ フォローしました'));
        }
        Utils.saveData();

        if (AppState.currentScreen === 'niconico-channel') {
            this.renderChannelPage();
        }
    },

    // ===== 弾幕アニメーション =====
    startDanmaku(videoId) {
        const n = this._ensureData();
        const comments = (n.comments[videoId] || []).filter(c => c.color);
        if (comments.length === 0) {
            Utils.showToast(I18n.t('t.nico_no_danmaku', '弾幕コメントがありません'));
            return;
        }

        const track = document.getElementById('nicoDanmakuTrack');
        if (!track) return;

        // 前回の弾幕を停止
        this._stopDanmaku();
        this._danmakuActive = true;

        // プレースホルダーを非表示
        const placeholder = track.querySelector('.nico-danmaku-placeholder');
        if (placeholder) placeholder.style.display = 'none';

        // 各コメントを順次表示
        let delay = 0;
        comments.forEach((comment, i) => {
            const randomDelay = delay + Math.random() * 2000;
            const timerId = setTimeout(() => {
                if (!this._danmakuActive) return;

                const span = document.createElement('span');
                span.className = 'nico-danmaku';
                span.textContent = comment.text;
                span.style.color = comment.color || '#fff';
                span.style.top = Math.floor(Math.random() * 180) + 'px';
                const duration = 6 + Math.random() * 6;
                span.style.animationDuration = duration + 's';

                track.appendChild(span);

                // アニメーション終了後に削除
                setTimeout(() => {
                    if (span.parentNode) span.parentNode.removeChild(span);
                }, duration * 1000 + 100);
            }, randomDelay);

            delay += 500 + Math.random() * 1500;
        });

        // 全弾幕表示完了後にリセット
        this._danmakuTimer = setTimeout(() => {
            this._danmakuActive = false;
            if (placeholder) placeholder.style.display = '';
        }, delay + 15000);
    },

    _stopDanmaku() {
        this._danmakuActive = false;
        if (this._danmakuTimer) {
            clearTimeout(this._danmakuTimer);
            this._danmakuTimer = null;
        }
        const track = document.getElementById('nicoDanmakuTrack');
        if (track) {
            track.querySelectorAll('.nico-danmaku').forEach(el => el.remove());
            const placeholder = track.querySelector('.nico-danmaku-placeholder');
            if (placeholder) placeholder.style.display = '';
        }
    },

    // ═══════════════════════════════════════════════════════════
    // オーディオドラマ専用：詳細レンダー + 順次再生プレイヤー
    // ═══════════════════════════════════════════════════════════
    _audioPlayer: null,    // HTMLAudioElement
    _audioCurrentIdx: -1,
    _audioCurrentVideoId: null,
    _audioBlobUrls: [],    // 当前播放中的 blob URLs，离开时 revoke

    _renderAudioDramaDetail(content, v, n) {
        const segments = (v.audioSegments || []).filter(s => s.audioId);
        const inMylist = (n.mylist || []).includes(v.id);
        const tags = v.tags || [];
        const tagHtml = tags.length ? `<div class="nico-detail-tags">${tags.map(t => `<span class="nico-tag">${this._escHtml(t)}</span>`).join('')}</div>` : '';

        // segment 列表（点击跳转到该段）
        const segListHtml = segments.map((s, i) => `
            <div class="nico-audio-seg" data-idx="${i}" onclick="Niconico.playSegment(${i})">
                <span class="nico-audio-seg-idx">${(i + 1).toString().padStart(2, '0')}</span>
                <span class="nico-audio-seg-speaker">${this._escHtml(s.speaker || '')}</span>
                <span class="nico-audio-seg-text">${this._escHtml(s.text || '')}</span>
            </div>`).join('');

        content.innerHTML = `
        <div class="nico-audio-player-area">
            <div class="nico-audio-cover">${this._SVG.mic}</div>
            <div class="nico-audio-now" id="nicoAudioNow">
                <div class="nico-audio-now-speaker" id="nicoAudioNowSpeaker">—</div>
                <div class="nico-audio-now-text" id="nicoAudioNowText">${I18n.t('nico.audio_now_idle', '▶ 再生ボタンを押してください')}</div>
            </div>
            <div class="nico-audio-progress">
                <div class="nico-audio-progress-bar"><div class="nico-audio-progress-inner" id="nicoAudioProgressInner" style="width:0%"></div></div>
                <div class="nico-audio-progress-meta" id="nicoAudioProgressMeta">0 / ${segments.length}</div>
            </div>
            <div class="nico-audio-controls">
                <button class="glass-btn" onclick="Niconico.audioPrev()" title="${I18n.t('nico.audio_btn_prev_title', '前へ')}">⏮</button>
                <button class="glass-btn primary" id="nicoAudioPlayBtn" onclick="Niconico.audioPlayPause()">${I18n.t('nico.audio_btn_play', '▶ 再生')}</button>
                <button class="glass-btn" onclick="Niconico.audioNext()" title="${I18n.t('nico.audio_btn_next_title', '次へ')}">⏭</button>
                <button class="glass-btn" onclick="Niconico.audioRestart()" title="${I18n.t('nico.audio_btn_restart_title', '最初から')}">↺</button>
            </div>
        </div>

        <div class="nico-detail-info">
            <h2 class="nico-detail-title">${this._escHtml(v.title)}</h2>
            <div class="nico-detail-stats">
                <span class="nico-stat"><span class="nico-stat-icon">${this._SVG.mic}</span>${I18n.t('nico.audio_count_stat', { n: segments.length })}</span>
                <span>${I18n.t('nico.audio_duration_stat', { duration: this._escHtml(v.duration || '0:00') })}</span>
                <span>${this._timeAgo(v.uploadedAt)}</span>
            </div>
            <div class="nico-detail-uploader"><span>${this._escHtml(v.uploaderName || I18n.t('nico.uploader_unknown', '投稿者不明'))}</span></div>
            ${tagHtml}
            ${v.description ? `<div class="nico-detail-desc">${this._escHtml(v.description).replace(/\n/g, '<br>')}</div>` : ''}
            <div class="nico-detail-actions">
                <button class="glass-btn nico-action-btn ${inMylist ? 'active' : ''}" onclick="Niconico.toggleMylist('${v.id}')">
                    ${inMylist ? I18n.t('nico.btn_mylist_added', '★ マイリスト済') : I18n.t('nico.btn_mylist_add', '☆ マイリスト追加')}
                </button>
                <button class="glass-btn nico-action-btn danger-text" onclick="Niconico.deleteAudioDrama('${v.id}')">
                    <span class="nico-btn-icon">${this._SVG.trash}</span>${I18n.t('nico.audio_btn_delete', '削除')}
                </button>
            </div>
        </div>

        <div class="nico-audio-segments">
            <h3 class="nico-section-title">${I18n.t('nico.audio_section_segments', { n: segments.length })}</h3>
            <div class="nico-audio-seg-list">${segListHtml || `<div class="nico-comment-empty">${I18n.t('nico.audio_segments_empty', 'なし')}</div>`}</div>
        </div>`;

        this._audioCurrentVideoId = v.id;
        this._audioCurrentIdx = -1;
        this._updateSegHighlight();
    },

    // リアルPV動画プレイヤーを止める（Task 8）：他の動画を開く前に呼ぶ。src を外すだけで
    // VideoGen._urlCache の ObjectURL 自体は revoke しない（キャッシュはセッション中使い回す前提のため）
    _stopRealPlayer() {
        const videoEl = document.getElementById('nicoRealPlayer');
        if (!videoEl) return;
        try { videoEl.pause(); } catch (e) { }
        videoEl.removeAttribute('src');
        try { videoEl.load(); } catch (e) { }
    },

    _stopAudioDrama() {
        if (this._audioPlayer) {
            try { this._audioPlayer.pause(); } catch (e) { }
            this._audioPlayer.src = '';
            this._audioPlayer = null;
        }
        this._audioBlobUrls.forEach(u => { try { URL.revokeObjectURL(u); } catch (e) { } });
        this._audioBlobUrls = [];
        this._audioCurrentIdx = -1;
        this._audioCurrentVideoId = null;
    },

    async playSegment(idx) {
        const n = this._ensureData();
        const v = (n.videos || []).find(x => x.id === this._audioCurrentVideoId);
        if (!v) return;
        const segments = (v.audioSegments || []).filter(s => s.audioId);
        if (idx < 0 || idx >= segments.length) return;

        const seg = segments[idx];
        const blob = await TTSEngine.getAudio(seg.audioId);
        if (!blob) {
            Utils.showToast(I18n.t('t.nico_audio_not_found', '音声ファイルが見つかりませんでした'));
            return;
        }
        const url = URL.createObjectURL(blob);
        this._audioBlobUrls.push(url);

        if (this._audioPlayer) {
            try { this._audioPlayer.pause(); } catch (e) { }
        }
        this._audioPlayer = new Audio(url);
        if (window.AudioCoordinator) AudioCoordinator.register(this._audioPlayer);
        this._audioPlayer.onended = () => {
            // 自动播放下一段（带 150ms 间隔感觉自然）
            setTimeout(() => this.audioNext(), 150);
        };
        this._audioPlayer.onerror = () => {
            console.warn('[Niconico] audio playback error', seg);
            setTimeout(() => this.audioNext(), 150);
        };
        try {
            await this._audioPlayer.play();
        } catch (e) {
            console.warn('[Niconico] play() rejected', e);
        }

        this._audioCurrentIdx = idx;
        this._updateNowPlaying(seg, idx, segments.length);
        this._updateSegHighlight();

        const playBtn = document.getElementById('nicoAudioPlayBtn');
        if (playBtn) playBtn.textContent = I18n.t('nico.audio_btn_pause', '⏸ 一時停止');
    },

    audioPlayPause() {
        const n = this._ensureData();
        const v = (n.videos || []).find(x => x.id === this._audioCurrentVideoId);
        if (!v) return;
        const segments = (v.audioSegments || []).filter(s => s.audioId);
        if (segments.length === 0) return;

        if (this._audioPlayer && !this._audioPlayer.paused) {
            this._audioPlayer.pause();
            const playBtn = document.getElementById('nicoAudioPlayBtn');
            if (playBtn) playBtn.textContent = I18n.t('nico.audio_btn_continue', '▶ 続き');
            return;
        }
        if (this._audioPlayer && this._audioPlayer.paused && this._audioCurrentIdx >= 0) {
            this._audioPlayer.play().catch(e => console.warn(e));
            const playBtn = document.getElementById('nicoAudioPlayBtn');
            if (playBtn) playBtn.textContent = I18n.t('nico.audio_btn_pause', '⏸ 一時停止');
            return;
        }
        // 从头开始
        this.playSegment(0);
    },

    audioNext() {
        const n = this._ensureData();
        const v = (n.videos || []).find(x => x.id === this._audioCurrentVideoId);
        if (!v) return;
        const segments = (v.audioSegments || []).filter(s => s.audioId);
        const next = this._audioCurrentIdx + 1;
        if (next >= segments.length) {
            // 全部播完
            if (this._audioPlayer) { try { this._audioPlayer.pause(); } catch (e) { } }
            const playBtn = document.getElementById('nicoAudioPlayBtn');
            if (playBtn) playBtn.textContent = I18n.t('nico.audio_btn_again', '▶ もう一度');
            this._audioCurrentIdx = -1;
            this._updateNowPlaying(null, segments.length, segments.length);
            this._updateSegHighlight();
            return;
        }
        this.playSegment(next);
    },

    audioPrev() {
        const prev = Math.max(0, this._audioCurrentIdx - 1);
        this.playSegment(prev);
    },

    audioRestart() {
        this.playSegment(0);
    },

    _updateNowPlaying(seg, idx, total) {
        const speakerEl = document.getElementById('nicoAudioNowSpeaker');
        const textEl = document.getElementById('nicoAudioNowText');
        const inner = document.getElementById('nicoAudioProgressInner');
        const meta = document.getElementById('nicoAudioProgressMeta');
        if (!seg) {
            if (speakerEl) speakerEl.textContent = '—';
            if (textEl) textEl.textContent = I18n.t('nico.audio_now_done', '▶ 終了');
        } else {
            if (speakerEl) speakerEl.textContent = seg.speaker || '';
            if (textEl) textEl.textContent = seg.text || '';
        }
        const pct = total > 0 ? Math.round(((seg ? idx + 1 : total) / total) * 100) : 0;
        if (inner) inner.style.width = pct + '%';
        if (meta) meta.textContent = `${seg ? idx + 1 : total} / ${total}`;
    },

    _updateSegHighlight() {
        document.querySelectorAll('.nico-audio-seg').forEach(el => {
            const i = parseInt(el.dataset.idx, 10);
            el.classList.toggle('is-current', i === this._audioCurrentIdx);
        });
    },

    async deleteAudioDrama(videoId) {
        if (!confirm(I18n.t('nico.audio_confirm_delete', 'このオーディオドラマを削除しますか？\n音声ファイルもすべて削除されます。'))) return;
        const n = this._ensureData();
        const v = (n.videos || []).find(x => x.id === videoId);
        if (!v) return;
        await this._cleanupAudioDramaAudio(v);
        n.videos = n.videos.filter(x => x.id !== videoId);
        n.mylist = (n.mylist || []).filter(id => id !== videoId);
        // 解除 article 上的 audioDramaId 引用
        const articles = AppState.data.magazineData?.articles || [];
        articles.forEach(a => { if (a.audioDramaId === videoId) a.audioDramaId = null; });
        Utils.saveData();
        this._stopAudioDrama();
        Utils.showToast(I18n.t('t.nico_deleted', '削除しました'));
        Navigation.goTo('niconico');
    },

    // ===== パーサー: 動画 =====
    _parseVideos(raw) {
        const blocks = raw.split('---VIDEO---').filter(b => b.trim());
        const videos = [];

        blocks.forEach(block => {
            const get = (key) => {
                const match = block.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
                return match ? match[1].trim() : '';
            };

            const title = get('TITLE');
            if (!title) return;

            const danmaku = [];
            for (let i = 1; i <= 5; i++) {
                const d = get(`DANMAKU_${i}`);
                if (d) danmaku.push(d);
            }

            const comments = [];
            for (let i = 1; i <= 3; i++) {
                const c = get(`COMMENT_${i}`);
                if (c) {
                    const colonIdx = c.indexOf(':');
                    if (colonIdx > 0) {
                        comments.push({ author: c.substring(0, colonIdx).trim(), text: c.substring(colonIdx + 1).trim() });
                    } else {
                        comments.push({ author: '匿名', text: c });
                    }
                }
            }

            const tagsStr = get('TAGS');
            const genre = get('GENRE');
            const validGenres = this._GENRE_KEYS;

            videos.push({
                title,
                titleTl: get('TITLE_TL') || null,
                uploaderName: get('UPLOADER'),
                genre: validGenres.includes(genre) ? genre : 'other',
                emoji: get('EMOJI') || '🎬',
                tags: tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : [],
                description: get('DESCRIPTION'),
                descTl: get('DESC_TL') || null,
                views: get('VIEWS'),
                commentCount: get('COMMENTS_COUNT'),
                mylists: get('MYLISTS'),
                duration: get('DURATION') || '3:00',
                danmaku,
                comments
            });
        });

        return videos;
    },

    // ===== パーサー: チャンネル =====
    _parseChannels(raw) {
        const blocks = raw.split('---CHANNEL---').filter(b => b.trim());
        const channels = [];

        blocks.forEach(block => {
            const get = (key) => {
                const match = block.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
                return match ? match[1].trim() : '';
            };

            const name = get('NAME');
            if (!name) return;

            channels.push({
                name,
                emoji: get('EMOJI') || '📺',
                color: get('COLOR') || '',
                description: get('DESCRIPTION'),
                subscribers: get('SUBSCRIBERS')
            });
        });

        return channels;
    },

    // ===== ヘルパー =====
    _getChannel(id) {
        if (!id) return null;
        return (this._ensureData().channels || []).find(c => c.id === id) || null;
    },

    // 收口：转发 Utils.escapeHtml（str||'' 保留原 falsy→'' 语义）
    _escHtml(str) {
        return Utils.escapeHtml(str || '');
    },

    _fmtNum(num) {
        const n = parseInt(num) || 0;
        if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
        return String(n);
    },

    _timeAgo(ts) {
        if (!ts) return '';
        const diff = Date.now() - ts;
        const min = Math.floor(diff / 60000);
        if (min < 1) return I18n.t('nico.time_now', '今');
        if (min < 60) return I18n.t('nico.time_min', { n: min });
        const hr = Math.floor(min / 60);
        if (hr < 24) return I18n.t('nico.time_hour', { n: hr });
        return I18n.t('nico.time_day', { n: Math.floor(hr / 24) });
    },

    // 秒数 → 'M:SS'（PV投稿の task.duration は秒単位の数値。既存の duration 表記・_randomTimestamp と同じ形式に揃える）
    _fmtDuration(sec) {
        const s = Math.max(0, parseInt(sec, 10) || 0);
        const m = Math.floor(s / 60);
        const ss = String(s % 60).padStart(2, '0');
        return `${m}:${ss}`;
    },

    _randomTimestamp(duration) {
        if (!duration) return '0:00';
        const parts = duration.split(':');
        const totalSec = (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
        if (totalSec <= 0) return '0:00';
        const randSec = Math.floor(Math.random() * totalSec);
        const m = Math.floor(randSec / 60);
        const s = String(randSec % 60).padStart(2, '0');
        return `${m}:${s}`;
    }
};
