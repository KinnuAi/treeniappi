// Kaikki tietokantakutsut yhdessä paikassa.
// Vaiheessa 7 näiden alle tulee paikallinen tallennus ja synkronointijono (sync.js),
// joten näkymät eivät kutsu Supabasea suoraan.
import { supabase } from "./supabase.js";
import * as jono from "./sync.js";

function tarkista({ data, error, count }) {
  if (error) throw error;
  return { data, count };
}

// Treenikerrat ja toistot aikaväliltä (päivät muodossa YYYY-MM-DD, molemmat mukaan lukien)
export async function yhteenveto(alku, loppu) {
  const [kerrat, sarjat] = await Promise.all([
    supabase.from("treeni_kerrat").select("id", { count: "exact", head: true }).gte("paiva", alku).lte("paiva", loppu),
    supabase.from("treeni_tehdyt_sarjat").select("maara, mittari").gte("paiva", alku).lte("paiva", loppu),
  ]);
  const { count } = tarkista(kerrat);
  const { data } = tarkista(sarjat);
  const toistot = data.filter((s) => s.mittari === "toistot").reduce((summa, s) => summa + s.maara, 0);
  return { kerrat: count ?? 0, toistot };
}

// Tilastot aikaväliltä: treenikerrat ja tehdyt sarjat liikkeittäin.
// Supabase palauttaa enintään 1000 riviä kerralla, joten pitkät aikavälit haetaan osissa.
export async function tilastot(alku, loppu) {
  const kerrat = supabase.from("treeni_kerrat").select("id", { count: "exact", head: true }).gte("paiva", alku).lte("paiva", loppu);
  const sarjat = [];
  const osa = 1000;
  for (let alusta = 0; ; alusta += osa) {
    const { data } = tarkista(
      await supabase
        .from("treeni_tehdyt_sarjat")
        .select("sarja_id, liike_id, nimi, mittari, maara")
        .gte("paiva", alku)
        .lte("paiva", loppu)
        .order("sarja_id")
        .range(alusta, alusta + osa - 1)
    );
    sarjat.push(...data);
    if (data.length < osa) break;
  }
  const { count } = tarkista(await kerrat);

  const liikkeittain = new Map();
  for (const s of sarjat) {
    const l = liikkeittain.get(s.liike_id) ?? { liike_id: s.liike_id, nimi: s.nimi, mittari: s.mittari, sarjat: 0, yhteensa: 0 };
    l.sarjat += 1;
    l.yhteensa += s.maara;
    liikkeittain.set(s.liike_id, l);
  }
  const liikkeet = [...liikkeittain.values()];
  return {
    kerrat: count ?? 0,
    toistot: liikkeet.filter((l) => l.mittari === "toistot").reduce((a, l) => a + l.yhteensa, 0),
    liikkeet,
  };
}

export async function viimeisimmatKerrat(maara = 10) {
  const { data } = tarkista(
    await supabase
      .from("treeni_kerrat")
      .select("id, paiva, tila, liikkeet:treeni_kerran_liikkeet(id)")
      .order("paiva", { ascending: false })
      .order("aloitettu", { ascending: false })
      .limit(maara)
  );
  return data;
}

// Käynnissä oleva treeni, tai null
export async function kaynnissaOlevaKerta() {
  const { data } = tarkista(
    await supabase
      .from("treeni_kerrat")
      .select("id, paiva")
      .eq("tila", "kaynnissa")
      .order("aloitettu", { ascending: false })
      .limit(1)
      .maybeSingle()
  );
  return data;
}

// Luo treenin, sen liikkeet ja valmiit sarjarivit (tehty = false, maara = tavoite).
// Tunnisteet luodaan laitteella, jotta sama rakenne toimii myöhemmin ilman verkkoa.
// valinnat: [{ liike_id, sarjamaara, tavoite }] treenin järjestyksessä
export async function aloitaTreeni(paiva, valinnat) {
  const kertaId = crypto.randomUUID();
  const kerranLiikkeet = valinnat.map((v, i) => ({
    id: crypto.randomUUID(),
    kerta_id: kertaId,
    liike_id: v.liike_id,
    jarjestys: (i + 1) * 10,
    sarjamaara: v.sarjamaara,
    tavoite: v.tavoite,
  }));
  const sarjat = kerranLiikkeet.flatMap((kl) =>
    Array.from({ length: kl.sarjamaara }, (_, i) => ({
      kerran_liike_id: kl.id,
      sarjanumero: i + 1,
      maara: kl.tavoite,
    }))
  );

  tarkista(await supabase.from("treeni_kerrat").insert({ id: kertaId, paiva, tila: "kaynnissa" }));
  try {
    tarkista(await supabase.from("treeni_kerran_liikkeet").insert(kerranLiikkeet));
    tarkista(await supabase.from("treeni_sarjat").insert(sarjat));
  } catch (virhe) {
    // Ei jätetä puolikasta treeniä: poisto vie myös liikkeet ja sarjat
    await supabase.from("treeni_kerrat").delete().eq("id", kertaId);
    throw virhe;
  }
  return kertaId;
}

