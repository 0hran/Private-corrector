/* Chrome service worker: loads the shared background code. */

/*
 * The service worker has no page, so it cannot use the clipboard itself:
 * it asks an offscreen document (offscreen.html) to copy the prompt.
 */
self.pcCopyViaOffscreen = async function (text) {
  try {
    const url = chrome.runtime.getURL("offscreen.html");
    const existing = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"], documentUrls: [url] });
    if (!existing.length) {
      await chrome.offscreen.createDocument({
        url: "offscreen.html",
        reasons: ["CLIPBOARD"],
        justification: "Copy the prompt to the clipboard as a backup."
      });
    }
    await chrome.runtime.sendMessage({ type: "pc-offscreen-copy", text });
  } catch (err) {
    console.warn("Private Corrector: could not copy the prompt", err);
  }
};

importScripts("common/compat.js", "common/actions.js", "common/providers.js", "background.js");
