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

/* ---------- Choosing functions (several can be combined) ---------- */

const SELECTED_KEY = "pc-popup-selected";
let selected = new Set();
try {
  selected = new Set(JSON.parse(localStorage.getItem(SELECTED_KEY) || "[]").filter((id) => PC_ACTIONS.some((a) => a.id === id)));
} catch (_) {}

for (const action of PC_ACTIONS) {
  const b = document.createElement("button");
  b.className = "chip";
  b.textContent = action.title;
  b.dataset.id = action.id;
  b.title = "Click to select or unselect. Double-click to send this function alone.";
  b.addEventListener("click", () => toggle(action));
  b.addEventListener("dblclick", () => {
    selected = new Set([action.id]);
    refresh();
    send();
  });
  $("actions").appendChild(b);
}

function toggle(action) {
  if (selected.has(action.id)) {
    selected.delete(action.id);
  } else {
    // British and American English cannot be combined.
    if (action.group) PC_ACTIONS.filter((a) => a.group === action.group).forEach((a) => selected.delete(a.id));
    selected.add(action.id);
  }
  refresh();
  if (action.needsQuestion && selected.has(action.id)) $("question").focus();
}

function refresh() {
  document.querySelectorAll("#actions .chip").forEach((b) => b.classList.toggle("on", selected.has(b.dataset.id)));
  $("ask").hidden = !selected.has("ask");
  const n = selected.size;
  $("go").disabled = n === 0;
  $("go").textContent = n > 1 ? `Send ${n} combined functions to Claude` : "Send to Claude";
  try {
    localStorage.setItem(SELECTED_KEY, JSON.stringify([...selected]));
  } catch (_) {}
}
refresh();

$("go").addEventListener("click", () => send());
$("question").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});
$("settings").addEventListener("click", () => {
  browser.runtime.openOptionsPage();
  window.close();
});

async function send() {
  const text = $("input").value.trim();
  const error = (msg) => {
    $("error").textContent = msg;
    $("error").hidden = false;
  };
  if (!text) return error("Type or paste some text first.");
  if (!selected.size) return error("Select at least one function.");
  if (selected.has("ask") && !$("question").value.trim()) {
    $("question").focus();
    return error("Type your question for “Ask Claude…”.");
  }
  // Keep the order of the list, whatever the order of the clicks.
  const actionIds = PC_ACTIONS.filter((a) => selected.has(a.id)).map((a) => a.id);
  const res = await browser.runtime.sendMessage({ type: "pc-send", actionIds, text, question: $("question").value.trim() });
  if (res && !res.filled) {
    error("The prompt is on your clipboard: click in Claude's message box and press Ctrl+V.");
  } else {
    window.close();
  }
}
