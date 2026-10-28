// Pikavalinnat liikkeen tyypin mukaan: [sarjat, toistot tai sekunnit]
export function pikavalinnat(liike) {
  if (liike.mittari === "sekunnit") return [[3, 30], [3, 45], [3, 60]];
  if (liike.molemmat_puolet) return [[6, 12], [10, 10], [6, 15], [10, 20]];
  return [[3, 12], [5, 10], [3, 15], [5, 20]];
}

// "3 × 12" tai "3 × 30 s" (sitovat välilyönnit, ei rivinvaihtoa kesken)
export function tavoiteteksti(sarjat, tavoite, mittari) {
  return `${sarjat} × ${tavoite}${mittari === "sekunnit" ? " s" : ""}`;
}
