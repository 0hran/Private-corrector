/* The Private Corrector window: runs the job with the Gemini API and shows the answer. */
"use strict";

const $ = (id) => document.getElementById(id);
let job = null; // { id, actionIds, text, question, source: { tabId, frameId } | null }
let actions = [];
let result = "";
let done = false;
let showDiff = true;
let controller = null;

const rewriteOnly = () => actions.length > 0 && actions.every((a) => a.rewrite);

async function settings() {
  return browser.storage.local.get({
    geminiApiKey: "",
    geminiModel: "auto",
    answerLanguage: "same",
    shortenAmount: "about a third",
    customInstructions: "",
    customTasks: []
  });
}

/* ---------- Rendering ---------- */

function render() {
  const plain = rewriteOnly();
  $("output").classList.toggle("plain", plain && !(showDiff && done));
  if (plain && showDiff && done) $("output").innerHTML = PCUtil.renderDiff(job.text.trim(), result);
  else if (plain) $("output").textContent = result;
  else $("output").innerHTML = PCUtil.renderMarkdown(result);
  $("diff").textContent = showDiff ? "Hide changes" : "Show changes";
}

function setBusy(busy) {
  $("status").hidden = !busy;
  $("stop").hidden = !busy;
  $("regen").disabled = busy;
}

function showError(msg) {
  $("error").textContent = msg;
  $("error").hidden = false;
}

function reset() {
  result = "";
  done = false;
  $("output").textContent = "";
  $("error").hidden = true;
  $("note").hidden = true;
  $("sources").hidden = true;
  $("copy").disabled = true;
  $("replace").disabled = true;
  $("diff").hidden = true;
}

/* ---------- Running the job ---------- */

async function run() {
  if (!job) return;
  if (controller) controller.abort();
  reset();
  const s = await settings();
  if (!s.geminiApiKey) {
    $("setup").hidden = false;
    $("keyInput").focus();
    return;
  }
  $("setup").hidden = true;
  controller = new AbortController();
  setBusy(true);
  try {
    $("statusText").textContent = "Gemini is writing…";
    const prompt = pcBuildPrompt(actions, job.text, s, job.question);
    const out = await PCGemini.generateWithFallback({
      apiKey: s.geminiApiKey,
      chosen: s.geminiModel,
      onStatus: (msg) => {
        $("statusText").textContent = msg;
        result = "";
        render();
      },
      prompt,
      search: actions.some((a) => a.id === "papers"),
      signal: controller.signal,
      onText: (t) => {
        result = rewriteOnly() ? t.replace(/^\s+/, "") : t;
        render();
      }
    });
    done = true;
    $("sub").textContent = "Gemini · " + out.model;
    result = rewriteOnly() ? out.text.trim() : out.text;
    render();
    finish(out);
  } catch (err) {
    if (err.name === "AbortError") return;
    showError((err.message || String(err)) + (err.code === "server" || err.code === "quota" ? "\n\nAll the available Gemini models were tried. Click Regenerate in a moment." : ""));
    if (err.code === "key") $("setup").hidden = false;
  } finally {
    setBusy(false);
    controller = null;
  }
}

function finish(out) {
  $("copy").disabled = !result;
  $("replace").disabled = !result;
  $("diff").hidden = !rewriteOnly() || !result;
  const notes = [];
  if (out.blocked) notes.push(`Gemini blocked this request (${out.blocked}).`);
  if (out.finishReason === "MAX_TOKENS") notes.push("The answer was cut off because it reached the maximum length.");
  if (out.finishReason === "SAFETY" || out.finishReason === "RECITATION") notes.push(`Gemini stopped the answer (${out.finishReason}).`);
  if (rewriteOnly() && result && result === job.text.trim()) notes.push("No changes needed.");
  if (!result && !notes.length) notes.push("Gemini returned an empty answer. Try Regenerate.");
  if (notes.length) {
    $("note").textContent = notes.join(" ");
    $("note").hidden = false;
  }
  if (out.sources.length) {
    $("sources").innerHTML =
      "<strong>Sources</strong><br>" +
      out.sources
        .map((x) => `<a href="${PCUtil.escapeHtml(x.url)}" target="_blank" rel="noopener noreferrer">${PCUtil.escapeHtml(x.title)}</a>`)
        .join("<br>");
    $("sources").hidden = false;
  }
}

