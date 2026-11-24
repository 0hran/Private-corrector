"use strict";

const $ = (id) => document.getElementById(id);
let current = null; // { actionId, text, result, done, showDiff }
let cancelRun = null;

const DRAFT_KEY = "pc-popup-draft";
$("input").value = localStorageGet(DRAFT_KEY);
$("input").addEventListener("input", () => localStorageSet(DRAFT_KEY, $("input").value));

for (const action of PC_ACTIONS) {
  const b = document.createElement("button");
  b.className = "btn";
  b.textContent = action.title;
  b.dataset.id = action.id;
  b.addEventListener("click", () => choose(action.id));
  $("actions").appendChild(b);
}

$("settings").addEventListener("click", () => {
  browser.runtime.openOptionsPage();
  window.close();
});
$("send").addEventListener("click", () => run());
$("question").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    run();
  }
});
$("copy").addEventListener("click", async () => {
  await navigator.clipboard.writeText(current.result);
  $("copy").textContent = "Copied ✓";
  setTimeout(() => ($("copy").textContent = "Copy"), 1400);
});
$("use").addEventListener("click", () => {
  $("input").value = current.result;
  localStorageSet(DRAFT_KEY, current.result);
});
$("diff").addEventListener("click", () => {
  current.showDiff = !current.showDiff;
  render();
});

function choose(actionId) {
  document.querySelectorAll("#actions .btn").forEach((b) => b.classList.toggle("active", b.dataset.id === actionId));
  const action = pcGetAction(actionId);
  current = { actionId, text: "", result: "", done: false, showDiff: actionId === "correct" };
  $("ask").hidden = !action.needsQuestion;
  if (action.needsQuestion) {
    resetOutput();
    $("question").focus();
  } else {
    run();
  }
}

function resetOutput() {
  $("output").textContent = "";
  $("error").hidden = true;
  $("note").hidden = true;
  $("sources").hidden = true;
  $("footer").hidden = true;
}

function render() {
  const action = pcGetAction(current.actionId);
  const isText = action.output === "text";
  const out = $("output");
  out.classList.toggle("plain", isText && !current.showDiff);
  if (isText && current.showDiff && current.done) out.innerHTML = PCUtil.renderDiff(current.text, current.result);
  else if (isText) out.textContent = current.result;
  else out.innerHTML = PCUtil.renderMarkdown(current.result);
  $("diff").hidden = !isText || !current.done;
  $("diff").textContent = current.showDiff ? "Hide changes" : "Show changes";
}

function run() {
  if (!current) return;
  const action = pcGetAction(current.actionId);
  const text = $("input").value.trim();
  resetOutput();
  if (!text) {
    $("error").textContent = "Type or paste some text first.";
    $("error").hidden = false;
    return;
  }
  const question = $("question").value.trim();
  if (action.needsQuestion && !question) {
    $("question").focus();
    return;
  }
  if (cancelRun) cancelRun();
  current.text = text;
  current.result = "";
  current.done = false;
  $("status").hidden = false;
  cancelRun = PCUtil.runAction(
    { actionId: action.id, text, question },
    {
      onDelta(full) {
        current.result = full;
        render();
      },
      onDone(info) {
        cancelRun = null;
        $("status").hidden = true;
        current.result = action.output === "text" ? info.text.trim() : info.text;
        current.done = true;
        render();
        $("footer").hidden = !current.result;
        const note = PCUtil.stopReasonNote(info.stopReason);
        if (action.output === "text" && current.result === current.text) {
          $("note").textContent = "No changes needed.";
          $("note").hidden = false;
        } else if (note) {
          $("note").textContent = note;
          $("note").hidden = false;
        }
        if (info.sources && info.sources.length) {
          $("sources").innerHTML =
            "<strong>Sources</strong><br>" +
            info.sources
              .map((s) => `<a href="${PCUtil.escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">${PCUtil.escapeHtml(s.title)}</a>`)
              .join("<br>");
          $("sources").hidden = false;
        }
      },
      onError(message) {
        cancelRun = null;
        $("status").hidden = true;
        $("error").textContent = message;
        $("error").hidden = false;
      }
    }
  );
}

function localStorageGet(k) {
  try {
    return localStorage.getItem(k) || "";
  } catch (_) {
    return "";
  }
}
function localStorageSet(k, v) {
  try {
    localStorage.setItem(k, v);
  } catch (_) {}
}
