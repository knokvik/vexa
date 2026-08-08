/**
 * Content script: smart autofill for Greenhouse, Lever, Ashby, Workday, generic.
 * NEVER clicks submit / apply buttons automatically.
 */

/** Canonical keys + many ATS label variants */
const FIELD_MAP = [
  {
    keys: ["first name", "firstname", "given name", "first_name"],
    valueKey: "first_name",
  },
  {
    keys: ["last name", "lastname", "family name", "surname", "last_name"],
    valueKey: "last_name",
  },
  {
    keys: ["full name", "fullname", "full_name", "candidate name", "your name"],
    valueKey: "name",
  },
  {
    keys: ["email", "e-mail", "email address", "candidate email"],
    valueKey: "email",
  },
  {
    keys: ["phone", "tel", "mobile", "telephone", "phone number"],
    valueKey: "phone",
  },
  {
    keys: ["linkedin", "linked-in", "linkedin url", "linkedin profile"],
    valueKey: "linkedin",
  },
  { keys: ["github", "github url", "github profile"], valueKey: "github" },
  {
    keys: ["portfolio", "website", "personal website", "homepage", "url"],
    valueKey: "website",
  },
  {
    keys: ["location", "city", "address", "current location", "where are you based"],
    valueKey: "location",
  },
  {
    keys: ["cover letter", "coverletter", "cover_letter", "message", "additional information"],
    valueKey: "cover_letter",
  },
  {
    keys: ["resume", "cv", "additional", "summary", "about you", "about"],
    valueKey: "resume_text",
  },
  {
    keys: [
      "why",
      "what interests you",
      "motivation",
      "why are you interested",
      "why do you want",
      "why this",
    ],
    valueKey: "why_company",
  },
  {
    keys: [
      "tell us about",
      "describe your experience",
      "relevant experience",
      "background",
      "qualifications",
    ],
    valueKey: "relevant_experience",
  },
  {
    keys: [
      "years of experience",
      "years experience",
      "total years",
      "how many years",
    ],
    valueKey: "years_experience",
  },
  {
    keys: ["current company", "employer", "current employer"],
    valueKey: "current_company",
  },
  {
    keys: ["current title", "job title", "current role", "headline"],
    valueKey: "current_title",
  },
  {
    keys: ["salary", "compensation", "desired salary", "expected salary", "pay expectation"],
    valueKey: "salary_expectation",
  },
  {
    keys: [
      "authorized",
      "work authorization",
      "legally authorized",
      "eligible to work",
    ],
    valueKey: "work_authorization",
  },
  {
    keys: ["sponsorship", "visa", "require sponsorship", "need sponsorship"],
    valueKey: "sponsorship",
  },
  {
    keys: ["how did you hear", "how_did_you_hear", "referral source", "source"],
    valueKey: "how_heard",
  },
  { keys: ["school", "university", "college"], valueKey: "school" },
  { keys: ["degree", "education"], valueKey: "degree" },
  { keys: ["gender"], valueKey: "gender" },
  { keys: ["race", "ethnicity", "race/ethnicity"], valueKey: "race_ethnicity" },
  { keys: ["veteran"], valueKey: "veteran_status" },
  { keys: ["disability"], valueKey: "disability" },
];

function normalize(s) {
  return (s || "").toLowerCase().replace(/[_\-]+/g, " ").trim();
}

function fieldHaystack(el) {
  const labelText = (() => {
    if (el.labels && el.labels.length) {
      return Array.from(el.labels)
        .map((l) => l.textContent || "")
        .join(" ");
    }
    const id = el.id;
    if (id) {
      const lab = document.querySelector(`label[for="${CSS.escape(id)}"]`);
      if (lab) return lab.textContent || "";
    }
    // Greenhouse often wraps input near a label sibling
    const parent = el.closest("label, .field, .application-field, .form-group, [class*='field']");
    if (parent) return parent.textContent || "";
    return "";
  })();

  return [
    el.name,
    el.id,
    el.placeholder,
    el.getAttribute("aria-label"),
    el.getAttribute("data-qa"),
    el.getAttribute("autocomplete"),
    labelText,
  ]
    .filter(Boolean)
    .map(normalize)
    .join(" ");
}

