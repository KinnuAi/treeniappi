// Pieni apu elementtien luomiseen. Teksti lisätään aina tekstinä, ei HTML:nä.
export function h(tagi, ominaisuudet = {}, ...lapset) {
  const el = document.createElement(tagi);
  for (const [nimi, arvo] of Object.entries(ominaisuudet || {})) {
    if (arvo == null || arvo === false) continue;
    if (nimi.startsWith("on")) el.addEventListener(nimi.slice(2), arvo);
    else if (nimi === "class") el.className = arvo;
    else el.setAttribute(nimi, arvo === true ? "" : arvo);
  }
  for (const lapsi of lapset.flat()) {
    if (lapsi == null || lapsi === false) continue;
    el.append(lapsi instanceof Node ? lapsi : String(lapsi));
  }
  return el;
}

export function ikoni(nimi, koko) {
  return h("span", { class: `ikoni ikoni--${nimi}${koko ? ` ikoni--${koko}` : ""}`, "aria-hidden": "true" });
}

// Suomenkielinen taivutus: 1 treeni, 2 treeniä
export function kpl(n, yksikko, monikko) {
  return n === 1 ? yksikko : monikko;
}
