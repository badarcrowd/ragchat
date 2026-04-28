# Voice Agent Features

This application includes two voice interaction modes: **Text Chat** with optional voice features and a dedicated **Voice Chat** mode for hands-free conversations.

## 🎯 Two Chat Modes

### 📝 Text Chat Mode
Traditional text-based chat with optional voice enhancements:
- Type messages manually
- **Optional**: Click microphone to record voice messages (transcribed to text)
- **Optional**: Toggle speaker icon to enable voice responses
- Full control over when to use voice features

### 🎙️ Voice Chat Mode (NEW)
Dedicated hands-free voice conversation interface with **automatic continuous conversation**:
- **Auto-Start**: Listening begins automatically when you switch to Voice Chat
- **Automatic Flow**: Speak → Stop (click button) → Transcribe → AI Responds → Auto-Resume Listening
- **Continuous Conversation**: After AI finishes speaking, automatically starts listening again
- **Interrupt Anytime**: Click during AI speech to interrupt and speak immediately
- **Stop Voice Chat**: Exit conversation with dedicated stop button
- No manual typing or repeated button presses required
- Visual feedback for all states (listening, processing, speaking)
- Optimized UI for hands-free, continuous interaction

## Features

### Voice Chat Mode Interface

#### 🎤 Voice Controls
- **Stop Listening Button**: Large circular button (96x96px) with red background
  - Automatically starts listening when entering voice mode
  - Click to stop recording and send your message
  - 30-second maximum recording time (auto-stops if needed)
- **Interrupt Button**: Appears during AI speech
  - Click to immediately stop AI and start speaking
  - Seamless conversation flow
- **Stop Voice Chat Button**: Small text button at bottom
  - Exits voice conversation and returns to text mode
  - Cleans up all active voice resources

#### 📊 Status Indicators
- **Text status**: 
  - "🎤 Listening to you..." - Recording your voice
  - "⚡ Processing your message..." - Transcribing and sending
  - "🔊 AI is speaking..." - Playing response
  - "Initializing..." - Setting up microphone
- **Visual feedback**: 
  - Red pulsing button when listening
  - Loading spinner when processing
  - Brand-colored button when can interrupt
- **Contextual instructions**: Help text changes based on current state

#### 🔄 Automatic Continuous Flow
1. Switch to "Voice Chat" tab
2. **Microphone auto-starts** (permission prompt first time)
3. Speak your question (up to 30 seconds)
4. Click red button to stop and send
5. AI processes and responds
6. Response automatically converts to speech
7. After response finishes, **automatically starts listening again**
8. Repeat steps 3-7 for continuous conversation
9. Click "Stop Voice Chat" when done

### Text Chat Mode Features

#### 🔊 Voice Output (Optional)
- Toggle speaker button to enable/disable
- Bot responses spoken when enabled
- Manual control over audio playback

## 🎨 Tab Switcher

Switch between modes anytime:
- **Text Chat** tab: MessageSquare icon
- **Voice Chat** tab: Phone icon
- Active tab highlighted with brand color
- Smooth transition between modes
- Chat history preserved when switching

## How It Works

### Voice Chat Mode Flow
1. User switches to "Voice Chat" tab
2. **Microphone automatically starts listening** (after permission granted)
3. User speaks their question/message
4. User clicks stop button (or waits for 30-second timeout)
5. Audio automatically sent to `/api/voice/transcribe`
6. Transcribed text automatically sent to chat API
7. AI processes and responds
8. Response text automatically sent to `/api/voice/speak`
9. Audio response automatically plays
10. **After playback completes, automatically starts listening again** (500ms delay)
11. Repeat steps 3-10 for continuous conversation

**Interrupt Flow:**
- While AI is speaking, user can click the interrupt button
- AI speech immediately stops
- Microphone immediately starts listening
- User can speak their next message
- Prevents waiting for AI to finish

**Stop Flow:**
- User clicks "Stop Voice Chat" button
- All recording and playback immediately stops
- Microphone access released
- Returns to Text Chat mode
- Conversation history preserved

