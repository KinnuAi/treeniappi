import { h, ikoni, kpl } from "../dom.js";
import { tanaan, viikonAlku, lisaaPaivia, lyhytPvm, pitkaPvm, luku } from "../aika.js";
import { yhteenveto, viimeisimmatKerrat, kaynnissaOlevaKerta } from "../data.js";
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

  const paanappi = h("a", { href: "#/uusi", class: "nappi nappi--kulta nappi--lg nappi--taysi" }, "Uusi treeni");
  toiminto.append(paanappi);

  try {
    const [viikko, kerrat, kesken] = await Promise.all([
      yhteenveto(alku, lisaaPaivia(alku, 6)),
      viimeisimmatKerrat(),
      kaynnissaOlevaKerta(),
    ]);
    if (kesken) {
      paanappi.href = `#/treeni/${kesken.id}`;
      paanappi.textContent = "Jatka treeniä";
    }
    kerratArvo.textContent = luku(viikko.kerrat);
    kerratSelite.textContent = kpl(viikko.kerrat, "treeni", "treeniä");
    toistotArvo.textContent = luku(viikko.toistot);
    toistotSelite.textContent = kpl(viikko.toistot, "toisto", "toistoa");

    if (kerrat.length === 0) {
      lista.append(h("p", { class: "mykistetty" }, "Ei vielä treenejä."));
    } else {
      // Valmis treeni avautuu yhteenvetoon (josta Muokkaa), kesken oleva suoraan treeniin
      const vuosi = paiva.slice(0, 4);
      lista.append(
        h("ul", { class: "rivilista historia" },
          kerrat.map((k) => {
            const liikkeita = k.liikkeet?.length ?? 0;
            return h("li", {},
              h("a", { href: k.tila === "kaynnissa" ? `#/treeni/${k.id}` : `#/yhteenveto/${k.id}` },
                h("span", { class: "rivi__teksti" },
                  h("span", { class: "rivi__nimi" }, k.paiva.startsWith(vuosi) ? lyhytPvm(k.paiva) : pitkaPvm(k.paiva)),
                  h("span", { class: "rivi__lisa" }, `${liikkeita} ${kpl(liikkeita, "liike", "liikettä")}`)),
                k.tila === "kaynnissa" ? h("span", { class: "merkki" }, "Kesken") : null,
                ikoni("chevron-right")
              )
            );
          })
        )
      );
    }
  } catch {
    lista.append(h("p", { class: "ilmoitus" }, ikoni("wifi-off"), h("span", {}, "Tietoja ei saatu haettua.")));
  }
}
