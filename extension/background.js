/*
 * Background script: reads the selection, builds the prompt, fills it in on Gemini, Claude or ChatGPT.
 * Runs as an event page in Firefox and as a service worker in Chrome (see chrome/sw.js).
 */
"use strict";

const DEFAULT_SETTINGS = {
  provider: "gemini", // "gemini" (default) | "claude" | "chatgpt"
  destination: "private", // "private" (incognito / temporary chat, default) | "chat" (your default chat)
  chatUrls: {}, // your default chat for each provider: { claude: "https://claude.ai/chat/…", … }
  openIn: "window", // "window" (floating mini window) | "foreground" | "background" (tabs)
  answerLanguage: "same",
  shortenAmount: "about a third",
  customInstructions: "",
  customTasks: [] // saved tasks: [{ id, title, prompt, rewrite }]
};

// Version 7: the Gemini API mode was removed. Delete its settings (including the API key)
// and keep Gemini, on its website, as the default AI.
browser.storage.local.get(["settingsVersion", "provider"]).then(async ({ settingsVersion, provider }) => {
  if (settingsVersion && settingsVersion >= 7) return;
  await browser.storage.local.remove(["geminiApiKey", "geminiModel", "geminiAutoModel", "geminiAutoModels", "geminiFallback"]);
  const update = { settingsVersion: 7 };
  if (!provider || provider === "gemini-api" || !settingsVersion) update.provider = "gemini";
  await browser.storage.local.set(update);
  await browser.storage.session.remove(["pcJob", "resultTabId"]);
  createMenus();
});

async function getSettings() {
  const s = { ...DEFAULT_SETTINGS, ...(await browser.storage.local.get(null)) };
  // Settings from earlier versions.
  if (s.destination === "incognito") s.destination = "private";
  if (s.chatUrl && !s.chatUrls.claude) s.chatUrls = { ...s.chatUrls, claude: s.chatUrl };
  if (!PC_PROVIDERS[s.provider]) s.provider = "gemini";
  return s;
}

/* ---------- Context menu ---------- */

// Menus are rebuilt one at a time (two rebuilds at once would create duplicate entries).
let menusQueue = Promise.resolve();
function createMenus() {
  menusQueue = menusQueue.then(buildMenus, buildMenus);
  return menusQueue;
}

async function buildMenus() {
  const s = await getSettings();
  await browser.menus.removeAll();
  const ctx = ["selection"];
  browser.menus.create({ id: "pc-root", title: `Private Corrector → ${pcProvider(s.provider).name}`, contexts: ctx });
  for (const action of PC_ACTIONS) {
    browser.menus.create({ id: "pc-" + action.id, parentId: "pc-root", title: action.title, contexts: ctx });
  }
  const mine = pcCustomToActions(s.customTasks);
  if (mine.length) {
    browser.menus.create({ id: "pc-sep-mine", parentId: "pc-root", type: "separator", contexts: ctx });
    for (const action of mine) {
      browser.menus.create({ id: "pc-" + action.id, parentId: "pc-root", title: "★ " + action.title, contexts: ctx });
    }
  }
  browser.menus.create({ id: "pc-sep", parentId: "pc-root", type: "separator", contexts: ctx });
  browser.menus.create({ id: "combine", parentId: "pc-root", title: "Combine several functions…", contexts: ctx });
}
createMenus();

// Rebuild the menu when saved tasks or the AI change.
browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.customTasks || changes.provider)) createMenus();
});

browser.menus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "combine") {
    // Opens the toolbar popup, which picks up the selection; must run before any await.
    browser.action.openPopup().catch(() => notify("Click the Private Corrector icon in the toolbar to combine functions."));
    return;
  }
  if (!String(info.menuItemId).startsWith("pc-")) return;
  const { customTasks } = await getSettings();
  const action = pcGetAction(String(info.menuItemId).slice(3), customTasks);
  if (!action) return;
  const frames = info.frameId != null ? [info.frameId] : undefined;
  const text = (await readSelection(tab, frames)) || info.selectionText || "";
  await run(action, text, tab, frames);
});

browser.commands.onCommand.addListener(async (command) => {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  const action = pcGetAction(command === "ask-selection" ? "ask" : "correct");
  const text = await readSelection(tab);
  if (!text) {
    notify("Select some text first.");
    return;
  }
  await run(action, text, tab);
});

