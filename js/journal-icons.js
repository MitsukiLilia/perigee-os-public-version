// ===== 手帐(journal)主题 · 贴纸图标 =====
// 仅在 journal 主题下，把桌面 app 图标替换成手绘贴纸 PNG；切走恢复默认。
// 用户自定义图标（AppState.data.customIcons）优先级最高，不被手帐图标覆盖。
// 存储原始 SVG 用 data-icon-default（与 ConstellationIcons 共享同一 key，避免跨主题互相覆盖原始值）。
// 调用时机：DesktopRenderer.render() 末尾 + SystemConfig.applyTheme() 末尾。

const JournalIcons = {
  THEME: 'journal',

  // app id → webp 文件名（assets/icons/journal/ 目录下）
  ICONS: {
    'chat':            'book-chat.webp',
    'worldbook':       'book-globe.webp',
    'language':        'globe.webp',
    'forum':           'letter-pen.webp',
    'pixiv-novel':     'notebook-p.webp',
    'twitter':         'pens-crossed.webp',
    'magazine':        'bookshelf.webp',
    'melonbooks':      'tote-bag.webp',
    'niconico':        'tv-retro.webp',
    'weibo':           'speech-bubble.webp',
    'lofter':          'notepad-l.webp',
    'writer':          'mailbox.webp',
    'lyric-lab':       'vinyl.webp',
    'mercari':         'parcel.webp',
    'broadcast':       'radio.webp',
    'tarot':           'moon-card.webp',
    'fortune':         'scroll-bow.webp',
    'payment-tracker': 'tag-fortune.webp',
    'travel-account':  'notebook-tag.webp',
    'settings':        'notebook-gear.webp',
  },

  apply() {
    const isJournal = document.documentElement.dataset.theme === this.THEME;
    // AppState 是顶层词法声明、不在 window 上——用 typeof 探测（window.AppState 恒 undefined，曾使本守卫沦为死代码）
    const customIcons = (typeof AppState !== 'undefined' && AppState.data && AppState.data.customIcons) || {};
    document.querySelectorAll('.app-item[data-app]').forEach(item => {
      const appId = item.dataset.app;
      const c = item.querySelector('.app-icon');
      if (!c) return;
      // 用户自定义图标优先，不覆盖
      if (customIcons[appId]) return;

      if (isJournal && this.ICONS[appId]) {
        // 首次替换：把原始 SVG 存起来（与 ConstellationIcons 共用 data-icon-default，只存一次）
        if (!c.dataset.iconDefault) c.dataset.iconDefault = c.innerHTML;
        c.innerHTML = `<img src="assets/icons/journal/${this.ICONS[appId]}" alt="${appId}" draggable="false">`;
      } else if (c.dataset.iconDefault) {
        // 离开手帐主题 / 该 app 无手帐图标：恢复原始 SVG
        // 但若当前是夜空/草莓/雪国/梦之芭蕾主题，图标已由对应模块接管，不要恢复（五方守卫镜像对称）
        if (document.documentElement.dataset.theme !== 'night-sky' && document.documentElement.dataset.theme !== 'strawberry' && document.documentElement.dataset.theme !== 'snow-country' && document.documentElement.dataset.theme !== 'sakura') {
          c.innerHTML = c.dataset.iconDefault;
          delete c.dataset.iconDefault;
        }
      }
    });
  }
};

if (typeof window !== 'undefined') window.JournalIcons = JournalIcons;
