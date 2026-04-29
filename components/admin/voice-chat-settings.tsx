"use client";

import { useState } from "react";
import { Mic, MicOff, Save } from "lucide-react";

type VoiceChatSettingsProps = {
  initialEnabled: boolean;
  onSave: (enabled: boolean) => Promise<void>;
};

export function VoiceChatSettings({ initialEnabled, onSave }: VoiceChatSettingsProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSave() {
    setSaving(true);
    setMessage("");
    try {
      await onSave(enabled);
      setMessage("Voice chat settings saved successfully");
    } catch {
      setMessage("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-md border border-line bg-white p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Mic className="h-5 w-5 text-coral" /> Voice Chat Settings
      </h2>
      
      <div className="mt-4 space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-line bg-neutral-50 p-4">
          <div className="flex items-center gap-3">
            {enabled ? (
              <Mic className="h-6 w-6 text-emerald-600" />
            ) : (
              <MicOff className="h-6 w-6 text-neutral-400" />
            )}
            <div>
              <p className="font-medium">
                {enabled ? "Voice Chat Enabled" : "Voice Chat Disabled"}
              </p>
              <p className="text-xs text-neutral-500">
                {enabled
                  ? "Users can switch to voice mode in the chat widget"
                  : "Voice chat tab will be hidden from users"}
              </p>
            </div>
          </div>
          
          <button
            type="button"
            onClick={() => setEnabled(!enabled)}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
              enabled ? "bg-emerald-600" : "bg-neutral-300"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {enabled && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm text-emerald-800">
              <strong>Features enabled:</strong> Speech-to-text, Text-to-speech, Continuous voice conversation, Voice interruption
            </p>
            <p className="mt-2 text-xs text-emerald-700">
              Uses OpenAI Whisper-1 for transcription and TTS-1 for speech synthesis
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-md bg-moss px-4 py-2 text-sm font-semibold text-white hover:bg-moss/90 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save Settings"}
        </button>

        {message && (
          <p className={`text-sm ${message.includes("success") ? "text-emerald-600" : "text-red-600"}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
