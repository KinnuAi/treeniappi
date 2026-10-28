import { h, ikoni } from "./dom.js";

// Alareunan paneeli (Dialog.jsx:n rakenne: verho, plum-pinta, otsikko ja sulkunappi).
// Alareunassa, jotta napit ovat peukalon ulottuvilla.
export function avaaPaneeli({ otsikko, sisalto, toiminnot, suljettaessa }) {
  const edellinenFokus = document.activeElement;
  const otsikkoId = `paneeli-${Math.random().toString(36).slice(2)}`;

  function sulje() {
    document.removeEventListener("keydown", nappain);
    verho.remove();
    edellinenFokus?.focus?.();
    suljettaessa?.();
  }
  function nappain(e) {
    if (e.key === "Escape") sulje();
  }

  const paneeli = h("div", { class: "paneeli", role: "dialog", "aria-modal": "true", "aria-labelledby": otsikkoId },
    h("div", { class: "paneeli__ylaosa" },
      h("h2", { id: otsikkoId, class: "paneeli__otsikko" }, otsikko),
      h("button", { type: "button", class: "ikoninappi", "aria-label": "Sulje", onclick: sulje }, ikoni("x"))
    ),
    h("div", { class: "paneeli__sisalto" }, sisalto),
    toiminnot ? h("div", { class: "paneeli__toiminnot" }, toiminnot) : null
  );
  const verho = h("div", { class: "verho", onclick: (e) => e.target === verho && sulje() }, paneeli);

  document.body.append(verho);
  document.addEventListener("keydown", nappain);
  paneeli.querySelector(".paneeli__toiminnot button, button")?.focus({ preventScroll: true });
  return { sulje };
}

// Varmistus. Palauttaa true, jos käyttäjä hyväksyy.
export function vahvista({ otsikko, teksti, kylla, ei }) {
  return new Promise((valmis) => {
    let vastaus = false;
    const p = avaaPaneeli({
      otsikko,
      sisalto: h("p", { class: "paneeli__teksti" }, teksti),
      toiminnot: [
        h("button", { type: "button", class: "nappi nappi--reuna nappi--lg", onclick: () => p.sulje() }, ei),
        h("button", { type: "button", class: "nappi nappi--violetti nappi--lg", onclick: () => { vastaus = true; p.sulje(); } }, kylla),
      ],
      suljettaessa: () => valmis(vastaus),
    });
  });
}
