// Mercari（メルカリ）二手市场模块
const Mercari = {
  currentScreen: 'home',   // 'home' | 'detail' | 'ranking' | 'search' | 'favorites' | 'settings'
  currentListingId: null,

  // ── 数据初始化 ──
  _ensureData() {
    const d = AppState.data;
    if (!d.mercariData) d.mercariData = {};
    const m = d.mercariData;
    if (!Array.isArray(m.listings)) m.listings = [];
    if (!Array.isArray(m.manualEvents)) m.manualEvents = [];
    if (!Array.isArray(m.favorites)) m.favorites = [];
    if (!m.settings) m.settings = {};
    if (!m.settings.generationMode) m.settings.generationMode = 'lazy';
    if (!m.settings.apiOverride) m.settings.apiOverride = { enabled:false, baseUrl:'', apiKey:'', model:'' };
    if (m.lastRefreshPlotId === undefined) m.lastRefreshPlotId = null;
    return m;
  },

  // ── 角色名册：所有声优 voicedCharacters 并集去重 ──
  characterList() {
    const npcs = (AppState.data.broadcast && AppState.data.broadcast.officialNpcs) || [];
    const set = new Set();
    npcs.forEach(n => (n.voicedCharacters || []).forEach(c => {
      const t = String(c || '').trim();
      if (t) set.add(t);
    }));
    return [...set].sort();
  },

  // 行情榜 / 搜索 chip 的角色全集 = 声优绑定角色 ∪ 盲盒填入的角色（含没配声优的冷门角色）
  _allMarketChars() {
    const set = new Set(this.characterList());
    this._listedGoods().forEach(e => {
      if (e.goods.blindBox) (e.goods.charNames || []).forEach(c => {
        const t = String(c || '').trim(); if (t) set.add(t);
      });
    });
    return [...set].sort();
  },

  // ── 当前 CP（v2.69.0: 内部实现迁移到 Broadcast.getCP()，对外保持 {a,b,nickname}/null 契约）──
  getCP() {
    const info = Broadcast.getCP();
    if (!info.hasCP) return null;
    return {
      a: info.cpCharA,
      b: info.cpCharB,
      nickname: info.cpNickname || `${info.cpCharA}×${info.cpCharB}`
    };
  },

  // ── 在售周边（工程① status=贩售中 的 goods 条目）──
  _listedGoods() {
    const infos = (AppState.data.broadcast && AppState.data.broadcast.officialInfo) || [];
    return infos.filter(e => e.category === 'goods' && e.goods && e.goods.status === '贩售中');
  },
  _goodsById(id) {
    return this._listedGoods().find(e => e.id === id) || null;
  },

  // 收口：转发 Utils.escapeHtml（语义与原实现完全相同）
  _escapeHtml(s) {
    return Utils.escapeHtml(s);
  },

  // ── i18n 显示辅助（用于 condition/rarity 这种存储为日文 key 的值在显示时翻译）──
  // 数据保存日文 key（'通常'/'限定'/'特典'、'新品、未使用' 等），仅显示时映射
  _conditionLabel(c) {
    const map = {
      '新品、未使用': I18n.t('mc.condition_new', '新品、未使用'),
      '未使用に近い': I18n.t('mc.condition_near_new', '未使用に近い'),
      '目立った傷や汚れなし': I18n.t('mc.condition_no_damage', '目立った傷や汚れなし'),
      'やや傷や汚れあり': I18n.t('mc.condition_slight_damage', 'やや傷や汚れあり')
    };
    return map[c] || c || '';
  },
  _rarityLabel(r) {
    const map = {
      '通常': I18n.t('mc.rarity_normal', '通常'),
      '限定': I18n.t('mc.rarity_limited', '限定'),
      '特典': I18n.t('mc.rarity_bonus', '特典')
    };
    return map[r] || r || '';
  },

  // ── 价格引擎 ──
  _RARITY_MULT: { '通常': 1.0, '限定': 2.5, '特典': 4.0 },

  _textOf(obj, keys) {
    return keys.map(k => obj && obj[k] ? String(obj[k]) : '').join(' ');
  },

  // 角色热度系数（0.7–4.0）
  _characterHeat(charName) {
    if (!charName) return 1.0;
    const goodsOwn = this._listedGoods()
      .filter(e => (e.goods.charNames || []).includes(charName)).length;
    const plots = (AppState.data.broadcast && AppState.data.broadcast.plotProgress) || [];
    let plotScore = 0;
    plots.forEach((p, i) => {
      if (this._textOf(p, ['title','content','summary']).includes(charName)) {
        plotScore += 1 + (plots.length ? i / plots.length : 0);  // 近期节点加权更高
      }
    });
    const infos = (AppState.data.broadcast && AppState.data.broadcast.officialInfo) || [];
    const infoScore = infos.filter(e =>
      this._textOf(e, ['title','content']).includes(charName)).length;
    const raw = goodsOwn * 1.0 + plotScore * 0.6 + infoScore * 0.3;
    return Math.max(0.7, Math.min(4.0, 0.7 + raw * 0.3));
  },

  // 单款二手均价：盲盒传 variantChar → 用该角色单独热度（人气炒高/冷门贱卖）；
  // 普通周边 variantChar 为空 → 取 charNames 最高热度（原行为）
  _avgPriceFor(goodsEntry, variantChar) {
    const g = goodsEntry.goods;
    const rarityMult = this._RARITY_MULT[g.rarity] || 1.0;
    let heat;
    if (g.blindBox && variantChar) {
      heat = this._characterHeat(variantChar);
    } else {
      const chars = g.charNames || [];
      heat = chars.length ? Math.max(...chars.map(c => this._characterHeat(c))) : 1.0;
    }
    return this._roundPrice((g.price || 0) * rarityMult * heat);
  },
  // 兼容旧调用：系列级代表均价（普通周边原样；盲盒返回全员最高热度款）
  _goodsAvgPrice(goodsEntry) {
    return this._avgPriceFor(goodsEntry, null);
  },

  // 出品个体价（按卖家类型散开）
  _listingPrice(avgPrice, sellerType) {
    let f;
    if (sellerType === 'scalper')          f = 2.0 + Math.random() * 3.0;
    else if (sellerType === 'counterfeit') f = 0.7 + Math.random() * 0.4;
    else f = (Math.random() < 0.15) ? (0.5 + Math.random() * 0.2)   // 急售低价
                                    : (0.8 + Math.random() * 0.5);  // 普通
    return this._roundPrice(avgPrice * f);
  },

  _roundPrice(n) {
    n = Math.max(0, n);
    if (n >= 10000) return Math.round(n / 1000) * 1000;
    if (n >= 1000)  return Math.round(n / 100) * 100;
    return Math.round(n / 10) * 10;
  },

  // ── 出品骨架生成（规则，免费、即时）──
  _SELLER_NAMES: ['みかん','グッズ整理中','推し変したので','匿名希望','こてつ',
    'おかし','グッズ処分垢','ぬい','まろん','即購入OK','断捨離','ゆきうさぎ'],
  _CONDITIONS: ['新品、未使用','未使用に近い','目立った傷や汚れなし','やや傷や汚れあり'],
  _pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },

  // 当前剧情节点数（用于售罄比例与 createdAtPlotId）
  _currentPlotCount() {
    const p = (AppState.data.broadcast && AppState.data.broadcast.plotProgress) || [];
    return p.length;
  },
  // 某剧情节点在 plotProgress 中的序号（-1 表示未找到）
  _plotIndexOf(plotId) {
    const p = (AppState.data.broadcast && AppState.data.broadcast.plotProgress) || [];
    return p.findIndex(x => x.id === plotId);
  },

  // 单个周边的出品生成
  // 盲盒：对 charNames 每个角色款各展开一批（listing 带 variantChar）；普通周边整体一批
  _generateListingsForGoods(goodsEntry) {
    const g = goodsEntry.goods;
    if (g.blindBox && (g.charNames || []).length) {
      const out = [];
      g.charNames.forEach(ch => out.push(...this._genVariantListings(goodsEntry, ch)));
      return out;
    }
    return this._genVariantListings(goodsEntry, null);
  },

  // 为单个款生成一批出品（variantChar=盲盒角色款 / null=普通周边整体）
  _genVariantListings(goodsEntry, variantChar) {
    const g = goodsEntry.goods;
    const avg = this._avgPriceFor(goodsEntry, variantChar);
    const heat = variantChar
      ? this._characterHeat(variantChar)
      : ((g.charNames || []).length ? Math.max(...g.charNames.map(c => this._characterHeat(c))) : 1.0);

    // 出品数：基础 + 稀缺度加成 + 热度加成；盲盒单款基数低（每款分摊，热门角自然多）
    const rarityBonus = g.rarity === '特典' ? 3 : g.rarity === '限定' ? 2 : 0;
    const heatBonus = Math.round((heat - 1) * 2);
    const base = g.blindBox ? 1 + Math.floor(Math.random() * 3) : 3 + Math.floor(Math.random() * 3);
    const n = Math.max(1, base + rarityBonus + heatBonus);

    // 坏人概率：越贵越抢手越多
    const heatNorm = Math.min(1, (heat - 0.7) / 3.3);
    const scalperP = 0.05 + rarityBonus * 0.08 + heatNorm * 0.15;   // 黄牛
    const fakeP    = 0.02 + rarityBonus * 0.04 + heatNorm * 0.06;   // 假货

    // 售罄比例：周边发售越久、越热，sold 越多（新周边几乎全 on_sale）
    const relIdx = goodsEntry.afterPlotId != null ? this._plotIndexOf(goodsEntry.afterPlotId) : -1;
    const ageRatio = relIdx >= 0
      ? Math.min(1, (this._currentPlotCount() - 1 - relIdx) / 6)
      : 0;
    const soldRatio = Math.min(0.6, ageRatio * (0.3 + heatNorm * 0.4));

    const out = [];
    for (let i = 0; i < n; i++) {
      const r = Math.random();
      const type = r < fakeP ? 'counterfeit' : (r < fakeP + scalperP ? 'scalper' : 'normal');
      out.push(this._buildListing(goodsEntry, avg, type, variantChar,
        (Math.random() < soldRatio) ? 'sold' : 'on_sale'));
    }

    // まとめ売り：盲盒冷门角色（热度低）偶尔被多件打包甩卖（大毒池真实现象）
    if (g.blindBox && variantChar && heat <= 1.0 && Math.random() < 0.5) {
      out.push(this._buildBundleListing(goodsEntry, variantChar));
    }
    return out;
  },

  // 构造单件出品骨架（盲盒带 variantChar；status 默认 on_sale）
  _buildListing(goodsEntry, avg, type, variantChar, status) {
    return {
      id: Utils.generateId(),
      goodsEntryId: goodsEntry.id,
      variantChar: variantChar || null,
      sellerName: this._pick(this._SELLER_NAMES),
      sellerType: type,
      sellerRating: { stars: 3 + Math.floor(Math.random() * 3),
                      count: 5 + Math.floor(Math.random() * 250) },
      condition: this._pick(this._CONDITIONS),
      price: this._listingPrice(avg, type),
      status: status || 'on_sale',
      flaggedFake: false,
      eventTag: null,
      createdAtPlotId: this._currentPlotCount(),
      aiGenerated: false,
      sellerIntro: '',
      comments: []
    };
  },

  // まとめ売り：冷门角色多件打包款（一口价、明显折扣）
  _buildBundleListing(goodsEntry, variantChar) {
    const avg = this._avgPriceFor(goodsEntry, variantChar);
    const qty = 3 + Math.floor(Math.random() * 4);          // 3–6 点
    const l = this._buildListing(goodsEntry, avg, 'normal', variantChar, 'on_sale');
    l.bundleQty = qty;
    l.price = this._roundPrice(avg * qty * (0.45 + Math.random() * 0.2)); // 打包甩卖折扣
    l.condition = '目立った傷や汚れなし';
    return l;
  },

  // 首次填充全部在售周边
  _seedAllListings() {
    const m = this._ensureData();
    this._listedGoods().forEach(ge => {
      if (!m.listings.some(l => l.goodsEntryId === ge.id)) {
        m.listings.push(...this._generateListingsForGoods(ge));
      }
    });
    Utils.saveData();
  },

  // ── 剧情刷新联动 ──
  onPlotPublished(plotId) {
    const m = this._ensureData();
    const goods = this._listedGoods();

    // 1. 上新：新进入贩售中的周边生成出品
    goods.forEach(ge => {
      if (!m.listings.some(l => l.goodsEntryId === ge.id)) {
        m.listings.push(...this._generateListingsForGoods(ge));
      }
    });

    // 2. 重算价格 + 3. 价格明显变动则 AI 缓存失效（盲盒按单款 variantChar；まとめ売り款跳过）
    goods.forEach(ge => {
      m.listings.filter(l => l.goodsEntryId === ge.id && l.status === 'on_sale' && !l.bundleQty)
        .forEach(l => {
          const avg = this._avgPriceFor(ge, l.variantChar);
          const np = this._listingPrice(avg, l.sellerType);
          if (l.price > 0 && Math.abs(np - l.price) / l.price > 0.1) {
            l._prevPrice = l.price;            // 供涨幅榜用
            l.price = np;
            l.aiGenerated = false; l.sellerIntro = ''; l.comments = [];
          }
        });
    });

    // 4. 推进售罄：on_sale 出品按热度小比例转 sold（盲盒按单款热度）
    goods.forEach(ge => {
      m.listings.filter(l => l.goodsEntryId === ge.id && l.status === 'on_sale')
        .forEach(l => {
          const heatNorm = Math.min(1, (this._avgPriceFor(ge, l.variantChar) /
            Math.max(1,(ge.goods.price||1)) - 1) / 4);
          if (Math.random() < 0.1 + heatNorm * 0.2) l.status = 'sold';
        });
    });

    m.lastRefreshPlotId = plotId;
    if (m.settings.generationMode === 'preload') this._preloadAll();
    Utils.saveData();
  },

  // ── 手动刷新市场（首页「市場を更新」按钮）──
  // 模拟真实フリマ的流动：上新（新卖家挂出）+ 售出（SOLD）+ 价格波动。
  // 与 onPlotPublished 的区别：不依赖剧情、不动 lastRefreshPlotId，是日常小波动。
  refreshMarket() {
    const m = this._ensureData();
    const goods = this._listedGoods();
    if (!goods.length) {
      (Utils.toast || Utils.showToast || function(){}).call(Utils, I18n.t('t.mc_no_goods_on_sale', '在售の周边がまだありません'));
      return;
    }
    let added = 0, sold = 0;

    // 1. 补全还没出品的新周边
    goods.forEach(ge => {
      if (!m.listings.some(l => l.goodsEntryId === ge.id)) {
        const list = this._generateListingsForGoods(ge);
        m.listings.push(...list); added += list.length;
      }
    });

    // 2. 上新：每个周边小概率有新卖家挂出 1–2 件（盲盒：每件随机一个角色款）
    goods.forEach(ge => {
      if (Math.random() < 0.55) {
        const cnt = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < cnt; i++) {
          const r = Math.random();
          const type = r < 0.05 ? 'counterfeit' : (r < 0.18 ? 'scalper' : 'normal');
          const vc = this._pickVariant(ge);
          const avg = this._avgPriceFor(ge, vc);
          m.listings.push(this._makeListing(ge, avg, type, vc));
          added++;
        }
      }
    });

    // 3. 售出：在售出品小概率被买走
    m.listings.filter(l => l.status === 'on_sale').forEach(l => {
      if (Math.random() < 0.12) { l.status = 'sold'; sold++; }
    });

    // 4. 价格波动：部分在售出品重新定价（明显变动则 AI 缓存失效）
    //    盲盒按单款均价（l.variantChar）；まとめ売り打包款不参与单件重定价
    goods.forEach(ge => {
      m.listings.filter(l => l.goodsEntryId === ge.id && l.status === 'on_sale' && !l.bundleQty)
        .forEach(l => {
          if (Math.random() < 0.3) {
            const avg = this._avgPriceFor(ge, l.variantChar);
            const np = this._listingPrice(avg, l.sellerType);
            if (l.price > 0 && Math.abs(np - l.price) / l.price > 0.08) {
              l._prevPrice = l.price; l.price = np;
              l.aiGenerated = false; l.sellerIntro = ''; l.comments = [];
            }
          }
        });
    });

    Utils.saveData();
    this.currentScreen = 'home';
    this.render();
    (Utils.toast || Utils.showToast || function(){}).call(Utils,
      I18n.t('t.mc_market_refreshed', {added: added, sold: sold}));
  },

  // 生成单个出品骨架（refreshMarket 上新用）
  _makeListing(ge, avg, type, variantChar) {
    return this._buildListing(ge, avg, type, variantChar || null, 'on_sale');
  },

  // 盲盒某周边随机挑一个角色款（上新/事件时给单件指定 variantChar）；非盲盒返回 null
  _pickVariant(ge) {
    const g = ge.goods;
    if (!g.blindBox) return null;
    const chars = g.charNames || [];
    return chars.length ? this._pick(chars) : null;
  },

  _preloadAll() {
    const m = this._ensureData();
    const todo = m.listings.filter(l => l.status === 'on_sale' && !l.aiGenerated);
    // 顺序生成，避免并发打满 API
    const run = (i) => {
      if (i >= todo.length) return;
      this.generateListingContent(todo[i]).catch(()=>{}).finally(() => run(i + 1));
    };
    run(0);
  },

  // ── 入口 ──
  init() {
    this._ensureData();
    this.currentScreen = 'home';
    this._seedAllListings();
    this.render();
  },

  render() {
    const root = document.getElementById('mercari-body');
    if (!root) return;
    if (this.currentScreen === 'home')      root.innerHTML = this._renderHome();
    else if (this.currentScreen === 'detail')   root.innerHTML = this._renderDetail();
    else if (this.currentScreen === 'ranking')  root.innerHTML = this._renderRanking();
    else if (this.currentScreen === 'search')   root.innerHTML = this._renderSearch();
    else if (this.currentScreen === 'favorites')root.innerHTML = this._renderFavorites();
    else if (this.currentScreen === 'settings') root.innerHTML = this._renderSettings();
    this._loadGoodsImages(root);  // 回填官方周边商品图（卡片 + 详情）
  },

  // 懒填已生成的周边商品图 src（仿 Forum._loadGoodsImages）
  async _loadGoodsImages(container) {
    if (!container || typeof IllustGallery === 'undefined') return;
    const imgs = container.querySelectorAll('img[data-illust-id]');
    for (const img of imgs) {
      const id = img.dataset.illustId;
      if (id && !img.getAttribute('src')) {
        try { const url = await IllustGallery.getUrl(id); if (url) img.src = url; }
        catch (e) {}
      }
    }
  },

  // 商品图全屏查看
  async _viewFullGoodsImage(illustId) {
    if (typeof IllustGallery === 'undefined') return;
    const url = await IllustGallery.getUrl(illustId);
    if (!url) return;
    const overlay = document.createElement('div');
    overlay.className = 'tw-fullimg-overlay';
    overlay.innerHTML = `<img src="${url}" class="tw-fullimg">`;
    overlay.onclick = () => overlay.remove();
    document.body.appendChild(overlay);
  },

  goScreen(screen, listingId) {
    this.currentScreen = screen;
    if (listingId !== undefined) this.currentListingId = listingId;
    this.render();
    document.querySelectorAll('.mc-tabbar button').forEach(b =>
      b.classList.toggle('on', b.dataset.mcTab === this.currentScreen));
    // 懒加载：进入详情页后，若该出品 AI 内容未生成则触发生成
    if (screen === 'detail') {
      const l = this._ensureData().listings.find(x => x.id === this.currentListingId);
      if (l) this._maybeGenerate(l);
    }
  },

  // ── 首页瀑布流 ──
  _renderHome() {
    const m = this._ensureData();
    const goodsMap = {};
    this._listedGoods().forEach(g => goodsMap[g.id] = g);
    const cards = m.listings
      .filter(l => goodsMap[l.goodsEntryId])
      .map(l => this._listingCard(l, goodsMap[l.goodsEntryId]))
      .join('');
    return `
      <div class="mc-search" onclick="Mercari.goScreen('search')">${I18n.t('mc.search_placeholder', 'なにをお探しですか？')}</div>
      <div class="mc-banner" onclick="Mercari.goScreen('ranking')">
        <span>${I18n.t('mc.banner_ranking', '今話の市場ランキング')}</span><span>›</span></div>
      <div class="mc-refresh" onclick="Mercari.refreshMarket()">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"></path><path d="M21 3v6h-6"></path></svg>
        ${I18n.t('mc.refresh_market', '市場を更新')}
      </div>
      <div class="mc-grid">${cards || `<div class="mc-placeholder">${I18n.t('mc.home_empty', '在售周边が登録されると、ここに出品が並びます')}</div>`}</div>`;
  },

  // 出品显示标题：盲盒款 = 周边名 + 角色名（真 Mercari「○○ 缶バッジ 沖田総悟」式）；
  // まとめ売り款再缀「まとめ売りN点」
  _listingTitle(l, goodsEntry) {
    const g = (goodsEntry && goodsEntry.goods) || {};
    let t = g.name || (goodsEntry && goodsEntry.title) || I18n.t('mc.player_default_name', '周边');
    if (l && l.variantChar) t += ' ' + l.variantChar;
    if (l && l.bundleQty) t += ' ' + I18n.t('mc.bundle_suffix', { n: l.bundleQty });
    return t;
  },

  _listingCard(l, goodsEntry) {
    const g = goodsEntry.goods;
    const title = this._escapeHtml(this._listingTitle(l, goodsEntry));
    const sold = l.status === 'sold' ? `<span class="mc-sold">${I18n.t('mc.status_sold', 'SOLD')}</span>` : '';
    // 官方周边商品图（在放送局生成）→ 复用到 Mercari 卡片
    const img = g.generatedImageId
      ? `<img data-illust-id="${this._escapeHtml(g.generatedImageId)}" src="" alt="${title}">`
      : '';
    return `<div class="mc-card" onclick="Mercari.goScreen('detail','${l.id}')">
      <div class="mc-card-img">${sold}${img}</div>
      <div class="mc-card-ti">${title}</div>
      <div class="mc-card-pr">¥${l.price.toLocaleString()}</div>
    </div>`;
  },

  _renderDetail() {
    const m = this._ensureData();
    const l = m.listings.find(x => x.id === this.currentListingId);
    if (!l) return `<div class="mc-placeholder">${I18n.t('mc.listing_not_found', '出品が見つかりません')}</div>`;
    const ge = this._goodsById(l.goodsEntryId);
    const g = ge ? ge.goods : { name: I18n.t('mc.player_default_name', '周边'), price:0, rarity:'通常' };
    const detailImgId = ge && ge.goods && ge.goods.generatedImageId;

    // 相场基准：用价格引擎算的单款二手均价（盲盒按 variantChar，不受个别黄牛/假货污染）
    const avg = ge ? this._avgPriceFor(ge, l.variantChar) : l.price;
    const ratio = avg ? (l.price / avg) : 1;
    const fav = m.favorites.includes(l.id);
    const title = this._listingTitle(l, ge);

    const intro = l.sellerIntro
      ? this._escapeHtml(l.sellerIntro)
      : `<span class="mc-dim">${I18n.t('mc.no_description_yet', '（説明はまだ生成されていません）')}</span>`;
    const comments = (l.comments && l.comments.length)
      ? l.comments.map(c => `
          <div class="mc-cmt${c.isSeller ? ' seller' : ''}">
            <div class="mc-cmt-n">${this._escapeHtml(c.name)}${c.isSeller ? I18n.t('mc.seller_label', '（出品者）') : ''}</div>
            <div class="mc-cmt-t">${this._escapeHtml(c.text)}</div></div>`).join('')
      : `<div class="mc-dim">${I18n.t('mc.no_comments_yet', '（コメントはまだ生成されていません）')}</div>`;

    return `
      <div class="mc-d-bar" onclick="Mercari.goScreen('home')">${I18n.t('mc.back_home_link', '‹ ホーム')}</div>
      <div class="mc-d-img">${detailImgId ? `<img data-illust-id="${this._escapeHtml(detailImgId)}" src="" alt="${this._escapeHtml(title)}" onclick="Mercari._viewFullGoodsImage('${this._escapeHtml(detailImgId)}')">` : ''}</div>
      <div class="mc-d-pad">
        <div class="mc-d-name">${this._escapeHtml(title)}</div>
        <div class="mc-d-price">¥${l.price.toLocaleString()}</div>
        ${l.status === 'sold' ? `<div class="mc-d-soldtag">${I18n.t('mc.listing_sold', '売り切れました')}</div>` : ''}
        ${l.flaggedFake ? `<div class="mc-d-fake">${I18n.t('mc.fake_warning', '偽物の疑い（コメントで指摘あり）')}</div>` : ''}
        <div class="mc-d-meta">
          <div>${I18n.t('mc.condition_label', '商品の状態')}　${this._escapeHtml(this._conditionLabel(l.condition))}</div>
          <div>${I18n.t('mc.category_label', 'カテゴリー')}　${this._escapeHtml(this._rarityLabel(g.rarity))}・${this._escapeHtml(g.type || '')}</div>
          ${g.blindBox ? `<div>${I18n.t('mc.blind_label', 'ブラインド')}　${I18n.t('mc.blind_meta', { n: (g.charNames||[]).length, per: (g.price||0).toLocaleString() })}</div>` : ''}
        </div>

        <div class="mc-d-h">${I18n.t('mc.description_section', '商品の説明')}</div>
        <div class="mc-d-desc">${intro}</div>

        <div class="mc-d-h">${I18n.t('mc.seller_section', '出品者')}</div>
        <div class="mc-d-seller">
          <div class="mc-d-ava"></div>
          <div><div class="mc-d-sname">${this._escapeHtml(l.sellerName)}</div>
            <div class="mc-d-stars">${I18n.t('mc.seller_rating_format', { stars: l.sellerRating.stars, count: l.sellerRating.count })}</div></div>
        </div>

        <div class="mc-d-h">${I18n.t('mc.market_price_section', 'この商品の相場')}</div>
        <div class="mc-d-relay">
          <div class="row"><span>${I18n.t('mc.price_official', '定価')}</span><span>¥${(g.price||0).toLocaleString()}</span></div>
          <div class="row"><span>${I18n.t('mc.price_market', '相場')}</span><span>¥${avg.toLocaleString()}</span></div>
          <div class="row ${ratio>=1.8?'hot':''}"><span>${I18n.t('mc.price_this_listing', 'この出品')}</span>
            <span>${I18n.t('mc.price_ratio_format', { price: l.price.toLocaleString(), ratio: ratio.toFixed(1) })}</span></div>
        </div>

        <div class="mc-d-h">${I18n.t('mc.comment_section', { n: (l.comments||[]).length })}
          <button class="mc-regen" onclick="Mercari.regenComments('${l.id}')">${I18n.t('mc.btn_regen', '再生成')}</button></div>
        ${comments}
      </div>
      <div class="mc-d-actions">
        <button class="mc-fav${fav?' on':''}" onclick="Mercari.toggleFav('${l.id}')">${fav ? I18n.t('mc.btn_fav_on', '★ 収藏済み') : I18n.t('mc.btn_fav_off', '☆ 収藏')}</button>
        <button class="mc-share" onclick="Mercari.shareToLine('${l.id}')">${I18n.t('mc.btn_share_line', 'LINE で共有')}</button>
      </div>`;
  },

  toggleFav(listingId) {
    const m = this._ensureData();
    const i = m.favorites.indexOf(listingId);
    if (i >= 0) m.favorites.splice(i, 1); else m.favorites.push(listingId);
    Utils.saveData();
    this.render();
  },

  regenComments(listingId) {
    const l = this._ensureData().listings.find(x => x.id === listingId);
    if (!l) return;
    l.aiGenerated = false; l._generating = false;
    this._maybeGenerate(l);
  },

  // ── 手动市場イベント ──
  // 顶栏「市場イベント」按钮 → 选周边 → 选事件
  openEventDialog() {
    const goods = this._listedGoods();
    if (!goods.length) { (Utils.toast || Utils.showToast || function(){}).call(Utils, I18n.t('t.mc_no_goods', '在售周边がありません')); return; }
    // 用既有 modal/选择器；此处用 prompt 兜底（执行时若有 Utils 通用选择器则替换）
    const list = goods.map((g,i) => `${i}: ${g.goods.name}`).join('\n');
    const gi = parseInt(prompt(I18n.t('mc.event_prompt_pick', 'どの周边に騒動を起こす？\n') + list), 10);
    if (isNaN(gi) || !goods[gi]) return;
    const type = prompt(I18n.t('mc.event_prompt_type', 'イベント種類：fake（偽物騒動）/ scalp（転売ヤー炎上）'));
    if (type === 'fake') this.triggerEvent(goods[gi].id, 'fake_storm');
    else if (type === 'scalp') this.triggerEvent(goods[gi].id, 'scalper_flame');
  },

  triggerEvent(goodsEntryId, type) {
    const m = this._ensureData();
    const ge = this._goodsById(goodsEntryId);
    if (!ge) return;
    const sellerType = (type === 'fake_storm') ? 'counterfeit' : 'scalper';
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const vc = this._pickVariant(ge);                  // 盲盒：随机一个角色款
      const avg = this._avgPriceFor(ge, vc);
      const l = this._buildListing(ge, avg, sellerType, vc, 'on_sale');
      l.eventTag = type;
      l.sellerRating = { stars: 2 + Math.floor(Math.random()*3),
                         count: 1 + Math.floor(Math.random()*40) };  // 事件款低信誉
      m.listings.push(l);
    }
    // 同周边已有出品的 AI 缓存失效（让留言区反映新风波）
    m.listings.filter(l => l.goodsEntryId === goodsEntryId).forEach(l => {
      l.aiGenerated = false; l.sellerIntro = ''; l.comments = [];
    });
    m.manualEvents.push({ id: Utils.generateId(), goodsEntryId, type,
      plotId: m.lastRefreshPlotId, timestamp: Date.now() });
    Utils.saveData();
    this.goScreen('home');
    (Utils.toast || Utils.showToast || function(){}).call(Utils, type === 'fake_storm' ? I18n.t('t.mc_fake_storm', '偽物騒動が起きました') : I18n.t('t.mc_scalper_flame', '転売ヤーが群がってきました'));
  },

  shareToLine(listingId) {
    const m = this._ensureData();
    const l = m.listings.find(x => x.id === listingId);
    if (!l) return;
    const ge = this._goodsById(l.goodsEntryId);
    const g = ge ? ge.goods : {};
    // 复用 Perigee 既有的「分享到 LINE」通道。LINE 模块的分享入口是
    // LineTalk.showShareCharSelect(shareType, shareData)（推特 / Melonbooks 同款），
    // shareType 用 'product'（商品卡片，与 Melonbooks 同形）。
    // 注：sourceLabel/title 是发到 LINE 的卡片显示标签，按品牌名 fallback 用原文
    if (typeof LineTalk !== 'undefined' && LineTalk.showShareCharSelect) {
      LineTalk.showShareCharSelect('product', {
        title: this._listingTitle(l, ge),
        circleName: l.sellerName || '',
        sourceLabel: 'メルカリ',
        coverEmoji: '🛍️',
        price: `¥${(l.price || 0).toLocaleString()}`,
        listingId: l.id
      });
    } else {
      (Utils.toast || Utils.showToast || function(){}).call(Utils, I18n.t('t.mc_shared_to_line', 'LINE へ共有しました'));
    }
  },

  // ── AI 生成：卖家介绍 + 留言区 ──
  _apiConfig() {
    const o = this._ensureData().settings.apiOverride;
    if (!o || !o.enabled) return null;          // null → callChatAPI 用全局配置
    // callChatAPI 内部检查 overrideConfig.enabled（见 pixiv 同款用法），
    // 故连同 enabled 一并传入完整对象。
    return { enabled: true, baseUrl: o.baseUrl, apiKey: o.apiKey, model: o.model };
  },

  _listingPromptFacts(l, ge) {
    const g = ge ? ge.goods : {};
    const m = this._ensureData();
    // 相場中央値：盲盒只比同角色款，避免被别的角色款价格污染
    const sib = m.listings
      .filter(x => x.goodsEntryId === l.goodsEntryId && (!g.blindBox || x.variantChar === l.variantChar))
      .map(x => x.price).sort((a,b)=>a-b);
    const median = sib.length ? sib[Math.floor(sib.length/2)] : l.price;
    const roleMap = { normal:'普通の個人出品者', scalper:'転売ヤー（高額転売目的）',
                      counterfeit:'偽物を本物と偽って売る出品者' };
    const facts = [`周辺グッズ：${this._listingTitle(l, ge)}（${g.type||''}・${g.rarity||''}）`];
    if (g.blindBox) {
      facts.push(`形式：ブラインドくじ／カプセル（全${(g.charNames||[]).length}種ランダム）の単品。この出品は「${l.variantChar||'不明'}」`);
      if (l.bundleQty) facts.push(`まとめ売り：${l.bundleQty}点セット（ダブり・不人気キャラの処分が多い）`);
    } else {
      facts.push(`関連キャラ：${(g.charNames||[]).join('、') || '不明'}`);
    }
    facts.push(
      `定価（単価）¥${g.price||0} / 相場中央値 ¥${median} / この出品 ¥${l.price}`,
      `出品者の正体：${roleMap[l.sellerType]}`,
      `商品状態：${l.condition}`
    );
    return facts.join('\n');
  },

  async generateListingContent(listing) {
    const ge = this._goodsById(listing.goodsEntryId);
    let ctx = '';
    if (typeof Forum !== 'undefined' && Forum.getWorldContext) {
      try { ctx = Forum.getWorldContext() || ''; }
      catch (e) { console.warn('[Mercari] getWorldContext 取得失败，降级为空上下文', e); }
    }
    const sys = 'あなたはフリマアプリ「メルカリ」のリアルなシミュレーターです。'
      + '指定された出品について、出品者の商品説明文と、買い手たちのコメント欄を生成します。'
      + '世界観・キャラ・物語に沿って、生っぽく書いてください。';
    const userMsg =
      `${ctx}\n\n【出品情報】\n${this._listingPromptFacts(listing, ge)}\n\n` +
      `【指示】\n` +
      `・出品者の「商品の説明」を1〜3文。\n` +
      `・買い手のコメントを3〜6件。転売ヤーなら高額を咎める声・他出品者を案内する声を、` +
      `偽物出品なら刻印や印刷など違和感を指摘して見抜く買い手を、自然に混ぜる。\n` +
      `・出品者本人の返信コメントが入ってもよい。\n` +
      `【出力形式（厳守）】\n` +
      `INTRO: 商品説明文\n` +
      `COMMENT: 買い手名|本文\n` +
      `SELLER: 出品者の返信本文\n` +
      `（COMMENT / SELLER 行を必要数）`;

    const raw = await Utils.callChatAPI(
      [{ role:'user', content: userMsg }], sys, this._apiConfig());

    // 解析
    const intro = (raw.match(/^INTRO:\s*(.+)$/m) || [])[1] || '';
    const comments = [];
    raw.split('\n').forEach(line => {
      let mm;
      if ((mm = line.match(/^COMMENT:\s*(.+?)\|(.+)$/))) {
        comments.push({ name: mm[1].trim(), text: mm[2].trim(), isSeller:false });
      } else if ((mm = line.match(/^SELLER:\s*(.+)$/))) {
        comments.push({ name: listing.sellerName, text: mm[1].trim(), isSeller:true });
      }
    });

    listing.sellerIntro = intro.trim();
    listing.comments = comments;
    listing.aiGenerated = true;

    // 假货识破判定：counterfeit 出品的非卖家留言出现识破词 → 群众结案
    if (listing.sellerType === 'counterfeit' &&
        comments.some(c => !c.isSeller && /(偽物|偽|フェイク|刻印|正規品では|本物じゃ)/.test(c.text))) {
      listing.flaggedFake = true;
    }
    Utils.saveData();
  },

  // 懒加载触发：详情页若未生成则异步生成、完成后重渲
  _maybeGenerate(listing) {
    if (listing.aiGenerated || listing._generating) return;
    listing._generating = true;
    const root = document.getElementById('mercari-body');
    const slot = root && root.querySelector('.mc-d-desc');
    if (slot) slot.innerHTML = `<span class="mc-dim">${I18n.t('mc.generating', '生成中…')}</span>`;
    this.generateListingContent(listing)
      .catch(e => { console.error('[Mercari] 生成失败', e); })
      .finally(() => { listing._generating = false;
        if (this.currentScreen === 'detail' && this.currentListingId === listing.id) this.render(); });
  },

  // ── 设置页 ──
  _renderSettings() {
    const s = this._ensureData().settings;
    const o = s.apiOverride;
    return `
      <div class="mc-d-bar" onclick="Mercari.goScreen('home')">${I18n.t('mc.back_home_link', '‹ ホーム')}</div>
      <div class="mc-d-pad">
        <div class="mc-d-h">${I18n.t('mc.gen_timing_h', '生成タイミング')}</div>
        <label><input type="radio" name="mcGen" value="lazy" ${s.generationMode==='lazy'?'checked':''}
          onchange="Mercari.setGenMode('lazy')"> ${I18n.t('mc.gen_lazy', '遅延読み込み（出品を開いた時に生成・推奨）')}</label>
        <label><input type="radio" name="mcGen" value="preload" ${s.generationMode==='preload'?'checked':''}
          onchange="Mercari.setGenMode('preload')"> ${I18n.t('mc.gen_preload', '事前生成（ストーリー更新後にまとめて生成）')}</label>

        <div class="mc-d-h">${I18n.t('mc.indep_api_h', '独立 API（空欄でグローバル設定に従う）')}</div>
        <label><input type="checkbox" id="mcApiEnabled" ${o.enabled?'checked':''}
          onchange="Mercari.saveApiCfg()"> ${I18n.t('mc.indep_api_toggle', 'Mercari 用に API を個別設定')}</label>
        <label>${I18n.t('mc.api_base_url', 'Base URL')} <input id="mcApiBase" value="${this._escapeHtml(o.baseUrl)}"></label>
        <label>${I18n.t('mc.api_key', 'API Key')} <input id="mcApiKey" type="password" value="${this._escapeHtml(o.apiKey)}"></label>
        <label>${I18n.t('mc.api_model', 'Model')} <input id="mcApiModel" value="${this._escapeHtml(o.model)}"></label>
        <button onclick="Mercari.saveApiCfg()">${I18n.t('mc.btn_save', '保存')}</button>
      </div>`;
  },
  setGenMode(mode) { this._ensureData().settings.generationMode = mode; Utils.saveData(); },
  saveApiCfg() {
    const o = this._ensureData().settings.apiOverride;
    o.enabled = document.getElementById('mcApiEnabled').checked;
    o.baseUrl = document.getElementById('mcApiBase').value.trim();
    o.apiKey  = document.getElementById('mcApiKey').value.trim();
    o.model   = document.getElementById('mcApiModel').value.trim();
    Utils.saveData();
    (Utils.toast || Utils.showToast || function(){}).call(Utils, I18n.t('t.mc_saved', '保存しました'));
  },

  // ── 行情聚合工具 ──
  // 按角色聚合在售周边均价（盲盒按单款 variantChar，含没配声优的冷门角色）
  _charMarket() {
    const m = this._ensureData();
    const listed = this._listedGoods();
    const rows = this._allMarketChars().map(name => {
      const prices = [];
      let count = 0;
      listed.forEach(ge => {
        const g = ge.goods;
        if (g.blindBox) {
          if ((g.charNames || []).includes(name)) {
            prices.push(this._avgPriceFor(ge, name));
            count += m.listings.filter(l => l.goodsEntryId === ge.id && l.variantChar === name).length;
          }
        } else if ((g.charNames || []).includes(name)) {
          prices.push(this._goodsAvgPrice(ge));
          count += m.listings.filter(l => l.goodsEntryId === ge.id).length;
        }
      });
      if (!prices.length) return null;
      const avg = Math.round(prices.reduce((a,b)=>a+b,0) / prices.length);
      return { name, avg, count, heat: this._characterHeat(name) };
    }).filter(Boolean);
    // CP 作为一行（盲盒为单人款，不计入 CP）
    const cp = this.getCP();
    if (cp) {
      const cpGoods = listed.filter(e => {
        if (e.goods.blindBox) return false;
        const cn = e.goods.charNames || [];
        return cn.includes(cp.a) && cn.includes(cp.b);
      });
      if (cpGoods.length) {
        const prices = cpGoods.map(g => this._goodsAvgPrice(g));
        const cpListed = m.listings.filter(l =>
          cpGoods.some(g => g.id === l.goodsEntryId));
        rows.push({ name: `${cp.nickname}${I18n.t('mc.cp_suffix', '（CP）')}`,
          avg: Math.round(prices.reduce((a,b)=>a+b,0)/prices.length),
          count: cpListed.length, heat: (this._characterHeat(cp.a)+this._characterHeat(cp.b))/2 });
      }
    }
    return rows.sort((a,b) => b.avg - a.avg);
  },
  _heatLabel(h) { return h >= 1.6 ? `<span class="up">${I18n.t('mc.heat_up', '▲ 高騰')}</span>`
    : h <= 0.95 ? `<span class="dn">${I18n.t('mc.heat_down', '▼ 下落')}</span>` : `<span class="fl">${I18n.t('mc.heat_flat', 'ー 横ばい')}</span>`; },

  // ── 行情榜页 ──
  _renderRanking() {
    const chars = this._charMarket();
    const m = this._ensureData();
    // 完売速報：sold 出品按周边聚合
    const soldByGoods = {};
    m.listings.filter(l => l.status==='sold').forEach(l => {
      soldByGoods[l.goodsEntryId] = (soldByGoods[l.goodsEntryId]||0) + 1; });
    const charRows = chars.map((r,i) => `
      <div class="mc-rk-row"><span class="mc-rk-no">${i+1}</span>
        <div class="mc-rk-nm">${this._escapeHtml(r.name)}
          <div class="mc-rk-s">${I18n.t('mc.ranking_char_stat', { avg: r.avg.toLocaleString(), count: r.count })}</div></div>
        <span class="mc-rk-tr">${this._heatLabel(r.heat)}</span></div>`).join('')
      || `<div class="mc-dim">${I18n.t('mc.ranking_charas_empty', '声優のキャストと関連キャラを登録すると行情が出ます')}</div>`;
    const soldRows = Object.keys(soldByGoods).map(gid => {
      const ge = this._goodsById(gid); if (!ge) return '';
      return `<div class="mc-rk-row"><span class="mc-rk-dot">●</span>
        <div class="mc-rk-nm">${this._escapeHtml(ge.goods.name)}
          <div class="mc-rk-s">${I18n.t('mc.ranking_sold_stat', { n: soldByGoods[gid] })}</div></div></div>`;
    }).join('') || `<div class="mc-dim">${I18n.t('mc.ranking_sold_empty', '完売はまだありません')}</div>`;
    const risen = m.listings
      .filter(l => l._prevPrice && l.price > l._prevPrice)
      .map(l => { const ge = this._goodsById(l.goodsEntryId);
        return ge ? { name: this._listingTitle(l, ge), from: l._prevPrice, to: l.price,
          pct: Math.round((l.price/l._prevPrice - 1) * 100) } : null; })
      .filter(Boolean).sort((a,b) => b.pct - a.pct).slice(0, 5);
    const risenRows = risen.map((r,i) => `
      <div class="mc-rk-row"><span class="mc-rk-no">${i+1}</span>
        <div class="mc-rk-nm">${this._escapeHtml(r.name)}
          <div class="mc-rk-s">¥${r.from.toLocaleString()} → ¥${r.to.toLocaleString()}</div></div>
        <span class="mc-rk-tr"><span class="up">+${r.pct}%</span></span></div>`).join('')
      || `<div class="mc-dim">${I18n.t('mc.ranking_risen_empty', 'まだ高騰したグッズはありません')}</div>`;
    return `
      <div class="mc-d-bar" onclick="Mercari.goScreen('home')">${I18n.t('mc.back_home_link', '‹ ホーム')}</div>
      <div class="mc-d-pad">
        <div class="mc-d-h">${I18n.t('mc.ranking_charas_h', 'キャラ別 人気ランキング')}</div>${charRows}
        <div class="mc-d-h">${I18n.t('mc.ranking_risen_h', '高騰グッズ TOP')}</div>${risenRows}
        <div class="mc-d-h">${I18n.t('mc.ranking_sold_h', '完売速報')}</div>${soldRows}
      </div>`;
  },

  // ── さがす（按角色 / CP / 类型筛选）──
  _renderSearch() {
    const chars = this._allMarketChars();
    const chips = chars.map(c =>
      `<button class="mc-chip" data-mc-char="${this._escapeHtml(c)}" onclick="Mercari.searchByChip(this)">${this._escapeHtml(c)}</button>`).join('');
    const results = (this._searchResults || []).map(l => {
      const ge = this._goodsById(l.goodsEntryId); if (!ge) return '';
      return this._listingCard(l, ge);
    }).join('');
    return `
      <div class="mc-d-pad">
        <div class="mc-d-h">${I18n.t('mc.search_by_char_h', 'キャラで探す')}</div><div class="mc-chips">${chips}</div>
        <div class="mc-d-h">${I18n.t('mc.search_result_h', '検索結果')}</div>
        <div class="mc-grid">${results || `<div class="mc-dim">${I18n.t('mc.search_pick_char', 'キャラを選んでください')}</div>`}</div>
      </div>`;
  },
  // chip 点击：角色名从 data 属性读取（避免角色名含引号/反斜杠时内联 onclick 报错）
  searchByChip(el) { this.searchBy('char', (el && el.dataset.mcChar) || ''); },

  searchBy(kind, value) {
    const m = this._ensureData();
    if (kind === 'char') {
      const goodsMap = {};
      this._listedGoods().forEach(e => goodsMap[e.id] = e);
      this._searchResults = m.listings.filter(l => {
        const ge = goodsMap[l.goodsEntryId];
        if (!ge) return false;
        const g = ge.goods;
        // 盲盒：精确到该角色款（不把整个系列倒出来）；普通：按条目关联角色
        if (g.blindBox) return l.variantChar === value;
        return (g.charNames || []).includes(value);
      });
    }
    this.currentScreen = 'search';
    this.render();
  },

  // ── 収藏页 ──
  _renderFavorites() {
    const m = this._ensureData();
    const cards = m.favorites.map(id => {
      const l = m.listings.find(x => x.id === id); if (!l) return '';
      const ge = this._goodsById(l.goodsEntryId); if (!ge) return '';
      return this._listingCard(l, ge);
    }).join('');
    return `<div class="mc-d-pad"><div class="mc-d-h">${I18n.t('mc.favorites_h', '収藏した出品')}</div>
      <div class="mc-grid">${cards || `<div class="mc-dim">${I18n.t('mc.favorites_empty', 'まだ収藏がありません')}</div>`}</div></div>`;
  }
};
