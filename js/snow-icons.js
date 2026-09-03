// ===== 雪国(snow-country)主题 · 雪国贴纸图标 =====
// 仅在 snow-country 主题下，把桌面 app 图标替换成手绘水彩贴纸 webp；切走恢复默认。
// 用户自定义图标（AppState.data.customIcons）优先级最高，不被覆盖。
// data-icon-default 与 ConstellationIcons / JournalIcons / StrawberryIcons 共享，四方守卫互相对称
// （切走任一图标主题时，若目标是另三个图标主题之一则不恢复、交给目标接管）。
// 调用时机：DesktopRenderer.render() 末尾 + SystemConfig.applyTheme() 末尾。

const SnowIcons = {
  THEME: 'snow-country',

  // app id → webp 文件名（assets/icons/snow-country/ 目录下，文件名即 appId）
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
    const isSnow = document.documentElement.dataset.theme === this.THEME;
    // AppState 是顶层词法声明、不在 window 上——用 typeof 探测（window.AppState 恒 undefined，曾使本守卫沦为死代码）
    const customIcons = (typeof AppState !== 'undefined' && AppState.data && AppState.data.customIcons) || {};
    document.querySelectorAll('.app-item[data-app]').forEach(item => {
      const appId = item.dataset.app;
      const c = item.querySelector('.app-icon');
      if (!c) return;
      // 用户自定义图标优先，不覆盖
      if (customIcons[appId]) return;

      if (isSnow && this.ICONS[appId]) {
        // 首次替换：把原始 SVG 存起来（与 Constellation/Journal/Strawberry 共用 data-icon-default，只存一次）
        if (!c.dataset.iconDefault) c.dataset.iconDefault = c.innerHTML;
        c.innerHTML = `<img src="assets/icons/snow-country/${this.ICONS[appId]}" alt="${appId}" draggable="false">`;
      } else if (c.dataset.iconDefault) {
        // 离开雪国主题：恢复原始 SVG；但若目标是夜空/手帐/草莓/梦之芭蕾/动森，交给它们接管（六方守卫对称）
        const t = document.documentElement.dataset.theme;
        if (t !== 'night-sky' && t !== 'journal' && t !== 'strawberry' && t !== 'sakura' && t !== 'animal' && t !== 'summer-rain' && t !== 'taro-choco' && t !== 'mint-choco') {
          c.innerHTML = c.dataset.iconDefault;
          delete c.dataset.iconDefault;
        }
      }
    });
  }
};

if (typeof window !== 'undefined') window.SnowIcons = SnowIcons;
