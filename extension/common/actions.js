/* The six actions and the instructions sent to Claude with the selected text. */
"use strict";

var PC_ACTIONS = [
  {
    id: "correct",
    task: "correct the spelling, grammar, punctuation and typography errors while changing as little as possible",
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
    task: "reformulate it so that it reads clearly and fluently, keeping its meaning, tone and roughly its length",
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
    task: "put it in a formal academic register (precise vocabulary, objective tone, hedged claims, no colloquialisms), without inventing data, results or citations",
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
    id: "shorten",
    title: "Shorten",
    task: "shorten it by {amount}, keeping the key ideas, facts and conclusions, and cutting repetitions, filler and secondary details",
    rewrite: true,
    instructions:
      "Shorten the text inside the <text> tags by {amount}. Keep its key ideas, facts, figures and " +
      "conclusions, its language, its tone and its formatting; cut repetitions, filler words, " +
      "redundant phrasing and secondary details, and merge sentences where it helps. Do not add " +
      "anything new. Fix any errors. Reply with the shortened text only, with no introduction or " +
      "explanation, so that I can copy it directly."
  },
  {
    id: "british",
    group: "variety", // British and American English exclude each other
    task: "use British English spelling, vocabulary and punctuation conventions (colour, organise, flat, single quotation marks)",
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
    group: "variety",
    task: "use American English spelling, vocabulary and punctuation conventions (color, organize, apartment, double quotation marks)",
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
    task: "Develop the ideas of the text into well-structured content, with explanations, arguments and examples, staying faithful to my intent; point out any claim that would need a source.",
    section: "Developed content",
    title: "Develop / provide content",
    rewrite: false,
    instructions:
      "Develop the text inside the <text> tags: expand its ideas into well-structured content, adding " +
      "explanations, arguments, examples and context where they help. Stay faithful to my intent and " +
      "subject, and point out any claim that would need a source."
  },
  {
    id: "papers",
    task: "Suggest relevant research papers: full reference (authors, year, title, venue), DOI or link when available, and one or two sentences on why each is relevant. Search the web to check that each paper exists if you can; never invent a reference.",
    section: "Research papers",
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
    task: "Explain the text in plain words: a short summary, the key ideas, the technical terms and any implicit context, with a simple example where it helps; point out errors or debatable claims briefly.",
    section: "Explanation",
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
    section: "Answer to my question",
    title: "Ask Claude…",
    rewrite: false,
    needsQuestion: true,
    instructions: "" // replaced by the user's question
  }
];

/*
 * Saved tasks (your own prompts), stored as
 * [{ id: "custom-…", title, prompt, rewrite }] in browser.storage.local "customTasks".
 * rewrite = true: Claude replies with the transformed text only (like Correct).
 */
function pcCustomToActions(customTasks) {
  return (customTasks || [])
    .filter((t) => t && t.id && t.title && t.prompt)
    .map((t) => ({
      id: t.id,
      title: t.title,
      custom: true,
      rewrite: Boolean(t.rewrite),
      task: t.prompt.trim(),
      section: t.title,
      instructions:
        "Apply the following to the text inside the <text> tags: " + t.prompt.trim() +
        (t.rewrite
          ? " Reply with the resulting text only, with no introduction or explanation, so that I can copy it directly."
          : "")
    }));
}

function pcAllActions(customTasks) {
  return PC_ACTIONS.concat(pcCustomToActions(customTasks));
}

function pcGetAction(id, customTasks) {
  const all = pcAllActions(customTasks);
  return all.find((a) => a.id === id) || null;
}

function pcLanguageLine(settings) {
  return settings.answerLanguage === "same"
    ? "Answer in the same language as the text."
    : `Answer in ${settings.answerLanguage}.`;
}

/*
 * Build the full prompt pasted into claude.ai.
 * `actions` is one action or a list of actions to combine in a single prompt.
 */
function pcBuildPrompt(actions, text, settings, question) {
  const list = (Array.isArray(actions) ? actions : [actions]).filter(Boolean);
  const parts = [];
  const custom = settings.customInstructions && settings.customInstructions.trim();
  const ask = (q) => q || "Explain this text.";

  if (list.length === 1) {
    const action = list[0];
    parts.push(action.needsQuestion ? ask(question) : action.instructions);
    if (!action.rewrite) parts.push(pcLanguageLine(settings));
  } else {
    const rewrites = list.filter((a) => a.rewrite);
    const others = list.filter((a) => !a.rewrite);
    const rewriteTask = rewrites.length
      ? "Rewrite the text applying all of the following at once:\n" +
        rewrites.map((a) => "   - " + a.task).join("\n") +
        "\n   Keep everything else (meaning, structure, formatting) unchanged."
      : "";

    if (!others.length) {
      // Only rewriting functions: one rewritten text, nothing else.
      parts.push(
        "Work on the text inside the <text> tags. " + rewriteTask +
          "\nReply with the rewritten text only, with no introduction or explanation, so that I can copy it directly."
      );
    } else {
      const sections = [];
      if (rewrites.length) {
        sections.push(
          "Rewritten text: " + rewriteTask +
            "\n   Give the rewritten text alone in this section, without comments, so that I can copy it."
        );
      }
      for (const a of others) {
        sections.push(a.section + ": " + (a.needsQuestion ? ask(question) : a.task));
      }
      parts.push(
        "Do the following with the text inside the <text> tags, in this order, each under its own short heading:\n" +
          sections.map((t, i) => `${i + 1}. ${t}`).join("\n") +
          "\n" +
          (rewrites.length
            ? "The rewritten text keeps the language of the original. For the other sections, " +
              pcLanguageLine(settings).replace(/^Answer/, "answer")
            : pcLanguageLine(settings))
      );
    }
  }
  if (custom) parts.push(custom);
  const amount = settings.shortenAmount || "about a third";
  const prompt = parts.join(list.length === 1 ? " " : "\n").replace(/\{amount\}/g, amount);
  return prompt + `\n\n<text>\n${text.trim()}\n</text>`;
}