/* ---------- Buttons ---------- */

$("copy").addEventListener("click", async () => {
  await navigator.clipboard.writeText(result);
  await browser.storage.session.set({ lastCopiedPrompt: result }); // the popup won't paste it back
  flash($("copy"), "Copied ✓");
});

$("diff").addEventListener("click", () => {
  showDiff = !showDiff;
  render();
});

$("regen").addEventListener("click", run);
$("stop").addEventListener("click", () => controller && controller.abort());
$("settings").addEventListener("click", () => browser.runtime.openOptionsPage());

$("keySave").addEventListener("click", saveKey);
$("keyInput").addEventListener("keydown", (e) => e.key === "Enter" && saveKey());
async function saveKey() {
  const key = $("keyInput").value.trim();
  if (!key) return $("keyInput").focus();
  await browser.storage.local.set({ geminiApiKey: key });
  $("keyInput").value = "";
  run();
}

/* Put the result in place of the original selection, in the page it came from. */
$("replace").addEventListener("click", async () => {
  const src = job.source;
  const lead = job.text.match(/^\s*/)[0];
  const trail = job.text.match(/\s*$/)[0];
  const replacement = lead + result + trail;
  try {
    const tab = await browser.tabs.get(src.tabId);
    await browser.windows.update(tab.windowId, { focused: true });
    await browser.tabs.update(tab.id, { active: true });
    const [res] = await browser.scripting.executeScript({
      target: { tabId: src.tabId, frameIds: [src.frameId || 0] },
      args: [job.text, replacement],
      func: (original, replacement) => {
        const same = (a) => a.trim() === original.trim();
        let el = document.activeElement;
        while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
        if (el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT")) {
          const s = el.selectionStart;
          const e = el.selectionEnd;
          if (e > s && same(el.value.slice(s, e))) {
            el.focus();
            el.setSelectionRange(s, e);
            if (!document.execCommand("insertText", false, replacement)) {
              el.setRangeText(replacement, s, e, "end");
              el.dispatchEvent(new Event("input", { bubbles: true }));
            }
            return "ok";
          }
        }
        const sel = window.getSelection();
        if (sel && sel.rangeCount && same(sel.toString())) {
          const node = sel.anchorNode;
          const host = node && (node.nodeType === 1 ? node : node.parentElement);
          const editor = host && host.closest('[contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]');
          if (!editor) return "readonly";
          editor.focus();
          if (!document.execCommand("insertText", false, replacement)) {
            const r = sel.getRangeAt(0);
            r.deleteContents();
            r.insertNode(document.createTextNode(replacement));
          }
          return "ok";
        }
        return "lost";
      }
    });
    const state = res && res.result;
    if (state === "ok") {
      flash($("replace"), "Replaced ✓");
      job.text = replacement; // a second click won't replace again
    } else {
      await navigator.clipboard.writeText(result);
      showError(
        state === "readonly"
          ? "This text can't be edited on the page, so the result was copied instead (Ctrl+V to paste it)."
          : "The original selection is no longer selected on the page, so the result was copied instead: select the text again and press Ctrl+V."
      );
    }
  } catch (_) {
    await navigator.clipboard.writeText(result);
    showError("The page can't be changed (closed or protected), so the result was copied instead.");
  }
});

function flash(btn, label) {
  const old = btn.textContent;
  btn.textContent = label;
  setTimeout(() => (btn.textContent = old), 1500);
}

/* ---------- Start ---------- */

async function load() {
  const { pcJob } = await browser.storage.session.get("pcJob");
  if (!pcJob) {
    $("empty").hidden = false;
    $("originalBox").hidden = true;
    $("footer").hidden = true;
    return;
  }
  job = pcJob;
  const s = await settings();
  actions = (job.actionIds || []).map((id) => pcGetAction(id, s.customTasks)).filter(Boolean);
  $("title").textContent = actions.map((a) => a.title).join(" + ") || "Private Corrector";
  document.title = "Private Corrector – " + $("title").textContent;
  $("original").textContent = job.text;
  $("replace").hidden = !job.source;
  showDiff = actions.length === 1 && actions[0].id === "correct" ? true : rewriteOnly();
  run();
}

// A new job sent while this window is open.
browser.storage.onChanged.addListener((changes, area) => {
  if (area === "session" && changes.pcJob && changes.pcJob.newValue) load();
});

load();
