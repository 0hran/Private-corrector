/* Background script: reads the selection, builds the prompt, opens claude.ai. */
"use strict";

const DEFAULT_SETTINGS = {
  newChatUrl: "https://claude.ai/new",
  pcChatUrl: "", // address of the "Private Corrector" conversation, saved automatically
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
}
createMenus();

browser.menus.onClicked.addListener(async (info, tab) => {
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
  // From the popup: { type: "pc-send", actionId, text, question }
  if (msg && msg.type === "pc-send") {
    return sendToClaude(pcGetAction(msg.actionId), msg.text, msg.question);
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

/* ---------- Sending to the Private Corrector conversation ---------- */

/*
 * Build the prompt, copy it (as a backup), then put it in the message box of the
 * dedicated "Private Corrector" conversation on claude.ai. The extension always goes
 * back to that conversation, whatever the Claude page is showing.
 * The conversation is recognised by its address (saved in pcChatUrl). Until it exists,
 * a new chat is opened, and its address is saved as soon as you send the first prompt.
 * The prompt is only filled in: you press Send yourself.
 */
async function sendToClaude(action, text, question) {
  const settings = await getSettings();
  const prompt = pcBuildPrompt(action, text, settings, question);
  await copyToClipboard(prompt);

  const chatUrl = settings.pcChatUrl;
  const target = chatUrl || settings.newChatUrl;
  let tab = (await getClaudeTab()) || (chatUrl && (await findOpenTab(chatUrl)));

  if (!tab) {
    tab = await openClaudePage(settings, target);
    await waitForLoad(tab.id);
  } else {
    await browser.storage.session.set({ claudeTabId: tab.id });
    await focusTab(tab);
    if (!chatUrl || !sameChat(tab.url, chatUrl)) {
      await browser.tabs.update(tab.id, { url: target });
      await waitForLoad(tab.id);
    }
  }

  if (chatUrl) {
    // If the conversation no longer exists, claude.ai sends us elsewhere: start a new one.
    const now = await browser.tabs.get(tab.id);
    if (!sameChat(now.url, chatUrl)) {
      await browser.storage.local.remove("pcChatUrl");
      await browser.tabs.update(tab.id, { url: settings.newChatUrl });
      await waitForLoad(tab.id);
      await armCapture(tab.id);
      notify("The Private Corrector conversation could not be found, so a new one is being started.");
    }
  } else {
    await armCapture(tab.id);
  }

  return { filled: await fillPrompt(tab.id, prompt) };
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

/* After a Firefox restart, reuse a tab already showing the conversation. */
async function findOpenTab(chatUrl) {
  const tabs = await browser.tabs.query({ url: "https://claude.ai/*" });
  return tabs.find((t) => sameChat(t.url, chatUrl)) || null;
}

/* Wait for the new chat to get its address (when you send the first prompt), then save it. */
async function armCapture(tabId) {
  await browser.storage.session.set({ captureTabId: tabId });
}

browser.tabs.onUpdated.addListener(async (tabId, change) => {
  if (!change.url) return;
  const m = change.url.match(/^https:\/\/claude\.ai\/chat\/[0-9a-f-]{16,}/i);
  if (!m) return;
  const { captureTabId } = await browser.storage.session.get("captureTabId");
  if (tabId !== captureTabId) return;
  await browser.storage.session.remove("captureTabId");
  await browser.storage.local.set({ pcChatUrl: m[0] });
  notify('This chat is now your Private Corrector conversation. Rename it "Private Corrector" in claude.ai (chat title menu → Rename) so you can find it easily.');
});

/* The Claude page opened by the extension, if it is still open. */
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
