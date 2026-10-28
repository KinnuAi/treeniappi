import { h, ikoni, kpl } from "../dom.js";
import { lyhytPvm } from "../aika.js";
import { haeKerta, tallennaSarja, lopetaTreeni, odotaTallennukset } from "../data.js";
import { tavoiteteksti } from "../pikavalinnat.js";
import { avaaPaneeli, vahvista } from "../paneeli.js";
import * as jono from "../sync.js";

// Treeninäkymä: kaikki liikkeet allekkain. Yksi napautus sarjanappiin kuittaa sarjan
// tavoitemäärällä, uusi napautus perii kuittauksen. Kynä avaa liikkeen määrät muokattaviksi.
export const piilotaNav = true;

export async function nayta({ sisalto, toiminto, parametri }) {
  let kerta;
  try {
    await odotaTallennukset();
    kerta = parametri ? await haeKerta(parametri) : null;
  } catch {
    sisalto.append(h("p", { class: "ilmoitus" }, ikoni("wifi-off"), h("span", {}, "Treeniä ei saatu haettua.")));
    return;
  }
  if (!kerta) {
    sisalto.append(h("header", { class: "otsikko" }, h("h2", {}, "Treeniä ei löytynyt")));
    toiminto.append(h("a", { href: "#/", class: "nappi nappi--reuna nappi--lg nappi--taysi" }, "Etusivulle"));
    return;
  }

  const kaikkiSarjat = () => kerta.liikkeet.flatMap((kl) => kl.sarjat);
  const edistyminen = h("span", { class: "treeniotsikko__edistyminen" });
  const tallennustila = h("p", { class: "tallennustila", role: "status", hidden: true },
    ikoni("wifi-off", "sm"), h("span", {}, "Tallentamatta, lähetetään kun yhteys toimii"));

  function paivitaEdistyminen() {
    const sarjat = kaikkiSarjat();
    edistyminen.textContent = `${sarjat.filter((s) => s.tehty).length} / ${sarjat.length} sarjaa`;
  }

  sisalto.append(
    h("header", { class: "treeniotsikko" },
      h("a", { href: "#/", class: "ikoninappi treeniotsikko__takaisin", "aria-label": "Etusivulle" }, ikoni("chevron-left")),
      h("p", { class: "eyebrow treeniotsikko__pvm" }, lyhytPvm(kerta.paiva)),
      edistyminen
    ),
    tallennustila,
    h("div", { class: "liikkeet" }, kerta.liikkeet.map(liikelohko))
  );
  paivitaEdistyminen();

  // Pieni ilmoitus vain, jos jotain on ollut tallentamatta yli kaksi sekuntia
  let ilmoitusAjastin = null;
  const lopetaKuuntelu = jono.kuuntele((maara) => {
    clearTimeout(ilmoitusAjastin);
    if (maara === 0) tallennustila.hidden = true;
    else ilmoitusAjastin = setTimeout(() => (tallennustila.hidden = jono.odottavia() === 0), 2000);
  });

  // Alareunan nappi
  const virheTeksti = h("span");
  const virhe = h("p", { class: "ilmoitus", role: "alert", hidden: true }, ikoni("circle-alert"), virheTeksti);
  if (kerta.tila === "valmis") {
    toiminto.append(h("a", { href: `#/yhteenveto/${kerta.id}`, class: "nappi nappi--kulta nappi--lg nappi--taysi" }, "Valmis"));
  } else {
    const lopeta = h("button", { type: "button", class: "nappi nappi--kulta nappi--lg nappi--taysi" }, "Lopeta treeni");
    lopeta.addEventListener("click", async () => {
      virhe.hidden = true;
      const kesken = kaikkiSarjat().filter((s) => !s.tehty).length;
      if (kesken > 0) {
        const ok = await vahvista({
          otsikko: "Lopetetaanko treeni?",
          teksti: `${kesken} ${kpl(kesken, "sarja on", "sarjaa on")} kuittaamatta. Ne jäävät tekemättömiksi.`,
          kylla: "Lopeta",
          ei: "Jatka treeniä",
        });
        if (!ok) return;
      }
      lopeta.disabled = true;
      lopeta.textContent = "Tallennetaan";
      try {
        await lopetaTreeni(kerta.id);
        location.hash = `#/yhteenveto/${kerta.id}`;
      } catch {
        virheTeksti.textContent = "Tallennus ei onnistunut. Tarkista verkkoyhteys ja kokeile uudelleen.";
        virhe.hidden = false;
        lopeta.disabled = false;
        lopeta.textContent = "Lopeta treeni";
      }
    });
    toiminto.append(virhe, lopeta);
  }

  // Näyttö pysyy päällä treenin ajan, jos selain tukee sitä
  let lukko = null;
  async function pyydaLukko() {
    try {
      lukko = await navigator.wakeLock?.request("screen");
    } catch {
      lukko = null;
    }
  }
  function nakyvyys() {
    if (document.visibilityState === "visible") pyydaLukko();
  }
  if (kerta.tila === "kaynnissa") {
    pyydaLukko();
    document.addEventListener("visibilitychange", nakyvyys);
  }

  return () => {
    lopetaKuuntelu();
    clearTimeout(ilmoitusAjastin);
    document.removeEventListener("visibilitychange", nakyvyys);
    lukko?.release().catch(() => {});
  };

  // ---------- Liike ----------
  function liikelohko(kl) {
    const mittari = kl.liike.mittari;
    const rivi = h("div", { class: "sarjat" });
    const lisaa = h("button", { type: "button", class: "ikoninappi", "aria-label": `${kl.liike.nimi}: lisää sarja` }, ikoni("plus"));

    // Enintään kuusi saraketta; pidemmät sarjat jaetaan tasan kahdelle riville (10 -> 5 + 5)
    function piirra() {
      const n = kl.sarjat.length;
      rivi.style.setProperty("--sarakkeet", String(n <= 6 ? n : Math.ceil(n / 2)));
      rivi.replaceChildren(...kl.sarjat.map((s) => sarjanappi(kl, s)));
    }

    lisaa.addEventListener("click", () => {
      const s = {
        id: crypto.randomUUID(),
        kerran_liike_id: kl.id,
        sarjanumero: Math.max(0, ...kl.sarjat.map((x) => x.sarjanumero)) + 1,
        maara: kl.tavoite,
        tehty: false,
        tehty_aika: null,
      };
      kl.sarjat.push(s);
      tallennaSarja(s);
      piirra();
      paivitaEdistyminen();
    });

    const muokkaa = h("button", { type: "button", class: "ikoninappi", "aria-label": `${kl.liike.nimi}: muokkaa määriä` }, ikoni("pencil"));
    muokkaa.addEventListener("click", () => muokkaaMaaria(kl, () => { piirra(); paivitaEdistyminen(); }));

    piirra();
    return h("section", { class: "liike" },
      h("div", { class: "liike__otsikko" },
        h("h3", { class: "liike__nimi" }, kl.liike.nimi, " ",
          h("span", { class: "liike__tavoite" }, tavoiteteksti(kl.sarjamaara, kl.tavoite, mittari))),
        lisaa,
        muokkaa
      ),
      rivi
    );
  }

  function sarjanappi(kl, s) {
    const nappi = h("button", { type: "button", class: "sarja" });
    const poikkeama = h("span", { class: "sarja__maara" });

    function piirra() {
      nappi.setAttribute("aria-pressed", s.tehty ? "true" : "false");
      nappi.setAttribute("aria-label", `Sarja ${s.sarjanumero}, ${s.maara}${kl.liike.mittari === "sekunnit" ? " s" : ""}`);
      nappi.replaceChildren(s.tehty ? ikoni("check", "sm") : "", String(s.sarjanumero));
      poikkeama.textContent = s.maara !== kl.tavoite ? String(s.maara) : "";
    }

    nappi.addEventListener("click", () => {
      s.tehty = !s.tehty;
      s.tehty_aika = s.tehty ? new Date().toISOString() : null;
      piirra();
      tallennaSarja(s);
      paivitaEdistyminen();
    });

    piirra();
    return h("div", { class: "sarja__solu" }, nappi, poikkeama);
  }
}

