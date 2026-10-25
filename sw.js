// 最簡單的 Service Worker：只是讓瀏覽器認定這是可安裝的 App（加入主畫面 / 安裝）。
// 不做離線快取，所有請求都直接走網路，所以更新檔案後使用者一定拿到最新版。
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => { e.respondWith(fetch(e.request)); });
