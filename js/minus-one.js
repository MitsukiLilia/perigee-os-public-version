// ===== 负一屏（Minus One Page）=====
// 手机桌面第 0 页再往左滑出来的一页：不放 app 图标，是一页纵向滚动的专属组件板。
// 三张卡：A 收藏的小说·目次、B 收藏的帖子·排行榜（第一阶段）、C 周边展示·吧唧布板（第二阶段）。
//
// 架构约束（改之前先读完这三条）：
// 1. 绝不进 AppState.data.desktopLayout.pages —— 贴纸 decorations[].page / 图标自愈
//    （_ensureBroadcastIcon 等）都拿裸页索引当协议，硬插一页会污染这套协议、也踩单测钉死的
//    pages[0] 语义。改用 #desktopPages 里一个绝对定位的独立节点，页码另记为 -1（DesktopPager）。
// 2. 根节点 class 只用 .minus-one-page，绝不带 app-grid / app-item / desktop-grid-widget——
//    拖拽落点、长按编辑、容量自愈、点击委托全靠这些 class 选择器找目标，不带就天然免疫。
// 3. 卡 A/B 不持久化任何数据（现算现渲染）。卡 C（周边展示）从第二阶段起持久化在
//    AppState.data.minusOne.goods——全新字段、不是迁移，惰性兜底见下方 _goodsData()。
//    第三阶段起卡片的增减/排序持久化在 AppState.data.minusOne.cards，惰性兜底见 _cardsData()。
const MinusOne = {
    // 挂载进 desktopPages 的根节点：固定只创建一次、反复复用同一个元素实例。
    // DesktopRenderer.render() 每次都会 pages.innerHTML = '' 整体重建，节点被移出 DOM 后
    // 再插回会丢 scrollTop——所以不能让 render() 把它冲掉，得自己存着、每次 render 后重新挂回去。
    _rootEl: null,
    _scrollTop: 0,

    // 负一屏是否存在（关掉＝手机上滑不出、Duo 展开也不常驻）。本阶段恒开启。
    enabled() {
        return true;
    },

    // v2.275 折叠屏展开态（html.stage-right，index.html head 判定）：负一屏不再是翻页器里滑出来的一页，
    // 而是常驻在折痕左边——同一个节点挪到 body 上、position:fixed 贴左半边（样式见 css/minus-one.css
    // .mo-docked）。为什么挂 body 不留在 #desktopPages 里改 fixed：翻页器带 translateX，是 fixed 后代的
    // 定位基准、又被 .screen 裁剪，节点逃不出舞台；body 本身就是舞台（transform 定位基准）且不裁剪。
    docked() {
        return this.enabled() && document.documentElement.classList.contains('stage-right');
    },

    // 挂进 pagesEl（即 #desktopPages）；展开态改挂 body。由 DesktopRenderer.render() 在自己的页面循环之后调用。
    mount(pagesEl) {
        if (!pagesEl || !this.enabled()) return;
        if (!this._rootEl) {
            const el = document.createElement('div');
            el.className = 'minus-one-page';
            // passive 监听记住滚动位置，供下次 mount 时还原（节点复用、不是重建，这里其实
            // 很少真的丢位置，但 render() 会把它移出再插回 DOM，保险起见还是记一下）
            el.addEventListener('scroll', () => { this._scrollTop = el.scrollTop; }, { passive: true });
            this._bindClicks(el);
            // 卡片文案是动态 innerHTML，不吃 data-i18n 那套自动替换：语言切完（字典是懒加载的，
            // 事件在字典就位后才发）自己重画一遍
            window.addEventListener('languageChanged', () => this.refresh());
            // 开合切换（head 脚本在 stage-right 增减时派发）→ 换挂点
            window.addEventListener('perigee:stage-change', () => this.onStageChange());
            this._rootEl = el;
        }
        const docked = this.docked();
        this._rootEl.classList.toggle('mo-docked', docked);
        if (docked) {
            document.body.appendChild(this._rootEl);
            this.syncWallpaper();
        } else {
            this._rootEl.style.backgroundImage = '';
            pagesEl.appendChild(this._rootEl);
        }
        this._rootEl.scrollTop = this._scrollTop;
        this.refresh();
    },

    // 常驻态自带一层壁纸（像另一块手机屏）：主题壁纸走 CSS 变量 --wallpaper-gradient；用户自定义壁纸是
    // settings.js applyWallpaper 写在 #desktop 上的内联 backgroundImage，这里照抄一份（换壁纸时那边也会调）。
    syncWallpaper() {
        if (!this._rootEl || !this._rootEl.classList.contains('mo-docked')) return;
        const desktop = document.getElementById('desktop');
        this._rootEl.style.backgroundImage = (desktop && desktop.style.backgroundImage) || '';
    },

    // 开合切换：节点换挂点；展开那一刻若人正停在 -1 页，翻页器回到第 0 页（-1 页在常驻态不存在）
    onStageChange() {
        const pages = document.getElementById('desktopPages');
        if (!pages || !this._rootEl) return;
        this.mount(pages);
        if (this.docked() && typeof DesktopPager !== 'undefined' && DesktopPager.currentPage === -1) {
            DesktopPager.goToPage(0);
        }
    },

    // 卡 id → 生成该卡 HTML 的方法名，_cardsData() 存的就是这三个 id
    _CARD_RENDERERS: { novels: '_novelsCardHtml', threads: '_threadsCardHtml', goods: '_goodsCardHtml' },

    // 重新生成卡片内容：按 _cardsData() 的顺序只渲染 on 的卡；全关时中间放一行提示文案。
    // 卡 A/B 数据都在内存里（AppState.data），同步渲染即可；
    // 卡 C 的吧唧图片走 IllustGallery（IndexedDB），同步渲染占位 + 异步水合（照 Profile Card）。
    refresh() {
        if (!this._rootEl) return;
        const cards = this._cardsData().filter(c => c.on);
        const bodyHtml = cards.length
            ? cards.map(c => this[this._CARD_RENDERERS[c.id]]()).join('')
            : `<div class="mo-all-off-hint">${Utils.escapeHtml(I18n.t('minus_one.manage_empty_hint', '负一屏空空如也，去下面的「编辑」里开几张卡片吧'))}</div>`;
        this._rootEl.innerHTML = bodyHtml + this._manageBtnHtml();
        this._queueGoodsHydration();
    },

    // 底部「编辑负一屏」小药丸：仿 iOS 负一屏底部那颗，永远显示（哪怕三张卡全关，也要留个入口能重新开）
    _manageIconSvg() {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="14" cy="7" r="2.2"/><circle cx="8" cy="17" r="2.2"/></svg>`;
    },
    _manageBtnHtml() {
        const label = I18n.t('btn.edit', '编辑');
        return `<button type="button" class="mo-manage-btn" onclick="MinusOne.editCards()">${this._manageIconSvg()}<span>${Utils.escapeHtml(label)}</span></button>`;
    },

    // 行内点击委托：目次一行 → 打开小说，排行榜一行 → 打开帖子（两者内部自带 Navigation.goTo）；
    // 周边展示卡任意位置 → 打开编辑弹窗（纯装饰卡，没有行内跳转）。
    // 用 data-mo-novel / data-mo-thread 属性而不是拼 onclick 字符串——id 进单引号 JS 字符串的
    // 转义坑见项目 CLAUDE.md。
    _bindClicks(el) {
        el.addEventListener('click', (e) => {
            const novelRow = e.target.closest('[data-mo-novel]');
            if (novelRow) {
                const id = novelRow.getAttribute('data-mo-novel');
                if (typeof PixivNovel !== 'undefined' && PixivNovel.openNovel) PixivNovel.openNovel(id);
                return;
            }
            const threadRow = e.target.closest('[data-mo-thread]');
            if (threadRow) {
                const id = threadRow.getAttribute('data-mo-thread');
                if (typeof Forum !== 'undefined' && Forum.openThread) Forum.openThread(id);
                return;
            }
            const goodsCard = e.target.closest('[data-mo-goods-open]');
            if (goodsCard) this.editGoods();
        });
    },

    // ══════════════════════════════════════
    // 纯数据函数（不碰 DOM，node tests/minus-one.test.js 直测）
    // ══════════════════════════════════════

    // 收藏的小说·目次：favorites 倒序（最近收藏在前），跳过已不存在的 id，取前 limit 条
    _favNovels(limit = 5) {
        const data = (typeof AppState !== 'undefined' && AppState.data && AppState.data.pixivData) || {};
        const favorites = Array.isArray(data.favorites) ? data.favorites : [];
        const novels = Array.isArray(data.novels) ? data.novels : [];
        const out = [];
        for (let i = favorites.length - 1; i >= 0 && out.length < limit; i--) {
            const novel = novels.find(n => n && n.id === favorites[i]);
            if (!novel) continue;
            const words = (novel.chapters || []).reduce((s, c) => s + (c.wordCount || 0), 0);
            out.push({ id: novel.id, title: novel.title || '', words });
        }
        return out;
    },

    // 收藏的帖子·排行榜：回复数（=t.replies.length，不含主楼，与 widgets.js _composeNewsItems
    // 同口径）降序；同数按 favorites 里靠后的（=更近收藏的）排前面；跳过已不存在的 id，取前 limit 条。
    // ratio = replies / 本榜（取完 limit 条之后）最大回复数，最大为 0 时 ratio 也是 0。
    _topThreads(limit = 5) {
        const data = (typeof AppState !== 'undefined' && AppState.data && AppState.data.forumData) || {};
        const favorites = Array.isArray(data.favorites) ? data.favorites : [];
        const threads = Array.isArray(data.threads) ? data.threads : [];
        const rows = [];
        favorites.forEach((id, favIdx) => {
            const thread = threads.find(t => t && t.id === id);
            if (!thread) return;
            rows.push({ id: thread.id, title: thread.title || '', replies: (thread.replies || []).length, favIdx });
        });
        rows.sort((a, b) => (b.replies - a.replies) || (b.favIdx - a.favIdx));
        const top = rows.slice(0, limit);
        const maxReplies = top.reduce((m, r) => Math.max(m, r.replies), 0);
        return top.map(r => ({
            id: r.id,
            title: r.title,
            replies: r.replies,
            ratio: maxReplies > 0 ? r.replies / maxReplies : 0
        }));
    },

    // ══════════════════════════════════════
    // 卡片增减/排序（第三阶段）—— 纯数据函数
    // ══════════════════════════════════════

    // 已知卡 id，数组顺序即出厂默认的显示顺序
    _KNOWN_CARD_IDS: ['novels', 'threads', 'goods'],

    // _cardsData() 在 AppState 都不可用时的兜底形状（不落盘，纯内存）
    _cardsFreshShape() {
        return this._KNOWN_CARD_IDS.map(id => ({ id, on: true }));
    },

    // 惰性兜底：AppState.data.minusOne.cards 缺失/形状不对就地补全，永不抛异常。
    // 规则：整体缺失或不是数组 → 给默认三张全开；数组项不是对象/id 不是已知 id/id 重复 → 丢弃该项；
    // 清理完少了哪个已知 id → 追加到末尾（on:true）；on 只有显式 false 才算关闭，其余（缺失/脏值）当 true。
    _cardsData() {
        let data = null;
        try { data = (typeof AppState !== 'undefined' && AppState.data) ? AppState.data : null; } catch (e) { data = null; }
        if (!data) return this._cardsFreshShape();

        const mo = (data.minusOne && typeof data.minusOne === 'object') ? data.minusOne : (data.minusOne = {});
        if (!Array.isArray(mo.cards)) {
            mo.cards = this._cardsFreshShape();
            return mo.cards;
        }

        const seen = new Set();
        const cleaned = [];
        mo.cards.forEach(c => {
            if (!c || typeof c !== 'object') return;
            if (!this._KNOWN_CARD_IDS.includes(c.id) || seen.has(c.id)) return;
            seen.add(c.id);
            cleaned.push({ id: c.id, on: c.on !== false });
        });
        this._KNOWN_CARD_IDS.forEach(id => { if (!seen.has(id)) cleaned.push({ id, on: true }); });

        mo.cards = cleaned;
        return cleaned;
    },

    // ══════════════════════════════════════
    // 卡 C：周边展示（吧唧布板）—— 纯数据函数
    // ══════════════════════════════════════

    // 缎带预设色（低饱和 6 色：薄荷绿/可可棕/奶油粉/雾蓝/薰衣草紫/蜂蜜黄），全小写十六进制
    // 方便与 <input type="color"> 的返回值（浏览器恒小写）做大小写不敏感比较。
    _GOODS_RIBBON_PRESETS: ['#9bc9ae', '#8b6e56', '#e6b8be', '#a6c0d6', '#b7a6cc', '#dfbd73'],

    // 布板预设背景图注册表：以后加新风格只往这个数组里追加一条即可（solo/pair 各一张图，比例
    // 与 css .mo-goods-board 的 aspect-ratio 对应：solo=1/1、pair=3/2）。
    // 每套三张图放在同一目录：goods-board-solo.webp（1:1）/ goods-board-pair.webp（3:2）/ goods-board-thumb.webp
    // （160px 缩略图，编辑弹窗里的选择格用它——整图只在真被选中时才加载）。
    // 画风各自跟着一套预设主题走，但和当前主题不绑定：用户爱配哪套配哪套。加新的只往数组里加一行。
    _GOODS_BG_PRESETS: [
        { id: 'mint-fabric', nameKey: 'minus_one.goods_bg_mint_fabric', dir: 'assets/widgets/mint-choco' },
        { id: 'sakura-lace', nameKey: 'minus_one.goods_bg_sakura_lace', dir: 'assets/widgets/sakura' },
        { id: 'journal-linen', nameKey: 'minus_one.goods_bg_journal_linen', dir: 'assets/widgets/journal' },
        { id: 'strawberry-cream', nameKey: 'minus_one.goods_bg_strawberry_cream', dir: 'assets/widgets/strawberry' },
        { id: 'snow-frost', nameKey: 'minus_one.goods_bg_snow_frost', dir: 'assets/widgets/snow-country' },
        { id: 'rain-blue', nameKey: 'minus_one.goods_bg_rain_blue', dir: 'assets/widgets/summer-rain' },
        { id: 'taro-lavender', nameKey: 'minus_one.goods_bg_taro_lavender', dir: 'assets/widgets/taro-choco' },
        { id: 'animal-berry', nameKey: 'minus_one.goods_bg_animal_berry', dir: 'assets/widgets/animal' }
    ].map(p => ({ id: p.id, nameKey: p.nameKey, solo: p.dir + '/goods-board-solo.webp', pair: p.dir + '/goods-board-pair.webp', thumb: p.dir + '/goods-board-thumb.webp' })),

    // 解析出「布板最终该用什么背景」，不碰 DOM，供渲染与 node 测试共用。
    // 返回 { type, color, url, blobId }：dots 只有 color 有意义；preset 给同步可用的静态图 url；
    // upload 给要去 IllustGallery 取的 blobId（真正的 ObjectURL 由 _hydrateGoods 异步建）。
    // preset id 在注册表里找不到 / upload 没有合法 blobId，都当脏数据回落成 dots。
    _goodsBgResolved(goods, layout) {
        const bg = (goods && goods.bg && typeof goods.bg === 'object') ? goods.bg : {};
        const color = this._isHex6(bg.color) ? bg.color.toLowerCase() : '';
        if (bg.type === 'preset') {
            const preset = this._GOODS_BG_PRESETS.find(p => p.id === bg.preset);
            if (preset) {
                const url = layout === 'pair' ? preset.pair : preset.solo;
                return { type: 'preset', color, url, blobId: null };
            }
            return { type: 'dots', color, url: null, blobId: null };
        }
        if (bg.type === 'upload') {
            const blobId = (bg.image && bg.image.blobId) || null;
            if (blobId) return { type: 'upload', color, url: null, blobId };
            return { type: 'dots', color, url: null, blobId: null };
        }
        return { type: 'dots', color, url: null, blobId: null };
    },

    // 小吧唧命名摆位（百分比，相对布板）。6 个常驻位 + 1 个仅给奇数数量「多出来那枚」用的底部正中。
    // 与 css 里的几何配套（大吧唧 D=36cqw·圆心 50/35·缎带圈外径≈50cqw·垂尾到 y≈74%·布牌压在垂尾上）：
    // 左右两列贴着缎带圈外沿，底部一排在布牌下方；改其中一处，另一处要一起在浏览器里重看。
    _GOODS_MINI_SLOTS: {
        tl: { x: 14, y: 23 }, tr: { x: 86, y: 23 },
        bl: { x: 13, y: 55 }, br: { x: 87, y: 55 },
        bottomL: { x: 27, y: 87 }, bottomR: { x: 73, y: 87 },
        bottomC: { x: 50, y: 87 }
    },

    // 小吧唧数量 0~6 → 取哪些命名位：左右对称优先，1/3/5 这种奇数时最后一枚落底部正中。
    // 返回值是命名位 key 的数组（渲染时查 _GOODS_MINI_SLOTS 换算坐标），数组下标 i 对应 solo.minis[i]——
    // 这样调小数量只是少显示末尾几个 key，不会打乱前面已显示的吧唧的坑位（也不删数据）。
    _soloMiniPositions(count) {
        const n = Math.max(0, Math.min(6, count | 0));
        const byCount = {
            0: [],
            1: ['bottomC'],
            2: ['tl', 'tr'],
            3: ['tl', 'tr', 'bottomC'],
            4: ['tl', 'tr', 'bl', 'br'],
            5: ['tl', 'tr', 'bl', 'br', 'bottomC'],
            6: ['tl', 'tr', 'bl', 'br', 'bottomL', 'bottomR']
        };
        return byCount[n];
    },

    // 校验「# + 6 位十六进制」，不合法（含空串＝跟随主题）一律当作跟随主题处理——渲染时不下发
    // --mo-ribbon，CSS 侧自然兜底到 var(--accent-color)
    _isHex6(v) {
        return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
    },

    // CP「左右互换」的纯数据版本：只换 a/b 图片槽与 ribbonA/ribbonB，布牌文字（pair.tag，两侧共用一块）不动。
    // 弹窗里的互换按钮直接操作 DOM（照 editProfile 系模式，见 _moSwapPair），这里单独留一份
    // 纯函数是为了能被 node 测试直测，不依赖 DOM。
    _swapPairSides(pair) {
        const p = pair || {};
        return {
            ...p,
            a: p.b !== undefined ? p.b : null,
            b: p.a !== undefined ? p.a : null,
            ribbonA: p.ribbonB || '',
            ribbonB: p.ribbonA || ''
        };
    },

    // 惰性兜底：AppState.data.minusOne.goods 缺字段就地补全（不覆盖已有值），永不抛异常。
    // 全新字段、不是迁移——老存档第一次点开负一屏时这里现场补，不用等 loadData 跑迁移。
    // 注：旧形状可能遗留 solo.title / pair.title / pair.sub 等已不再使用的字段，这里不主动清掉——
    // 留着不影响新逻辑（没人再读它们），比专门写清理代码更简单。
    _goodsData() {
        let data = null;
        try { data = (typeof AppState !== 'undefined' && AppState.data) ? AppState.data : null; } catch (e) { data = null; }
        if (!data) return this._goodsFreshShape();   // AppState 都不在（极端/测试场景）：给一份不落盘的干净默认值

        const mo = (data.minusOne && typeof data.minusOne === 'object') ? data.minusOne : (data.minusOne = {});
        const goods = (mo.goods && typeof mo.goods === 'object') ? mo.goods : (mo.goods = {});

        if (goods.layout !== 'solo' && goods.layout !== 'pair') goods.layout = 'solo';

        const solo = (goods.solo && typeof goods.solo === 'object') ? goods.solo : (goods.solo = {});
        if (typeof solo.tag !== 'string') solo.tag = '';
        if (typeof solo.ribbon !== 'string') solo.ribbon = '';
        if (typeof solo.count !== 'number' || !isFinite(solo.count)) solo.count = 4;
        solo.count = Math.max(0, Math.min(6, Math.round(solo.count)));
        if (solo.hero === undefined) solo.hero = null;
        if (!Array.isArray(solo.minis)) solo.minis = [];
        if (solo.minis.length !== 6) {
            const old = solo.minis;
            solo.minis = [0, 1, 2, 3, 4, 5].map(i => (old[i] !== undefined ? old[i] : null));
        }

        const pair = (goods.pair && typeof goods.pair === 'object') ? goods.pair : (goods.pair = {});
        if (typeof pair.tag !== 'string') pair.tag = '';
        if (typeof pair.ribbonA !== 'string') pair.ribbonA = '';
        if (typeof pair.ribbonB !== 'string') pair.ribbonB = '';
        if (pair.a === undefined) pair.a = null;
        if (pair.b === undefined) pair.b = null;

        // 布板背景（solo/pair 共用一份）：type 非法回落 dots；color 非空但不是合法十六进制时当脏数据丢弃
        // 回落空串（空串＝跟随主题，语义同 _isHex6 顶部注释）；image 没有合法 blobId 就归零成 null。
        const bg = (goods.bg && typeof goods.bg === 'object') ? goods.bg : (goods.bg = {});
        if (bg.type !== 'dots' && bg.type !== 'preset' && bg.type !== 'upload') bg.type = 'dots';
        if (typeof bg.color !== 'string' || (bg.color !== '' && !this._isHex6(bg.color))) bg.color = '';
        if (typeof bg.preset !== 'string') bg.preset = '';
        if (!(bg.image && typeof bg.image === 'object' && typeof bg.image.blobId === 'string' && bg.image.blobId)) bg.image = null;

        return goods;
    },

    // _goodsData() 在 AppState 都不可用时的兜底形状（不落盘，纯内存），字段形状与 _DATA_DEFAULTS 里的出厂默认一致
    _goodsFreshShape() {
        return {
            layout: 'solo',
            solo: { tag: '', ribbon: '', count: 4, hero: null, minis: [null, null, null, null, null, null] },
            pair: { tag: '', ribbonA: '', ribbonB: '', a: null, b: null },
            bg: { type: 'dots', color: '', preset: '', image: null }
        };
    },

    // ══════════════════════════════════════
    // HTML 渲染
    // ══════════════════════════════════════

    // 单位文案在英文下不渲染（I18n.t 对空字符串 dict 值会误判成"缺失"、回落串到中文——
    // 见 js/i18n-en.js 里 minus_one.*_unit 注释，这里直接按语言分支绕开，不走 I18n.t 的空串路径）
    _unitHtml(key, zhFallback) {
        const lang = (typeof I18n !== 'undefined' && I18n.currentLang) || 'zh';
        if (lang === 'en') return '';
        const unit = I18n.t(key, zhFallback);
        return `<span class="mo-unit">${Utils.escapeHtml(unit)}</span>`;
    },

    _novelsCardHtml() {
        const items = this._favNovels(5);
        const title = I18n.t('minus_one.novels_title', '收藏的小说');
        let bodyHtml;
        if (!items.length) {
            bodyHtml = `<div class="mo-card-empty">
                <p>${Utils.escapeHtml(I18n.t('minus_one.novels_empty', '还没有收藏的小说'))}</p>
                <p class="mo-empty-hint">${Utils.escapeHtml(I18n.t('minus_one.novels_empty_hint', '在 Pixiv 里点一下收藏，它就会出现在这里'))}</p>
            </div>`;
        } else {
            bodyHtml = `<div class="mo-novel-list">${items.map((n, i) => `
                <div class="mo-novel-row" data-mo-novel="${Utils.escapeHtml(n.id)}">
                    <span class="mo-novel-idx">${String(i + 1).padStart(2, '0')}</span>
                    <span class="mo-novel-title">${Utils.escapeHtml(n.title)}</span>
                    <span class="mo-dot-leader"></span>
                    <span class="mo-novel-words">${n.words.toLocaleString('en-US')}${this._unitHtml('minus_one.novels_unit', '字')}</span>
                </div>`).join('')}</div>`;
        }
        return `<div class="mo-card mo-card-novels">
            <div class="mo-card-head">
                <h3 class="mo-card-title">${Utils.escapeHtml(title)}</h3>
                <div class="mo-head-divider"><span class="mo-divider-line"></span><span class="mo-divider-dots"><i></i><i></i><i></i></span><span class="mo-divider-line"></span></div>
            </div>
            ${bodyHtml}
        </div>`;
    },

    // 四角散点装饰复用的 SVG 片段：一份标记 + CSS transform 镜像贴四角，见 css/minus-one.css .mo-corner-dots
    _cornerDotsSvg(cornerClass) {
        return `<svg class="mo-corner-dots ${cornerClass}" viewBox="0 0 40 34" aria-hidden="true">
            <circle class="mo-dot-a" cx="6" cy="7" r="2.4"/>
            <circle class="mo-dot-b" cx="19" cy="4" r="1.8"/>
            <circle class="mo-dot-a" cx="31" cy="9" r="1.5"/>
            <circle class="mo-dot-b" cx="9" cy="18" r="1.5"/>
            <circle class="mo-dot-a" cx="24" cy="20" r="2"/>
        </svg>`;
    },

    _threadsCardHtml() {
        const items = this._topThreads(5);
        const title = I18n.t('minus_one.threads_title', '收藏的帖子');
        const subtitle = I18n.t('minus_one.threads_subtitle', '排行榜');
        let bodyHtml;
        if (!items.length) {
            bodyHtml = `<div class="mo-card-empty">
                <p>${Utils.escapeHtml(I18n.t('minus_one.threads_empty', '还没有收藏的帖子'))}</p>
                <p class="mo-empty-hint">${Utils.escapeHtml(I18n.t('minus_one.threads_empty_hint', '在论坛里收藏喜欢的帖子，回复最多的会排在前面'))}</p>
            </div>`;
        } else {
            bodyHtml = `<div class="mo-thread-list">${items.map((t, i) => `
                <div class="mo-rank-row" data-mo-thread="${Utils.escapeHtml(t.id)}">
                    <span class="mo-rank-badge">${i + 1}</span>
                    <span class="mo-rank-title">${Utils.escapeHtml(t.title)}</span>
                    <span class="mo-rank-bar-track"><span class="mo-rank-bar" style="width:${Math.max(t.ratio * 100, t.replies > 0 ? 6 : 0)}%"></span></span>
                    <span class="mo-rank-replies">${t.replies}${this._unitHtml('minus_one.threads_unit', '条')}</span>
                </div>`).join('')}</div>`;
        }
        return `<div class="mo-card mo-card-threads">
            ${this._cornerDotsSvg('tl')}${this._cornerDotsSvg('tr')}${this._cornerDotsSvg('bl')}${this._cornerDotsSvg('br')}
            <div class="mo-card-head">
                <h3 class="mo-card-title">${Utils.escapeHtml(title)}</h3>
                <p class="mo-card-subtitle">${Utils.escapeHtml(subtitle)}</p>
            </div>
            ${bodyHtml}
        </div>`;
    },

    // ══════════════════════════════════════
    // 卡 C：周边展示（吧唧布板）—— HTML 渲染
    // ══════════════════════════════════════

    // 通用「+」/「−」线条图标（stepper 与空吧唧占位共用同一份「+」，靠外层 class 控制大小）
    _plusSvg(cls) {
        return `<svg class="${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`;
    },
    _minusSvg(cls) {
        return `<svg class="${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>`;
    },
    // 吧唧表面高光：实色半透明白的月牙（内联 SVG，复用 Profile Card 月夜占位同款弧线几何）——
    // 项目 UI 铁律无渐变，这里是纯色 fill 不是 gradient，只是形状像月牙
    _goodsGlossSvg() {
        return `<svg class="mo-badge-gloss" viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 6.395A4.5 4.5 0 115.605 1.5a3.5 3.5 0 004.895 4.895z" fill="rgba(255,255,255,0.55)"/></svg>`;
    },

    // 一枚吧唧（缎带圈 + 圆形本体）。hasRibbon=false 用于单推的小吧唧（只有大吧唧/CP 两枚有缎带）。
    // ribbonHex 过 _isHex6 校验，非法/跟随主题都不下发 --mo-ribbon，CSS 侧回落主题色。
    _goodsUnitHtml({ slotKey, sizeClass, left, top, ref, hasRibbon, ribbonHex, rotateDeg }) {
        const styleParts = [`left:${left}%`, `top:${top}%`];
        if (rotateDeg) styleParts.push(`--mo-rot:${rotateDeg}deg`);
        if (hasRibbon && this._isHex6(ribbonHex)) styleParts.push(`--mo-ribbon:${ribbonHex}`);
        const rosetteHtml = hasRibbon ? `<div class="mo-rosette"></div>` : '';
        // 有 ref（已选图）先占位待水合；没 ref 直接同步画空态（奶油底+虚线圈+SVG加号）
        const contentHtml = ref
            ? `<span class="mo-badge-photo-content"></span>`
            : `<span class="mo-badge-photo-content"><div class="mo-badge-empty-inner">${this._plusSvg('mo-badge-plus')}</div></span>`;
        return `<div class="mo-badge-slot ${sizeClass}" data-mo-goods-slot="${slotKey}" style="${styleParts.join(';')}">
            ${rosetteHtml}
            <div class="mo-badge-photo">${contentHtml}${this._goodsGlossSvg()}</div>
        </div>`;
    },

    // 卡头没了（改动二），文字统一成布板上的小布牌；fallbackText 由调用方按当前布局传入
    // （单推 fallback「本命」/CP fallback「一对」，两者的 i18n key 不同，函数本身不关心）。
    _goodsTagHtml(tag, fallbackText) {
        const text = (tag || '').trim() || fallbackText;
        return `<div class="mo-goods-tag"><span class="mo-goods-tag-text">${Utils.escapeHtml(text)}</span></div>`;
    },

    // 布板背景（solo/pair 共用）：算出 class + 内联 style。dots 只下发 --mo-board-color（合法色才下发，
    // 跟随主题就什么都不下发，CSS 侧自然兜底）；preset/upload 关掉 CSS 圆点/缝线（靠 .mo-goods-bg-image
    // 类）——preset 的图同步可得直接内联；upload 要等 IllustGallery 异步取 blob，这里先只关圆点，
    // 真正的 background-image 由 _hydrateGoods 水合时补上。
    _goodsBoardStyleAttrs(goods, layout) {
        const resolved = this._goodsBgResolved(goods, layout);
        const styleParts = [];
        let cls = '';
        if (resolved.color) styleParts.push(`--mo-board-color:${resolved.color}`);
        if (resolved.type === 'preset' && resolved.url) {
            cls = ' mo-goods-bg-image';
            styleParts.push(`background-image:url('${resolved.url}')`, 'background-size:100% 100%');
        } else if (resolved.type === 'upload') {
            cls = ' mo-goods-bg-image';
        }
        return { cls, style: styleParts.join(';') };
    },

    // 大吧唧圆心 50/35（尺寸在 css .mo-badge-hero），与 _GOODS_MINI_SLOTS 的摆位配套
    _goodsSoloBoardHtml(solo, goods) {
        const heroHtml = this._goodsUnitHtml({
            slotKey: 'hero', sizeClass: 'mo-badge-hero', left: 50, top: 35,
            ref: solo.hero, hasRibbon: true, ribbonHex: solo.ribbon, rotateDeg: 0
        });
        const positions = this._soloMiniPositions(solo.count);
        const minisHtml = positions.map((key, i) => {
            const pos = this._GOODS_MINI_SLOTS[key];
            const rotateDeg = (i % 2 === 0) ? 3 : -3;   // 交替旋转一点点，像手别上去的
            return this._goodsUnitHtml({
                slotKey: `mini${i}`, sizeClass: 'mo-badge-mini', left: pos.x, top: pos.y,
                ref: solo.minis[i], hasRibbon: false, ribbonHex: '', rotateDeg
            });
        }).join('');
        const { cls, style } = this._goodsBoardStyleAttrs(goods, 'solo');
        return `<div class="mo-goods-board mo-goods-solo${cls}" data-mo-goods-open="1" style="${style}">
            ${heroHtml}
            ${minisHtml}
            ${this._goodsTagHtml(solo.tag, I18n.t('minus_one.goods_solo_tag', '本命'))}
        </div>`;
    },

    // 两枚圆心 28.5 / 71.5、y=41%（布板 3:2）：缎带圈顶贴着蕾丝下沿、垂尾离底边缝线留一指宽；
    // 白蝴蝶结（css .mo-goods-bow）的 top 与这里保持同一条水平线。CP 布牌（改动二新增）压在两条
    // 垂尾之间的底部正中，摆位见 css .mo-goods-pair .mo-goods-tag。
    _goodsPairBoardHtml(pair, goods) {
        const aHtml = this._goodsUnitHtml({
            slotKey: 'a', sizeClass: 'mo-badge-pair mo-badge-pair-a', left: 28.5, top: 41,
            ref: pair.a, hasRibbon: true, ribbonHex: pair.ribbonA, rotateDeg: 0
        });
        const bHtml = this._goodsUnitHtml({
            slotKey: 'b', sizeClass: 'mo-badge-pair mo-badge-pair-b', left: 71.5, top: 41,
            ref: pair.b, hasRibbon: true, ribbonHex: pair.ribbonB, rotateDeg: 0
        });
        const { cls, style } = this._goodsBoardStyleAttrs(goods, 'pair');
        return `<div class="mo-goods-board mo-goods-pair${cls}" data-mo-goods-open="1" style="${style}">
            ${aHtml}${bHtml}
            <div class="mo-goods-bow"></div>
            ${this._goodsTagHtml(pair.tag, I18n.t('minus_one.goods_pair_tag', '一对'))}
        </div>`;
    },

    // 卡头（标题/副标题）整个取消：布板自己就是组件，直接返回布板 html（css 给它套等同 .mo-card 的
    // 圆角+投影，不再包一层 .mo-card 外壳）
    _goodsCardHtml() {
        const goods = this._goodsData();
        const isSolo = goods.layout !== 'pair';
        return isSolo ? this._goodsSoloBoardHtml(goods.solo, goods) : this._goodsPairBoardHtml(goods.pair, goods);
    },

    // 卡 C 图片异步水合：同步渲染阶段用占位（无图=空态 SVG，有 ref=空 span），这里按 blobId 取真实
    // Blob 建 ObjectURL 回填。照 Widgets._hydrateProfile 的模式：先回收上一轮的 URL 再建新的。
    _goodsUrls: [],
    _queueGoodsHydration() {
        setTimeout(() => this._hydrateGoods(), 0);
    },
    async _hydrateGoods() {
        this._goodsUrls.forEach(u => { try { URL.revokeObjectURL(u); } catch (e) {} });
        this._goodsUrls = [];
        if (typeof IllustGallery === 'undefined' || !IllustGallery.getBlob) return;
        const goods = this._goodsData();
        const isSolo = goods.layout !== 'pair';
        const layout = isSolo ? 'solo' : 'pair';
        const slots = isSolo
            ? [['hero', goods.solo.hero]].concat(goods.solo.minis.map((m, i) => [`mini${i}`, m]))
            : [['a', goods.pair.a], ['b', goods.pair.b]];
        for (const [slotKey, ref] of slots) {
            if (!ref || !ref.blobId) continue;
            const blob = await IllustGallery.getBlob(ref.blobId).catch(() => null);
            if (!blob) continue;   // blob 丢失（跨设备导入，本地没有原图）→ 占位保留，照 Profile Card 同样的兜底
            if (!this._rootEl || !this._rootEl.isConnected) return;   // 等待期间页面已卸载/重渲染
            const el = this._rootEl.querySelector(`[data-mo-goods-slot="${slotKey}"] .mo-badge-photo-content`);
            if (!el) continue;   // 布局/数量在等待期间变了，这个坑位已经不在当前渲染里
            const url = URL.createObjectURL(blob);
            this._goodsUrls.push(url);
            el.innerHTML = `<img src="${url}" alt="" style="${ImagePositioner.transformStyle(ref.pos)}">`;
        }
        // 背景图（上传类型）：静态渲染阶段只知道 blobId，这里取到真实 blob 才能建 ObjectURL；
        // 取不到（blob 丢失）就保留同步渲染时已关掉圆点的空态——不強行回退成 dots，避免闪烁。
        const resolved = this._goodsBgResolved(goods, layout);
        if (resolved.type === 'upload' && resolved.blobId) {
            const blob = await IllustGallery.getBlob(resolved.blobId).catch(() => null);
            if (blob && this._rootEl && this._rootEl.isConnected) {
                const boardEl = this._rootEl.querySelector('.mo-goods-board');
                if (boardEl) {
                    const url = URL.createObjectURL(blob);
                    this._goodsUrls.push(url);
                    boardEl.style.backgroundImage = `url('${url}')`;
                    boardEl.style.backgroundSize = 'cover';
                    boardEl.style.backgroundPosition = 'center';
                }
            }
        }
    },

    // ══════════════════════════════════════
    // 卡 C：周边展示 —— 编辑弹窗
    // 照 Widgets.editProfile 手写 .modal-overlay/.modal-window 的模式：挂载到 document.body（宽视口
    // 舞台下 body 自己是 fixed 后代定位基准，同一父节点天然位置正确，不用自己算坐标）。
    // 图片槽没有放送局立绘/URL 两条经路，只有「上传 + 位置 + 移除」——比 Profile Card 更简单。
    // ══════════════════════════════════════

    _uploadSvg() {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px" aria-hidden="true"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>`;
    },
    _posSvg() {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>`;
    },
    _removeSvg() {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`;
    },
    _swapSvg() {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px" aria-hidden="true"><path d="M7 7h13l-4-4M17 17H4l4 4"/></svg>`;
    },
    // 吸管/调色图标：固定白描边 + 阴影而不是 currentColor——圆点背景会随用户选色变，描边要在任何底色上都看得清
    _pipetteSvg() {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 5.5l4 4M11 9l-6.5 6.5V19h3.5L15 12M13 7l3.5-3.5a2.4 2.4 0 013.5 3.5L16.5 10.5"/></svg>`;
    },
    // 「跟随主题」占位图标：简单的循环箭头，表达「随主题变」，不是任何具体色板
    _themeDotSvg() {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11A8 8 0 105.5 16.5M20 11V5M20 11h-6"/></svg>`;
    },

    // 缎带颜色一组色点：预设 + 跟随主题 + 系统取色器。currentHex 非法值一律按「跟随主题」显示（脏数据不崩）。
    _moRibbonGroupHtml(groupId, currentHex) {
        const presets = this._GOODS_RIBBON_PRESETS;
        const cur = (currentHex || '').toLowerCase();
        const valid = this._isHex6(cur);
        const isPreset = valid && presets.includes(cur);
        const isCustom = valid && !isPreset;
        const dotsHtml = presets.map(c => `
            <button type="button" class="mo-ribbon-dot${cur === c ? ' active' : ''}" style="background:${c}" data-val="${c}" title="${c}" onclick="MinusOne._moRibbonPick(this,'${c}')"></button>`).join('');
        const themeTitle = I18n.t('minus_one.goods_ribbon_theme', '跟随主题');
        const themeHtml = `<button type="button" class="mo-ribbon-dot mo-ribbon-theme${!valid ? ' active' : ''}" data-val="" title="${Utils.escapeHtml(themeTitle)}" onclick="MinusOne._moRibbonPick(this,'')">${this._themeDotSvg()}</button>`;
        // 系统取色器初值：已是自定义色就回填那个色，否则给个中性初值——不影响是否高亮，
        // 高亮只看 isCustom（当前保存的值是否为「预设/跟随主题以外」的合法色）
        const pickerVal = isCustom ? cur : '#c9c9c9';
        const pickerTitle = I18n.t('minus_one.goods_ribbon_custom', '自定义颜色');
        const pickerHtml = `<label class="mo-ribbon-dot mo-ribbon-picker${isCustom ? ' active' : ''}" style="background:${isCustom ? cur : 'var(--bg-secondary)'}" title="${Utils.escapeHtml(pickerTitle)}">
            ${this._pipetteSvg()}
            <input type="color" value="${pickerVal}" oninput="MinusOne._moRibbonPickerChange(this)">
        </label>`;
        return `<div class="mo-ribbon-group" id="${groupId}" data-value="${Utils.escapeHtml(valid ? cur : '')}">${dotsHtml}${themeHtml}${pickerHtml}</div>`;
    },

    // 预设色点 / 跟随主题点被点：组内互斥高亮复用 Widgets._noteChipPick，
    // 再把选中值写进 group 的 data-value（save 时唯一读取源）
    _moRibbonPick(btn, val) {
        Widgets._noteChipPick(btn);
        const group = btn.closest('.mo-ribbon-group');
        if (group) group.dataset.value = val;
    },

    // 系统取色器 input[type=color] 值变化：把它当作当前选中色，同组预设色点取消高亮
    _moRibbonPickerChange(input) {
        const val = input.value;   // 浏览器原生 color input 恒返回合法 #rrggbb（小写）
        const label = input.closest('.mo-ribbon-dot');
        const group = input.closest('.mo-ribbon-group');
        if (!label || !group) return;
        Array.from(group.children).forEach(c => c.classList.remove('active'));
        label.classList.add('active');
        label.style.background = val;
        group.dataset.value = val;
    },

    // 图片槽通用片段：上传/更换 + 调整位置 + 移除。slotKey 直接用作 DOM id 后缀（hero/mini0../a/b）。
    _moSlotHtml(slotKey, ref) {
        const blobId = (ref && ref.blobId) || '';
        const posAttr = (ref && ref.pos) ? ` data-pos="${Utils.escapeHtml(JSON.stringify(ref.pos))}"` : '';
        const hasAny = !!blobId;
        const uploadTxt = I18n.t('minus_one.goods_upload_btn', '上传');
        const changeTxt = I18n.t('minus_one.goods_change_btn', '更换');
        const posTxt = I18n.t('widgets.imgpos_open_btn', '调整位置');
        const removeTxt = I18n.t('minus_one.goods_remove_btn', '移除');
        return `
            <div id="moSlot${slotKey}" data-blobid="${Utils.escapeHtml(blobId)}"${posAttr} style="display:flex;align-items:center;gap:6px">
                <label class="widget-upload-btn" style="flex:1;min-width:0;display:flex;align-items:center;justify-content:center;gap:4px;padding:8px 4px;white-space:nowrap;cursor:pointer;margin:0">
                    ${this._uploadSvg()}<span>${Utils.escapeHtml(hasAny ? changeTxt : uploadTxt)}</span>
                    <input type="file" accept="image/*" style="display:none" onchange="MinusOne._moHandleUpload('${slotKey}',this.files[0],this.closest('.modal-overlay'));this.value=''">
                </label>
                <button type="button" id="moPosBtn${slotKey}" onclick="MinusOne._moOpenPositioner('${slotKey}',this.closest('.modal-overlay'))" title="${Utils.escapeHtml(posTxt)}"
                        style="display:${hasAny ? 'flex' : 'none'};align-items:center;justify-content:center;flex:0 0 auto;width:36px;height:36px;padding:0;border:1px solid var(--border-light);border-radius:8px;background:none;color:var(--text-secondary);cursor:pointer">
                    ${this._posSvg()}
                </button>
                <button type="button" id="moRmBtn${slotKey}" onclick="MinusOne._moRemoveImage('${slotKey}',this.closest('.modal-overlay'))" title="${Utils.escapeHtml(removeTxt)}"
                        style="display:${hasAny ? 'flex' : 'none'};align-items:center;justify-content:center;flex:0 0 auto;width:36px;height:36px;padding:0;border:1px solid var(--border-light);border-radius:8px;background:none;color:var(--text-secondary);cursor:pointer">
                    ${this._removeSvg()}
                </button>
            </div>`;
    },

    // 背景图槽（slotKey 固定 'bg'）：只有上传/更换 + 移除，没有「调整位置」（brief 明确不需要）——
    // 复用 _moHandleUpload / _moRemoveImage / _moRefreshSlotButtons 这套通用逻辑（它们都对不存在的
    // posBtn 做了空值判断，少渲染一个按钮不会报错）。
    _moBgUploadSlotHtml(bgImage) {
        const blobId = (bgImage && bgImage.blobId) || '';
        const hasAny = !!blobId;
        const uploadTxt = I18n.t('minus_one.goods_upload_btn', '上传');
        const changeTxt = I18n.t('minus_one.goods_change_btn', '更换');
        const removeTxt = I18n.t('minus_one.goods_remove_btn', '移除');
        return `
            <div id="moSlotbg" data-blobid="${Utils.escapeHtml(blobId)}" style="display:flex;align-items:center;gap:6px">
                <label class="widget-upload-btn" style="flex:1;min-width:0;display:flex;align-items:center;justify-content:center;gap:4px;padding:8px 4px;white-space:nowrap;cursor:pointer;margin:0">
                    ${this._uploadSvg()}<span>${Utils.escapeHtml(hasAny ? changeTxt : uploadTxt)}</span>
                    <input type="file" accept="image/*" style="display:none" onchange="MinusOne._moHandleUpload('bg',this.files[0],this.closest('.modal-overlay'));this.value=''">
                </label>
                <button type="button" id="moRmBtnbg" onclick="MinusOne._moRemoveImage('bg',this.closest('.modal-overlay'))" title="${Utils.escapeHtml(removeTxt)}"
                        style="display:${hasAny ? 'flex' : 'none'};align-items:center;justify-content:center;flex:0 0 auto;width:36px;height:36px;padding:0;border:1px solid var(--border-light);border-radius:8px;background:none;color:var(--text-secondary);cursor:pointer">
                    ${this._removeSvg()}
                </button>
            </div>`;
    },

    // 上传/移除后刷新槽位按钮的显隐与文案（照 Widgets._pfRefreshPosBtn，多带一个移除按钮 + 上传文案切换）
    _moRefreshSlotButtons(modal, slotKey) {
        const slotEl = modal.querySelector(`#moSlot${slotKey}`);
        const posBtn = modal.querySelector(`#moPosBtn${slotKey}`);
        const rmBtn = modal.querySelector(`#moRmBtn${slotKey}`);
        if (!slotEl) return;
        const has = !!slotEl.dataset.blobid;
        if (posBtn) posBtn.style.display = has ? 'flex' : 'none';
        if (rmBtn) rmBtn.style.display = has ? 'flex' : 'none';
        const label = slotEl.querySelector('.widget-upload-btn span');
        if (label) label.textContent = has ? I18n.t('minus_one.goods_change_btn', '更换') : I18n.t('minus_one.goods_upload_btn', '上传');
    },

    // File → Utils.readImageFile 压缩成 dataURL → Blob → IllustGallery（照 Widgets._pfHandleUpload）。
    // blobId 每次上传都新起一个（mo_goods_<slotKey>_<时间戳+随机>），不能按槽位写死：
    //  · 写死的话上传当场就覆盖了卡片正在引用的那张图，点「取消」也换不回来；
    //  · CP「左右互换」之后左槽引用的是右槽的 id，再给左边传图会把右边那张覆盖掉。
    // 本次弹窗里传过的 id 记在 _moSessionUploads，关闭/保存时没被最终数据引用到的统一回收。
    // 背景图（slotKey='bg'）覆盖整块布板、比吧唧照片大得多，压缩上限单独放宽到 1200。
    async _moHandleUpload(slotKey, file, modal) {
        if (!file || !file.type || file.type.indexOf('image/') !== 0 || !modal) return;
        if (typeof IllustGallery === 'undefined') return;
        let dataUrl;
        try {
            dataUrl = await Utils.readImageFile(file, { maxSize: slotKey === 'bg' ? 1200 : 800, quality: 0.85 });
        } catch (e) {
            Utils.showToast(I18n.t('minus_one.goods_upload_fail', '图片读取失败'));
            return;
        }
        if (!dataUrl) return;
        let blob;
        try {
            blob = await fetch(dataUrl).then(r => r.blob());
        } catch (e) {
            Utils.showToast(I18n.t('minus_one.goods_upload_fail', '图片读取失败'));
            return;
        }
        const blobId = `mo_goods_${slotKey}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        await IllustGallery.save(blobId, blob);
        this._moSessionUploads.push(blobId);
        const slotEl = modal.querySelector(`#moSlot${slotKey}`);
        if (!slotEl) return;   // 弹窗已在等待期间关闭
        slotEl.dataset.blobid = blobId;
        slotEl.removeAttribute('data-pos');
        this._moRefreshSlotButtons(modal, slotKey);
        Utils.showToast(I18n.t('minus_one.goods_upload_done', '已上传'));
    },

    _moRemoveImage(slotKey, modal) {
        const slotEl = modal.querySelector(`#moSlot${slotKey}`);
        if (!slotEl) return;
        slotEl.removeAttribute('data-blobid');
        slotEl.removeAttribute('data-pos');
        this._moRefreshSlotButtons(modal, slotKey);
    },

    // 位置定位（接 ImagePositioner，shape 恒 circle）。临时 blob URL 按 scope 登记，关闭弹窗时统一回收
    // （照 Widgets._pfOpenPositioner）。
    async _moOpenPositioner(slotKey, modal) {
        if (!modal || typeof ImagePositioner === 'undefined') return;
        return Utils.withLock(`mo-imgpos-open-${slotKey}`, async () => {
            const slotEl = modal.querySelector(`#moSlot${slotKey}`);
            if (!slotEl) return;
            const blobId = slotEl.dataset.blobid;
            if (!blobId || typeof IllustGallery === 'undefined') return;
            const blob = await IllustGallery.getBlob(blobId).catch(() => null);
            if (!blob) { Utils.showToast(I18n.t('minus_one.goods_pos_missing', '图片未找到')); return; }
            const scope = `mo-imgpos-${slotKey}`;
            Utils.revokeBlobScope(scope);
            const src = Utils.trackBlobUrl(URL.createObjectURL(blob), scope);
            let pos = null;
            if (slotEl.dataset.pos) { try { pos = JSON.parse(slotEl.dataset.pos); } catch (e) { pos = null; } }
            ImagePositioner.open({
                src, shape: 'circle', aspect: 1, pos,
                onApply: p => {
                    if (p) slotEl.dataset.pos = JSON.stringify(p);
                    else slotEl.removeAttribute('data-pos');
                }
            });
        });
    },

    // 全部 9 个可能的图片槽 key（hero/mini0~5/a/b），关闭时回收各槽定位器的临时 URL 要枚举它们
    _GOODS_ALL_SLOT_KEYS: ['hero', 'mini0', 'mini1', 'mini2', 'mini3', 'mini4', 'mini5', 'a', 'b'],

    // 小吧唧数量步进器：只切行的显隐，不动 DOM 里已经渲染好的 6 个槽位（减少数量时不删数据，
    // 只是不显示——数据本来就还在各槽位的 data-blobid/data-pos 上，压根没被动过）
    _moMiniCountChange(modal, delta) {
        if (!modal) return;
        const valEl = modal.querySelector('#moMiniCountVal');
        if (!valEl) return;
        let n = parseInt(valEl.textContent, 10) || 0;
        n = Math.max(0, Math.min(6, n + delta));
        valEl.textContent = String(n);
        modal.querySelectorAll('.mo-mini-slot-row').forEach((row, i) => {
            row.style.display = i < n ? 'flex' : 'none';
        });
    },

    // CP「左右互换」：交换 a/b 两个图片槽的 DOM 状态 + ribbonA/ribbonB 两组色板的 DOM 状态。
    // 纯数据版本见 _swapPairSides（node 测试用）；弹窗内状态活在 DOM data-* 属性上（照 editProfile
    // 系模式），所以这里直接对调 DOM 而不是调那个纯函数再整体重渲染。
    _moSwapPair(modal) {
        if (!modal) return;
        const aSlot = modal.querySelector('#moSlota');
        const bSlot = modal.querySelector('#moSlotb');
        if (aSlot && bSlot) {
            const tmpBlob = aSlot.dataset.blobid || '';
            const tmpPos = aSlot.dataset.pos || '';
            aSlot.dataset.blobid = bSlot.dataset.blobid || '';
            if (bSlot.dataset.pos) aSlot.dataset.pos = bSlot.dataset.pos; else aSlot.removeAttribute('data-pos');
            bSlot.dataset.blobid = tmpBlob;
            if (tmpPos) bSlot.dataset.pos = tmpPos; else bSlot.removeAttribute('data-pos');
            this._moRefreshSlotButtons(modal, 'a');
            this._moRefreshSlotButtons(modal, 'b');
        }
        const groupA = modal.querySelector('#moRibbonA');
        const groupB = modal.querySelector('#moRibbonB');
        if (groupA && groupB) {
            const tmpHtml = groupA.innerHTML;
            const tmpVal = groupA.dataset.value || '';
            groupA.innerHTML = groupB.innerHTML;
            groupA.dataset.value = groupB.dataset.value || '';
            groupB.innerHTML = tmpHtml;
            groupB.dataset.value = tmpVal;
        }
    },

    _moSoloFormHtml(solo, rowStyle) {
        const tagTxt = I18n.t('minus_one.goods_solo_tag', '本命');
        const ribbonLabel = I18n.t('minus_one.goods_ribbon_label', '缎带颜色');
        const heroLabel = I18n.t('minus_one.goods_hero_label', '主推吧唧');
        const minisLabel = I18n.t('minus_one.goods_minis_label', '小吧唧');
        const minisRowsHtml = [0, 1, 2, 3, 4, 5].map(i => `
            <div class="mo-mini-slot-row" style="display:${i < solo.count ? 'flex' : 'none'}">${this._moSlotHtml(`mini${i}`, solo.minis[i])}</div>`).join('');
        return `
            <div>
                <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:6px">${Utils.escapeHtml(I18n.t('minus_one.goods_field_tag', '布牌文字'))}</label>
                <input type="text" id="moSoloTag" maxlength="12" placeholder="${Utils.escapeHtml(tagTxt)}" value="${Utils.escapeHtml(solo.tag)}" style="${rowStyle}">
            </div>
            <div>
                <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:6px">${Utils.escapeHtml(ribbonLabel)}</label>
                ${this._moRibbonGroupHtml('moRibbonSolo', solo.ribbon)}
            </div>
            <div>
                <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:6px">${Utils.escapeHtml(heroLabel)}</label>
                ${this._moSlotHtml('hero', solo.hero)}
            </div>
            <div>
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
                    <label style="font-size:12px;color:var(--text-secondary)">${Utils.escapeHtml(minisLabel)}</label>
                    <div class="mo-stepper">
                        <button type="button" onclick="MinusOne._moMiniCountChange(this.closest('.modal-overlay'),-1)">${this._minusSvg()}</button>
                        <span id="moMiniCountVal">${solo.count}</span>
                        <button type="button" onclick="MinusOne._moMiniCountChange(this.closest('.modal-overlay'),1)">${this._plusSvg()}</button>
                    </div>
                </div>
                <div id="moMiniSlots" style="display:flex;flex-direction:column;gap:6px">${minisRowsHtml}</div>
            </div>`;
    },

    _moPairFormHtml(pair, rowStyle) {
        const tagTxt = I18n.t('minus_one.goods_pair_tag', '一对');
        const slotALabel = I18n.t('minus_one.goods_slot_a', '左侧');
        const slotBLabel = I18n.t('minus_one.goods_slot_b', '右侧');
        const swapTxt = I18n.t('minus_one.goods_swap_btn', '左右互换');
        return `
            <div>
                <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:6px">${Utils.escapeHtml(I18n.t('minus_one.goods_field_tag', '布牌文字'))}</label>
                <input type="text" id="moPairTag" maxlength="12" placeholder="${Utils.escapeHtml(tagTxt)}" value="${Utils.escapeHtml(pair.tag)}" style="${rowStyle}">
            </div>
            <div style="display:flex;gap:12px">
                <div style="flex:1;min-width:0">
                    <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:6px">${Utils.escapeHtml(slotALabel)}</label>
                    ${this._moRibbonGroupHtml('moRibbonA', pair.ribbonA)}
                    <div style="margin-top:8px">${this._moSlotHtml('a', pair.a)}</div>
                </div>
                <div style="flex:1;min-width:0">
                    <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:6px">${Utils.escapeHtml(slotBLabel)}</label>
                    ${this._moRibbonGroupHtml('moRibbonB', pair.ribbonB)}
                    <div style="margin-top:8px">${this._moSlotHtml('b', pair.b)}</div>
                </div>
            </div>
            <button type="button" onclick="MinusOne._moSwapPair(this.closest('.modal-overlay'))"
                    style="display:flex;align-items:center;justify-content:center;gap:6px;padding:8px;border:1px solid var(--border-light);border-radius:8px;background:none;color:var(--text-secondary);font-size:12px;cursor:pointer">
                ${this._swapSvg()}${Utils.escapeHtml(swapTxt)}
            </button>`;
    },

    // 预设背景缩略图：每个 preset 一个方形小格，用它的 solo 图当缩略图（css 里 background-size:cover
    // 裁成方形，即便 pair 图更宽也不会露白边），选中态描边。
    _moBgPresetThumbsHtml(selectedId) {
        return this._GOODS_BG_PRESETS.map(p => {
            const name = I18n.t(p.nameKey, p.id);
            const active = selectedId === p.id;
            return `<button type="button" class="mo-bg-preset-thumb${active ? ' active' : ''}" data-val="${Utils.escapeHtml(p.id)}"
                    style="background-image:url('${p.thumb}')" title="${Utils.escapeHtml(name)}" onclick="MinusOne._moBgPresetPick(this)">
                <span class="mo-bg-preset-name">${Utils.escapeHtml(name)}</span>
            </button>`;
        }).join('');
    },
    _moBgPresetPick(btn) {
        Widgets._noteChipPick(btn);
        const group = btn.closest('.mo-bg-preset-group');
        if (group) group.dataset.value = btn.dataset.val || '';
    },

    // 背景「波点 / 预设图 / 自己的图」三选一：组内互斥高亮 + 联动显隐三套子区（照 _moLayoutPick 的模式）
    _moBgTypePick(btn) {
        Widgets._noteChipPick(btn);
        const group = btn.closest('.mo-bg-type-group');
        const modal = btn.closest('.modal-overlay');
        if (group) group.dataset.value = btn.dataset.val;
        if (!modal) return;
        const val = btn.dataset.val;
        const dotsBox = modal.querySelector('#moBgDots');
        const presetBox = modal.querySelector('#moBgPreset');
        const uploadBox = modal.querySelector('#moBgUpload');
        if (dotsBox) dotsBox.style.display = val === 'dots' ? 'block' : 'none';
        if (presetBox) presetBox.style.display = val === 'preset' ? 'block' : 'none';
        if (uploadBox) uploadBox.style.display = val === 'upload' ? 'block' : 'none';
    },

    // 背景一节：solo/pair 共用一份设置，放在布局单选之后、两套表单区之前（editGoods 里拼装）
    _moBgSectionHtml(bg) {
        const label = I18n.t('minus_one.goods_bg_label', '背景');
        const dotsLabel = I18n.t('minus_one.goods_bg_type_dots', '波点');
        const presetLabel = I18n.t('minus_one.goods_bg_type_preset', '预设图');
        const uploadLabel = I18n.t('minus_one.goods_bg_type_upload', '自己的图');
        const type = bg.type;
        return `
            <div>
                <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:6px">${Utils.escapeHtml(label)}</label>
                <div class="mo-edit-layout-group mo-bg-type-group" data-value="${Utils.escapeHtml(type)}">
                    <button type="button" class="mo-edit-layout-opt${type === 'dots' ? ' active' : ''}" data-val="dots" onclick="MinusOne._moBgTypePick(this)">${Utils.escapeHtml(dotsLabel)}</button>
                    <button type="button" class="mo-edit-layout-opt${type === 'preset' ? ' active' : ''}" data-val="preset" onclick="MinusOne._moBgTypePick(this)">${Utils.escapeHtml(presetLabel)}</button>
                    <button type="button" class="mo-edit-layout-opt${type === 'upload' ? ' active' : ''}" data-val="upload" onclick="MinusOne._moBgTypePick(this)">${Utils.escapeHtml(uploadLabel)}</button>
                </div>
                <div id="moBgDots" style="display:${type === 'dots' ? 'block' : 'none'};margin-top:8px">
                    ${this._moRibbonGroupHtml('moBgColor', bg.color)}
                </div>
                <div id="moBgPreset" style="display:${type === 'preset' ? 'block' : 'none'};margin-top:8px">
                    <div class="mo-bg-preset-group" data-value="${Utils.escapeHtml(bg.preset)}">${this._moBgPresetThumbsHtml(bg.preset)}</div>
                </div>
                <div id="moBgUpload" style="display:${type === 'upload' ? 'block' : 'none'};margin-top:8px">
                    ${this._moBgUploadSlotHtml(bg.image)}
                </div>
            </div>`;
    },

    // 布局单选（单推/CP）：组内互斥高亮复用 Widgets._noteChipPick，再联动显隐下面两套表单区
    // （照 Widgets._pfLayoutPick 的模式）
    _moLayoutPick(btn) {
        Widgets._noteChipPick(btn);
        const modal = btn.closest('.modal-overlay');
        if (!modal) return;
        const val = btn.dataset.val;
        const soloBox = modal.querySelector('#moEditSolo');
        const pairBox = modal.querySelector('#moEditPair');
        if (soloBox) soloBox.style.display = val === 'pair' ? 'none' : 'flex';
        if (pairBox) pairBox.style.display = val === 'pair' ? 'flex' : 'none';
    },

    // 配置弹窗：点布板任意位置打开（对齐 editProfile 交互）
    editGoods() {
        const goods = this._goodsData();
        const layout = goods.layout;
        const rowStyle = 'width:100%;padding:10px 12px;border:1px solid var(--border-medium);border-radius:8px;font-size:14px;background:var(--bg-base);color:var(--text-primary)';
        const editTitle = I18n.t('minus_one.goods_edit_title', '编辑周边展示');
        const soloLabel = I18n.t('minus_one.goods_layout_solo', '单推');
        const pairLabel = I18n.t('minus_one.goods_layout_pair', 'CP');

        // 孤儿回收的账本：打开时数据里引用着的图 + 本次弹窗里新传的图（见 _moCleanupOrphanUploads）
        this._moPrevRefs = this._goodsRefIds(goods);
        this._moSessionUploads = [];

        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)';
        modal.onclick = e => { if (e.target === modal) MinusOne._moCloseModal(modal); };
        modal.innerHTML = `
            <div class="modal-window" style="gap:12px;max-height:85vh;overflow-y:auto">
                <h3 style="margin:0;font-size:17px;font-weight:600">${Utils.escapeHtml(editTitle)}</h3>
                <div class="mo-edit-layout-group" id="moLayoutGroup">
                    <button type="button" class="mo-edit-layout-opt${layout === 'solo' ? ' active' : ''}" data-val="solo" onclick="MinusOne._moLayoutPick(this)">${Utils.escapeHtml(soloLabel)}</button>
                    <button type="button" class="mo-edit-layout-opt${layout === 'pair' ? ' active' : ''}" data-val="pair" onclick="MinusOne._moLayoutPick(this)">${Utils.escapeHtml(pairLabel)}</button>
                </div>
                ${this._moBgSectionHtml(goods.bg)}
                <div id="moEditSolo" style="display:${layout === 'pair' ? 'none' : 'flex'};flex-direction:column;gap:12px">
                    ${this._moSoloFormHtml(goods.solo, rowStyle)}
                </div>
                <div id="moEditPair" style="display:${layout === 'pair' ? 'flex' : 'none'};flex-direction:column;gap:12px">
                    ${this._moPairFormHtml(goods.pair, rowStyle)}
                </div>
                <div style="display:flex;gap:8px;margin-top:4px">
                    <button onclick="MinusOne._moCloseModal(this.closest('.modal-overlay'))"
                            style="flex:1;padding:10px;border:1px solid var(--border-medium);border-radius:8px;background:none;color:var(--text-primary);font-size:14px;cursor:pointer">${I18n.t('btn.cancel', '取消')}</button>
                    <button onclick="MinusOne._moSave(this.closest('.modal-overlay'))"
                            style="flex:1;padding:10px;border:none;border-radius:8px;background:var(--accent-color);color:#fff;font-size:14px;font-weight:600;cursor:pointer">${I18n.t('btn.confirm', '确定')}</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
    },

    // 数据里当前引用着的全部 blobId（纯数据函数，node 测试直测）。背景图也走同一个孤儿回收账本——
    // 换预设图/切回波点/换传别的图之后，被换掉的旧 blobId 要能被 _moCleanupOrphanUploads 收掉。
    _goodsRefIds(goods) {
        const g = goods || {};
        const solo = g.solo || {}, pair = g.pair || {}, bg = g.bg || {};
        const refs = [solo.hero].concat(Array.isArray(solo.minis) ? solo.minis : [], [pair.a, pair.b, bg.image]);
        return refs.filter(r => r && r.blobId).map(r => r.blobId);
    },

    _moPrevRefs: [],
    _moSessionUploads: [],

    // orphan 清理（照 Widgets._pfCleanupOrphanUploads）。候选 = 打开弹窗时引用着的图 + 本次弹窗里新传的图，
    // 其中最终数据没再引用的删掉：取消 → 新传的全回收、旧图原样；确定 → 被换掉/移除的旧图回收。
    _moCleanupOrphanUploads() {
        const candidates = this._moPrevRefs.concat(this._moSessionUploads);
        this._moPrevRefs = [];
        this._moSessionUploads = [];
        if (typeof IllustGallery === 'undefined' || !IllustGallery.remove) return;
        const kept = new Set(this._goodsRefIds(this._goodsData()));
        candidates.forEach(id => { if (!kept.has(id)) IllustGallery.remove(id).catch(() => {}); });
    },

    // 统一关闭出口（背景点击/取消按钮都走这里）：回收全部图片定位器的临时 blob URL + 清孤儿上传
    _moCloseModal(modal) {
        this._GOODS_ALL_SLOT_KEYS.forEach(k => Utils.revokeBlobScope(`mo-imgpos-${k}`));
        this._moCleanupOrphanUploads();
        if (modal) modal.remove();
    },

    // 确定：一次性从 DOM 读出全部字段 → 写入 AppState.data.minusOne.goods → Utils.saveData() →
    // MinusOne.refresh() → 关弹窗
    _moSave(modal) {
        if (!modal) return;
        const buildRef = slotKey => {
            const slotEl = modal.querySelector(`#moSlot${slotKey}`);
            if (!slotEl) return null;
            const blobId = slotEl.dataset.blobid;
            if (!blobId) return null;
            let pos = null;
            if (slotEl.dataset.pos) { try { pos = JSON.parse(slotEl.dataset.pos); } catch (e) { pos = null; } }
            const ref = { blobId };
            if (pos) ref.pos = pos;
            return ref;
        };

        // 用 id 限定在布局单选自己的容器里找 active——背景类型单选（.mo-bg-type-group）复用了同一套
        // chip 视觉类名（.mo-edit-layout-opt），不加限定的话 querySelector 只认文档序的第一个，靠 DOM
        // 顺序摸彩不如直接锁死容器稳妥。
        const layoutActive = modal.querySelector('#moLayoutGroup .mo-edit-layout-opt.active');
        const layout = (layoutActive && layoutActive.dataset.val === 'pair') ? 'pair' : 'solo';

        const soloTagEl = modal.querySelector('#moSoloTag');
        const ribbonSoloGroup = modal.querySelector('#moRibbonSolo');
        const countEl = modal.querySelector('#moMiniCountVal');
        const solo = {
            tag: ((soloTagEl && soloTagEl.value) || '').trim().slice(0, 12),
            ribbon: (ribbonSoloGroup && ribbonSoloGroup.dataset.value) || '',
            count: Math.max(0, Math.min(6, parseInt(countEl && countEl.textContent, 10) || 0)),
            hero: buildRef('hero'),
            minis: [0, 1, 2, 3, 4, 5].map(i => buildRef(`mini${i}`))
        };

        const pairTagEl = modal.querySelector('#moPairTag');
        const ribbonAGroup = modal.querySelector('#moRibbonA');
        const ribbonBGroup = modal.querySelector('#moRibbonB');
        const pair = {
            tag: ((pairTagEl && pairTagEl.value) || '').trim().slice(0, 12),
            ribbonA: (ribbonAGroup && ribbonAGroup.dataset.value) || '',
            ribbonB: (ribbonBGroup && ribbonBGroup.dataset.value) || '',
            a: buildRef('a'),
            b: buildRef('b')
        };

        const bgTypeGroup = modal.querySelector('.mo-bg-type-group');
        const bgColorGroup = modal.querySelector('#moBgColor');
        const bgPresetGroup = modal.querySelector('.mo-bg-preset-group');
        const bgType = (bgTypeGroup && bgTypeGroup.dataset.value) || 'dots';
        const bg = {
            type: (bgType === 'preset' || bgType === 'upload') ? bgType : 'dots',
            color: (bgColorGroup && bgColorGroup.dataset.value) || '',
            preset: (bgPresetGroup && bgPresetGroup.dataset.value) || '',
            image: buildRef('bg')
        };

        const goods = this._goodsData();
        goods.layout = layout;
        goods.solo = solo;
        goods.pair = pair;
        goods.bg = bg;

        this._GOODS_ALL_SLOT_KEYS.forEach(k => Utils.revokeBlobScope(`mo-imgpos-${k}`));
        Utils.saveData();
        this._moCleanupOrphanUploads();
        this.refresh();
        modal.remove();
    },

    // ══════════════════════════════════════
    // 卡片增减/排序 —— 编辑弹窗（照 editGoods 的弹窗写法）
    // ══════════════════════════════════════

    _moveUpSvg() {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>`;
    },
    _moveDownSvg() {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`;
    },

    // 卡 id → 卡名的 i18n key/默认文案，复用三张卡各自标题用的那把 key（周边展示卡不分单推/CP，
    // 组件名恒用 goods_solo_title）
    _CARD_NAME_I18N: {
        novels: ['minus_one.novels_title', '收藏的小说'],
        threads: ['minus_one.threads_title', '收藏的帖子'],
        goods: ['minus_one.goods_solo_title', '周边展示']
    },

    // 一行 = 卡名 + 上移/下移（到头禁用）+ 显示开关（复用项目里现成的 .wb-toggle）。状态全活在 DOM 上，
    // 拖不动数据，「确定」时才从 DOM 一次性读出。
    _moCardRowHtml(id, on, idx, total) {
        const [key, fallback] = this._CARD_NAME_I18N[id] || [null, id];
        const name = key ? I18n.t(key, fallback) : fallback;
        const upTitle = I18n.t('minus_one.manage_move_up', '上移');
        const downTitle = I18n.t('minus_one.manage_move_down', '下移');
        return `<div class="mo-manage-row" data-card-id="${Utils.escapeHtml(id)}">
            <span class="mo-manage-name">${Utils.escapeHtml(name)}</span>
            <div class="mo-manage-actions">
                <button type="button" class="mo-manage-move" data-dir="up" title="${Utils.escapeHtml(upTitle)}" ${idx === 0 ? 'disabled' : ''} onclick="MinusOne._moCardMove(this,-1)">${this._moveUpSvg()}</button>
                <button type="button" class="mo-manage-move" data-dir="down" title="${Utils.escapeHtml(downTitle)}" ${idx === total - 1 ? 'disabled' : ''} onclick="MinusOne._moCardMove(this,1)">${this._moveDownSvg()}</button>
                <label class="wb-toggle">
                    <input type="checkbox" ${on ? 'checked' : ''}>
                    <span class="wb-toggle-slider"></span>
                </label>
            </div>
        </div>`;
    },

    // 上移/下移：直接挪 DOM 节点顺序（不重渲染整个列表，省得开关状态跟着丢），挪完重新算每行的
    // 首/末态刷新禁用按钮
    _moCardMove(btn, delta) {
        const row = btn.closest('.mo-manage-row');
        const list = row && row.parentElement;
        if (!row || !list) return;
        const rows = Array.from(list.children);
        const idx = rows.indexOf(row);
        const targetIdx = idx + delta;
        if (targetIdx < 0 || targetIdx >= rows.length) return;
        if (delta < 0) list.insertBefore(row, rows[targetIdx]);
        else list.insertBefore(rows[targetIdx], row);
        this._moRefreshCardMoveButtons(list);
    },
    _moRefreshCardMoveButtons(list) {
        const rows = Array.from(list.children);
        rows.forEach((r, i) => {
            const up = r.querySelector('.mo-manage-move[data-dir="up"]');
            const down = r.querySelector('.mo-manage-move[data-dir="down"]');
            if (up) up.disabled = i === 0;
            if (down) down.disabled = i === rows.length - 1;
        });
    },

    // 「编辑负一屏」弹窗：点底部小药丸打开
    editCards() {
        const cards = this._cardsData();
        const editTitle = I18n.t('minus_one.manage_title', '编辑负一屏');
        const rowsHtml = cards.map((c, i) => this._moCardRowHtml(c.id, c.on, i, cards.length)).join('');

        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)';
        modal.onclick = e => { if (e.target === modal) modal.remove(); };
        modal.innerHTML = `
            <div class="modal-window" style="gap:12px;max-height:85vh;overflow-y:auto">
                <h3 style="margin:0;font-size:17px;font-weight:600">${Utils.escapeHtml(editTitle)}</h3>
                <div id="moCardsList" style="display:flex;flex-direction:column;gap:8px">${rowsHtml}</div>
                <div style="display:flex;gap:8px;margin-top:4px">
                    <button onclick="this.closest('.modal-overlay').remove()"
                            style="flex:1;padding:10px;border:1px solid var(--border-medium);border-radius:8px;background:none;color:var(--text-primary);font-size:14px;cursor:pointer">${I18n.t('btn.cancel', '取消')}</button>
                    <button onclick="MinusOne._moCardsSave(this.closest('.modal-overlay'))"
                            style="flex:1;padding:10px;border:none;border-radius:8px;background:var(--accent-color);color:#fff;font-size:14px;font-weight:600;cursor:pointer">${I18n.t('btn.confirm', '确定')}</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
    },

    // 确定：按当前 DOM 顺序 + 各行开关状态一次性写回 → Utils.saveData() → refresh()；取消（上面按钮
    // 直接 modal.remove()，不走这里）不碰数据
    _moCardsSave(modal) {
        if (!modal) return;
        const rows = Array.from(modal.querySelectorAll('#moCardsList .mo-manage-row'));
        const cards = rows.map(r => ({
            id: r.getAttribute('data-card-id'),
            on: !!r.querySelector('input[type="checkbox"]').checked
        }));

        let data = null;
        try { data = (typeof AppState !== 'undefined' && AppState.data) ? AppState.data : null; } catch (e) { data = null; }
        if (data) {
            const mo = (data.minusOne && typeof data.minusOne === 'object') ? data.minusOne : (data.minusOne = {});
            mo.cards = cards;
        }
        Utils.saveData();
        this.refresh();
        modal.remove();
    }
};
