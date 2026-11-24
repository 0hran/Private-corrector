"use strict";

const $ = (id) => document.getElementById(id);
const DEFAULTS = {
  urlTemplate: "https://claude.ai/new?q=%s",
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
  if (!s.urlTemplate) s.urlTemplate = DEFAULTS.urlTemplate;
  await browser.storage.local.set(s);
  $("status").textContent = "Saved ✓";
});

$("reset").addEventListener("click", async () => {
  await browser.storage.local.clear();
  fill(DEFAULTS);
  $("status").textContent = "Defaults restored ✓";
});

load();
