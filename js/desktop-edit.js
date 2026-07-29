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

// Dock 固定的常用 app（不出现在可滑动网格里、跨页固定在底栏）。v1 写死，存成数组为将来可定制留口。
const DEFAULT_DOCK = ['broadcast','worldbook','settings'];
const DOCK_MAX = 4;   // iPhone 风格 Dock 上限；下限「最少 1 个」在 _applyMoveFromDock 守
// 默认网格不含 DEFAULT_DOCK 里的三个（它们去了底栏）。
// 第1页顶部时钟，第2页顶部日历，两页更均衡；具体每行几个由 DEFAULT_COLS_NEW（新档）/ desktopLayout.cols（存量档）决定。
const DEFAULT_PAGE0 = ['chat','forum','pixiv-novel','twitter','magazine','melonbooks','niconico','mercari','lyric-lab'];
const DEFAULT_PAGE1 = ['weibo','lofter','writer','payment-tracker','fortune','tarot','travel-account','language'];
// v2.223 桌面全网格化：新档默认 4 列（当代手机密度）；存量档在 _ensureLayout 里钉 3 列，桌面不挪一个像素
const DEFAULT_COLS_NEW = 4;

// 桌面每行列数：3（旧默认）或 4（当代手机密度），存在 desktopLayout.cols，可在 设置→外观→桌面网格 切换
function _cols() {
    return (AppState.data.desktopLayout && AppState.data.desktopLayout.cols) || 3;
}

// 每页可见行数：早年 SE3 小屏写死 4，大屏应该能放更多行；node 测试环境没有 window 时安全回退 4
function _maxRows() {
    return (typeof window !== 'undefined' && window.innerHeight)
        ? Math.max(4, Math.floor((window.innerHeight - 300) / 110))
        : 4;
}

// Widget size → grid colSpan 映射（small=正方形 / medium=2格横向（2 列封顶）/ wide=整行，跟随当前列数）
function _widgetSpan(size) {
    const c = _cols();
    return size === 'wide' ? c : size === 'medium' ? Math.min(2, c) : 1;
}

// item 实际占用列数：icon 恒 1；widget 以 widgets 表里记录的 size 为准源（忽略存档里可能过期的 colSpan——
// 例如 4 列档里遗留的旧 colSpan=3 wide 组件，必须按当前列数整行铺开，不能停留在 3/4 行宽）
function _itemSpan(item) {
    if (item.type !== 'widget') return 1;
    const widgets = AppState.data.widgets || [];
    const w = widgets.find(x => x.id === item.widgetId);
    if (w) return _widgetSpan(w.size);
    return Math.min(item.colSpan || 1, _cols());
}

