import { h, ikoni } from "../dom.js";
import { tanaan } from "../aika.js";
import { liikkeet, aloitaTreeni } from "../data.js";
import { liikevalitsin } from "../liikevalinta.js";

// Treenin suunnittelu: päivä, liikkeiden valinta ja pikavalinnat.
export async function nayta({ sisalto, toiminto }) {
  const paiva = h("input", { id: "paiva", class: "syote syote--pvm", type: "date", value: tanaan(), required: true });
  const lista = h("div");
  const virheTeksti = h("span");
  const virhe = h("p", { class: "ilmoitus", role: "alert", hidden: true }, ikoni("circle-alert"), virheTeksti);
  const aloita = h("button", { type: "button", class: "nappi nappi--kulta nappi--lg nappi--taysi", disabled: true }, "Aloita treeni");

  sisalto.append(
    h("header", { class: "otsikko" }, h("h2", {}, "Uusi treeni")),
    h("div", { class: "kentta osio" }, h("label", { for: "paiva" }, "Päivä"), paiva),
    h("section", { class: "osio" }, h("h3", { class: "eyebrow" }, "Liikkeet"), lista)
  );
  toiminto.append(virhe, aloita);

  function nayttaVirhe(teksti) {
    virheTeksti.textContent = teksti;
    virhe.hidden = false;
  }

  let valitsin;
  try {
    valitsin = liikevalitsin(await liikkeet(), (maara) => {
      virhe.hidden = true;
      aloita.disabled = maara === 0;
    });
    lista.append(valitsin.elementti);
  } catch {
    lista.append(h("p", { class: "ilmoitus" }, ikoni("wifi-off"), h("span", {}, "Liikkeitä ei saatu haettua.")));
    return;
  }

  aloita.addEventListener("click", async () => {
    virhe.hidden = true;
    if (!valitsin.tarkista()) {
      nayttaVirhe("Tarkista omat sarjat ja toistot.");
      return;
    }
    if (!paiva.value) {
      nayttaVirhe("Valitse päivä.");
      return;
    }
    aloita.disabled = true;
    aloita.textContent = "Aloitetaan";
    try {
      const valinnat = valitsin.valinnat().map(({ liike_id, sarjamaara, tavoite }) => ({ liike_id, sarjamaara, tavoite }));
      const id = await aloitaTreeni(paiva.value, valinnat);
      location.hash = `#/treeni/${id}`;
    } catch {
      nayttaVirhe("Treeniä ei saatu tallennettua. Tarkista verkkoyhteys ja kokeile uudelleen.");
      aloita.disabled = false;
      aloita.textContent = "Aloita treeni";
    }
  });
}
