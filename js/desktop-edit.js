// ===== Desktop Layout System =====
// APP Registry + Dynamic Renderer + iOS-style Edit Mode (long-press drag & drop)

// ── App Registry ──
const APP_REGISTRY = {
    broadcast:        { label: '放送局',    i18n: '',                iconClass: 'icon-broadcast',   svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="11" r="2"/><path d="M12 13v9"/><path d="M9 22h6"/><path d="M8 8a5 5 0 0 1 8 0"/><path d="M5 5a9 9 0 0 1 14 0"/></svg>' },
    chat:             { label: 'Messages',  i18n: 'app.messages',    iconClass: 'icon-chat',        svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' },
    worldbook:        { label: 'World',     i18n: 'app.world',       iconClass: 'icon-book',        svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>' },
    language:         { label: 'Learn',     i18n: 'app.learn',       iconClass: 'icon-lang',        svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>' },
    forum:            { label: 'Forum',     i18n: 'app.forum',       iconClass: 'icon-forum',       svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>' },
    'pixiv-novel':    { label: 'Pixiv',     i18n: 'app.pixiv_novel', iconClass: 'icon-pixiv-novel', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>' },
    twitter:          { label: 'X',         i18n: 'app.twitter',     iconClass: 'icon-twitter',     svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>' },
    weibo:            { label: '微博',      i18n: 'app.weibo',       iconClass: 'icon-weibo',       svg: '<svg viewBox="0 0 32 32" fill="none"><ellipse cx="16" cy="16" rx="13.5" ry="9.5" fill="currentColor"/><circle cx="20" cy="14" r="3.5" fill="#fff"/><circle cx="20.8" cy="13.4" r="1.2" fill="currentColor"/></svg>' },
    lofter:           { label: 'Lofter',    i18n: 'app.lofter',      iconClass: 'icon-lofter',      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h12l4 4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M16 4v4h4"/><path d="M14 14a2.5 2.5 0 0 0-4 0c0 2 2 3.5 2 3.5s2-1.5 2-3.5z" fill="currentColor" stroke="none"/></svg>' },
    magazine:         { label: '雑誌',      i18n: 'app.magazine',    iconClass: 'icon-magazine',    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>' },
    melonbooks:       { label: 'メロン',    i18n: 'app.melonbooks',  iconClass: 'icon-melonbooks',  svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>' },
    mercari:          { label: 'メルカリ',  i18n: '',                iconClass: 'icon-mercari',     svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 15v-5a2 2 0 0 1 4 0v5"/><path d="M12 15v-5a2 2 0 0 1 4 0v5"/></svg>' },
    niconico:         { label: 'ニコニコ',  i18n: '',                iconClass: 'icon-niconico',    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M9 9l3 3-3 3"/><path d="M15 9l-3 3 3 3"/></svg>' },
    writer:           { label: 'Writer',    i18n: 'app.writer',      iconClass: 'icon-writer',      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' },
    'lyric-lab':      { label: 'Music',     i18n: '',                iconClass: 'icon-spotify',     svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 15c2.5-1 5.5-1 8 0"/><path d="M7 12c3-1.5 7-1.5 10 0"/><path d="M6 9c3.5-2 8.5-2 12 0"/></svg>' },
    'payment-tracker':{ label: 'Payments',  i18n: 'app.payments',    iconClass: 'icon-payment',     svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>' },
    fortune:          { label: 'Fortune',   i18n: 'app.fortune',     iconClass: 'icon-fortune',     svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><path d="M8 12h.01"/><path d="M12 12h.01"/><path d="M16 12h.01"/><path d="M8 8h.01"/><path d="M16 8h.01"/><path d="M8 16h.01"/><path d="M16 16h.01"/></svg>' },
    tarot:            { label: 'Tarot',     i18n: 'app.tarot',       iconClass: 'icon-tarot',       svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z"/></svg>' },
    'travel-account': { label: 'Trip',      i18n: 'app.trip',        iconClass: 'icon-travel',      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>' },
    settings:         { label: 'Settings',  i18n: 'app.settings',    iconClass: 'icon-settings',    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6M5.636 5.636l4.243 4.243m4.242 4.242l4.243 4.243M1 12h6m6 0h6M5.636 18.364l4.243-4.243m4.242-4.242l4.243-4.243"/></svg>' },
};

const DEFAULT_PAGE0 = ['broadcast','chat','worldbook','language','forum','pixiv-novel','twitter','magazine','melonbooks'];
const DEFAULT_PAGE1 = ['niconico','mercari','weibo','lofter','writer','lyric-lab','payment-tracker','fortune','tarot','travel-account','settings'];
const COLS = 3;
const MAX_ROWS = 4; // visible rows per page on SE3

// Widget size → grid colSpan 映射（small=正方形 / medium=2格横向 / wide=整行条）
const WIDGET_SIZE_SPAN = { small: 1, medium: 2, wide: 3 };
function _widgetSpan(size) { return WIDGET_SIZE_SPAN[size] || 1; }

// 自由模式坐标：行距贴合网格（实测网格行距 ≈100px / 容器 772px ≈ 0.13），
// 顶部锚定 0.145，不再用 /5 把行摊满整屏 → 紧凑、不重叠、行数多也不挤。
const FREE_ROW_PITCH = 0.13;
const FREE_TOP_OFFSET = 0.145;
function _freeY(row) {
    const y = FREE_TOP_OFFSET + (typeof row === 'number' ? row : 0) * FREE_ROW_PITCH;
    return Math.max(0.04, Math.min(0.96, y));
}
function _freeX(col, span) {
    const x = (typeof col === 'number') ? (col + (span || 1) / 2) / COLS : 0.5;
    return Math.max(0.06, Math.min(0.94, x));
}

// ── Desktop Renderer ──
const DesktopRenderer = {
    render() {
        this._ensureLayout();
        const pages = document.getElementById('desktopPages');
        if (!pages) return;

        const layout = AppState.data.desktopLayout;
        const freeMode = !!layout.freeMode;
        pages.innerHTML = '';

        layout.pages.forEach((page, pi) => {
            const grid = document.createElement('div');
            grid.className = 'app-grid' + (freeMode ? ' free-mode' : '');
            grid.dataset.page = pi;

            // Sort items by row then col for proper rendering order
            const sorted = [...page.items].sort((a, b) => a.row !== b.row ? a.row - b.row : a.col - b.col);

            for (const item of sorted) {
                if (item.type === 'icon') {
                    grid.appendChild(this._renderIcon(item, freeMode));
                } else if (item.type === 'widget') {
                    const el = this._renderWidgetInGrid(item, freeMode);
                    if (el) grid.appendChild(el);
                }
            }
            // 装饰图层（贴纸/胶带等）叠加到这一页
            if (typeof Decorations !== 'undefined') Decorations.renderForPage(grid, pi);
            pages.appendChild(grid);
        });

        // Update page dots
        this._updatePageDots(layout.pages.length);

        // Update pager
        DesktopPager.totalPages = layout.pages.length;
        if (DesktopPager.currentPage >= layout.pages.length) {
            DesktopPager.goToPage(layout.pages.length - 1);
        }

        // 夜空主题：图标星座化（在自定义图标之前，自定义优先级最高）
        if (typeof ConstellationIcons !== 'undefined') ConstellationIcons.apply();
        if (typeof JournalIcons !== 'undefined') JournalIcons.apply();
        // Apply custom icons if available
        if (typeof IconCustomizer !== 'undefined') IconCustomizer.applyCustomIcons();
        // Apply i18n
        if (typeof I18n !== 'undefined' && AppState.data.systemConfig.language) {
            I18n.setLanguage(AppState.data.systemConfig.language);
        }
        // 时钟小组件渲染后立刻填充时间，避免显示占位符
        if (typeof SystemConfig !== 'undefined' && SystemConfig.refreshClocks) {
            SystemConfig.refreshClocks();
        }
    },

    _renderIcon(item, freeMode) {
        const app = APP_REGISTRY[item.appId];
        if (!app) return document.createElement('div');

        const div = document.createElement('div');
        div.className = 'app-item';
        div.dataset.app = item.appId;
        div.dataset.layoutId = item.id || '';

        if (freeMode) {
            // 自由模式：百分比绝对定位，中心点对齐；缺/越界自动吸回视口
            const { x, y } = this._safeFreeCoords(item, 1);
            div.style.left = (x * 100) + '%';
            div.style.top = (y * 100) + '%';
        } else {
            div.style.gridColumn = (item.col + 1).toString();
            div.style.gridRow = (item.row + 1).toString();
        }

        div.innerHTML = `
            <div class="app-icon ${app.iconClass}">
                ${app.svg}
            </div>
            <div class="app-label" ${app.i18n ? `data-i18n="${app.i18n}"` : ''}>${app.label}</div>`;
        return div;
    },

    _renderWidgetInGrid(item, freeMode) {
        const widgets = AppState.data.widgets || [];
        const w = widgets.find(x => x.id === item.widgetId);
        if (!w) return null;

        const div = document.createElement('div');
        div.className = 'desktop-grid-widget';
        div.dataset.layoutId = item.id || '';
        div.dataset.widgetId = item.widgetId;

        const span = item.colSpan || _widgetSpan(w.size);

        if (freeMode) {
            const { x, y } = this._safeFreeCoords(item, span);
            div.style.left = (x * 100) + '%';
            div.style.top = (y * 100) + '%';
            div.dataset.span = span;
        } else {
            div.style.gridColumn = `${item.col + 1} / span ${span}`;
            div.style.gridRow = (item.row + 1).toString();
        }

        div.innerHTML = Widgets._renderWidget(w);
        return div;
    },

    // 自由模式下坐标兜底：缺值用 col/row 推导，再缺退到中心，最后 clamp 进视口
    _safeFreeCoords(item, span) {
        let x = (item.x !== undefined && !isNaN(item.x)) ? item.x : null;
        let y = (item.y !== undefined && !isNaN(item.y)) ? item.y : null;
        if (x === null) x = _freeX(item.col, span);
        if (y === null) y = _freeY(item.row);
        // Clamp：避免 NaN/越界把 item 甩出视口
        x = Math.max(0.06, Math.min(0.94, x));
        y = Math.max(0.04, Math.min(0.96, y));
        return { x, y };
    },

    // 在指定 page 找第一个能容纳 span 列的空 cell，找不到返回 null
    _findEmptyCell(page, span) {
        if (!page || !Array.isArray(page.items)) return null;
        const occupied = new Set();
        for (const it of page.items) {
            const sp = it.colSpan || 1;
            for (let c = it.col; c < it.col + sp; c++) {
                occupied.add(`${it.row},${c}`);
            }
        }
        const startCols = span > 1 ? [0] : [0, 1, 2];
        for (let row = 0; row < MAX_ROWS; row++) {
            for (const col of startCols) {
                if (col + span > COLS) continue;
                let allFree = true;
                for (let c = col; c < col + span; c++) {
                    if (occupied.has(`${row},${c}`)) { allFree = false; break; }
                }
                if (allFree) return { col, row };
            }
        }
        return null;
    },

    _updatePageDots(count) {
        const dots = document.getElementById('pageDots');
        if (!dots) return;
        dots.innerHTML = '';
        for (let i = 0; i < count; i++) {
            const span = document.createElement('span');
            span.className = 'dot' + (i === DesktopPager.currentPage ? ' active' : '');
            span.onclick = () => DesktopPager.goToPage(i);
            dots.appendChild(span);
        }
    },

    // v2.60 迁移：老用户 layout 里没 broadcast 图标时，找空位补上
    _ensureBroadcastIcon() {
        const layout = AppState.data.desktopLayout;
        if (!layout || !Array.isArray(layout.pages)) return;
        const exists = layout.pages.some(p =>
            (p.items || []).some(it => it.type === 'icon' && it.appId === 'broadcast')
        );
        if (exists) return;

        const mkId = () => 'di_brc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        for (let pi = 0; pi < layout.pages.length; pi++) {
            const cell = this._findEmptyCell(layout.pages[pi], 1);
            if (cell) {
                layout.pages[pi].items.push({
                    id: mkId(), type: 'icon', appId: 'broadcast',
                    col: cell.col, row: cell.row, colSpan: 1, rowSpan: 1
                });
                Utils.saveData();
                return;
            }
        }
        // 所有页都满 → 追加到 page 0 末尾下一行
        const page0 = layout.pages[0];
        const maxRow = page0.items.length > 0
            ? Math.max(...page0.items.map(i => i.row + (i.rowSpan || 1) - 1))
            : -1;
        page0.items.push({
            id: mkId(), type: 'icon', appId: 'broadcast',
            col: 0, row: maxRow + 1, colSpan: 1, rowSpan: 1
        });
        Utils.saveData();
    },

    // 迁移：老用户 layout 里没 mercari 图标时，找空位补上
    _ensureMercariIcon() {
        const layout = AppState.data.desktopLayout;
        if (!layout || !Array.isArray(layout.pages)) return;
        const exists = layout.pages.some(p =>
            (p.items || []).some(it => it.type === 'icon' && it.appId === 'mercari')
        );
        if (exists) return;

        const mkId = () => 'di_mcr_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        for (let pi = 0; pi < layout.pages.length; pi++) {
            const cell = this._findEmptyCell(layout.pages[pi], 1);
            if (cell) {
                layout.pages[pi].items.push({
                    id: mkId(), type: 'icon', appId: 'mercari',
                    col: cell.col, row: cell.row, colSpan: 1, rowSpan: 1
                });
                Utils.saveData();
                return;
            }
        }
        // 所有页都满 → 追加到 page 0 末尾下一行
        const page0 = layout.pages[0];
        const maxRow = page0.items.length > 0
            ? Math.max(...page0.items.map(i => i.row + (i.rowSpan || 1) - 1))
            : -1;
        page0.items.push({
            id: mkId(), type: 'icon', appId: 'mercari',
            col: 0, row: maxRow + 1, colSpan: 1, rowSpan: 1
        });
        Utils.saveData();
    },

    // v2.71.0: 微博图标迁移（同 mercari 模式 / 老用户 layout 已存在但缺 weibo）
    _ensureWeiboIcon() {
        const layout = AppState.data.desktopLayout;
        if (!layout || !Array.isArray(layout.pages)) return;
        const exists = layout.pages.some(p =>
            (p.items || []).some(it => it.type === 'icon' && it.appId === 'weibo')
        );
        if (exists) return;

        const mkId = () => 'di_wb_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        for (let pi = 0; pi < layout.pages.length; pi++) {
            const cell = this._findEmptyCell(layout.pages[pi], 1);
            if (cell) {
                layout.pages[pi].items.push({
                    id: mkId(), type: 'icon', appId: 'weibo',
                    col: cell.col, row: cell.row, colSpan: 1, rowSpan: 1
                });
                Utils.saveData();
                return;
            }
        }
        const page0 = layout.pages[0];
        const maxRow = page0.items.length > 0
            ? Math.max(...page0.items.map(i => i.row + (i.rowSpan || 1) - 1))
            : -1;
        page0.items.push({
            id: mkId(), type: 'icon', appId: 'weibo',
            col: 0, row: maxRow + 1, colSpan: 1, rowSpan: 1
        });
        Utils.saveData();
    },

    // v2.73.0: lofter 图标迁移（同 mercari/weibo 模式 / 老用户 layout 已存在但缺 lofter）
    _ensureLofterIcon() {
        const layout = AppState.data.desktopLayout;
        if (!layout || !Array.isArray(layout.pages)) return;
        const exists = layout.pages.some(p =>
            (p.items || []).some(it => it.type === 'icon' && it.appId === 'lofter')
        );
        if (exists) return;

        const mkId = () => 'di_lof_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        for (let pi = 0; pi < layout.pages.length; pi++) {
            const cell = this._findEmptyCell(layout.pages[pi], 1);
            if (cell) {
                layout.pages[pi].items.push({
                    id: mkId(), type: 'icon', appId: 'lofter',
                    col: cell.col, row: cell.row, colSpan: 1, rowSpan: 1
                });
                Utils.saveData();
                return;
            }
        }
        const page0 = layout.pages[0];
        const maxRow = page0.items.length > 0
            ? Math.max(...page0.items.map(i => i.row + (i.rowSpan || 1) - 1))
            : -1;
        page0.items.push({
            id: mkId(), type: 'icon', appId: 'lofter',
            col: 0, row: maxRow + 1, colSpan: 1, rowSpan: 1
        });
        Utils.saveData();
    },

    _ensureLayout() {
        if (AppState.data.desktopLayout && AppState.data.desktopLayout.pages.length > 0) {
            this._ensureBroadcastIcon();
            this._ensureMercariIcon();
            this._ensureWeiboIcon();
            this._ensureLofterIcon();
            return;
        }

        // 首次部署：构建默认布局 — 第 1 页顶部时钟，第 2 页顶部日历
        if (!AppState.data.widgets) AppState.data.widgets = [];
        const widgets = AppState.data.widgets;

        let clockWidget = widgets.find(w => w.type === 'clock');
        if (!clockWidget) {
            clockWidget = {
                id: 'w_clock_' + Date.now().toString(36),
                type: 'clock', size: 'wide', _sizeV2: true,
                data: { format24: true }
            };
            widgets.unshift(clockWidget);
        }

        let calendarWidget = widgets.find(w => w.type === 'calendar');
        if (!calendarWidget) {
            calendarWidget = {
                id: 'w_cal_' + Date.now().toString(36) + '1',
                type: 'calendar', size: 'wide', _sizeV2: true
            };
            widgets.push(calendarWidget);
        }

        const pages = [{ items: [] }, { items: [] }];
        let idCounter = 0;
        const mkId = () => 'di_' + (idCounter++);

        // Page 0: clock(wide) + DEFAULT_PAGE0 icons
        pages[0].items.push({
            id: mkId(), type: 'widget', widgetId: clockWidget.id,
            col: 0, row: 0, colSpan: COLS, rowSpan: 1
        });
        DEFAULT_PAGE0.forEach((appId, i) => {
            pages[0].items.push({
                id: mkId(), type: 'icon', appId,
                col: i % COLS, row: 1 + Math.floor(i / COLS),
                colSpan: 1, rowSpan: 1
            });
        });

        // 把其它现存 widgets（除 clock/calendar）追加到 page 0 末尾，避免丢失
        for (const w of widgets) {
            if (w === clockWidget || w === calendarWidget) continue;
            const lastRow = pages[0].items.length > 0
                ? Math.max(...pages[0].items.map(i => i.row)) + 1
                : 0;
            const span = _widgetSpan(w.size);
            pages[0].items.push({
                id: mkId(), type: 'widget', widgetId: w.id,
                col: 0, row: lastRow, colSpan: span, rowSpan: 1
            });
        }

        // Page 1: calendar(wide) + DEFAULT_PAGE1 icons
        pages[1].items.push({
            id: mkId(), type: 'widget', widgetId: calendarWidget.id,
            col: 0, row: 0, colSpan: COLS, rowSpan: 1
        });
        DEFAULT_PAGE1.forEach((appId, i) => {
            pages[1].items.push({
                id: mkId(), type: 'icon', appId,
                col: i % COLS, row: 1 + Math.floor(i / COLS),
                colSpan: 1, rowSpan: 1
            });
        });

        AppState.data.desktopLayout = { pages };
        AppState.data._clockWidgetMigrated = true;
        Utils.saveData();
    },

    // Recalculate positions: pack items sequentially in 3-col grid
    reflow(pageIndex) {
        const layout = AppState.data.desktopLayout;
        if (!layout || !layout.pages[pageIndex]) return;

        const page = layout.pages[pageIndex];
        let row = 0, col = 0;

        for (const item of page.items) {
            const span = item.colSpan || 1;

            // Wide widgets must start at col 0
            if (span > 1 && col > 0) {
                row++;
                col = 0;
            }

            item.col = col;
            item.row = row;

            col += span;
            if (col >= COLS) {
                col = 0;
                row++;
            }
        }
    },

    addWidgetToLayout(widgetId, size) {
        this._ensureLayout();
        const layout = AppState.data.desktopLayout;
        const span = _widgetSpan(size);

        // 找空位：先当前页 → 其它页 → 实在没地儿就 push 到当前页末尾
        const currentPageIdx = (typeof DesktopPager !== 'undefined' && DesktopPager.currentPage != null)
            ? Math.max(0, Math.min(layout.pages.length - 1, DesktopPager.currentPage))
            : 0;
        let targetIdx = currentPageIdx;
        let spot = this._findEmptyCell(layout.pages[targetIdx], span);
        if (!spot) {
            for (let i = 0; i < layout.pages.length; i++) {
                if (i === currentPageIdx) continue;
                const s = this._findEmptyCell(layout.pages[i], span);
                if (s) { targetIdx = i; spot = s; break; }
            }
        }
        if (!spot) {
            const items = layout.pages[targetIdx].items;
            const maxRow = items.reduce((m, it) => Math.max(m, it.row + (it.rowSpan || 1) - 1), -1);
            spot = { col: 0, row: maxRow + 1 };
        }

        const newItem = {
            id: 'di_' + Date.now().toString(36),
            type: 'widget', widgetId,
            col: spot.col, row: spot.row,
            colSpan: span, rowSpan: 1
        };
        if (layout.freeMode) {
            newItem.x = _freeX(spot.col, span);
            newItem.y = _freeY(spot.row);
        }

        layout.pages[targetIdx].items.push(newItem);
        Utils.saveData();
        this.render();
    },

    removeWidgetFromLayout(widgetId) {
        if (!AppState.data.desktopLayout) return;
        const layout = AppState.data.desktopLayout;
        for (const page of layout.pages) {
            page.items = page.items.filter(i => !(i.type === 'widget' && i.widgetId === widgetId));
        }
        // freeMode 下保留其它 item 的 col/row，不重排（用户布局不被打乱）；grid 模式正常 reflow
        if (!layout.freeMode) {
            layout.pages.forEach((_, i) => this.reflow(i));
        }
        Utils.saveData();
        this.render();
    },

    // 切换自由/网格模式
    toggleFreeMode() {
        const layout = AppState.data.desktopLayout;
        if (!layout) return;
        if (!layout.freeMode) {
            // 进入自由模式：把现有 grid 坐标转成 x_pct, y_pct，并 clamp 在视口内
            for (const page of layout.pages) {
                for (const item of page.items) {
                    if (item.x === undefined || item.y === undefined || isNaN(item.x) || isNaN(item.y)) {
                        const span = item.colSpan || 1;
                        item.x = _freeX(item.col, span);
                        item.y = _freeY(item.row);
                    }
                }
            }
            layout.freeMode = true;
        } else {
            layout.freeMode = false;
        }
        Utils.saveData();
        this.render();

        // 同步刷新编辑模式按钮状态
        const modeBtn = document.getElementById('editLayoutModeBtn');
        if (modeBtn) modeBtn.textContent = layout.freeMode ? I18n.t('desktop.layout_grid', '⊞ 网格') : I18n.t('desktop.layout_free', '✦ 自由');
        const arrangeBtn = document.getElementById('editArrangeBtn');
        if (arrangeBtn) arrangeBtn.style.display = layout.freeMode ? '' : 'none';
    },

    // 一键整理：把所有 item 重新摆回 grid，同时保留 freeMode
    arrangeToGrid() {
        const layout = AppState.data.desktopLayout;
        if (!layout) return;
        layout.pages.forEach((_, i) => this.reflow(i));
        // 同步 x, y 到新的 grid 位置
        for (const page of layout.pages) {
            for (const item of page.items) {
                const span = item.colSpan || 1;
                item.x = _freeX(item.col, span);
                item.y = _freeY(item.row);
            }
        }
        Utils.saveData();
        this.render();
    }
};

// ── Edit Mode (long-press + drag) ──
const DesktopEdit = {
    active: false,
    dragItem: null,
    ghost: null,
    pressTimer: null,
    startX: 0,
    startY: 0,
    dragStarted: false,
    sourcePageIndex: 0,
    _edgeScrollTimer: null,
    _dragItemData: null, // {type, appId/widgetId, ...} of the item being dragged

    init() {
        const wrapper = document.querySelector('.desktop-pages-wrapper');
        if (!wrapper) return;

        wrapper.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false });
        wrapper.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false });
        wrapper.addEventListener('touchend', (e) => this._onTouchEnd(e));
        wrapper.addEventListener('touchcancel', () => this._cancelPress());
    },

    _onTouchStart(e) {
        if (this.active && this.dragItem) return;

        const target = e.target.closest('.app-item, .desktop-grid-widget');
        if (!target) {
            if (this.active) this.exitEditMode();
            return;
        }

        this.startX = e.touches[0].clientX;
        this.startY = e.touches[0].clientY;
        this.dragStarted = false;
        this._pressTarget = target;

        this.pressTimer = setTimeout(() => {
            if (!this.active) this.enterEditMode();
            this._beginDrag(target, e.touches[0]);
        }, 500);
    },

    _onTouchMove(e) {
        const dx = e.touches[0].clientX - this.startX;
        const dy = e.touches[0].clientY - this.startY;

        // Cancel long-press if moved too much before timer fires
        if (!this.dragStarted && Math.sqrt(dx*dx + dy*dy) > 10) {
            this._cancelPress();
        }

        if (this.dragStarted && this.ghost) {
            e.preventDefault();
            const touch = e.touches[0];
            this.ghost.style.left = (touch.clientX - this._ghostOffsetX) + 'px';
            this.ghost.style.top = (touch.clientY - this._ghostOffsetY) + 'px';

            this._checkDropTarget(touch.clientX, touch.clientY);
        }
    },

    _onTouchEnd(e) {
        this._cancelPress();

        if (this.dragStarted) {
            this._endDrag();
            return;
        }

        // Normal tap in edit mode — do nothing (icons don't navigate)
        if (this.active) {
            e.preventDefault();
        }
    },

    _cancelPress() {
        if (this.pressTimer) {
            clearTimeout(this.pressTimer);
            this.pressTimer = null;
        }
    },

    // ── Edit Mode ──
    enterEditMode() {
        this.active = true;
        document.getElementById('desktop').classList.add('edit-mode');
        DesktopPager._locked = true;

        // 底部工具栏容器：挂在 body 上，避开 #desktop>* { position:relative } 把按钮拽回文档流
        let toolbar = document.getElementById('editToolbar');
        if (!toolbar) {
            toolbar = document.createElement('div');
            toolbar.id = 'editToolbar';
            toolbar.className = 'edit-toolbar';
            document.body.appendChild(toolbar);
        }

        // 完成
        let btn = document.getElementById('editDoneBtn');
        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'editDoneBtn';
            btn.className = 'edit-done-btn';
            btn.textContent = I18n.t('btn.done', '完成');
            btn.onclick = () => this.exitEditMode();
        }

        // 贴纸
        let stickerBtn = document.getElementById('editStickerBtn');
        if (!stickerBtn) {
            stickerBtn = document.createElement('button');
            stickerBtn.id = 'editStickerBtn';
            stickerBtn.className = 'edit-sticker-btn';
            stickerBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9 11h.01M15 11h.01M9 15c1 1.5 5 1.5 6 0"/></svg><span>' + I18n.t('desktop.stickers', '贴纸') + '</span>';
            stickerBtn.onclick = () => {
                if (typeof Decorations !== 'undefined') Decorations.openDrawer();
            };
        }

        // 自由/网格 模式切换
        let modeBtn = document.getElementById('editLayoutModeBtn');
        if (!modeBtn) {
            modeBtn = document.createElement('button');
            modeBtn.id = 'editLayoutModeBtn';
            modeBtn.className = 'edit-layout-mode-btn';
            modeBtn.onclick = () => DesktopRenderer.toggleFreeMode();
        }
        const isFree = !!(AppState.data.desktopLayout && AppState.data.desktopLayout.freeMode);
        modeBtn.textContent = isFree ? I18n.t('desktop.layout_grid', '⊞ 网格') : I18n.t('desktop.layout_free', '✦ 自由');

        // 一键整理（仅自由模式可见）
        let arrangeBtn = document.getElementById('editArrangeBtn');
        if (!arrangeBtn) {
            arrangeBtn = document.createElement('button');
            arrangeBtn.id = 'editArrangeBtn';
            arrangeBtn.className = 'edit-arrange-btn';
            arrangeBtn.textContent = I18n.t('desktop.auto_tidy', '一键整理');
            arrangeBtn.onclick = () => {
                if (confirm(I18n.t('desktop.auto_tidy_confirm', '一键整理：把所有图标和组件按网格排列？'))) DesktopRenderer.arrangeToGrid();
            };
        }
        arrangeBtn.style.display = isFree ? '' : 'none';

        // 按固定顺序塞进工具栏：贴纸 / 模式 / 整理 / 完成（append 会移动已存在的节点，保证顺序）
        toolbar.append(stickerBtn, modeBtn, arrangeBtn, btn);
        toolbar.style.display = 'flex';
    },

    exitEditMode() {
        this.active = false;
        this.dragItem = null;
        document.getElementById('desktop').classList.remove('edit-mode');
        DesktopPager._locked = false;

        const toolbar = document.getElementById('editToolbar');
        if (toolbar) toolbar.style.display = 'none';

        // Re-render to clean up any visual artifacts
        DesktopRenderer.render();
    },

    // ── Drag ──
    _beginDrag(target, touch) {
        this.dragStarted = true;
        this.dragItem = target;
        this.sourcePageIndex = DesktopPager.currentPage;

        // Save item identity for cross-page moves
        this._dragItemData = {
            layoutId: target.dataset.layoutId || null,
            appId: target.dataset.app || null,
            widgetId: target.dataset.widgetId || null
        };

        // Create ghost
        const rect = target.getBoundingClientRect();
        this.ghost = target.cloneNode(true);
        this.ghost.className = 'drag-ghost';
        this.ghost.style.width = rect.width + 'px';
        this.ghost.style.height = rect.height + 'px';
        this.ghost.style.left = rect.left + 'px';
        this.ghost.style.top = rect.top + 'px';
        document.body.appendChild(this.ghost);

        this._ghostOffsetX = touch.clientX - rect.left;
        this._ghostOffsetY = touch.clientY - rect.top;

        // Hide original
        target.style.visibility = 'hidden';
        target.classList.add('drag-source');
    },

    _checkDropTarget(x, y) {
        const viewportW = window.innerWidth;
        const edgeZone = 30; // px from edge to trigger page switch

        // Edge detection for cross-page dragging
        if (x < edgeZone || x > viewportW - edgeZone) {
            if (!this._edgeScrollTimer) {
                const direction = x < edgeZone ? -1 : 1;
                this._edgeScrollTimer = setTimeout(() => {
                    this._edgeScrollTimer = null;
                    const targetPage = DesktopPager.currentPage + direction;
                    const layout = AppState.data.desktopLayout;
                    // Allow moving to existing pages or creating one new page at the end
                    if (targetPage >= 0 && targetPage <= layout.pages.length) {
                        if (targetPage === layout.pages.length) {
                            // Create new page
                            layout.pages.push({ items: [] });
                        }
                        DesktopPager._locked = false;
                        DesktopPager.goToPage(targetPage);
                        DesktopPager._locked = true;
                    }
                }, 400);
            }
        } else {
            if (this._edgeScrollTimer) {
                clearTimeout(this._edgeScrollTimer);
                this._edgeScrollTimer = null;
            }
        }

        // Find current grid
        const grids = document.querySelectorAll('.app-grid');
        const currentGrid = grids[DesktopPager.currentPage];
        if (!currentGrid) return;

        const gridRect = currentGrid.getBoundingClientRect();
        const relX = x - gridRect.left;
        const relY = y - gridRect.top;

        // 自由模式：直接记录百分比，不做格子吸附
        if (AppState.data.desktopLayout && AppState.data.desktopLayout.freeMode) {
            this._dropXPct = Math.max(0, Math.min(1, relX / gridRect.width));
            this._dropYPct = Math.max(0, Math.min(1, relY / gridRect.height));
            // 隐藏 grid 模式的 drop 指示器
            const ind = document.getElementById('dropIndicator');
            if (ind) ind.style.display = 'none';
            return;
        }

        // 网格模式：吸附到 cell
        const cellW = gridRect.width / COLS;
        const cellH = 105; // approximate row height
        const dropCol = Math.max(0, Math.min(COLS - 1, Math.floor(relX / cellW)));
        const dropRow = Math.max(0, Math.floor(relY / cellH));

        this._dropCol = dropCol;
        this._dropRow = dropRow;

        // Highlight drop position
        this._showDropIndicator(currentGrid, dropCol, dropRow, cellW, cellH, gridRect);
    },

    _showDropIndicator(grid, col, row, cellW, cellH, gridRect) {
        let indicator = document.getElementById('dropIndicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'dropIndicator';
            indicator.className = 'drop-indicator';
            document.body.appendChild(indicator);
        }
        indicator.style.left = (gridRect.left + col * cellW + 4) + 'px';
        indicator.style.top = (gridRect.top + row * cellH + 4) + 'px';
        indicator.style.width = (cellW - 8) + 'px';
        indicator.style.height = (cellH - 8) + 'px';
        indicator.style.display = 'block';
    },

    _endDrag() {
        this.dragStarted = false;

        // Clear edge scroll timer
        if (this._edgeScrollTimer) {
            clearTimeout(this._edgeScrollTimer);
            this._edgeScrollTimer = null;
        }

        // Remove ghost and indicator
        if (this.ghost) { this.ghost.remove(); this.ghost = null; }
        const indicator = document.getElementById('dropIndicator');
        if (indicator) indicator.style.display = 'none';

        // Restore original visibility
        if (this.dragItem) {
            this.dragItem.style.visibility = '';
            this.dragItem.classList.remove('drag-source');
        }

        // Apply the move
        if (this._dragItemData) {
            const layout = AppState.data.desktopLayout;
            if (layout && layout.freeMode && this._dropXPct !== undefined) {
                this._applyMoveFree(this._dropXPct, this._dropYPct);
            } else if (this._dropCol !== undefined) {
                this._applyMove(this._dropCol, this._dropRow);
            }
        }

        this.dragItem = null;
        this._dragItemData = null;
        this._dropXPct = undefined;
        this._dropYPct = undefined;
        this._dropCol = undefined;
        this._dropRow = undefined;
    },

    // 自由模式下的拖拽落点：直接写 x, y 百分比，不重排
    _applyMoveFree(xPct, yPct) {
        const layout = AppState.data.desktopLayout;
        const dropPageIdx = DesktopPager.currentPage;
        const sourcePageIdx = this.sourcePageIndex;
        const sourcePage = layout.pages[sourcePageIdx];
        const dropPage = layout.pages[dropPageIdx];
        if (!sourcePage || !dropPage) return;

        const d = this._dragItemData;
        let itemIdx = -1;
        if (d.layoutId) itemIdx = sourcePage.items.findIndex(i => i.id === d.layoutId);
        else if (d.appId) itemIdx = sourcePage.items.findIndex(i => i.type === 'icon' && i.appId === d.appId);
        else if (d.widgetId) itemIdx = sourcePage.items.findIndex(i => i.type === 'widget' && i.widgetId === d.widgetId);
        if (itemIdx < 0) return;

        const item = sourcePage.items[itemIdx];
        item.x = xPct;
        item.y = yPct;

        // 跨页移动：item 从 sourcePage 拿走、放到 dropPage
        if (sourcePageIdx !== dropPageIdx) {
            sourcePage.items.splice(itemIdx, 1);
            dropPage.items.push(item);
        }

        Utils.saveData();
        DesktopRenderer.render();
    },

    _applyMove(targetCol, targetRow) {
        const layout = AppState.data.desktopLayout;
        const dropPageIdx = DesktopPager.currentPage;
        const sourcePageIdx = this.sourcePageIndex;
        const sourcePage = layout.pages[sourcePageIdx];
        const dropPage = layout.pages[dropPageIdx];
        if (!sourcePage || !dropPage) return;

        const d = this._dragItemData;

        // Find the item in source page
        let itemIdx = -1;
        if (d.layoutId) {
            itemIdx = sourcePage.items.findIndex(i => i.id === d.layoutId);
        } else if (d.appId) {
            itemIdx = sourcePage.items.findIndex(i => i.type === 'icon' && i.appId === d.appId);
        } else if (d.widgetId) {
            itemIdx = sourcePage.items.findIndex(i => i.type === 'widget' && i.widgetId === d.widgetId);
        }

        if (itemIdx < 0) return;

        // Remove from source page
        const item = sourcePage.items.splice(itemIdx, 1)[0];

        // Calculate target index in the flat list (row * COLS + col)
        const targetIndex = targetRow * COLS + targetCol;
        const insertAt = Math.min(targetIndex, dropPage.items.length);
        dropPage.items.splice(insertAt, 0, item);

        // Reflow both pages
        DesktopRenderer.reflow(sourcePageIdx);
        DesktopRenderer.reflow(dropPageIdx);

        // Clean up empty pages (except keep at least 1)
        for (let i = layout.pages.length - 1; i > 0; i--) {
            if (layout.pages[i].items.length === 0) {
                layout.pages.splice(i, 1);
            }
        }

        Utils.saveData();
        DesktopRenderer.render();

        // Stay in edit mode
        if (this.active) {
            document.getElementById('desktop').classList.add('edit-mode');
            const btn = document.getElementById('editDoneBtn');
            if (btn) btn.style.display = 'block';
            DesktopPager._locked = true;
        }
    }
};
