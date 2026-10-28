import { h } from "../dom.js";

// Suunnittelunäkymä tehdään vaiheessa 3
export function nayta({ sisalto }) {
  sisalto.append(
    h("header", { class: "otsikko" }, h("h2", {}, "Uusi treeni")),
    h("p", { class: "mykistetty" }, "Treenin suunnittelu tulee vaiheessa 3.")
  );
}
