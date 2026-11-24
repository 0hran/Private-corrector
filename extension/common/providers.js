/* The AI chat websites the extension can send prompts to. */
"use strict";

var PC_PROVIDERS = {
  claude: {
    name: "Claude",
    match: "https://claude.ai/*",
    newChat: "https://claude.ai/new",
    // Private chat: started from a new chat with the ghost icon (no URL for it).
    privateName: "incognito chat",
    privateButton: "incognito", // word in the button's aria-label
    privateLabel: /^\s*incognito chat\s*$/i, // label shown once it is on
    chatRe: /^https:\/\/claude\.ai\/chat\/[0-9a-f-]{16,}/i,
    chatExample: "https://claude.ai/chat/…",
    inputs: ['div.ProseMirror[contenteditable="true"]', '[contenteditable="true"]', "textarea"]
  },
  chatgpt: {
    name: "ChatGPT",
    match: "https://chatgpt.com/*",
    newChat: "https://chatgpt.com/",
    // Private chat: ChatGPT's temporary chat has its own address.
    privateName: "temporary chat",
    privateUrl: "https://chatgpt.com/?temporary-chat=true",
    chatRe: /^https:\/\/chatgpt\.com\/(?:g\/[^/]+\/)?c\/[0-9a-z-]{16,}/i,
    chatExample: "https://chatgpt.com/c/…",
    inputs: ['#prompt-textarea[contenteditable="true"]', "div.ProseMirror[contenteditable=\"true\"]", "#prompt-textarea", "textarea"]
  },
  gemini: {
    name: "Gemini",
    match: "https://gemini.google.com/*",
    newChat: "https://gemini.google.com/app",
    // Private chat: Gemini's temporary chat, started with a button (no URL for it).
    privateName: "temporary chat",
    privateButton: "temporary",
    privateLabel: /^\s*temporary chat\s*$/i,
    chatRe: /^https:\/\/gemini\.google\.com\/(?:u\/\d+\/)?app\/[0-9a-f]{8,}/i,
    chatExample: "https://gemini.google.com/app/…",
    inputs: ['rich-textarea .ql-editor[contenteditable="true"]', '.ql-editor[contenteditable="true"]', '[contenteditable="true"]', "textarea"]
  }
};

function pcProvider(id) {
  return PC_PROVIDERS[id] || PC_PROVIDERS.claude;
}

/* Which provider a URL belongs to, or null. */
function pcProviderOfUrl(url) {
  for (const [id, p] of Object.entries(PC_PROVIDERS)) {
    const origin = p.match.replace("/*", "");
    if ((url || "").startsWith(origin + "/") || url === origin) return id;
  }
  return null;
}
