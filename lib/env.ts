export function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function defaultTenantId() {
  return process.env.DEFAULT_TENANT_ID ?? "default";
}

export function chatModelName() {
  return process.env.OPENAI_MODEL ?? "gpt-5.5";
}

export function smallModelName() {
  return process.env.OPENAI_SMALL_MODEL ?? "gpt-5.4-mini";
}

export function embeddingModelName() {
  return process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
}

export function openaiApiKey() {
  return requireEnv("OPENAI_API_KEY");
}
