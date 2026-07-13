// ===== 动森(animal)主题 · 贴纸图标 =====
// 仅在 animal 主题下，把桌面 app 图标替换成动森风水彩贴纸；切走恢复默认。
// 用户自定义图标（AppState.data.customIcons）优先级最高，不被动森图标覆盖。
// 存储原始 SVG 用 data-icon-default（与其他图标主题共享同一 key，避免跨主题互相覆盖原始值）。
// 调用时机：与 JournalIcons 等五个同类模块并排（desktop-edit + settings 两处 applyTheme 路径）。

const AnimalIcons = {
  THEME: 'animal',

  // app id → webp 文件名（assets/icons/animal/ 目录下）
  ICONS: {
    'chat':            'bubble-leaf.webp',
    'worldbook':       'globe-book.webp',
    'language':        'book-flower.webp',
    'forum':           'corkboard.webp',
    'pixiv-novel':     'p-orange.webp',
    'twitter':         'x-tag.webp',
    'magazine':        'magazine.webp',
    'melonbooks':      'melon-bag.webp',
    'niconico':        'tv-island.webp',
    'weibo':           'weibo-flower.webp',
    'lofter':          'leaf-notebook.webp',
    'writer':          'pen-letter.webp',
    'lyric-lab':       'vinyl-note.webp',
    'mercari':         'bag-heart.webp',
    'broadcast':       'radio-sign.webp',
    'tarot':           'moon-cards.webp',
    'fortune':         'omamori.webp',
    'payment-tracker': 'coin-purse.webp',
    'travel-account':  'suitcase.webp',
    'settings':        'gear-sprout.webp',
  },

  apply() {
    const isAnimal = document.documentElement.dataset.theme === this.THEME;
    // AppState 是顶层词法声明、不在 window 上——用 typeof 探测（window.AppState 恒 undefined，曾使本守卫沦为死代码）
    const customIcons = (typeof AppState !== 'undefined' && AppState.data && AppState.data.customIcons) || {};
    document.querySelectorAll('.app-item[data-app]').forEach(item => {
      const appId = item.dataset.app;
      const c = item.querySelector('.app-icon');
      if (!c) return;
      // 用户自定义图标优先，不覆盖
      if (customIcons[appId]) return;

      if (isAnimal && this.ICONS[appId]) {
        // 首次替换：把原始 SVG 存起来（与其他图标主题共用 data-icon-default，只存一次）
        if (!c.dataset.iconDefault) c.dataset.iconDefault = c.innerHTML;
        c.innerHTML = `<img src="assets/icons/animal/${this.ICONS[appId]}" alt="${appId}" draggable="false">`;
      } else if (c.dataset.iconDefault) {
        // 离开动森主题：恢复原始 SVG；但若目标是夜空/手帐/草莓/雪国/梦之芭蕾，交给它们接管（六方守卫对称）
        const t = document.documentElement.dataset.theme;
        if (t !== 'night-sky' && t !== 'journal' && t !== 'strawberry' && t !== 'snow-country' && t !== 'sakura') {
          c.innerHTML = c.dataset.iconDefault;
          delete c.dataset.iconDefault;
        }
      }
    });
  }
};

if (typeof window !== 'undefined') window.AnimalIcons = AnimalIcons;
