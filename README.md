# Private Corrector

A Firefox extension that sends the text you select to Claude and gives you back:

| Action | What it does | Output |
|---|---|---|
| **Correct (minimal changes)** | Fixes spelling, grammar, agreement and punctuation without rephrasing anything | Text you can paste back, with changes highlighted |
| **Reformulate** | Rewrites the text more clearly, same meaning, tone and length | Text you can paste back |
| **Make it more academic** | Rewrites in a formal research-paper style, without inventing facts or citations | Text you can paste back |
| **Develop / provide content** | Expands the ideas with explanations, arguments and examples | Formatted answer |
| **Suggest research papers** | Recommends relevant papers, checked with web search, with the sources listed | Formatted answer |
| **Ask Claude…** | Any question or instruction about the selection | Formatted answer |

Corrections stay in the language of the text (French stays French, and so on).

## How to use it

1. Select text on any page, in a text box or in a rich-text editor.
2. Right-click, open **Private Corrector**, and pick an action.
3. A panel streams the result. From there you can:
   - **Copy** the result.
   - **Replace selection**: puts the result in place of your selection (text boxes and editable areas only). Undo with Ctrl+Z.
   - **Show changes**: shows a word-by-word diff (on by default for corrections).
   - **Regenerate**, or switch to another action from the drop-down without selecting the text again.

Keyboard shortcuts (change them in `about:addons`, gear icon, **Manage Extension Shortcuts**):

- `Alt+Shift+C`: correct the selection
- `Alt+Shift+A`: ask Claude about the selection

The **toolbar button** opens a popup where you can paste text and use the same actions. It also works on pages where extensions cannot run, such as the built-in PDF viewer or `about:` pages.

## Install

### Try it now (temporary, removed when Firefox restarts)

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and choose `extension/manifest.json`.
3. Open the extension settings: on that page click **Inspect**, or go to `about:addons`, open **Private Corrector**, then **Preferences**.
4. Paste your Anthropic API key (create one at https://platform.claude.com/settings/keys), then click **Save** and **Test the key**.

### Install permanently

Firefox only installs signed extensions permanently. Sign it for free as an *unlisted* (private) add-on:

```bash
cd extension
```

```bash
npx web-ext sign --channel=unlisted --api-key=$AMO_JWT_ISSUER --api-secret=$AMO_JWT_SECRET
```

Get the AMO API credentials at https://addons.mozilla.org/developers/addon/api/key/. Then open the generated `.xpi` file in Firefox.
Firefox Developer Edition and Nightly can also install unsigned extensions if you set `xpinstall.signatures.required` to `false` in `about:config`.

## Settings

- **Model**: Claude Opus 5.5 is the default. Sonnet 5.5 and Haiku 5.5 are faster and cheaper. Fable 5.2 is the most capable and the most expensive.
- **Language of explanations**: the language for *Develop*, *Papers* and *Ask*. By default it follows the selected text.
- **Web search for papers**: makes Claude check that the papers it suggests exist, and lists the sources it used. Each search is billed, and an admin must turn web search on for your organization in the Claude Console. Without it, double-check every reference.
- **Personal instructions**: added to every request (for example "British English" or "my field is economics").

## Privacy and cost

- Your selection goes straight from Firefox to `api.anthropic.com`. Nothing passes through any other server.
- Your API key is stored in the extension's local storage, in this browser only.
- Requests are billed to your Anthropic API account. A typical correction costs a fraction of a cent.
- The selected text is treated as content to work on, so instructions hidden inside a web page should not take control of Claude. Still, review the result before you click **Replace**.

## Project layout

```
extension/
  manifest.json        Firefox Manifest V3
  background.js        context menu, shortcuts, streaming call to the Claude Messages API
  content.js           captures the selection, result panel (Shadow DOM), replace-in-place
  common/actions.js    the six actions and their prompts (edit here to tune behaviour)
  common/util.js       safe Markdown rendering, word diff, streaming client
  popup/               toolbar popup
  options/             settings page
```

To change how an action behaves, edit its `system` prompt in `extension/common/actions.js`, then click **Reload** in `about:debugging`.

## Technical notes

- The extension calls the API with `fetch`, using the documented header for direct browser access, so it needs no build step and no bundled SDK.
- Responses are streamed. For the models that support it, the extension also turns on server-side refusal fallback (`fallbacks: "default"`), so a request that Claude's safety filter wrongly blocks is retried automatically on a fallback model.
