import { h, ikoni, kpl } from "../dom.js";
import { lyhytPvm, luku } from "../aika.js";
import { haeKerta, odotaTallennukset } from "../data.js";

// Yhteenveto lopetuksen jälkeen. Lasketaan vain tehdyistä sarjoista.
export const piilotaNav = true;

function yksikko(mittari) {
  return mittari === "sekunnit" ? " s" : "";
}

// "3 × 12 = 36", tai "3 sarjaa = 34", jos määrät vaihtelivat
function rivinTulos(kl) {
  const tehdyt = kl.sarjat.filter((s) => s.tehty);
  if (tehdyt.length === 0) return "ei tehtyjä sarjoja";
  const y = yksikko(kl.liike.mittari);
  const summa = tehdyt.reduce((a, s) => a + s.maara, 0);
  const samat = tehdyt.every((s) => s.maara === tehdyt[0].maara);
  const alku = samat
    ? `${tehdyt.length} × ${tehdyt[0].maara}${y}`
    : `${tehdyt.length} ${kpl(tehdyt.length, "sarja", "sarjaa")}`;
  return `${alku} = ${luku(summa)}${y}`;
}

export async function nayta({ sisalto, toiminto, parametri }) {
  let kerta;
  try {
    await odotaTallennukset();
    kerta = parametri ? await haeKerta(parametri) : null;
  } catch {
    sisalto.append(h("p", { class: "ilmoitus" }, ikoni("wifi-off"), h("span", {}, "Yhteenvetoa ei saatu haettua.")));
    toiminto.append(h("a", { href: "#/", class: "nappi nappi--kulta nappi--lg nappi--taysi" }, "Valmis"));
    return;
  }
  if (!kerta) {
    sisalto.append(h("header", { class: "otsikko" }, h("h2", {}, "Treeniä ei löytynyt")));
    toiminto.append(h("a", { href: "#/", class: "nappi nappi--kulta nappi--lg nappi--taysi" }, "Etusivulle"));
    return;
  }

  const sarjat = kerta.liikkeet.flatMap((kl) => kl.sarjat.map((s) => ({ ...s, mittari: kl.liike.mittari })));
  const tehdyt = sarjat.filter((s) => s.tehty);
  const toistot = tehdyt.filter((s) => s.mittari === "toistot").reduce((a, s) => a + s.maara, 0);
  const sekunnit = tehdyt.filter((s) => s.mittari === "sekunnit").reduce((a, s) => a + s.maara, 0);
  const kesken = sarjat.length - tehdyt.length;

  sisalto.append(
    h("header", { class: "otsikko" },
      h("p", { class: "eyebrow" }, lyhytPvm(kerta.paiva)),
      h("h2", {}, "Yhteenveto")),
    h("section", { class: "osio" },
      h("div", { class: "kortti luvut" },
        h("div", { class: "luku" },
          h("span", { class: "luku__arvo" }, luku(toistot)),
          h("span", { class: "luku__selite" }, kpl(toistot, "toisto", "toistoa"))),
        sekunnit > 0
          ? h("div", { class: "luku" },
              h("span", { class: "luku__arvo" }, luku(sekunnit)),
              h("span", { class: "luku__selite" }, kpl(sekunnit, "sekunti", "sekuntia")))
          : h("div", { class: "luku" },
              h("span", { class: "luku__arvo" }, luku(tehdyt.length)),
              h("span", { class: "luku__selite" }, kpl(tehdyt.length, "sarja", "sarjaa")))
      )
    ),
    kesken > 0
      ? h("p", { class: "ilmoitus osio" }, ikoni("circle-alert"),
          h("span", {}, `${kesken} ${kpl(kesken, "sarja jäi", "sarjaa jäi")} kuittaamatta.`))
      : "", // tyhjä teksti, ei null (append kirjoittaisi sen näkyviin)
    h("section", { class: "osio" },
      h("h3", { class: "eyebrow" }, "Liikkeet"),
      h("ul", { class: "rivilista" },
        kerta.liikkeet.map((kl) =>
          h("li", {},
            h("span", { class: "rivi__nimi" }, kl.liike.nimi),
            h("span", { class: "rivi__tulos" }, rivinTulos(kl)))
        )
      )
    )
  );

  toiminto.append(
    h("div", { class: "kaksi" },
      h("a", { href: `#/treeni/${kerta.id}`, class: "nappi nappi--reuna nappi--lg" }, "Muokkaa"),
      h("a", { href: "#/", class: "nappi nappi--kulta nappi--lg" }, "Valmis"))
  );
}
