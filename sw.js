// Service worker: sovelluksen kuori välimuistiin, jotta sovellus aukeaa myös ilman verkkoa.
// Kun tiedostoja muutetaan, nosta VERSIO-numeroa.
const VERSIO = "treeni-v3";

const KUORI = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/tokens.css",
  "./css/app.css",
  "./js/app.js",
  "./js/supabase.js",
  "./js/data.js",
  "./js/aika.js",
  "./js/dom.js",
  "./js/pikavalinnat.js",
  "./js/views/kirjautuminen.js",
  "./js/views/treeni.js",
  "./js/views/etusivu.js",
  "./js/views/uusi-treeni.js",
  "./js/views/tilastot.js",
  "./js/views/liikkeet.js",
  "./fonts/Geist-VariableFont.ttf",
  "./fonts/BricolageGrotesque-VariableFont.ttf",
  "./icons/logo-gold.svg",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/ui/check.svg",
  "./icons/ui/plus.svg",
  "./icons/ui/minus.svg",
  "./icons/ui/x.svg",
  "./icons/ui/log-out.svg",
  "./icons/ui/circle-alert.svg",
  "./icons/ui/chevron-left.svg",
  "./icons/ui/pencil.svg",
  "./icons/ui/trash-2.svg",
  "./icons/ui/wifi-off.svg",
];

// GitHub Pages käskee selainta pitämään tiedostot 10 min omassa välimuistissaan.
// cache: "reload" ja "no-cache" ohittavat sen, jotta päivitykset tulevat heti.
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSIO)
      .then((c) => c.addAll(KUORI.map((osoite) => new Request(osoite, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((avaimet) => Promise.all(avaimet.filter((a) => a !== VERSIO).map((a) => caches.delete(a))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const pyynto = e.request;
  if (pyynto.method !== "GET") return;
  const osoite = new URL(pyynto.url);

  // Oma koodi: verkosta ensin (päivitykset näkyvät heti), välimuistista jos verkkoa ei ole
  if (osoite.origin === self.location.origin) {
    e.respondWith(
      fetch(pyynto, { cache: "no-cache" })
        .then((vastaus) => {
          if (vastaus.ok) {
            const kopio = vastaus.clone();
            caches.open(VERSIO).then((c) => c.put(pyynto, kopio));
          }
          return vastaus;
        })
        .catch(() =>
          caches.match(pyynto, { ignoreSearch: true })
            .then((v) => v || (pyynto.mode === "navigate" ? caches.match("./index.html") : undefined))
        )
    );
    return;
  }

  // Supabase-kirjasto CDN:stä: versio on lukittu, joten välimuistista ensin
  if (osoite.hostname === "cdn.jsdelivr.net") {
    e.respondWith(
      caches.match(pyynto).then((v) =>
        v ||
        fetch(pyynto).then((vastaus) => {
          if (vastaus.ok) {
            const kopio = vastaus.clone();
            caches.open(VERSIO).then((c) => c.put(pyynto, kopio));
          }
          return vastaus;
        })
      )
    );
  }
  // Tietokantakutsut (supabase.co) menevät suoraan verkkoon
});
