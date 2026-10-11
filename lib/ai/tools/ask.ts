import type { AiQuestion } from "../protocol";
import { ToolInputError, type AiTool } from "./types";

// INTERVYU — Claude'dagi kabi (11.10.2026). Foydalanuvchi: «agar AI da biron
// bir savol bo'lsa intervyu qilib so'rasin userdan … user tanlab javob
// bersin … qaysi filial?, qaysi davr oralig'i … so'rab aniq qilib olishi
// kerak».
//
// Model so'rov noaniq bo'lganda (qaysi filial yoki hammasi, qaysi davr, qaysi
// oy, qaysi xodimlar …) shu vositani chaqiradi; panel savollarni bosiladigan
// variantlar bilan karta qilib chizadi (`{type: "questions"}` hodisasi). Javob
// shu yerda TUGAYDI (lib/ai/chat.ts) — model xodimning tanlovini kutadi, u
// keyingi xabar bo'lib keladi. Ma'lumotga tegmaydi (ruxsat kerak emas).

const MAX_QUESTIONS = 3;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 5;
const MAX_HEADER = 24;
const MAX_QUESTION = 200;
const MAX_LABEL = 60;
const MAX_DESC = 120;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** Model yuborgan savollarni tekshiradi va tozalaydi (lib/ai/chat.ts va sinov skripti). */
export function parseQuestions(raw: unknown): AiQuestion[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new ToolInputError('"questions" must be a non-empty array');
  if (raw.length > MAX_QUESTIONS) throw new ToolInputError(`at most ${MAX_QUESTIONS} questions`);
  return raw.map((q, i) => {
    const o = (q && typeof q === "object" ? q : {}) as Record<string, unknown>;
    const question = str(o.question, MAX_QUESTION);
    if (!question) throw new ToolInputError(`question ${i + 1} has no text`);
    const seen = new Set<string>();
    const options = (Array.isArray(o.options) ? o.options : [])
      .map((x) => {
        const p = (x && typeof x === "object" ? x : { label: x }) as Record<string, unknown>;
        const label = str(p.label, MAX_LABEL);
        const description = str(p.description, MAX_DESC);
        return { label, ...(description ? { description } : {}) };
      })
      .filter((x) => {
        const key = x.label.toLowerCase();
        if (!x.label || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    if (options.length < MIN_OPTIONS) throw new ToolInputError(`question ${i + 1} needs at least ${MIN_OPTIONS} different options`);
    if (options.length > MAX_OPTIONS) throw new ToolInputError(`question ${i + 1} has more than ${MAX_OPTIONS} options`);
    const header = str(o.header, MAX_HEADER);
    return { ...(header ? { header } : {}), question, options, ...(o.multiSelect === true ? { multiSelect: true } : {}) };
  });
}

export const askUser: AiTool = {
  name: "ask_user",
  description:
    "Interview the user with 1–3 short multiple-choice questions shown as a card in the panel — use it when the request lacks " +
    "something that changes the answer: which branch (or all branches), which period or dates, which month, which employees, " +
    "group or course, which kind of report. Each question: a very short header (e.g. 'Filial', 'Davr'), the question in the " +
    "user's language and 2–5 short options, the most likely first with ' (Tavsiya)' at the end of its label. The user can also " +
    "type their own answer. Do not ask about anything the user already said. After calling this tool STOP: do not answer in " +
    "this turn — the user's choice arrives as the next message.",
  parameters: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        minItems: 1,
        maxItems: MAX_QUESTIONS,
        items: {
          type: "object",
          properties: {
            header: { type: "string", description: `Very short label, at most ${MAX_HEADER} characters (e.g. "Filial", "Davr").` },
            question: { type: "string", description: "The full question, in the user's language." },
            options: {
              type: "array",
              minItems: MIN_OPTIONS,
              maxItems: MAX_OPTIONS,
              items: {
                type: "object",
                properties: {
                  label: { type: "string", description: "1–5 words." },
                  description: { type: "string", description: "Optional short explanation of the option." },
                },
                required: ["label"],
                additionalProperties: false,
              },
            },
            multiSelect: { type: "boolean", description: "true — several options may be chosen." },
          },
          required: ["question", "options"],
          additionalProperties: false,
        },
      },
    },
    required: ["questions"],
    additionalProperties: false,
  },
  pages: [],
  async run(_ctx, args) {
    const questions = parseQuestions(args.questions);
    return {
      shown: true,
      note: "The questions are shown to the user as a card. Stop now and wait — the answer comes as the next message.",
      _ui: { questions },
    };
  },
};

