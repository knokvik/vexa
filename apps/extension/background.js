/**
 * Vexa extension background — packages only, never submits forms.
 */

const API_BASE = "http://127.0.0.1:5173";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "FETCH_PACKAGE") {
    fetch(`${API_BASE}/api/applications/${message.applicationId}/package`)
      .then((r) => r.json())
      .then((data) => {
        if (data.package) {
          chrome.storage.local.set({ lastPackage: data.package });
        }
        sendResponse(data);
      })
      .catch((err) => sendResponse({ error: String(err) }));
    return true;
  }

  if (message?.type === "GET_LAST_PACKAGE") {
    chrome.storage.local.get(["lastPackage"], (result) => {
      sendResponse({ package: result.lastPackage ?? null });
    });
    return true;
  }

  if (message?.type === "SAVE_PACKAGE") {
    if (message.package?.autoSubmit === true) {
      sendResponse({ error: "Rejected: autoSubmit must be false" });
      return false;
    }
    chrome.storage.local.set({ lastPackage: message.package }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }

  return false;
});
