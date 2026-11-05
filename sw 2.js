// 앱 화면 파일만 캐시 (데이터는 항상 시트에서 새로 받음)
var CACHE = 'hm-v27';
var FILES = ['./', './index.html', './style.css', './app.js', './manifest.webmanifest', './icon.svg', './icon-192.png'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); })); self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); })); self.clients.claim(); });
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // 네트워크 우선, 실패하면 캐시
  e.respondWith(fetch(e.request).then(function (r) { var cp = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, cp); }); return r; }).catch(function () { return caches.match(e.request); }));
});
