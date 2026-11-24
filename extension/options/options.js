"use strict";

const $ = (id) => document.getElementById(id);
const DEFAULTS = {
  apiKey: "",
  model: "claude-opus-5-5",
  answerLanguage: "same",
  webSearch: true,
  customInstructions: ""
};
const ORIGINS = { origins: ["https://api.anthropic.com/*"] };

async function load() {
  const s = { ...DEFAULTS, ...(await browser.storage.local.get(DEFAULTS)) };
  $("apiKey").value = s.apiKey;
  $("model").value = s.model;
  $("answerLanguage").value = s.answerLanguage;
  $("webSearch").checked = s.webSearch;
  $("customInstructions").value = s.customInstructions;
  $("perm").hidden = await browser.permissions.contains(ORIGINS);
}

async function save() {
  await browser.storage.local.set({
    apiKey: $("apiKey").value.trim(),
    model: $("model").value,
    answerLanguage: $("answerLanguage").value,
    webSearch: $("webSearch").checked,
    customInstructions: $("customInstructions").value
  });
  status("Saved ✓");
}

function status(msg) {
  $("status").textContent = msg;
}

$("save").addEventListener("click", save);
$("toggleKey").addEventListener("click", () => {
  const show = $("apiKey").type === "password";
  $("apiKey").type = show ? "text" : "password";
  $("toggleKey").textContent = show ? "Hide" : "Show";
});
$("grant").addEventListener("click", async () => {
  if (await browser.permissions.request(ORIGINS)) $("perm").hidden = true;
});
$("test").addEventListener("click", async () => {
  await save();
  status("Testing…");
  PCUtil.runAction(
    { actionId: "correct", text: "This sentense have two error." },
    {
      onDone: (info) => status(`Works ✓  (${info.model || "model"} answered: “${info.text.trim()}”)`),
      onError: (msg) => status("✗ " + msg)
    }
  );
});

load();