browser.runtime.onMessage.addListener(async (msg) => {
  // From the popup: { type: "pc-send", actionIds: [...], text, question, provider, destination }
  if (msg && msg.type === "pc-send") {
    const { customTasks } = await getSettings();
    const actions = (msg.actionIds || []).map((id) => pcGetAction(id, customTasks)).filter(Boolean);
    return sendToAI(actions, msg.text, msg.question, { provider: msg.provider, destination: msg.destination });
  }
  // From the settings page: address of a chat open for this provider.
  if (msg && msg.type === "pc-current-chat") {
    const p = pcProvider(msg.provider);
    const own = await getAiTab();
    if (own && p.chatRe.test(own.url || "")) return own.url.match(p.chatRe)[0];
    const tabs = (await browser.tabs.query({ url: p.match })).filter((t) => p.chatRe.test(t.url || ""));
    const best = tabs.find((t) => t.active) || tabs[0];
    return best ? best.url.match(p.chatRe)[0] : "";
  }
});

/* ---------- Steps ---------- */

async function run(action, text, tab, frames) {
  if (!text.trim()) return;
  let question = "";
  if (action.needsQuestion) {
    question = await askQuestion(tab, frames);
    if (question === null) return; // cancelled
  }
  const result = await sendToAI(action, text, question);
  if (!result.filled) {
    notify(`The prompt is on your clipboard: click in ${result.name}'s message box and press Ctrl+V.`);
  }
}

/* ---------- Sending to the AI window ---------- */

/*
 * Build the prompt, copy it (as a backup), then put it in the message box of the AI
 * window. One window is reused for everything. Two destinations:
 *  - "private" (default): a new incognito / temporary chat, reused while the window
 *    stays open; closing the window ends it.
 *  - "chat": your default chat for that AI; the window always goes back to it.
 * You press Send yourself.
 */
async function sendToAI(action, text, question, override = {}) {
  const settings = await getSettings();
  const providerId = PC_PROVIDERS[override.provider] ? override.provider : settings.provider;
  const p = pcProvider(providerId);
  const chatUrl = settings.chatUrls[providerId] || "";
  let destination = override.destination || settings.destination;
  if (destination === "chat" && !chatUrl) destination = "private";
  const mode = providerId + ":" + (destination === "chat" ? chatKey(chatUrl) : "private");

  const prompt = pcBuildPrompt(action, text, settings, question);
  await copyToClipboard(prompt);
  let unconfirmedPrivate = false;

  const { aiMode } = await browser.storage.session.get("aiMode");
  let tab = await getAiTab();
  if (!tab && destination === "chat") tab = await findOpenTab(chatUrl);

  if (destination === "chat") {
    if (!tab) {
      tab = await openAiPage(settings, chatUrl);
      await waitForLoad(tab.id, p);
    } else {
      await rememberTab(tab);
      await focusTab(tab);
      if (!sameChat(tab.url, chatUrl)) {
        await browser.tabs.update(tab.id, { url: chatUrl });
        await waitForLoad(tab.id, p);
      }
    }
    const now = await browser.tabs.get(tab.id);
    if (!sameChat(now.url, chatUrl)) {
      notify(`Your default ${p.name} chat could not be opened (deleted?). Check its address in the settings before you press Send.`);
    }
  } else {
    // Private chat: reuse it while the window stays open and nothing else was used since.
    const start = p.privateUrl || p.newChat;
    let fresh = false;
    if (!tab) {
      tab = await openAiPage(settings, start);
      fresh = true;
    } else {
      await focusTab(tab);
      if (aiMode !== mode || pcProviderOfUrl(tab.url) !== providerId) {
        await browser.tabs.update(tab.id, { url: start });
        fresh = true;
      }
    }
    if (fresh) {
      await waitForLoad(tab.id, p);
      if (!p.privateUrl) {
        const state = await turnOnPrivateChat(tab.id, p);
        // Reuse this chat next time only if private mode is confirmed; otherwise start afresh.
        if (state !== "on") unconfirmedPrivate = true;
        if (state !== "on") {
          notify(
            state === "clicked"
              ? `Check that ${p.name} is in ${p.privateName} mode before you press Send.`
              : `Could not start a ${p.privateName} automatically: turn it on in ${p.name} before you press Send.`
          );
        }
      }
    }
  }
  const filled = await fillPrompt(tab.id, prompt, p.inputs);
  if (filled && !unconfirmedPrivate) await browser.storage.session.set({ aiMode: mode });
  else await browser.storage.session.remove("aiMode");
  return { filled, name: p.name };
}

