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

/* Paste the text selected in the current page into the box (activeTab is granted by clicking the icon). */
async function loadSelection() {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    const results = await browser.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: () => {
        let el = document.activeElement;
        while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
        if (el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT") && el.selectionEnd > el.selectionStart) {
          return el.value.slice(el.selectionStart, el.selectionEnd);
        }
        return String(window.getSelection() || "");
      }
    });
    const text = results.map((r) => r.result).find((t) => t && t.trim());
    if (text) {
      show(text, "✓ Text selected in the page pasted here.");
      return;
    }
  } catch (_) {
    // Pages where extensions cannot run (PDF viewer, about: pages...).
  }
  // Nothing selected in Firefox: use what you last copied (Ctrl+C), in any program.
  const copied = await readClipboard();
  const { lastCopiedPrompt } = await browser.storage.session.get("lastCopiedPrompt");
  if (copied && copied.trim() && copied !== lastCopiedPrompt) {
    show(copied, "✓ Text from your clipboard (last Ctrl+C) pasted here.");
  }
}

function show(text, note) {
  $("input").value = text.trim();
  $("loaded").textContent = note;
  $("loaded").hidden = false;
}

async function readClipboard() {
  try {
    return await navigator.clipboard.readText();
  } catch (_) {}
  try {
    // Older Firefox versions: paste into a hidden box.
    const ta = document.createElement("textarea");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    document.execCommand("paste");
    const text = ta.value;
    ta.remove();
    $("input").focus();
    return text;
  } catch (_) {
    return "";
  }
}
loadSelection();

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