// Yksi treeni liikkeineen ja sarjoineen, järjestettynä
export async function haeKerta(id) {
  const { data } = tarkista(
    await supabase
      .from("treeni_kerrat")
      .select(`id, paiva, tila,
        liikkeet:treeni_kerran_liikkeet(id, jarjestys, sarjamaara, tavoite,
          liike:treeni_liikkeet(id, nimi, mittari, molemmat_puolet),
          sarjat:treeni_sarjat(id, kerran_liike_id, sarjanumero, maara, tehty, tehty_aika))`)
      .eq("id", id)
      .maybeSingle()
  );
  if (!data) return null;
  data.liikkeet.sort((a, b) => a.jarjestys - b.jarjestys);
  for (const kl of data.liikkeet) kl.sarjat.sort((a, b) => a.sarjanumero - b.sarjanumero);
  return data;
}

// Sarjan kuittaus, määrän muutos tai uusi sarja. Menee tallennusjonoon (optimistinen päivitys).
// Upsert, jotta uusi sarja ja sen myöhemmät muutokset voidaan yhdistää jonossa yhdeksi.
export function tallennaSarja(sarja) {
  const rivi = {
    id: sarja.id,
    kerran_liike_id: sarja.kerran_liike_id,
    sarjanumero: sarja.sarjanumero,
    maara: sarja.maara,
    tehty: sarja.tehty,
    tehty_aika: sarja.tehty_aika,
  };
  jono.lisaa(`sarja:${rivi.id}`, async () => tarkista(await supabase.from("treeni_sarjat").upsert(rivi)));
}

export function poistaSarja(sarja) {
  jono.lisaa(`sarja:${sarja.id}`, async () => tarkista(await supabase.from("treeni_sarjat").delete().eq("id", sarja.id)));
}

// Uusi liike olemassa olevaan treeniin. Palauttaa paikallisen olion samassa muodossa kuin haeKerta.
// valinta: { liike, sarjamaara, tavoite }
export function lisaaKerranLiike(kertaId, valinta, jarjestys) {
  const kl = {
    id: crypto.randomUUID(),
    jarjestys,
    sarjamaara: valinta.sarjamaara,
    tavoite: valinta.tavoite,
    liike: valinta.liike,
    sarjat: [],
  };
  kl.sarjat = Array.from({ length: kl.sarjamaara }, (_, i) => ({
    id: crypto.randomUUID(),
    kerran_liike_id: kl.id,
    sarjanumero: i + 1,
    maara: kl.tavoite,
    tehty: false,
    tehty_aika: null,
  }));
  const rivi = { id: kl.id, kerta_id: kertaId, liike_id: valinta.liike.id, jarjestys, sarjamaara: kl.sarjamaara, tavoite: kl.tavoite };
  jono.lisaa(`kl:${kl.id}`, async () => tarkista(await supabase.from("treeni_kerran_liikkeet").upsert(rivi)));
  kl.sarjat.forEach(tallennaSarja);
  return kl;
}

// Poistaa liikkeen treenistä. Sarjat poistuvat tietokannassa liikkeen mukana.
export function poistaKerranLiike(kl) {
  for (const s of kl.sarjat) jono.peru(`sarja:${s.id}`);
  jono.lisaa(`kl:${kl.id}`, async () => tarkista(await supabase.from("treeni_kerran_liikkeet").delete().eq("id", kl.id)));
}

export function vaihdaPaiva(kertaId, paiva) {
  jono.lisaa(`kerta-paiva:${kertaId}`, async () =>
    tarkista(await supabase.from("treeni_kerrat").update({ paiva }).eq("id", kertaId))
  );
}

// Merkitsee treenin valmiiksi ja odottaa, että kaikki muutokset on tallennettu
export async function lopetaTreeni(id) {
  const lopetettu = new Date().toISOString();
  jono.lisaa(`kerta:${id}`, async () =>
    tarkista(await supabase.from("treeni_kerrat").update({ tila: "valmis", lopetettu }).eq("id", id))
  );
  await jono.tyhjenna();
}

// Odottaa jonon tyhjenemistä ennen kuin tiedot luetaan palvelimelta uudelleen
export async function odotaTallennukset() {
  try {
    await jono.tyhjenna();
  } catch {
    // Ei verkkoa: luetaan mitä saadaan, jono lähettää muutokset myöhemmin
  }
}

// Lähettää ensin odottavat muutokset, jotta ne eivät jää jonoon poistetun treenin perään
export async function poistaKerta(id) {
  await jono.tyhjenna();
  tarkista(await supabase.from("treeni_kerrat").delete().eq("id", id));
}

export async function liikkeet() {
  const { data } = tarkista(
    await supabase
      .from("treeni_liikkeet")
      .select("id, nimi, kuvaus, ryhma, mittari, molemmat_puolet, jarjestys")
      .eq("arkistoitu", false)
      .order("jarjestys")
  );
  return data;
}
