var CACHE_NAME = "seg-v3";
var URLS_TO_CACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/ban.html",
  "/verified.html",
  "/signout.html",
  "/css/styles.css",
  "/assets/icon-192.svg",
  "/assets/icon-512.svg",
  "https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap",
  "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap",
  "https://cdn.tailwindcss.com?plugins=forms",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.min.js"
];

self.addEventListener("install", function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(URLS_TO_CACHE);
    }).then(function() { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(e) {
  e.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(names.map(function(n) {
        if (n !== CACHE_NAME) return caches.delete(n);
      }));
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(e) {
  var url = new URL(e.request.url);
  if (url.pathname.includes("/js/")) {
    e.respondWith(
      caches.open(CACHE_NAME).then(function(cache) {
        return fetch(e.request).then(function(resp) {
          cache.put(e.request, resp.clone());
          return resp;
        }).catch(function() { return caches.match(e.request); });
      })
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(function(resp) {
      return resp || fetch(e.request).catch(function() {
        if (e.request.mode === "navigate") return caches.match("/index.html");
      });
    })
  );
});
