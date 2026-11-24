"use strict";

const $ = (id) => document.getElementById(id);
const DEFAULTS = {
  newChatUrl: "https://claude.ai/new",
  conversation: "same",
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
  await browser.storage.local.set(s);
  $("status").textContent = "Saved ✓";
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
