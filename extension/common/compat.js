/*
 * Lets the same code run in Firefox and Chrome.
 * Firefox provides `browser.*` (promise-based); Chrome provides `chrome.*`, which is
 * promise-based in Manifest V3 but differs in a few places, adapted here:
 *  - `browser.menus` is `chrome.contextMenus`;
 *  - runtime.onMessage listeners that return a promise must answer via sendResponse.
 * In Firefox this file does nothing.
 */
"use strict";

// Firefox is recognised by browser.runtime.getBrowserInfo, which only it has. (Recent Chrome
// versions also define a `browser` object, but without `menus` and with Chrome's behaviour.)
const pcIsFirefox =
  typeof globalThis.browser !== "undefined" &&
  globalThis.browser.runtime &&
  typeof globalThis.browser.runtime.getBrowserInfo === "function";

if (!pcIsFirefox && typeof globalThis.chrome !== "undefined" && globalThis.chrome.runtime) {
  const onMessage = {
    addListener(listener) {
      chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        let result;
        try {
          result = listener(msg, sender);
        } catch (err) {
          console.error(err);
          return false;
        }
        if (result && typeof result.then === "function") {
          result.then(
            (value) => sendResponse(value),
            (err) => {
              console.error(err);
              sendResponse(undefined);
            }
          );
          return true; // keep the channel open for the async answer
        }
        return false;
      });
    }
  };

  const runtime = new Proxy(chrome.runtime, {
    get(target, prop) {
      if (prop === "onMessage") return onMessage;
      const value = target[prop];
      return typeof value === "function" ? value.bind(target) : value;
    }
  });

  const shim = new Proxy(chrome, {
    get(target, prop) {
      if (prop === "menus") return chrome.contextMenus;
      if (prop === "runtime") return runtime;
      return target[prop];
    }
  });
  try {
    Object.defineProperty(globalThis, "browser", { value: shim, writable: true, configurable: true });
  } catch (_) {
    globalThis.browser = shim;
  }
  if (globalThis.browser !== shim) console.error("Private Corrector: could not set up the browser compatibility layer");
}
