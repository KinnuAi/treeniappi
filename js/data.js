// Kaikki tietokantakutsut yhdessä paikassa. Näkymät eivät kutsu Supabasea suoraan.
//
// Toiminta ilman verkkoa:
// - Treenin muutokset tallennetaan ensin laitteelle (paikallinen kopio treenistä) ja
//   lähetetään synkronointijonon (sync.js) kautta, kun yhteys toimii.
// - Lukuhaut tallennetaan välimuistiin. Jos verkko ei vastaa, näytetään viimeksi haettu tieto.
import { supabase } from "./supabase.js";
import * as jono from "./sync.js";
import { lue, kirjoita, poista, avaimet } from "./paikallinen.js";

const AIKARAJA = 8000;

function tarkista({ data, error, count }) {
  if (error) throw error;
  return { data, count };
}

function aikaraja(lupaus, ms = AIKARAJA) {
  return Promise.race([
    lupaus,
    new Promise((_, hylkaa) => setTimeout(() => hylkaa(new Error("Aikaraja")), ms)),
  ]);
}

// Hakee verkosta ja tallentaa tuloksen. Jos verkko ei vastaa, palauttaa viimeksi tallennetun.
async function valimuistista(nimi, hae) {
  if (!navigator.onLine) {
    const tallessa = lue(`valimuisti:${nimi}`);
    if (tallessa != null) return tallessa;
  }
  try {
    const tulos = await aikaraja(hae());
    kirjoita(`valimuisti:${nimi}`, tulos);
    return tulos;
  } catch (virhe) {
    const tallessa = lue(`valimuisti:${nimi}`);
    if (tallessa != null) return tallessa;
    throw virhe;
  }
}

// ---------- Paikallinen kopio treenistä ----------
// Näkymä muokkaa treeniä suoraan; kopio kirjoitetaan laitteelle heti muutoksen käsittelyn jälkeen.
let aktiivinen = null;
let kirjoitusTulossa = false;

function muista() {
  if (kirjoitusTulossa) return;
  kirjoitusTulossa = true;
  queueMicrotask(() => {
    kirjoitusTulossa = false;
    if (aktiivinen) kirjoitaKopio(aktiivinen);
  });
}

function kirjoitaKopio(kerta) {
  kirjoita(`kerta:${kerta.id}`, kerta);
  // Säilytetään vain kesken oleva ja viimeksi avattu treeni
  const kesken = lue("kesken");
  for (const avain of avaimet("kerta:")) {
    const id = avain.slice("kerta:".length);
    if (id !== kerta.id && id !== kesken) poista(avain);
  }
}

function aktivoi(kerta) {
  aktiivinen = kerta;
  return kerta;
}

// ---------- Lukuhaut ----------

// Treenikerrat ja toistot aikaväliltä (päivät muodossa YYYY-MM-DD, molemmat mukaan lukien)
export function yhteenveto(alku, loppu) {
  return valimuistista(`yhteenveto:${alku}:${loppu}`, async () => {
    const [kerrat, sarjat] = await Promise.all([
      supabase.from("treeni_kerrat").select("id", { count: "exact", head: true }).gte("paiva", alku).lte("paiva", loppu),
      supabase.from("treeni_tehdyt_sarjat").select("maara, mittari").gte("paiva", alku).lte("paiva", loppu),
    ]);
    const { count } = tarkista(kerrat);
    const { data } = tarkista(sarjat);
    const toistot = data.filter((s) => s.mittari === "toistot").reduce((summa, s) => summa + s.maara, 0);
    return { kerrat: count ?? 0, toistot };
  });
}

// Tilastot aikaväliltä: treenikerrat ja tehdyt sarjat liikkeittäin.
// Supabase palauttaa enintään 1000 riviä kerralla, joten pitkät aikavälit haetaan osissa.
export function tilastot(alku, loppu) {
  return valimuistista(`tilastot:${alku}:${loppu}`, async () => {
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
  });
}

// Viimeisimmät treenit. Laitteella olevat treenit (esim. ilman verkkoa aloitettu) näkyvät heti.
export async function viimeisimmatKerrat(maara = 10) {
  const lista = await valimuistista("viimeisimmat", async () => {
    const { data } = tarkista(
      await supabase
        .from("treeni_kerrat")
        .select("id, paiva, tila, liikkeet:treeni_kerran_liikkeet(id)")
        .order("paiva", { ascending: false })
        .order("aloitettu", { ascending: false })
        .limit(maara)
    );
    return data;
  });
  const paikalliset = avaimet("kerta:").map((a) => lue(a)).filter(Boolean);
  for (const k of paikalliset) {
    const rivi = { id: k.id, paiva: k.paiva, tila: k.tila, liikkeet: k.liikkeet.map((kl) => ({ id: kl.id })) };
    const i = lista.findIndex((r) => r.id === k.id);
    if (i >= 0) lista[i] = rivi;
    else if (jono.odottavia() > 0) lista.unshift(rivi);
  }
  return lista.sort((a, b) => b.paiva.localeCompare(a.paiva)).slice(0, maara);
}

