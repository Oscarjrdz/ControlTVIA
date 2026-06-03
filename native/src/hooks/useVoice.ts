import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as Speech from 'expo-speech';
import { useCallback, useRef, useState } from 'react';

const RECORDING_OPTIONS: Audio.RecordingOptions = {
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  ios: {
    extension: '.m4a',
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 128000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {},
};

interface UseVoiceReturn {
  isRecording:    boolean;
  startRecording: () => Promise<void>;
  stopRecording:  () => Promise<{ base64: string; mimeType: string } | null>;
  speak:          (text: string) => void;
  stopSpeaking:   () => void;
  isSpeaking:     boolean;
  permissionError: string | null;
}

export function useVoice(): UseVoiceReturn {
  const recordingRef              = useRef<Audio.Recording | null>(null);
  const [isRecording, setIsRecording]   = useState(false);
  const [isSpeaking, setIsSpeaking]     = useState(false);
  const [permissionError, setPermError] = useState<string | null>(null);

  const startRecording = useCallback(async () => {
    try {
      // Pedir permiso
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        setPermError('Permiso de micrófono denegado');
        return;
      }
      setPermError(null);

      // Configurar sesión de audio (necesario en iOS)
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(RECORDING_OPTIONS);
      await recording.startAsync();
      recordingRef.current = recording;
      setIsRecording(true);
    } catch (e) {
      console.error('startRecording error:', e);
      setPermError('Error al iniciar grabación');
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<{ base64: string; mimeType: string } | null> => {
    const recording = recordingRef.current;
    if (!recording) return null;

    try {
      await recording.stopAndUnloadAsync();
      setIsRecording(false);
      recordingRef.current = null;

      // Restaurar modo audio para reproducción
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      const uri = recording.getURI();
      if (!uri) return null;

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Limpiar archivo temporal
      await FileSystem.deleteAsync(uri, { idempotent: true });

      return { base64, mimeType: 'audio/aac' };
    } catch (e) {
      console.error('stopRecording error:', e);
      setIsRecording(false);
      recordingRef.current = null;
      return null;
    }
  }, []);

  const speak = useCallback((text: string) => {
    Speech.stop();
    setIsSpeaking(true);
    Speech.speak(text, {
      language: 'es-MX',
      rate: 1.05,
      pitch: 1.0,
      onDone: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  }, []);

  const stopSpeaking = useCallback(() => {
    Speech.stop();
    setIsSpeaking(false);
  }, []);

  return { isRecording, startRecording, stopRecording, speak, stopSpeaking, isSpeaking, permissionError };
}