function findValue(formData, el) {
  const hay = fieldHaystack(el);
  if (!hay) return undefined;

  // Direct key match on name/id
  const nameKey = normalize(el.name || el.id || "").replace(/\s+/g, "_");
  if (nameKey && formData[nameKey] != null && formData[nameKey] !== "") {
    return formData[nameKey];
  }
  // formData may use original keys
  if (el.name && formData[el.name] != null) return formData[el.name];
  if (el.id && formData[el.id] != null) return formData[el.id];

  let best = undefined;
  let bestLen = 0;
  for (const rule of FIELD_MAP) {
    for (const k of rule.keys) {
      if (hay.includes(k) && k.length >= bestLen) {
        const v = formData[rule.valueKey];
        if (v != null && v !== "") {
          best = v;
          bestLen = k.length;
        }
      }
    }
  }
  return best;
}

function setNativeValue(el, value) {
  if (el instanceof HTMLSelectElement) {
    const target = String(value).toLowerCase();
    let matched = false;
    for (const opt of Array.from(el.options)) {
      const t = normalize(opt.text);
      const v = normalize(opt.value);
      if (
        t === target ||
        v === target ||
        t.includes(target) ||
        target.includes(t) ||
        t.includes("decline") && target.includes("decline") ||
        t.includes("prefer not") && target.includes("decline")
      ) {
        el.value = opt.value;
        matched = true;
        break;
      }
    }
    if (!matched) return false;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, "value");
  desc?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function prefill(formData) {
  if (!formData || typeof formData !== "object") return 0;
  let filled = 0;
  const nodes = document.querySelectorAll("input, textarea, select");
  for (const el of nodes) {
    if (
      !(
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement
      )
    ) {
      continue;
    }
    if (el instanceof HTMLInputElement) {
      if (
        el.type === "hidden" ||
        el.type === "submit" ||
        el.type === "button" ||
        el.type === "file" ||
        el.type === "checkbox" ||
        el.type === "radio" ||
        el.type === "password"
      ) {
        continue;
      }
    }

    const value = findValue(formData, el);
    if (value != null && value !== "") {
      if (setNativeValue(el, String(value))) filled += 1;
    }
  }
  return filled;
}

function showToast(text) {
  const id = "vexa-prefill-toast";
  document.getElementById(id)?.remove();
  const el = document.createElement("div");
  el.id = id;
  el.textContent = text;
  Object.assign(el.style, {
    position: "fixed",
    bottom: "16px",
    right: "16px",
    zIndex: "2147483647",
    background: "#0b0d14",
    color: "#f5f5f5",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "12px",
    padding: "12px 16px",
    fontFamily: "system-ui, sans-serif",
    fontSize: "13px",
    boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
    maxWidth: "340px",
  });
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 5500);
}

function runPrefillFromPackage(pkg) {
  if (!pkg) return;
  if (pkg.autoSubmit === true) {
    showToast("Vexa blocked auto-submit package.");
    return;
  }
  const data = { ...(pkg.filledFormData || {}) };
  // Merge structured formAnswers aliases into flat map
  if (Array.isArray(pkg.formAnswers)) {
    for (const a of pkg.formAnswers) {
      if (!a?.value) continue;
      data[a.key] = a.value;
      for (const al of a.aliases || []) data[al] = a.value;
    }
  }
  const n = prefill(data);
  const surface = pkg.formSurface ? ` (${pkg.formSurface})` : "";
  const evalBit =
    pkg.formEval?.avgOverall != null
      ? ` · form quality ${pkg.formEval.avgOverall}`
      : "";
  showToast(
    `Vexa filled ${n} field(s) for ${pkg.company || "this job"}${surface}${evalBit}. You click Submit.`
  );
}

function tryLocalStorageBridge() {
  try {
    const raw = localStorage.getItem("vexa:lastApplyPackage");
    if (!raw) return;
    const pkg = JSON.parse(raw);
    chrome.runtime.sendMessage({ type: "SAVE_PACKAGE", package: pkg });
  } catch {
    /* ignore */
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "PREFILL_NOW") {
    runPrefillFromPackage(message.package);
    sendResponse({ ok: true });
    return false;
  }
  return false;
});

chrome.runtime.sendMessage({ type: "GET_LAST_PACKAGE" }, (res) => {
  if (chrome.runtime.lastError) return;
  if (res?.package) {
    setTimeout(() => runPrefillFromPackage(res.package), 900);
    // SPAs remount fields — second pass
    setTimeout(() => runPrefillFromPackage(res.package), 2200);
  }
});

if (location.origin.includes("5173")) {
  tryLocalStorageBridge();
}
