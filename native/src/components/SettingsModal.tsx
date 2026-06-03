import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Colors } from '../constants';

interface Props {
  visible:    boolean;
  onClose:    () => void;
  apiKey:     string;
  userName:   string;
  onSave:     (key: string, name: string) => void;
  onClearHistory: () => void;
  onTestVoice: (name: string) => void;
  // controlled state for inputs
  draftKey:   string;
  draftName:  string;
  setDraftKey:  (v: string) => void;
  setDraftName: (v: string) => void;
}

export function SettingsModal({
  visible, onClose, onSave, onClearHistory, onTestVoice,
  draftKey, draftName, setDraftKey, setDraftName,
}: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <Pressable style={styles.overlay} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title}>Configuración</Text>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeTxt}>✕</Text>
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

          {/* Nombre */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>👤</Text>
              <View>
                <Text style={styles.sectionTitle}>Tu nombre</Text>
                <Text style={styles.sectionDesc}>Control te llamará por tu nombre en cada respuesta</Text>
              </View>
            </View>
            <TextInput
              style={styles.input}
              value={draftName}
              onChangeText={setDraftName}
              placeholder="Oscar"
              placeholderTextColor={Colors.textMuted}
              maxLength={20}
              autoCorrect={false}
            />
          </View>

          {/* Gemini */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>✨</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Gemini AI</Text>
                <Text style={styles.sectionDesc}>Conversación natural — el audio va directo a Gemini</Text>
              </View>
            </View>
            <Text style={styles.label}>API Key de Google AI Studio</Text>
            <TextInput
              style={styles.input}
              value={draftKey}
              onChangeText={setDraftKey}
              placeholder="AIzaSy…"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable
              style={({ pressed }) => [styles.testBtn, pressed && { opacity: 0.7 }]}
              onPress={() => onTestVoice(draftName || 'Oscar')}
            >
              <Text style={styles.testBtnTxt}>🔊 Probar voz</Text>
            </Pressable>
            <Text style={styles.hint}>
              La key se guarda solo en este dispositivo.{'\n'}
              Obtenla gratis en <Text style={styles.hintLink}>aistudio.google.com</Text>
            </Text>
          </View>

          {/* Historial */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>💬</Text>
              <View>
                <Text style={styles.sectionTitle}>Conversación</Text>
                <Text style={styles.sectionDesc}>Gemini recuerda el contexto de los últimos mensajes</Text>
              </View>
            </View>
            <Pressable
              style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.7 }]}
              onPress={onClearHistory}
            >
              <Text style={styles.ghostBtnTxt}>Borrar historial de conversación</Text>
            </Pressable>
          </View>

          {/* Guardar */}
          <Pressable
            style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]}
            onPress={() => onSave(draftKey, draftName)}
          >
            <Text style={styles.saveBtnTxt}>Guardar</Text>
          </Pressable>

        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: Colors.border,
    maxHeight: '85%',
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginVertical: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '700', color: Colors.text },
  closeBtn: { padding: 4 },
  closeTxt: { fontSize: 16, color: Colors.textSecondary },
  content: { gap: 12, paddingBottom: 8 },

  section: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  sectionHeader: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  sectionIcon: { fontSize: 20, lineHeight: 26 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  sectionDesc: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  label: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  input: {
    height: 44,
    backgroundColor: Colors.bgInput,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    color: Colors.text,
    fontSize: 14,
    fontFamily: 'monospace',
  },
  testBtn: {
    padding: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: Colors.bgBtn,
  },
  testBtnTxt: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  hint: { fontSize: 11, color: Colors.textMuted, lineHeight: 16 },
  hintLink: { color: Colors.accent },

  ghostBtn: {
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    alignItems: 'center',
  },
  ghostBtnTxt: { fontSize: 13, color: Colors.textSecondary },

  saveBtn: {
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  saveBtnTxt: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
