/* Service worker — Mi plan (versión 202609290003) */
var V = 'gym-202609290003', MEDIA = 'gym-media';
var SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(V).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== V && k !== MEDIA; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin === location.origin) {
    // La app: primero red (para recibir actualizaciones), si no hay señal la copia guardada
    e.respondWith(fetch(req).then(function (r) {
      if (r.ok) { var cp = r.clone(); caches.open(V).then(function (c) { c.put(req, cp); }); }
      return r;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (r) { return r || caches.match('./index.html'); });
    }));
    return;
  }
  if (/fonts\.(googleapis|gstatic)\.com|raw\.githubusercontent\.com|lh3\.googleusercontent\.com|drive\.google\.com/.test(url.host)) {
    // Fuentes y fotos de ejercicios: lo guardado primero, y se refresca por detrás
    e.respondWith(caches.open(MEDIA).then(function (c) {
      return c.match(req).then(function (hit) {
        var red = fetch(req).then(function (r) { if (r.ok) c.put(req, r.clone()); return r; }).catch(function () { return hit; });
        return hit || red;
      });
    }));
  }
});
