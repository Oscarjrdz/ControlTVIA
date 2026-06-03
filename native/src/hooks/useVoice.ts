import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  useAudioRecorder,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system';
import * as Speech from 'expo-speech';
import { useCallback, useState } from 'react';

interface UseVoiceReturn {
  isRecording:     boolean;
  startRecording:  () => Promise<void>;
  stopRecording:   () => Promise<{ base64: string; mimeType: string } | null>;
  speak:           (text: string) => void;
  stopSpeaking:    () => void;
  isSpeaking:      boolean;
  permissionError: string | null;
}

export function useVoice(): UseVoiceReturn {
  const [isSpeaking,     setIsSpeaking]   = useState(false);
  const [permissionError, setPermError]   = useState<string | null>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const startRecording = useCallback(async () => {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      setPermError('Permiso de micrófono denegado — ve a Ajustes');
      return;
    }
    setPermError(null);
    await recorder.prepareToRecordAsync();
    recorder.record();
  }, [recorder]);

  const stopRecording = useCallback(async (): Promise<{ base64: string; mimeType: string } | null> => {
    await recorder.stop();
    const uri = recorder.uri;
    if (!uri) return null;

    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await FileSystem.deleteAsync(uri, { idempotent: true });
      return { base64, mimeType: 'audio/aac' };
    } catch {
      return null;
    }
  }, [recorder]);

  const speak = useCallback((text: string) => {
    Speech.stop();
    setIsSpeaking(true);
    Speech.speak(text, {
      language: 'es-MX',
      rate: 1.05,
      pitch: 1.0,
      onDone:  () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  }, []);

  const stopSpeaking = useCallback(() => {
    Speech.stop();
    setIsSpeaking(false);
  }, []);

  return {
    isRecording:    recorder.isRecording,
    startRecording,
    stopRecording,
    speak,
    stopSpeaking,
    isSpeaking,
    permissionError,
  };
}
