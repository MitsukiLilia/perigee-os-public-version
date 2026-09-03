// Service Worker for Perigee OS
// 版本号：每次更新代码时修改此版本号以强制更新缓存
const VERSION = '2.263.0';
const CACHE_NAME = `perigee-os-v${VERSION}`;
// vendor 大库独立持久缓存（js/vendor/ 内容不随版本变，activate 清理旧缓存时不删，
// 避免每次发版重拉 ~1MB；不进 precache，首次用到时缓存、之后离线可用）
const VENDOR_CACHE = 'perigee-vendor-v1';
// v2.210.1 静态艺术资产持久缓存（开屏画等大图不随版本变——同 vendor 策略，activate 不删、发版零重拉。
// install 时 best-effort 预热：已有跳过、失败不阻断安装，运行时 Cache First 兜底）
const STATIC_CACHE = 'perigee-static-v1';
const staticUrls = ['./assets/splash-intro.jpg'];

// 核心本地资源（必须全部成功，否则 SW 安装失败）
const coreUrls = [
  './',
  './index.html',
  './style.css',
  './css/themes.css',
  './app.js',
  './manifest.json',
  './icon-192-v8.png',
  './icon-512-v8.png',
  './icon-512-maskable-v8.png',
  './js/utils.js',
  './js/settings.js',
  './js/character.js',
  './js/line.js',
  './js/line-voice.js',
  './js/worldbook.js',
  './js/writer.js',
  './js/dictionary.js',
  './js/quiz.js',
  './js/tutor.js',
  './js/dialogue-polish.js',
  './js/payment.js',
  './js/translator.js',
  './js/music.js',
  './js/fortune.js',
  './js/tarot.js',
  './js/anniversary.js',
  './js/world-context.js',
  './js/forum.js',
  './js/forum-generate.js',
  './js/forum-npc.js',
  './js/forum-goods.js',
  './js/forum-plot.js',
  './js/forum-tools.js',
  './js/broadcast.js',
  './js/pixiv-novel.js',
  './js/pixiv-comments.js',
  './js/illust-gallery.js',
  './js/twitter.js',
  './js/twitter-thread.js',
  './js/twitter-social.js',
  './js/twitter-spaces.js',
  './js/twitter-profile.js',
  './js/wandoro.js',
  './js/weibo.js',
  './js/lofter.js',
  './js/tts-engine.js',
  './js/magazine.js',
  './js/melonbooks.js',
  './js/mercari.js',
  './js/video-gen.js',
  './js/pixiv-illust.js',
  './js/niconico.js',
  './js/travel.js',
  './js/image-positioner.js',
  './js/widgets.js',
  './js/taro-choco-icons.js',
  './js/mint-choco-icons.js',
  './js/decorations.js',
  './js/rain.js',
  './js/rain-glass.js',
  './js/constellation-icons.js',
  './js/starfield.js',
  './js/snow.js',
  './js/snow-2d.js',
  './js/journal-icons.js',
  './js/strawberry-icons.js',
  './js/snow-icons.js',
  './js/sakura-icons.js',
  './js/rain-icons.js',
  './js/animal-icons.js',
  './js/desktop-edit.js',
  './js/liquid-glass.js',
  './js/i18n.js',
  './js/i18n-zh.js',
  './js/i18n-ja.js',
  './js/i18n-en.js',
  './js/help-content.js',
  './assets/help-content.json',
  './js/help.js',
  './js/onboarding.js',
  './js/changelog.js',
  './js/changelog-ui.js',
  './js/data-export.js',
  './js/github-backup.js',
  './css/travel.css',
  './css/mercari.css',
  './css/weibo.css',
  './css/lofter.css',
  './css/niconico.css',
  './css/melon.css',
  './css/tarot.css',
  './css/fortune.css',
  './css/magazine.css',
  './css/forum.css',
  './css/pixiv.css',
  './css/twitter.css',
  './css/wandoro.css',
  './css/line.css',
  './assets/textures/washi.svg',
  './assets/textures/watercolor.svg',
  './assets/textures/flowers.svg',
  './assets/textures/grid.svg',
  './assets/textures/frosted.svg',
  './assets/textures/leaf.svg',
  './assets/textures/seascape-bg.webp',
  './assets/textures/seascape-bg-blur.webp',
  './assets/textures/night-sky-bg.webp',
  './assets/textures/journal-bg.webp',
  './assets/textures/magazine-cover-bg.webp',
  './assets/textures/strawberry-bg.webp',
  './assets/textures/snow-country-bg.webp',
  './assets/textures/sakura-bg.webp',
  './assets/icons/journal/book-chat.webp',
  './assets/icons/journal/book-globe.webp',
  './assets/icons/journal/globe.webp',
  './assets/icons/journal/letter-pen.webp',
  './assets/icons/journal/notebook-p.webp',
  './assets/icons/journal/book-moon.webp',
  './assets/icons/journal/pens-crossed.webp',
  './assets/icons/journal/bookshelf.webp',
  './assets/icons/journal/tote-bag.webp',
  './assets/icons/journal/tv-retro.webp',
  './assets/icons/journal/speech-bubble.webp',
  './assets/icons/journal/notepad-l.webp',
  './assets/icons/journal/mailbox.webp',
  './assets/icons/journal/vinyl.webp',
  './assets/icons/journal/parcel.webp',
  './assets/icons/journal/radio.webp',
  './assets/icons/journal/moon-card.webp',
  './assets/icons/journal/scroll-bow.webp',
  './assets/icons/journal/tag-fortune.webp',
  './assets/icons/journal/notebook-tag.webp',
  './assets/icons/journal/notebook-gear.webp',
  './assets/icons/strawberry/broadcast.webp',
  './assets/icons/strawberry/chat.webp',
  './assets/icons/strawberry/worldbook.webp',
  './assets/icons/strawberry/language.webp',
  './assets/icons/strawberry/forum.webp',
  './assets/icons/strawberry/pixiv-novel.webp',
  './assets/icons/strawberry/twitter.webp',
  './assets/icons/strawberry/magazine.webp',
  './assets/icons/strawberry/melonbooks.webp',
  './assets/icons/strawberry/niconico.webp',
  './assets/icons/strawberry/weibo.webp',
  './assets/icons/strawberry/lofter.webp',
  './assets/icons/strawberry/writer.webp',
  './assets/icons/strawberry/lyric-lab.webp',
  './assets/icons/strawberry/mercari.webp',
  './assets/icons/strawberry/tarot.webp',
  './assets/icons/strawberry/fortune.webp',
  './assets/icons/strawberry/payment-tracker.webp',
  './assets/icons/strawberry/travel-account.webp',
  './assets/icons/strawberry/settings.webp',
  './assets/icons/snow-country/broadcast.webp',
  './assets/icons/snow-country/chat.webp',
  './assets/icons/snow-country/worldbook.webp',
  './assets/icons/snow-country/language.webp',
  './assets/icons/snow-country/forum.webp',
  './assets/icons/snow-country/pixiv-novel.webp',
  './assets/icons/snow-country/twitter.webp',
  './assets/icons/snow-country/magazine.webp',
  './assets/icons/snow-country/melonbooks.webp',
  './assets/icons/snow-country/niconico.webp',
  './assets/icons/snow-country/weibo.webp',
  './assets/icons/snow-country/lofter.webp',
  './assets/icons/snow-country/writer.webp',
  './assets/icons/snow-country/lyric-lab.webp',
  './assets/icons/snow-country/mercari.webp',
  './assets/icons/snow-country/tarot.webp',
  './assets/icons/snow-country/fortune.webp',
  './assets/icons/snow-country/payment-tracker.webp',
  './assets/icons/snow-country/travel-account.webp',
  './assets/icons/snow-country/settings.webp',
  './assets/icons/sakura/broadcast.webp',
  './assets/icons/sakura/chat.webp',
  './assets/icons/sakura/worldbook.webp',
  './assets/icons/sakura/language.webp',
  './assets/icons/sakura/forum.webp',
  './assets/icons/sakura/pixiv-novel.webp',
  './assets/icons/sakura/twitter.webp',
  './assets/icons/sakura/magazine.webp',
  './assets/icons/sakura/melonbooks.webp',
  './assets/icons/sakura/niconico.webp',
  './assets/icons/sakura/weibo.webp',
  './assets/icons/sakura/lofter.webp',
  './assets/icons/sakura/writer.webp',
  './assets/icons/sakura/lyric-lab.webp',
  './assets/icons/sakura/mercari.webp',
  './assets/icons/sakura/tarot.webp',
  './assets/icons/sakura/fortune.webp',
  './assets/icons/sakura/payment-tracker.webp',
  './assets/icons/sakura/travel-account.webp',
  './assets/icons/sakura/settings.webp',
  './assets/icons/summer-rain/broadcast.webp',
  './assets/icons/summer-rain/chat.webp',
  './assets/icons/summer-rain/worldbook.webp',
  './assets/icons/summer-rain/language.webp',
  './assets/icons/summer-rain/forum.webp',
  './assets/icons/summer-rain/pixiv-novel.webp',
  './assets/icons/summer-rain/twitter.webp',
  './assets/icons/summer-rain/magazine.webp',
  './assets/icons/summer-rain/melonbooks.webp',
  './assets/icons/summer-rain/niconico.webp',
  './assets/icons/summer-rain/weibo.webp',
  './assets/icons/summer-rain/lofter.webp',
  './assets/icons/summer-rain/writer.webp',
  './assets/icons/summer-rain/lyric-lab.webp',
  './assets/icons/summer-rain/mercari.webp',
  './assets/icons/summer-rain/tarot.webp',
  './assets/icons/summer-rain/fortune.webp',
  './assets/icons/summer-rain/payment-tracker.webp',
  './assets/icons/summer-rain/travel-account.webp',
  './assets/icons/summer-rain/settings.webp',
  './assets/widgets/sakura/clock-small.webp',
  './assets/widgets/sakura/clock-wide.webp',
  './assets/widgets/sakura/weather-small.webp',
  './assets/widgets/sakura/vinyl-circle.webp',
  './assets/widgets/sakura/moonphase-small.webp',
  './assets/widgets/sakura/polaroid.webp',
  './assets/widgets/sakura/music-wide.webp',
  './assets/widgets/sakura/calendar-shoes.webp',
  './assets/widgets/sakura/calendar-lace.webp',
  './assets/widgets/sakura/calendar-paper.webp',
  './assets/widgets/sakura/paper.webp',
  './assets/widgets/sakura/duoframe.webp',
  './assets/widgets/summer-rain/clock-small.webp',
  './assets/widgets/summer-rain/clock-wide.webp',
  './assets/widgets/summer-rain/calendar-wide.webp',
  './assets/widgets/summer-rain/weather-small.webp',
  './assets/widgets/summer-rain/duoframe.webp',
  './assets/widgets/summer-rain/vinyl-circle.webp',
  './assets/widgets/summer-rain/moonphase-small.webp',
  './assets/widgets/summer-rain/music-wide.webp',
  './assets/widgets/summer-rain/polaroid-small.webp',
  './assets/widgets/summer-rain/note-paper.webp',
  './assets/widgets/summer-rain/note-curl.webp',
  './assets/widgets/snow-country/calendar-wide.webp',
  './assets/widgets/snow-country/clock-small.webp',
  './assets/widgets/snow-country/clock-wide.webp',
  './assets/widgets/snow-country/moonphase-small.webp',
  './assets/widgets/snow-country/music-wide.webp',
  './assets/widgets/snow-country/note-flake.webp',
  './assets/widgets/snow-country/note-paper.webp',
  './assets/widgets/snow-country/polaroid-small.webp',
  './assets/widgets/snow-country/weather-small.webp',
  './assets/widgets/snow-country/duoframe.webp',
  './assets/widgets/snow-country/vinyl-circle.webp',
  './assets/widgets/strawberry/calendar-wide.webp',
  './assets/widgets/strawberry/clock-small.webp',
  './assets/widgets/strawberry/clock-wide.webp',
  './assets/widgets/strawberry/moonphase-small.webp',
  './assets/widgets/strawberry/music-wide.webp',
  './assets/widgets/strawberry/note-berry.webp',
  './assets/widgets/strawberry/note-paper.webp',
  './assets/widgets/strawberry/polaroid-small.webp',
  './assets/widgets/strawberry/weather-small.webp',
  './assets/widgets/strawberry/duoframe.webp',
  './assets/widgets/strawberry/vinyl-circle.webp',
  './assets/widgets/animal/calendar-wide.webp',
  './assets/widgets/animal/clock-small.webp',
  './assets/widgets/animal/clock-wide.webp',
  './assets/widgets/animal/moonphase-small.webp',
  './assets/widgets/animal/music-wide.webp',
  './assets/widgets/animal/note-orange.webp',
  './assets/widgets/animal/note-paper.webp',
  './assets/widgets/animal/polaroid-small.webp',
  './assets/widgets/animal/weather-small.webp',
  './assets/widgets/animal/duoframe.webp',
  './assets/widgets/animal/vinyl-circle.webp',
  './assets/widgets/journal/calendar-wide.webp',
  './assets/widgets/journal/clock-small.webp',
  './assets/widgets/journal/clock-wide.webp',
  './assets/widgets/journal/moonphase-small.webp',
  './assets/widgets/journal/music-wide.webp',
  './assets/widgets/journal/note-paper.webp',
  './assets/widgets/journal/note-sprig.webp',
  './assets/widgets/journal/polaroid-small.webp',
  './assets/widgets/journal/weather-small.webp',
  './assets/widgets/journal/duoframe.webp',
  './assets/widgets/journal/vinyl-circle.webp',
  './assets/widgets/taro-choco/clock-small.webp',
  './assets/widgets/taro-choco/clock-wide.webp',
  './assets/widgets/taro-choco/music-wide.webp',
  './assets/widgets/taro-choco/vinyl-circle.webp',
  './assets/widgets/taro-choco/moonphase-small.webp',
  './assets/widgets/taro-choco/weather-small.webp',
  './assets/widgets/taro-choco/calendar-wide.webp',
  './assets/widgets/taro-choco/polaroid-small.webp',
  './assets/widgets/taro-choco/note-paper.webp',
  './assets/widgets/taro-choco/duoframe.webp',
  './assets/widgets/mint-choco/clock-small.webp',
  './assets/widgets/mint-choco/clock-wide.webp',
  './assets/widgets/mint-choco/music-wide.webp',
  './assets/widgets/mint-choco/vinyl-circle.webp',
  './assets/widgets/mint-choco/moonphase-small.webp',
  './assets/widgets/mint-choco/weather-small.webp',
  './assets/widgets/mint-choco/calendar-wide.webp',
  './assets/widgets/mint-choco/polaroid-small.webp',
  './assets/widgets/mint-choco/note-paper.webp',
  './assets/widgets/mint-choco/note-tab.webp',
  './assets/widgets/mint-choco/duoframe.webp',
  './assets/widgets/universal/pf-default-1.webp',
  './assets/widgets/universal/pf-default-2.webp',
  './assets/widgets/universal/pf-default-3.webp',
  './assets/widgets/universal/pf-default-4.webp',
  './assets/widgets/universal/square.webp',
  './assets/widgets/universal/medium.webp',
  './assets/widgets/universal/wide.webp',
  './assets/widgets/universal/polaroid.webp',
  './assets/icons/animal/bag-heart.webp',
  './assets/icons/animal/book-flower.webp',
  './assets/icons/animal/bubble-leaf.webp',
  './assets/icons/animal/coin-purse.webp',
  './assets/icons/animal/corkboard.webp',
  './assets/icons/animal/gear-sprout.webp',
  './assets/icons/animal/globe-book.webp',
  './assets/icons/animal/leaf-notebook.webp',
  './assets/icons/animal/magazine.webp',
  './assets/icons/animal/melon-bag.webp',
  './assets/icons/animal/moon-cards.webp',
  './assets/icons/animal/omamori.webp',
  './assets/icons/animal/p-orange.webp',
  './assets/icons/animal/pen-letter.webp',
  './assets/icons/animal/radio-sign.webp',
  './assets/icons/animal/suitcase.webp',
  './assets/icons/animal/tv-island.webp',
  './assets/icons/animal/vinyl-note.webp',
  './assets/icons/animal/weibo-flower.webp',
  './assets/icons/animal/x-tag.webp',
  './assets/textures/tw-placeholder/1.webp',
  './assets/textures/tw-placeholder/2.webp',
  './assets/textures/tw-placeholder/3.webp',
  './assets/textures/tw-placeholder/4.webp',
  './assets/textures/tw-placeholder/5.webp'
];

