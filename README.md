# Private Corrector

A Firefox and Chrome extension that sends the text you select to **Gemini (default), Claude or ChatGPT**, together with instructions for what you want done. It uses your normal account on that site (free or paid): no API key and no extra cost. You review the prompt and press Send yourself.

## Download

| Browser | Download |
|---|---|
| **Chrome**, Edge, Brave, Opera | [private-corrector-chrome.zip](https://github.com/0hran/Private-corrector/releases/latest/download/private-corrector-chrome.zip) |
| **Firefox** | [private-corrector-firefox.zip](https://github.com/0hran/Private-corrector/releases/latest/download/private-corrector-firefox.zip) |

All versions: [Releases](https://github.com/0hran/Private-corrector/releases) · Full guide: [0hran.github.io/Private-corrector](https://0hran.github.io/Private-corrector/)

| Action | What the AI is asked to do |
|---|---|
| **Correct (minimal changes)** | Fix spelling, grammar, agreement and punctuation without rephrasing anything; reply with the corrected text only |
| **Reformulate** | Rewrite more clearly, keeping the meaning, tone and length; reply with the text only |
| **Make it more academic** | Rewrite in a formal research-paper style without inventing facts or citations; reply with the text only |
| **Shorten** | Reduce the text (by about a third by default; adjustable in the settings) while keeping the key ideas, facts and conclusions; reply with the text only |
| **Convert to British English** | British spelling, vocabulary and punctuation (colour, organise, flat, 'single quotes'); nothing else changed; non-English text is translated |
| **Convert to American English** | American spelling, vocabulary and punctuation (color, organize, apartment, "double quotes"); nothing else changed; non-English text is translated |
| **Develop / provide content** | Expand the ideas with explanations, arguments and examples |
| **Suggest research papers** | Recommend relevant papers with full references and explain why each one matters, checking on the web where possible |
| **Explain** | Explain the text in plain words: summary, key ideas, technical terms, context, and a simple example where it helps |
| **Ask a question…** | Your own question or instruction about the selection |

## How to use it

1. Sign in to Gemini (gemini.google.com, the default), Claude (claude.ai) or ChatGPT (chatgpt.com) in Firefox once.
2. Select text on any page, then right-click, open **Private Corrector**, and choose an action.
3. The extension puts the prompt in the message box of the **AI window**. Check it, press Send yourself, then copy the answer.

**Which AI.** Gemini is the default; choose another one in the settings. The toolbar popup's **Send to** menu lets you pick another one for a single prompt. The right-click menu shows the default AI's name.

**Where prompts go.** One AI window is reused for everything, and you pick its destination:
- **Private chat (default).** A small floating window opens on a new chat that isn't saved in your history: Claude's **incognito chat** (the extension clicks the ghost icon), ChatGPT's **temporary chat** (opened with its own address), or Gemini's **temporary chat** (the extension clicks its button). While the window stays open, every prompt goes into that same chat. Closing the window ends it. If the private mode can't be turned on automatically, a notification asks you to turn it on before you press Send.
- **My default chat.** Every prompt goes into one chat you choose for each AI, kept in your history. The window always goes back to that chat, whatever it is showing. To choose it, open the chat, then in the settings click **Use the open chat** next to that AI (or paste its address) and **Save**. If an AI has no default chat, its private chat is used.

The AI re-reads the whole chat at each message, so a long chat uses up your usage limits faster: close the window now and then, or change your default chat from time to time.

**Saved tasks.** Save your own prompts to reuse them in one click. They appear with a ★ in the right-click menu and in the popup, and can be combined with the other functions.
- In the popup: select **Ask a question…**, type your instruction, click **★ Save this as a task**, give it a name, then click Save.
- In the settings, under **My saved tasks**: add, edit or delete tasks.
- Tick **Reply with the text only** for tasks that transform the text (for example "Turn this into a polite, concise email"), so the result can be copied directly and merges with the other rewriting functions when combined.

**Combining functions.** In the toolbar popup, click several functions to select them (they turn orange with a ✓), then click **Send**. Everything goes to the AI in a single prompt:
- several rewriting functions (Correct, Reformulate, Academic, Shorten, British or American English, and saved tasks marked "text only") are applied together to give **one** rewritten text, for example *Correct + British English* or *Academic + American English*;
- the other functions (Develop, Papers, Explain, Ask, other saved tasks) each get their own section in the answer, after the rewritten text.

British and American English can't be selected together. Your choice is remembered for next time. Double-click a function to send it alone right away. From the right-click menu, **Combine several functions…** opens the popup with your selection already in it.

Keyboard shortcuts: `Alt+Shift+C` (correct) and `Alt+Shift+A` (ask). You can change them in `about:addons`: click the gear icon, then **Manage Extension Shortcuts**.

The **toolbar button** opens a popup with the same actions. Text you selected on the page before clicking the icon is pasted into the popup automatically, so you can check or edit it before choosing an action.

**Text from other programs** (Word, a PDF reader, email...): select it, press **Ctrl+C**, then click the icon. When nothing is selected in Firefox, the popup pastes what you last copied. (The prompts the extension copies itself are skipped.) You can also type or paste text yourself.

The prompt is **always copied to your clipboard** as well. If the extension can't fill in the message box (for example after a site redesign), a notification tells you: click in the box and press **Ctrl+V**. Very long texts may show up as a "pasted text" attachment, as they do when you paste them yourself.

## Install

Download the zip for your browser above, or build both versions yourself:

```bash
./build.sh
```

This creates `dist/private-corrector-firefox.zip` and `dist/private-corrector-chrome.zip` (and the unzipped folders `dist/firefox/` and `dist/chrome/`).

### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and choose `private-corrector-firefox.zip` (or `extension/manifest.json`).

A temporary add-on is removed when Firefox restarts. To install it permanently, sign it for free as an unlisted (private) add-on with `npx web-ext sign --channel=unlisted` (credentials: https://addons.mozilla.org/developers/addon/api/key/), then open the `.xpi` file that it creates.

### Chrome (and Edge, Brave, Opera…)

1. Unzip `private-corrector-chrome.zip` into a folder you keep (Chrome loads it from there).
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose that folder.
4. Optional: click the puzzle icon in the toolbar and pin Private Corrector.

The extension stays installed after Chrome restarts. Chrome 127 or later is required.

## Project layout

```
extension/            shared code; this folder is the Firefox version as is
  manifest.json       Firefox manifest (Manifest V3, background scripts)
  background.js       right-click menu, shortcuts, opens the AI page and fills in the prompt
  common/compat.js    makes the same code run in Chrome (chrome.* vs browser.*)
  common/actions.js   the functions and their instructions (edit here to tune them)
  common/providers.js the AI websites: addresses, private chat, message box
  popup/  options/    toolbar popup and settings page
chrome/               Chrome-only files: service worker entry point, offscreen clipboard page
build.sh              builds dist/firefox and dist/chrome (Chrome manifest generated)
docs/                 the GitHub Pages site: download page and guide
.github/workflows/    release.yml: builds the zips and publishes a release on every push to main
```

## Publishing a new version

1. Raise `"version"` in `extension/manifest.json` (the Chrome manifest takes it from there).
2. Push to `main`. The **Release** workflow builds both zips and publishes them as release `v<version>`; the download links always point to the latest release. Pushing again with the same version replaces that release's zips.

## What it can access

| Permission | Why |
|---|---|
| `menus` | Adds the right-click entry, shown only when text is selected |
| `activeTab` + `scripting` | Reads your selection **only at the moment you click an action or use a shortcut**, in that tab only. No script runs on the pages you visit. |
| Access to `claude.ai`, `chatgpt.com`, `gemini.google.com` | In the AI window the extension opened: opens your default chat or starts a private chat (clicking the incognito / temporary chat button), and fills in the message box. It never presses Send and never reads your chats. |
| `clipboardWrite` | Copies the prompt as a backup |
| `clipboardRead` | Only when you open the popup and nothing is selected in Firefox: pastes what you last copied into the popup. Nothing is sent until you choose an action. |
| `notifications` | Tells you when you need to paste the prompt yourself |
| `storage` | Saves your settings and saved tasks, in this browser only |

The extension makes **no network requests**. It only opens the AI page and fills in the message box. Nothing is sent until you press Send, and then it goes to the AI exactly as if you had pasted it in yourself, under your account's normal settings and usage limits.

## Settings

- AI assistant: Gemini (default), Claude or ChatGPT.
- Where prompts go: private chat (default) or your default chat for each AI.
- My saved tasks: add, edit, delete.
- Open the AI page in a floating mini window (default), a tab, or a background tab.
- Language of answers for Develop, Papers, Explain and Ask. By default it follows the language of the text.
- How much **Shorten** reduces the text: about a quarter, a third (default), half, or as much as possible.
- Personal instructions added to every prompt.

To change the wording of an action's instructions, edit `extension/common/actions.js`, then click **Reload** in `about:debugging`.
