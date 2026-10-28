import { h, ikoni } from "../dom.js";
import { kirjaudu } from "../supabase.js";

function virheteksti(virhe) {
  const viesti = (virhe?.message || "").toLowerCase();
  if (viesti.includes("invalid login")) return "Sähköposti tai salasana on väärin.";
  if (viesti.includes("not confirmed")) return "Sähköpostiosoitetta ei ole vahvistettu.";
  if (!navigator.onLine || viesti.includes("fetch")) return "Ei yhteyttä. Kokeile uudelleen, kun verkko toimii.";
  return "Kirjautuminen ei onnistunut. Kokeile uudelleen.";
}

export function nayta({ sisalto, valmis }) {
  const sahkoposti = h("input", {
    id: "sahkoposti", class: "syote", type: "email", name: "email",
    autocomplete: "username", inputmode: "email", autocapitalize: "none", spellcheck: "false", required: true,
  });
  const salasana = h("input", {
    id: "salasana", class: "syote", type: "password", name: "password",
    autocomplete: "current-password", required: true,
  });
  const virheTeksti = h("span");
  const virhe = h("p", { class: "ilmoitus", role: "alert", hidden: true }, ikoni("circle-alert"), virheTeksti);
  const nappi = h("button", { type: "submit", class: "nappi nappi--kulta nappi--lg nappi--taysi" }, "Kirjaudu");

  async function laheta(e) {
    e.preventDefault();
    virhe.hidden = true;
    if (!sahkoposti.value.trim() || !salasana.value) {
      virheTeksti.textContent = "Kirjoita sähköposti ja salasana.";
      virhe.hidden = false;
      return;
    }
    nappi.disabled = true;
    nappi.textContent = "Kirjaudutaan";
    try {
      await kirjaudu(sahkoposti.value.trim(), salasana.value);
      valmis();
    } catch (err) {
      virheTeksti.textContent = virheteksti(err);
      virhe.hidden = false;
      nappi.disabled = false;
      nappi.textContent = "Kirjaudu";
    }
  }

  sisalto.append(
    h("div", { class: "kirjautuminen" },
      h("img", { class: "logo", src: "icons/logo-gold.svg", alt: "heilimö" }),
      h("h2", {}, "Kirjaudu"),
      h("form", { class: "lomake", novalidate: true, onsubmit: laheta },
        h("div", { class: "kentta" }, h("label", { for: "sahkoposti" }, "Sähköposti"), sahkoposti),
        h("div", { class: "kentta" }, h("label", { for: "salasana" }, "Salasana"), salasana),
        virhe,
        nappi
      )
    )
  );
}