// 可选外部 CDN（失败不影响 SW 安装）
const optionalUrls = [
  'https://cdn.jsdelivr.net/npm/localforage@1.10.0/dist/localforage.min.js'
];

// 安装 Service Worker
self.addEventListener('install', event => {
  console.log(`[SW] Installing version ${VERSION}`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async cache => {
        console.log('[SW] Caching core app shell (bypass HTTP cache)');
        // 使用 cache: 'reload' 绕过浏览器 HTTP 缓存，确保从服务器拉取最新文件
        await Promise.all(coreUrls.map(url =>
          fetch(url, { cache: 'reload' }).then(resp => {
            if (resp.ok) return cache.put(url, resp);
            throw new Error(`Failed to fetch ${url}: ${resp.status}`);
          })
        ));
        // CDN 资源尽力缓存，失败不阻断安装
        await Promise.allSettled(
          optionalUrls.map(url =>
            fetch(url).then(r => r.ok ? cache.put(url, r) : Promise.resolve())
              .catch(() => {})
          )
        );
        // v2.210.1 静态艺术资产预热持久缓存（已有跳过、失败不阻断安装）
        const staticCache = await caches.open(STATIC_CACHE);
        await Promise.allSettled(
          staticUrls.map(url =>
            staticCache.match(url).then(hit => hit ? null : staticCache.add(url)).catch(() => {})
          )
        );
        console.log('[SW] Skip waiting');
        return self.skipWaiting();
      })
  );
});

