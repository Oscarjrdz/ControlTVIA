import * as Speech from 'expo-speech';
import { useCallback, useState } from 'react';

// expo-audio y expo-av requieren un custom dev build (no están en Expo Go).
// En esta versión: TTS funciona, grabación de audio se agrega en el build nativo.

interface UseVoiceReturn {
  isRecording:     boolean;
  startRecording:  () => Promise<void>;
  stopRecording:   () => Promise<{ base64: string; mimeType: string } | null>;
  speak:           (text: string) => void;
  stopSpeaking:    () => void;
  isSpeaking:      boolean;
  permissionError: string | null;
  audioAvailable:  boolean;
}

export function useVoice(): UseVoiceReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Audio recording no disponible en Expo Go.
  // Se habilitará automáticamente en el dev build / producción.
  const startRecording = useCallback(async () => {}, []);
  const stopRecording  = useCallback(async () => null, []);

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
    isRecording:    false,
    startRecording,
    stopRecording,
    speak,
    stopSpeaking,
    isSpeaking,
    permissionError: null,
    audioAvailable:  false,
  };
}
