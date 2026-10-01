/* Service worker — Enfoque (versión 202610012035) */
var V = 'gym-202610012035', MEDIA = 'gym-media-v2', MEDIA_MAX = 150;
// './' es lo que pide la app al abrir (start_url); './index.html' era lo mismo bajado dos veces
var SHELL = ['./', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(V).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== V && k !== MEDIA; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
// La caché de fotos y fuentes no crece sin tope: se borran las entradas más viejas
function recortar(c, max) {
  return c.keys().then(function (ks) {
    if (ks.length <= max) return;
    return Promise.all(ks.slice(0, ks.length - max).map(function (k) { return c.delete(k); }));
  });
}
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin === location.origin) {
    // La app: lo guardado primero (abre al instante, sin esperar la red) y se refresca por detrás para la próxima vez.
    // Cuando se publica una versión, el sw.js nuevo baja el HTML nuevo al instalarse y la app se recarga sola (controllerchange).
    e.respondWith(caches.open(V).then(function (c) {
      return c.match(req, { ignoreSearch: true }).then(function (hit) {
        var red = fetch(req).then(function (r) {
          if (r.ok) e.waitUntil(c.put(req, r.clone()).catch(function () {}));
          return r;
        });
        if (hit) { e.waitUntil(red.catch(function () {})); return hit; }
        return red.catch(function () { return c.match('./'); });
      });
    }));
    return;
  }
  if (/fonts\.(googleapis|gstatic)\.com|raw\.githubusercontent\.com|lh3\.googleusercontent\.com|drive\.google\.com/.test(url.host)) {
    // Fuentes y fotos: lo guardado primero. Las <img> y <link> a otro origen llegan como respuestas "opacas" (r.ok es false
    // aunque estén bien): también se guardan (antes la caché quedaba siempre vacía) y se refrescan por detrás.
    // Las fotos de ejercicios (raw.githubusercontent.com) no cambian: si están guardadas no se vuelven a bajar (630–810 KB por
    // apertura en 4G); se piden con CORS (ese servidor lo permite) para ver el estado real y no guardar una foto rota.
    var esFoto = /raw\.githubusercontent\.com/.test(url.host);
    e.respondWith(caches.open(MEDIA).then(function (c) {
      return c.match(req).then(function (hit) {
        if (hit && esFoto) return hit;
        var pedido = esFoto ? fetch(req.url, { mode: 'cors', credentials: 'omit' }).catch(function () { return fetch(req); }) : fetch(req);
        var red = pedido.then(function (r) {
          if (r.ok || (!esFoto && r.type === 'opaque')) e.waitUntil(c.put(req, r.clone()).then(function () { return recortar(c, MEDIA_MAX); }).catch(function () {}));
          return r;
        });
        if (hit) { e.waitUntil(red.catch(function () {})); return hit; }
        return red;
      });
    }));
  }
});
// Avisos en el celular (Push.gs → proxy → Apple/Google): se muestran aunque la app esté cerrada o el celular bloqueado
self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { texto: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.titulo || 'Enfoque', { body: d.texto || '', icon: './icon-192.png', badge: './icon-192.png',
    tag: d.tag || undefined, renotify: !!d.tag, data: { url: d.url || './' } }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (ws) {
    for (var i = 0; i < ws.length; i++) { if ('focus' in ws[i]) return ws[i].focus(); }
    return self.clients.openWindow((e.notification.data && e.notification.data.url) || './');
  }));
});
