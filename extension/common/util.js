/* Shared helpers: safe Markdown rendering and word diff. */
"use strict";

var PCUtil = (function () {
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* Inline Markdown on already-escaped text. */
  function inline(s) {
    return s
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');
  }

  /* Minimal, safe Markdown renderer (everything is escaped first). */
  function renderMarkdown(md) {
    const lines = escapeHtml(md).split("\n");
    const out = [];
    let list = null; // "ul" | "ol"
    let inCode = false;
    let para = [];

    const flushPara = () => {
      if (para.length) out.push("<p>" + inline(para.join("<br>")) + "</p>");
      para = [];
    };
    const closeList = () => {
      if (list) out.push(`</${list}>`);
      list = null;
    };

    for (const line of lines) {
      if (/^```/.test(line)) {
        flushPara();
        closeList();
        out.push(inCode ? "</code></pre>" : "<pre><code>");
        inCode = !inCode;
        continue;
      }
      if (inCode) {
        out.push(line + "\n");
        continue;
      }
      let m;
      if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
        flushPara();
        closeList();
        const level = Math.min(m[1].length + 2, 6);
        out.push(`<h${level}>${inline(m[2])}</h${level}>`);
      } else if ((m = line.match(/^\s*[-*+]\s+(.*)$/))) {
        flushPara();
        if (list !== "ul") {
          closeList();
          out.push("<ul>");
          list = "ul";
        }
        out.push(`<li>${inline(m[1])}</li>`);
      } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
        flushPara();
        if (list !== "ol") {
          closeList();
          out.push("<ol>");
          list = "ol";
        }
        out.push(`<li>${inline(m[1])}</li>`);
      } else if (/^\s*(---|\*\*\*)\s*$/.test(line)) {
        flushPara();
        closeList();
        out.push("<hr>");
      } else if ((m = line.match(/^&gt;\s?(.*)$/))) {
        flushPara();
        closeList();
        out.push(`<blockquote>${inline(m[1])}</blockquote>`);
      } else if (!line.trim()) {
        flushPara();
        closeList();
      } else {
        closeList();
        para.push(line);
      }
    }
    flushPara();
    closeList();
    if (inCode) out.push("</code></pre>");
    return out.join("");
  }

  /* Word-level diff (LCS). Returns [{type: "same"|"add"|"del", text}] */
  function diffWords(a, b) {
    const A = a.split(/(\s+)/).filter((t) => t !== "");
    const B = b.split(/(\s+)/).filter((t) => t !== "");
    const n = A.length;
    const m = B.length;
    if (n * m > 4_000_000) return [{ type: "del", text: a }, { type: "add", text: b }];
    const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    const parts = [];
    const push = (type, text) => {
      const last = parts[parts.length - 1];
      if (last && last.type === type) last.text += text;
      else parts.push({ type, text });
    };
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (A[i] === B[j]) {
        push("same", A[i]);
        i++;
        j++;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        push("del", A[i++]);
      } else {
        push("add", B[j++]);
      }
    }
    while (i < n) push("del", A[i++]);
    while (j < m) push("add", B[j++]);
    return parts;
  }

  function renderDiff(a, b) {
    return diffWords(a, b)
      .map((p) => {
        const t = escapeHtml(p.text).replace(/\n/g, "<br>");
        if (p.type === "add") return `<ins>${t}</ins>`;
        if (p.type === "del") return `<del>${t}</del>`;
        return t;
      })
      .join("");
  }

  return { escapeHtml, renderMarkdown, diffWords, renderDiff };
})();
