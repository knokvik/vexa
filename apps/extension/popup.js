const status = document.getElementById("status");

document.getElementById("prefill").addEventListener("click", async () => {
  const { lastPackage } = await chrome.storage.local.get(["lastPackage"]);
  if (!lastPackage) {
    status.textContent = "No package saved. Use Draft Inbox → Apply now first.";
    return;
  }
  if (lastPackage.autoSubmit === true) {
    status.textContent = "Blocked: package requested auto-submit.";
    return;
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  await chrome.tabs.sendMessage(tab.id, {
    type: "PREFILL_NOW",
    package: lastPackage,
  });
  status.textContent = `Prefill sent for ${lastPackage.company || "job"}. You submit.`;
});

document.getElementById("clear").addEventListener("click", async () => {
  await chrome.storage.local.remove(["lastPackage"]);
  status.textContent = "Cleared.";
});
