import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const APP_B64 = 'VFYgSUEgQ29udHJvbA=='; // btoa('TV IA Control')
const wsUrl = (ip: string) =>
  `ws://${ip}:8001/api/v2/channels/samsung.remote.control?name=${APP_B64}`;

type Status = 'disconnected' | 'connecting' | 'connected' | 'error';

const STATUS_LABEL: Record<Status, string> = {
  disconnected: 'Desconectado',
  connecting:   'Conectando…',
  connected:    'Conectado',
  error:        'Error',
};

const STATUS_COLOR: Record<Status, string> = {
  disconnected: '#6b7280',
  connecting:   '#f59e0b',
  connected:    '#22c55e',
  error:        '#ef4444',
};

export default function App() {
  const [ip,     setIp]     = useState('192.168.0.44');
  const [status, setStatus] = useState<Status>('disconnected');
  const [log,    setLog]    = useState<string[]>([]);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('tvIP').then(v => { if (v) setIp(v); });
  }, []);

  const addLog = (msg: string) =>
    setLog(prev => [new Date().toLocaleTimeString('es-MX') + '  ' + msg, ...prev].slice(0, 30));

  const connect = async () => {
    ws.current?.close();
    await AsyncStorage.setItem('tvIP', ip);
    setStatus('connecting');
    addLog('Conectando a ' + ip + '…');

    const sock = new WebSocket(wsUrl(ip));
    ws.current = sock;

    sock.onopen = () => {
      setStatus('connected');
      addLog('✓ Conectado');
    };
    sock.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data as string);
        if (d.event === 'ms.channel.unauthorized') addLog('⚠ Acepta el popup en la TV');
        if (d.event === 'ms.channel.connect')      addLog('Canal listo');
      } catch {}
    };
    sock.onerror = () => {
      setStatus('error');
      addLog('✗ Error — verifica IP y que la TV esté encendida');
    };
    sock.onclose = () => {
      setStatus('disconnected');
      ws.current = null;
    };
  };

  const disconnect = () => {
    ws.current?.close();
    ws.current = null;
    setStatus('disconnected');
    addLog('Desconectado');
  };

  const sendKey = (key: string) => {
    if (ws.current?.readyState !== WebSocket.OPEN) {
      addLog('⚠ No conectado');
      return;
    }
    ws.current.send(JSON.stringify({
      method: 'ms.remote.control',
      params: { Cmd: 'Click', DataOfCmd: key, Option: 'false', TypeOfRemote: 'SendRemoteKey' },
    }));
    addLog('▶ ' + key);
  };

  const connected = status === 'connected';

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>📺  TV IA Control</Text>
        <View style={s.statusRow}>
          <View style={[s.dot, { backgroundColor: STATUS_COLOR[status] }]} />
          <Text style={s.statusTxt}>{STATUS_LABEL[status]}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

        {/* Conexión */}
        <View style={s.card}>
          <Text style={s.sec}>Conexión</Text>
          <View style={s.row}>
            <TextInput
              style={s.input}
              value={ip}
              onChangeText={setIp}
              placeholder="192.168.0.44"
              placeholderTextColor="#4b5563"
              keyboardType="decimal-pad"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={connect}
            />
            <Pressable
              style={[s.btn, connected ? s.btnRed : s.btnBlue]}
              onPress={connected ? disconnect : connect}
            >
              <Text style={s.btnTxt}>{connected ? 'Desconectar' : 'Conectar'}</Text>
            </Pressable>
          </View>
        </View>

        {/* Power */}
        <View style={s.card}>
          <Text style={s.sec}>Power</Text>
          <View style={s.row}>
            <Pressable style={[s.key, s.keyPower]} onPress={() => sendKey('KEY_POWER')}>
              <Text style={s.keyTxt}>⏻  Encender / Apagar</Text>
            </Pressable>
          </View>
        </View>

        {/* Volumen */}
        <View style={s.card}>
          <Text style={s.sec}>Volumen</Text>
          <View style={s.row}>
            <Pressable style={s.key} onPress={() => sendKey('KEY_VOLUP')}>
              <Text style={s.keyTxt}>🔊  VOL +</Text>
            </Pressable>
            <Pressable style={s.key} onPress={() => sendKey('KEY_MUTE')}>
              <Text style={s.keyTxt}>🔇  Mute</Text>
            </Pressable>
            <Pressable style={s.key} onPress={() => sendKey('KEY_VOLDOWN')}>
              <Text style={s.keyTxt}>🔉  VOL −</Text>
            </Pressable>
          </View>
        </View>

        {/* Canales */}
        <View style={s.card}>
          <Text style={s.sec}>Canales</Text>
          <View style={s.row}>
            <Pressable style={s.key} onPress={() => sendKey('KEY_CHUP')}>
              <Text style={s.keyTxt}>▲  CH +</Text>
            </Pressable>
            <Pressable style={s.key} onPress={() => sendKey('KEY_CHDOWN')}>
              <Text style={s.keyTxt}>▼  CH −</Text>
            </Pressable>
          </View>
        </View>

        {/* Navegación */}
        <View style={s.card}>
          <Text style={s.sec}>Navegación</Text>
          <View style={[s.row, { justifyContent: 'center' }]}>
            <Pressable style={s.navBtn} onPress={() => sendKey('KEY_UP')}>
              <Text style={s.keyTxt}>▲</Text>
            </Pressable>
          </View>
          <View style={s.row}>
            <Pressable style={s.navBtn} onPress={() => sendKey('KEY_LEFT')}>
              <Text style={s.keyTxt}>◀</Text>
            </Pressable>
            <Pressable style={[s.navBtn, s.navOk]} onPress={() => sendKey('KEY_ENTER')}>
              <Text style={[s.keyTxt, { color: '#fff' }]}>OK</Text>
            </Pressable>
            <Pressable style={s.navBtn} onPress={() => sendKey('KEY_RIGHT')}>
              <Text style={s.keyTxt}>▶</Text>
            </Pressable>
          </View>
          <View style={[s.row, { justifyContent: 'center' }]}>
            <Pressable style={s.navBtn} onPress={() => sendKey('KEY_DOWN')}>
              <Text style={s.keyTxt}>▼</Text>
            </Pressable>
          </View>
          <View style={s.row}>
            <Pressable style={s.key} onPress={() => sendKey('KEY_HOME')}>
              <Text style={s.keyTxt}>⌂  Inicio</Text>
            </Pressable>
            <Pressable style={s.key} onPress={() => sendKey('KEY_RETURN')}>
              <Text style={s.keyTxt}>↩  Atrás</Text>
            </Pressable>
          </View>
        </View>

        {/* Log */}
        <View style={s.card}>
          <View style={s.logHead}>
            <Text style={s.sec}>Registro</Text>
            <Pressable onPress={() => setLog([])}>
              <Text style={s.clearTxt}>Limpiar</Text>
            </Pressable>
          </View>
          {log.length === 0
            ? <Text style={s.empty}>Los comandos aparecerán aquí</Text>
            : log.map((l, i) => <Text key={i} style={s.logLine}>{l}</Text>)
          }
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f0f1a' },

  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#1f2937',
  },
  title:     { fontSize: 20, fontWeight: '700', color: '#f9fafb' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  dot:       { width: 8, height: 8, borderRadius: 4 },
  statusTxt: { fontSize: 12, color: '#9ca3af' },

  content: { gap: 12, padding: 12, paddingBottom: 40 },
  card: {
    backgroundColor: '#111827',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 16,
    gap: 10,
  },
  sec: { fontSize: 11, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8 },

  row:   { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    height: 46,
    backgroundColor: '#1f2937',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#374151',
    paddingHorizontal: 14,
    color: '#f9fafb',
    fontSize: 16,
  },

  btn:     { height: 46, paddingHorizontal: 16, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  btnBlue: { backgroundColor: '#6366f1' },
  btnRed:  { backgroundColor: '#ef4444' },
  btnTxt:  { color: '#fff', fontWeight: '700', fontSize: 14 },

  key: {
    flex: 1,
    height: 50,
    backgroundColor: '#1f2937',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyPower: { backgroundColor: 'rgba(239,68,68,0.15)', borderColor: '#ef4444' },
  keyTxt:   { color: '#f9fafb', fontWeight: '600', fontSize: 15 },

  navBtn: {
    width: 60,
    height: 60,
    backgroundColor: '#1f2937',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navOk: { backgroundColor: '#6366f1', borderColor: '#6366f1' },

  logHead:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  clearTxt: { fontSize: 12, color: '#6b7280' },
  empty:    { fontSize: 13, color: '#4b5563', textAlign: 'center', paddingVertical: 8 },
  logLine:  { fontSize: 12, color: '#9ca3af', paddingVertical: 2 },
});
