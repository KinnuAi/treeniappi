import { h, ikoni, kpl } from "../dom.js";
import {
  tanaan, viikonAlku, lisaaPaivia, viikkonumero, kuukaudenAlku, kuukaudenLoppu,
  kuukausiJaVuosi, paivaJaKuukausi, pitkaPvm, luku, kesto,
} from "../aika.js";
import { tilastot, liikkeet } from "../data.js";

// Tilastot: viikko (ma–su) ja kuukausi selattavissa taaksepäin, lisäksi vuoden alusta.
// Lasketaan vain tehdyistä sarjoista. Valinta säilyy, kun näkymästä käydään muualla.
const JAKSOT = [
  { arvo: "viikko", nimi: "Viikko" },
  { arvo: "kuukausi", nimi: "Kuukausi" },
  { arvo: "vuosi", nimi: "Vuosi" },
];
const tila = { jakso: "viikko", siirto: 0 };

function aikavali(jakso, siirto) {
  const paiva = tanaan();
  if (jakso === "viikko") {
    const alku = lisaaPaivia(viikonAlku(paiva), siirto * 7);
    const loppu = lisaaPaivia(alku, 6);
    return { alku, loppu, otsikko: `Viikko ${viikkonumero(alku)}`, tarkenne: `${paivaJaKuukausi(alku)}–${paivaJaKuukausi(loppu)}` };
  }
  if (jakso === "kuukausi") {
    const alku = kuukaudenAlku(paiva, siirto);
    return { alku, loppu: kuukaudenLoppu(alku), otsikko: kuukausiJaVuosi(alku), tarkenne: null };
  }
  return { alku: `${paiva.slice(0, 4)}-01-01`, loppu: paiva, otsikko: "Vuoden alusta", tarkenne: `1.1.–${pitkaPvm(paiva)}` };
}

function maara(l) {
  return l.mittari === "sekunnit" ? kesto(l.yhteensa) : `${luku(l.yhteensa)} ${kpl(l.yhteensa, "toisto", "toistoa")}`;
}

export async function nayta({ sisalto }) {
  const valilehdet = h("div", { class: "valilehdet", role: "tablist", "aria-label": "Aikaväli" });
  const paneeli = h("div", { role: "tabpanel" });
  sisalto.append(h("header", { class: "otsikko" }, h("h2", {}, "Tilastot")), valilehdet, paneeli);

  // Liikkeiden järjestys sama kuin liikepankissa
  let jarjestys = new Map();
  try {
    jarjestys = new Map((await liikkeet()).map((l, i) => [l.id, i]));
  } catch {
    // järjestetään nimen mukaan, jos liikkeitä ei saada
  }

  function piirraValilehdet() {
    valilehdet.replaceChildren(
      ...JAKSOT.map((j) =>
        h("button", {
          type: "button", role: "tab", class: "valilehti", "aria-selected": j.arvo === tila.jakso ? "true" : "false",
          onclick: () => {
            if (j.arvo === tila.jakso) return;
            tila.jakso = j.arvo;
            tila.siirto = 0;
            piirraValilehdet();
            piirra();
          },
        }, j.nimi)
      )
    );
  }

  let kierros = 0;
  async function piirra() {
    const tama = ++kierros;
    const vali = aikavali(tila.jakso, tila.siirto);
    const selattava = tila.jakso !== "vuosi";

    const edellinen = h("button", { type: "button", class: "ikoninappi", "aria-label": "Edellinen" }, ikoni("chevron-left"));
    const seuraava = h("button", { type: "button", class: "ikoninappi", "aria-label": "Seuraava", disabled: tila.siirto >= 0 }, ikoni("chevron-right"));
    edellinen.addEventListener("click", () => { tila.siirto -= 1; piirra(); });
    seuraava.addEventListener("click", () => { if (tila.siirto < 0) { tila.siirto += 1; piirra(); } });

    const kerratArvo = h("span", { class: "luku__arvo" }, "–");
    const kerratSelite = h("span", { class: "luku__selite" }, "treeniä");
    const toistotArvo = h("span", { class: "luku__arvo" }, "–");
    const toistotSelite = h("span", { class: "luku__selite" }, "toistoa");
    const lista = h("div");

    paneeli.replaceChildren(
      h("div", { class: "jakso" },
        selattava ? edellinen : null,
        h("div", { class: "jakso__teksti" },
          h("p", { class: "jakso__otsikko" }, vali.otsikko),
          vali.tarkenne ? h("p", { class: "rivi__lisa jakso__tarkenne" }, vali.tarkenne) : null),
        selattava ? seuraava : null
      ),
      h("div", { class: "kortti luvut osio" },
        h("div", { class: "luku" }, kerratArvo, kerratSelite),
        h("div", { class: "luku" }, toistotArvo, toistotSelite)
      ),
      h("section", { class: "osio" }, h("h3", { class: "eyebrow" }, "Liikkeet"), lista)
    );

    let tulos;
    try {
      tulos = await tilastot(vali.alku, vali.loppu);
    } catch {
      if (tama === kierros) lista.append(h("p", { class: "ilmoitus" }, ikoni("wifi-off"), h("span", {}, "Tilastoja ei saatu haettua.")));
      return;
    }
    if (tama !== kierros) return;

    kerratArvo.textContent = luku(tulos.kerrat);
    kerratSelite.textContent = kpl(tulos.kerrat, "treeni", "treeniä");
    toistotArvo.textContent = luku(tulos.toistot);
    toistotSelite.textContent = kpl(tulos.toistot, "toisto", "toistoa");

    const rivit = tulos.liikkeet.sort((a, b) =>
      (jarjestys.get(a.liike_id) ?? 999) - (jarjestys.get(b.liike_id) ?? 999) || a.nimi.localeCompare(b.nimi, "fi"));
    if (rivit.length === 0) {
      lista.append(h("p", { class: "mykistetty" }, "Ei tehtyjä sarjoja tällä aikavälillä."));
      return;
    }
    lista.append(
      h("ul", { class: "rivilista" },
        rivit.map((l) =>
          h("li", {},
            h("span", { class: "rivi__teksti" },
              h("span", { class: "rivi__nimi" }, l.nimi),
              h("span", { class: "rivi__lisa" }, `${luku(l.sarjat)} ${kpl(l.sarjat, "sarja", "sarjaa")}`)),
            h("span", { class: "rivi__tulos" }, maara(l)))
        )
      )
    );
  }

  piirraValilehdet();
  await piirra();
}
