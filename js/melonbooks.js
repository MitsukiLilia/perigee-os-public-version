// ========================================================
// メロンブックス (Melonbooks) — 同人ショップシミュレーター
// ========================================================

const Melonbooks = {
    // 情報アクセス制限ルール → 见 Utils.PROMPTS.infoAccessRule()

    currentTab: 'new',
    _filterFollowed: false,
    currentProductId: null,
    currentCircleId: null,
    currentEventId: null,
    _isGenerating: false,   // 并发锁：AI 生成中、防双击重复触发导致数据双写

    // ===== 定数 =====
    // goods（グッズ）は旧データ表示用に残す。新規生成では使わない — 周边は将来の Mercari モジュールへ
    get _PRODUCT_TYPES() {
        return {
            novel: I18n.t('melon.type_novel', '小説'),
            manga: I18n.t('melon.type_manga', '漫画'),
            goods: I18n.t('melon.type_goods', 'グッズ'),
            music: I18n.t('melon.type_music_cd', '音楽CD'),
            anthology: I18n.t('melon.type_anthology', 'アンソロジー')
        };
    },
    // AI prompt 用：写死日文（"会进 LLM 的不翻"铁律 — 跟 systemPrompt 同等待遇）
    _PRODUCT_TYPES_JA: {
        novel: '小説',
        manga: '漫画',
        goods: 'グッズ',
        music: '音楽CD',
        anthology: 'アンソロジー'
    },
    // AI が新規生成できる商品タイプ（goods を含まない）
    _GENERATABLE_TYPES: ['novel', 'manga', 'music', 'anthology'],
    get _EVENT_TYPES() {
        return {
            comike: I18n.t('melon.event_comiket', 'コミックマーケット'),
            only: I18n.t('melon.event_only', 'オンリーイベント'),
            online: I18n.t('melon.event_online', 'オンライン即売会'),
            other: I18n.t('melon.event_other', 'その他')
        };
    },
    // AI prompt 用：写死日文
    _EVENT_TYPES_JA: {
        comike: 'コミックマーケット',
        only: 'オンリーイベント',
        online: 'オンライン即売会',
        other: 'その他'
    },
    // 即売会の档期（phase）— 告知 → 開催間近 → 開催中 → 終了
    get _EVENT_PHASE_LABELS() {
        return {
            announced: I18n.t('melon.phase_announced', '告知'),
            preopen: I18n.t('melon.phase_preopen', '開催間近'),
            open: I18n.t('melon.phase_open', '開催中'),
            closed: I18n.t('melon.phase_closed', '終了')
        };
    },
    _EVENT_PHASE_COLORS: {
        announced: '#6c757d',
        preopen: '#0d6efd',
        open: '#198754',
        closed: '#adb5bd'
    },
    _EVENT_PHASE_ORDER: ['announced', 'preopen', 'open', 'closed'],
    // 線描 SVG アイコン（emoji 廃止 — currentColor 継承で主題色に追従）
    _SVG: {
        book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h12a2 2 0 0 1 2 2v15H6a2 2 0 0 1-2-2V4z"/><path d="M18 7v14"/><path d="M8 8.5h7M8 11.5h7"/></svg>',
        chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4v16h16"/><rect x="7.5" y="12" width="3" height="5"/><rect x="12.5" y="8" width="3" height="9"/><path d="M18.5 5v12"/></svg>',
        list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.1"/><circle cx="4.5" cy="12" r="1.1"/><circle cx="4.5" cy="18" r="1.1"/></svg>',
        palette: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-.9 2-1.8 0-.5-.2-.9-.5-1.2-.3-.4-.5-.8-.5-1.3 0-1 .8-1.7 1.8-1.7H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8z"/><circle cx="8" cy="10" r="1.1"/><circle cx="12" cy="7.5" r="1.1"/><circle cx="16" cy="10" r="1.1"/></svg>',
        event: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V9l7-5 7 5v12"/><path d="M10 21v-6h4v6"/></svg>',
        cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="9.5" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/><path d="M3 4h2.2l2.6 11.5h9.4L19 7.5H6"/></svg>',
        trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10v4.5a5 5 0 0 1-10 0V4z"/><path d="M7 6.2H4.2v1.6a3 3 0 0 0 3 3M17 6.2h2.8v1.6a3 3 0 0 1-3 3"/><path d="M9.5 16h5M10.5 20h3M12 16.2v3.6"/></svg>'
    },
    get _STATUS_LABELS() {
        return {
            upcoming: I18n.t('melon.status_upcoming', '告知'),
            preorder: I18n.t('melon.status_preorder', '予約受付中'),
            on_sale: I18n.t('melon.status_on_sale', '販売中'),
            mail_order: I18n.t('melon.status_mail_order', '通販開始'),
            sold_out: I18n.t('melon.status_sold_out', '完売')
        };
    },
    _STATUS_COLORS: {
        upcoming: '#6c757d',
        preorder: '#0d6efd',
        on_sale: '#198754',
        mail_order: '#e8530e',
        sold_out: '#dc3545'
    },
    _AVATAR_COLORS: [
        '#e8530e', '#d63384', '#6f42c1', '#0d6efd', '#198754',
        '#20c997', '#fd7e14', '#6610f2', '#0dcaf0', '#dc3545'
    ],
    // ===== データ初期化 =====
    _ensureData() {
        const d = AppState.data;
        if (!d.melonbooksData) d.melonbooksData = {};
        const m = d.melonbooksData;
        if (!m.circles) m.circles = [];
        if (!m.products) m.products = [];
        if (!m.events) m.events = [];
        if (!m.rankings) m.rankings = [];
        if (!m.favorites) m.favorites = [];
        if (!m.followedCircleIds) m.followedCircleIds = [];
        if (!m.features) m.features = [];
        if (!m.cart) m.cart = [];
        if (!m.purchaseHistory) m.purchaseHistory = [];
        if (!m.settings) m.settings = { shopName: I18n.t('melon.shop_name', 'メロンブックス') };
        // 旧データ移行：phase 档期字段がない即売会に補完（冪等 — 「phase キーの有無」で判定）
        (m.events || []).forEach(ev => {
            if (typeof ev.phase === 'undefined') {
                ev.phase = (ev.isUpcoming !== false) ? 'announced' : 'closed';
                ev.phasePlotId = null;
                ev.closedAtPlotCount = (ev.phase === 'closed')
                    ? (((AppState.data.broadcast && AppState.data.broadcast.plotProgress) || []).length)
                    : null;
            }
        });
        return m;
    },

    // ===== 初期化 =====
    init() {
        this._ensureData();
        const titleEl = document.getElementById('melonbooksTitle');
        if (titleEl) titleEl.textContent = this._ensureData().settings.shopName || I18n.t('melon.shop_name', 'メロンブックス');
        this._updateCartBadge();
        this.switchTab(this.currentTab, true);
    },

    // ===== タブ切替 =====
    switchTab(tab, rerender = true) {
        this.currentTab = tab;
        ['new', 'ranking', 'event', 'circle'].forEach(t => {
            const btn = document.getElementById(`melonTab${t.charAt(0).toUpperCase() + t.slice(1)}`);
            if (btn) btn.classList.toggle('active', t === tab);
        });
        if (rerender) this._renderCurrentTab();
    },

    _renderCurrentTab() {
        const container = document.getElementById('melonbooksContent');
        if (!container) return;
        switch (this.currentTab) {
            case 'new': this.renderNewProducts(container); break;
            case 'ranking': this.renderRankings(container); break;
            case 'event': this.renderEvents(container); break;
            case 'circle': this.renderCircles(container); break;
        }
        this._loadGeneratedCovers(container);
    },

    // ===== 新着タブ =====
    renderNewProducts(container) {
        const m = this._ensureData();
        let products = (m.products || []).slice().reverse();
        const hasFollows = (m.followedCircleIds || []).length > 0;

        if (products.length === 0) {
            container.innerHTML = `
                <div class="melon-empty">
                    <div class="empty-state-icon">${this._SVG.cart}</div>
                    <div class="empty-state-text">${I18n.t('melon.empty_no_products', 'まだ商品がありません')}</div>
                    <div class="empty-state-hint">${I18n.t('melon.empty_no_products_hint', '右上の「+」から商品を生成できます')}</div>
                </div>`;
            return;
        }

        // フォロー中フィルター
        const filterHtml = hasFollows ? `
            <div class="melon-filter-bar">
                <button class="melon-filter-btn ${this._filterFollowed ? 'active' : ''}" onclick="Melonbooks._toggleFollowFilter()">
                    ${this._filterFollowed ? I18n.t('melon.filter_following_on', '★ フォロー中のみ') : I18n.t('melon.filter_following_off', '☆ フォロー中のみ')}
                </button>
            </div>` : '';

        if (this._filterFollowed && hasFollows) {
            products = products.filter(p => (m.followedCircleIds || []).includes(p.circleId));
        }

        // 特集バナー（最新3件）
        const features = (m.features || []).slice().reverse().slice(0, 3);
        const featuresHtml = features.length > 0 ? `
            <div class="melon-features-banner">
                ${features.map(f => `
                    <div class="melon-feature-banner-card" onclick="Melonbooks.openFeature('${f.id}')">
                        <span class="melon-feature-banner-icon">${this._SVG.list}</span>
                        <span class="melon-feature-banner-title">${this._escHtml(f.title)}</span>
                    </div>`).join('')}
            </div>` : '';

        const gridHtml = products.length > 0
            ? `<div class="melon-product-grid">${products.map(p => this._renderProductCard(p)).join('')}</div>`
            : `<div class="melon-empty"><div class="empty-state-text">${I18n.t('melon.empty_followed_none', 'フォロー中のサークルの商品はありません')}</div></div>`;

        container.innerHTML = featuresHtml + filterHtml + gridHtml;
    },

    _toggleFollowFilter() {
        this._filterFollowed = !this._filterFollowed;
        this._renderCurrentTab();
    },

    // 書影風封面占位（emoji 廃止 — 米白底 + 标题 serif + 橙细线 + 类型小字）
    _coverPlaceholder(p, variant) {
        const typeLabel = this._PRODUCT_TYPES[p.type] || p.type || '';
        const cls = variant === 'detail' ? 'melon-bookish is-detail' : 'melon-bookish';
        return `<div class="${cls}">
            <div class="melon-bookish-title">${this._escHtml(p.title || '')}</div>
            <div class="melon-bookish-meta"><span class="melon-bookish-rule"></span><span class="melon-bookish-type">${this._escHtml(typeLabel)}</span></div>
        </div>`;
    },

    _renderProductCard(p) {
        const circle = this._getCircle(p.circleId);
        const isFav = (this._ensureData().favorites || []).includes(p.id);
        const status = p.status || 'on_sale';
        const statusLabel = this._STATUS_LABELS[status] || status;
        const statusColor = this._STATUS_COLORS[status] || '#198754';
        const newBadge = p.isNew ? `<span class="melon-new-badge">${I18n.t('melon.new_badge', '新刊')}</span>` : '';
        const r18Badge = p.rating === 'R18' ? '<span class="melon-r18-badge">R18</span>' : '';
        const statusBadge = `<span class="melon-status-badge" style="background:${statusColor}">${statusLabel}</span>`;
        return `
        <div class="melon-product-card" onclick="Melonbooks.openProduct('${p.id}')">
            <div class="melon-cover${p.generatedCoverId ? ' melon-cover-generated' : ''}">
                ${p.generatedCoverId
                    ? `<img src="" data-illust-id="${p.generatedCoverId}" class="melon-cover-img" alt="${this._escHtml(p.title)}">`
                    : this._coverPlaceholder(p)}
                ${newBadge}${r18Badge}
            </div>
            <div class="melon-product-info">
                <div class="melon-product-title">${this._escHtml(p.title)}</div>
                <div class="melon-product-circle">${this._escHtml(circle ? circle.name : I18n.t('melon.circle_unknown', '不明サークル'))}</div>
                <div class="melon-product-meta">
                    <span class="melon-price">${this._escHtml(p.price || '¥---')}</span>
                    ${statusBadge}
                </div>
            </div>
        </div>`;
    },

    // ===== ランキングタブ =====
    renderRankings(container) {
        const m = this._ensureData();
        const rankings = m.rankings || [];

        if (rankings.length === 0) {
            container.innerHTML = `
                <div class="melon-empty">
                    <div class="empty-state-icon">${this._SVG.trophy}</div>
                    <div class="empty-state-text">${I18n.t('melon.empty_no_rankings', 'ランキングがありません')}</div>
                    <div class="empty-state-hint">${I18n.t('melon.empty_no_rankings_hint', '「+」からランキングを生成できます')}</div>
                </div>`;
            return;
        }

        // 最新のランキングを表示
        const latest = rankings[rankings.length - 1];
        container.innerHTML = `
            <div class="melon-ranking-header">
                <div class="melon-ranking-title"><span class="melon-ranking-title-icon">${this._SVG.chart}</span>${this._escHtml(latest.title || I18n.t('melon.ranking_default_title', '週間ランキング'))}</div>
                <div class="melon-ranking-date">${this._timeAgo(latest.createdAt)}</div>
            </div>
            <div class="melon-ranking-list">
                ${(latest.items || []).map((item, i) => {
                    const product = (m.products || []).find(p => p.id === item.productId);
                    const circle = product ? this._getCircle(product.circleId) : null;
                    const rankNum = i + 1;
                    const rankCls = rankNum <= 3 ? `melon-rank-badge top-${rankNum}` : 'melon-rank-badge';
                    const cover = product ? this._coverPlaceholder(product, 'mini') : '<div class="melon-bookish is-mini"></div>';
                    return `
                    <div class="melon-ranking-item" onclick="${product ? `Melonbooks.openProduct('${product.id}')` : ''}">
                        <span class="${rankCls}">${rankNum}</span>
                        <div class="melon-ranking-cover">${cover}</div>
                        <div class="melon-ranking-info">
                            <div class="melon-ranking-item-title">${this._escHtml(item.title || (product ? product.title : '???'))}</div>
                            <div class="melon-ranking-item-circle">${this._escHtml(circle ? circle.name : '')}</div>
                            <div class="melon-ranking-comment">${this._escHtml(item.comment || '')}</div>
                        </div>
                    </div>`;
                }).join('')}
            </div>`;
    },

    // ===== イベントタブ =====
    renderEvents(container) {
        const m = this._ensureData();
        const events = (m.events || []).slice().reverse();

        if (events.length === 0) {
            container.innerHTML = `
                <div class="melon-empty">
                    <div class="empty-state-icon">${this._SVG.event}</div>
                    <div class="empty-state-text">${I18n.t('melon.empty_no_events', 'イベント情報がありません')}</div>
                    <div class="empty-state-hint">${I18n.t('melon.empty_no_events_hint', '「+」からイベントを生成できます')}</div>
                </div>`;
            return;
        }

        container.innerHTML = events.map(ev => {
            const circleCount = (ev.circleIds || []).length;
            const typeLabel = this._EVENT_TYPES[ev.type] || ev.type;
            const phase = ev.phase || 'announced';
            const phaseLabel = this._EVENT_PHASE_LABELS[phase] || phase;
            const phaseColor = this._EVENT_PHASE_COLORS[phase] || '#6c757d';
            return `
            <div class="melon-event-card" onclick="Melonbooks.openEvent('${ev.id}')">
                <div class="melon-event-date-banner">
                    <span class="melon-event-type-badge">${this._escHtml(typeLabel)}</span>
                    <span class="melon-event-date">${this._escHtml(ev.date || I18n.t('melon.date_tba', '日程未定'))}</span>
                </div>
                <div class="melon-event-info">
                    <div class="melon-event-info-head">
                        <span class="melon-event-name">${this._escHtml(ev.name)}</span>
                        <span class="melon-event-phase-badge" style="background:${phaseColor}">${this._escHtml(phaseLabel)}</span>
                    </div>
                    <div class="melon-event-venue">${this._escHtml(ev.venue || '')}</div>
                    <div class="melon-event-circles">${I18n.t('melon.circle_count_unit', { n: circleCount })}</div>
                </div>
            </div>`;
        }).join('');
    },

    // ===== サークルタブ =====
    renderCircles(container) {
        const m = this._ensureData();
        const circles = (m.circles || []).slice().reverse();

        if (circles.length === 0) {
            container.innerHTML = `
                <div class="melon-empty">
                    <div class="empty-state-icon">${this._SVG.palette}</div>
                    <div class="empty-state-text">${I18n.t('melon.empty_no_circles', 'サークルがありません')}</div>
                    <div class="empty-state-hint">${I18n.t('melon.empty_no_circles_hint', '「+」からサークルを生成できます')}</div>
                </div>`;
            return;
        }

        container.innerHTML = circles.map(c => {
            const productCount = (m.products || []).filter(p => p.circleId === c.id).length;
            const isFollowed = (m.followedCircleIds || []).includes(c.id);
            const tags = (c.tags || []).slice(0, 3).map(t => `<span class="melon-circle-tag">${this._escHtml(t)}</span>`).join('');
            return `
            <div class="melon-circle-item" onclick="Melonbooks.openCircle('${c.id}')">
                <div class="melon-circle-avatar" style="background:${c.avatarColor || '#e8530e'}">${this._escHtml(c.avatarLetter || c.name.charAt(0))}</div>
                <div class="melon-circle-info">
                    <div class="melon-circle-name">${isFollowed ? '★ ' : ''}${this._escHtml(c.name)}</div>
                    <div class="melon-circle-author">${this._escHtml(c.author || '')}</div>
                    <div class="melon-circle-meta">${tags} <span class="melon-circle-count">${I18n.t('melon.work_count_unit', { n: productCount })}</span></div>
                </div>
            </div>`;
        }).join('');
    },

    // ===== 商品詳細ページ =====
    openProduct(id) {
        this.currentProductId = id;
        Navigation.goTo('melonbooks-detail');
    },

    renderProductDetail() {
        const m = this._ensureData();
        const p = (m.products || []).find(x => x.id === this.currentProductId);
        if (!p) { Navigation.goTo('melonbooks'); return; }

        const circle = this._getCircle(p.circleId);
        const isFav = (m.favorites || []).includes(p.id);
        const titleEl = document.getElementById('melonDetailTitle');
        if (titleEl) titleEl.textContent = p.title || I18n.t('melon.header_detail', '商品詳細');

        const content = document.getElementById('melonDetailContent');
        if (!content) return;

        // 同じサークルの他の作品
        const sameCircle = (m.products || []).filter(x => x.circleId === p.circleId && x.id !== p.id).slice(0, 4);

        const status = p.status || 'on_sale';
        const statusLabel = this._STATUS_LABELS[status] || status;
        const statusColor = this._STATUS_COLORS[status] || '#198754';

        content.innerHTML = `
        <div class="melon-detail-cover${p.generatedCoverId ? ' melon-cover-generated' : ''}"${p.generatedCoverId ? ` onclick="Melonbooks._viewFullCover('${p.generatedCoverId}')"` : ''}>
            ${p.generatedCoverId
                ? `<img src="" data-illust-id="${p.generatedCoverId}" class="melon-detail-cover-img" alt="${this._escHtml(p.title)}">`
                : this._coverPlaceholder(p, 'detail')}
            ${p.isNew ? `<span class="melon-new-badge">${I18n.t('melon.new_badge', '新刊')}</span>` : ''}
            ${p.rating === 'R18' ? '<span class="melon-r18-badge">R18</span>' : ''}
        </div>

        <div class="melon-detail-info-card">
            <div class="melon-detail-status-row">
                <span class="melon-status-badge-lg" style="background:${statusColor}">${statusLabel}</span>
                ${p.statusPlotId ? `<span class="melon-status-hint">${I18n.t('melon.status_hint_plot', '剧情更新で状態が変わります')}</span>` : ''}
            </div>
            <h2 class="melon-detail-product-title">${this._escHtml(p.title)}</h2>
            <div class="melon-detail-circle" onclick="Melonbooks.openCircle('${p.circleId}')">
                ${circle ? `<span class="melon-circle-avatar-sm" style="background:${circle.avatarColor || '#e8530e'}">${this._escHtml(circle.avatarLetter || circle.name.charAt(0))}</span>` : ''}
                <span>${this._escHtml(circle ? circle.name : I18n.t('melon.author_unknown', '不明'))}</span>
            </div>

            <div class="melon-detail-specs">
                <div class="melon-spec"><span class="melon-spec-label">${I18n.t('melon.spec_price', '価格')}</span><span class="melon-spec-value melon-price">${this._escHtml(p.price || '---')}</span></div>
                <div class="melon-spec"><span class="melon-spec-label">${I18n.t('melon.spec_type', '種類')}</span><span class="melon-spec-value">${this._PRODUCT_TYPES[p.type] || p.type}</span></div>
                ${p.pageCount ? `<div class="melon-spec"><span class="melon-spec-label">${I18n.t('melon.spec_pages', 'ページ数')}</span><span class="melon-spec-value">${p.pageCount}p</span></div>` : ''}
                ${p.size ? `<div class="melon-spec"><span class="melon-spec-label">${I18n.t('melon.spec_format', '判型')}</span><span class="melon-spec-value">${this._escHtml(p.size)}</span></div>` : ''}
                ${p.rating ? `<div class="melon-spec"><span class="melon-spec-label">${I18n.t('melon.spec_age_rating', '年齢制限')}</span><span class="melon-spec-value">${p.rating === 'R18' ? I18n.t('melon.rating_r18', 'R-18') : I18n.t('melon.rating_all', '全年齢')}</span></div>` : ''}
            </div>

            ${(p.tags || []).length > 0 ? `<div class="melon-detail-tags">${p.tags.map(t => `<span class="melon-tag">${this._escHtml(t)}</span>`).join('')}</div>` : ''}
        </div>

        ${p.sampleText ? `
        <div class="melon-detail-section">
            <h3 class="melon-section-title">${I18n.t('melon.detail_section_sample', 'あらすじ・サンプル')}</h3>
            <div class="melon-sample-text">${this._escHtml(p.sampleText).replace(/\n/g, '<br>')}
            ${p.sampleTextTl ? `<details class="tw-tl-block" style="margin-top:6px;"><summary class="tw-tl-btn">${I18n.t('melon.tl_label', '訳')}</summary><div class="tw-tl-content">${this._escHtml(p.sampleTextTl)}</div></details>` : ''}
            </div>
        </div>` : ''}

        ${sameCircle.length > 0 ? `
        <div class="melon-detail-section">
            <h3 class="melon-section-title">${I18n.t('melon.detail_section_same_circle', '同じサークルの作品')}</h3>
            <div class="melon-product-grid">${sameCircle.map(sp => this._renderProductCard(sp)).join('')}</div>
        </div>` : ''}`;

        this._loadGeneratedCovers(content);
    },

    // ===== サークルページ =====
    openCircle(id) {
        this.currentCircleId = id;
        Navigation.goTo('melonbooks-circle');
    },

    renderCirclePage() {
        const m = this._ensureData();
        const c = (m.circles || []).find(x => x.id === this.currentCircleId);
        if (!c) { Navigation.goTo('melonbooks'); return; }

        const titleEl = document.getElementById('melonCircleTitle');
        if (titleEl) titleEl.textContent = c.name;

        const content = document.getElementById('melonCircleContent');
        if (!content) return;

        const products = (m.products || []).filter(p => p.circleId === c.id).reverse();
        const tags = (c.tags || []).map(t => `<span class="melon-tag">${this._escHtml(t)}</span>`).join('');
        const isFollowed = (m.followedCircleIds || []).includes(c.id);

        content.innerHTML = `
        <div class="melon-circle-header-card">
            <div class="melon-circle-avatar-lg" style="background:${c.avatarColor || '#e8530e'}">${this._escHtml(c.avatarLetter || c.name.charAt(0))}</div>
            <div class="melon-circle-header-info">
                <h2 class="melon-circle-header-name">${this._escHtml(c.name)}</h2>
                <div class="melon-circle-header-author">${this._escHtml(c.author || '')}</div>
                <div class="melon-circle-header-tags">${tags}</div>
                <button class="melon-follow-btn ${isFollowed ? 'following' : ''}" onclick="event.stopPropagation();Melonbooks.toggleFollow('${c.id}')">
                    ${isFollowed ? I18n.t('melon.circle_follow_on', '★ フォロー中') : I18n.t('melon.circle_follow_off', '☆ フォローする')}
                </button>
            </div>
        </div>
        ${c.description ? `<div class="melon-circle-desc">${this._escHtml(c.description).replace(/\n/g, '<br>')}
${c.descriptionTl ? `<details class="tw-tl-block" style="margin-top:6px;"><summary class="tw-tl-btn">${I18n.t('melon.tl_label', '訳')}</summary><div class="tw-tl-content">${this._escHtml(c.descriptionTl)}</div></details>` : ''}
</div>` : ''}
        <h3 class="melon-section-title" style="margin-top:16px;">${I18n.t('melon.circle_works_header', { n: products.length })}</h3>
        ${products.length > 0
            ? `<div class="melon-product-grid">${products.map(p => this._renderProductCard(p)).join('')}</div>`
            : `<div class="melon-empty"><div class="empty-state-text">${I18n.t('melon.empty_no_circle_works', 'まだ作品がありません')}</div></div>`}`;
    },

    // ===== イベントページ =====
    openEvent(id) {
        this.currentEventId = id;
        Navigation.goTo('melonbooks-event');
    },

    renderEventPage() {
        const m = this._ensureData();
        const ev = (m.events || []).find(x => x.id === this.currentEventId);
        if (!ev) { Navigation.goTo('melonbooks'); return; }

        const titleEl = document.getElementById('melonEventTitle');
        if (titleEl) titleEl.textContent = ev.name;

        const content = document.getElementById('melonEventContent');
        if (!content) return;

        const circles = (ev.circleIds || []).map(cid => this._getCircle(cid)).filter(Boolean);
        const eventProducts = (m.products || []).filter(p => p.eventId === ev.id).reverse();
        const typeLabel = this._EVENT_TYPES[ev.type] || ev.type;
        const phase = ev.phase || 'announced';
        const phaseLabel = this._EVENT_PHASE_LABELS[phase] || phase;
        const phaseColor = this._EVENT_PHASE_COLORS[phase] || '#6c757d';
        const phaseIdx = this._EVENT_PHASE_ORDER.indexOf(phase);
        const phaseControls = phase === 'closed'
            ? `<div class="melon-event-phase-done">${I18n.t('melon.event_phase_done_msg', 'この即売会は終了しました')}</div>`
            : `<div class="melon-event-phase-actions">
                ${ev.phasePlotId === '__next__'
                    ? `<div class="melon-event-phase-pending">${I18n.t('melon.event_phase_pending_next_plot', '次の剧情更新で档期が進みます')}</div>`
                    : `<button class="melon-event-phase-btn primary" onclick="Melonbooks.bindEventToNextPlot('${ev.id}')">${I18n.t('melon.event_phase_btn_next_plot', '次の剧情更新で進める')}</button>`}
                <button class="melon-event-phase-btn" onclick="Melonbooks.cycleEventPhase('${ev.id}')">${I18n.t('melon.event_phase_btn_cycle', '手动で1段進める')}</button>
               </div>`;

        content.innerHTML = `
        <div class="melon-event-header-card">
            <div class="melon-event-header-badges">
                <span class="melon-event-type-badge">${this._escHtml(typeLabel)}</span>
                <span class="melon-event-phase-badge" style="background:${phaseColor}">${this._escHtml(phaseLabel)}</span>
            </div>
            <h2 class="melon-event-header-name">${this._escHtml(ev.name)}</h2>
            <div class="melon-event-header-meta">
                <div><span class="melon-meta-k">${I18n.t('melon.meta_schedule', '日程')}</span>${this._escHtml(ev.date || I18n.t('melon.date_tba', '日程未定'))}</div>
                <div><span class="melon-meta-k">${I18n.t('melon.meta_venue', '会場')}</span>${this._escHtml(ev.venue || I18n.t('melon.venue_tba', '会場未定'))}</div>
            </div>
            ${ev.description ? `<div class="melon-event-desc">${this._escHtml(ev.description).replace(/\n/g, '<br>')}</div>` : ''}
        </div>

        <div class="melon-event-phase-card">
            <div class="melon-event-phase-track">
                ${this._EVENT_PHASE_ORDER.map((ph, i) => `<span class="melon-phase-dot${i <= phaseIdx ? ' done' : ''}${i === phaseIdx ? ' current' : ''}">${this._EVENT_PHASE_LABELS[ph]}</span>`).join('')}
            </div>
            ${phaseControls}
            <div class="melon-event-phase-hint">${I18n.t('melon.event_phase_gate_hint', '展会闸门：論壇・推特は即売会が「開催間近〜終了直後」の時だけ展会を話題にします')}</div>
        </div>

        <h3 class="melon-section-title">${I18n.t('melon.event_circles_header', { n: circles.length })}</h3>
        ${circles.length > 0 ? circles.map(c => `
            <div class="melon-circle-item" onclick="Melonbooks.openCircle('${c.id}')">
                <div class="melon-circle-avatar" style="background:${c.avatarColor || '#e8530e'}">${this._escHtml(c.avatarLetter || c.name.charAt(0))}</div>
                <div class="melon-circle-info">
                    <div class="melon-circle-name">${this._escHtml(c.name)}</div>
                    <div class="melon-circle-author">${this._escHtml(c.author || '')}</div>
                </div>
            </div>`).join('') : `<div class="melon-empty"><div class="empty-state-text">${I18n.t('melon.empty_no_event_circles', '参加サークル情報なし')}</div></div>`}

        ${eventProducts.length > 0 ? `
        <h3 class="melon-section-title" style="margin-top:16px;">${I18n.t('melon.event_newbooks_header', { n: eventProducts.length })}</h3>
        <div class="melon-product-grid">${eventProducts.map(p => this._renderProductCard(p)).join('')}</div>` : ''}`;
    },

    // ===== お気に入り =====
    toggleFavorite(productId) {
        const m = this._ensureData();
        const idx = m.favorites.indexOf(productId);
        if (idx >= 0) {
            m.favorites.splice(idx, 1);
            Utils.showToast(I18n.t('t.melon_fav_removed', 'お気に入りから削除しました'));
        } else {
            m.favorites.push(productId);
            Utils.showToast(I18n.t('t.melon_fav_added', '♥ お気に入りに追加しました'));
        }
        Utils.saveData();
        // re-render detail if on detail page
        if (AppState.currentScreen === 'melonbooks-detail') this.renderProductDetail();
    },

    // ===== サークルフォロー =====
    toggleFollow(circleId) {
        const m = this._ensureData();
        const idx = (m.followedCircleIds || []).indexOf(circleId);
        if (idx >= 0) {
            m.followedCircleIds.splice(idx, 1);
            Utils.showToast(I18n.t('t.melon_unfollowed', 'フォロー解除しました'));
        } else {
            m.followedCircleIds.push(circleId);
            Utils.showToast(I18n.t('t.melon_followed', '★ フォローしました'));
        }
        Utils.saveData();
        if (AppState.currentScreen === 'melonbooks-circle') this.renderCirclePage();
    },

    // ===== 生成メニュー =====
    showGenerateMenu() {
        const m = this._ensureData();
        const hasCircles = m.circles.length > 0;
        const hasProducts = m.products.length > 0;

        const html = `
        <div class="melon-modal-overlay" id="melonGenerateModal" onclick="if(event.target===this)Melonbooks.closeGenerateModal()">
            <div class="melon-modal">
                <div class="melon-modal-title">${I18n.t('melon.gen_menu_title', '生成メニュー')}</div>
                <div class="melon-modal-buttons">
                    <button class="glass-btn melon-gen-btn" onclick="Melonbooks._doGenerate('circles')">
                        <span class="melon-gen-icon">${this._SVG.palette}</span> ${I18n.t('melon.gen_circles_label', 'サークル生成')}
                        <small>${I18n.t('melon.gen_circles_desc', '同人サークルを自動生成')}</small>
                    </button>
                    <button class="glass-btn melon-gen-btn" onclick="Melonbooks._doGenerate('products')" ${!hasCircles ? `disabled title="${I18n.t('melon.gen_need_circles_first', '先にサークルを生成してください')}"` : ''}>
                        <span class="melon-gen-icon">${this._SVG.book}</span> ${I18n.t('melon.gen_products_label', '新刊生成')}
                        <small>${I18n.t('melon.gen_products_desc', '同人誌を自動生成')}</small>
                    </button>
                    <button class="glass-btn melon-gen-btn" onclick="Melonbooks._doGenerate('event')" ${!hasCircles ? `disabled title="${I18n.t('melon.gen_need_circles_first', '先にサークルを生成してください')}"` : ''}>
                        <span class="melon-gen-icon">${this._SVG.event}</span> ${I18n.t('melon.gen_event_label', '即売会生成')}
                        <small>${I18n.t('melon.gen_event_desc', 'コミケ・オンリーイベント')}</small>
                    </button>
                    <button class="glass-btn melon-gen-btn" onclick="Melonbooks._doGenerate('rankings')" ${!hasProducts ? `disabled title="${I18n.t('melon.gen_need_products_first', '先に商品を生成してください')}"` : ''}>
                        <span class="melon-gen-icon">${this._SVG.chart}</span> ${I18n.t('melon.gen_rankings_label', 'ランキング生成')}
                        <small>${I18n.t('melon.gen_rankings_desc', '週間売上ランキング')}</small>
                    </button>
                    <button class="glass-btn melon-gen-btn" onclick="Melonbooks._doGenerate('feature')" ${!hasProducts ? `disabled title="${I18n.t('melon.gen_need_products_first', '先に商品を生成してください')}"` : ''}>
                        <span class="melon-gen-icon">${this._SVG.list}</span> ${I18n.t('melon.gen_feature_label', '特集生成')}
                        <small>${I18n.t('melon.gen_feature_desc', 'CPセレクション・ジャンル特集')}</small>
                    </button>
                </div>
                <button class="glass-btn melon-modal-close" onclick="Melonbooks.closeGenerateModal()">${I18n.t('melon.gen_menu_close', '閉じる')}</button>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
    },

    closeGenerateModal() {
        document.getElementById('melonGenerateModal')?.remove();
    },

    async _doGenerate(type) {
        this.closeGenerateModal();
        if (this._isGenerating) return;  // 并发锁：生成中忽略重复触发、防数据双写
        this._isGenerating = true;
        try {
            switch (type) {
                case 'circles': await this._generateCircles(); break;
                case 'products': await this._generateProducts(); break;
                case 'event': await this._generateEvent(); break;
                case 'rankings': await this._generateRankings(); break;
                case 'feature': await this._generateFeature(); break;
            }
        } catch (e) {
            console.error('[Melonbooks] Generation error:', e);
            Utils.showToast(I18n.t('t.melon_gen_error', '生成エラー: ') + e.message, 4000);
        } finally {
            this._isGenerating = false;
        }
    },

    // ===== AI生成: サークル =====
    async _generateCircles() {
        Utils.showToast(I18n.t('t.melon_circle_generating', 'サークル生成中...'));
        const forumData = AppState.data.forumData || {};
        const worldContext = (typeof Forum !== 'undefined' && Forum.getWorldContext) ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');
        const m = this._ensureData();
        const existingCircles = (m.circles || []).map(c => c.name).join('、');

        const systemPrompt = `あなたは同人誌即売会の世界をシミュレートするAIです。
以下の作品世界に対して、リアルな同人サークル情報を生成してください。

## 作品世界の情報
${worldContext || '（世界観未設定 — キャラクター名・CP・ストーリーイベントを捏造しないこと。一般的な同人サークルとして生成すること）'}
${Utils.PROMPTS.infoAccessRule()}
${typeof Utils !== 'undefined' ? Utils.getEventContextPrompt(3) : ''}

## 既存サークル（重複禁止）
${existingCircles || '（なし）'}

## 出力形式（厳守）
以下のJSON配列のみを出力すること。説明文やマークダウンは一切不要。
[
  {
    "name": "サークル名（日本語、創作的）",
    "author": "ペンネーム（日本語）",
    "tags": ["ジャンルタグ1", "タグ2", "タグ3"],
    "description": "サークル紹介文（50〜100字程度、日本語）",
    "descriptionTl": "descriptionの中国語（簡体字）翻訳"
  }
]

## ルール
- 3〜5サークル生成すること
- サークル名は同人即売会で実在しそうな日本語名にすること（例：「月下夢想」「紅蓮工房」「星屑レター」）
- タグは作品世界のキャラ名・CP名・ジャンルを反映すること
- 紹介文は本物のサークルカットのような雰囲気で
- 既存サークルと名前が重複しないこと`;

        const messages = [{ role: 'user', content: '同人サークル情報を生成してください。' }];
        const response = await Utils.callChatAPI(messages, systemPrompt);

        let parsed;
        try {
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            parsed = JSON.parse(jsonMatch ? jsonMatch[0] : response);
        } catch (e) {
            throw new Error('サークルデータの解析に失敗しました');
        }

        if (!Array.isArray(parsed) || parsed.length === 0) {
            throw new Error('サークルが生成されませんでした');
        }

        parsed.forEach(c => {
            m.circles.push({
                id: Utils.generateId(),
                name: c.name || 'unnamed',
                author: c.author || '',
                avatarLetter: (c.name || 'S').charAt(0),
                avatarColor: this._AVATAR_COLORS[Math.floor(Math.random() * this._AVATAR_COLORS.length)],
                tags: Array.isArray(c.tags) ? c.tags.slice(0, 5) : [],
                description: c.description || '',
                descriptionTl: c.descriptionTl || null,
                createdAt: Date.now()
            });
        });

        Utils.saveData();
        Utils.showToast(I18n.t('t.melon_circle_done', { n: parsed.length }));
        this.switchTab('circle', true);
    },

    // ===== AI生成: 商品 =====
    async _generateProducts() {
        Utils.showToast(I18n.t('t.melon_newbook_generating', '新刊生成中...'));
        const forumData = AppState.data.forumData || {};
        const worldContext = (typeof Forum !== 'undefined' && Forum.getWorldContext) ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');
        const m = this._ensureData();
        const circleList = (m.circles || []).map(c => `${c.name}（${c.author}）[タグ: ${(c.tags || []).join(', ')}]`).join('\n');
        const existingTitles = (m.products || []).map(p => p.title).join('、');

        // Pixiv連載完結チェック
        let pixivContext = '';
        const pixivData = AppState.data.pixivData;
        if (pixivData && pixivData.novels && pixivData.novels.length > 0) {
            const completedNovels = pixivData.novels.filter(n => n.chapters && n.chapters.length >= 3);
            if (completedNovels.length > 0) {
                pixivContext = `\n## Pixiv連載情報（書籍化候補）\n${completedNovels.map(n => `- 「${n.title}」${n.chapters.length}話、タグ: ${(n.tags || []).join(', ')}`).join('\n')}\n`;
            }
        }

        const systemPrompt = `あなたは同人ショップ「メロンブックス」の商品リスティングをシミュレートするAIです。
以下の作品世界とサークル情報に基づいて、リアルな同人誌商品情報を生成してください。

## 作品世界の情報
${worldContext || '（世界観未設定 — キャラクター名・CP・ストーリーイベントを捏造しないこと）'}
${Utils.PROMPTS.infoAccessRule()}
${typeof Utils !== 'undefined' ? Utils.getEventContextPrompt(3) : ''}
${pixivContext}

## 登録済みサークル
${circleList || '（サークル未登録）'}

## 既存商品タイトル（重複禁止）
${existingTitles || '（なし）'}

## 出力形式（厳守）
以下のJSON配列のみを出力すること。
[
  {
    "circleName": "既存サークル名（上のリストから選択）",
    "title": "同人誌タイトル（日本語）",
    "type": "novel|manga|music|anthology",
    "price": "¥XXX",
    "pageCount": 数字,
    "size": "A5|B5",
    "rating": "all|R18",
    "tags": ["タグ1", "タグ2"],
    "sampleText": "あらすじ（80〜150字、日本語）",
    "sampleTextTl": "sampleTextの中国語（簡体字）翻訳"
  }
]

## ルール
- 3〜5商品を生成すること
- 各商品は必ず既存サークルのいずれかに紐づけること
- タイトルは同人誌即売会で実在しそうな日本語タイトルにすること
- 価格は ¥300〜¥2000 の範囲で、ページ数に比例させること
- type は novel/manga が多め、時々 music/anthology を混ぜること
- あらすじは同人誌の裏表紙に書かれるような雰囲気で
- 作品設定に記載されたキャラ名・CP・設定のみを使用すること（記載がなければ捏造しないこと）
- Pixiv連載情報がある場合、1商品は書籍化版（type:novel）にしてもよい
- 既存商品タイトルと重複しないこと
- 🚫 世界観に存在しない展開やキャラクターを捏造しないこと`;

        const messages = [{ role: 'user', content: '新刊情報を生成してください。' }];
        const response = await Utils.callChatAPI(messages, systemPrompt);

        let parsed;
        try {
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            parsed = JSON.parse(jsonMatch ? jsonMatch[0] : response);
        } catch (e) {
            throw new Error('商品データの解析に失敗しました');
        }

        if (!Array.isArray(parsed) || parsed.length === 0) {
            throw new Error('商品が生成されませんでした');
        }

        let count = 0;
        parsed.forEach(p => {
            const circle = (m.circles || []).find(c => c.name === p.circleName);
            if (!circle) return; // サークルが見つからない場合はスキップ

            m.products.push({
                id: Utils.generateId(),
                circleId: circle.id,
                title: p.title || 'untitled',
                type: this._GENERATABLE_TYPES.includes(p.type) ? p.type : 'novel',
                price: p.price || '¥500',
                pageCount: parseInt(p.pageCount) || null,
                size: p.size || 'A5',
                rating: p.rating === 'R18' ? 'R18' : 'all',
                tags: Array.isArray(p.tags) ? p.tags.slice(0, 5) : [],
                sampleText: p.sampleText || '',
                sampleTextTl: p.sampleTextTl || null,
                isNew: true,
                status: 'on_sale',
                statusPlotId: null,
                eventId: null,
                pixivNovelId: null,
                createdAt: Date.now()
            });
            count++;
        });

        Utils.saveData();

        // イベント発射
        if (count > 0 && typeof Utils !== 'undefined' && Utils.emitEvent) {
            const titles = parsed.slice(0, 3).map(p => p.title).join('、');
            Utils.emitEvent('doujin_published', 'melonbooks', { title: `新刊${count}冊入荷`, summary: titles });
        }

        Utils.showToast(I18n.t('t.melon_product_done', { n: count }));
        this.switchTab('new', true);

        // 非同期で表紙画像を生成（renderの後に実行）
        const newProducts = (m.products || []).slice(-count);
        this._generateProductCovers(newProducts);
    },

    // ===== AI生成: イベント =====
    async _generateEvent() {
        const forumData = AppState.data.forumData || {};
        const worldContext = (typeof Forum !== 'undefined' && Forum.getWorldContext) ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');
        Utils.showToast(I18n.t('t.melon_event_generating', 'イベント生成中...'));
        const m = this._ensureData();
        const circleList = (m.circles || []).map(c => c.name).join('、');
        const existingEvents = (m.events || []).map(e => e.name).join('、');

        const systemPrompt = `あなたは同人即売会の運営をシミュレートするAIです。
以下の作品世界に対して、リアルな同人即売会イベントを1つ生成してください。

## 作品世界の情報
${worldContext || '（世界観未設定 — キャラクター名・CP・ストーリーイベントを捏造しないこと）'}
${Utils.PROMPTS.infoAccessRule()}
${typeof Utils !== 'undefined' ? Utils.getEventContextPrompt(3) : ''}

## 登録済みサークル
${circleList || '（なし）'}

## 既存イベント（重複禁止）
${existingEvents || '（なし）'}

## 出力形式（厳守）
以下のJSONオブジェクトのみを出力すること。
{
  "name": "イベント名（日本語、例：『○○ONLY -副題-』）",
  "type": "comike|only|online",
  "date": "20XX年X月X日",
  "venue": "会場名（例：東京ビッグサイト 西ホール）",
  "description": "イベント概要（100〜200字、日本語、告知文の雰囲気で）",
  "participatingCircles": ["サークル名1", "サークル名2"]
}

## ルール
- コミケ・オンリー・オンラインのいずれか
- オンリーの場合、作品世界のジャンル名やCPを冠すること
- 参加サークルは既存サークルから2〜5つ選ぶこと（全員でなくてよい）
- 告知文はTwitterやpixivの告知に載るようなリアルなトーンで
- 既存イベントと名前が重複しないこと`;

        const messages = [{ role: 'user', content: '即売会イベントを生成してください。' }];
        const response = await Utils.callChatAPI(messages, systemPrompt);

        let parsed;
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            parsed = JSON.parse(jsonMatch ? jsonMatch[0] : response);
        } catch (e) {
            throw new Error('イベントデータの解析に失敗しました');
        }

        // 参加サークルのIDを解決
        const circleIds = (parsed.participatingCircles || [])
            .map(name => {
                const c = (m.circles || []).find(c => c.name === name);
                return c ? c.id : null;
            })
            .filter(Boolean);

        const event = {
            id: Utils.generateId(),
            name: parsed.name || 'イベント',
            type: ['comike', 'only', 'online'].includes(parsed.type) ? parsed.type : 'other',
            date: parsed.date || '',
            venue: parsed.venue || '',
            description: parsed.description || '',
            circleIds,
            isUpcoming: true,
            phase: 'announced',
            phasePlotId: null,
            closedAtPlotCount: null,
            createdAt: Date.now()
        };
        m.events.push(event);
        Utils.saveData();

        // doujin_event は即売会が preopen に進んだ時に _advanceEventPhase 内で発射する。
        // 生成時は phase='announced'（闸门閉）なので、ここでは発射しない（事件流と闸门を同期）。

        Utils.showToast(I18n.t('t.melon_event_done', '✓ イベント生成完了 — 新刊を生成中...'));
        this.openEvent(event.id);

        // 即売会参加サークルの新刊を自動生成
        if (circleIds.length > 0) {
            try {
                await this._generateEventProducts(event.id, circleIds);
            } catch (e) {
                console.error('[Melonbooks] Event product generation error:', e);
            }
        }
    },

    // ===== AI生成: 即売会限定新刊 =====
    async _generateEventProducts(eventId, circleIds) {
        const m = this._ensureData();
        const ev = (m.events || []).find(e => e.id === eventId);
        if (!ev) return;

        const forumData = AppState.data.forumData || {};
        const worldContext = (typeof Forum !== 'undefined' && Forum.getWorldContext) ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');

        const circleInfo = circleIds.map(cid => {
            const c = this._getCircle(cid);
            return c ? `${c.name}（${c.author}）[タグ: ${(c.tags || []).join(', ')}]` : null;
        }).filter(Boolean);

        const systemPrompt = `あなたは同人即売会の新刊情報をシミュレートするAIです。
以下のイベントに参加するサークルの新刊を生成してください。

## イベント情報
名前: ${ev.name}
種類: ${this._EVENT_TYPES_JA[ev.type] || ev.type}
日程: ${ev.date || '未定'}

## 作品世界
${worldContext || '（世界観未設定 — キャラクター名・CP・ストーリーイベントを捏造しないこと）'}
${Utils.PROMPTS.infoAccessRule()}

## 参加サークル
${circleInfo.join('\n')}

## 出力形式（厳守）
以下のJSON配列のみを出力すること。各サークルにつき1冊の新刊を生成。
[
  {
    "circleName": "サークル名",
    "title": "新刊タイトル",
    "type": "novel|manga|music|anthology",
    "price": "¥XXX",
    "pageCount": 数字,
    "size": "A5|B5",
    "rating": "all|R18",
    "tags": ["タグ1", "タグ2"],
    "sampleText": "あらすじ（50〜100字）"
  }
]

## ルール
- 各サークルのタグ・傾向に合った内容にすること
- イベント限定感のある同人誌にすること（イベント名を意識した内容）
- 価格は ¥300〜¥1500
- 🚫 世界観に存在しない展開を捏造しないこと`;

        const messages = [{ role: 'user', content: `${ev.name}の新刊情報を生成してください。` }];
        const response = await Utils.callChatAPI(messages, systemPrompt);

        let parsed;
        try {
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            parsed = JSON.parse(jsonMatch ? jsonMatch[0] : response);
        } catch (e) {
            Utils.showToast(I18n.t('t.melon_newbook_parse_failed', '新刊データの解析に失敗しました'));
            return;
        }

        if (!Array.isArray(parsed)) return;

        let count = 0;
        parsed.forEach(p => {
            const circle = (m.circles || []).find(c => c.name === p.circleName);
            if (!circle) return;

            m.products.push({
                id: Utils.generateId(),
                circleId: circle.id,
                title: p.title || 'untitled',
                type: this._GENERATABLE_TYPES.includes(p.type) ? p.type : 'novel',
                price: p.price || '¥500',
                pageCount: parseInt(p.pageCount) || null,
                size: p.size || 'A5',
                rating: p.rating === 'R18' ? 'R18' : 'all',
                tags: Array.isArray(p.tags) ? p.tags.slice(0, 5) : [],
                sampleText: p.sampleText || '',
                isNew: true,
                status: 'preorder',
                statusPlotId: null,
                eventId: eventId,
                pixivNovelId: null,
                createdAt: Date.now()
            });
            count++;
        });

        if (count > 0) {
            Utils.saveData();
            if (typeof Utils !== 'undefined' && Utils.emitEvent) {
                // title/summary は中性表現に — 即売会名・新刊タイトルを事件流に出さない（announced 阶段での泄漏防止）
                Utils.emitEvent('doujin_published', 'melonbooks', { title: `新刊${count}冊入荷`, summary: `${count}冊の新刊が登場` });
            }
            Utils.showToast(I18n.t('t.melon_event_newbooks_done', { n: count }));
            // refresh event page to show products
            if (AppState.currentScreen === 'melonbooks-event') this.renderEventPage();
        }
    },

    // ===== AI生成: 特集 =====
    async _generateFeature() {
        Utils.showToast(I18n.t('t.melon_feature_generating', '特集生成中...'));
        const m = this._ensureData();
        const products = m.products || [];

        if (products.length < 3) {
            Utils.showToast(I18n.t('t.melon_feature_need_3', '特集生成には3商品以上必要です'));
            return;
        }

        const productList = products.map(p => {
            const circle = this._getCircle(p.circleId);
            return `ID:${p.id} | 「${p.title}」(${this._PRODUCT_TYPES_JA[p.type] || p.type}) by ${circle ? circle.name : '?'} | タグ: ${(p.tags || []).join(',')}`;
        }).join('\n');

        const existingFeatures = (m.features || []).map(f => f.title).join('、');

        const systemPrompt = `あなたは同人ショップ「メロンブックス」の特集ページ担当スタッフです。
以下の商品リストから、テーマ別の特集ページを1つ作成してください。

## 商品リスト
${productList}

## 既存特集（重複禁止）
${existingFeatures || '（なし）'}

## 出力形式（厳守）
以下のJSONオブジェクトのみを出力すること。
{
  "title": "特集タイトル（例：「○○CPセレクション」「バトル系同人誌特集」「注目の新人サークル」）",
  "description": "特集紹介文（80〜150字、スタッフ目線の推薦文）",
  "selectedProducts": [
    {
      "productId": "商品ID",
      "comment": "スタッフコメント（30〜50字、推薦理由）"
    }
  ]
}

## ルール
- 3〜6商品を選んでテーマを統一すること
- CP特集、ジャンル特集、新人サークル特集、季節特集など、バリエーション豊かに
- コメントは書店スタッフPOPのような親しみやすいトーンで
- 既存特集と被らないテーマにすること`;

        const messages = [{ role: 'user', content: '特集ページを生成してください。' }];
        const response = await Utils.callChatAPI(messages, systemPrompt);

        let parsed;
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            parsed = JSON.parse(jsonMatch ? jsonMatch[0] : response);
        } catch (e) {
            throw new Error('特集データの解析に失敗しました');
        }

        // productId → comment マッピング
        const comments = {};
        const productIds = [];
        (parsed.selectedProducts || []).forEach(sp => {
            if (sp.productId && products.find(p => p.id === sp.productId)) {
                productIds.push(sp.productId);
                comments[sp.productId] = sp.comment || '';
            }
        });

        const feature = {
            id: Utils.generateId(),
            title: parsed.title || '特集',
            description: parsed.description || '',
            productIds,
            comments,
            createdAt: Date.now()
        };
        m.features.push(feature);
        Utils.saveData();
        Utils.showToast(I18n.t('t.melon_feature_done', '✓ 特集生成完了'));
        this.openFeature(feature.id);
    },

    // ===== 特集ページ =====
    openFeature(id) {
        this.currentFeatureId = id;
        Navigation.goTo('melonbooks-feature');
    },

    renderFeaturePage() {
        const m = this._ensureData();
        const f = (m.features || []).find(x => x.id === this.currentFeatureId);
        if (!f) { Navigation.goTo('melonbooks'); return; }

        const titleEl = document.getElementById('melonFeatureTitle');
        if (titleEl) titleEl.textContent = f.title;

        const content = document.getElementById('melonFeatureContent');
        if (!content) return;

        const featureProducts = (f.productIds || []).map(pid => (m.products || []).find(p => p.id === pid)).filter(Boolean);

        content.innerHTML = `
        <div class="melon-feature-header">
            <span class="melon-feature-icon">${this._SVG.list}</span>
            <h2 class="melon-feature-title">${this._escHtml(f.title)}</h2>
            <p class="melon-feature-desc">${this._escHtml(f.description)}</p>
            <div class="melon-feature-meta">${this._timeAgo(f.createdAt)} · ${I18n.t('melon.feature_count_unit', { n: featureProducts.length })}</div>
        </div>

        ${featureProducts.map(p => {
            const circle = this._getCircle(p.circleId);
            const comment = (f.comments || {})[p.id] || '';
            return `
            <div class="melon-feature-item" onclick="Melonbooks.openProduct('${p.id}')">
                <div class="melon-feature-item-cover">${this._coverPlaceholder(p, 'mini')}</div>
                <div class="melon-feature-item-info">
                    <div class="melon-feature-item-title">${this._escHtml(p.title)}</div>
                    <div class="melon-feature-item-circle">${this._escHtml(circle ? circle.name : '')}</div>
                    <div class="melon-feature-item-price">${this._escHtml(p.price || '')}</div>
                    ${comment ? `<div class="melon-feature-comment">💬 ${this._escHtml(comment)}</div>` : ''}
                </div>
            </div>`;
        }).join('')}`;
    },

    deleteFeature(id) {
        const m = this._ensureData();
        m.features = (m.features || []).filter(f => f.id !== id);
        Utils.saveData();
        Utils.showToast(I18n.t('t.melon_feature_deleted', '特集を削除しました'));
        Navigation.goTo('melonbooks');
    },

    // ===== AI生成: ランキング =====
    async _generateRankings() {
        Utils.showToast(I18n.t('t.melon_ranking_generating', 'ランキング生成中...'));
        const m = this._ensureData();
        const products = m.products || [];

        if (products.length < 3) {
            Utils.showToast(I18n.t('t.melon_ranking_need_3', 'ランキング生成には3商品以上必要です'));
            return;
        }

        const productList = products.map(p => {
            const circle = this._getCircle(p.circleId);
            return `ID:${p.id} | 「${p.title}」(${this._PRODUCT_TYPES_JA[p.type] || p.type}) by ${circle ? circle.name : '?'} | ${p.price} | タグ: ${(p.tags || []).join(',')}`;
        }).join('\n');

        const systemPrompt = `あなたは同人ショップ「メロンブックス」の週間ランキングを作成するAIです。
以下の商品リストから、売上ランキングTOP5〜10を選び、各商品に一行コメントを付けてください。

## 商品リスト
${productList}

## 出力形式（厳守）
以下のJSONオブジェクトのみを出力すること。
{
  "title": "週間同人誌ランキング（○月第○週）",
  "items": [
    {
      "productId": "商品ID（上のリストのID:の後の値）",
      "title": "商品タイトル",
      "comment": "店員コメント（20〜40字、日本語）"
    }
  ]
}

## ルール
- 上位ほど話題性・テーマの新鮮さを考慮すること
- コメントはメロンブックスの店員ポップのような親しみやすいトーンで
- 全ての商品を入れる必要はない（5〜10作品）
- 同じサークルが連続しすぎないよう適度にバラけさせること`;

        const messages = [{ role: 'user', content: '週間ランキングを生成してください。' }];
        const response = await Utils.callChatAPI(messages, systemPrompt);

        let parsed;
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            parsed = JSON.parse(jsonMatch ? jsonMatch[0] : response);
        } catch (e) {
            throw new Error('ランキングデータの解析に失敗しました');
        }

        const ranking = {
            id: Utils.generateId(),
            title: parsed.title || '週間ランキング',
            items: Array.isArray(parsed.items) ? parsed.items : [],
            createdAt: Date.now()
        };
        m.rankings.push(ranking);
        Utils.saveData();
        Utils.showToast(I18n.t('t.melon_ranking_done', '✓ ランキング生成完了'));
        this.switchTab('ranking', true);
    },

    // ===== 削除 =====
    shareToLine(productId) {
        const m = this._ensureData();
        const product = (m.products || []).find(p => p.id === productId);
        if (!product) return;
        const circle = (m.circles || []).find(c => c.id === product.circleId);
        if (typeof LineTalk !== 'undefined') {
            LineTalk.showShareCharSelect('product', {
                title: product.title || '',
                circleName: circle ? circle.name : '',
                coverEmoji: '📖',
                price: product.price || '',
                productId: product.id
            });
        }
    },

    deleteProduct(id) {
        const m = this._ensureData();
        m.products = (m.products || []).filter(p => p.id !== id);
        m.favorites = (m.favorites || []).filter(f => f !== id);
        Utils.saveData();
        Utils.showToast(I18n.t('t.melon_product_deleted', '商品を削除しました'));
        Navigation.goTo('melonbooks');
    },

    deleteCircle(id) {
        const m = this._ensureData();
        m.circles = (m.circles || []).filter(c => c.id !== id);
        // 関連商品のcircleIdをnullに
        (m.products || []).forEach(p => { if (p.circleId === id) p.circleId = null; });
        // イベント参加リストから除去
        (m.events || []).forEach(e => { e.circleIds = (e.circleIds || []).filter(cid => cid !== id); });
        Utils.saveData();
        Utils.showToast(I18n.t('t.melon_circle_deleted', 'サークルを削除しました'));
        Navigation.goTo('melonbooks');
    },

    deleteEvent(id) {
        const m = this._ensureData();
        m.events = (m.events || []).filter(e => e.id !== id);
        // 関連商品のeventIdをnullに
        (m.products || []).forEach(p => { if (p.eventId === id) p.eventId = null; });
        Utils.saveData();
        Utils.showToast(I18n.t('t.melon_event_deleted', 'イベントを削除しました'));
        Navigation.goTo('melonbooks');
    },

    // ===== カート =====
    addToCart(productId) {
        const m = this._ensureData();
        if (m.cart.find(c => c.productId === productId)) {
            Utils.showToast(I18n.t('t.melon_already_in_cart', 'すでにカートに入っています'));
            return;
        }
        m.cart.push({ productId, quantity: 1, addedAt: Date.now() });
        Utils.saveData();
        Utils.showToast(I18n.t('t.melon_added_to_cart', 'カートに追加しました'));
        this._updateCartBadge();
        if (AppState.currentScreen === 'melonbooks-detail') this.renderProductDetail();
    },

    removeFromCart(productId) {
        const m = this._ensureData();
        m.cart = m.cart.filter(c => c.productId !== productId);
        Utils.saveData();
        Utils.showToast(I18n.t('t.melon_removed_from_cart', 'カートから削除しました'));
        this._updateCartBadge();
        if (AppState.currentScreen === 'melonbooks-cart') this.renderCart();
    },

    purchase() {
        const m = this._ensureData();
        if (m.cart.length === 0) { Utils.showToast(I18n.t('t.melon_cart_empty', 'カートが空です')); return; }

        const productIds = m.cart.map(c => c.productId);
        const total = m.cart.reduce((sum, c) => {
            const p = (m.products || []).find(x => x.id === c.productId);
            const price = parseInt((p?.price || '0').replace(/[^0-9]/g, '')) || 0;
            return sum + price * c.quantity;
        }, 0);

        // LINE Pay 残高チェック
        if (typeof LinePay !== 'undefined') {
            LinePay._ensureWallet();
            const wallet = AppState.data.wallet;
            if (wallet.balance < total) {
                if (confirm(I18n.t('melon.balance_insufficient', { balance: wallet.balance.toLocaleString(), total: total.toLocaleString() }))) {
                    LinePay.showChargePanel();
                }
                return;
            }
            // 残高から差し引き
            wallet.balance -= total;
            wallet.transactions.push({
                id: Utils.generateId(), type: 'purchase', amount: -total,
                targetName: I18n.t('melon.purchase_target_name', 'メロンブックス'), targetId: null,
                description: I18n.t('melon.purchase_desc_count', { n: productIds.length }),
                relatedPurchaseId: null, // 下で更新
                timestamp: Date.now()
            });
        }

        const purchaseId = Utils.generateId();
        m.purchaseHistory.push({
            id: purchaseId,
            productIds,
            totalPrice: `¥${total.toLocaleString()}`,
            totalPriceNumeric: total,
            purchasedAt: Date.now()
        });

        // 関連付け
        if (typeof LinePay !== 'undefined' && AppState.data.wallet.transactions.length > 0) {
            const lastTx = AppState.data.wallet.transactions[AppState.data.wallet.transactions.length - 1];
            if (lastTx.type === 'purchase') lastTx.relatedPurchaseId = purchaseId;
        }

        m.cart = [];
        Utils.saveData();
        Utils.showToast(I18n.t('t.melon_purchase_done', '✓ 購入完了！'));
        this._updateCartBadge();
        this.renderCart();
    },

    renderCart() {
        const m = this._ensureData();
        const titleEl = document.getElementById('melonCartTitle');
        if (titleEl) titleEl.textContent = I18n.t('melon.cart_title_count', { n: m.cart.length });

        const content = document.getElementById('melonCartContent');
        if (!content) return;

        if (m.cart.length === 0) {
            // 购入履歴を表示
            const history = (m.purchaseHistory || []).slice().reverse();
            content.innerHTML = `
                <div class="melon-empty">
                    <div class="empty-state-icon">${this._SVG.cart}</div>
                    <div class="empty-state-text">${I18n.t('melon.cart_empty', 'カートは空です')}</div>
                </div>
                ${history.length > 0 ? `
                <h3 class="melon-section-title" style="margin-top:20px;">${I18n.t('melon.purchase_history_header', '購入履歴')}</h3>
                ${history.map(h => `
                    <div class="melon-purchase-history-item">
                        <div class="melon-purchase-date">${this._timeAgo(h.purchasedAt)}</div>
                        <div class="melon-purchase-items">${I18n.t('melon.purchase_count_unit', { n: h.productIds.length })}</div>
                        <div class="melon-purchase-total">${this._escHtml(h.totalPrice)}</div>
                    </div>`).join('')}` : ''}`;
            return;
        }

        let total = 0;
        const itemsHtml = m.cart.map(c => {
            const p = (m.products || []).find(x => x.id === c.productId);
            if (!p) return '';
            const circle = this._getCircle(p.circleId);
            const price = parseInt((p.price || '0').replace(/[^0-9]/g, '')) || 0;
            total += price * c.quantity;
            return `
            <div class="melon-cart-item">
                <div class="melon-cart-item-cover">${this._coverPlaceholder(p, 'mini')}</div>
                <div class="melon-cart-item-info">
                    <div class="melon-cart-item-title">${this._escHtml(p.title)}</div>
                    <div class="melon-cart-item-circle">${this._escHtml(circle ? circle.name : '')}</div>
                    <div class="melon-cart-item-price">${this._escHtml(p.price || '---')}</div>
                </div>
                <button class="melon-cart-remove" onclick="Melonbooks.removeFromCart('${p.id}')">✕</button>
            </div>`;
        }).join('');

        content.innerHTML = `
            ${itemsHtml}
            <div class="melon-cart-total">
                <span>${I18n.t('melon.cart_total_label', '合計')}</span>
                <span class="melon-price">¥${total.toLocaleString()}</span>
            </div>`;
    },

    _updateCartBadge() {
        const m = this._ensureData();
        const badge = document.getElementById('melonCartBadge');
        if (badge) {
            badge.textContent = m.cart.length;
            badge.style.display = m.cart.length > 0 ? 'flex' : 'none';
        }
    },

    // ===== 商品ステータス管理 =====

    // 剧情更新时自动推进商品状态（从 Forum.addPlotEntry 调用或 init 时检查）
    checkStatusTransitions() {
        const m = this._ensureData();
        const forumData = AppState.data.forumData || {};
        const plotProgress = AppState.data.broadcast.plotProgress || [];
        if (plotProgress.length === 0) return;

        const latestPlotId = plotProgress[plotProgress.length - 1]?.id;
        if (!latestPlotId) return;

        let changed = false;
        (m.products || []).forEach(p => {
            if (!p.statusPlotId || p.statusPlotId !== latestPlotId) return;

            // 状态推进规则：upcoming → preorder → on_sale
            const transitions = { upcoming: 'preorder', preorder: 'on_sale' };
            const nextStatus = transitions[p.status];
            if (nextStatus) {
                p.status = nextStatus;
                p.statusPlotId = null; // 清除绑定，等待下次手动绑定
                changed = true;
            }
        });

        // 即売会关联商品：即売会が終了(closed)した時、関連商品を自动で通販に
        (m.events || []).forEach(ev => {
            if (ev.phase === 'closed') {
                (m.products || []).forEach(p => {
                    if (p.eventId === ev.id && p.status === 'on_sale') {
                        p.status = 'mail_order';
                        changed = true;
                    }
                });
            }
        });

        if (changed) {
            Utils.saveData();
            // 如果当前在 melonbooks 页面，刷新显示
            if (AppState.currentScreen === 'melonbooks') this._renderCurrentTab();
        }
    },

    // 手动切换商品状态
    cycleStatus(productId) {
        const m = this._ensureData();
        const p = (m.products || []).find(x => x.id === productId);
        if (!p) return;

        const order = ['upcoming', 'preorder', 'on_sale', 'mail_order', 'sold_out'];
        const currentIdx = order.indexOf(p.status || 'on_sale');
        p.status = order[(currentIdx + 1) % order.length];
        Utils.saveData();
        Utils.showToast(I18n.t('t.melon_status_changed', { x: this._STATUS_LABELS[p.status] }));
        if (AppState.currentScreen === 'melonbooks-detail') this.renderProductDetail();
    },

    // 绑定商品到下一个剧情节点（下次发布剧情时状态自动推进）
    bindToNextPlot(productId) {
        const m = this._ensureData();
        const p = (m.products || []).find(x => x.id === productId);
        if (!p) return;

        // 标记：下次 plotProgress 新增时触发
        p.statusPlotId = '__next__';
        Utils.saveData();
        Utils.showToast(I18n.t('t.melon_status_next_plot', '次の剧情更新で状態が変わります'));
        if (AppState.currentScreen === 'melonbooks-detail') this.renderProductDetail();
    },

    // 在 Forum 发布新剧情时调用（需要 Forum 侧集成）
    onPlotPublished(plotId) {
        const m = this._ensureData();
        let changed = false;

        (m.products || []).forEach(p => {
            if (p.statusPlotId === '__next__') {
                p.statusPlotId = plotId; // 绑定到实际的 plotId
                // 立即推进状态
                const transitions = { upcoming: 'preorder', preorder: 'on_sale' };
                const nextStatus = transitions[p.status];
                if (nextStatus) {
                    p.status = nextStatus;
                    changed = true;
                }
                p.statusPlotId = null;
            }
        });

        // 即売会档期推进：'__next__' 紐付けの即売会を1段進める（商品推进とは独立に追加）
        (m.events || []).forEach(ev => {
            if (ev.phasePlotId === '__next__') {
                if (this._advanceEventPhase(ev)) changed = true;
                ev.phasePlotId = null;
            }
        });

        if (changed) {
            Utils.saveData();
            if (AppState.currentScreen === 'melonbooks') this._renderCurrentTab();
        }
    },

    // ===== 即売会 档期（phase）管理 =====
    // 即売会の档期を1段進める統一ヘルパー（剧情推进・手动 cycle 共用 — 副作用を集中管理）
    _advanceEventPhase(ev) {
        if (!ev) return false;
        const order = this._EVENT_PHASE_ORDER;
        const idx = order.indexOf(ev.phase || 'announced');
        if (idx < 0 || idx >= order.length - 1) return false; // 既に closed か不正値
        ev.phase = order[idx + 1];
        ev.isUpcoming = (ev.phase !== 'closed'); // 派生フィールド同期
        // 副作用①：preopen に進んだ時に doujin_event を発射（事件流と闸门を同期）
        if (ev.phase === 'preopen' && typeof Utils !== 'undefined' && Utils.emitEvent) {
            Utils.emitEvent('doujin_event', 'melonbooks', {
                title: ev.name,
                summary: `${this._EVENT_TYPES_JA[ev.type] || ''}・${(ev.circleIds || []).length}サークル参加`,
                phase: 'preopen',
                venue: ev.venue || ''
            });
        }
        // 副作用②：closed に進んだ時に closedAtPlotCount を記録（終了余韻ウィンドウ判定用）
        if (ev.phase === 'closed') {
            ev.closedAtPlotCount = (((AppState.data.broadcast && AppState.data.broadcast.plotProgress) || []).length);
        }
        return true;
    },

    // 即売会を次の剧情ノードに紐付け（下次发布剧情时档期が1段進む）
    bindEventToNextPlot(eventId) {
        const m = this._ensureData();
        const ev = (m.events || []).find(e => e.id === eventId);
        if (!ev) return;
        if (ev.phase === 'closed') { Utils.showToast(I18n.t('t.melon_event_already_closed', 'この即売会はすでに終了しています')); return; }
        ev.phasePlotId = '__next__';
        Utils.saveData();
        Utils.showToast(I18n.t('t.melon_event_phase_next_plot', '次の剧情更新で開催状況が進みます'));
        if (AppState.currentScreen === 'melonbooks-event') this.renderEventPage();
    },

    // 手动推进即売会档期
    cycleEventPhase(eventId) {
        const m = this._ensureData();
        const ev = (m.events || []).find(e => e.id === eventId);
        if (!ev) return;
        if (!this._advanceEventPhase(ev)) {
            Utils.showToast(I18n.t('t.melon_event_already_closed', 'この即売会はすでに終了しています'));
            return;
        }
        Utils.saveData();
        Utils.showToast(I18n.t('t.melon_event_phase_advanced', { x: this._EVENT_PHASE_LABELS[ev.phase] || ev.phase }));
        if (AppState.currentScreen === 'melonbooks-event') this.renderEventPage();
        else if (AppState.currentScreen === 'melonbooks') this._renderCurrentTab();
    },

    // 展会话题闸门：论坛/推特据此判断「现在能不能聊同人即売会、能聊什么」
    // 返回 { open:bool, stage:'preopen'|'open'|'closed'|null, events:[], topics:[] }
    getEventTopicGate() {
        const m = this._ensureData();
        const plotLen = (((AppState.data.broadcast && AppState.data.broadcast.plotProgress) || []).length);
        const inWindow = [];
        (m.events || []).forEach(ev => {
            const phase = ev.phase || 'announced';
            if (phase === 'preopen' || phase === 'open') {
                inWindow.push(ev);
            } else if (phase === 'closed') {
                // 終了余韻ウィンドウ：closedAtPlotCount が数値、かつ終了後まだ次の剧情が出ていない時のみ
                // （null / 非数値は明示的に窓外扱い — NaN を算術判定に入れない）
                if (typeof ev.closedAtPlotCount === 'number' && (plotLen - ev.closedAtPlotCount) < 1) {
                    inWindow.push(ev);
                }
            }
            // announced は窓外（即売会はまだ「未来の予定」、热议すべきでない）
        });
        if (inWindow.length === 0) {
            return { open: false, stage: null, events: [], topics: [] };
        }
        // stage：最も活発な档期を採用（open > preopen > closed）
        const priority = { open: 3, preopen: 2, closed: 1 };
        let stage = 'closed';
        inWindow.forEach(ev => {
            if ((priority[ev.phase] || 0) > (priority[stage] || 0)) stage = ev.phase;
        });
        const TOPICS = {
            preopen: ['新刊予告', '参加サークル告知', '開催への期待'],
            open: ['会場の様子', '新刊速報', '戦利品速報'],
            closed: ['戦利品報告', '参加レポ・感想']
        };
        return {
            open: true,
            stage,
            events: inWindow.map(ev => ({ name: ev.name, type: ev.type, venue: ev.venue || '', phase: ev.phase })),
            topics: TOPICS[stage] || []
        };
    },

    // ===== ヘルパー =====
    _getCircle(id) {
        return (this._ensureData().circles || []).find(c => c.id === id) || null;
    },

    _escHtml(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },

    _timeAgo(ts) {
        if (!ts) return '';
        const diff = Date.now() - ts;
        const min = Math.floor(diff / 60000);
        if (min < 1) return I18n.t('melon.timeago_now', 'たった今');
        if (min < 60) return I18n.t('melon.timeago_min', { n: min });
        const hr = Math.floor(min / 60);
        if (hr < 24) return I18n.t('melon.timeago_hour', { n: hr });
        return I18n.t('melon.timeago_day', { n: Math.floor(hr / 24) });
    },

    // ===== 表紙画像生成 =====

    _hasImageApi() {
        const config = AppState.data.imageApiConfig;
        const modules = AppState.data.imageGenModules || {};
        return !!(config && config.key && config.provider && modules.melonbooks !== false);
    },

    // 商品情報 + 世界書 → 英語プロンプト生成
    async _buildCoverPrompt(product) {
        const circle = this._getCircle(product.circleId);
        const tags = (product.tags || []).join(', ');

        // 世界書からキャラ外見抽出（タイトル + あらすじ + タグで照合）
        const searchText = `${product.title} ${product.sampleText || ''} ${tags}`;
        const wbIds = Utils.getActiveWorldBookIds();
        let charAppearance = '';
        wbIds.forEach(wbId => {
            const book = (AppState.data.worldBooks || []).find(b => b.id === wbId);
            if (book && book.entries) {
                book.entries.filter(e => e.enabled !== false).forEach(e => {
                    const titleMatch = e.title && searchText.includes(e.title);
                    const keyMatch = (e.keys || []).some(k => k && searchText.includes(k));
                    if (titleMatch || keyMatch) {
                        charAppearance += `【${e.title}】${e.content}\n`;
                    }
                });
            }
        });
        charAppearance = charAppearance.substring(0, 1200);

        const systemPrompt = `You are a prompt engineer for anime image generation (NovelAI V4.5).
Generate English Danbooru-style tags for a doujinshi (fan-made book) cover illustration.

CRITICAL — Character Separation Format:
When the cover has MULTIPLE characters, you MUST output in this structured format:

[SCENE] scene tags, composition, quality tags, cover page
[CHAR1] first character's appearance tags (hair, eyes, clothing, gender tag)
[CHAR2] second character's appearance tags

When the cover has only ONE character, output flat tags (no [SCENE]/[CHAR] markers).

Rules:
- This is a BOOK COVER illustration — include cover_page tag in [SCENE]
- Each [CHAR] section MUST include the character's gender tag (1girl or 1boy) as the FIRST tag
- Extract character appearance from the provided character info — STRICTLY separate each character's attributes
- For well-known anime/manga/game characters, include their name tag: character_name (series_name)
- For original characters, use only visual descriptors
- Include mood/atmosphere tags that match the synopsis
- Include quality tags: masterpiece, best quality, amazing quality
- IMPORTANT: If characters are mentioned in the synopsis or character database, they MUST appear prominently in the illustration — never generate background-only/scenery-only images when characters are referenced
- Do NOT include negative prompt tags
- Keep each section under 40 words`;

        const userMsg = `Doujinshi info:
Title: ${product.title}
Type: ${product.type} (${product.type === 'novel' ? '小説' : product.type === 'manga' ? '漫画' : product.type})
Circle: ${circle?.name || 'unknown'}
Tags: ${tags}
Synopsis: ${product.sampleText || '(none)'}
${charAppearance ? `\nCharacter appearance database:\n${charAppearance}` : ''}

Generate cover illustration tags (use [SCENE]/[CHAR1]/[CHAR2] format if multiple characters):`;

        try {
            const raw = await Utils.callChatAPI([{ role: 'user', content: userMsg }], systemPrompt);
            const result = raw.trim();

            const sceneMatch = result.match(/\[SCENE\]\s*(.+?)(?=\[CHAR|\n*$)/s);
            const charMatches = [...result.matchAll(/\[CHAR\d*\]\s*(.+?)(?=\[CHAR|\n*$)/gs)];

            if (sceneMatch && charMatches.length > 0) {
                const scene = sceneMatch[1].trim().replace(/\n/g, ', ');
                const chars = charMatches.map(m => m[1].trim().replace(/\n/g, ', '));
                return { positive: scene, negative: '', charCaptions: chars };
            }

            return { positive: result, negative: '', charCaptions: [] };
        } catch (e) {
            console.error('[Melonbooks ImageGen] Prompt build failed:', e);
            return null;
        }
    },

    // 非同期で表紙画像を生成
    async _generateProductCovers(products) {
        if (!this._hasImageApi()) return;

        const config = AppState.data.imageApiConfig;
        const naiSettings = AppState.data.novelaiSettings || {};
        const targets = products.filter(p => !p.generatedCoverId);
        if (targets.length === 0) return;

        console.log(`[Melonbooks ImageGen] Generating covers for ${targets.length} products`);

        // 表紙は縦長
        const imgSize = config.provider === 'novelai'
            ? (naiSettings.resolution || '1024x1024')
            : '768x1024';

        for (const product of targets) {
            try {
                const prompt = await this._buildCoverPrompt(product);
                if (!prompt) continue;

                let blobs = [];
                switch (config.provider) {
                    case 'openai':
                        blobs = await PixivIllust.generateWithOpenAI(prompt.positive, prompt.negative, imgSize, 1, config);
                        break;
                    case 'gpt-image':
                        blobs = await PixivIllust._gptImage(prompt.positive, prompt.negative, imgSize, 1, config);
                        break;
                    case 'openrouter':
                        blobs = await PixivIllust.generateWithOpenRouter(prompt.positive, prompt.negative, imgSize, 1, config, prompt.charCaptions);
                        break;
                    case 'stabilityai':
                        blobs = await PixivIllust.generateWithStabilityAI(prompt.positive, prompt.negative, imgSize, 1, config);
                        break;
                    case 'novelai':
                        blobs = await PixivIllust.generateWithNovelAI(prompt.positive, prompt.negative, imgSize, 1, config, prompt.charCaptions);
                        break;
                    case 'midjourney':
                    case 'custom':
                        blobs = await PixivIllust.generateWithCustomAPI(prompt.positive, prompt.negative, imgSize, 1, config);
                        break;
                }

                if (blobs && blobs.length > 0) {
                    const id = 'melon_cover_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                    await IllustGallery.save(id, blobs[0]);
                    product.generatedCoverId = id;
                    Utils.saveData();

                    // DOM差替（カード + 詳細ページ両方）
                    this._replaceCoversInDOM(product);
                    console.log(`[Melonbooks ImageGen] Cover generated for: ${product.title}`);
                }
            } catch (e) {
                console.error('[Melonbooks ImageGen] Failed for:', product.title, e);
            }
        }
    },

    // DOM上の表紙を差し替え
    async _replaceCoversInDOM(product) {
        const url = await IllustGallery.getUrl(product.generatedCoverId);
        if (!url) return;

        // カード内のカバー
        document.querySelectorAll('.melon-cover').forEach(cover => {
            const card = cover.closest('.melon-product-card');
            if (card && card.onclick?.toString().includes(product.id)) {
                cover.classList.add('melon-cover-generated');
                const placeholder = cover.querySelector('.melon-bookish');
                if (placeholder) {
                    placeholder.remove();
                    const img = document.createElement('img');
                    img.src = url;
                    img.className = 'melon-cover-img';
                    img.alt = product.title;
                    cover.insertBefore(img, cover.firstChild);
                }
            }
        });

        // 詳細ページ
        const detailCover = document.querySelector('.melon-detail-cover .melon-bookish');
        if (detailCover && this.currentProductId === product.id) {
            const parent = detailCover.parentElement;
            parent.classList.add('melon-cover-generated');
            parent.onclick = () => this._viewFullCover(product.generatedCoverId);
            detailCover.remove();
            const img = document.createElement('img');
            img.src = url;
            img.className = 'melon-detail-cover-img';
            img.alt = product.title;
            parent.insertBefore(img, parent.firstChild);
        }
    },

    // 生成済み表紙をロード（レンダリング後に呼ぶ）
    async _loadGeneratedCovers(container) {
        if (!container) return;
        const imgs = container.querySelectorAll('img[data-illust-id]');
        for (const img of imgs) {
            const id = img.dataset.illustId;
            if (id && !img.getAttribute('src')) {
                try {
                    const url = await IllustGallery.getUrl(id);
                    if (url) img.src = url;
                } catch (e) {
                    console.error('[Melonbooks] Failed to load cover:', id, e);
                }
            }
        }
    },

    // 表紙フルスクリーン表示
    async _viewFullCover(illustId) {
        const url = await IllustGallery.getUrl(illustId);
        if (!url) return;
        const overlay = document.createElement('div');
        overlay.className = 'tw-fullimg-overlay';
        overlay.innerHTML = `<img src="${url}" class="tw-fullimg">`;
        overlay.onclick = () => overlay.remove();
        document.body.appendChild(overlay);
    }
};
