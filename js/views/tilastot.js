import { h } from "../dom.js";

// Tilastot tehdään vaiheessa 6
export function nayta({ sisalto }) {
  sisalto.append(
    h("header", { class: "otsikko" }, h("h2", {}, "Tilastot")),
    h("p", { class: "mykistetty" }, "Tilastot tulevat vaiheessa 6.")
  );
}
