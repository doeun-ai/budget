// 앱 화면 파일만 저장해 두고(빠르게 열림), 데이터는 항상 인터넷에서 새로 받아요.
const CACHE = 'budget-v1';
const SHELL = ['./', './index.html', './style.css?v=1', './app.js?v=1', './api.js', './config.js', './vendor/standalone.module.js', './manifest.webmanifest', './icons/icon-180.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // 새 버전이 있으면 받아오고, 인터넷이 없으면 저장본 사용
  e.respondWith(fetch(e.request).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; }).catch(() => caches.match(e.request)));
});
