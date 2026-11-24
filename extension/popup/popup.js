"use strict";

const $ = (id) => document.getElementById(id);
const DRAFT_KEY = "pc-popup-draft";

try {
  $("input").value = localStorage.getItem(DRAFT_KEY) || "";
} catch (_) {}
$("input").addEventListener("input", () => {
  try {
    localStorage.setItem(DRAFT_KEY, $("input").value);
  } catch (_) {}
});

for (const action of PC_ACTIONS) {
  const b = document.createElement("button");
  b.className = "btn";
  b.textContent = action.title;
  b.addEventListener("click", () => {
    if (action.needsQuestion) {
      $("ask").hidden = false;
      $("question").focus();
    } else {
      send(action.id);
    }
  });
  $("actions").appendChild(b);
}

$("send").addEventListener("click", () => send("ask"));
$("question").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send("ask");
  }
});
$("settings").addEventListener("click", () => {
  browser.runtime.openOptionsPage();
  window.close();
});

async function send(actionId) {
  const text = $("input").value.trim();
  if (!text) {
    $("error").textContent = "Type or paste some text first.";
    $("error").hidden = false;
    return;
  }
  const res = await browser.runtime.sendMessage({ type: "pc-send", actionId, text, question: $("question").value.trim() });
  if (res && !res.filled) {
    $("error").textContent = "The prompt is on your clipboard: click in Claude's message box and press Ctrl+V.";
    $("error").hidden = false;
  } else {
    window.close();
  }
}
