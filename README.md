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
3. A **small floating claude.ai window** opens at the top right with the prompt filled in. Check it, press Send yourself, then copy Claude's answer with its copy button.

The same mini window is reused for every action (each action starts a new chat), and it keeps the size and position you give it. To use a normal tab instead, change it in the settings.

Keyboard shortcuts: `Alt+Shift+C` (correct) and `Alt+Shift+A` (ask). You can change them in `about:addons`: click the gear icon, then **Manage Extension Shortcuts**.

The **toolbar button** opens a popup where you can paste text and use the same actions. Use it on pages where extensions can't run, such as the PDF viewer.

The prompt is **always copied to your clipboard** as well. If the text is very long (roughly 1,500 words or more), it is too long to put in the address. claude.ai then opens empty: click in the message box and press **Ctrl+V**.

## Install

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and choose `extension/manifest.json`.

A temporary add-on is removed when Firefox restarts. To install it permanently, sign it for free as an unlisted (private) add-on with `npx web-ext sign --channel=unlisted` (credentials: https://addons.mozilla.org/developers/addon/api/key/), then open the `.xpi` file that it creates.

## What it can access

| Permission | Why |
|---|---|
| `menus` | Adds the right-click entry, shown only when text is selected |
| `activeTab` + `scripting` | Reads your selection **only at the moment you click an action or use a shortcut**, in that tab only. No script runs on the pages you visit. |
| `clipboardWrite` | Copies the prompt (it never reads the clipboard) |
| `notifications` | Tells you when you need to paste the prompt yourself |
| `storage` | Saves your settings |

The extension makes **no network requests**. All it does is open a claude.ai tab. Your text then goes to Claude exactly as if you had pasted it in yourself, under your account's normal settings and usage limits.

## Settings

- Open Claude in a floating mini window (default), a new tab, or a background tab.
- Language of answers for Develop, Papers and Ask. By default it follows the language of the text.
- Personal instructions added to every prompt.
- Advanced: the claude.ai address used, in case the way prompts are filled in ever changes.

To change the wording of an action's instructions, edit `extension/common/actions.js`, then click **Reload** in `about:debugging`.
