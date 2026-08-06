// ===== 夏雨(summer-rain)主题 · 清透玻璃瓦片图标 =====
// 仅在 summer-rain 主题下，把桌面 app 图标替换成生图磨砂玻璃瓦片 webp；切走恢复默认。
// 用户自定义图标（AppState.data.customIcons）优先级最高，不被覆盖。
// data-icon-default 与 Constellation/Journal/Strawberry/Snow/Sakura/Animal 共享，七方守卫互相对称
// （切走任一图标主题时，若目标是另六个图标主题之一则不恢复、交给目标接管）。
// 调用时机：DesktopRenderer.render() 末尾 + SystemConfig.applyTheme() 末尾。
// 瓦片是不透明方图：圆角由 .app-icon 容器 18px 裁（画中圆角更小、灰角裁净），
// CSS 玻璃壳的退场走 themes.css 的 .app-icon:has(img) 规则，本模块只管换内容。

const RainIcons = {
  THEME: 'summer-rain',

  // app id → webp 文件名（assets/icons/summer-rain/ 目录下，文件名即 appId）
  ICONS: {
    'broadcast':       'broadcast.webp',
    'chat':            'chat.webp',
    'worldbook':       'worldbook.webp',
    'language':        'language.webp',
    'forum':           'forum.webp',
    'pixiv-novel':     'pixiv-novel.webp',
    'twitter':         'twitter.webp',
    'magazine':        'magazine.webp',
    'melonbooks':      'melonbooks.webp',
    'niconico':        'niconico.webp',
    'weibo':           'weibo.webp',
    'lofter':          'lofter.webp',
    'writer':          'writer.webp',
    'lyric-lab':       'lyric-lab.webp',
    'mercari':         'mercari.webp',
    'tarot':           'tarot.webp',
    'fortune':         'fortune.webp',
    'payment-tracker': 'payment-tracker.webp',
    'travel-account':  'travel-account.webp',
    'settings':        'settings.webp',
  },

  apply() {
    const isRain = document.documentElement.dataset.theme === this.THEME;
    // AppState 是顶层词法声明、不在 window 上——用 typeof 探测（window.AppState 恒 undefined，曾使本守卫沦为死代码）
    const customIcons = (typeof AppState !== 'undefined' && AppState.data && AppState.data.customIcons) || {};
    document.querySelectorAll('.app-item[data-app]').forEach(item => {
      const appId = item.dataset.app;
      const c = item.querySelector('.app-icon');
      if (!c) return;
      // 用户自定义图标优先，不覆盖
      if (customIcons[appId]) return;

      if (isRain && this.ICONS[appId]) {
        // 首次替换：把原始 SVG 存起来（与另六个图标模块共用 data-icon-default，只存一次）
        if (!c.dataset.iconDefault) c.dataset.iconDefault = c.innerHTML;
        c.innerHTML = `<img src="assets/icons/summer-rain/${this.ICONS[appId]}" alt="${appId}" draggable="false">`;
      } else if (c.dataset.iconDefault) {
        // 离开夏雨主题：恢复原始 SVG；但若目标是另六个图标主题之一，交给它们接管（七方守卫对称）
        const t = document.documentElement.dataset.theme;
        if (t !== 'night-sky' && t !== 'journal' && t !== 'strawberry' && t !== 'snow-country' && t !== 'sakura' && t !== 'animal') {
          c.innerHTML = c.dataset.iconDefault;
          delete c.dataset.iconDefault;
        }
      }
    });
  }
};

if (typeof window !== 'undefined') window.RainIcons = RainIcons;