// Käynnissä oleva treeni, tai null. Laitteen tieto ensin, jotta ilman verkkoa aloitettu treeni löytyy.
export async function kaynnissaOlevaKerta() {
  const keskenId = lue("kesken");
  const kopio = keskenId ? lue(`kerta:${keskenId}`) : null;
  if (kopio?.tila === "kaynnissa") return { id: kopio.id, paiva: kopio.paiva };

  const kerta = await valimuistista("kaynnissa", async () => {
    const { data } = tarkista(
      await supabase
        .from("treeni_kerrat")
        .select("id, paiva")
        .eq("tila", "kaynnissa")
        .order("aloitettu", { ascending: false })
        .limit(1)
        .maybeSingle()
    );
    return data ?? false;
  });
  if (!kerta) return null;
  // Lopetus voi olla vielä lähettämättä
  if (lue(`kerta:${kerta.id}`)?.tila === "valmis") return null;
  return kerta;
}

// Yksi treeni liikkeineen ja sarjoineen, järjestettynä.
// Jos muutoksia on lähettämättä tai verkko ei vastaa, käytetään laitteella olevaa kopiota.
export async function haeKerta(id) {
  const kopio = lue(`kerta:${id}`);
  if (kopio && (jono.odottavia() > 0 || !navigator.onLine)) return aktivoi(kopio);
  try {
    const { data } = tarkista(
      await aikaraja(
        supabase
          .from("treeni_kerrat")
          .select(`id, paiva, tila,
            liikkeet:treeni_kerran_liikkeet(id, jarjestys, sarjamaara, tavoite,
              liike:treeni_liikkeet(id, nimi, mittari, molemmat_puolet),
              sarjat:treeni_sarjat(id, kerran_liike_id, sarjanumero, maara, tehty, tehty_aika))`)
          .eq("id", id)
          .maybeSingle()
      )
    );
    if (!data) return null;
    data.liikkeet.sort((a, b) => a.jarjestys - b.jarjestys);
    for (const kl of data.liikkeet) kl.sarjat.sort((a, b) => a.sarjanumero - b.sarjanumero);
    kirjoitaKopio(data);
    return aktivoi(data);
  } catch (virhe) {
    if (kopio) return aktivoi(kopio);
    throw virhe;
  }
}

export function liikkeet() {
  return valimuistista("liikkeet", async () => {
    const { data } = tarkista(
      await supabase
        .from("treeni_liikkeet")
        .select("id, nimi, kuvaus, ryhma, mittari, molemmat_puolet, jarjestys")
        .eq("arkistoitu", false)
        .order("jarjestys")
    );
    return data;
  });
}

// ---------- Muutokset (laitteelle heti, palvelimelle jonon kautta) ----------

function sarjarivi(s) {
  return {
    id: s.id,
    kerran_liike_id: s.kerran_liike_id,
    sarjanumero: s.sarjanumero,
    maara: s.maara,
    tehty: s.tehty,
    tehty_aika: s.tehty_aika,
  };
}

function uudetSarjat(kl) {
  return Array.from({ length: kl.sarjamaara }, (_, i) => ({
    id: crypto.randomUUID(),
    kerran_liike_id: kl.id,
    sarjanumero: i + 1,
    maara: kl.tavoite,
    tehty: false,
    tehty_aika: null,
  }));
}

// Luo treenin, sen liikkeet ja valmiit sarjarivit (tehty = false, maara = tavoite).
// Toimii myös ilman verkkoa: treeni syntyy laitteelle heti ja lähetetään jonon kautta.
// valinnat: [{ liike, sarjamaara, tavoite }] treenin järjestyksessä
export async function aloitaTreeni(paiva, valinnat) {
  const kerta = {
    id: crypto.randomUUID(),
    paiva,
    tila: "kaynnissa",
    liikkeet: valinnat.map((v, i) => ({
      id: crypto.randomUUID(),
      jarjestys: (i + 1) * 10,
      sarjamaara: v.sarjamaara,
      tavoite: v.tavoite,
      liike: { id: v.liike.id, nimi: v.liike.nimi, mittari: v.liike.mittari, molemmat_puolet: v.liike.molemmat_puolet },
      sarjat: [],
    })),
  };
  for (const kl of kerta.liikkeet) kl.sarjat = uudetSarjat(kl);

  kirjoita("kesken", kerta.id);
  kirjoitaKopio(aktivoi(kerta));

  jono.lisaa(`kerta-uusi:${kerta.id}`, {
    tyyppi: "upsert", taulu: "treeni_kerrat",
    rivit: [{ id: kerta.id, paiva, tila: "kaynnissa", aloitettu: new Date().toISOString() }],
  });
  jono.lisaa(`kl-uudet:${kerta.id}`, {
    tyyppi: "upsert", taulu: "treeni_kerran_liikkeet",
    rivit: kerta.liikkeet.map((kl) => ({
      id: kl.id, kerta_id: kerta.id, liike_id: kl.liike.id, jarjestys: kl.jarjestys, sarjamaara: kl.sarjamaara, tavoite: kl.tavoite,
    })),
  });
  jono.lisaa(`sarjat-uudet:${kerta.id}`, {
    tyyppi: "upsert", taulu: "treeni_sarjat",
    rivit: kerta.liikkeet.flatMap((kl) => kl.sarjat.map(sarjarivi)),
  });
  return kerta.id;
}