### Text Chat Mode Flow
1. User types message in text field
2. **Optional**: Click mic button to record instead
3. **Optional**: Enable speaker for voice responses
4. User clicks send button
5. Response appears as text
6. **Optional**: Response spoken if voice enabled

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

### Using Voice Chat Mode

1. **Start Voice Chat:**
   - Click the "Voice Chat" tab (Phone icon)
   - Grant microphone permission if prompted
   - **Listening starts automatically** - no button press needed

2. **Have a Continuous Conversation:**
   - **Speak** your question or message naturally
   - **Click the red microphone button** when you finish speaking
   - AI processes your message automatically
   - **Listen** to the AI response
   - **Automatically resumes listening** after AI finishes - just start speaking again!
   - Repeat for as long as you want

3. **Interrupt the AI:**
   - If AI is speaking and you want to interrupt
   - **Click the microphone button** while AI is talking
   - AI stops immediately
   - You can speak your next message right away

4. **Stop the Conversation:**
   - Click **"✕ Stop Voice Chat"** button at any time
   - Exits voice mode and returns to text chat
   - All voice resources cleaned up

5. **Visual Feedback:**
   - **Red pulsing mic**: You're being recorded
   - **Processing text**: AI is thinking
   - **Brand color mic**: You can interrupt the AI
   - **Loading spinner**: System is processing

### Using Text Chat Mode

1. **Type Messages:**
   - Type in the text input field
   - Press Enter or click Send

2. **Optional Voice Input:**
   - Click microphone button (small, in input bar)
   - Speak your message
   - Click again to stop
   - Edit transcribed text if needed
   - Click Send

3. **Optional Voice Responses:**
   - Click speaker icon to enable voice
   - Bot responses will be spoken
   - Click again to disable

## Brand Customization

Voice UI elements inherit the brand color from admin settings:

### Voice Chat Mode
- Tab active state (border and text color)
- Large push-to-talk button background
- Bot message avatar background
- User message bubble gradient

### Text Chat Mode
- Voice enable button background (when active)
- Microphone button border and hover state
- All voice controls follow brand color

All colors dynamically applied from `/admin` settings.

## Key Differences Between Modes

| Feature | Text Chat | Voice Chat |
|---------|-----------|------------|
| **Input Method** | Typing (primary), voice (optional) | Voice only (automatic) |
| **Start Listening** | Manual click | **Auto-start** on mode switch |
| **Stop Recording** | Manual click | Manual click (or 30s timeout) |
| **Send Action** | Manual button click | Automatic on stop recording |
| **Voice Output** | Optional (toggle on/off) | Always on (automatic) |
| **Resume Listening** | N/A | **Automatic** after AI response |
| **Interrupt AI** | N/A | **Yes** - click to interrupt |
| **Edit Before Send** | Yes | No (auto-send) |
| **UI Layout** | Text input with buttons | Large stop/interrupt buttons |
| **Conversation Flow** | Manual steps | **Continuous automatic** |
| **Best For** | Detailed messages, editing | Hands-free continuous talk |
| **Use Case** | Desktop, precise control | Mobile, driving, accessibility, natural conversation |

## Notes

### Voice Chat Mode Specifics
- **Fully automatic continuous conversation** - optimized for natural back-and-forth
- **Auto-starts listening** when you enter Voice Chat mode
- **Auto-resumes listening** after each AI response (500ms delay)
- **30-second maximum** per recording to prevent indefinite listening
- **Interrupt anytime** - click during AI speech to interrupt and speak immediately
- **No editing** - messages sent immediately after recording stops
- **Automatic playback** of all responses
- **Stop Voice Chat button** to exit and return to text mode
- **Prevents message loops** - tracks last processed message ID
- **Small audio clips ignored** - requires at least 1KB of audio data

### General Notes
- Both modes share the same chat history
- Switch between modes anytime without losing context
- Voice mode requires microphone permissions (one-time browser prompt)
- HTTPS required for microphone access (works on localhost for development)
- Audio files streamed, not stored
- Voice state resets when switching modes
- Works on mobile and desktop browsers
- Permission denied shows alert and disables voice mode
- Transcription supports all Whisper languages (defaults to English detection)
- TTS uses natural-sounding Alloy voice (customizable in API routes)
