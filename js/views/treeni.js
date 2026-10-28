import { h, ikoni, kpl } from "../dom.js";
import { lyhytPvm } from "../aika.js";
import { haeKerta, poistaKerta } from "../data.js";
import { tavoiteteksti } from "../pikavalinnat.js";

// Treeninäkymän runko. Sarjojen kuittaus, lopetus ja yhteenveto tehdään vaiheessa 4.
export async function nayta({ sisalto, parametri }) {
  let kerta;
  try {
    kerta = parametri ? await haeKerta(parametri) : null;
  } catch {
    sisalto.append(h("p", { class: "ilmoitus" }, ikoni("wifi-off"), h("span", {}, "Treeniä ei saatu haettua.")));
    return;
  }
  if (!kerta) {
    sisalto.append(h("header", { class: "otsikko" }, h("h2", {}, "Treeniä ei löytynyt")));
    return;
  }

  sisalto.append(
    h("header", { class: "otsikko" },
      h("p", { class: "eyebrow" }, lyhytPvm(kerta.paiva)),
      h("h2", {}, "Treeni")),
    h("ul", { class: "rivilista" },
      kerta.liikkeet.map((kl) =>
        h("li", { class: "treeniliike" },
          h("span", { class: "rivi__nimi" }, kl.liike.nimi),
          h("span", { class: "rivi__lisa" },
            tavoiteteksti(kl.sarjamaara, kl.tavoite, kl.liike.mittari), ", ",
            kl.sarjat.length, " ", kpl(kl.sarjat.length, "sarjarivi", "sarjariviä"))
        )
      )
    ),
    h("p", { class: "mykistetty pieni osio" }, "Sarjojen kuittaus tulee vaiheessa 4."),
    // Väliaikainen: testitreenien siivous ennen kuin muokkaus tulee vaiheessa 5
    h("button", {
      type: "button", class: "nappi nappi--haamu nappi--sm poisto",
      onclick: async () => {
        if (!confirm("Poistetaanko tämä treeni?")) return;
        await poistaKerta(kerta.id);
        location.hash = "#/";
      },
    }, ikoni("trash-2", "sm"), "Poista treeni")
  );
}
