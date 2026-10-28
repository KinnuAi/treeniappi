import { h, ikoni } from "../dom.js";
import { liikkeet } from "../data.js";

// Toistaiseksi pelkkä lista. Lisäys, muokkaus ja arkistointi tulevat vaiheessa 8.
export async function nayta({ sisalto }) {
  const lista = h("div");
  sisalto.append(h("header", { class: "otsikko" }, h("h2", {}, "Liikkeet")), lista);

  try {
    const rivit = await liikkeet();
    lista.append(
      h("ul", { class: "rivilista" },
        rivit.map((l) =>
          h("li", {},
            h("span", {}, h("span", { class: "rivi__nimi" }, l.nimi),
              l.kuvaus ? h("span", { class: "rivi__lisa" }, " ", l.kuvaus) : null),
            h("span", { class: "rivi__lisa" }, l.mittari === "sekunnit" ? "sekunnit" : l.ryhma)
          )
        )
      )
    );
  } catch {
    lista.append(h("p", { class: "ilmoitus" }, ikoni("wifi-off"), h("span", {}, "Liikkeitä ei saatu haettua.")));
  }
}
