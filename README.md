# Private Corrector

A Firefox extension that corrects, rewrites or explains the text you select.

- **By default, it works automatically with the Gemini API** (free key): the text is sent in the background and the answer appears in the **Private Corrector window**, with Copy, Replace in page and highlighted changes.
- **Or it fills in the prompt on Claude, ChatGPT or Gemini's website**, with your normal account, where you press Send yourself.

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

1. Select text on any page, then right-click, open **Private Corrector**, and choose an action (or use the toolbar popup, below).
2. The first time, the Private Corrector window asks for your free Gemini API key: open [Google AI Studio → API keys](https://aistudio.google.com/apikey), click **Create API key**, paste it, then click **Save and run**.
3. The answer appears in the **Private Corrector window** as Gemini writes it. Then:
   - **Copy** the result;
   - **Replace in page**: puts the result in place of your selection (in text boxes and editable areas; Ctrl+Z undoes it). If the text can't be edited, or the selection was lost, the result is copied instead;
   - **Show changes**: word-by-word highlighting for corrections and rewrites;
   - **Regenerate**.

The window is reused for every new request and stays where you put it. Paper suggestions use Google Search to find real references, and their sources are listed under the answer.

**Privacy on Gemini's free tier.** Google may use what you send, and Gemini's answers, to improve its products, and human reviewers may read it. In the EU, the UK and Switzerland, Google applies its paid-tier data terms to free use too. For confidential text, use a key from a Google Cloud project with billing enabled (paid tier), or one of the chat websites in private mode. See the [Gemini API terms](https://ai.google.dev/gemini-api/terms).

**Model.** By default the extension uses the newest Gemini Flash model available to your key (fast, included in the free tier). You can choose another one in the settings (**Load the list**). If you reach the free-tier limit, wait a minute or try another model.

### Using a chat website instead

In the settings (**Send prompts to**), or for a single prompt in the popup (**Send to**), choose Claude, ChatGPT or Gemini (website). The extension then puts the prompt in the message box of that site, in a small floating window, and **you press Send yourself**. Sign in to the site in Firefox first.

**Where prompts go on the websites.** One AI window is reused for everything, and you pick its destination:
- **Private chat (default).** A small floating window opens on a new chat that isn't saved in your history: Claude's **incognito chat** (the extension clicks the ghost icon), ChatGPT's **temporary chat** (opened with its own address), or Gemini's **temporary chat** (the extension clicks its button). While the window stays open, every prompt goes into that same chat. Closing the window ends it. If the private mode can't be turned on automatically, a notification asks you to turn it on before you press Send.
- **My default chat.** Every prompt goes into one chat you choose for each AI, kept in your history. The window always goes back to that chat, whatever it is showing. To choose it, open the chat, then in the settings click **Use the open chat** next to that AI (or paste its address) and **Save**. If an AI has no default chat, its private chat is used.

The AI re-reads the whole chat at each message, so a long chat uses up your usage limits faster: close the window now and then, or change your default chat from time to time.

**Saved tasks.** Save your own prompts to reuse them in one click. They appear with a ★ in the right-click menu and in the popup, and can be combined with the other functions.
- In the popup: select **Ask a question…**, type your instruction, click **★ Save this as a task**, give it a name, then click Save.
- In the settings, under **My saved tasks**: add, edit or delete tasks.
- Tick **Reply with the text only** for tasks that transform the text (for example "Turn this into a polite, concise email"), so the result can be copied directly and merges with the other rewriting functions when combined.

**Combining functions.** In the toolbar popup, click several functions to select them (they turn orange with a ✓), then click **Send**. Everything goes to the AI in a single prompt (and comes back in one answer):
- several rewriting functions (Correct, Reformulate, Academic, Shorten, British or American English, and saved tasks marked "text only") are applied together to give **one** rewritten text, for example *Correct + British English* or *Academic + American English*;
- the other functions (Develop, Papers, Explain, Ask, other saved tasks) each get their own section in the answer, after the rewritten text.

British and American English can't be selected together. Your choice is remembered for next time. Double-click a function to send it alone right away. From the right-click menu, **Combine several functions…** opens the popup with your selection already in it.

Keyboard shortcuts: `Alt+Shift+C` (correct) and `Alt+Shift+A` (ask). You can change them in `about:addons`: click the gear icon, then **Manage Extension Shortcuts**.

The **toolbar button** opens a popup with the same actions. Text you selected on the page before clicking the icon is pasted into the popup automatically, so you can check or edit it before choosing an action.

**Text from other programs** (Word, a PDF reader, email...): select it, press **Ctrl+C**, then click the icon. When nothing is selected in Firefox, the popup pastes what you last copied. (The prompts the extension copies itself are skipped.) You can also type or paste text yourself.

In website mode, the prompt is **always copied to your clipboard** as well. If the extension can't fill in the message box (for example after a site redesign), a notification tells you: click in the box and press **Ctrl+V**. Very long texts may show up as a "pasted text" attachment, as they do when you paste them yourself.

## Install

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and choose `extension/manifest.json`.

A temporary add-on is removed when Firefox restarts. To install it permanently, sign it for free as an unlisted (private) add-on with `npx web-ext sign --channel=unlisted` (credentials: https://addons.mozilla.org/developers/addon/api/key/), then open the `.xpi` file that it creates.

## What it can access

| Permission | Why |
|---|---|
| `menus` | Adds the right-click entry, shown only when text is selected |
| `activeTab` + `scripting` | Reads your selection **only at the moment you click an action or use a shortcut**, in that tab only, and writes the result back when you click **Replace in page**. No script runs on the pages you visit. |
| Access to `generativelanguage.googleapis.com` | The Gemini API, in automatic mode: your text, the instructions and your API key are sent there when you choose an action |
| Access to `claude.ai`, `chatgpt.com`, `gemini.google.com` | In the AI window the extension opened: opens your default chat or starts a private chat (clicking the incognito / temporary chat button), and fills in the message box. It never presses Send and never reads your chats. |
| `clipboardWrite` | Copies the prompt as a backup |
| `clipboardRead` | Only when you open the popup and nothing is selected in Firefox: pastes what you last copied into the popup. Nothing is sent until you choose an action. |
| `notifications` | Tells you when you need to paste the prompt yourself |
| `storage` | Saves your settings and saved tasks, in this browser only |

In **automatic mode**, the extension sends your selected text and the instructions to the Gemini API, and nothing else (no page address, no other content), only when you choose an action. In **website mode** it makes no network requests itself: it opens the AI page and fills in the message box, and nothing is sent until you press Send.

## Settings

- Send prompts to: Gemini API, automatic (default), or Claude, ChatGPT or Gemini (website).
- Gemini API key and model (automatic by default).
- Websites: private chat (default) or your default chat for each AI.
- My saved tasks: add, edit, delete.
- Websites: open the AI page in a floating mini window (default), a tab, or a background tab.
- Language of answers for Develop, Papers, Explain and Ask. By default it follows the language of the text.
- How much **Shorten** reduces the text: about a quarter, a third (default), half, or as much as possible.
- Personal instructions added to every prompt.

To change the wording of an action's instructions, edit `extension/common/actions.js`, then click **Reload** in `about:debugging`.
