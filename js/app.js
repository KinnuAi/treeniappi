// Käynnistys ja näkymien vaihto. Reitit ovat osoitteen #-osassa, esim. #/tilastot.
import { supabase, nykyinenIstunto } from "./supabase.js";
import * as kirjautuminen from "./views/kirjautuminen.js";
import * as etusivu from "./views/etusivu.js";
import * as uusiTreeni from "./views/uusi-treeni.js";
import * as treeni from "./views/treeni.js";
import * as tilastot from "./views/tilastot.js";
import * as liikkeet from "./views/liikkeet.js";

const reitit = {
  "": etusivu,
  uusi: uusiTreeni,
  treeni,
  tilastot,
  liikkeet,
};

const sisalto = document.getElementById("sisalto");
const toiminto = document.getElementById("toiminto");
const alanav = document.getElementById("alanav");

let kierros = 0;

async function nayta() {
  const tama = ++kierros;
  const istunto = await nykyinenIstunto();
  if (tama !== kierros) return; // uudempi näkymänvaihto on jo käynnissä

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
  alanav.hidden = false;
  for (const linkki of alanav.querySelectorAll("a")) {
    if (linkki.dataset.reitti === reitti) linkki.setAttribute("aria-current", "page");
    else linkki.removeAttribute("aria-current");
  }
  await nakyma.nayta({ sisalto, toiminto, parametri });
}

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
    const kesken = location.hash.startsWith("#/treeni");
    if (kesken) return;
    ladattu = true;
    location.reload();
  });
}
