/* Chrome offscreen document: copies the prompt to the clipboard for the service worker. */
"use strict";

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== "pc-offscreen-copy") return false;
  const box = document.getElementById("buffer");
  box.value = msg.text;
  box.select();
  const ok = document.execCommand("copy");
  box.value = "";
  sendResponse({ ok });
  return false;
});