// Paneeli, jossa liikkeen jokaisen sarjan määrää voi muuttaa. Muutettu sarja kuitataan tehdyksi.
function muokkaaMaaria(kl, valmis) {
  const yksikko = kl.liike.mittari === "sekunnit" ? " s" : "";
  const askel = kl.liike.mittari === "sekunnit" ? 5 : 1;
  const uudet = new Map(kl.sarjat.map((s) => [s.id, s.maara]));

  const rivit = kl.sarjat.map((s) => {
    const kentta = h("input", {
      class: "syote syote--maara", type: "text", inputmode: "numeric", pattern: "[0-9]*", maxlength: "3",
      value: String(s.maara), "aria-label": `Sarja ${s.sarjanumero}${yksikko ? ", sekunnit" : ", toistot"}`,
    });
    const aseta = (n) => {
      const arvo = Math.max(0, Math.min(999, n));
      uudet.set(s.id, arvo);
      kentta.value = String(arvo);
    };
    kentta.addEventListener("input", () => {
      kentta.value = kentta.value.replace(/\D/g, "");
      uudet.set(s.id, Number(kentta.value) || 0);
    });
    return h("li", { class: "maararivi" },
      h("span", { class: "maararivi__nimi" }, `Sarja ${s.sarjanumero}`,
        s.tehty ? null : h("span", { class: "rivi__lisa" }, " ei kuitattu")),
      h("button", { type: "button", class: "ikoninappi ikoninappi--reuna", "aria-label": "Vähemmän", onclick: () => aseta(uudet.get(s.id) - askel) }, ikoni("minus")),
      kentta,
      h("button", { type: "button", class: "ikoninappi ikoninappi--reuna", "aria-label": "Enemmän", onclick: () => aseta(uudet.get(s.id) + askel) }, ikoni("plus"))
    );
  });

  const p = avaaPaneeli({
    otsikko: kl.liike.nimi,
    sisalto: h("ul", { class: "maararivit" }, rivit),
    toiminnot: [
      h("button", { type: "button", class: "nappi nappi--reuna nappi--lg", onclick: () => p.sulje() }, "Peru"),
      h("button", {
        type: "button", class: "nappi nappi--violetti nappi--lg",
        onclick: () => {
          for (const s of kl.sarjat) {
            const arvo = uudet.get(s.id);
            if (arvo === s.maara) continue;
            s.maara = arvo;
            if (!s.tehty && arvo > 0) {
              s.tehty = true;
              s.tehty_aika = new Date().toISOString();
            }
            tallennaSarja(s);
          }
          p.sulje();
          valmis();
        },
      }, "Tallenna"),
    ],
  });
}
