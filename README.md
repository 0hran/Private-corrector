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
3. The extension puts the prompt in the message box of your **Private Corrector conversation** on claude.ai. Check it, press Send yourself, then copy Claude's answer with its copy button.

**One conversation, always the same.**
- The first time, a small floating claude.ai window opens on a new chat. When you send that first prompt, the extension saves the chat's address as your Private Corrector conversation and shows a notification.
- **Rename the chat "Private Corrector" once** in claude.ai (chat title menu, then Rename) so you can recognise it in your chat list. The extension finds the chat by its address, so the name is just for you.
- From then on, every action brings that window to the front and goes back to this conversation, even if you opened another chat in the window in the meantime. Nothing else piles up: no new windows, tabs or chats.
- If you close the window, or after a Firefox restart, the next action reopens the same conversation (or reuses a tab that already shows it).
- If you delete the conversation on claude.ai, the next action starts a new one and saves it the same way.
- In the settings you can see the saved address, paste the address of another chat to use instead, or click **Forget** to start a fresh one.

Claude re-reads the whole conversation at each message, so a very long Private Corrector conversation uses up your usage limits faster and mixes in your earlier texts. Click **Forget** in the settings now and then to start a fresh one.

Keyboard shortcuts: `Alt+Shift+C` (correct) and `Alt+Shift+A` (ask). You can change them in `about:addons`: click the gear icon, then **Manage Extension Shortcuts**.

The **toolbar button** opens a popup where you can paste text and use the same actions. Use it on pages where extensions can't run, such as the PDF viewer.

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
| Access to `claude.ai` | Fills in the message box of the Claude page the extension opened (it never presses Send and never reads your chats) |
| `clipboardWrite` | Copies the prompt (it never reads the clipboard) |
| `notifications` | Tells you when you need to paste the prompt yourself |
| `storage` | Saves your settings |

The extension makes **no network requests**. It only opens your Claude page and fills in the message box. Nothing is sent until you press Send, and then it goes to Claude exactly as if you had pasted it in yourself, under your account's normal settings and usage limits.

## Settings

- The Private Corrector conversation: saved automatically; you can paste another chat's address or click Forget to start a new one.
- Open the Claude page in a floating mini window (default), a tab, or a background tab.
- Language of answers for Develop, Papers and Ask. By default it follows the language of the text.
- Personal instructions added to every prompt.
- Advanced: the address used to start the conversation, for example a Claude project page so it is created in that project.

To change the wording of an action's instructions, edit `extension/common/actions.js`, then click **Reload** in `about:debugging`.
