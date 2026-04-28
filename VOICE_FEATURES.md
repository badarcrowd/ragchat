# Voice Agent Features

This application now includes Intercom-style voice interaction capabilities powered by OpenAI Whisper (speech-to-text) and OpenAI TTS (text-to-speech).

## Features

### 🎤 Voice Input
- Click the microphone button to start recording your voice message
- Automatic speech-to-text transcription using OpenAI Whisper
- Visual feedback with pulsing red indicator during recording
- Supports all languages (default: English)

### 🔊 Voice Output
- Toggle voice responses on/off with the speaker button
- Automatic text-to-speech for bot responses
- Natural-sounding voice using OpenAI TTS (Alloy voice)
- Audio plays automatically when voice is enabled

### 🎨 UI Components
- **Voice Enable/Disable Button**: Toggle voice responses (speaker icon)
- **Microphone Button**: Start/stop voice recording (microphone icon)
  - Pulsing red when recording
  - Gray border when idle
- **Visual Feedback**: 
  - Recording state with pulsing animation
  - "Transcribing..." placeholder text
  - Disabled input during transcription

## API Endpoints

### POST /api/voice/transcribe
Converts audio to text using OpenAI Whisper.

**Request:**
- Content-Type: `multipart/form-data`
- Body: `audio` (Blob/File - webm format)

**Response:**
```json
{
  "text": "Transcribed text from audio"
}
```

### POST /api/voice/speak
Converts text to speech using OpenAI TTS.

**Request:**
```json
{
  "text": "Text to convert to speech"
}
```

**Response:**
- Content-Type: `audio/mpeg`
- Body: MP3 audio stream

## How It Works

1. **Voice Input Flow:**
   - User clicks microphone button
   - Browser requests microphone permission
   - Audio recording starts (WebM format)
   - User clicks again to stop recording
   - Audio sent to `/api/voice/transcribe`
   - Transcribed text appears in input field
   - User can edit or send immediately

2. **Voice Output Flow:**
   - Bot sends text response
   - If voice enabled, text sent to `/api/voice/speak`
   - MP3 audio received and played automatically
   - Hidden `<audio>` element handles playback

## Browser Compatibility

- **Voice Input**: Requires `MediaRecorder` API (Chrome, Firefox, Edge, Safari 14.1+)
- **Voice Output**: Standard HTML5 audio (all modern browsers)
- **HTTPS Required**: Microphone access requires secure context (HTTPS or localhost)

## Configuration

Voice features use OpenAI API with these defaults:
- **Transcription Model**: `whisper-1`
- **TTS Model**: `tts-1`
- **Voice**: `alloy`
- **Speed**: `1.0`
- **Language**: `en` (English)

To customize, edit:
- `/app/api/voice/transcribe/route.ts` - Speech-to-text settings
- `/app/api/voice/speak/route.ts` - Text-to-speech settings

## Environment Variables

Ensure `OPENAI_API_KEY` is set in your `.env.local`:

```env
OPENAI_API_KEY=sk-...
```

## Usage

1. **Enable Voice Responses:**
   - Click the speaker icon (blue = enabled, gray = disabled)
   - When enabled, bot responses will be spoken aloud

2. **Send Voice Message:**
   - Click microphone button to start recording
   - Speak your message
   - Click again (or wait) to stop
   - Review transcribed text
   - Click send or press Enter

3. **Combine Voice and Text:**
   - Voice transcription populates the input field
   - You can edit the transcribed text before sending
   - Works seamlessly with existing chat features

## Brand Customization

Voice UI elements inherit the brand color:
- Voice enable button background (when active)
- Microphone button border (when idle)
- Microphone button background (on hover)

All colors are dynamically applied from admin settings.

## Notes

- Voice features work alongside existing text chat
- No changes to RAG pipeline or backend logic
- Voice state is session-based (not persisted)
- Audio files are not stored (streaming only)
- Transcription supports all Whisper languages
- TTS currently uses English voice (can be customized)