// ── Desktop Renderer ──
const DesktopRenderer = {
    render() {
        // v2.223 兜底自愈：拖拽被系统打断等未知路径下残留的幽灵克隆节点，下次重绘统统清掉
        document.querySelectorAll('.drag-ghost').forEach(n => n.remove());

        this._ensureLayout();
        const pages = document.getElementById('desktopPages');
        if (!pages) return;

        const layout = AppState.data.desktopLayout;
        const cols = _cols();
        pages.innerHTML = '';

        const desktopEl = document.getElementById('desktop');
        if (desktopEl) {
            desktopEl.style.setProperty('--desktop-cols', cols);
            desktopEl.classList.toggle('cols-4', cols === 4);
        }

        layout.pages.forEach((page, pi) => {
            const grid = document.createElement('div');
            grid.className = 'app-grid';
            grid.dataset.page = pi;

            // Sort items by row then col for proper rendering order
            const sorted = [...page.items].sort((a, b) => a.row !== b.row ? a.row - b.row : a.col - b.col);

            for (const item of sorted) {
                if (item.type === 'icon') {
                    grid.appendChild(this._renderIcon(item));
                } else if (item.type === 'widget') {
                    const el = this._renderWidgetInGrid(item);
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

        // 底部 Dock 栏（在图标主题块之前渲染，确保 Dock 图标也被主题系统扫到）
        this._renderDock();

        // 夜空主题：图标星座化（在自定义图标之前，自定义优先级最高）
        if (typeof ConstellationIcons !== 'undefined') ConstellationIcons.apply();
        if (typeof JournalIcons !== 'undefined') JournalIcons.apply();
        if (typeof StrawberryIcons !== 'undefined') StrawberryIcons.apply();
        if (typeof SnowIcons !== 'undefined') SnowIcons.apply();
        if (typeof SakuraIcons !== 'undefined') SakuraIcons.apply();
        if (typeof AnimalIcons !== 'undefined') AnimalIcons.apply();
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

    _renderIcon(item) {
        const app = APP_REGISTRY[item.appId];
        if (!app) return document.createElement('div');

        const div = document.createElement('div');
        div.className = 'app-item';
        div.dataset.app = item.appId;
        div.dataset.layoutId = item.id || '';

        div.style.gridColumn = (item.col + 1).toString();
        div.style.gridRow = (item.row + 1).toString();

        div.innerHTML = `
            <div class="app-icon ${app.iconClass}">
                ${app.svg}
            </div>
            <div class="app-label" ${app.i18n ? `data-i18n="${app.i18n}"` : ''}>${app.label}</div>`;
        return div;
    },

    // 底部 Dock 栏：固定常用 app，跨页不动。图标复用 .app-item[data-app] + .app-icon 标记，
    // 主题图标系统（星座/手账/草莓/自定义）会自动套到这里。
    // v2.144.0：.app-label 由 systemConfig.showDockLabels 控制（默认显示、可在外观设置关掉）。
    _renderDock() {
        const dock = document.getElementById('dock');
        if (!dock) return;
        // 默认显示名称（!== false 保证老存档 undefined 也走"显示"）；关掉则只剩图标（真 iPhone Dock 风）
        const showLabels = AppState.data.systemConfig?.showDockLabels !== false;
        dock.classList.toggle('has-labels', showLabels);
        const layout = AppState.data.desktopLayout;
        const raw = (layout && Array.isArray(layout.dock) && layout.dock.length)
            ? layout.dock : DEFAULT_DOCK;
        const dockApps = [...new Set(raw)];   // 去重，挡住异常档里重复 appId 渲染成两个相同图标
        dock.innerHTML = '';
        for (const appId of dockApps) {
            const app = APP_REGISTRY[appId];
            if (!app) continue;
            const div = document.createElement('div');
            div.className = 'app-item dock-item';
            div.dataset.app = appId;
            div.innerHTML = `<div class="app-icon ${app.iconClass}">${app.svg}</div>`
                + (showLabels ? `<div class="app-label" ${app.i18n ? `data-i18n="${app.i18n}"` : ''}>${app.label}</div>` : '');
            dock.appendChild(div);
        }
        // 名称里的 data-i18n（世界书 / 设置等）翻译成当前语言；broadcast 无 i18n、直接用硬编码「放送局」
        if (showLabels && typeof I18n !== 'undefined' && I18n.applyTranslations) I18n.applyTranslations();
    },

    _renderWidgetInGrid(item) {
        const widgets = AppState.data.widgets || [];
        const w = widgets.find(x => x.id === item.widgetId);
        if (!w) return null;

        const div = document.createElement('div');
        div.className = 'desktop-grid-widget';
        div.dataset.layoutId = item.id || '';
        div.dataset.widgetId = item.widgetId;

        const span = _itemSpan(item);
        div.style.gridColumn = `${item.col + 1} / span ${span}`;
        div.style.gridRow = (item.row + 1).toString();

        div.innerHTML = Widgets._renderWidget(w);
        return div;
    },

    // 在指定 page 找第一个能容纳 span 列的空 cell，找不到返回 null
    _findEmptyCell(page, span) {
        if (!page || !Array.isArray(page.items)) return null;
        const cols = _cols();
        const occupied = new Set();
        for (const it of page.items) {
            const sp = _itemSpan(it);
            for (let c = it.col; c < it.col + sp; c++) {
                occupied.add(`${it.row},${c}`);
            }
        }
        const maxRows = _maxRows();
        for (let row = 0; row < maxRows; row++) {
            for (let col = 0; col + span <= cols; col++) {
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
        // 在 Dock 里就算已存在，不补回网格（否则会撤销 Dock 迁移）
        if (Array.isArray(layout.dock) && layout.dock.includes('broadcast')) return;
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
        // 在 Dock 里就算已存在，不补回网格（否则会和 dock 各一个、每次加载脏写）— 同 _ensureBroadcastIcon
        if (Array.isArray(layout.dock) && layout.dock.includes('mercari')) return;
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
        // 在 Dock 里就算已存在，不补回网格（否则会和 dock 各一个、每次加载脏写）— 同 _ensureBroadcastIcon
        if (Array.isArray(layout.dock) && layout.dock.includes('weibo')) return;
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
        // 在 Dock 里就算已存在，不补回网格（否则会和 dock 各一个、每次加载脏写）— 同 _ensureBroadcastIcon
        if (Array.isArray(layout.dock) && layout.dock.includes('lofter')) return;
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

    // v2.172.0 月读下架迁移：老存档桌面上的月读图标（网格 + dock）摘掉。
    // 只删图标、不动 yueduData（存档数据永远保留）。幂等：没有就什么都不做。
    _removeYueduIcon() {
        const layout = AppState.data.desktopLayout;
        if (!layout || !Array.isArray(layout.pages)) return;
        let changed = false;
        layout.pages.forEach(p => {
            const before = (p.items || []).length;
            p.items = (p.items || []).filter(it => !(it.type === 'icon' && it.appId === 'yuedu'));
            if (p.items.length !== before) changed = true;
        });
        if (Array.isArray(layout.dock) && layout.dock.includes('yuedu')) {
            layout.dock = layout.dock.filter(a => a !== 'yuedu');
            changed = true;
        }
        if (changed) Utils.saveData();
    },

    _ensureLayout() {
        if (AppState.data.desktopLayout && AppState.data.desktopLayout.pages.length > 0) {
            const layout = AppState.data.desktopLayout;
            // v2.223 全网格化：存量档钉 3 列，桌面不挪一个像素；想要 4 列去 设置→外观→桌面网格 手动切
            if (!layout.cols) layout.cols = 3;
            this._migrateDock();   // 必须在 _ensureBroadcastIcon 之前：先把 broadcast 落进 dock，它才不会被补回网格
            this._ensureBroadcastIcon();
            this._ensureMercariIcon();
            this._ensureWeiboIcon();
            this._ensureLofterIcon();
            this._removeYueduIcon();
            return;
        }

        // 首次部署：构建默认布局 — 第 1 页顶部时钟，第 2 页顶部日历，新档默认 DEFAULT_COLS_NEW 列
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

        // 先把 desktopLayout（含 cols）建好，后面依赖 _cols()/_widgetSpan() 的调用才能读到正确列数
        AppState.data.desktopLayout = {
            pages: [{ items: [] }, { items: [] }],
            dock: DEFAULT_DOCK.slice(),
            _dockMigratedV1: true,
            cols: DEFAULT_COLS_NEW
        };
        const layout = AppState.data.desktopLayout;
        const pages = layout.pages;
        let idCounter = 0;
        const mkId = () => 'di_' + (idCounter++);

        // Page 0: clock(wide) + DEFAULT_PAGE0 icons
        pages[0].items.push({
            id: mkId(), type: 'widget', widgetId: clockWidget.id,
            col: 0, row: 0, colSpan: DEFAULT_COLS_NEW, rowSpan: 1
        });
        DEFAULT_PAGE0.forEach((appId, i) => {
            pages[0].items.push({
                id: mkId(), type: 'icon', appId,
                col: i % DEFAULT_COLS_NEW, row: 1 + Math.floor(i / DEFAULT_COLS_NEW),
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
            col: 0, row: 0, colSpan: DEFAULT_COLS_NEW, rowSpan: 1
        });
        DEFAULT_PAGE1.forEach((appId, i) => {
            pages[1].items.push({
                id: mkId(), type: 'icon', appId,
                col: i % DEFAULT_COLS_NEW, row: 1 + Math.floor(i / DEFAULT_COLS_NEW),
                colSpan: 1, rowSpan: 1
            });
        });

        AppState.data._clockWidgetMigrated = true;
        Utils.saveData();
    },

    // Dock 迁移与去重：①确保 layout.dock 存在 ②维持不变式「dock 里的 app 不出现在网格」。
    // 不变式每次加载都过滤一遍（自愈：异常导入档/手改档若让某 dock app 同时出现在网格，会被去掉，
    // 避免 dock + 网格各一个的重复图标）；reflow 重排填洞只在首次迁移做一次（_dockMigratedV1），
    // 避免每次加载都重排用户布局。必须在 _ensureBroadcastIcon 之前调用（见 _ensureLayout）。
    _migrateDock() {
        const layout = AppState.data.desktopLayout;
        if (!layout || !Array.isArray(layout.pages)) return;
        let dirty = false;
        if (!Array.isArray(layout.dock) || !layout.dock.length) {
            layout.dock = DEFAULT_DOCK.slice();
            dirty = true;
        }
        const dockSet = new Set(layout.dock);
        const affected = [];
        layout.pages.forEach((page, pi) => {
            if (!Array.isArray(page.items)) return;
            const before = page.items.length;
            page.items = page.items.filter(it => !(it.type === 'icon' && dockSet.has(it.appId)));
            if (page.items.length !== before) affected.push(pi);
        });
        if (affected.length) {
            dirty = true;
            // 仅首次迁移重排填洞；首次之后的自愈式去重只移除不重排（一个空洞胜过一个重复图标）。
            if (!layout._dockMigratedV1) {
                affected.forEach(pi => this.reflow(pi));
            }
        }
        if (!layout._dockMigratedV1) { layout._dockMigratedV1 = true; dirty = true; }
        if (dirty) Utils.saveData();
    },

    // Recalculate positions: pack items sequentially in a _cols() 列网格
    reflow(pageIndex) {
        const layout = AppState.data.desktopLayout;
        if (!layout || !layout.pages[pageIndex]) return;

        const page = layout.pages[pageIndex];
        const cols = _cols();
        let row = 0, col = 0;

        for (const item of page.items) {
            const span = _itemSpan(item);

            // Wide widgets must start at col 0
            if (span > 1 && col > 0) {
                row++;
                col = 0;
            }

            item.col = col;
            item.row = row;

            col += span;
            if (col >= cols) {
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
        layout.pages.forEach((_, i) => this.reflow(i));
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
    _cellH: 105, // 拖拽吸附用的行高，_beginDrag 里量一次实际值，量不到用这个兜底

    init() {
        const wrapper = document.querySelector('.desktop-pages-wrapper');
        if (wrapper) this._bindTouchHandlers(wrapper);
        // Dock 是 #desktop 直接子节点、不在 wrapper 内：单独绑一套，长按 Dock 图标也能进编辑+起拖。
        // （touch 序列 target 固定为 touchstart 元素，拖 Dock 图标时 move/end 只会派发到 #dock）
        const dock = document.getElementById('dock');
        if (dock) this._bindTouchHandlers(dock);
    },

    _bindTouchHandlers(el) {
        el.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false });
        el.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false });
        el.addEventListener('touchend', (e) => this._onTouchEnd(e));
        // v2.223：安卓上长按拖拽极易被系统手势打断（返回手势/下拉通知栏），touchcancel 之前只清
        // 长按计时器，对进行中的拖拽毫无清理——必须同时中止拖拽，否则幽灵图标永远挂在屏幕上
        el.addEventListener('touchcancel', () => { this._cancelPress(); this._abortDrag(); });
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

    // v2.223：touch 序列被系统打断（touchcancel）时的无条件安全清理。不落位、不写数据——
    // 行为等价于「图标弹回原处」，编辑模式保持不退出。任何时候调用都必须安全（哪怕当前没有在拖拽）。
    _abortDrag() {
        if (this._edgeScrollTimer) {
            clearTimeout(this._edgeScrollTimer);
            this._edgeScrollTimer = null;
        }
        if (this.ghost) {
            this.ghost.remove();
            this.ghost = null;
        }
        const indicator = document.getElementById('dropIndicator');
        if (indicator) indicator.style.display = 'none';
        if (this.dragItem) {
            this.dragItem.style.visibility = '';
            this.dragItem.classList.remove('drag-source');
        }
        const dockEl = document.getElementById('dock');
        if (dockEl) dockEl.classList.remove('drag-over');

        this.dragStarted = false;
        this.dragItem = null;
        this._dragItemData = null;
        this._dropCol = undefined;
        this._dropRow = undefined;
        this._dropDockIdx = undefined;
        this._dragFromDock = false;
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

        // 完成（v2.223 起工具栏只留这一个按钮：贴纸入口搬去了 设置→外观，自由排列模式退役）
        let btn = document.getElementById('editDoneBtn');
        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'editDoneBtn';
            btn.className = 'edit-done-btn';
            btn.textContent = I18n.t('btn.done', '完成');
            btn.onclick = () => this.exitEditMode();
        }

        toolbar.append(btn);
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
        this._dragFromDock = target.classList.contains('dock-item');   // Dock 源：_endDrag 落点分流时区分

        // Save item identity for cross-page moves
        this._dragItemData = {
            layoutId: target.dataset.layoutId || null,
            appId: target.dataset.app || null,
            widgetId: target.dataset.widgetId || null
        };

        // 量一次当前页实际行高（首个图标高度 + row-gap），拖拽吸附用；量不到就用兜底值 105
        this._cellH = 105;
        const grids = document.querySelectorAll('.app-grid');
        const currentGrid = grids[this.sourcePageIndex];
        const firstItem = currentGrid && currentGrid.querySelector('.app-item');
        if (firstItem) {
            const h = firstItem.getBoundingClientRect().height;
            if (h) {
                const rowGap = parseFloat(getComputedStyle(currentGrid).rowGap);
                this._cellH = h + (isNaN(rowGap) ? 0 : rowGap);
            }
        }

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

        // ── Dock 落点优先判定（在网格之前）──
        // 只有拖 app 图标（有 appId）才认 Dock 落点；widget（无 appId）落 Dock 没意义，让它走网格逻辑
        const dockEl = document.getElementById('dock');
        const draggingApp = !!(this._dragItemData && this._dragItemData.appId);
        if (dockEl && draggingApp) {
            const dr = dockEl.getBoundingClientRect();
            const inDock = x >= dr.left && x <= dr.right && y >= dr.top && y <= dr.bottom;
            if (inDock) {
                dockEl.classList.add('drag-over');
                this._dropDockIdx = this._computeDockInsertIdx(x);
                const ind = document.getElementById('dropIndicator');
                if (ind) ind.style.display = 'none';
                // 清掉网格落点，确保 _endDrag 走 Dock 分支
                this._dropCol = undefined; this._dropRow = undefined;
                return;
            }
            dockEl.classList.remove('drag-over');
            this._dropDockIdx = undefined;
        }

        // Find current grid
        const grids = document.querySelectorAll('.app-grid');
        const currentGrid = grids[DesktopPager.currentPage];
        if (!currentGrid) return;

        const gridRect = currentGrid.getBoundingClientRect();
        const relX = x - gridRect.left;
        const relY = y - gridRect.top;

        // 吸附到 cell
        const cols = _cols();
        const cellW = gridRect.width / cols;
        const cellH = this._cellH || 105;
        const dropCol = Math.max(0, Math.min(cols - 1, Math.floor(relX / cellW)));
        const dropRow = Math.max(0, Math.floor(relY / cellH));

        this._dropCol = dropCol;
        this._dropRow = dropRow;

        // Highlight drop position
        this._showDropIndicator(currentGrid, dropCol, dropRow, cellW, cellH, gridRect);
    },

    // 按落点 x 算在 dock 数组里的插入位置：落在第一个「水平中心 > x」的 dock-item 之前，否则末尾
    _computeDockInsertIdx(x) {
        const dockEl = document.getElementById('dock');
        if (!dockEl) return 0;
        const items = [...dockEl.querySelectorAll('.dock-item')];
        for (let i = 0; i < items.length; i++) {
            const r = items[i].getBoundingClientRect();
            if (x < r.left + r.width / 2) return i;
        }
        return items.length;
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
            const dockEl = document.getElementById('dock');
            if (dockEl) dockEl.classList.remove('drag-over');
            if (this._dropDockIdx !== undefined) {
                this._applyMoveToDock(this._dropDockIdx);
            } else if (this._dragFromDock) {
                // 源是 Dock、落点是网格
                this._applyMoveFromDock();
            } else if (this._dropCol !== undefined) {
                this._applyMove(this._dropCol, this._dropRow);
            }
        }

        this.dragItem = null;
        this._dragItemData = null;
        this._dropCol = undefined;
        this._dropRow = undefined;
        this._dropDockIdx = undefined;
        this._dragFromDock = false;
    },

    // 清理 items 为空的尾页（保留至少 1 页）——与 _applyMove 内的空页清理一致，供 Dock 增删复用
    _cleanupEmptyPages() {
        const layout = AppState.data.desktopLayout;
        if (!layout || !Array.isArray(layout.pages)) return;
        for (let i = layout.pages.length - 1; i > 0; i--) {
            if (layout.pages[i] && layout.pages[i].items.length === 0) layout.pages.splice(i, 1);
        }
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

        // Calculate target index in the flat list (row * cols + col)
        const targetIndex = targetRow * _cols() + targetCol;
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
    },

    // 落点 = Dock：网格 icon 加入 Dock（校验上限），或 Dock 内调序
    _applyMoveToDock(idx) {
        const layout = AppState.data.desktopLayout;
        const d = this._dragItemData;
        if (!layout || !d || !d.appId) return;
        if (!Array.isArray(layout.dock)) layout.dock = [];
        const dock = layout.dock;

        if (this._dragFromDock) {
            // Dock 内调序：先移除原位，再按修正后的 index 插回
            const from = dock.indexOf(d.appId);
            if (from < 0) return;
            dock.splice(from, 1);
            let to = idx;
            if (from < idx) to--;
            dock.splice(Math.max(0, Math.min(to, dock.length)), 0, d.appId);
        } else {
            // 网格 → Dock：校验上限
            if (dock.length >= DOCK_MAX) {
                Utils.showToast(I18n.t('dock.full', 'Dock 已满'));
                DesktopRenderer.render();   // 回弹（item 复位）
                return;
            }
            // 从源页网格移除该 icon
            const sourcePage = layout.pages[this.sourcePageIndex];
            if (sourcePage && Array.isArray(sourcePage.items)) {
                const i = sourcePage.items.findIndex(it => it.type === 'icon' && it.appId === d.appId);
                if (i >= 0) sourcePage.items.splice(i, 1);
            }
            dock.splice(Math.max(0, Math.min(idx, dock.length)), 0, d.appId);
            DesktopRenderer.reflow(this.sourcePageIndex);
        }

        this._cleanupEmptyPages();   // 把图标拖进 Dock 后可能掏空源页 / edge-scroll 翻出的空页一并清掉
        Utils.saveData();
        DesktopRenderer.render();
    },

    // 落点 = 网格、源 = Dock：从 Dock 移除（校验下限），落进网格落点；落点无效则兜底找空位（杜绝消失）
    _applyMoveFromDock() {
        const layout = AppState.data.desktopLayout;
        const d = this._dragItemData;
        if (!layout || !d || !d.appId || !Array.isArray(layout.dock)) return;
        const dock = layout.dock;
        const at = dock.indexOf(d.appId);
        if (at < 0) return;

        // 下限：至少留 1 个
        if (dock.length <= 1) {
            Utils.showToast(I18n.t('dock.min_one', 'Dock 至少保留一个'));
            DesktopRenderer.render();   // 回弹
            return;
        }
        // 先校验落点页存在再动 dock（对齐 _applyMove：先校验落点、再改数据），
        // 避免「dock 已移除但落点页缺失」的半成品态
        const pageIdx = DesktopPager.currentPage;
        const page = layout.pages[pageIdx];
        if (!page) { DesktopRenderer.render(); return; }
        dock.splice(at, 1);

        const newItem = {
            id: 'di_' + Date.now().toString(36),
            type: 'icon', appId: d.appId, col: 0, row: 0, colSpan: 1, rowSpan: 1
        };

        if (this._dropCol !== undefined) {
            const targetIndex = this._dropRow * _cols() + this._dropCol;
            const insertAt = Math.min(targetIndex, page.items.length);
            page.items.splice(insertAt, 0, newItem);
            DesktopRenderer.reflow(pageIdx);
        } else {
            // 兜底：落点无效 → 找空位加回当前页（找不到就 0,0），绝不让 app 消失
            const spot = DesktopRenderer._findEmptyCell(page, 1) || { col: 0, row: 0 };
            newItem.col = spot.col; newItem.row = spot.row;
            page.items.push(newItem);
            DesktopRenderer.reflow(pageIdx);
        }

        this._cleanupEmptyPages();   // edge-scroll 拖动中可能 push 过空页，一并清掉
        Utils.saveData();
        DesktopRenderer.render();
    }
};
