import { openai } from "@ai-sdk/openai";
import { chatModelName, embeddingModelName, smallModelName } from "@/lib/env";

export function getChatModel() {
  return openai(chatModelName());
}

export function getSmallModel() {
  return openai(smallModelName());
}

export function getEmbeddingModel() {
  return openai.embedding(embeddingModelName());
}
