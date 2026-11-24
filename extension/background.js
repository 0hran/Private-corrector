/* Background script: reads the selection, builds the prompt, opens claude.ai. */
"use strict";

const DEFAULT_SETTINGS = {
  urlTemplate: "https://claude.ai/new?q=%s",
  openIn: "foreground", // "foreground" | "background"
  answerLanguage: "same",
  customInstructions: ""
};

// Prompts longer than this (once URL-encoded) are not put in the URL;
// claude.ai is opened empty and you paste the prompt from the clipboard.
const MAX_URL_PROMPT = 12000;

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
  if (result.pasteNeeded) {
    notify("The text is long, so it was copied instead of filled in. Click in Claude's message box and press Ctrl+V.");
  }
}

/* Build the prompt, copy it, and open claude.ai. */
async function sendToClaude(action, text, question) {
  const settings = await getSettings();
  const prompt = pcBuildPrompt(action, text, settings, question);
  await copyToClipboard(prompt);

  const encoded = encodeURIComponent(prompt);
  const fits = encoded.length <= MAX_URL_PROMPT && settings.urlTemplate.includes("%s");
  const url = fits ? settings.urlTemplate.replace("%s", encoded) : baseUrl(settings.urlTemplate);
  await browser.tabs.create({ url, active: settings.openIn !== "background" });
  return { pasteNeeded: !fits };
}

function baseUrl(template) {
  return template.split("?")[0].replace("%s", "");
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
