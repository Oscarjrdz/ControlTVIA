// ── Samsung TV ──────────────────────────────────────────────
export const WS_PORT = 8001;
export const WS_PATH = '/api/v2/channels/samsung.remote.control';
export const APP_NAME = 'TV IA Control';
export const APP_NAME_B64 = btoa(APP_NAME);

// ── Apps ────────────────────────────────────────────────────
export const APPS: Record<string, string> = {
  netflix:          'Netflix',
  '111299001912':   'YouTube',
  '3201512006785':  'Prime Video',
  '3201601007250':  'Disney+',
  '3202012024782':  'Spotify',
  '3201907018807':  'Pluto TV',
};

export type AppId = keyof typeof APPS;

// ── Gemini ──────────────────────────────────────────────────
export const GEMINI_MODEL    = 'gemini-2.0-flash';
export const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
export const GEMINI_HISTORY_MAX = 10;

export function buildSystemPrompt(userName: string): string {
  const name = userName || 'jefe';
  return `Eres "Control", asistente de voz para Samsung Smart TV de ${name}.
Personalidad: amigable, casual, español México. Usas el nombre "${name}" de forma natural.

REGLA CRÍTICA: responde SIEMPRE con JSON puro sin markdown.
Formato: {"action":"...","value":"...","speak":"...","repeat":1}

- action: "key" | "app" | "chat" | "unknown"
- value: nombre de tecla, appId de app, o null
- speak: lo que dices en voz (máximo 12 palabras, casual MX, con el nombre "${name}")
- repeat: veces a repetir la acción (1-20, default 1)

USA "unknown" cuando no entiendes — speak debe pedir que repitan.
NUNCA dejes speak vacío.

TECLAS (action "key"):
KEY_VOLUP / KEY_VOLDOWN = volumen
KEY_MUTE = silencio / quitar mute
KEY_CHUP / KEY_CHDOWN = canales
KEY_POWER = encender/apagar TV
KEY_HOME = pantalla inicio
KEY_RETURN = atrás / regresar
KEY_ENTER = ok / seleccionar
KEY_UP / KEY_DOWN / KEY_LEFT / KEY_RIGHT = navegar
KEY_PLAY / KEY_PAUSE = reproducir / pausar
KEY_REWIND / KEY_FF = retroceder / adelantar
KEY_1 KEY_2 KEY_3 KEY_4 KEY_5 KEY_6 KEY_7 KEY_8 KEY_9 KEY_0 = números

APPS (action "app"):
"netflix" = Netflix
"111299001912" = YouTube
"3201512006785" = Amazon Prime Video
"3201601007250" = Disney+
"3202012024782" = Spotify
"3201907018807" = Pluto TV

EJEMPLOS:
"bájale" → {"action":"key","value":"KEY_VOLDOWN","speak":"Listo ${name}, le bajo","repeat":1}
"ponme netflix" → {"action":"app","value":"netflix","speak":"Va ${name}, abriendo Netflix","repeat":1}
"sube 5 veces" → {"action":"key","value":"KEY_VOLUP","speak":"Subiendo 5 ${name}","repeat":5}
"apágala" → {"action":"key","value":"KEY_POWER","speak":"Buenas noches ${name}","repeat":1}
"qué onda" → {"action":"chat","value":null,"speak":"Aquí ando ${name}, ¿qué necesitas?","repeat":1}
"xyz abc" → {"action":"unknown","value":null,"speak":"No te entendí ${name}, ¿me repites?","repeat":1}`;
}

// ── Colors ──────────────────────────────────────────────────
export const Colors = {
  bg:            '#0f0f1a',
  bgCard:        'rgba(255,255,255,0.05)',
  bgCardHover:   'rgba(255,255,255,0.08)',
  bgInput:       'rgba(255,255,255,0.07)',
  bgBtn:         'rgba(255,255,255,0.10)',
  border:        'rgba(255,255,255,0.10)',
  text:          '#f0f0f5',
  textSecondary: 'rgba(240,240,245,0.55)',
  textMuted:     'rgba(240,240,245,0.35)',
  accent:        '#6366f1',
  accentGlow:    'rgba(99,102,241,0.35)',
  mic:           '#ec4899',
  micGlow:       'rgba(236,72,153,0.4)',
  success:       '#22c55e',
  warning:       '#f59e0b',
  error:         '#ef4444',
  power:         '#ef4444',
};

// ── Types ───────────────────────────────────────────────────
export type TVStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface AIResponse {
  action: 'key' | 'app' | 'chat' | 'unknown';
  value:  string | null;
  speak:  string;
  repeat: number;
}

export interface LogEntry {
  id:      string;
  time:    string;
  message: string;
  type:    'info' | 'success' | 'error' | 'warning' | 'command' | 'voice';
}
