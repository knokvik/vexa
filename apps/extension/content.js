/**
 * Content script: smart autofill only.
 * NEVER clicks submit / apply buttons automatically.
 */

const FIELD_MAP = [
  { keys: ["name", "full_name", "fullname", "full name"], valueKey: "name" },
  { keys: ["email", "e-mail"], valueKey: "email" },
  { keys: ["phone", "tel", "mobile"], valueKey: "phone" },
  { keys: ["linkedin", "linked-in"], valueKey: "linkedin" },
  { keys: ["github"], valueKey: "github" },
  { keys: ["location", "city", "address"], valueKey: "location" },
  {
    keys: ["cover", "cover letter", "cover_letter", "message"],
    valueKey: "cover_letter",
  },
  {
    keys: ["resume", "cv", "additional", "summary", "about"],
    valueKey: "resume_text",
  },
];

function normalize(s) {
  return (s || "").toLowerCase().replace(/[_\-]+/g, " ").trim();
}

function findValue(formData, field) {
  const hay = [
    field.name,
    field.id,
    field.placeholder,
    field.getAttribute("aria-label"),
    field.labels?.[0]?.textContent,
  ]
    .filter(Boolean)
    .map(normalize)
    .join(" ");

  for (const rule of FIELD_MAP) {
    if (rule.keys.some((k) => hay.includes(k))) {
      return formData[rule.valueKey];
    }
  }
  return undefined;
}

function setNativeValue(el, value) {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, "value");
  desc?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function prefill(formData) {
  if (!formData || typeof formData !== "object") return 0;
  let filled = 0;
  const nodes = document.querySelectorAll("input, textarea");
  for (const el of nodes) {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
      continue;
    }
    if (el.type === "hidden" || el.type === "submit" || el.type === "button") {
      continue;
    }
    if (el.type === "file") continue; // user attaches resume file intentionally

    const value = findValue(formData, el);
    if (value != null && value !== "") {
      setNativeValue(el, String(value));
      filled += 1;
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
    color: "#6ee7ff",
    border: "1px solid rgba(110,231,255,0.35)",
    borderRadius: "12px",
    padding: "12px 16px",
    fontFamily: "system-ui, sans-serif",
    fontSize: "13px",
    boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
    maxWidth: "320px",
  });
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

function runPrefillFromPackage(pkg) {
  if (!pkg) return;
  if (pkg.autoSubmit === true) {
    showToast("Vexa blocked auto-submit package.");
    return;
  }
  const n = prefill(pkg.filledFormData || {});
  showToast(
    `Vexa filled ${n} field(s) for ${pkg.company || "this job"}. You click Submit.`
  );
}

// From dashboard localStorage bridge when same browser profile visits job site after inbox.
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

// Auto-attempt prefill when package exists for this tab session.
chrome.runtime.sendMessage({ type: "GET_LAST_PACKAGE" }, (res) => {
  if (chrome.runtime.lastError) return;
  if (res?.package) {
    // Delay slightly so SPA forms mount.
    setTimeout(() => runPrefillFromPackage(res.package), 800);
  }
});

if (location.origin.includes("5173")) {
  tryLocalStorageBridge();
}
