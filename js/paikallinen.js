// Laitteelle tallennus (localStorage). Kaikki lukeminen ja kirjoittaminen on suojattu:
// jos tallennus on estetty tai täynnä, sovellus toimii silti, vain ilman paikallista kopiota.
const ETULIITE = "treeni-";

export function lue(avain) {
  try {
    const arvo = localStorage.getItem(ETULIITE + avain);
    return arvo == null ? null : JSON.parse(arvo);
  } catch {
    return null;
  }
}

export function kirjoita(avain, arvo) {
  try {
    localStorage.setItem(ETULIITE + avain, JSON.stringify(arvo));
  } catch {
    // ei tallennustilaa
  }
}

export function poista(avain) {
  try {
    localStorage.removeItem(ETULIITE + avain);
  } catch {
    // ei tallennustilaa
  }
}

// Avaimet, jotka alkavat annetulla etuliitteellä (ilman yhteistä "treeni-"-alkua)
export function avaimet(alku = "") {
  try {
    return Object.keys(localStorage)
      .filter((a) => a.startsWith(ETULIITE + alku))
      .map((a) => a.slice(ETULIITE.length));
  } catch {
    return [];
  }
}
