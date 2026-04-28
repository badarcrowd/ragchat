import { generateObject } from "ai";
import { z } from "zod";
import { getSmallModel } from "@/lib/ai/openai";

const languageSchema = z.object({
  language: z
    .string()
    .describe("ISO 639-1 language code, or 'en' when uncertain."),
  languageName: z.string().describe("English display name of the language."),
  englishText: z.string().describe("The user text translated to English."),
  needsTranslation: z.boolean()
});

export type LanguageResult = z.infer<typeof languageSchema>;

export async function detectAndTranslateToEnglish(
  text: string
): Promise<LanguageResult> {
  if (!text.trim()) {
    return {
      language: "en",
      languageName: "English",
      englishText: "",
      needsTranslation: false
    };
  }

  const { object } = await generateObject({
    model: getSmallModel(),
    schema: languageSchema,
    prompt: [
      "Detect the language of the user text.",
      "Translate it to English if it is not already English.",
      "Keep product names, URLs, email addresses, and code unchanged.",
      "Return only the structured object.",
      "",
      `User text:\n${text}`
    ].join("\n")
  });

  return {
    language: object.language || "en",
    languageName: object.languageName || "English",
    englishText: object.englishText || text,
    needsTranslation: object.needsTranslation
  };
}
