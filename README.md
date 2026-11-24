# Private Corrector

A Firefox extension that sends the text you select to **claude.ai**, together with instructions for what you want done. It uses your normal Claude account (Free, Pro or Max): no API key and no extra cost.

| Action | What Claude is asked to do |
|---|---|
| **Correct (minimal changes)** | Fix spelling, grammar, agreement and punctuation without rephrasing anything; reply with the corrected text only |
| **Reformulate** | Rewrite more clearly, keeping the meaning, tone and length; reply with the text only |
| **Make it more academic** | Rewrite in a formal research-paper style without inventing facts or citations; reply with the text only |
| **Develop / provide content** | Expand the ideas with explanations, arguments and examples |
| **Suggest research papers** | Recommend relevant papers with full references and explain why each one matters, checking on the web where possible |
| **Ask Claude…** | Your own question or instruction about the selection |

## How to use it

1. Sign in to claude.ai in Firefox once.
2. Select text on any page, then right-click, open **Private Corrector → Claude**, and choose an action.
3. The extension puts the prompt in the message box of your **Claude window**. Check it, press Send yourself, then copy Claude's answer with its copy button.

**Incognito, one window.**
- The first time (or after you close the window), a small floating claude.ai window opens on a new chat. The extension turns on Claude's **incognito mode** (the ghost icon), so the chat is kept out of your Claude history and memory.
- While the window stays open, every action brings it to the front and fills in the prompt in that same incognito chat. No new windows, tabs or chats pile up.
- Closing the window erases the incognito chat. The next action starts a fresh one.
- If the extension can't turn incognito on (for example after a claude.ai redesign), a notification asks you to click the ghost icon at the top right before you press Send.

Claude re-reads the whole chat at each message, so close the window now and then: a long chat uses up your usage limits faster and mixes in your earlier texts. Incognito can be turned off in the settings.

Keyboard shortcuts: `Alt+Shift+C` (correct) and `Alt+Shift+A` (ask). You can change them in `about:addons`: click the gear icon, then **Manage Extension Shortcuts**.

The **toolbar button** opens a popup with the same actions. Text you selected on the page before clicking the icon is pasted into the popup automatically, so you can check or edit it before choosing an action.

**Text from other programs** (Word, a PDF reader, email...): select it, press **Ctrl+C**, then click the icon. When nothing is selected in Firefox, the popup pastes what you last copied. (The prompts the extension copies itself are skipped.) You can also type or paste text yourself.

The prompt is **always copied to your clipboard** as well. If the extension can't fill in the message box (for example after a claude.ai redesign), a notification tells you: click in the box and press **Ctrl+V**. Very long texts may show up as a "pasted text" attachment, as they do when you paste them yourself.

## Install

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and choose `extension/manifest.json`.

A temporary add-on is removed when Firefox restarts. To install it permanently, sign it for free as an unlisted (private) add-on with `npx web-ext sign --channel=unlisted` (credentials: https://addons.mozilla.org/developers/addon/api/key/), then open the `.xpi` file that it creates.

## What it can access

| Permission | Why |
|---|---|
| `menus` | Adds the right-click entry, shown only when text is selected |
| `activeTab` + `scripting` | Reads your selection **only at the moment you click an action or use a shortcut**, in that tab only. No script runs on the pages you visit. |
| Access to `claude.ai` | In the Claude window the extension opened: clicks the incognito (ghost) icon on new chats and fills in the message box. It never presses Send and never reads your chats. |
| `clipboardWrite` | Copies the prompt as a backup |
| `clipboardRead` | Only when you open the popup and nothing is selected in Firefox: pastes what you last copied into the popup. Nothing is sent until you choose an action. |
| `notifications` | Tells you when you need to paste the prompt yourself |
| `storage` | Saves your settings |

The extension makes **no network requests**. It only opens your Claude page and fills in the message box. Nothing is sent until you press Send, and then it goes to Claude exactly as if you had pasted it in yourself, under your account's normal settings and usage limits.

## Settings

- Use Claude incognito chats (on by default).
- Open the Claude page in a floating mini window (default), a tab, or a background tab.
- Language of answers for Develop, Papers and Ask. By default it follows the language of the text.
- Personal instructions added to every prompt.
- Advanced: the address used to start a new chat (keep `https://claude.ai/new` for incognito, which is not available inside projects).

To change the wording of an action's instructions, edit `extension/common/actions.js`, then click **Reload** in `about:debugging`.
