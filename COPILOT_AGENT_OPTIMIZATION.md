# Copilot Agent Optimization

This implementation optimizes the WordPress visitor copilot for fast voice and text lead conversations while preserving the existing iframe and Contact Form 7 bridge.

## Runtime Architecture

- Text and form-filling agent: `/api/agent/chat` for the rich embedded React agent, and `/api/agent/bot-chat` for the lightweight WordPress bot script.
- Voice input: `/api/voice/transcribe`, now defaulting to `gpt-4o-mini-transcribe` with a domain prompt for Crowd, WordPress, SEO, PPC, CRO, RFP, budget, and regional office terms.
- Voice output: `/api/voice/speak`, now defaulting to `gpt-4o-mini-tts`, configurable voice, short text cleanup, and safe in-memory caching for repeated non-PII utterances.
- Future low-latency voice path: `/api/voice/realtime-session` creates short-lived Realtime client secrets for WebRTC sessions using `gpt-realtime-mini`.

## Models

Default model settings are centralized in [lib/env.ts](/Users/badarrashdi/development/copilot-lead/lib/env.ts):

- `OPENAI_MODEL=gpt-5.5`
- `OPENAI_SMALL_MODEL=gpt-5.4-mini`
- `OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe`
- `OPENAI_TTS_MODEL=gpt-4o-mini-tts`
- `OPENAI_TTS_VOICE=marin`
- `OPENAI_REALTIME_MODEL=gpt-realtime-mini`

The agent and voice flows use low reasoning effort and low verbosity where available, plus prompt cache keys for repeated stable prompts.

## Lead And Form Logic

- The agent validates email, phone, and website fields before filling the parent WordPress form.
- Lead scoring now considers challenge, success criteria, start timing, and RFP signals.
- Business insight generation combines sector, challenge, budget, and audit score to recommend budget fit, next actions, and booking priority.
- The WordPress bridge receives CF7-mapped fields such as `first_name`, `email`, `phone`, `business`, `success`, `cost`, `start`, and `rfp`.

## Performance Notes

- Browser recording now uses echo cancellation, noise suppression, auto gain control, mono audio, Opus-first MIME selection, and lower bitrate uploads.
- Voice responses are capped and cleaned before TTS so playback starts sooner and does not read markdown or UI artifacts.
- The current HTTP TTS/STT path remains compatible with the existing widgets. For the lowest latency, wire the frontend to `/api/voice/realtime-session` and use browser WebRTC with server VAD interruption.

## Reference Docs

- OpenAI latest model guidance: https://developers.openai.com/api/docs/guides/latest-model.md
- OpenAI audio guide: https://developers.openai.com/api/docs/guides/audio
- OpenAI Realtime guide: https://developers.openai.com/api/docs/guides/realtime
