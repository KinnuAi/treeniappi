// Yhteys Supabaseen ja kirjautuminen.
// Avain on publishable-avain: se saa olla julkisessa koodissa. RLS suojaa tiedot.
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/+esm";

const SUPABASE_URL = "https://tnvkwaaphqybefvgzttt.supabase.co";
const SUPABASE_AVAIN = "sb_publishable_Vd3reG0nyQfpb1rzntYSqA_6dpgjpWY";

export const supabase = createClient(SUPABASE_URL, SUPABASE_AVAIN, {
  auth: {
    persistSession: true,      // istunto säilyy laitteella
    autoRefreshToken: true,
    detectSessionInUrl: false, // ei magic linkejä
    storageKey: "treeni-istunto",
  },
});

// Lukee istunnon laitteelta. Ilman verkkoa vanhentunutta istuntoa ei voi uusia, mutta se on
// yhä tallessa: sovellus toimii silti, ja istunto uusitaan, kun verkko palaa.
export async function nykyinenIstunto() {
  // Ilman verkkoa (esim. lentotila) ei odoteta istunnon uusimista, vaan luetaan se suoraan laitteelta
  if (navigator.onLine) {
    try {
      const { data } = await Promise.race([
        supabase.auth.getSession(),
        new Promise((_, hylkaa) => setTimeout(() => hylkaa(new Error("Aikaraja")), 2000)),
      ]);
      if (data.session) return data.session;
    } catch {
      // verkko ei vastaa
    }
  }
  try {
    const tallessa = JSON.parse(localStorage.getItem("treeni-istunto"));
    if (tallessa?.refresh_token) return tallessa;
  } catch {
    // ei tallennustilaa
  }
  return null;
}

export async function kirjaudu(sahkoposti, salasana) {
  const { error } = await supabase.auth.signInWithPassword({ email: sahkoposti, password: salasana });
  if (error) throw error;
}

export async function kirjauduUlos() {
  await supabase.auth.signOut();
}
