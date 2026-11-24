"use strict";

const $ = (id) => document.getElementById(id);
const DEFAULTS = {
  newChatUrl: "https://claude.ai/new",
  chatUrl: "",
  openIn: "window",
  answerLanguage: "same",
  shortenAmount: "about a third",
  customInstructions: ""
};
const FIELDS = Object.keys(DEFAULTS);
const CHAT_RE = /^https:\/\/claude\.ai\/chat\/[0-9a-f-]+/i;

let tasks = [];

/* ---------- Load / save ---------- */

function fill(s) {
  for (const k of FIELDS) $(k).value = s[k];
  const dest = s.destination === "chat" ? "chat" : "incognito";
  document.querySelector(`input[name=destination][value=${dest}]`).checked = true;
}

async function load() {
  const s = { ...DEFAULTS, destination: "incognito", customTasks: [], ...(await browser.storage.local.get(null)) };
  fill(s);
  tasks = s.customTasks || [];
  renderTasks();
}

function status(msg) {
  $("status").textContent = msg;
}

$("save").addEventListener("click", async () => {
  const s = {};
  for (const k of FIELDS) s[k] = $(k).value.trim();
  if (!s.newChatUrl) s.newChatUrl = DEFAULTS.newChatUrl;
  s.destination = document.querySelector("input[name=destination]:checked").value;
  if (s.chatUrl && !CHAT_RE.test(s.chatUrl)) {
    return status("✗ The default chat address must look like https://claude.ai/chat/…");
  }
  if (s.destination === "chat" && !s.chatUrl) {
    return status("✗ Choose your default chat first (or select Incognito chat).");
  }
  const bad = tasks.find((t) => !t.title.trim() || !t.prompt.trim());
  if (bad) return status("✗ Each saved task needs a name and an instruction.");
  s.customTasks = tasks.map((t) => ({ ...t, title: t.title.trim(), prompt: t.prompt.trim() }));
  await browser.storage.local.set(s);
  status("Saved ✓");
});

$("reset").addEventListener("click", async () => {
  // Saved tasks are kept.
  await browser.storage.local.remove([...FIELDS, "destination", "incognito", "pcChatUrl", "urlTemplate", "conversation"]);
  fill({ ...DEFAULTS, destination: "incognito" });
  status("Defaults restored ✓ (your saved tasks are kept)");
});

/* ---------- Default chat ---------- */

$("useOpenChat").addEventListener("click", async () => {
  const url = await browser.runtime.sendMessage({ type: "pc-current-chat" });
  if (!url) {
    return status("✗ No claude.ai chat is open. Open the chat you want (it must be a saved chat, not incognito), then try again.");
  }
  $("chatUrl").value = url;
  document.querySelector("input[name=destination][value=chat]").checked = true;
  status("Chat found. Click Save to keep it.");
});

/* ---------- Saved tasks ---------- */

function renderTasks() {
  const box = $("tasks");
  box.textContent = "";
  if (!tasks.length) {
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = "No saved task yet.";
    box.appendChild(p);
  }
  tasks.forEach((t, i) => {
    const el = document.createElement("div");
    el.className = "task";

    const row = document.createElement("div");
    row.className = "row";
    const name = document.createElement("input");
    name.type = "text";
    name.placeholder = "Task name (shown in the menus)";
    name.value = t.title;
    name.addEventListener("input", () => (t.title = name.value));
    const del = document.createElement("button");
    del.className = "btn danger";
    del.type = "button";
    del.textContent = "Delete";
    del.addEventListener("click", () => {
      if (!confirm(`Delete the task “${t.title || "untitled"}”?`)) return;
      tasks.splice(i, 1);
      renderTasks();
      status("Task deleted. Click Save to confirm.");
    });
    row.append(name, del);

    const prompt = document.createElement("textarea");
    prompt.rows = 3;
    prompt.placeholder = "Instruction for Claude, e.g. Turn this into a polite, concise email.";
    prompt.value = t.prompt;
    prompt.addEventListener("input", () => (t.prompt = prompt.value));

    const label = document.createElement("label");
    label.className = "check";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = Boolean(t.rewrite);
    cb.addEventListener("change", () => (t.rewrite = cb.checked));
    label.append(cb, " Reply with the text only (the task transforms the text)");

    el.append(row, prompt, label);
    box.appendChild(el);
  });
}

$("addTask").addEventListener("click", () => {
  tasks.push({ id: "custom-" + Date.now(), title: "", prompt: "", rewrite: false });
  renderTasks();
  const inputs = $("tasks").querySelectorAll(".task input[type=text]");
  inputs[inputs.length - 1].focus();
});

/* ---------- Permission ---------- */

const ORIGINS = { origins: ["https://claude.ai/*"] };
async function checkPermission() {
  $("perm").hidden = await browser.permissions.contains(ORIGINS);
}
$("grant").addEventListener("click", async () => {
  await browser.permissions.request(ORIGINS);
  checkPermission();
});

// Saved tasks added from the popup while this page is open.
browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.customTasks) {
    tasks = changes.customTasks.newValue || [];
    renderTasks();
  }
});

load();
checkPermission();