function chatKey(url) {
  try {
    const u = new URL(url);
    return u.origin + u.pathname.replace(/\/$/, "");
  } catch (_) {
    return "";
  }
}

function sameChat(a, b) {
  return Boolean(a && b) && chatKey(a) === chatKey(b);
}

/* After a Firefox restart, reuse a tab that already shows the chat. */
async function findOpenTab(chatUrl) {
  const tabs = await browser.tabs.query({});
  return tabs.find((t) => sameChat(t.url, chatUrl)) || null;
}

async function rememberTab(tab) {
  await browser.storage.session.set({ aiTabId: tab.id });
}

/* The AI window opened by the extension, if it is still open. */
async function getAiTab() {
  const { aiTabId } = await browser.storage.session.get("aiTabId");
  if (aiTabId == null) return null;
  try {
    return await browser.tabs.get(aiTabId);
  } catch (_) {
    return null; // closed
  }
}

async function focusTab(tab) {
  await browser.tabs.update(tab.id, { active: true });
  await browser.windows.update(tab.windowId, { focused: true, state: "normal" }).catch(() => {});
}

const WINDOW_WIDTH = 460;
const WINDOW_HEIGHT = 720;

/* Open the AI page: a small floating window (default) or a tab. */
async function openAiPage(settings, url) {
  let tab;
  if (settings.openIn === "window") {
    let bounds = { width: WINDOW_WIDTH, height: WINDOW_HEIGHT };
    try {
      // Top-right of the current browser window, and no bigger than it.
      const current = await browser.windows.getLastFocused();
      const width = Math.min(WINDOW_WIDTH, current.width);
      const height = Math.min(WINDOW_HEIGHT, Math.max(300, current.height - 100));
      bounds = {
        width,
        height,
        left: Math.max(current.left, current.left + current.width - width - 24),
        top: current.top + Math.min(80, Math.max(0, current.height - height))
      };
    } catch (_) {}
    let win;
    try {
      win = await browser.windows.create({ url, type: "popup", ...bounds });
    } catch (_) {
      // The screen is too small for these bounds (Chrome refuses them): let the browser place it.
      win = await browser.windows.create({ url, type: "popup" });
    }
    tab = win.tabs[0];
  } else {
    tab = await browser.tabs.create({ url, active: settings.openIn !== "background" });
  }
  await rememberTab(tab);
  await browser.storage.session.remove("aiMode");
  return tab;
}

browser.tabs.onRemoved.addListener(async (tabId) => {
  const { aiTabId } = await browser.storage.session.get("aiTabId");
  if (tabId === aiTabId) await browser.storage.session.remove(["aiTabId", "aiMode"]);
});

function waitForLoad(tabId, provider, timeoutMs = 20000) {
  const origin = provider.match.replace("/*", "");
  return new Promise((resolve) => {
    const done = () => {
      browser.tabs.onUpdated.removeListener(listener);
      clearTimeout(timer);
      resolve();
    };
    const listener = (id, change, t) => {
      if (id === tabId && change.status === "complete" && t.url && t.url.startsWith(origin)) done();
    };
    const timer = setTimeout(done, timeoutMs);
    browser.tabs.onUpdated.addListener(listener);
  });
}

