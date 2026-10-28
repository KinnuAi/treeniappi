import { h, ikoni } from "../dom.js";
import { kaikkiLiikkeet } from "../data.js";

// Liikepankki: napautus avaa liikkeen muokattavaksi. Arkistoidut omana ryhmänään.
export async function nayta({ sisalto, toiminto }) {
  const lista = h("div");
  sisalto.append(h("header", { class: "otsikko" }, h("h2", {}, "Liikkeet")), lista);
  toiminto.append(h("a", { href: "#/liike/uusi", class: "nappi nappi--kulta nappi--lg nappi--taysi" }, ikoni("plus"), "Uusi liike"));

  let rivit;
  try {
    rivit = await kaikkiLiikkeet();
  } catch {
    lista.append(h("p", { class: "ilmoitus" }, ikoni("wifi-off"), h("span", {}, "Liikkeitä ei saatu haettua.")));
    return;
  }

  const rivi = (l) =>
    h("li", {},
      h("a", { href: `#/liike/${l.id}` },
        h("span", { class: "rivi__teksti" },
          h("span", { class: "rivi__nimi" }, l.nimi),
          h("span", { class: "rivi__lisa" }, [l.ryhma, l.mittari === "sekunnit" ? "sekunnit" : null, l.molemmat_puolet ? "molemmat puolet" : null].filter(Boolean).join(", "))),
        ikoni("chevron-right")
      )
    );

  const kaytossa = rivit.filter((l) => !l.arkistoitu);
  const arkistoidut = rivit.filter((l) => l.arkistoitu);
  lista.append(h("ul", { class: "rivilista historia" }, kaytossa.map(rivi)));
  if (arkistoidut.length) {
    lista.append(
      h("section", { class: "osio arkisto" },
        h("h3", { class: "eyebrow" }, "Arkistoidut"),
        h("p", { class: "rivi__lisa" }, "Eivät näy treenin suunnittelussa. Historia ja tilastot säilyvät."),
        h("ul", { class: "rivilista historia" }, arkistoidut.map(rivi)))
    );
  }
}
