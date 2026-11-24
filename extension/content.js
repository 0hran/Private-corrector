/* Content script: captures the selection and shows the result panel. */
"use strict";

(function () {
  if (window.__privateCorrectorLoaded) return;
  window.__privateCorrectorLoaded = true;

  let host = null; // panel host element
  let ui = null; // references inside the shadow root
  let cancelRun = null;
  let state = null; // { actionId, text, target, result }

  /* ---------- Selection capture ---------- */

  function captureSelection(fallbackText) {
    const active = deepActiveElement();
    if (active && isTextField(active)) {
      const start = active.selectionStart;
      const end = active.selectionEnd;
      if (start != null && end != null && end > start) {
        return {
          text: active.value.slice(start, end),
          target: { kind: "field", element: active, start, end }
        };
      }
    }
    const sel = window.getSelection();
    if (sel && sel.rangeCount && !sel.isCollapsed) {
      const range = sel.getRangeAt(0).cloneRange();
      const container = range.commonAncestorContainer;
      const el = container.nodeType === 1 ? container : container.parentElement;
      const editable = el && el.isContentEditable;
      return {
        text: sel.toString(),
        target: { kind: editable ? "editable" : "page", range, element: el }
      };
    }
    if (fallbackText) return { text: fallbackText, target: { kind: "page" } };
    return null;
  }

  function deepActiveElement() {
    let a = document.activeElement;
    while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement;
    return a;
  }

  function isTextField(el) {
    if (el.tagName === "TEXTAREA") return !el.readOnly && !el.disabled;
    if (el.tagName === "INPUT") {
      const t = (el.type || "text").toLowerCase();
      return ["text", "search", "url", "email", "tel", ""].includes(t) && !el.readOnly && !el.disabled;
    }
    return false;
  }

  /* ---------- Replace selection ---------- */

  function replaceSelection(target, newText) {
    if (!target) return false;
    if (target.kind === "field") {
      const el = target.element;
      if (!el.isConnected) return false;
      el.focus();
      el.setSelectionRange(target.start, target.end);
      // execCommand keeps the undo history and notifies frameworks (React, Vue...).
      let ok = false;
      try {
        ok = document.execCommand("insertText", false, newText);
      } catch (_) {}
      if (!ok) {
        el.setRangeText(newText, target.start, target.end, "end");
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
      target.end = target.start + newText.length;
      return true;
    }
    if (target.kind === "editable" && target.range) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(target.range);
      if (target.element) target.element.focus?.();
      let ok = false;
      try {
        ok = document.execCommand("insertText", false, newText);
      } catch (_) {}
      if (!ok) {
        target.range.deleteContents();
        target.range.insertNode(document.createTextNode(newText));
      }
      return true;
    }
    return false;
  }

  /* ---------- Panel ---------- */

  const STYLE = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .panel {
      --bg: #ffffff; --fg: #1f1e1d; --muted: #6b6a68; --border: #e3e1dc; --accent: #c96442;
      --soft: #f6f4ef; --ins: #d7f5dd; --ins-fg: #0f5b1e; --del: #fbdcdc; --del-fg: #8a1c1c;
      position: fixed; top: 16px; right: 16px; z-index: 2147483647;
      width: min(460px, calc(100vw - 32px)); max-height: calc(100vh - 32px);
      display: flex; flex-direction: column;
      background: var(--bg); color: var(--fg); border: 1px solid var(--border); border-radius: 12px;
      box-shadow: 0 12px 40px rgba(0,0,0,.18); font: 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
      resize: both; overflow: hidden; min-width: 300px; min-height: 160px;
    }
    @media (prefers-color-scheme: dark) {
      .panel { --bg: #262624; --fg: #ecebe8; --muted: #a3a29e; --border: #3d3c39; --soft: #30302e;
        --ins: #1e3d24; --ins-fg: #9be3aa; --del: #4a2222; --del-fg: #f2a5a5; }
    }
    header { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--border); cursor: move; user-select: none; }
    header .logo { width: 10px; height: 10px; border-radius: 50%; background: var(--accent); flex: none; }
    select, input, button, textarea { font: inherit; color: inherit; }
    select { flex: 1; min-width: 0; background: var(--soft); border: 1px solid var(--border); border-radius: 6px; padding: 4px 6px; }
    .icon { background: none; border: none; cursor: pointer; color: var(--muted); font-size: 18px; line-height: 1; padding: 2px 6px; border-radius: 6px; }
    .icon:hover { background: var(--soft); color: var(--fg); }
    .body { padding: 12px; overflow: auto; flex: 1; }
    .original { font-size: 12px; color: var(--muted); background: var(--soft); border-radius: 8px; padding: 6px 8px; margin-bottom: 10px;
      max-height: 4.5em; overflow: hidden; white-space: pre-wrap; cursor: pointer; }
    .original.open { max-height: none; }
    .ask { display: flex; gap: 6px; margin-bottom: 10px; }
    .ask textarea { flex: 1; resize: vertical; min-height: 38px; background: var(--soft); border: 1px solid var(--border); border-radius: 8px; padding: 6px 8px; }
    .output { white-space: normal; word-wrap: break-word; }
    .output.plain { white-space: pre-wrap; }
    .output h3, .output h4, .output h5, .output h6 { margin: .8em 0 .3em; font-size: 1em; }
    .output p { margin: 0 0 .6em; }
    .output ul, .output ol { margin: 0 0 .6em; padding-left: 1.3em; }
    .output pre { background: var(--soft); padding: 8px; border-radius: 6px; overflow: auto; }
    .output code { font-family: ui-monospace, monospace; font-size: .92em; }
    .output a { color: var(--accent); }
    .output blockquote { margin: 0 0 .6em; padding-left: 10px; border-left: 3px solid var(--border); color: var(--muted); }
    ins { background: var(--ins); color: var(--ins-fg); text-decoration: none; border-radius: 3px; }
    del { background: var(--del); color: var(--del-fg); border-radius: 3px; }
    .status { color: var(--muted); font-size: 13px; display: flex; align-items: center; gap: 8px; }
    .spinner { width: 12px; height: 12px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .note { margin-top: 8px; font-size: 12px; color: var(--muted); }
    .error { color: var(--del-fg); background: var(--del); padding: 8px; border-radius: 8px; white-space: pre-wrap; }
    .sources { margin-top: 10px; font-size: 12px; }
    .sources a { color: var(--accent); }
    footer { display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 12px; border-top: 1px solid var(--border); }
    .btn { border: 1px solid var(--border); background: var(--soft); border-radius: 8px; padding: 5px 10px; cursor: pointer; }
    .btn:hover:not(:disabled) { border-color: var(--accent); }
    .btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
    .btn:disabled { opacity: .45; cursor: default; }
    .spacer { flex: 1; }
    [hidden] { display: none !important; }
  `;

  function buildPanel() {
    host = document.createElement("private-corrector-panel");
    const root = host.attachShadow({ mode: "closed" });
    const options = PC_ACTIONS.map((a) => `<option value="${a.id}">${PCUtil.escapeHtml(a.title)}</option>`).join("");
    root.innerHTML = `
      <style>${STYLE}</style>
      <div class="panel" role="dialog" aria-label="Private Corrector">
        <header>
          <span class="logo"></span>
          <select class="action" title="Action">${options}</select>
          <button class="icon close" title="Close (Esc)">×</button>
        </header>
        <div class="body">
          <div class="original" title="Click to expand"></div>
          <div class="ask" hidden>
            <textarea class="question" rows="2" placeholder="Your question or instruction… (Enter to send, Shift+Enter for a new line)"></textarea>
            <button class="btn primary send">Ask</button>
          </div>
          <div class="status" hidden><span class="spinner"></span><span>Claude is writing…</span></div>
          <div class="error" hidden></div>
          <div class="output"></div>
          <div class="note" hidden></div>
          <div class="sources" hidden></div>
        </div>
        <footer>
          <button class="btn copy" disabled>Copy</button>
          <button class="btn primary replace" disabled hidden>Replace selection</button>
          <button class="btn diff" hidden>Show changes</button>
          <span class="spacer"></span>
          <button class="btn settings" hidden>Settings</button>
          <button class="btn stop" hidden>Stop</button>
          <button class="btn regen" disabled>Regenerate</button>
        </footer>
      </div>`;
    const $ = (s) => root.querySelector(s);
    ui = {
      root,
      panel: $(".panel"),
      header: $("header"),
      action: $(".action"),
      close: $(".close"),
      original: $(".original"),
      ask: $(".ask"),
      question: $(".question"),
      send: $(".send"),
      status: $(".status"),
      error: $(".error"),
      output: $(".output"),
      note: $(".note"),
      sources: $(".sources"),
      copy: $(".copy"),
      replace: $(".replace"),
      diff: $(".diff"),
      settings: $(".settings"),
      stop: $(".stop"),
      regen: $(".regen")
    };

    ui.close.addEventListener("click", closePanel);
    ui.original.addEventListener("click", () => ui.original.classList.toggle("open"));
    ui.action.addEventListener("change", () => {
      state.actionId = ui.action.value;
      start();
    });
    ui.send.addEventListener("click", () => start());
    ui.question.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        start();
      }
      e.stopPropagation();
    });
    ui.copy.addEventListener("click", async () => {
      await navigator.clipboard.writeText(state.result || "");
      flash(ui.copy, "Copied ✓");
    });
    ui.replace.addEventListener("click", () => {
      // Keep the whitespace that surrounded the original selection.
      const lead = state.text.match(/^\s*/)[0];
      const trail = state.text.match(/\s*$/)[0];
      const replacement = lead + state.result + trail;
      if (replaceSelection(state.target, replacement)) {
        flash(ui.replace, "Replaced ✓");
        state.text = replacement;
      } else {
        flash(ui.replace, "Could not replace");
      }
    });
    ui.diff.addEventListener("click", () => {
      state.showDiff = !state.showDiff;
      renderResult();
    });
    ui.settings.addEventListener("click", () => browser.runtime.sendMessage({ type: "pc-open-options" }));
    ui.stop.addEventListener("click", () => {
      if (cancelRun) cancelRun();
      cancelRun = null;
      setBusy(false);
    });
    ui.regen.addEventListener("click", () => start());
    root.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closePanel();
    });
    makeDraggable();
    document.documentElement.appendChild(host);
  }

  function makeDraggable() {
    let dx = 0;
    let dy = 0;
    let dragging = false;
    ui.header.addEventListener("mousedown", (e) => {
      if (e.target.closest("select, button")) return;
      dragging = true;
      const r = ui.panel.getBoundingClientRect();
      dx = e.clientX - r.left;
      dy = e.clientY - r.top;
      e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      ui.panel.style.left = Math.max(0, e.clientX - dx) + "px";
      ui.panel.style.top = Math.max(0, e.clientY - dy) + "px";
      ui.panel.style.right = "auto";
    });
    window.addEventListener("mouseup", () => (dragging = false));
  }

  function flash(btn, label) {
    const old = btn.textContent;
    btn.textContent = label;
    setTimeout(() => (btn.textContent = old), 1400);
  }

  function closePanel() {
    if (cancelRun) cancelRun();
    cancelRun = null;
    if (host) host.remove();
    host = null;
    ui = null;
  }

  function setBusy(busy) {
    ui.status.hidden = !busy;
    ui.stop.hidden = !busy;
    ui.regen.disabled = busy;
    ui.send.disabled = busy;
  }

  function renderResult() {
    const action = pcGetAction(state.actionId);
    const text = state.result || "";
    const isText = action.output === "text";
    ui.output.classList.toggle("plain", isText && !state.showDiff);
    if (isText && state.showDiff && state.done) {
      ui.output.innerHTML = PCUtil.renderDiff(state.text, text);
    } else if (isText) {
      ui.output.textContent = text;
    } else {
      ui.output.innerHTML = PCUtil.renderMarkdown(text);
    }
    ui.diff.textContent = state.showDiff ? "Hide changes" : "Show changes";
  }

  function openPanel(actionId, captured) {
    if (!host) buildPanel();
    state = {
      actionId,
      text: captured.text,
      target: captured.target,
      result: "",
      showDiff: actionId === "correct",
      done: false
    };
    ui.action.value = actionId;
    ui.original.textContent = captured.text;
    ui.question.value = "";
    prepare();
    if (pcGetAction(actionId).needsQuestion) {
      ui.question.focus();
    } else {
      start();
    }
  }

  /* Reset the panel for the current action without running it. */
  function prepare() {
    const action = pcGetAction(state.actionId);
    const isText = action.output === "text";
    const canReplace = isText && state.target && (state.target.kind === "field" || state.target.kind === "editable");
    ui.ask.hidden = !action.needsQuestion;
    ui.replace.hidden = !canReplace;
    ui.diff.hidden = !isText;
    ui.output.textContent = "";
    ui.error.hidden = true;
    ui.note.hidden = true;
    ui.sources.hidden = true;
    ui.settings.hidden = true;
    ui.copy.disabled = true;
    ui.replace.disabled = true;
    ui.regen.disabled = action.needsQuestion && !ui.question.value.trim();
  }

  function start() {
    const action = pcGetAction(state.actionId);
    prepare();
    if (action.needsQuestion && !ui.question.value.trim()) {
      ui.question.focus();
      return;
    }
    if (cancelRun) cancelRun();
    state.result = "";
    state.done = false;
    setBusy(true);
    cancelRun = PCUtil.runAction(
      { actionId: action.id, text: state.text, question: ui.question.value.trim() },
      {
        onDelta(full) {
          if (!ui) return;
          state.result = full;
          renderResult();
        },
        onDone(info) {
          if (!ui) return;
          cancelRun = null;
          state.result = action.output === "text" ? info.text.trim() : info.text;
          state.done = true;
          setBusy(false);
          renderResult();
          ui.copy.disabled = !state.result;
          ui.replace.disabled = !state.result || info.stopReason === "refusal";
          const note = PCUtil.stopReasonNote(info.stopReason);
          if (action.output === "text" && state.result === state.text.trim()) {
            ui.note.textContent = "No changes needed.";
            ui.note.hidden = false;
          } else if (note) {
            ui.note.textContent = note;
            ui.note.hidden = false;
          }
          if (info.sources && info.sources.length) {
            ui.sources.innerHTML =
              "<strong>Sources</strong><br>" +
              info.sources
                .map((s) => `<a href="${PCUtil.escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">${PCUtil.escapeHtml(s.title)}</a>`)
                .join("<br>");
            ui.sources.hidden = false;
          }
        },
        onError(message, code) {
          if (!ui) return;
          cancelRun = null;
          setBusy(false);
          ui.error.textContent = message;
          ui.error.hidden = false;
          ui.settings.hidden = code !== "no-key";
        }
      }
    );
  }

  /* ---------- Messages from the background ---------- */

  browser.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.type !== "pc-run") return;
    const captured = captureSelection(msg.fromShortcut ? "" : msg.fallbackText);
    if (!captured || !captured.text.trim()) return;
    openPanel(msg.actionId, captured);
  });
})();
