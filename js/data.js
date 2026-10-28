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
