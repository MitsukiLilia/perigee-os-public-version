// Service Worker for Perigee OS
// 版本号：每次更新代码时修改此版本号以强制更新缓存
const VERSION = '2.175.0';
const CACHE_NAME = `perigee-os-v${VERSION}`;

// 核心本地资源（必须全部成功，否则 SW 安装失败）
const coreUrls = [
  './',
  './index.html',
  './style.css',
  './css/themes.css',
  './app.js',
  './manifest.json',
  './icon-192-v5.png',
  './icon-512-v5.png',
  './icon-512-maskable-v5.png',
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
  './js/forum.js',
  './js/broadcast.js',
  './js/pixiv-novel.js',
  './js/illust-gallery.js',
  './js/twitter.js',
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
  './js/widgets.js',
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
  './js/desktop-edit.js',
  './js/liquid-glass.js',
  './js/i18n.js',
  './js/i18n-zh.js',
  './js/i18n-ja.js',
  './js/i18n-en.js',
  './js/help-content.js',
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
  './assets/textures/sheikah.svg',
  './assets/textures/leaf.svg',
  './assets/textures/seascape-bg.webp',
  './assets/textures/seascape-bg-blur.webp',
  './assets/textures/night-sky-bg.webp',
  './assets/textures/journal-bg.webp',
  './assets/textures/magazine-cover-bg.webp',
  './assets/textures/strawberry-bg.webp',
  './assets/textures/snow-country-bg.webp',
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
          if (cacheName !== CACHE_NAME) {
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
