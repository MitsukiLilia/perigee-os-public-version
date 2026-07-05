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
        sparkle: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8z"/><path d="M19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9z"/></svg>'
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
                    <div class="nico-channel-name">${isFollowed ? '★ ' : ''}${this._escHtml(ch.name)}</div>
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
    _pvRefImgIds: [],        // 本次投稿表单里已选的参考图 id（会话级、非持久）
    _pvGallerySelection: [], // 画廊选择器内的临时选择（点「決定」才回写 _pvRefImgIds）
    _pvSubmitting: false,

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
        const models = (typeof VideoGen !== 'undefined' && VideoGen.MODELS) ? VideoGen.MODELS : [];
        return models.find(m => m.id === id) || models[0] || { id: '', ref: false, audio: false };
    },

    _pvDurationOptionsHtml() {
        let html = '';
        for (let s = 4; s <= 15; s++) {
            html += `<option value="${s}" ${s === 10 ? 'selected' : ''}>${I18n.t('nico.pv_duration_unit', { n: s })}</option>`;
        }
        return html;
    },

    showPVModal() {
        const n = this._ensureData();
        this._pvRefImgIds = [];
        this._pvGallerySelection = [];
        this._pvSubmitting = false;

        const cfg = VideoGen.config();
        const models = VideoGen.MODELS || [];
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

        const html = `
        <div class="nico-modal-overlay" id="nicoPvModal" onclick="if(event.target===this)Niconico._closePVModal()">
            <div class="nico-modal nico-pv-modal">
                <div class="nico-modal-title">${I18n.t('nico.pv_modal_title', 'PV投稿（動画生成）')}</div>
                <div class="nico-pv-body">
                    <div class="nico-pv-field">
                        <label class="nico-pv-label">${I18n.t('nico.pv_prompt_label', 'PVスクリプト')}</label>
                        <textarea id="nicoPvPrompt" class="nico-pv-textarea" rows="5" placeholder="${I18n.t('nico.pv_prompt_placeholder', 'カット割り・セリフ・雰囲気を書く（「」内のセリフが読み上げられます）')}"></textarea>
                        <button class="glass-btn nico-pv-ai-btn" id="nicoPvAiWriteBtn" onclick="Niconico._pvAiWrite()">
                            <span class="nico-pv-btn-icon">${this._SVG.sparkle}</span><span id="nicoPvAiWriteLabel">${I18n.t('nico.pv_ai_write_btn', 'AIにおまかせ')}</span>
                        </button>
                    </div>

                    <div class="nico-pv-field">
                        <label class="nico-pv-label">${I18n.t('nico.pv_ref_label', '参考画像（0〜9枚）')}</label>
                        <div class="nico-pv-ref-row" id="nicoPvRefRow">
                            <div class="nico-pv-ref-thumbs" id="nicoPvRefThumbs"></div>
                            <button class="nico-pv-ref-add" id="nicoPvRefAddBtn" onclick="Niconico._pvOpenGalleryPicker()" title="${I18n.t('nico.pv_ref_add_title', '画像を追加')}">${this._SVG.plus}</button>
                        </div>
                        <p class="nico-pv-hint" id="nicoPvRefHint" style="display:none;">${I18n.t('nico.pv_ref_disabled_hint', 'このモデルは参考画像に対応していません')}</p>
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
                            <select id="nicoPvDuration" class="nico-pv-select">${this._pvDurationOptionsHtml()}</select>
                        </div>
                        <div class="nico-pv-field nico-pv-field-half nico-pv-audio-field">
                            <label class="nico-pv-checkbox-label">
                                <input type="checkbox" id="nicoPvAudio" checked>
                                ${I18n.t('nico.pv_audio_label', '音声を生成')}
                            </label>
                            <p class="nico-pv-hint" id="nicoPvAudioHint" style="display:none;">${I18n.t('nico.pv_audio_disabled_hint', 'このモデルは音声に対応していません')}</p>
                        </div>
                    </div>

                    <div class="nico-pv-field">
                        <label class="nico-pv-label">${I18n.t('nico.pv_channel_label', '投稿チャンネル')}</label>
                        <select id="nicoPvChannel" class="nico-pv-select" ${!hasChannels ? 'disabled' : ''}>${channelOptionsHtml}</select>
                        ${!hasChannels ? `<p class="nico-pv-hint">${I18n.t('nico.pv_channel_empty_hint', 'まずチャンネルを生成してください')}</p>` : ''}
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
    },

    _closePVModal() {
        document.getElementById('nicoPvModal')?.remove();
    },

    // モデル切替：分辨率(4k限定2.0旗舰)/参考図可否/有声可否の三点連動
    _pvOnModelChange() {
        const modelSel = document.getElementById('nicoPvModel');
        if (!modelSel) return;
        const model = this._pvModelInfo(modelSel.value);

        const resSel = document.getElementById('nicoPvResolution');
        if (resSel) {
            const prevRes = resSel.value;
            const is4kModel = model.id === 'doubao-seedance-2-0-260128';
            const resOptions = ['480p', '720p', '1080p'].concat(is4kModel ? ['4k'] : []);
            resSel.innerHTML = resOptions.map(r => `<option value="${r}">${r}</option>`).join('');
            resSel.value = resOptions.includes(prevRes) ? prevRes : '720p';
        }

        const refRow = document.getElementById('nicoPvRefRow');
        const refAddBtn = document.getElementById('nicoPvRefAddBtn');
        const refHint = document.getElementById('nicoPvRefHint');
        if (refRow) refRow.classList.toggle('disabled', !model.ref);
        if (refAddBtn) refAddBtn.disabled = !model.ref;
        if (refHint) refHint.style.display = model.ref ? 'none' : 'block';

        const audioCb = document.getElementById('nicoPvAudio');
        const audioHint = document.getElementById('nicoPvAudioHint');
        if (audioCb) {
            const wasDisabled = audioCb.disabled;
            audioCb.disabled = !model.audio;
            if (!model.audio) audioCb.checked = false;          // 不支持音声的模型强制取消勾选
            else if (wasDisabled) audioCb.checked = true;       // 从禁用状态恢复 → 回到默认开（两个有声模型间切换保留用户手动勾选）
        }
        if (audioHint) audioHint.style.display = model.audio ? 'none' : 'block';
    },

    // 参考図サムネ行の再描画（_pvRefImgIds が真値、選択は禁用時も保持——切回2.0系不丢）
    async _pvRenderRefThumbs() {
        const wrap = document.getElementById('nicoPvRefThumbs');
        if (!wrap) return;
        const ids = this._pvRefImgIds || [];
        if (ids.length === 0) { wrap.innerHTML = ''; return; }
        const items = await Promise.all(ids.map(async id => ({ id, url: await IllustGallery.getUrl(id) })));
        const wrap2 = document.getElementById('nicoPvRefThumbs');   // 渲染中弹窗可能已被关闭
        if (!wrap2) return;
        wrap2.innerHTML = items.map(it => `
            <div class="nico-pv-ref-thumb" style="background-image:url('${it.url || ''}')">
                <button class="nico-pv-ref-remove" onclick="event.stopPropagation();Niconico._pvRemoveRefImg('${it.id}')" title="${I18n.t('nico.pv_ref_remove_title', '削除')}">${this._SVG.close}</button>
            </div>`).join('');
    },

    _pvRemoveRefImg(id) {
        this._pvRefImgIds = (this._pvRefImgIds || []).filter(x => x !== id);
        this._pvRenderRefThumbs();
    },

    // ===== 参考画像ピッカー（Pixivイラストギャラリーから選択・最大9枚） =====
    async _pvOpenGalleryPicker() {
        const illusts = (AppState.data.pixivData && AppState.data.pixivData.illustrations) || [];
        if (illusts.length === 0) {
            Utils.showToast(I18n.t('nico.pv_gallery_empty', 'Pixivにイラストがありません'));
            return;
        }
        this._pvGallerySelection = (this._pvRefImgIds || []).slice();

        const html = `
        <div class="nico-modal-overlay nico-pv-gallery-overlay" id="nicoPvGalleryModal" onclick="if(event.target===this)Niconico._closeGalleryPicker()">
            <div class="nico-modal nico-pv-gallery-modal">
                <div class="nico-modal-title">${I18n.t('nico.pv_gallery_title', '参考画像を選択（最大9枚）')}</div>
                <div class="nico-pv-gallery-grid" id="nicoPvGalleryGrid"></div>
                <div class="nico-modal-buttons nico-pv-actions">
                    <button class="glass-btn nico-modal-close" onclick="Niconico._closeGalleryPicker()">${I18n.t('nico.menu_close', '閉じる')}</button>
                    <button class="glass-btn nico-pv-submit-btn" onclick="Niconico._confirmGalleryPicker()">${I18n.t('nico.pv_gallery_confirm', '決定')}</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        await this._pvRenderGalleryGrid(illusts);
    },

    async _pvRenderGalleryGrid(illusts) {
        const grid = document.getElementById('nicoPvGalleryGrid');
        if (!grid) return;
        const items = await Promise.all(illusts.map(async it => ({ it, url: await IllustGallery.getUrl(it.id) })));
        const grid2 = document.getElementById('nicoPvGalleryGrid');
        if (!grid2) return;
        grid2.innerHTML = items.map(({ it, url }) => {
            const selected = this._pvGallerySelection.includes(it.id);
            return `
            <div class="nico-pv-gallery-item ${selected ? 'selected' : ''}" data-illust-id="${it.id}" style="background-image:url('${url || ''}')" onclick="Niconico._pvToggleGalleryItem('${it.id}')">
                <span class="nico-pv-gallery-check">${this._SVG.check}</span>
            </div>`;
        }).join('');
    },

    _pvToggleGalleryItem(id) {
        const sel = this._pvGallerySelection;
        const idx = sel.indexOf(id);
        if (idx >= 0) {
            sel.splice(idx, 1);
        } else {
            if (sel.length >= 9) { Utils.showToast(I18n.t('nico.pv_gallery_max_hint', '最大9枚まで選択できます')); return; }
            sel.push(id);
        }
        const el = document.querySelector(`#nicoPvGalleryGrid [data-illust-id="${CSS.escape(id)}"]`);
        if (el) el.classList.toggle('selected', sel.includes(id));
    },

    _confirmGalleryPicker() {
        this._pvRefImgIds = (this._pvGallerySelection || []).slice();
        this._closeGalleryPicker();
        this._pvRenderRefThumbs();
    },

    _closeGalleryPicker() {
        document.getElementById('nicoPvGalleryModal')?.remove();
    },

    // ===== AIにおまかせ：世界観からPV脚本を書く（_generateVideos と同じ注入三件套） =====
    async _pvAiWrite() {
        const textarea = document.getElementById('nicoPvPrompt');
        if (!textarea) return;
        const btn = document.getElementById('nicoPvAiWriteBtn');
        const label = document.getElementById('nicoPvAiWriteLabel');
        if (btn) btn.disabled = true;
        if (label) label.textContent = I18n.t('nico.pv_ai_writing', '生成中…');

        try {
            const worldContext = (typeof Forum !== 'undefined' && Forum.getWorldContext) ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');
            const seedText = (textarea.value || '').trim();

            const systemPrompt = `あなたは動画生成AI向けのプロンプトを書く創作アシスタントです。
以下の作品世界に基づいて、ニコニコ動画に投稿する公式PV（プロモーション映像）用の生成プロンプトを書いてください。

## 作品世界の情報
${worldContext || '（世界観未設定 — キャラクター名・CP・ストーリーイベントなど具体的な作品情報を捏造しないこと。一般的なアニメPVとして生成すること）'}
${Utils.PROMPTS.infoAccessRule()}
${typeof Utils !== 'undefined' && Utils.getEventContextPrompt ? Utils.getEventContextPrompt(3) : ''}
${seedText ? `\n## ユーザーが既に考えている方向性\n${seedText}\n` : ''}
## 出力形式（厳守）
説明文やタイトルを付けず、プロンプト本文のみを出力すること。

## ルール
- 全体で500字以内
- 時系列に沿ったカットを複数並べ、画づくり・カメラワーク・色調・雰囲気を具体的に描写すること
- セリフを入れる場合は必ず「」（鉤括弧）で囲むこと — 音声生成モデルはこの記号内のみを読み上げる
- 作品世界のキャラクター・関係性・出来事を積極的に反映すること
- 説明的な地の文ではなく、そのまま動画生成モデルに渡せる具体的な描写にすること
- 🚫 設定にないストーリーを捏造するな`;

            const messages = [{ role: 'user', content: 'PV生成プロンプトを書いてください。' }];
            const raw = await Utils.callChatAPI(messages, systemPrompt);
            textarea.value = (raw || '').trim();
        } catch (e) {
            console.error('[Niconico] PV AI write error:', e);
            Utils.showToast(I18n.t('t.nico_gen_error', '⚠️ 生成エラー: ') + e.message, 4000);
        } finally {
            if (btn) btn.disabled = false;
            if (label) label.textContent = I18n.t('nico.pv_ai_write_btn', 'AIにおまかせ');
        }
    },

    // ===== 投稿提出 =====
    async _pvSubmit() {
        if (this._pvSubmitting) return;
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
            Utils.showToast(I18n.t('nico.pv_channel_empty_hint', 'まずチャンネルを生成してください'));
            return;
        }

        const modelSel = document.getElementById('nicoPvModel');
        const model = modelSel ? modelSel.value : ((VideoGen.MODELS[0] && VideoGen.MODELS[0].id) || '');
        const modelInfo = this._pvModelInfo(model);
        const resolution = (document.getElementById('nicoPvResolution') && document.getElementById('nicoPvResolution').value) || '720p';
        const duration = parseInt(document.getElementById('nicoPvDuration')?.value, 10) || 10;
        const generateAudio = modelInfo.audio ? !!(document.getElementById('nicoPvAudio') && document.getElementById('nicoPvAudio').checked) : false;
        const refImgIds = modelInfo.ref ? (this._pvRefImgIds || []) : [];   // ref:false 模型不带参考图，但不清空已选（切回2.0还在）
        const tweetSel = document.getElementById('nicoPvTweetAccount');
        const tweetAccountId = (tweetSel && tweetSel.value) ? tweetSel.value : null;

        const btn = document.getElementById('nicoPvSubmitBtn');
        this._pvSubmitting = true;
        if (btn) btn.disabled = true;
        try {
            await VideoGen.createTask({
                prompt, refImgIds, model, resolution, duration,
                generateAudio, channelId, tweetAccountId
            });
            n.lastPvChannelId = channelId;
            Utils.saveData();
            this._closePVModal();
            Utils.showToast(I18n.t('nico.pv_toast_started', '生成開始！'));
            this.refreshGenCard();   // 占位卡即时出现（不等第一次轮询）
        } catch (e) {
            console.error('[Niconico] PV submit error:', e);
            Utils.showToast(I18n.t('t.nico_gen_error', '⚠️ 生成エラー: ') + e.message, 4000);
        } finally {
            this._pvSubmitting = false;
            if (btn) btn.disabled = false;
        }
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

    async _retryGenTask(taskId) {
        try {
            await VideoGen.retryTask(taskId);
            Utils.showToast(I18n.t('nico.pv_toast_retrying', '再試行しています…'));
        } catch (e) {
            Utils.showToast(String((e && e.message) || e));
        }
        this.refreshGenCard({ id: taskId });
    },

    async _abandonGenTask(taskId) {
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

    _escHtml(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