// 激活 Service Worker
self.addEventListener('activate', event => {
  console.log(`[SW] Activating version ${VERSION}`);
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== VENDOR_CACHE && cacheName !== STATIC_CACHE) {
            console.log(`[SW] Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Claiming clients');
      return self.clients.claim();
    }).then(() => {
      // 通知所有客户端有新版本
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_UPDATED',
            version: VERSION
          });
        });
      });
    })
  );
});

// 拦截请求 - 使用 Network First 策略确保获取最新内容
self.addEventListener('fetch', event => {
  // 只处理 GET 请求，POST/API 请求不进入缓存逻辑
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // v2.238.2 跨域 GET 不拦截：外部 API 的动态请求（拉模型列表/视频任务轮询/生图 CDN 直链下载）
  // 此前落进下方 Cache First，会把首个 200 响应永久冻结（video-gen 轮询的 ?t= 防缓存参数即此坑的旧绕法）；
  // 且请求被浏览器拦截时（如 HTTPS 页面请求 http:// 反代的 Mixed Content）会抛未捕获 rejection 制造控制台噪音。
  // 例外：optionalUrls 里的 CDN 库（localforage）仍走缓存策略保离线。
  if (url.origin !== self.location.origin && !optionalUrls.includes(event.request.url)) return;

  // vendor 大库：Cache First + 独立持久缓存（要放在下面 .js 的 Network First 分支之前）
  if (url.pathname.includes('/js/vendor/')) {
    event.respondWith(
      caches.open(VENDOR_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(response => {
            if (response && response.status === 200) {
              cache.put(event.request, response.clone());
            }
            return response;
          });
        })
      )
    );
    return;
  }

  // v2.210.1 静态艺术资产（开屏画）：Cache First + 持久缓存（同 vendor 策略）
  if (staticUrls.some(u => url.pathname.endsWith(u.slice(1)))) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(response => {
            if (response && response.status === 200) {
              cache.put(event.request, response.clone());
            }
            return response;
          });
        })
      )
    );
    return;
  }

  // 对于 HTML/JS/CSS 文件使用 Network First 策略
  if (url.pathname.endsWith('.html') ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.css') ||
      url.pathname === '/' ||
      url.pathname === './') {

    event.respondWith(
      fetch(event.request)
        .then(response => {
          // 网络请求成功，更新缓存
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // 网络请求失败，回退到缓存；导航请求兜底返回 index.html
          return caches.match(event.request).then(cached => {
            if (cached) return cached;
            if (event.request.mode === 'navigate') return caches.match('./index.html');
          });
        })
    );
  } else {
    // 其他资源（图片等）使用 Cache First 策略
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          if (response) {
            return response;
          }
          return fetch(event.request).then(response => {
            if (response && response.status === 200) {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseToCache);
              });
            }
            return response;
          });
        })
    );
  }
});
