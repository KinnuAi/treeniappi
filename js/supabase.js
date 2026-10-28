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

// Lukee istunnon laitteelta, toimii myös ilman verkkoa
export async function nykyinenIstunto() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function kirjaudu(sahkoposti, salasana) {
  const { error } = await supabase.auth.signInWithPassword({ email: sahkoposti, password: salasana });
  if (error) throw error;
}

export async function kirjauduUlos() {
  await supabase.auth.signOut();
}
