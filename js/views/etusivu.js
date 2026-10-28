import { h, ikoni, kpl } from "../dom.js";
import { tanaan, viikonAlku, lisaaPaivia, lyhytPvm, luku } from "../aika.js";
import { yhteenveto, viimeisimmatKerrat } from "../data.js";
import { kirjauduUlos } from "../supabase.js";

export async function nayta({ sisalto, toiminto }) {
  const paiva = tanaan();
  const alku = viikonAlku(paiva);

  const kerratArvo = h("span", { class: "luku__arvo" }, "–");
  const kerratSelite = h("span", { class: "luku__selite" }, "treeniä");
  const toistotArvo = h("span", { class: "luku__arvo" }, "–");
  const toistotSelite = h("span", { class: "luku__selite" }, "toistoa");
  const lista = h("div");

  sisalto.append(
    h("header", { class: "otsikko" },
      h("p", { class: "eyebrow" }, lyhytPvm(paiva)),
      h("h1", {}, "Treenit")
    ),
    h("section", { class: "osio" },
      h("h2", { class: "eyebrow" }, "Tämä viikko"),
      h("div", { class: "kortti luvut" },
        h("div", { class: "luku" }, kerratArvo, kerratSelite),
        h("div", { class: "luku" }, toistotArvo, toistotSelite)
      )
    ),
    h("section", { class: "osio" },
      h("h2", { class: "eyebrow" }, "Viimeisimmät"),
      lista
    ),
    h("button", { type: "button", class: "nappi nappi--haamu nappi--sm uloskirjautuminen", onclick: kirjauduUlos },
      ikoni("log-out", "sm"), "Kirjaudu ulos")
  );

  toiminto.append(h("a", { href: "#/uusi", class: "nappi nappi--kulta nappi--lg nappi--taysi" }, "Uusi treeni"));

  try {
    const [viikko, kerrat] = await Promise.all([yhteenveto(alku, lisaaPaivia(alku, 6)), viimeisimmatKerrat()]);
    kerratArvo.textContent = luku(viikko.kerrat);
    kerratSelite.textContent = kpl(viikko.kerrat, "treeni", "treeniä");
    toistotArvo.textContent = luku(viikko.toistot);
    toistotSelite.textContent = kpl(viikko.toistot, "toisto", "toistoa");

    if (kerrat.length === 0) {
      lista.append(h("p", { class: "mykistetty" }, "Ei vielä treenejä."));
    } else {
      lista.append(
        h("ul", { class: "rivilista" },
          kerrat.map((k) =>
            h("li", {},
              h("span", { class: "rivi__nimi" }, lyhytPvm(k.paiva)),
              k.tila === "kaynnissa" ? h("span", { class: "merkki" }, "Kesken") : null
            )
          )
        )
      );
    }
  } catch {
    lista.append(h("p", { class: "ilmoitus" }, ikoni("wifi-off"), h("span", {}, "Tietoja ei saatu haettua.")));
  }
}
