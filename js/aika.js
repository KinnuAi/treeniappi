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

const KUUKAUDET = ["Tammikuu", "Helmikuu", "Maaliskuu", "Huhtikuu", "Toukokuu", "Kesäkuu",
  "Heinäkuu", "Elokuu", "Syyskuu", "Lokakuu", "Marraskuu", "Joulukuu"];

// ISO-viikkonumero (viikon torstai määrää vuoden)
export function viikkonumero(pvm) {
  const torstai = paivaksi(lisaaPaivia(viikonAlku(pvm), 3));
  const tammi1 = new Date(Date.UTC(torstai.getUTCFullYear(), 0, 1));
  return Math.floor((torstai - tammi1) / 86400000 / 7) + 1;
}

// Kuukauden ensimmäinen päivä, siirrettynä n kuukautta
export function kuukaudenAlku(pvm, n = 0) {
  const [v, k] = pvm.split("-").map(Number);
  const d = new Date(Date.UTC(v, k - 1 + n, 1));
  return d.toISOString().slice(0, 10);
}

export function kuukaudenLoppu(pvm) {
  return lisaaPaivia(kuukaudenAlku(pvm, 1), -1);
}

// "Lokakuu 2026"
export function kuukausiJaVuosi(pvm) {
  const d = paivaksi(pvm);
  return `${KUUKAUDET[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// "26.10." (ilman viikonpäivää)
export function paivaJaKuukausi(pvm) {
  const d = paivaksi(pvm);
  return `${d.getUTCDate()}.${d.getUTCMonth() + 1}.`;
}

// Sekunnit luettavaan muotoon: "45 s", "4 min 30 s", "1 h 5 min"
export function kesto(sekunnit) {
  if (sekunnit < 60) return `${sekunnit} s`;
  const h = Math.floor(sekunnit / 3600);
  const min = Math.floor((sekunnit % 3600) / 60);
  const s = sekunnit % 60;
  if (h > 0) return `${h} h${min ? ` ${min} min` : ""}`;
  return `${min} min${s ? ` ${s} s` : ""}`;
}
