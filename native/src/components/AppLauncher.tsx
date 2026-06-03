import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants';

const APP_LIST = [
  { id: 'netflix',        label: 'Netflix',    icon: 'N',  color: '#e50914' },
  { id: '111299001912',   label: 'YouTube',    icon: '▶',  color: '#ff0000' },
  { id: '3201512006785',  label: 'Prime',      icon: 'P',  color: '#00a8e1' },
  { id: '3201601007250',  label: 'Disney+',    icon: 'D+', color: '#113ccf' },
  { id: '3202012024782',  label: 'Spotify',    icon: '♫',  color: '#1db954' },
  { id: '3201907018807',  label: 'Pluto TV',   icon: '📺', color: '#ef5350' },
];

interface Props {
  onApp: (appId: string) => void;
}

export function AppLauncher({ onApp }: Props) {
  return (
    <View style={styles.grid}>
      {APP_LIST.map(app => (
        <Pressable
          key={app.id}
          style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
          onPress={() => onApp(app.id)}
        >
          <Text style={[styles.icon, { color: app.color }]}>{app.icon}</Text>
          <Text style={styles.label}>{app.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  btn: {
    width: '30%',
    minWidth: 90,
    paddingVertical: 14,
    paddingHorizontal: 8,
    backgroundColor: Colors.bgBtn,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    gap: 6,
  },
  btnPressed: { opacity: 0.65, transform: [{ scale: 0.95 }] },
  icon: {
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 30,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
