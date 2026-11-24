/* Background script: reads the selection, builds the prompt, opens claude.ai. */
"use strict";

const DEFAULT_SETTINGS = {
  newChatUrl: "https://claude.ai/new",
  incognito: true, // turn on Claude's incognito mode in new chats
  openIn: "window", // "window" (floating mini window) | "foreground" | "background" (tabs)
  answerLanguage: "same",
  customInstructions: ""
};


async function getSettings() {
  return { ...DEFAULT_SETTINGS, ...(await browser.storage.local.get(DEFAULT_SETTINGS)) };
}

/* ---------- Context menu ---------- */

async function createMenus() {
  await browser.menus.removeAll();
  browser.menus.create({ id: "pc-root", title: "Private Corrector → Claude", contexts: ["selection"] });
  for (const action of PC_ACTIONS) {
    browser.menus.create({ id: "pc-" + action.id, parentId: "pc-root", title: action.title, contexts: ["selection"] });
  }
  browser.menus.create({ id: "pc-sep", parentId: "pc-root", type: "separator", contexts: ["selection"] });
  browser.menus.create({ id: "combine", parentId: "pc-root", title: "Combine several functions…", contexts: ["selection"] });
}
createMenus();

browser.menus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "combine") {
    // Opens the toolbar popup, which picks up the selection; must run before any await.
    browser.action.openPopup().catch(() => notify("Click the Private Corrector icon in the toolbar to combine functions."));
    return;
  }
  if (!String(info.menuItemId).startsWith("pc-")) return;
  const action = pcGetAction(String(info.menuItemId).slice(3));
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
  // From the popup: { type: "pc-send", actionIds: [...], text, question }
  if (msg && msg.type === "pc-send") {
    const actions = (msg.actionIds || []).map(pcGetAction);
    return sendToClaude(actions, msg.text, msg.question);
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
  const result = await sendToClaude(action, text, question);
  if (!result.filled) {
    notify("The prompt is on your clipboard: click in Claude's message box and press Ctrl+V.");
  }
}

/* ---------- Sending to the Claude window (incognito chat) ---------- */

/*
 * Build the prompt, copy it (as a backup), then put it in the message box of the
 * Claude window. One window is reused: while it stays open, every prompt goes into
 * the chat it shows. When a new window is opened, the extension starts a new chat and
 * turns on Claude's incognito mode (ghost icon), so nothing is kept in your history.
 * Closing the window ends the incognito chat. You press Send yourself.
 */
async function sendToClaude(action, text, question) {
  // `action` is one action or a list of actions combined in one prompt.
  const settings = await getSettings();
  const prompt = pcBuildPrompt(action, text, settings, question);
  await copyToClipboard(prompt);

  let tab = await getClaudeTab();
  let fresh = false;
  if (!tab) {
    tab = await openClaudePage(settings, settings.newChatUrl);
    fresh = true;
  } else {
    await focusTab(tab);
    if (!/^https:\/\/claude\.ai\//.test(tab.url || "")) {
      await browser.tabs.update(tab.id, { url: settings.newChatUrl });
      fresh = true;
    }
  }
  if (fresh) {
    await waitForLoad(tab.id);
    if (settings.incognito) {
      const state = await turnOnIncognito(tab.id);
      if (state !== "on") {
        notify(
          state === "clicked"
            ? "Check that the chat is in incognito mode (ghost icon) before you press Send."
            : "Could not turn on incognito automatically: click the ghost icon at the top right before you press Send."
        );
      }
    }
  }
  return { filled: await fillPrompt(tab.id, prompt) };
}

