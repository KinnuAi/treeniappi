import { h, ikoni, kpl } from "../dom.js";
import { lyhytPvm } from "../aika.js";
import {
  haeKerta, liikkeet, tallennaSarja, poistaSarja, lisaaKerranLiike, poistaKerranLiike,
  vaihdaPaiva, lopetaTreeni, poistaKerta, odotaTallennukset,
} from "../data.js";
import { tavoiteteksti } from "../pikavalinnat.js";
import { avaaPaneeli, vahvista } from "../paneeli.js";
import { liikevalitsin } from "../liikevalinta.js";
import * as jono from "../sync.js";

// Treeninäkymä. Sama näkymä toimii treenin aikana ja muokkauksessa jälkikäteen (tila = valmis).
// Yksi napautus sarjanappiin kuittaa sarjan tavoitemäärällä, uusi napautus perii kuittauksen.
// Kynä avaa liikkeen määrät muokattaviksi, + lisää sarjan.
export const piilotaNav = true;

export async function nayta({ sisalto, toiminto, parametri }) {
  let kerta;
  try {
    await odotaTallennukset();
    kerta = parametri ? await haeKerta(parametri) : null;
  } catch {
    sisalto.append(h("p", { class: "ilmoitus" }, ikoni("wifi-off"), h("span", {}, "Treeniä ei saatu haettua.")));
    toiminto.append(h("a", { href: "#/", class: "nappi nappi--reuna nappi--lg nappi--taysi" }, "Etusivulle"));
    return;
  }
  if (!kerta) {
    sisalto.append(h("header", { class: "otsikko" }, h("h2", {}, "Treeniä ei löytynyt")));
    toiminto.append(h("a", { href: "#/", class: "nappi nappi--reuna nappi--lg nappi--taysi" }, "Etusivulle"));
    return;
  }

  const muokkaus = kerta.tila === "valmis";
  const kaikkiSarjat = () => kerta.liikkeet.flatMap((kl) => kl.sarjat);
  const pvm = h("p", { class: "eyebrow treeniotsikko__pvm" }, muokkaus ? `Muokkaus, ${lyhytPvm(kerta.paiva)}` : lyhytPvm(kerta.paiva));
  const edistyminen = h("span", { class: "treeniotsikko__edistyminen" });
  const tallennustila = h("p", { class: "tallennustila", role: "status", hidden: true },
    ikoni("wifi-off", "sm"), h("span", {}, "Tallentamatta, lähetetään kun yhteys toimii"));
  const lohkot = h("div", { class: "liikkeet" });

  function paivitaEdistyminen() {
    const sarjat = kaikkiSarjat();
    edistyminen.textContent = `${sarjat.filter((s) => s.tehty).length} / ${sarjat.length} sarjaa`;
  }

  const lisaaLiike = h("button", { type: "button", class: "nappi nappi--reuna nappi--taysi lisaa-liike" }, ikoni("plus"), "Lisää liike");
  lisaaLiike.addEventListener("click", avaaLiikkeenLisays);

  sisalto.append(
    h("header", { class: "treeniotsikko" },
      h("a", { href: "#/", class: "ikoninappi treeniotsikko__takaisin", "aria-label": "Etusivulle" }, ikoni("chevron-left")),
      pvm,
      edistyminen
    ),
    tallennustila,
    lohkot,
    lisaaLiike,
    muokkaus ? tiedot() : null,
    h("button", { type: "button", class: "nappi nappi--haamu nappi--sm poisto", onclick: poistaTreeni },
      ikoni("trash-2", "sm"), "Poista treeni")
  );
  lohkot.append(...kerta.liikkeet.map(liikelohko));
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
  if (muokkaus) {
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
  if (!muokkaus) {
    pyydaLukko();
    document.addEventListener("visibilitychange", nakyvyys);
  }

  return () => {
    lopetaKuuntelu();
    clearTimeout(ilmoitusAjastin);
    document.removeEventListener("visibilitychange", nakyvyys);
    lukko?.release().catch(() => {});
  };

  // ---------- Treenin tiedot (vain muokkauksessa) ----------
  function tiedot() {
    const paiva = h("input", { id: "paiva", class: "syote syote--pvm", type: "date", value: kerta.paiva, required: true });
    paiva.addEventListener("change", () => {
      if (!paiva.value || paiva.value === kerta.paiva) return;
      kerta.paiva = paiva.value;
      pvm.textContent = `Muokkaus, ${lyhytPvm(kerta.paiva)}`;
      vaihdaPaiva(kerta.id, kerta.paiva);
    });
    return h("div", { class: "kentta tiedot" }, h("label", { for: "paiva" }, "Päivä"), paiva);
  }

  async function poistaTreeni() {
    const ok = await vahvista({
      otsikko: "Poistetaanko treeni?",
      teksti: "Treeni ja sen kaikki sarjat poistetaan. Tätä ei voi perua.",
      kylla: "Poista",
      ei: "Peru",
    });
    if (!ok) return;
    try {
      await poistaKerta(kerta.id);
      location.hash = "#/";
    } catch {
      virheTeksti.textContent = "Poisto ei onnistunut. Tarkista verkkoyhteys ja kokeile uudelleen.";
      virhe.hidden = false;
      if (!virhe.isConnected) toiminto.prepend(virhe);
    }
  }

  // ---------- Liikkeen lisäys ----------
  async function avaaLiikkeenLisays() {
    let lista;
    try {
      lista = await liikkeet();
    } catch {
      virheTeksti.textContent = "Liikkeitä ei saatu haettua. Tarkista verkkoyhteys.";
      virhe.hidden = false;
      if (!virhe.isConnected) toiminto.prepend(virhe);
      return;
    }
    const mukana = new Set(kerta.liikkeet.map((kl) => kl.liike.id));
    const vapaat = lista.filter((l) => !mukana.has(l.id));
    const lisaa = h("button", { type: "button", class: "nappi nappi--violetti nappi--lg", disabled: true }, "Lisää");
    const valitsin = liikevalitsin(vapaat, (maara) => (lisaa.disabled = maara === 0));
    const p = avaaPaneeli({
      otsikko: "Lisää liike",
      sisalto: vapaat.length ? valitsin.elementti : h("p", { class: "paneeli__teksti" }, "Kaikki liikkeet ovat jo treenissä."),
      toiminnot: [h("button", { type: "button", class: "nappi nappi--reuna nappi--lg", onclick: () => p.sulje() }, "Peru"), lisaa],
    });
    lisaa.addEventListener("click", () => {
      if (!valitsin.tarkista()) return;
      let jarjestys = Math.max(0, ...kerta.liikkeet.map((kl) => kl.jarjestys));
      for (const v of valitsin.valinnat()) {
        jarjestys += 10;
        const kl = lisaaKerranLiike(kerta.id, v, jarjestys);
        kerta.liikkeet.push(kl);
        lohkot.append(liikelohko(kl));
      }
      paivitaEdistyminen();
      p.sulje();
    });
  }

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

    const muokkaa = h("button", { type: "button", class: "ikoninappi", "aria-label": `${kl.liike.nimi}: muokkaa` }, ikoni("pencil"));
    const lohko = h("section", { class: "liike" },
      h("div", { class: "liike__otsikko" },
        h("h3", { class: "liike__nimi" }, kl.liike.nimi, " ",
          h("span", { class: "liike__tavoite" }, tavoiteteksti(kl.sarjamaara, kl.tavoite, mittari))),
        lisaa,
        muokkaa
      ),
      rivi
    );

    muokkaa.addEventListener("click", () =>
      muokkaaLiiketta(kl, {
        muuttui: () => { piirra(); paivitaEdistyminen(); },
        poistettu: () => {
          kerta.liikkeet.splice(kerta.liikkeet.indexOf(kl), 1);
          lohko.remove();
          paivitaEdistyminen();
        },
      })
    );

    piirra();
    return lohko;
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

// Liikkeen muokkaus: sarjojen määrät, viimeisen sarjan poisto ja koko liikkeen poisto.
// Muutettu sarja kuitataan tehdyksi. Muutokset tallentuvat Tallenna-napista.
function muokkaaLiiketta(kl, { muuttui, poistettu }) {
  const yksikko = kl.liike.mittari === "sekunnit" ? ", sekunnit" : ", toistot";
  const askel = kl.liike.mittari === "sekunnit" ? 5 : 1;
  const uudet = new Map(kl.sarjat.map((s) => [s.id, s.maara]));
  const poistettavat = new Set();
  const lista = h("ul", { class: "maararivit" });

  const rivit = kl.sarjat.map((s) => {
    const kentta = h("input", {
      class: "syote syote--maara", type: "text", inputmode: "numeric", pattern: "[0-9]*", maxlength: "3",
      value: String(s.maara), "aria-label": `Sarja ${s.sarjanumero}${yksikko}`,
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
    return h("li", { class: "maararivi", "data-id": s.id },
      h("span", { class: "maararivi__nimi" }, `Sarja ${s.sarjanumero}`,
        s.tehty ? null : h("span", { class: "rivi__lisa" }, " ei kuitattu")),
      h("button", { type: "button", class: "ikoninappi ikoninappi--reuna", "aria-label": "Vähemmän", onclick: () => aseta(uudet.get(s.id) - askel) }, ikoni("minus")),
      kentta,
      h("button", { type: "button", class: "ikoninappi ikoninappi--reuna", "aria-label": "Enemmän", onclick: () => aseta(uudet.get(s.id) + askel) }, ikoni("plus"))
    );
  });
  lista.append(...rivit);

  // Viimeinen jäljellä oleva sarja poistetaan vain poistamalla koko liike
  const poistaSarjaNappi = h("button", { type: "button", class: "nappi nappi--haamu nappi--sm" }, ikoni("minus", "sm"), "Poista viimeinen sarja");
  const jaljella = () => kl.sarjat.filter((s) => !poistettavat.has(s.id));
  const paivitaPoisto = () => (poistaSarjaNappi.disabled = jaljella().length <= 1);
  poistaSarjaNappi.addEventListener("click", () => {
    const viimeinen = jaljella().at(-1);
    if (!viimeinen || jaljella().length <= 1) return;
    poistettavat.add(viimeinen.id);
    lista.querySelector(`[data-id="${viimeinen.id}"]`)?.remove();
    paivitaPoisto();
  });
  paivitaPoisto();

  const poistaLiikeNappi = h("button", { type: "button", class: "nappi nappi--haamu nappi--sm" }, ikoni("trash-2", "sm"), "Poista liike treenistä");
  poistaLiikeNappi.addEventListener("click", async () => {
    p.sulje();
    const ok = await vahvista({
      otsikko: `Poistetaanko ${kl.liike.nimi}?`,
      teksti: "Liike ja sen sarjat poistetaan tästä treenistä.",
      kylla: "Poista",
      ei: "Peru",
    });
    if (!ok) return;
    poistaKerranLiike(kl);
    poistettu();
  });

  const p = avaaPaneeli({
    otsikko: kl.liike.nimi,
    sisalto: h("div", {}, lista, h("div", { class: "paneeli__lisatoiminnot" }, poistaSarjaNappi, poistaLiikeNappi)),
    toiminnot: [
      h("button", { type: "button", class: "nappi nappi--reuna nappi--lg", onclick: () => p.sulje() }, "Peru"),
      h("button", {
        type: "button", class: "nappi nappi--violetti nappi--lg",
        onclick: () => {
          for (const s of kl.sarjat.filter((x) => poistettavat.has(x.id))) poistaSarja(s);
          kl.sarjat = kl.sarjat.filter((s) => !poistettavat.has(s.id));
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
          muuttui();
        },
      }, "Tallenna"),
    ],
  });
}
