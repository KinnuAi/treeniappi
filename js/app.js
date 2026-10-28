// Käynnistys ja näkymien vaihto. Reitit ovat osoitteen #-osassa, esim. #/tilastot.
import { supabase, nykyinenIstunto } from "./supabase.js";
import { odottavia, kuuntele } from "./sync.js";
import { ikoni } from "./dom.js";
import * as kirjautuminen from "./views/kirjautuminen.js";
import * as etusivu from "./views/etusivu.js";
import * as uusiTreeni from "./views/uusi-treeni.js";
import * as treeni from "./views/treeni.js";
import * as yhteenveto from "./views/yhteenveto.js";
import * as tilastot from "./views/tilastot.js";
import * as liikkeet from "./views/liikkeet.js";

const reitit = {
  "": etusivu,
  uusi: uusiTreeni,
  treeni,
  yhteenveto,
  tilastot,
  liikkeet,
};

const sisalto = document.getElementById("sisalto");
const toiminto = document.getElementById("toiminto");
const alanav = document.getElementById("alanav");

let kierros = 0;
let siivous = null; // edellisen näkymän lopetus (esim. näytön päälläpito)

async function nayta() {
  const tama = ++kierros;
  const istunto = await nykyinenIstunto();
  if (tama !== kierros) return; // uudempi näkymänvaihto on jo käynnissä

  siivous?.();
  siivous = null;
  document.querySelector(".verho")?.remove();
  sisalto.replaceChildren();
  toiminto.replaceChildren();
  window.scrollTo(0, 0);

  if (!istunto) {
    alanav.hidden = true;
    kirjautuminen.nayta({ sisalto, toiminto, valmis: nayta });
    return;
  }

  const [reitti, parametri] = location.hash.replace(/^#\/?/, "").split("/");
  const nakyma = reitit[reitti] ?? etusivu;
  alanav.hidden = !!nakyma.piilotaNav;
  for (const linkki of alanav.querySelectorAll("a")) {
    if (linkki.dataset.reitti === reitti) linkki.setAttribute("aria-current", "page");
    else linkki.removeAttribute("aria-current");
  }
  const lopetus = await nakyma.nayta({ sisalto, toiminto, parametri });
  if (tama === kierros) siivous = typeof lopetus === "function" ? lopetus : null;
  else lopetus?.();
}

// Yhteystilan ilmaisin: näkyy vain, kun jotain on ollut lähettämättä yli kaksi sekuntia
// (Luodaan tarvittaessa: päivityksen ensimmäisellä kerralla sivupohja voi olla vielä vanha.)
let synkronointi = document.getElementById("synkronointi");
if (!synkronointi) {
  synkronointi = Object.assign(document.createElement("p"), { id: "synkronointi", className: "synkronointi", hidden: true });
  synkronointi.setAttribute("role", "status");
  document.querySelector(".alaosa")?.prepend(synkronointi);
}
synkronointi.append(ikoni("wifi-off", "sm"), "Tallennettu puhelimeen, odottaa yhteyttä");
let ilmaisinAjastin = null;
function paivitaIlmaisin(maara) {
  clearTimeout(ilmaisinAjastin);
  if (maara === 0) synkronointi.hidden = true;
  else ilmaisinAjastin = setTimeout(() => (synkronointi.hidden = odottavia() === 0), 2000);
}
kuuntele(paivitaIlmaisin);
paivitaIlmaisin(odottavia());

window.addEventListener("hashchange", nayta);
supabase.auth.onAuthStateChange((tapahtuma) => {
  if (tapahtuma === "SIGNED_OUT") nayta();
});
nayta();

// Päivitykset: kotinäytön sovellus jää usein muistiin auki, joten uusi versio
// tarkistetaan aina, kun sovellus tuodaan esiin. Uusi versio otetaan käyttöön
// latauksella, mutta ei kesken treenin.
if ("serviceWorker" in navigator) {
  const oliOhjaaja = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).then((rekisteri) => {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") rekisteri.update();
    });
  });
  let ladattu = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!oliOhjaaja || ladattu) return;
    const kesken = location.hash.startsWith("#/treeni") || odottavia() > 0;
    if (kesken) return;
    ladattu = true;
    location.reload();
  });
}
