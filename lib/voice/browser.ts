export const voiceCaptureConstraints: MediaStreamConstraints = {
  audio: {
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  }
};

const recorderMimeTypes = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
  "audio/mp4"
];

export function getVoiceRecorderOptions(): MediaRecorderOptions {
  if (typeof MediaRecorder === "undefined") {
    return { audioBitsPerSecond: 24_000 };
  }

  const mimeType = recorderMimeTypes.find((type) =>
    MediaRecorder.isTypeSupported(type)
  );

  return {
    ...(mimeType ? { mimeType } : {}),
    audioBitsPerSecond: 24_000
  };
}
