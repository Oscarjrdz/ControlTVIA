import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants';

interface Props {
  isRecording: boolean;
  isLoading:   boolean;
  isSpeaking:  boolean;
  onPressIn:   () => void;
  onPressOut:  () => void;
  statusText:  string;
  transcript:  string;
  disabled:    boolean;
}

export function VoiceButton({
  isRecording, isLoading, isSpeaking, onPressIn, onPressOut,
  statusText, transcript, disabled,
}: Props) {
  const scale     = useRef(new Animated.Value(1)).current;
  const ringScale = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isRecording) {
      Animated.spring(scale, { toValue: 1.12, useNativeDriver: true, tension: 80 }).start();
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(ringScale,   { toValue: 1.6, duration: 900, useNativeDriver: true }),
            Animated.timing(ringOpacity, { toValue: 0,   duration: 900, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(ringScale,   { toValue: 1,   duration: 0,   useNativeDriver: true }),
            Animated.timing(ringOpacity, { toValue: 0.6, duration: 0,   useNativeDriver: true }),
          ]),
        ])
      ).start();
    } else {
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 80 }).start();
      ringOpacity.setValue(0);
      ringScale.setValue(1);
    }
  }, [isRecording, scale, ringScale, ringOpacity]);

  const btnColor = isRecording ? Colors.error : Colors.mic;
  const label = isLoading
    ? '✨ Pensando…'
    : isSpeaking
    ? '🔊 Respondiendo…'
    : isRecording
    ? '🎙 Suelta para enviar'
    : '🎤 Mantén presionado';

  return (
    <View style={styles.container}>
      {/* Ring de grabación */}
      <Animated.View
        style={[
          styles.ring,
          { borderColor: btnColor, transform: [{ scale: ringScale }], opacity: ringOpacity },
        ]}
      />

      {/* Botón principal */}
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          style={[styles.btn, { backgroundColor: btnColor }, disabled && styles.btnDisabled]}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          disabled={disabled || isLoading}
        >
          <Text style={styles.micIcon}>{isRecording ? '🎙' : '🎤'}</Text>
        </Pressable>
      </Animated.View>

      <Text style={styles.label}>{label}</Text>
      {transcript ? (
        <Text style={styles.transcript} numberOfLines={2}>{transcript}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  ring: {
    position: 'absolute',
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 2,
    top: 24,
  },
  btn: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.mic,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  btnDisabled: { opacity: 0.4 },
  micIcon: { fontSize: 36 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  transcript: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
});