/* Click the ghost icon of a new chat. Returns "on", "clicked" (not confirmed) or "notfound". */
async function turnOnIncognito(tabId) {
  try {
    const [res] = await browser.scripting.executeScript({
      target: { tabId },
      func: async () => {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        const isOn = () =>
          Boolean(
            document.querySelector('[aria-label*="incognito" i][aria-pressed="true"], [data-testid*="incognito" i][aria-pressed="true"]') ||
              [...document.querySelectorAll("header *, [role=banner] *, main *")].some(
                (el) => el.childElementCount === 0 && /^\s*incognito chat\s*$/i.test(el.textContent)
              )
          );
        const find = () =>
          document.querySelector('button[aria-label*="incognito" i], [role=button][aria-label*="incognito" i], button[data-testid*="incognito" i]');
        let btn = null;
        for (let i = 0; i < 50 && !btn; i++) {
          if (isOn()) return "on";
          btn = find();
          if (!btn) await sleep(200); // the page may still be starting
        }
        if (!btn) return "notfound";
        btn.click();
        for (let i = 0; i < 15; i++) {
          await sleep(200);
          if (isOn()) return "on";
        }
        return "clicked";
      }
    });
    return (res && res.result) || "notfound";
  } catch (err) {
    console.warn("Private Corrector: could not turn on incognito", err);
    return "notfound";
  }
}

/* The Claude window opened by the extension, if it is still open. */
async function getClaudeTab() {
  const { claudeTabId } = await browser.storage.session.get("claudeTabId");
  if (claudeTabId == null) return null;
  try {
    return await browser.tabs.get(claudeTabId);
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

/* Open the Claude page: a small floating window (default) or a tab. */
async function openClaudePage(settings, url) {
  let tab;
  if (settings.openIn === "window") {
    let pos = {};
    try {
      // Top-right of the current Firefox window.
      const current = await browser.windows.getLastFocused();
      pos = {
        left: Math.max(0, current.left + current.width - WINDOW_WIDTH - 24),
        top: Math.max(0, current.top + 80)
      };
    } catch (_) {}
    const win = await browser.windows.create({ url, type: "popup", width: WINDOW_WIDTH, height: WINDOW_HEIGHT, ...pos });
    tab = win.tabs[0];
  } else {
    tab = await browser.tabs.create({ url, active: settings.openIn !== "background" });
  }
  await browser.storage.session.set({ claudeTabId: tab.id });
  return tab;
}

browser.tabs.onRemoved.addListener(async (tabId) => {
  const { claudeTabId } = await browser.storage.session.get("claudeTabId");
  if (tabId === claudeTabId) await browser.storage.session.remove("claudeTabId");
});

function waitForLoad(tabId, timeoutMs = 20000) {
  return new Promise((resolve) => {
    const done = () => {
      browser.tabs.onUpdated.removeListener(listener);
      clearTimeout(timer);
      resolve();
    };
    const listener = (id, change, t) => {
      if (id === tabId && change.status === "complete" && t.url && t.url.startsWith("https://claude.ai")) done();
    };
    const timer = setTimeout(done, timeoutMs);
    browser.tabs.onUpdated.addListener(listener);
  });
}

/* Put the prompt in Claude's message box (replacing any draft). Never presses Send. */
async function fillPrompt(tabId, prompt) {
  try {
    const [res] = await browser.scripting.executeScript({
      target: { tabId },
      args: [prompt],
      func: async (text) => {
        const find = () =>
          document.querySelector('div.ProseMirror[contenteditable="true"]') ||
          document.querySelector('[contenteditable="true"]') ||
          document.querySelector("textarea");
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
        // (long texts may become a "pasted text" attachment, as usual on claude.ai).
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

/* Ask the question for "Ask Claude…" with a simple dialog in the page. */
async function askQuestion(tab, frameIds) {
  try {
    const [res] = await browser.scripting.executeScript({
      target: { tabId: tab.id, frameIds: frameIds || [0] },
      func: () => window.prompt("Private Corrector – what do you want to ask Claude about the selected text?", "")
    });
    return res.result == null ? null : res.result.trim();
  } catch (_) {
    return ""; // cannot show a dialog here: Claude will be asked to explain the text
  }
}

async function copyToClipboard(text) {
  await browser.storage.session.set({ lastCopiedPrompt: text });
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
    iconUrl: browser.runtime.getURL("icons/icon.svg"),
    title: "Private Corrector",
    message
  });
}
