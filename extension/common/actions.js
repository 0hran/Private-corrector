/* Shared action definitions (loaded in background, content script and popup). */
"use strict";

var PC_ACTIONS = [
  {
    id: "correct",
    title: "Correct (minimal changes)",
    output: "text", // plain text that can replace the selection
    effort: "low",
    system:
      "You are a meticulous proofreader. Correct the spelling, grammar, conjugation, agreement, " +
      "punctuation and typography errors in the text inside the <text> tags. Keep the author's " +
      "wording, sentence structure, tone and formatting (line breaks, lists, Markdown) exactly as " +
      "they are: change a word only when it is wrong. Do not rephrase, do not improve the style, " +
      "do not translate. If the text has no errors, return it unchanged. Reply with the corrected " +
      "text only: no preamble, no explanation, no quotes or tags around it."
  },
  {
    id: "reformulate",
    title: "Reformulate",
    output: "text",
    effort: "low",
    system:
      "Rewrite the text inside the <text> tags so that it reads clearly and fluently, keeping its " +
      "meaning, its language, its level of formality and roughly its length. Fix any errors along " +
      "the way. Keep the formatting (paragraphs, lists). Reply with the rewritten text only: no " +
      "preamble, no explanation, no quotes or tags around it."
  },
  {
    id: "academic",
    title: "Make it more academic",
    output: "text",
    effort: "medium",
    system:
      "Rewrite the text inside the <text> tags in a formal academic register suitable for a " +
      "research paper or a thesis: precise vocabulary, objective tone, hedged claims where " +
      "appropriate, no contractions or colloquialisms, clear logical connectors between ideas. " +
      "Keep the meaning, the language and every factual claim; do not invent data, results or " +
      "citations. Fix any errors. Reply with the rewritten text only: no preamble, no " +
      "explanation, no quotes or tags around it."
  },
  {
    id: "develop",
    title: "Develop / provide content",
    output: "markdown",
    effort: "medium",
    system:
      "Develop the text inside the <text> tags: expand its ideas into well-structured content, " +
      "adding explanations, arguments, examples and context where they help. Stay faithful to " +
      "the author's intent and subject. Point out any claim that would need a source. Use " +
      "Markdown headings and lists only where they help readability."
  },
  {
    id: "papers",
    title: "Suggest research papers",
    output: "markdown",
    effort: "medium",
    webSearch: true,
    system:
      "Suggest research papers relevant to the topic of the text inside the <text> tags. For " +
      "each paper give the full reference (authors, year, title, journal or conference), a DOI " +
      "or link when available, and one or two sentences on why it is relevant and how it could " +
      "support or challenge the text. Group papers by sub-topic when useful. Prefer seminal and " +
      "recent peer-reviewed work. Only list papers you are confident exist (verify them with web " +
      "search when it is available) and never invent a reference; if you are unsure about a " +
      "detail, say so. Use Markdown."
  },
  {
    id: "ask",
    title: "Ask Claude…",
    output: "markdown",
    effort: "medium",
    needsQuestion: true,
    system:
      "The user selected the text inside the <text> tags and asks a question or gives an " +
      "instruction about it. Answer directly and helpfully. Use Markdown when it helps."
  }
];

function pcGetAction(id) {
  return PC_ACTIONS.find((a) => a.id === id) || PC_ACTIONS[0];
}
