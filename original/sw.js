/* =========================================================
   Service Worker — オフライン（機内モード）でも動かすための仕組み
   初回アクセス時にアプリのファイルを端末に保存し、
   以降はネットがなくても保存したファイルで起動します。

   ※ ファイル構成を変えたときは CACHE_VERSION の数字を上げてください。
   ========================================================= */
const CACHE_VERSION = 'flightlog-v1';

const APP_FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// インストール時：アプリのファイルをまとめて保存
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

// 有効化時：古いバージョンのキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 読み込み時：保存済みのファイルをすぐ返し、ネットがあれば裏で最新版に更新
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // ページ本体（index.html）へのアクセスは # や ?付きでも同じものを返す
  const cacheKey = req.mode === 'navigate' ? './index.html' : req;

  event.respondWith(
    caches.open(CACHE_VERSION).then((cache) =>
      cache.match(cacheKey, { ignoreSearch: true }).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) cache.put(cacheKey, res.clone());
            return res;
          })
          .catch(() => cached);
        // キャッシュがあれば即座に返す（オフラインでも速い）
        if (cached) {
          event.waitUntil(network.catch(() => {}));
          return cached;
        }
        return network;
      })
    )
  );
});
