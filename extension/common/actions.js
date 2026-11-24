/* The six actions and the instructions sent to Claude with the selected text. */
"use strict";

var PC_ACTIONS = [
  {
    id: "correct",
    title: "Correct (minimal changes)",
    rewrite: true,
    instructions:
      "Correct the spelling, grammar, conjugation, agreement, punctuation and typography errors " +
      "in the text inside the <text> tags. Keep my wording, sentence structure, tone and formatting " +
      "exactly as they are: change a word only when it is wrong. Do not rephrase, do not improve the " +
      "style, do not translate. If there are no errors, return the text unchanged. Reply with the " +
      "corrected text only, with no introduction or explanation, so that I can copy it directly."
  },
  {
    id: "reformulate",
    title: "Reformulate",
    rewrite: true,
    instructions:
      "Rewrite the text inside the <text> tags so that it reads clearly and fluently, keeping its " +
      "meaning, its language, its level of formality and roughly its length. Fix any errors along the " +
      "way and keep the paragraphs. Reply with the rewritten text only, with no introduction or " +
      "explanation, so that I can copy it directly."
  },
  {
    id: "academic",
    title: "Make it more academic",
    rewrite: true,
    instructions:
      "Rewrite the text inside the <text> tags in a formal academic register suitable for a research " +
      "paper or a thesis: precise vocabulary, objective tone, hedged claims where appropriate, no " +
      "contractions or colloquialisms, clear logical connectors. Keep the meaning, the language and " +
      "every factual claim; do not invent data, results or citations. Fix any errors. Reply with the " +
      "rewritten text only, with no introduction or explanation, so that I can copy it directly."
  },
  {
    id: "british",
    title: "Convert to British English",
    rewrite: true,
    instructions:
      "Convert the text inside the <text> tags to British English: British spelling (colour, " +
      "organise, centre, travelled, defence), British vocabulary and expressions (flat, autumn, " +
      "mobile phone) and British punctuation conventions (single quotation marks, punctuation " +
      "outside quotes unless it belongs to the quotation). Change nothing else: keep my wording, " +
      "sentence structure, tone and formatting, and fix only real errors. If the text is not in " +
      "English, translate it into British English. Reply with the converted text only, with no " +
      "introduction or explanation, so that I can copy it directly."
  },
  {
    id: "american",
    title: "Convert to American English",
    rewrite: true,
    instructions:
      "Convert the text inside the <text> tags to American English: American spelling (color, " +
      "organize, center, traveled, defense), American vocabulary and expressions (apartment, fall, " +
      "cell phone) and American punctuation conventions (double quotation marks, periods and commas " +
      "inside quotes). Change nothing else: keep my wording, sentence structure, tone and " +
      "formatting, and fix only real errors. If the text is not in English, translate it into " +
      "American English. Reply with the converted text only, with no introduction or explanation, " +
      "so that I can copy it directly."
  },
  {
    id: "develop",
    title: "Develop / provide content",
    rewrite: false,
    instructions:
      "Develop the text inside the <text> tags: expand its ideas into well-structured content, adding " +
      "explanations, arguments, examples and context where they help. Stay faithful to my intent and " +
      "subject, and point out any claim that would need a source."
  },
  {
    id: "papers",
    title: "Suggest research papers",
    rewrite: false,
    instructions:
      "Suggest research papers relevant to the topic of the text inside the <text> tags. For each " +
      "paper give the full reference (authors, year, title, journal or conference), a DOI or link when " +
      "available, and one or two sentences on why it is relevant and how it could support or challenge " +
      "the text. Group them by sub-topic when useful. Prefer seminal and recent peer-reviewed work. " +
      "Search the web to check that each paper exists if you can; never invent a reference, and say " +
      "so when you are unsure about a detail."
  },
  {
    id: "explain",
    title: "Explain",
    rewrite: false,
    instructions:
      "Explain the text inside the <text> tags so that I understand it fully. Start with a short " +
      "summary of what it says in plain words, then explain the key ideas, the technical terms and " +
      "any implicit context or reasoning, with a simple example where it helps. If the text contains " +
      "errors, ambiguities or debatable claims, point them out briefly."
  },
  {
    id: "ask",
    title: "Ask Claude…",
    rewrite: false,
    needsQuestion: true,
    instructions: "" // replaced by the user's question
  }
];

function pcGetAction(id) {
  return PC_ACTIONS.find((a) => a.id === id) || PC_ACTIONS[0];
}

/* Build the full prompt pasted into claude.ai. */
function pcBuildPrompt(action, text, settings, question) {
  const parts = [];
  parts.push(action.needsQuestion ? (question || "Explain this text.") : action.instructions);
  if (!action.rewrite) {
    parts.push(
      settings.answerLanguage === "same"
        ? "Answer in the same language as the text."
        : `Answer in ${settings.answerLanguage}.`
    );
  }
  if (settings.customInstructions && settings.customInstructions.trim()) {
    parts.push(settings.customInstructions.trim());
  }
  return parts.join(" ") + `\n\n<text>\n${text.trim()}\n</text>`;
}