// Sarjan kuittaus, määrän muutos tai uusi sarja.
// Upsert, jotta uusi sarja ja sen myöhemmät muutokset voidaan yhdistää jonossa yhdeksi.
export function tallennaSarja(sarja) {
  jono.lisaa(`sarja:${sarja.id}`, { tyyppi: "upsert", taulu: "treeni_sarjat", rivit: [sarjarivi(sarja)] });
  muista();
}

export function poistaSarja(sarja) {
  jono.lisaa(`sarja:${sarja.id}`, { tyyppi: "delete", taulu: "treeni_sarjat", id: sarja.id });
  muista();
}

// Uusi liike olemassa olevaan treeniin. Palauttaa paikallisen olion samassa muodossa kuin haeKerta.
// valinta: { liike, sarjamaara, tavoite }
export function lisaaKerranLiike(kertaId, valinta, jarjestys) {
  const kl = {
    id: crypto.randomUUID(),
    jarjestys,
    sarjamaara: valinta.sarjamaara,
    tavoite: valinta.tavoite,
    liike: { id: valinta.liike.id, nimi: valinta.liike.nimi, mittari: valinta.liike.mittari, molemmat_puolet: valinta.liike.molemmat_puolet },
    sarjat: [],
  };
  kl.sarjat = uudetSarjat(kl);
  jono.lisaa(`kl:${kl.id}`, {
    tyyppi: "upsert", taulu: "treeni_kerran_liikkeet",
    rivit: [{ id: kl.id, kerta_id: kertaId, liike_id: kl.liike.id, jarjestys, sarjamaara: kl.sarjamaara, tavoite: kl.tavoite }],
  });
  jono.lisaa(`sarjat-kl:${kl.id}`, { tyyppi: "upsert", taulu: "treeni_sarjat", rivit: kl.sarjat.map(sarjarivi) });
  muista();
  return kl;
}

// Poistaa liikkeen treenistä. Sarjat poistuvat tietokannassa liikkeen mukana.
export function poistaKerranLiike(kl) {
  for (const s of kl.sarjat) jono.peru(`sarja:${s.id}`);
  jono.peru(`sarjat-kl:${kl.id}`);
  jono.lisaa(`kl:${kl.id}`, { tyyppi: "delete", taulu: "treeni_kerran_liikkeet", id: kl.id });
  muista();
}

export function vaihdaPaiva(kertaId, paiva) {
  jono.lisaa(`kerta-paiva:${kertaId}`, { tyyppi: "update", taulu: "treeni_kerrat", id: kertaId, muutokset: { paiva } });
  muista();
}

// Merkitsee treenin valmiiksi. Toimii myös ilman verkkoa.
export function lopetaTreeni(id) {
  jono.lisaa(`kerta:${id}`, {
    tyyppi: "update", taulu: "treeni_kerrat", id, muutokset: { tila: "valmis", lopetettu: new Date().toISOString() },
  });
  if (aktiivinen?.id === id) {
    aktiivinen.tila = "valmis";
    kirjoitaKopio(aktiivinen);
  }
  if (lue("kesken") === id) poista("kesken");
}

// Antaa jonolle hetken aikaa ennen kuin tiedot luetaan palvelimelta uudelleen
export async function odotaTallennukset() {
  try {
    await aikaraja(jono.tyhjenna(), 3000);
  } catch {
    // Ei verkkoa: luetaan laitteen kopiosta, jono lähettää muutokset myöhemmin
  }
}

// Vaatii verkon. Odottavat muutokset lähetetään ensin, jotta ne eivät jää jonoon poistetun treenin perään.
export async function poistaKerta(id) {
  await aikaraja(jono.tyhjenna());
  tarkista(await aikaraja(supabase.from("treeni_kerrat").delete().eq("id", id)));
  poista(`kerta:${id}`);
  if (lue("kesken") === id) poista("kesken");
  if (aktiivinen?.id === id) aktiivinen = null;
}

// Uloskirjautuessa laitteelta poistetaan treenitiedot ja välimuisti
export function tyhjennaLaite() {
  aktiivinen = null;
  jono.tyhjennaKaikki();
  for (const avain of avaimet()) if (avain !== "istunto") poista(avain);
}
