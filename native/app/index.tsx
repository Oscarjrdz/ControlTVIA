import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppLauncher }   from '../src/components/AppLauncher';
import { RemoteGrid }    from '../src/components/RemoteGrid';
import { SettingsModal } from '../src/components/SettingsModal';
import { APPS, Colors, type AIResponse, type LogEntry, type TVStatus } from '../src/constants';
import { useGemini }     from '../src/hooks/useGemini';
import { useSamsungTV }  from '../src/hooks/useSamsungTV';
import { useVoice }      from '../src/hooks/useVoice';

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
  const [tvIP,       setTvIP]       = useState('192.168.0.44');
  const [apiKey,     setApiKey]     = useState('');
  const [userName,   setUserName]   = useState('Oscar');
  const [draftKey,   setDraftKey]   = useState('');
  const [draftName,  setDraftName]  = useState('Oscar');
  const [showSettings, setShowSettings] = useState(false);
  const [connExpanded, setConnExpanded] = useState(true);
  const [aiInput,    setAiInput]    = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [log,        setLog]        = useState<LogEntry[]>([]);

  const tv     = useSamsungTV();
  const voice  = useVoice();
  const gemini = useGemini({ apiKey, userName });

  // Cargar configuración
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

  // Auto-colapsar conexión al conectar
  useEffect(() => {
    if (tv.status === 'connected')    setConnExpanded(false);
    if (tv.status === 'disconnected') setConnExpanded(true);
    if (tv.status === 'error')        setConnExpanded(true);
  }, [tv.status]);

  const addLog = useCallback((message: string, type: LogEntry['type']) => {
    const time = new Date().toLocaleTimeString('es-MX', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    setLog(prev => [{ id: Date.now().toString(), time, message, type }, ...prev].slice(0, 50));
  }, []);

  useEffect(() => {
    if (tv.lastEvent) addLog(tv.lastEvent, 'info');
  }, [tv.lastEvent, addLog]);

  const executeAI = useCallback((result: AIResponse) => {
    const { action, value, speak, repeat } = result;
    const times = Math.min(Math.max(Number(repeat) || 1, 1), 20);

    voice.speak(speak);
    setAiResponse(`✨ ${speak}`);
    setTimeout(() => setAiResponse(''), 5000);

    if (action === 'unknown') { addLog(`🤔 ${speak}`, 'warning'); return; }
    if (action === 'chat')    { addLog(`💬 ${speak}`, 'voice');   return; }
    if (action === 'key' && value) {
      addLog(`▶ ${value}${times > 1 ? ` ×${times}` : ''}`, 'command');
      for (let i = 0; i < times; i++) setTimeout(() => tv.sendKey(value!), i * 280);
    } else if (action === 'app' && value) {
      addLog(`▶ ${APPS[value] ?? value}`, 'command');
      tv.openApp(value);
    }
  }, [tv, voice, addLog]);

  const sendToAI = useCallback(async () => {
    const text = aiInput.trim();
    if (!text) return;
    if (!apiKey) { Alert.alert('Sin API Key', 'Configura tu Gemini key en ⚙️'); return; }
    setAiInput('');
    addLog(`🎤 "${text}"`, 'voice');
    const result = await gemini.askText(text);
    if (result) executeAI(result);
  }, [aiInput, apiKey, gemini, executeAI, addLog]);

  const handleConnect = useCallback(async () => {
    if (tv.status === 'connected') {
      tv.disconnect();
    } else {
      await AsyncStorage.setItem('tvIP', tvIP);
      tv.connect(tvIP);
      addLog(`Conectando a ${tvIP}…`, 'info');
    }
  }, [tv, tvIP, addLog]);

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

  const saveSettings = useCallback(async (key: string, name: string) => {
    const n = name.trim() || 'Oscar';
    setApiKey(key); setUserName(n);
    await Promise.all([
      AsyncStorage.setItem('geminiKey', key),
      AsyncStorage.setItem('userName', n),
    ]);
    gemini.clearHistory();
    setShowSettings(false);
    if (key) {
      voice.speak(`Listo ${n}, ya estoy activo`);
      addLog(`✨ Gemini activo — hola ${n}`, 'success');
    }
  }, [gemini, voice, addLog]);

  const dotColor = STATUS_COLORS[tv.status];

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Text style={s.logo}>📺</Text>
          <View>
            <Text style={s.title}>TV IA Control</Text>
            <View style={s.statusRow}>
              <View style={[s.dot, { backgroundColor: dotColor }]} />
              <Text style={s.statusTxt}>{STATUS_LABELS[tv.status]}</Text>
              {apiKey ? <Text style={s.aiBadge}>✨ AI</Text> : null}
            </View>
          </View>
        </View>
        <Pressable onPress={() => { setDraftKey(apiKey); setDraftName(userName); setShowSettings(true); }}>
          <Text style={s.gear}>⚙️</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Conexión */}
          <View style={s.card}>
            <Pressable style={s.cardHead} onPress={() => setConnExpanded(e => !e)}>
              <View style={s.cardHeadLeft}>
                <Text style={s.sec}>📡  Conexión</Text>
                <View style={[s.pill, { borderColor: dotColor }]}>
                  <View style={[s.pillDot, { backgroundColor: dotColor }]} />
                  <Text style={[s.pillTxt, { color: dotColor }]}>{STATUS_LABELS[tv.status]}</Text>
                </View>
              </View>
              <Text style={s.chevron}>{connExpanded ? '▲' : '▼'}</Text>
            </Pressable>
            {connExpanded && (
              <View style={s.row}>
                <TextInput
                  style={s.ipInput}
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
                  style={[s.btn, tv.status === 'connected' && s.btnRed]}
                  onPress={handleConnect}
                >
                  <Text style={s.btnTxt}>
                    {tv.status === 'connected' ? 'Desconectar' : 'Conectar'}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* AI Chat */}
          <View style={s.card}>
            <Text style={s.sec}>✨  Control con IA{!apiKey ? ' (configura key en ⚙️)' : ''}</Text>
            {aiResponse ? (
              <View style={s.aiResp}>
                <Text style={s.aiRespTxt}>{aiResponse}</Text>
              </View>
            ) : null}
            <View style={s.row}>
              <TextInput
                style={s.aiInput}
                value={aiInput}
                onChangeText={setAiInput}
                placeholder={apiKey ? `Escribe un comando, ${userName}…` : 'Configura Gemini en ⚙️ primero'}
                placeholderTextColor={Colors.textMuted}
                returnKeyType="send"
                onSubmitEditing={sendToAI}
                editable={!!apiKey}
              />
              <Pressable
                style={[s.btn, s.btnSend, (!apiKey || gemini.isLoading) && s.btnDisabled]}
                onPress={sendToAI}
                disabled={!apiKey || gemini.isLoading}
              >
                <Text style={s.btnTxt}>{gemini.isLoading ? '…' : '▶'}</Text>
              </Pressable>
            </View>
            <Text style={s.hint}>Escribe en lenguaje natural: "bájale", "pon Netflix", "apaga"</Text>
          </View>

          {/* Remote */}
          <View style={s.card}>
            <Text style={s.sec}>🎮  Control Remoto</Text>
            <RemoteGrid onKey={handleKey} />
          </View>

          {/* Apps */}
          <View style={s.card}>
            <Text style={s.sec}>📺  Aplicaciones</Text>
            <AppLauncher onApp={handleApp} />
          </View>

          {/* Log */}
          <View style={s.card}>
            <View style={s.logHead}>
              <Text style={s.sec}>📋  Registro</Text>
              <Pressable onPress={() => setLog([])}>
                <Text style={s.clearTxt}>Limpiar</Text>
              </Pressable>
            </View>
            {log.length === 0 ? (
              <Text style={s.empty}>Los comandos aparecerán aquí</Text>
            ) : log.map(e => (
              <View key={e.id} style={[s.logEntry, logColor(e.type)]}>
                <Text style={s.logTime}>{e.time}</Text>
                <Text style={s.logMsg} numberOfLines={2}>{e.message}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <SettingsModal
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        apiKey={apiKey}
        userName={userName}
        onSave={saveSettings}
        onClearHistory={() => { gemini.clearHistory(); addLog('Historial borrado', 'info'); setShowSettings(false); }}
        onTestVoice={name => voice.speak(`Hola ${name}, soy Control, tu asistente de televisión`)}
        draftKey={draftKey}
        draftName={draftName}
        setDraftKey={setDraftKey}
        setDraftName={setDraftName}
      />
    </SafeAreaView>
  );
}

const logColor = (type: LogEntry['type']) => {
  const colors: Record<LogEntry['type'], string> = {
    success: Colors.success,
    error:   Colors.error,
    warning: Colors.warning,
    voice:   Colors.mic,
    command: Colors.accent,
    info:    Colors.border,
  };
  return { borderLeftColor: colors[type] ?? Colors.border };
};

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderColor: Colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo:       { fontSize: 24 },
  title:      { fontSize: 17, fontWeight: '700', color: Colors.text, letterSpacing: -0.3 },
  statusRow:  { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  dot:        { width: 6, height: 6, borderRadius: 3 },
  statusTxt:  { fontSize: 11, color: Colors.textSecondary, fontWeight: '500' },
  aiBadge:    {
    fontSize: 10, fontWeight: '700', color: '#fff',
    backgroundColor: Colors.accent, paddingHorizontal: 5, paddingVertical: 1,
    borderRadius: 4, overflow: 'hidden',
  },
  gear: { fontSize: 22, padding: 4 },

  scroll:  { flex: 1 },
  content: { gap: 12, padding: 12, paddingBottom: 32 },

  card: {
    backgroundColor: Colors.bgCard, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 12,
  },
  sec: {
    fontSize: 12, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 0.7, color: Colors.textSecondary,
  },
  cardHead:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  chevron:      { fontSize: 11, color: Colors.textMuted },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100, borderWidth: 1,
  },
  pillDot: { width: 5, height: 5, borderRadius: 3 },
  pillTxt: { fontSize: 11, fontWeight: '600' },

  row:  { flexDirection: 'row', gap: 8 },
  ipInput: {
    flex: 1, height: 44, backgroundColor: Colors.bgInput,
    borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 12, color: Colors.text, fontSize: 16,
  },
  btn: {
    height: 44, paddingHorizontal: 16, borderRadius: 10,
    backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center',
  },
  btnRed:     { backgroundColor: Colors.error },
  btnSend:    { width: 44, paddingHorizontal: 0 },
  btnDisabled:{ opacity: 0.4 },
  btnTxt:     { color: '#fff', fontWeight: '700', fontSize: 14 },

  aiInput: {
    flex: 1, height: 44, backgroundColor: Colors.bgInput,
    borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 12, color: Colors.text, fontSize: 15,
  },
  aiResp: {
    backgroundColor: 'rgba(99,102,241,0.1)', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(99,102,241,0.3)', padding: 10,
  },
  aiRespTxt: { fontSize: 14, color: Colors.text, lineHeight: 20 },
  hint: { fontSize: 11, color: Colors.textMuted },

  logHead:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  clearTxt: { fontSize: 13, color: Colors.textSecondary, padding: 4 },
  empty:    { fontSize: 13, color: Colors.textMuted, textAlign: 'center', paddingVertical: 12 },
  logEntry: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    paddingVertical: 5, paddingHorizontal: 8, borderRadius: 6,
    backgroundColor: Colors.bgInput, borderLeftWidth: 3,
  },
  logTime: { fontSize: 11, color: Colors.textMuted, width: 68 },
  logMsg:  { fontSize: 12, color: Colors.textSecondary, flex: 1 },
});
