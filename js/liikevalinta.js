import { h, ikoni } from "./dom.js";
import { pikavalinnat, tavoiteteksti } from "./pikavalinnat.js";

// Liikkeiden valinta pikavalintoineen. Käytetään treenin suunnittelussa ja
// kun liike lisätään kesken treenin tai jälkikäteen.
// Napautus liikkeeseen valitsee sen ensimmäisellä pikavalinnalla, joten lisäys vaatii yhden napautuksen.
export function liikevalitsin(liikelista, muuttui = () => {}) {
  const valitut = new Map(); // liike_id -> { valinta: indeksi tai "oma", sarjamaara, tavoite }
  const jarjestys = [];      // valintajärjestys = treenin järjestys
  const rivit = new Map();   // liike_id -> { li, numero }
  const liikkeet = new Map(liikelista.map((l) => [l.id, l]));

  function paivita() {
    jarjestys.forEach((id, i) => rivit.get(id)?.numero(i + 1));
    muuttui(valitut.size);
  }

  function rivi(liike) {
    const vaihtoehdot = pikavalinnat(liike);
    const yksikko = liike.mittari === "sekunnit" ? "Sekunnit" : "Toistot";
    const merkki = h("span", { class: "valinta__merkki" }, ikoni("plus"));
    const nappi = h("button", { type: "button", class: "valinta__liike", "aria-pressed": "false" },
      merkki,
      h("span", { class: "valinta__teksti" },
        h("span", { class: "rivi__nimi" }, liike.nimi),
        liike.kuvaus ? h("span", { class: "rivi__lisa" }, liike.kuvaus) : null)
    );
    const asetukset = h("div", { class: "valinta__asetukset", hidden: true });
    const li = h("li", { class: "valinta" }, nappi, asetukset);

    function piirraAsetukset() {
      const tila = valitut.get(liike.id);
      asetukset.replaceChildren(
        h("div", { class: "pillerit", role: "group", "aria-label": `${liike.nimi}: sarjat` },
          vaihtoehdot.map(([s, t], i) => pilleri(tavoiteteksti(s, t, liike.mittari), tila.valinta === i, () => {
            Object.assign(tila, { valinta: i, sarjamaara: s, tavoite: t });
            piirraAsetukset();
          })),
          pilleri("Oma", tila.valinta === "oma", () => {
            tila.valinta = "oma";
            piirraAsetukset();
            asetukset.querySelector("input")?.focus();
          })
        )
      );
      if (tila.valinta === "oma") {
        const sarjat = numerokentta(`sarjat-${liike.id}`, tila.sarjamaara, (n) => (tila.sarjamaara = n));
        const tavoite = numerokentta(`tavoite-${liike.id}`, tila.tavoite, (n) => (tila.tavoite = n));
        asetukset.append(
          h("div", { class: "oma" },
            h("div", { class: "kentta" }, h("label", { for: sarjat.id }, "Sarjat"), sarjat),
            h("div", { class: "kentta" }, h("label", { for: tavoite.id }, yksikko), tavoite))
        );
      }
      if (liike.molemmat_puolet) {
        asetukset.append(h("p", { class: "valinta__vihje" }, "Sarjamäärä sisältää molemmat puolet."));
      }
    }

    nappi.addEventListener("click", () => {
      if (valitut.has(liike.id)) {
        valitut.delete(liike.id);
        jarjestys.splice(jarjestys.indexOf(liike.id), 1);
        li.classList.remove("valinta--valittu");
        nappi.setAttribute("aria-pressed", "false");
        merkki.replaceChildren(ikoni("plus"));
        asetukset.hidden = true;
      } else {
        const [s, t] = vaihtoehdot[0];
        valitut.set(liike.id, { valinta: 0, sarjamaara: s, tavoite: t });
        jarjestys.push(liike.id);
        li.classList.add("valinta--valittu");
        nappi.setAttribute("aria-pressed", "true");
        piirraAsetukset();
        asetukset.hidden = false;
      }
      paivita();
    });

    rivit.set(liike.id, { li, numero: (n) => merkki.replaceChildren(String(n)) });
    return li;
  }

  const elementti = h("ul", { class: "valinnat" }, liikelista.map(rivi));

  return {
    elementti,
    maara: () => valitut.size,
    // [{ liike, liike_id, sarjamaara, tavoite }] valintajärjestyksessä
    valinnat: () => jarjestys.map((id) => {
      const { sarjamaara, tavoite } = valitut.get(id);
      return { liike: liikkeet.get(id), liike_id: id, sarjamaara, tavoite };
    }),
    // Siirtää kohdistuksen ensimmäiseen virheelliseen omaan arvoon. Palauttaa true, jos kaikki on kunnossa.
    tarkista() {
      const virheellinen = jarjestys.find((id) => {
        const v = valitut.get(id);
        return !(v.sarjamaara > 0 && v.tavoite > 0);
      });
      if (!virheellinen) return true;
      rivit.get(virheellinen).li.querySelector("input")?.focus();
      return false;
    },
  };
}

function pilleri(teksti, valittu, onclick) {
  return h("button", { type: "button", class: "pilleri", "aria-pressed": valittu ? "true" : "false", onclick },
    valittu ? ikoni("check", "sm") : null, teksti);
}

function numerokentta(id, arvo, muutos) {
  const kentta = h("input", {
    id, class: "syote syote--numero", type: "text", inputmode: "numeric", pattern: "[0-9]*",
    autocomplete: "off", maxlength: "3", value: String(arvo),
  });
  kentta.addEventListener("input", () => {
    kentta.value = kentta.value.replace(/\D/g, "");
    muutos(Number(kentta.value) || 0);
  });
  return kentta;
}
