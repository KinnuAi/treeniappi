// Tallennusjono: näkymä päivittyy heti, tallennus tapahtuu taustalla.
// Saman avaimen uusi muutos korvaa jonossa odottavan, joten vain viimeisin tila lähetetään.
// Epäonnistunut tallennus yritetään uudelleen, kun verkko palaa tai 5 sekunnin päästä.
// Vaiheessa 7 jono tallennetaan myös laitteelle, jotta se säilyy sovelluksen sulkemisen yli.
const jono = new Map(); // avain -> async funktio
const kuuntelijat = new Set();
let kaynnissa = null;
let ajastin = null;

export function lisaa(avain, tehtava) {
  jono.delete(avain);
  jono.set(avain, tehtava);
  ilmoita();
  kaynnista();
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

function ilmoita() {
  for (const f of kuuntelijat) f(jono.size);
}

function kaynnista() {
  if (!kaynnissa) kaynnissa = aja().finally(() => (kaynnissa = null));
}

async function aja() {
  while (jono.size) {
    const [avain, tehtava] = jono.entries().next().value;
    try {
      await tehtava();
    } catch {
      ajastaUusinta();
      return;
    }
    if (jono.get(avain) === tehtava) jono.delete(avain);
    ilmoita();
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
