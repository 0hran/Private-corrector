"use strict";

const $ = (id) => document.getElementById(id);
const DEFAULTS = {
  provider: "gemini-api",
  geminiApiKey: "",
  geminiModel: "auto",
  geminiFallback: "gemini",
  openIn: "window",
  answerLanguage: "same",
  shortenAmount: "about a third",
  customInstructions: ""
};
const FIELDS = Object.keys(DEFAULTS);
let tasks = [];

/* ---------- Default chat for each AI ---------- */

function buildChatRows() {
  const box = $("chats");
  for (const [id, p] of Object.entries(PC_PROVIDERS)) {
    const row = document.createElement("div");
    row.className = "row chatrow";
    const name = document.createElement("span");
    name.className = "pname";
    name.textContent = p.name;
    const input = document.createElement("input");
    input.type = "text";
    input.spellcheck = false;
    input.id = "chat-" + id;
    input.placeholder = p.chatExample;
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.type = "button";
    btn.textContent = "Use the open chat";
    btn.addEventListener("click", async () => {
      const url = await browser.runtime.sendMessage({ type: "pc-current-chat", provider: id });
      if (!url) {
        return status(`✗ No ${p.name} chat is open. Open the chat you want (a saved chat, not a private one), then try again.`);
      }
      input.value = url;
      status(`${p.name} chat found. Click Save to keep it.`);
    });
    row.append(name, input, btn);
    box.appendChild(row);
  }
}
buildChatRows();

/* ---------- Load / save ---------- */

function fill(s) {
  if (s.geminiModel && s.geminiModel !== "auto" && !$("geminiModel").querySelector(`option[value="${CSS.escape(s.geminiModel)}"]`)) {
    $("geminiModel").add(new Option(s.geminiModel, s.geminiModel));
  }
  for (const k of FIELDS) $(k).value = s[k];
  const dest = s.destination === "chat" ? "chat" : "private";
  document.querySelector(`input[name=destination][value=${dest}]`).checked = true;
  const urls = { claude: s.chatUrl || "", ...(s.chatUrls || {}) };
  for (const id of Object.keys(PC_PROVIDERS)) $("chat-" + id).value = urls[id] || "";
}

async function load() {
  const s = { ...DEFAULTS, destination: "private", customTasks: [], ...(await browser.storage.local.get(null)) };
  if (!PC_PROVIDERS[s.provider] && s.provider !== "gemini-api") s.provider = "gemini-api";
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
  s.destination = document.querySelector("input[name=destination]:checked").value;
  s.chatUrls = {};
  for (const [id, p] of Object.entries(PC_PROVIDERS)) {
    const url = $("chat-" + id).value.trim();
    if (!url) continue;
    if (!p.chatRe.test(url)) return status(`✗ The ${p.name} chat address must look like ${p.chatExample}`);
    s.chatUrls[id] = url;
  }
  if (s.destination === "chat" && !s.chatUrls[s.provider]) {
    return status(`✗ Choose a default chat for ${PC_PROVIDERS[s.provider].name} first (or select Private chat).`);
  }
  const bad = tasks.find((t) => !t.title.trim() || !t.prompt.trim());
  if (bad) return status("✗ Each saved task needs a name and an instruction.");
  s.customTasks = tasks.map((t) => ({ ...t, title: t.title.trim(), prompt: t.prompt.trim() }));
  await browser.storage.local.set(s);
  await browser.storage.local.remove(["chatUrl", "newChatUrl", "incognito"]); // older versions
  status("Saved ✓");
});

$("reset").addEventListener("click", async () => {
  // Saved tasks and the Gemini API key are kept.
  const keep = FIELDS.filter((k) => k !== "geminiApiKey");
  await browser.storage.local.remove([...keep, "destination", "chatUrls", "chatUrl", "newChatUrl", "incognito", "pcChatUrl", "urlTemplate", "conversation"]);
  fill({ ...DEFAULTS, geminiApiKey: $("geminiApiKey").value, destination: "private", chatUrls: {} });
  status("Defaults restored ✓ (your saved tasks and API key are kept)");
});

/* ---------- Gemini API ---------- */

$("toggleKey").addEventListener("click", () => {
  const show = $("geminiApiKey").type === "password";
  $("geminiApiKey").type = show ? "text" : "password";
  $("toggleKey").textContent = show ? "Hide" : "Show";
});

$("loadModels").addEventListener("click", async () => {
  const key = $("geminiApiKey").value.trim();
  if (!key) return status("✗ Paste your Gemini API key first.");
  status("Loading the models…");
  try {
    const models = await PCGemini.listModels(key);
    const current = $("geminiModel").value;
    const auto = PCGemini.pickFlash(models);
    $("geminiModel").textContent = "";
    $("geminiModel").add(new Option(`Automatic: the newest Gemini Flash model (now ${auto})`, "auto"));
    for (const m of models) $("geminiModel").add(new Option(`${m.name} (${m.id})`, m.id));
    $("geminiModel").value = [...$("geminiModel").options].some((o) => o.value === current) ? current : "auto";
    status(`✓ The key works: ${models.length} models available. Choose one and click Save.`);
  } catch (err) {
    status("✗ " + (err.message || err));
  }
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
    prompt.placeholder = "Instruction for the AI, e.g. Turn this into a polite, concise email.";
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

const ORIGINS = { origins: Object.values(PC_PROVIDERS).map((p) => p.match) };
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
