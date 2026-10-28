import { h, ikoni } from "../dom.js";
import { kaikkiLiikkeet, tallennaLiike, liikettaKaytetty, poistaLiike } from "../data.js";
import { vahvista } from "../paneeli.js";

// Liikkeen lisäys ja muokkaus. Käytettyä liikettä ei poisteta, vaan se arkistoidaan.
export const piilotaNav = true;

const PERUSRYHMAT = ["rinta", "jalat", "olkapäät", "vatsa"];

export async function nayta({ sisalto, toiminto, parametri }) {
  const uusi = parametri === "uusi";
  let kaikki;
  try {
    kaikki = await kaikkiLiikkeet();
  } catch {
    sisalto.append(h("p", { class: "ilmoitus" }, ikoni("wifi-off"), h("span", {}, "Liikkeitä ei saatu haettua.")));
    toiminto.append(h("a", { href: "#/liikkeet", class: "nappi nappi--reuna nappi--lg nappi--taysi" }, "Takaisin"));
    return;
  }
  const alkuperainen = uusi ? null : kaikki.find((l) => l.id === parametri);
  if (!uusi && !alkuperainen) {
    sisalto.append(h("header", { class: "otsikko" }, h("h2", {}, "Liikettä ei löytynyt")));
    toiminto.append(h("a", { href: "#/liikkeet", class: "nappi nappi--reuna nappi--lg nappi--taysi" }, "Takaisin"));
    return;
  }

  const liike = alkuperainen
    ? { ...alkuperainen }
    : {
        nimi: "", kuvaus: "", ryhma: "", mittari: "toistot", molemmat_puolet: false, arkistoitu: false,
        jarjestys: Math.max(0, ...kaikki.map((l) => l.jarjestys)) + 10,
      };
  const kaytetty = uusi ? false : await liikettaKaytetty(liike.id).catch(() => true);

  // Ryhmät: perusryhmät ja muut jo käytössä olevat, järjestyksessä
  const ryhmat = [...PERUSRYHMAT, ...new Set(kaikki.map((l) => l.ryhma).filter((r) => r && !PERUSRYHMAT.includes(r)))];

  const nimi = h("input", { id: "nimi", class: "syote", type: "text", value: liike.nimi, autocomplete: "off", autocapitalize: "sentences", required: true });
  const kuvaus = h("input", { id: "kuvaus", class: "syote", type: "text", value: liike.kuvaus ?? "", autocomplete: "off", placeholder: "Esim. 25 kg säkki" });
  const muuRyhma = h("input", { id: "muu-ryhma", class: "syote", type: "text", autocomplete: "off", autocapitalize: "none", "aria-label": "Uusi ryhmä" });
  const ryhmaAlue = h("div", { class: "pillerit", role: "group", "aria-labelledby": "ryhma-otsikko" });
  const mittariAlue = h("div", { class: "pillerit", role: "group", "aria-labelledby": "mittari-otsikko" });
  const puoletAlue = h("div", { class: "pillerit", role: "group", "aria-labelledby": "puolet-otsikko" });
  let muuValittu = false;

  function piirraValinnat() {
    ryhmaAlue.replaceChildren(
      ...ryhmat.map((r) => pilleri(isoAlku(r), !muuValittu && liike.ryhma === r, () => { muuValittu = false; liike.ryhma = r; piirraValinnat(); })),
      pilleri("Muu", muuValittu, () => { muuValittu = true; liike.ryhma = muuRyhma.value.trim().toLowerCase(); piirraValinnat(); muuRyhma.focus(); })
    );
    muuRyhma.hidden = !muuValittu;
    mittariAlue.replaceChildren(
      pilleri("Toistot", liike.mittari === "toistot", () => { liike.mittari = "toistot"; piirraValinnat(); }),
      pilleri("Sekunnit", liike.mittari === "sekunnit", () => { liike.mittari = "sekunnit"; piirraValinnat(); })
    );
    puoletAlue.replaceChildren(
      pilleri("Yksi puoli", !liike.molemmat_puolet, () => { liike.molemmat_puolet = false; piirraValinnat(); }),
      pilleri("Molemmat puolet", liike.molemmat_puolet, () => { liike.molemmat_puolet = true; piirraValinnat(); })
    );
  }
  muuRyhma.addEventListener("input", () => (liike.ryhma = muuRyhma.value.trim().toLowerCase()));
  piirraValinnat();

  const virheTeksti = h("span");
  const virhe = h("p", { class: "ilmoitus", role: "alert", hidden: true }, ikoni("circle-alert"), virheTeksti);
  const nayttaVirhe = (teksti) => { virheTeksti.textContent = teksti; virhe.hidden = false; };

  async function tallenna(muutokset = {}, kohde = "#/liikkeet") {
    virhe.hidden = true;
    Object.assign(liike, { nimi: nimi.value.trim(), kuvaus: kuvaus.value.trim() }, muutokset);
    if (!liike.nimi) { nayttaVirhe("Anna liikkeelle nimi."); nimi.focus(); return; }
    if (!liike.ryhma) { nayttaVirhe("Valitse ryhmä."); return; }
    tallennaNappi.disabled = true;
    try {
      await tallennaLiike(liike);
      location.hash = kohde;
    } catch {
      nayttaVirhe("Tallennus ei onnistunut. Tarkista verkkoyhteys ja kokeile uudelleen.");
      tallennaNappi.disabled = false;
    }
  }

  const tallennaNappi = h("button", { type: "button", class: "nappi nappi--kulta nappi--lg nappi--taysi", onclick: () => tallenna() }, "Tallenna");

  // Arkistointi, palautus ja poisto (vain olemassa olevalle liikkeelle)
  const lisatoiminnot = [];
  if (!uusi) {
    if (liike.arkistoitu) {
      lisatoiminnot.push(h("button", { type: "button", class: "nappi nappi--haamu nappi--sm", onclick: () => tallenna({ arkistoitu: false }) },
        ikoni("plus", "sm"), "Palauta käyttöön"));
    } else {
      lisatoiminnot.push(h("button", { type: "button", class: "nappi nappi--haamu nappi--sm", onclick: () => tallenna({ arkistoitu: true }) },
        ikoni("minus", "sm"), "Arkistoi"));
    }
    if (!kaytetty) {
      lisatoiminnot.push(h("button", {
        type: "button", class: "nappi nappi--haamu nappi--sm",
        onclick: async () => {
          const ok = await vahvista({
            otsikko: `Poistetaanko ${liike.nimi}?`,
            teksti: "Liikettä ei ole käytetty yhdessäkään treenissä, joten sen voi poistaa kokonaan.",
            kylla: "Poista",
            ei: "Peru",
          });
          if (!ok) return;
          try {
            await poistaLiike(liike.id);
            location.hash = "#/liikkeet";
          } catch {
            nayttaVirhe("Poisto ei onnistunut. Tarkista verkkoyhteys ja kokeile uudelleen.");
          }
        },
      }, ikoni("trash-2", "sm"), "Poista"));
    }
  }

  sisalto.append(
    h("header", { class: "treeniotsikko" },
      h("a", { href: "#/liikkeet", class: "ikoninappi treeniotsikko__takaisin", "aria-label": "Liikkeet" }, ikoni("chevron-left")),
      h("p", { class: "eyebrow treeniotsikko__pvm" }, "Liikkeet")
    ),
    h("h2", { class: "otsikko" }, uusi ? "Uusi liike" : "Muokkaa liikettä"),
    h("div", { class: "lomake" },
      h("div", { class: "kentta" }, h("label", { for: "nimi" }, "Nimi"), nimi),
      h("div", { class: "kentta" }, h("label", { for: "kuvaus" }, "Kuvaus"), kuvaus,
        h("span", { class: "kentta__vihje" }, "Valinnainen")),
      h("div", { class: "kentta" }, h("span", { id: "ryhma-otsikko", class: "kentta__otsikko" }, "Ryhmä"), ryhmaAlue, muuRyhma),
      h("div", { class: "kentta" }, h("span", { id: "mittari-otsikko", class: "kentta__otsikko" }, "Mittari"), mittariAlue,
        kaytetty ? h("span", { class: "kentta__vihje" }, "Muutos koskee myös aiempia treenejä ja tilastoja.") : ""),
      h("div", { class: "kentta" }, h("span", { id: "puolet-otsikko", class: "kentta__otsikko" }, "Puolet"), puoletAlue,
        h("span", { class: "kentta__vihje" }, "Molemmat puolet tuplaa pikavalintojen sarjamäärät."))
    ),
    lisatoiminnot.length ? h("div", { class: "lisatoiminnot" }, lisatoiminnot) : "",
    !uusi && kaytetty && !liike.arkistoitu
      ? h("p", { class: "rivi__lisa lisatoiminnot__vihje" }, "Liikettä on käytetty treeneissä, joten sitä ei voi poistaa. Arkistoitu liike ei näy suunnittelussa, mutta historia säilyy.")
      : ""
  );
  toiminto.append(virhe, tallennaNappi);
}

function isoAlku(teksti) {
  return teksti.charAt(0).toUpperCase() + teksti.slice(1);
}

function pilleri(teksti, valittu, onclick) {
  return h("button", { type: "button", class: "pilleri", "aria-pressed": valittu ? "true" : "false", onclick },
    valittu ? ikoni("check", "sm") : null, teksti);
}
