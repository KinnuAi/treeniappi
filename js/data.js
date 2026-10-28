// Kaikki tietokantakutsut yhdessä paikassa.
// Vaiheessa 7 näiden alle tulee paikallinen tallennus ja synkronointijono (sync.js),
// joten näkymät eivät kutsu Supabasea suoraan.
import { supabase } from "./supabase.js";

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

export async function viimeisimmatKerrat(maara = 10) {
  const { data } = tarkista(
    await supabase
      .from("treeni_kerrat")
      .select("id, paiva, tila")
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
          sarjat:treeni_sarjat(id, sarjanumero, maara, tehty))`)
      .eq("id", id)
      .maybeSingle()
  );
  if (!data) return null;
  data.liikkeet.sort((a, b) => a.jarjestys - b.jarjestys);
  for (const kl of data.liikkeet) kl.sarjat.sort((a, b) => a.sarjanumero - b.sarjanumero);
  return data;
}

export async function poistaKerta(id) {
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
