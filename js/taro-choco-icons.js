// ===== 香芋牛奶巧克力(taro-choco)主题 · 法式复古古纸卡图标 =====
// 仅在 taro-choco 主题下，把桌面 app 图标替换成奶油古纸卡铜版蚀刻 webp；切走恢复默认。
// 用户自定义图标（AppState.data.customIcons）优先级最高，不被覆盖。
// data-icon-default 与 Constellation/Journal/Strawberry/Snow/Sakura/Animal/Rain 各图标模块共享，
// 八方守卫互相对称（切走任一图标主题时，若目标是另七个图标主题之一则不恢复、交给目标接管）。
// 调用时机：DesktopRenderer.render() 末尾 + SystemConfig.applyTheme() 末尾。

const TaroChocoIcons = {
  THEME: 'taro-choco',

  // app id → webp 文件名（assets/icons/taro-choco/ 目录下，文件名即 appId）
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
    const isTaro = document.documentElement.dataset.theme === this.THEME;
    // AppState 是顶层词法声明、不在 window 上——用 typeof 探测（window.AppState 恒 undefined，曾使本守卫沦为死代码）
    const customIcons = (typeof AppState !== 'undefined' && AppState.data && AppState.data.customIcons) || {};
    document.querySelectorAll('.app-item[data-app]').forEach(item => {
      const appId = item.dataset.app;
      const c = item.querySelector('.app-icon');
      if (!c) return;
      // 用户自定义图标优先，不覆盖
      if (customIcons[appId]) return;

      if (isTaro && this.ICONS[appId]) {
        // 首次替换：把原始 SVG 存起来（与各图标主题模块共用 data-icon-default，只存一次）
        if (!c.dataset.iconDefault) c.dataset.iconDefault = c.innerHTML;
        c.innerHTML = `<img src="assets/icons/taro-choco/${this.ICONS[appId]}" alt="${appId}" draggable="false">`;
      } else if (c.dataset.iconDefault) {
        // 离开香芋主题：恢复原始 SVG；但若目标是其他图标主题，交给它们接管（八方守卫对称）
        const t = document.documentElement.dataset.theme;
        if (t !== 'night-sky' && t !== 'journal' && t !== 'strawberry' && t !== 'snow-country' && t !== 'sakura' && t !== 'animal' && t !== 'summer-rain' && t !== 'mint-choco') {
          c.innerHTML = c.dataset.iconDefault;
          delete c.dataset.iconDefault;
        }
      }
    });
  }
};
