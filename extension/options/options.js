"use strict";

const $ = (id) => document.getElementById(id);
const DEFAULTS = {
  newChatUrl: "https://claude.ai/new",
  pcChatUrl: "",
  openIn: "window",
  answerLanguage: "same",
  customInstructions: ""
};
const FIELDS = Object.keys(DEFAULTS);

function fill(s) {
  for (const k of FIELDS) $(k).value = s[k];
}

async function load() {
  fill({ ...DEFAULTS, ...(await browser.storage.local.get(DEFAULTS)) });
}

$("save").addEventListener("click", async () => {
  const s = {};
  for (const k of FIELDS) s[k] = $(k).value.trim();
  if (!s.newChatUrl) s.newChatUrl = DEFAULTS.newChatUrl;
  // Never clear the saved conversation by accident (use "Forget" for that).
  if (!s.pcChatUrl) delete s.pcChatUrl;
  else if (!/^https:\/\/claude\.ai\/chat\/[0-9a-f-]+/i.test(s.pcChatUrl)) {
    $("status").textContent = "✗ The conversation address must look like https://claude.ai/chat/…";
    return;
  }
  await browser.storage.local.set(s);
  $("status").textContent = "Saved ✓";
});

$("forget").addEventListener("click", async () => {
  await browser.storage.local.remove("pcChatUrl");
  $("pcChatUrl").value = "";
  $("status").textContent = "Forgotten ✓ The next action starts a new Private Corrector conversation.";
});

$("reset").addEventListener("click", async () => {
  await browser.storage.local.clear();
  fill(DEFAULTS);
  $("status").textContent = "Defaults restored ✓";
});

const ORIGINS = { origins: ["https://claude.ai/*"] };
async function checkPermission() {
  $("perm").hidden = await browser.permissions.contains(ORIGINS);
}
$("grant").addEventListener("click", async () => {
  await browser.permissions.request(ORIGINS);
  checkPermission();
});

load();
checkPermission();
