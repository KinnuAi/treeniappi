// Päivämäärät Suomen ajassa. Päivät käsitellään merkkijonoina YYYY-MM-DD.
const VIIKONPAIVAT = ["su", "ma", "ti", "ke", "to", "pe", "la"];

export function tanaan() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Helsinki" }).format(new Date());
}

function paivaksi(pvm) {
  const [v, k, p] = pvm.split("-").map(Number);
  return new Date(Date.UTC(v, k - 1, p));
}

export function lisaaPaivia(pvm, n) {
  const d = paivaksi(pvm);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Viikko alkaa maanantaista
export function viikonAlku(pvm) {
  return lisaaPaivia(pvm, -((paivaksi(pvm).getUTCDay() + 6) % 7));
}

// "pe 28.10."
export function lyhytPvm(pvm) {
  const d = paivaksi(pvm);
  return `${VIIKONPAIVAT[d.getUTCDay()]} ${d.getUTCDate()}.${d.getUTCMonth() + 1}.`;
}

// "28.10.2026"
export function pitkaPvm(pvm) {
  const d = paivaksi(pvm);
  return `${d.getUTCDate()}.${d.getUTCMonth() + 1}.${d.getUTCFullYear()}`;
}

// 1240 -> "1 240"
export function luku(n) {
  return new Intl.NumberFormat("fi-FI").format(n);
}
