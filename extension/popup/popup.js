"use strict";

const $ = (id) => document.getElementById(id);
const DRAFT_KEY = "pc-popup-draft";
const SELECTED_KEY = "pc-popup-selected";

let customTasks = [];
let allActions = PC_ACTIONS;
let selected = new Set();
let chatUrls = {};
let wantedDestination = "private";

/* "Private chat" is named after each AI; "My default chat" needs a chat saved in the settings. */
function updateDestination() {
  const id = $("provider").value;
  const p = pcProvider(id);
  const priv = $("destination").querySelector('option[value="private"]');
  const chat = $("destination").querySelector('option[value="chat"]');
  priv.textContent = p.privateName.charAt(0).toUpperCase() + p.privateName.slice(1);
  chat.disabled = !chatUrls[id];
  chat.textContent = chatUrls[id] ? "My default chat" : "My default chat (set it in the settings)";
  $("destination").value = chatUrls[id] && wantedDestination === "chat" ? "chat" : "private";
}

/* ---------- Text ---------- */

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

/* ---------- Functions (several can be combined) ---------- */

function renderChips() {
  allActions = pcAllActions(customTasks);
  selected = new Set([...selected].filter((id) => allActions.some((a) => a.id === id)));
  $("actions").textContent = "";
  $("mine").textContent = "";
  for (const action of allActions) {
    const b = document.createElement("button");
    b.className = "chip" + (action.custom ? " mine" : "");
    b.textContent = (action.custom ? "★ " : "") + action.title;
    b.dataset.id = action.id;
    b.title = action.custom
      ? action.task + "\n\nClick to select or unselect. Double-click to send this task alone."
      : "Click to select or unselect. Double-click to send this function alone.";
    b.addEventListener("click", () => toggle(action));
    b.addEventListener("dblclick", () => {
      selected = new Set([action.id]);
      refresh();
      send();
    });
    (action.custom ? $("mine") : $("actions")).appendChild(b);
  }
  $("mineLabel").hidden = !customTasks.length;
  refresh();
}

function toggle(action) {
  if (selected.has(action.id)) {
    selected.delete(action.id);
  } else {
    // British and American English cannot be combined.
    if (action.group) allActions.filter((a) => a.group === action.group).forEach((a) => selected.delete(a.id));
    selected.add(action.id);
  }
  refresh();
  if (action.needsQuestion && selected.has(action.id)) $("question").focus();
}

function refresh() {
  document.querySelectorAll(".chip").forEach((b) => b.classList.toggle("on", selected.has(b.dataset.id)));
  $("ask").hidden = !selected.has("ask");
  const n = selected.size;
  $("go").disabled = n === 0;
  const name = pcProvider($("provider").value).name;
  $("go").textContent = n > 1 ? `Send ${n} combined functions to ${name}` : `Send to ${name}`;
  try {
    localStorage.setItem(SELECTED_KEY, JSON.stringify([...selected]));
  } catch (_) {}
}

/* ---------- Saving a question as a task ---------- */

$("saveTaskOpen").addEventListener("click", () => {
  if (!$("question").value.trim()) {
    $("question").focus();
    return;
  }
  $("saveTaskOpen").hidden = true;
  $("saveTaskForm").hidden = false;
  $("saveTaskName").focus();
});

$("saveTaskBtn").addEventListener("click", saveTask);
$("saveTaskName").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    saveTask();
  }
});

async function saveTask() {
  const title = $("saveTaskName").value.trim();
  const prompt = $("question").value.trim();
  if (!title) {
    $("saveTaskName").focus();
    return;
  }
  const task = { id: "custom-" + Date.now(), title, prompt, rewrite: $("saveTaskRewrite").checked };
  customTasks = customTasks.concat(task);
  await browser.storage.local.set({ customTasks });
  // Switch the selection from "Ask" to the new task.
  selected.delete("ask");
  selected.add(task.id);
  $("question").value = "";
  $("saveTaskName").value = "";
  $("saveTaskForm").hidden = true;
  $("saveTaskOpen").hidden = false;
  $("saveTaskDone").hidden = false;
  setTimeout(() => ($("saveTaskDone").hidden = true), 2000);
  renderChips();
}

/* ---------- Sending ---------- */

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
    return error("Type your question for “Ask a question…”.");
  }
  // Keep the order of the list, whatever the order of the clicks.
  const actionIds = allActions.filter((a) => selected.has(a.id)).map((a) => a.id);
  const res = await browser.runtime.sendMessage({
    type: "pc-send",
    actionIds,
    text,
    question: $("question").value.trim(),
    provider: $("provider").value,
    destination: $("destination").value
  });
  if (res && !res.filled) {
    error(`The prompt is on your clipboard: click in ${res.name}'s message box and press Ctrl+V.`);
  } else {
    window.close();
  }
}

/* ---------- Start ---------- */

(async () => {
  const s = await browser.storage.local.get({ customTasks: [], provider: "gemini", destination: "private", chatUrls: {}, chatUrl: "" });
  customTasks = s.customTasks || [];
  chatUrls = { claude: s.chatUrl || undefined, ...s.chatUrls };
  // "Send to" starts on your defaults.
  $("provider").value = PC_PROVIDERS[s.provider] ? s.provider : "gemini";
  wantedDestination = s.destination === "chat" ? "chat" : "private";
  updateDestination();
  $("provider").addEventListener("change", () => {
    updateDestination();
    refresh();
  });
  try {
    selected = new Set(JSON.parse(localStorage.getItem(SELECTED_KEY) || "[]"));
  } catch (_) {}
  renderChips();
  loadSelection();
})();
