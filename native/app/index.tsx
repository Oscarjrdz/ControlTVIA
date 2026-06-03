import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppLauncher }  from '../src/components/AppLauncher';
import { RemoteGrid }   from '../src/components/RemoteGrid';
import { SettingsModal } from '../src/components/SettingsModal';
import { VoiceButton }  from '../src/components/VoiceButton';
import { APPS, Colors, type AIResponse, type LogEntry, type TVStatus } from '../src/constants';
import { useGemini }    from '../src/hooks/useGemini';
import { useSamsungTV } from '../src/hooks/useSamsungTV';
import { useVoice }     from '../src/hooks/useVoice';

const STATUS_COLORS: Record<TVStatus, string> = {
  connected:    Colors.success,
  connecting:   Colors.warning,
  disconnected: Colors.textMuted,
  error:        Colors.error,
};
const STATUS_LABELS: Record<TVStatus, string> = {
  connected:    'Conectado',
  connecting:   'Conectando…',
  disconnected: 'Desconectado',
  error:        'Error',
};

export default function HomeScreen() {
  // Persistencia
  const [tvIP,     setTvIP]     = useState('192.168.0.44');
  const [apiKey,   setApiKey]   = useState('');
  const [userName, setUserName] = useState('Oscar');

  // Borradores del modal
  const [draftKey,  setDraftKey]  = useState('');
  const [draftName, setDraftName] = useState('Oscar');

  // UI state
  const [showSettings, setShowSettings]     = useState(false);
  const [connExpanded, setConnExpanded]     = useState(true);
  const [voiceStatus,  setVoiceStatus]      = useState('Mantén presionado para hablar');
  const [transcript,   setTranscript]       = useState('');
  const [log,          setLog]              = useState<LogEntry[]>([]);

  // Hooks
  const tv     = useSamsungTV();
  const voice  = useVoice();
  const gemini = useGemini({ apiKey, userName });

  // ── Cargar configuración guardada ──────────────────────────
  useEffect(() => {
    (async () => {
      const [ip, key, name] = await Promise.all([
        AsyncStorage.getItem('tvIP'),
        AsyncStorage.getItem('geminiKey'),
        AsyncStorage.getItem('userName'),
      ]);
      if (ip)   setTvIP(ip);
      if (key)  setApiKey(key);
      if (name) setUserName(name);
    })();
  }, []);

  // ── Auto-colapsar conexión al conectar ─────────────────────
  useEffect(() => {
    if (tv.status === 'connected')    setConnExpanded(false);
    if (tv.status === 'disconnected') setConnExpanded(true);
    if (tv.status === 'error')        setConnExpanded(true);
  }, [tv.status]);

  // ── Log helper ─────────────────────────────────────────────
  const addLog = useCallback((message: string, type: LogEntry['type']) => {
    const now = new Date();
    const time = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLog(prev => [{ id: Date.now().toString(), time, message, type }, ...prev].slice(0, 60));
  }, []);

  // ── Notificar eventos de TV ────────────────────────────────
  useEffect(() => {
    if (tv.lastEvent) addLog(tv.lastEvent, 'info');
  }, [tv.lastEvent, addLog]);

  // ── Ejecutar acción de AI ──────────────────────────────────
  const executeAI = useCallback((result: AIResponse) => {
    const { action, value, speak, repeat } = result;
    const times = Math.min(Math.max(Number(repeat) || 1, 1), 20);

    // Siempre hablar
    voice.speak(speak);
    setTranscript(`✨ ${speak}`);
    setTimeout(() => setTranscript(''), 5000);

    if (action === 'unknown') {
      addLog(`🤔 ${speak}`, 'warning');
      return;
    }
    if (action === 'chat') {
      addLog(`💬 ${speak}`, 'voice');
      return;
    }
    if (action === 'key' && value) {
      addLog(`▶ ${value}${times > 1 ? ` ×${times}` : ''}`, 'command');
      for (let i = 0; i < times; i++) {
        setTimeout(() => tv.sendKey(value!), i * 280);
      }
      return;
    }
    if (action === 'app' && value) {
      addLog(`▶ ${APPS[value] ?? value}`, 'command');
      tv.openApp(value);
    }
  }, [tv, voice, addLog]);

  // ── Voz: presionar ─────────────────────────────────────────
  const onPressIn = useCallback(async () => {
    if (voice.isRecording) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setVoiceStatus('Grabando…');
    setTranscript('');
    await voice.startRecording();
  }, [voice]);

  // ── Voz: soltar → enviar a Gemini ─────────────────────────
  const onPressOut = useCallback(async () => {
    if (!voice.isRecording) return;
    setVoiceStatus('✨ Enviando…');
    const audio = await voice.stopRecording();
    if (!audio) {
      setVoiceStatus('Error al grabar');
      return;
    }

    if (!apiKey) {
      addLog('Configura tu Gemini API Key en ⚙️', 'warning');
      setVoiceStatus('Sin API Key — ve a ⚙️');
      return;
    }

    const result = await gemini.ask(audio);
    if (result) {
      executeAI(result);
    }
    setVoiceStatus('Mantén presionado para hablar');
  }, [voice, apiKey, gemini, executeAI, addLog]);

  // ── Settings ───────────────────────────────────────────────
  const openSettings = useCallback(() => {
    setDraftKey(apiKey);
    setDraftName(userName);
    setShowSettings(true);
  }, [apiKey, userName]);

  const saveSettings = useCallback(async (key: string, name: string) => {
    const finalName = name.trim() || 'Oscar';
    setApiKey(key);
    setUserName(finalName);
    setDraftKey(key);
    setDraftName(finalName);
    await Promise.all([
      AsyncStorage.setItem('geminiKey', key),
      AsyncStorage.setItem('userName', finalName),
    ]);
    gemini.clearHistory();
    setShowSettings(false);
    if (key) {
      addLog(`✨ Gemini activo — hola ${finalName}`, 'success');
      voice.speak(`Listo ${finalName}, ya estoy activo`);
    } else {
      addLog('Gemini desactivado', 'info');
    }
  }, [gemini, voice, addLog]);

  // ── Conectar TV ────────────────────────────────────────────
  const handleConnect = useCallback(async () => {
    if (tv.status === 'connected') {
      tv.disconnect();
    } else {
      await AsyncStorage.setItem('tvIP', tvIP);
      addLog(`Conectando a ${tvIP}…`, 'info');
      tv.connect(tvIP);
    }
  }, [tv, tvIP, addLog]);

  // ── KEY desde botones físicos ──────────────────────────────
  const handleKey = useCallback((key: string) => {
    if (tv.status !== 'connected') {
      Alert.alert('No conectado', 'Conéctate a la TV primero');
      return;
    }
    tv.sendKey(key);
    addLog(`▶ ${key}`, 'command');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [tv, addLog]);

  const handleApp = useCallback((appId: string) => {
    if (tv.status !== 'connected') {
      Alert.alert('No conectado', 'Conéctate a la TV primero');
      return;
    }
    tv.openApp(appId);
    addLog(`▶ ${APPS[appId] ?? appId}`, 'command');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [tv, addLog]);

  const dotColor = STATUS_COLORS[tv.status];

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.logo}>📺</Text>
          <View>
            <Text style={styles.appTitle}>TV IA Control</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
              <Text style={styles.statusText}>{STATUS_LABELS[tv.status]}</Text>
              {apiKey ? <Text style={styles.aiBadge}>✨ AI</Text> : null}
            </View>
          </View>
        </View>
        <Pressable onPress={openSettings} style={styles.settingsBtn}>
          <Text style={styles.settingsBtnTxt}>⚙️</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Conexión ── */}
        <View style={styles.card}>
          <Pressable
            style={styles.cardHeader}
            onPress={() => setConnExpanded(e => !e)}
          >
            <View style={styles.cardHeaderLeft}>
              <Text style={styles.sectionTitle}>📡  Conexión</Text>
              <View style={[styles.pill, { borderColor: dotColor }]}>
                <View style={[styles.pillDot, { backgroundColor: dotColor }]} />
                <Text style={[styles.pillText, { color: dotColor }]}>
                  {STATUS_LABELS[tv.status]}
                </Text>
              </View>
            </View>
            <Text style={styles.chevron}>{connExpanded ? '▲' : '▼'}</Text>
          </Pressable>

          {connExpanded && (
            <View style={styles.connBody}>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.ipInput}
                  value={tvIP}
                  onChangeText={setTvIP}
                  placeholder="192.168.0.44"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="decimal-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleConnect}
                />
                <Pressable
                  style={({ pressed }) => [
                    styles.connectBtn,
                    tv.status === 'connected' && styles.connectBtnActive,
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={handleConnect}
                >
                  <Text style={styles.connectBtnTxt}>
                    {tv.status === 'connected' ? 'Desconectar' : 'Conectar'}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {/* ── Voz ── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>🎤  Control por Voz</Text>
          <VoiceButton
            isRecording={voice.isRecording}
            isLoading={gemini.isLoading}
            isSpeaking={voice.isSpeaking}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            statusText={voiceStatus}
            transcript={transcript}
            disabled={false}
          />
          {voice.permissionError ? (
            <Text style={styles.permError}>{voice.permissionError}</Text>
          ) : null}
        </View>

        {/* ── Remote ── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>🎮  Control Remoto</Text>
          <RemoteGrid onKey={handleKey} />
        </View>

        {/* ── Apps ── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📺  Aplicaciones</Text>
          <AppLauncher onApp={handleApp} />
        </View>

        {/* ── Log ── */}
        <View style={styles.card}>
          <View style={styles.logHeader}>
            <Text style={styles.sectionTitle}>📋  Registro</Text>
            <Pressable onPress={() => setLog([])}>
              <Text style={styles.clearBtn}>Limpiar</Text>
            </Pressable>
          </View>
          {log.length === 0 ? (
            <Text style={styles.logEmpty}>Los comandos aparecerán aquí</Text>
          ) : (
            log.map(entry => (
              <View key={entry.id} style={[styles.logEntry, styles[`log_${entry.type}` as keyof typeof styles] as object]}>
                <Text style={styles.logTime}>{entry.time}</Text>
                <Text style={styles.logMsg} numberOfLines={2}>{entry.message}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* ── Settings Modal ── */}
      <SettingsModal
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        apiKey={apiKey}
        userName={userName}
        onSave={saveSettings}
        onClearHistory={() => { gemini.clearHistory(); addLog('Historial borrado', 'info'); }}
        onTestVoice={(name) => voice.speak(`Hola ${name}, soy Control, tu asistente de televisión`)}
        draftKey={draftKey}
        draftName={draftName}
        setDraftKey={setDraftKey}
        setDraftName={setDraftName}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo:       { fontSize: 24 },
  appTitle:   { fontSize: 17, fontWeight: '700', color: Colors.text, letterSpacing: -0.3 },
  statusRow:  { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  statusDot:  { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500' },
  aiBadge: {
    fontSize: 10, fontWeight: '700', color: '#fff',
    backgroundColor: Colors.accent, paddingHorizontal: 5, paddingVertical: 1,
    borderRadius: 4, overflow: 'hidden',
  },
  settingsBtn:    { padding: 6 },
  settingsBtnTxt: { fontSize: 22 },

  // Scroll
  scroll:        { flex: 1 },
  scrollContent: { gap: 12, padding: 12, paddingBottom: 32 },

  // Cards
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    color: Colors.textSecondary,
  },

  // Connection
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  chevron: { fontSize: 12, color: Colors.textMuted },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 100, borderWidth: 1,
    backgroundColor: 'transparent',
  },
  pillDot:  { width: 5, height: 5, borderRadius: 3 },
  pillText: { fontSize: 11, fontWeight: '600' },
  connBody: { gap: 10 },
  inputRow: { flexDirection: 'row', gap: 8 },
  ipInput: {
    flex: 1, height: 44,
    backgroundColor: Colors.bgInput,
    borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 12, color: Colors.text, fontSize: 16,
  },
  connectBtn: {
    height: 44, paddingHorizontal: 16, borderRadius: 10,
    backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center',
  },
  connectBtnActive: { backgroundColor: Colors.error },
  connectBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Voice
  permError: { fontSize: 12, color: Colors.error, textAlign: 'center' },

  // Log
  logHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  clearBtn:  { fontSize: 13, color: Colors.textSecondary, padding: 4 },
  logEmpty:  { fontSize: 13, color: Colors.textMuted, textAlign: 'center', paddingVertical: 12 },
  logEntry: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    paddingVertical: 5, paddingHorizontal: 8, borderRadius: 6,
    backgroundColor: Colors.bgInput, borderLeftWidth: 3, borderLeftColor: Colors.border,
  },
  logTime: { fontSize: 11, color: Colors.textMuted, fontVariant: ['tabular-nums'], width: 70 },
  logMsg:  { fontSize: 12, color: Colors.textSecondary, flex: 1 },

  // Log type accents (left border color via inline style)
  log_success: { borderLeftColor: Colors.success },
  log_error:   { borderLeftColor: Colors.error },
  log_warning: { borderLeftColor: Colors.warning },
  log_voice:   { borderLeftColor: Colors.mic },
  log_command: { borderLeftColor: Colors.accent },
  log_info:    { borderLeftColor: Colors.border },
});