/* Click the incognito / temporary chat button. Returns "on", "clicked" (not confirmed) or "notfound". */
async function turnOnPrivateChat(tabId, provider) {
  try {
    const [res] = await browser.scripting.executeScript({
      target: { tabId },
      args: [provider.privateButton, provider.privateLabel.source],
      func: async (word, labelSource) => {
        const label = new RegExp(labelSource, "i");
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        const sel = (extra) =>
          `[aria-label*="${word}" i]${extra}, [data-testid*="${word}" i]${extra}, [mattooltip*="${word}" i]${extra}`;
        const isOn = () =>
          Boolean(
            document.querySelector(sel('[aria-pressed="true"]')) ||
              document.querySelector(sel('[aria-checked="true"]')) ||
              [...document.querySelectorAll("header *, [role=banner] *, main *, nav *")].some(
                (el) => el.childElementCount === 0 && label.test(el.textContent)
              )
          );
        const find = () =>
          [...document.querySelectorAll(sel(""))].find((el) => el.matches("button, [role=button], a") || el.closest("button"));
        let btn = null;
        for (let i = 0; i < 50 && !btn; i++) {
          if (isOn()) return "on";
          btn = find();
          if (!btn) await sleep(200); // the page may still be starting
        }
        if (!btn) return "notfound";
        (btn.closest("button") || btn).click();
        for (let i = 0; i < 15; i++) {
          await sleep(200);
          if (isOn()) return "on";
        }
        return "clicked";
      }
    });
    return (res && res.result) || "notfound";
  } catch (err) {
    console.warn("Private Corrector: could not start a private chat", err);
    return "notfound";
  }
}

/* Put the prompt in the message box (replacing any draft). Never presses Send. */
async function fillPrompt(tabId, prompt, selectors) {
  try {
    const [res] = await browser.scripting.executeScript({
      target: { tabId },
      args: [prompt, selectors],
      func: async (text, selectors) => {
        const find = () => {
          for (const s of selectors) {
            const el = document.querySelector(s);
            if (el) return el;
          }
          return null;
        };
        let box = find();
        for (let i = 0; !box && i < 50; i++) {
          await new Promise((r) => setTimeout(r, 200)); // the page may still be starting
          box = find();
        }
        if (!box) return false;
        box.focus();
        if (box.tagName === "TEXTAREA") {
          box.select();
          if (!document.execCommand("insertText", false, text)) {
            box.value = text;
            box.dispatchEvent(new Event("input", { bubbles: true }));
          }
          return true;
        }
        // Select the current draft so the prompt replaces it.
        const range = document.createRange();
        range.selectNodeContents(box);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        // Simulate a paste: the editor handles it like a normal Ctrl+V
        // (long texts may become a "pasted text" attachment, as when you paste them yourself).
        const data = new DataTransfer();
        data.setData("text/plain", text);
        const ev = new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true });
        box.dispatchEvent(ev);
        if (ev.defaultPrevented) return true;
        document.execCommand("insertText", false, text);
        return box.textContent.includes(text.split("\n")[0].slice(0, 40));
      }
    });
    return Boolean(res && res.result);
  } catch (err) {
    console.warn("Private Corrector: could not fill the prompt", err);
    return false;
  }
}

/* Read the full selection in the page (text boxes included). Runs only on click, thanks to activeTab. */
async function readSelection(tab, frameIds) {
  try {
    const results = await browser.scripting.executeScript({
      target: frameIds ? { tabId: tab.id, frameIds } : { tabId: tab.id, allFrames: true },
      func: () => {
        let el = document.activeElement;
        while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
        if (el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT") && el.selectionEnd > el.selectionStart) {
          return el.value.slice(el.selectionStart, el.selectionEnd);
        }
        return String(window.getSelection() || "");
      }
    });
    const found = results.map((r) => r.result).find((t) => t && t.trim());
    return found || "";
  } catch (_) {
    // Pages where extensions cannot run (about:, PDF viewer, addons.mozilla.org).
    return "";
  }
}

/* Ask the question for "Ask…" with a simple dialog in the page. */
async function askQuestion(tab, frameIds) {
  try {
    const [res] = await browser.scripting.executeScript({
      target: { tabId: tab.id, frameIds: frameIds || [0] },
      func: () => window.prompt("Private Corrector – what do you want to ask about the selected text?", "")
    });
    return res.result == null ? null : res.result.trim();
  } catch (_) {
    return ""; // cannot show a dialog here: the AI will be asked to explain the text
  }
}

async function copyToClipboard(text) {
  await browser.storage.session.set({ lastCopiedPrompt: text });
  if (typeof globalThis.pcCopyViaOffscreen === "function") {
    // Chrome: the background is a service worker without a page; copy from an offscreen document (chrome/sw.js).
    await globalThis.pcCopyViaOffscreen(text);
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch (_) {}
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  ta.remove();
}

function notify(message) {
  browser.notifications.create({
    type: "basic",
    iconUrl: browser.runtime.getURL("icons/icon-128.png"),
    title: "Private Corrector",
    message
  });
}
