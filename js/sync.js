// Synkronointijono: näkymä päivittyy heti, tallennus tapahtuu taustalla.
// Jono tallennetaan laitteelle (localStorage), joten se säilyy, vaikka sovellus suljetaan ilman verkkoa.
// Saman avaimen uusi muutos korvaa jonossa odottavan, joten vain viimeisin tila lähetetään.
// Epäonnistunut lähetys yritetään uudelleen, kun verkko palaa, sovellus tuodaan esiin tai 5 sekunnin päästä.
//
// Muutos (op) on tavallista dataa:
//   { tyyppi: "upsert", taulu, rivit }      lisää tai päivitä rivit (id:n perusteella)
//   { tyyppi: "update", taulu, id, muutokset }
//   { tyyppi: "delete", taulu, id }
import { supabase } from "./supabase.js";

const JONO = "treeni-jono";
const HYLATYT = "treeni-hylatyt";

const jono = new Map(lataa());
const kuuntelijat = new Set();
let kaynnissa = null;
let ajastin = null;

function lataa() {
  try {
    return JSON.parse(localStorage.getItem(JONO)) || [];
  } catch {
    return [];
  }
}

function tallenna() {
  try {
    localStorage.setItem(JONO, JSON.stringify([...jono]));
  } catch {
    // tallennustila täynnä tai estetty: jono toimii silti muistissa
  }
}

export function lisaa(avain, op) {
  jono.delete(avain);
  jono.set(avain, op);
  tallenna();
  ilmoita();
  kaynnista();
}

// Poistaa odottavan muutoksen, jota ei enää tarvita (esim. poistetun liikkeen sarjat)
export function peru(avain) {
  if (!jono.delete(avain)) return;
  tallenna();
  ilmoita();
}

// Uloskirjautuminen: lähettämättömät muutokset hylätään
export function tyhjennaKaikki() {
  jono.clear();
  tallenna();
  ilmoita();
}

export function odottavia() {
  return jono.size;
}

export function kuuntele(f) {
  kuuntelijat.add(f);
  return () => kuuntelijat.delete(f);
}

// Odottaa, että jono on lähetetty. Heittää virheen, jos jotain jäi lähettämättä.
export async function tyhjenna() {
  kaynnista();
  while (kaynnissa) await kaynnissa;
  if (jono.size) throw new Error("Tallentamatta");
}

export function kaynnista() {
  if (!navigator.onLine) return; // online-tapahtuma käynnistää uudelleen
  if (!kaynnissa && jono.size) kaynnissa = aja().finally(() => (kaynnissa = null));
}

function ilmoita() {
  for (const f of kuuntelijat) f(jono.size);
}

async function suorita(op) {
  let kysely = supabase.from(op.taulu);
  if (op.tyyppi === "upsert") kysely = kysely.upsert(op.rivit);
  else if (op.tyyppi === "update") kysely = kysely.update(op.muutokset).eq("id", op.id);
  else if (op.tyyppi === "delete") kysely = kysely.delete().eq("id", op.id);
  if (typeof AbortSignal !== "undefined" && AbortSignal.timeout) kysely = kysely.abortSignal(AbortSignal.timeout(15000));

  const { error, status } = await kysely;
  if (!error) return;
  // Verkkovirhe, vanhentunut kirjautuminen tai palvelimen häiriö: yritetään myöhemmin uudelleen.
  // Muut virheet (esim. jo poistettuun riviin viittaava sarja) eivät korjaannu uudella yrityksellä.
  const uudelleen = !status || status === 401 || status === 408 || status === 429 || status >= 500;
  throw Object.assign(new Error(error.message), { pysyva: !uudelleen });
}

async function aja() {
  while (jono.size) {
    const [avain, op] = jono.entries().next().value;
    try {
      await suorita(op);
    } catch (virhe) {
      if (!virhe.pysyva) {
        ajastaUusinta();
        return;
      }
      hylkaa(avain, op, virhe);
    }
    if (jono.get(avain) === op) jono.delete(avain);
    tallenna();
    ilmoita();
  }
}

// Hylätyt muutokset talteen vianetsintää varten (20 viimeisintä)
function hylkaa(avain, op, virhe) {
  try {
    const lista = JSON.parse(localStorage.getItem(HYLATYT)) || [];
    lista.push({ aika: new Date().toISOString(), avain, op, virhe: virhe.message });
    localStorage.setItem(HYLATYT, JSON.stringify(lista.slice(-20)));
  } catch {
    // ei tallennustilaa
  }
}

function ajastaUusinta() {
  if (ajastin) return;
  ajastin = setTimeout(() => {
    ajastin = null;
    kaynnista();
  }, 5000);
}

window.addEventListener("online", kaynnista);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") kaynnista();
});
kaynnista();
