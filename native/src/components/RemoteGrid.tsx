import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants';

interface Props {
  onKey: (key: string) => void;
}

function RBtn({ label, keyCode, color, onKey, wide }: {
  label: string; keyCode: string; color?: string; onKey: (k: string) => void; wide?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.btn,
        wide && styles.wideBtn,
        color === 'power' && styles.powerBtn,
        color === 'accent' && styles.accentBtn,
        color === 'mute' && styles.muteBtn,
        pressed && styles.btnPressed,
      ]}
      onPress={() => onKey(keyCode)}
    >
      <Text style={[
        styles.btnText,
        color === 'power'  && styles.powerText,
        color === 'accent' && styles.accentText,
        color === 'mute'   && styles.muteText,
      ]}>{label}</Text>
    </Pressable>
  );
}

export function RemoteGrid({ onKey }: Props) {
  return (
    <View style={styles.container}>

      {/* Top row */}
      <View style={styles.row}>
        <RBtn label="⏻"   keyCode="KEY_POWER"  color="power"  onKey={onKey} />
        <RBtn label="⌂"   keyCode="KEY_HOME"                  onKey={onKey} />
        <RBtn label="←"   keyCode="KEY_RETURN"                onKey={onKey} />
        <RBtn label="☰"   keyCode="KEY_MENU"                  onKey={onKey} />
      </View>

      {/* D-Pad */}
      <View style={styles.dpadWrapper}>
        <RBtn label="▲" keyCode="KEY_UP" onKey={onKey} />
        <View style={styles.dpadRow}>
          <RBtn label="◀" keyCode="KEY_LEFT"  onKey={onKey} />
          <RBtn label="OK" keyCode="KEY_ENTER" color="accent" onKey={onKey} />
          <RBtn label="▶" keyCode="KEY_RIGHT" onKey={onKey} />
        </View>
        <RBtn label="▼" keyCode="KEY_DOWN" onKey={onKey} />
      </View>

      {/* Vol / Ch / Media */}
      <View style={styles.threeColRow}>
        {/* VOL */}
        <View style={styles.col}>
          <Text style={styles.colLabel}>VOL</Text>
          <RBtn label="+"   keyCode="KEY_VOLUP"   onKey={onKey} />
          <RBtn label="🔇" keyCode="KEY_MUTE"    color="mute" onKey={onKey} />
          <RBtn label="−"   keyCode="KEY_VOLDOWN" onKey={onKey} />
        </View>
        {/* CH */}
        <View style={styles.col}>
          <Text style={styles.colLabel}>CH</Text>
          <RBtn label="▲" keyCode="KEY_CHUP"   onKey={onKey} />
          <RBtn label="ℹ" keyCode="KEY_INFO"   onKey={onKey} />
          <RBtn label="▼" keyCode="KEY_CHDOWN" onKey={onKey} />
        </View>
        {/* MEDIA */}
        <View style={styles.col}>
          <Text style={styles.colLabel}>▶</Text>
          <RBtn label="⏮" keyCode="KEY_REWIND" onKey={onKey} />
          <RBtn label="⏯" keyCode="KEY_PLAY"   onKey={onKey} />
          <RBtn label="⏭" keyCode="KEY_FF"     onKey={onKey} />
        </View>
      </View>

      {/* Numpad */}
      <View style={styles.numpad}>
        {['1','2','3','4','5','6','7','8','9'].map(n => (
          <RBtn key={n} label={n} keyCode={`KEY_${n}`} onKey={onKey} />
        ))}
        <RBtn label="Prev" keyCode="KEY_PRECH" onKey={onKey} wide />
        <RBtn label="0"    keyCode="KEY_0"     onKey={onKey} />
        <RBtn label="Text" keyCode="KEY_TTX_MIX" onKey={onKey} wide />
      </View>
    </View>
  );
}

const BTN_SIZE = 48;
const BORDER_RADIUS = 10;

const styles = StyleSheet.create({
  container: { gap: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  btn: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: BORDER_RADIUS,
    backgroundColor: Colors.bgBtn,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wideBtn: { width: BTN_SIZE * 1.5 },
  powerBtn: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderColor: Colors.power,
  },
  accentBtn: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  muteBtn: {
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderColor: Colors.warning,
  },
  btnPressed: { opacity: 0.6, transform: [{ scale: 0.92 }] },
  btnText: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '600',
  },
  powerText:  { color: Colors.power },
  accentText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  muteText:   { color: Colors.warning },

  // D-Pad
  dpadWrapper: { alignItems: 'center', gap: 4 },
  dpadRow: { flexDirection: 'row', gap: 4 },

  // Vol/Ch/Media columns
  threeColRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  col: {
    alignItems: 'center',
    gap: 6,
  },
  colLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Numpad
  numpad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
});
