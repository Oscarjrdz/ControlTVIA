'use strict';

// ──────────────────────────────────────────────────────────
// TV IA Control · Main Application
// Samsung Smart TV WebSocket Remote Control + Web Speech API
// ──────────────────────────────────────────────────────────

const APP_NAME     = 'TV IA Control';
const APP_NAME_B64 = btoa(APP_NAME);
const WS_PORT_WS   = 8001;   // ws://  — solo funciona desde HTTP
const WS_PORT_WSS  = 8002;   // wss:// — funciona desde HTTPS (cert autofirmado)
const WS_PATH      = '/api/v2/channels/samsung.remote.control';
const IS_HTTPS     = location.protocol === 'https:';

// ── Gemini ──────────────────────────────────────────────────
const GEMINI_MODEL    = 'gemini-2.0-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const GEMINI_HISTORY_MAX = 10; // turnos en memoria (5 intercambios)

const SYSTEM_PROMPT = `Eres "Control", asistente de voz integrado en una app para Samsung Smart TV.
Personalidad: amigable, casual, español México. Respuestas cortas y naturales.

REGLA CRÍTICA: responde SOLO con JSON puro sin comillas de código ni explicaciones.
Formato exacto: {"action":"...","value":"...","speak":"...","repeat":1}

Campos:
- action: "key" | "app" | "chat"
- value: nombre de tecla, appId, o null si es chat
- speak: lo que dices en voz al usuario (máximo 12 palabras, casual MX)
- repeat: cuántas veces repetir la acción (default 1, máximo 20)

TECLAS DISPONIBLES (action "key"):
KEY_VOLUP / KEY_VOLDOWN = volumen, KEY_MUTE = silencio/quitar mute
KEY_CHUP / KEY_CHDOWN = canales, KEY_POWER = encender/apagar
KEY_HOME = inicio, KEY_RETURN = atrás, KEY_ENTER = ok/seleccionar
KEY_UP / KEY_DOWN / KEY_LEFT / KEY_RIGHT = navegar
KEY_PLAY / KEY_PAUSE / KEY_REWIND / KEY_FF = reproducción
KEY_1 KEY_2 KEY_3 KEY_4 KEY_5 KEY_6 KEY_7 KEY_8 KEY_9 KEY_0 = números

APPS DISPONIBLES (action "app"):
"netflix" = Netflix
"111299001912" = YouTube
"3201512006785" = Amazon Prime Video
"3201601007250" = Disney+
"3202012024782" = Spotify
"3201907018807" = Pluto TV

EJEMPLOS:
Usuario: "bájale" → {"action":"key","value":"KEY_VOLDOWN","speak":"Le bajo","repeat":1}
Usuario: "más" (después de subir) → {"action":"key","value":"KEY_VOLUP","speak":"Más","repeat":2}
Usuario: "ponme netflix" → {"action":"app","value":"netflix","speak":"Va, Netflix","repeat":1}
Usuario: "sube 5 veces" → {"action":"key","value":"KEY_VOLUP","speak":"Subiendo 5","repeat":5}
Usuario: "qué onda" → {"action":"chat","value":null,"speak":"Aquí ando, ¿qué quieres ver?","repeat":1}
Usuario: "apágala ya" → {"action":"key","value":"KEY_POWER","speak":"Apagando, buenas noches","repeat":1}`;

// Wake word phrases (todas las variaciones que puede reconocer el speech API)
const WAKE_WORDS = [
  'oye control', 'hey control', 'ey control', 'oye controla',
  'oye, control', 'hey, control', 'oi control', 'oye contról',
];

// App IDs for Samsung Tizen TVs
const APPS = {
  netflix:  'netflix',
  youtube:  '111299001912',
  prime:    '3201512006785',
  disney:   '3201601007250',
  spotify:  '3202012024782',
  pluto:    '3201907018807',
};

const APP_LABELS = {
  netflix:          'Netflix',
  '111299001912':   'YouTube',
  '3201512006785':  'Amazon Prime',
  '3201601007250':  'Disney+',
  '3202012024782':  'Spotify',
  '3201907018807':  'Pluto TV',
};

// Voice command map → action descriptor
const VOICE_COMMANDS = [
  // Volume
  { patterns: ['sube el volumen','subir volumen','sube volumen','volumen arriba','más volumen','mas volumen','aumentar volumen','volumen más','volumen mas','sube el audio','subir audio'],
    key: 'KEY_VOLUP', label: 'Volumen +'  },
  { patterns: ['baja el volumen','bajar volumen','baja volumen','volumen abajo','menos volumen','bajar el volumen','volumen menos','baja el audio','bajar audio'],
    key: 'KEY_VOLDOWN', label: 'Volumen -' },
  { patterns: ['silencio','mute','sin sonido','quitar sonido','quita el sonido','mutear','sin audio','quita el audio'],
    key: 'KEY_MUTE', label: 'Mute' },
  // Power
  { patterns: ['apaga','apagar','apaga la tele','apaga la televisión','apaga el televisor'],
    key: 'KEY_POWER', label: 'Power Off' },
  { patterns: ['enciende','encender','enciende la tele','enciende la televisión','power'],
    key: 'KEY_POWER', label: 'Power On' },
  // Navigation
  { patterns: ['canal arriba','siguiente canal','canal siguiente','sube el canal','sube canal','subir canal'],
    key: 'KEY_CHUP', label: 'Canal +'   },
  { patterns: ['canal abajo','canal anterior','baja el canal','baja canal','bajar canal','canal previo','canal atrás'],
    key: 'KEY_CHDOWN', label: 'Canal -' },
  { patterns: ['inicio','home','pantalla de inicio','menú principal','menu principal','pantalla principal'],
    key: 'KEY_HOME', label: 'Home'     },
  { patterns: ['atrás','atras','regresar','volver','back','regresa'],
    key: 'KEY_RETURN', label: 'Atrás'  },
  { patterns: ['ok','seleccionar','enter','aceptar','confirmar'],
    key: 'KEY_ENTER', label: 'OK'      },
  { patterns: ['arriba','ir arriba','mueve arriba'],
    key: 'KEY_UP',   label: '↑'       },
  { patterns: ['abajo','ir abajo','mueve abajo'],
    key: 'KEY_DOWN', label: '↓'       },
  { patterns: ['izquierda','ir a la izquierda','mueve izquierda'],
    key: 'KEY_LEFT', label: '←'       },
  { patterns: ['derecha','ir a la derecha','mueve derecha'],
    key: 'KEY_RIGHT', label: '→'      },
  // Play / Pause / Media
  { patterns: ['pausa','pausar','parar','para','congela'],
    key: 'KEY_PAUSE', label: 'Pausa'  },
  { patterns: ['reproduce','reproducir','play','continúa','continua'],
    key: 'KEY_PLAY',  label: 'Play'   },
  // Apps
  { patterns: ['netflix','net flix'],               app: APPS.netflix, label: 'Netflix'       },
  { patterns: ['youtube','you tube','utube'],        app: APPS.youtube, label: 'YouTube'       },
  { patterns: ['prime','amazon','prime video','amazon prime','amazon vídeo'],
                                                     app: APPS.prime,   label: 'Amazon Prime'  },
  { patterns: ['disney','disney plus','disney+','disney más','disney+'],
                                                     app: APPS.disney,  label: 'Disney+'       },
  { patterns: ['spotify'],                           app: APPS.spotify, label: 'Spotify'       },
];

// ──────────────────────────────────────────────────────────
class TVController {
  constructor() {
    this.ws            = null;
    this.recognition   = null;
    this.isListening   = false;
    this.state         = 'disconnected'; // disconnected | connecting | connected | error
    this.tvIP          = localStorage.getItem('tvIP') || '192.168.0.44';
    this.reconnectTimer = null;
    this.scanActive    = false;

    // Wake word state
    this.wakeMode      = false;
    this.wakeArmed     = false;
    this._wakeRec      = null;
    this._wakeRestart  = null;

    // Gemini / AI state
    this.geminiKey     = localStorage.getItem('geminiKey') || '';
    this._conversation = [];   // historial [{role,parts}]
    this._ttsVoice     = null; // voz TTS preferida

    this._init();
  }

  _init() {
    this._bindUI();
    this._applyTheme(localStorage.getItem('theme') || 'dark');
    this._setupSpeech();
    this._pickTTSVoice();
    this._syncAIBadge();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  // ────── UI binding ──────────────────────────────────────

  _bindUI() {
    const $ = id => document.getElementById(id);
    const $$ = sel => document.querySelectorAll(sel);

    // Colapso de la tarjeta de conexión
    this._connExpanded = true;
    $('connToggle').addEventListener('click', () => this._toggleConnCard());

    // IP / connect
    $('tvIP').value = this.tvIP;
    $('connectBtn').addEventListener('click', () => this._toggleConnection());
    $('tvIP').addEventListener('keydown', e => { if (e.key === 'Enter') this._toggleConnection(); });

    // HTTPS banner / cert button
    this._setupHTTPSBanner();

    // Manos libres toggle
    $('wakeToggle').addEventListener('click', () => this._toggleWakeMode());

    // Scan
    $('scanBtn').addEventListener('click', () => this._scanNetwork());

    // Mic
    $('micBtn').addEventListener('click', () => this._toggleListening());

    // Remote keys
    $$('[data-key]').forEach(btn =>
      btn.addEventListener('click', () => this.sendKey(btn.dataset.key)));

    // App launchers
    $$('[data-app]').forEach(btn =>
      btn.addEventListener('click', () => this.openApp(btn.dataset.app)));

    // Settings modal
    $('settingsBtn').addEventListener('click', () => this._openSettings());
    $('settingsClose').addEventListener('click', () => this._closeSettings());
    $('settingsOverlay').addEventListener('click', () => this._closeSettings());
    $('saveSettings').addEventListener('click', () => this._saveSettings());
    $('clearConversation').addEventListener('click', () => {
      this._conversation = [];
      this._log('Conversación reiniciada', 'info');
      this._closeSettings();
    });
    $('keyShowBtn').addEventListener('click', () => {
      const inp = $('geminiKeyInput');
      if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
    });

    // Theme toggle
    $('themeToggle').addEventListener('click', () => {
      this._applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });

    // Clear log
    $('clearLog').addEventListener('click', () => this._clearLog());
  }

  // ────── Theme ───────────────────────────────────────────

  _applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    const meta = document.getElementById('themeColorMeta');
    if (meta) meta.content = theme === 'dark' ? '#0f0f1a' : '#f4f4f8';
  }

  // ────── HTTPS mixed-content banner ──────────────────────

  _setupHTTPSBanner() {
    if (!IS_HTTPS) return;

    // Muestra el bloque de certificado dentro de la tarjeta de Conexión
    const block = document.getElementById('certBlock');
    if (block) block.classList.remove('hidden');

    const certBtn = document.getElementById('certBtn');
    if (certBtn) {
      certBtn.addEventListener('click', () => {
        const ip = document.getElementById('tvIP').value.trim() || this.tvIP;

        // Actualiza el texto del paso con la IP real
        const subSteps = document.querySelector('.cert-sub-steps');
        if (subSteps) {
          subSteps.innerHTML = `En la nueva pestaña: toca <strong>Configuración avanzada</strong> → <strong>"Ir a ${ip} (no seguro)"</strong> → cierra la pestaña → regresa aquí y toca Conectar.`;
        }

        const certWin = window.open(`https://${ip}:${WS_PORT_WSS}`, '_blank');

        // Al cerrar la pestaña → marcar como completado
        const check = setInterval(() => {
          if (certWin && certWin.closed) {
            clearInterval(check);
            certBtn.innerHTML = '✓ Certificado aceptado';
            certBtn.style.background = 'var(--success)';
            certBtn.style.cursor = 'default';
            const done = document.getElementById('certDone');
            if (done) done.classList.remove('hidden');
          }
        }, 500);
      });
    }
  }

  _buildWsUrl(ip) {
    if (IS_HTTPS) {
      // HTTPS page → must use wss:// (port 8002, Samsung SSL WebSocket)
      return `wss://${ip}:${WS_PORT_WSS}${WS_PATH}?name=${APP_NAME_B64}`;
    }
    return `ws://${ip}:${WS_PORT_WS}${WS_PATH}?name=${APP_NAME_B64}`;
  }

  // ────── WebSocket connection ────────────────────────────

  _toggleConnection() {
    if (this.state === 'connected') {
      this._disconnect();
    } else {
      this._connect();
    }
  }

  _connect() {
    const ip = document.getElementById('tvIP').value.trim();
    if (!ip) { this._toast('Ingresa la IP de tu TV'); return; }

    this.tvIP = ip;
    localStorage.setItem('tvIP', ip);

    if (this.ws) { this.ws.onclose = null; this.ws.close(); this.ws = null; }
    clearTimeout(this.reconnectTimer);

    this._setState('connecting');
    const url = this._buildWsUrl(ip);
    const proto = IS_HTTPS ? 'wss (puerto 8002)' : 'ws (puerto 8001)';
    this._log('Conectando a ' + ip + ' vía ' + proto + '…', 'info');

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this._setState('connected');
        this._log('Conectado a la TV ✓', 'success');
        const btn = document.getElementById('connectBtn');
        if (btn) { btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Desconectar'; }
      };

      this.ws.onmessage = ev => {
        try { this._handleMessage(JSON.parse(ev.data)); } catch (_) {}
      };

      this.ws.onerror = () => {
        this._setState('error');
        if (IS_HTTPS) {
          this._log('Error wss:// (puerto 8002) — sigue el Método A del banner amarillo arriba', 'error');
          this._log('→ Toca "Abrir certificado de la TV", acepta la advertencia, regresa y conecta', 'warning');
          // Scroll al banner
          const banner = document.getElementById('httpsBanner');
          if (banner) banner.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          this._log('Error ws:// — verifica: ① IP correcta ② TV encendida ③ misma red WiFi', 'error');
        }
      };

      this.ws.onclose = () => {
        const wasConnected = this.state === 'connected';
        this._setState('disconnected');
        this._resetConnectBtn();
        if (wasConnected) this._log('Conexión cerrada', 'warning');
      };

    } catch (e) {
      this._setState('error');
      this._log('Error: ' + e.message, 'error');
    }
  }

  _disconnect() {
    if (this.ws) { this.ws.onclose = null; this.ws.close(); this.ws = null; }
    this._setState('disconnected');
    this._resetConnectBtn();
    this._log('Desconectado', 'warning');
  }

  _resetConnectBtn() {
    const btn = document.getElementById('connectBtn');
    if (btn) btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> Conectar';
  }

  _handleMessage(data) {
    const ev = data.event;
    if (ev === 'ms.channel.connect') {
      this._log('Canal de control listo', 'success');
    } else if (ev === 'ms.channel.unauthorized') {
      this._log('⚠ Acepta el permiso que aparece en la TV', 'warning');
      this._toast('Acepta la autorización en la pantalla de tu TV');
    } else if (ev === 'ms.channel.ready') {
      this._log('TV lista para recibir comandos', 'success');
    }
  }

  // ────── Send commands ────────────────────────────────────

  sendKey(key) {
    if (!this._assertConnected()) return;
    this._send({
      method: 'ms.remote.control',
      params: {
        Cmd: 'Click',
        DataOfCmd: key,
        Option: 'false',
        TypeOfRemote: 'SendRemoteKey',
      },
    });
    this._log(key, 'command');
    this._ripple(`[data-key="${key}"]`);
  }

  openApp(appId) {
    if (!this._assertConnected()) return;
    this._send({
      method: 'ms.channel.emit',
      params: {
        event: 'ed.apps.launch',
        to: 'host',
        data: { appId },
      },
    });
    const name = APP_LABELS[appId] || appId;
    this._log('Abriendo ' + name, 'command');
    this._ripple(`[data-app="${appId}"]`);
  }

  _send(payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  _assertConnected() {
    if (this.state !== 'connected') {
      this._toast('No conectado — toca Conectar primero');
      return false;
    }
    return true;
  }

  // ────── Conexión card colapso ────────────────────────────

  _toggleConnCard(forceExpand) {
    this._connExpanded = forceExpand !== undefined ? forceExpand : !this._connExpanded;
    const body    = document.getElementById('connBody');
    const chevron = document.getElementById('connChevron');
    const toggle  = document.getElementById('connToggle');
    if (!body) return;
    body.classList.toggle('collapsed', !this._connExpanded);
    if (chevron) chevron.style.transform = this._connExpanded ? 'rotate(0deg)' : 'rotate(-90deg)';
    if (toggle)  toggle.setAttribute('aria-expanded', String(this._connExpanded));
  }

  // ────── Status ───────────────────────────────────────────

  _setState(state) {
    this.state = state;
    const labels = {
      connecting:   'Conectando…',
      connected:    'Conectado',
      disconnected: 'Desconectado',
      error:        'Error',
    };
    const label = labels[state] || state;

    // Header del app
    const dot  = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    if (dot)  dot.setAttribute('data-state', state);
    if (text) text.textContent = label;

    // Pill dentro de la tarjeta de conexión
    const pillDot  = document.getElementById('connPillDot');
    const pillText = document.getElementById('connPillText');
    if (pillDot)  pillDot.setAttribute('data-state', state);
    if (pillText) pillText.textContent = label;

    const card = document.getElementById('connectionCard');
    if (card) card.setAttribute('data-conn-state', state);

    // Auto-colapsar al conectar; auto-expandir al desconectar/error
    if (state === 'connected') {
      this._toggleConnCard(false);
    } else if (state === 'disconnected' || state === 'error') {
      this._toggleConnCard(true);
    }
  }

  // ────── Speech Recognition ───────────────────────────────

  _setupSpeech() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      const btn = document.getElementById('micBtn');
      if (btn) { btn.disabled = true; btn.title = 'Web Speech API no disponible en este navegador'; }
      document.getElementById('voiceStatus').textContent = 'Voz no disponible (usa Chrome/Edge)';
      return;
    }

    this.recognition = new SR();
    this.recognition.lang              = 'es-MX';
    this.recognition.continuous        = false;
    this.recognition.interimResults    = true;
    this.recognition.maxAlternatives   = 3;

    this.recognition.onstart = () => {
      this.isListening = true;
      document.getElementById('micBtn').classList.add('listening');
      document.getElementById('micBtn').setAttribute('aria-pressed', 'true');
      document.getElementById('voiceStatus').textContent = 'Escuchando…';
      document.getElementById('voiceTranscript').textContent = '';
    };

    this.recognition.onresult = ev => {
      const result     = ev.results[ev.resultIndex];
      const transcript = result[0].transcript.toLowerCase().trim();
      document.getElementById('voiceTranscript').textContent = '"' + transcript + '"';
      if (result.isFinal) this._processVoice(transcript);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      const btn = document.getElementById('micBtn');
      btn.classList.remove('listening');
      btn.setAttribute('aria-pressed', 'false');
      const statusEl = document.getElementById('voiceStatus');
      if (statusEl.textContent === 'Escuchando…') {
        statusEl.textContent = 'Toca para hablar';
      }
    };

    this.recognition.onerror = ev => {
      this.isListening = false;
      document.getElementById('micBtn').classList.remove('listening');
      document.getElementById('micBtn').setAttribute('aria-pressed', 'false');
      if (ev.error === 'not-allowed') {
        this._toast('Permite el micrófono en los ajustes del navegador');
        document.getElementById('voiceStatus').textContent = 'Micrófono bloqueado';
      } else if (ev.error !== 'no-speech') {
        document.getElementById('voiceStatus').textContent = 'Toca para hablar';
      }
    };
  }

  _toggleListening() {
    if (!this.recognition) return;
    if (this.isListening) {
      this.recognition.stop();
    } else {
      try { this.recognition.start(); } catch (_) {}
    }
  }

  _processVoice(transcript) {
    this._log('🎤 "' + transcript + '"', 'voice');

    if (this.geminiKey) {
      this._askGemini(transcript);
      return;
    }

    // Fallback: pattern matching clásico
    for (const cmd of VOICE_COMMANDS) {
      for (const pattern of cmd.patterns) {
        if (transcript.includes(pattern)) {
          if (cmd.key) {
            this.sendKey(cmd.key);
            document.getElementById('voiceStatus').textContent = '✓ ' + cmd.label;
          } else if (cmd.app) {
            this.openApp(cmd.app);
            document.getElementById('voiceStatus').textContent = '✓ ' + cmd.label;
          }
          document.getElementById('voiceTranscript').textContent = '';
          return;
        }
      }
    }

    this._log('No reconocí: "' + transcript + '"', 'warning');
    document.getElementById('voiceStatus').textContent = '¿No entendí? Intenta de nuevo';
    this._toast('No entendí el comando');
  }

  // ────── Gemini AI ────────────────────────────────────────

  async _askGemini(transcript) {
    const statusEl    = document.getElementById('voiceStatus');
    const transcriptEl = document.getElementById('voiceTranscript');
    if (statusEl) statusEl.textContent = '✨ Pensando…';

    // Agregar turno del usuario al historial
    this._conversation.push({ role: 'user', parts: [{ text: transcript }] });
    if (this._conversation.length > GEMINI_HISTORY_MAX) {
      this._conversation.splice(0, 2); // eliminar el par más antiguo
    }

    const body = {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: this._conversation,
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 200,
        responseMimeType: 'application/json',
      },
    };

    try {
      const res = await fetch(`${GEMINI_ENDPOINT}?key=${this.geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!rawText) throw new Error('Respuesta vacía de Gemini');

      // Guardar respuesta del modelo en historial
      this._conversation.push({ role: 'model', parts: [{ text: rawText }] });

      let result;
      try { result = JSON.parse(rawText); } catch (_) {
        throw new Error('JSON inválido: ' + rawText.slice(0, 80));
      }

      this._executeAIAction(result, transcript);

    } catch (e) {
      this._log('Gemini error: ' + e.message, 'error');
      if (statusEl) statusEl.textContent = 'Error AI — intenta de nuevo';
      // Quitar el turno del usuario si falló para no contaminar el historial
      this._conversation.pop();
    }
  }

  _executeAIAction(result, originalTranscript) {
    const { action, value, speak, repeat = 1 } = result;
    const statusEl = document.getElementById('voiceStatus');
    const transcriptEl = document.getElementById('voiceTranscript');

    // Mostrar lo que respondió la IA
    if (speak) {
      if (transcriptEl) transcriptEl.textContent = '✨ ' + speak;
      setTimeout(() => { if (transcriptEl) transcriptEl.textContent = ''; }, 4000);
    }
    if (statusEl) statusEl.textContent = action === 'chat' ? '💬 ' + (speak || '') : '✓ Ejecutado';

    // Hablar en voz
    if (speak) this._speak(speak);

    // Ejecutar acción en la TV
    const times = Math.min(Math.max(parseInt(repeat) || 1, 1), 20);
    if (action === 'key' && value) {
      this._log(`✨ AI → ${value} × ${times}`, 'command');
      for (let i = 0; i < times; i++) {
        setTimeout(() => this.sendKey(value), i * 280);
      }
    } else if (action === 'app' && value) {
      this._log(`✨ AI → app: ${APP_LABELS[value] || value}`, 'command');
      this.openApp(value);
    } else if (action === 'chat') {
      this._log(`✨ AI → "${speak}"`, 'voice');
    }
  }

  // ────── Text-to-Speech ───────────────────────────────────

  _pickTTSVoice() {
    const pick = () => {
      const voices = speechSynthesis.getVoices();
      const priority = [
        v => v.lang === 'es-MX' && v.localService,
        v => v.lang === 'es-MX',
        v => v.lang.startsWith('es') && v.localService,
        v => v.lang.startsWith('es'),
      ];
      for (const test of priority) {
        const found = voices.find(test);
        if (found) { this._ttsVoice = found; return; }
      }
    };
    pick();
    speechSynthesis.addEventListener('voiceschanged', pick, { once: true });
  }

  _speak(text) {
    if (!window.speechSynthesis || !text) return;
    speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang  = 'es-MX';
    utt.rate  = 1.05;
    utt.pitch = 1.0;
    if (this._ttsVoice) utt.voice = this._ttsVoice;
    speechSynthesis.speak(utt);
  }

  // ────── Settings modal ───────────────────────────────────

  _openSettings() {
    const modal = document.getElementById('settingsModal');
    const input = document.getElementById('geminiKeyInput');
    if (input) input.value = this.geminiKey;
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('open');
    }
  }

  _closeSettings() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
      modal.classList.remove('open');
      setTimeout(() => modal.classList.add('hidden'), 280);
    }
  }

  _saveSettings() {
    const input = document.getElementById('geminiKeyInput');
    const key = input ? input.value.trim() : '';
    this.geminiKey = key;
    localStorage.setItem('geminiKey', key);
    this._conversation = []; // limpiar historial al cambiar key
    this._syncAIBadge();
    this._closeSettings();
    if (key) {
      this._log('✨ Gemini activado — modo conversación', 'success');
      this._toast('¡Gemini listo! Habla con normalidad');
    } else {
      this._log('Gemini desactivado — modo comandos clásicos', 'info');
    }
  }

  _syncAIBadge() {
    const badge = document.getElementById('aiBadge');
    if (!badge) return;
    badge.classList.toggle('hidden', !this.geminiKey);
  }

  // ────── Wake word mode ───────────────────────────────────

  _toggleWakeMode() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { this._toast('Web Speech API no disponible en este navegador'); return; }

    this.wakeMode = !this.wakeMode;
    const btn = document.getElementById('wakeToggle');
    if (btn) btn.setAttribute('aria-pressed', String(this.wakeMode));

    if (this.wakeMode) {
      this._buildWakeRecognition();
      this._startWakeRec();
      this._setWakeUI('listening');
      this._log('🎙 Manos libres activo — di "Oye Control…"', 'voice');
    } else {
      this._stopWakeRec();
      this._setWakeUI('off');
      this._log('Manos libres desactivado', 'info');
    }
  }

  _buildWakeRecognition() {
    if (this._wakeRec) return; // ya construida
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang            = 'es-MX';
    rec.continuous      = true;
    rec.interimResults  = true;
    rec.maxAlternatives = 2;

    rec.onresult = ev => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const result     = ev.results[i];
        const transcript = result[0].transcript.toLowerCase().trim();

        // Mostrar lo que se oye en tiempo real
        const transcriptEl = document.getElementById('voiceTranscript');
        if (transcriptEl && this.wakeArmed) transcriptEl.textContent = '"' + transcript + '"';

        const foundWake = WAKE_WORDS.some(w => transcript.includes(w));

        if (!this.wakeArmed) {
          if (foundWake) {
            this.wakeArmed = true;
            this._onWakeDetected(transcript);
          }
        } else if (result.isFinal) {
          // Estamos armados: este resultado final es el comando
          let cmd = transcript;
          WAKE_WORDS.forEach(w => { cmd = cmd.replace(w, '').trim(); });

          if (cmd.length > 1) {
            this._processVoice(cmd);
            this.wakeArmed = false;
            setTimeout(() => {
              if (this.wakeMode) this._setWakeUI('listening');
            }, 1500);
          }
          // Si cmd vacío (solo dijo el wake word), seguir armado esperando el comando
        }
      }
    };

    rec.onend = () => {
      if (!this.wakeMode) return;
      // Auto-reinicio para mantener el micrófono siempre activo
      clearTimeout(this._wakeRestart);
      this._wakeRestart = setTimeout(() => this._startWakeRec(), 200);
    };

    rec.onerror = ev => {
      if (ev.error === 'not-allowed') {
        this.wakeMode = false;
        const btn = document.getElementById('wakeToggle');
        if (btn) btn.setAttribute('aria-pressed', 'false');
        this._setWakeUI('off');
        this._toast('Permite el micrófono en Chrome para usar manos libres');
        return;
      }
      if (ev.error === 'aborted') return;
      // Reintentar en otros errores
      if (this.wakeMode) {
        clearTimeout(this._wakeRestart);
        this._wakeRestart = setTimeout(() => this._startWakeRec(), 400);
      }
    };

    this._wakeRec = rec;
  }

  _startWakeRec() {
    if (!this._wakeRec || !this.wakeMode) return;
    try { this._wakeRec.start(); } catch (_) {}
  }

  _stopWakeRec() {
    clearTimeout(this._wakeRestart);
    this.wakeArmed = false;
    if (!this._wakeRec) return;
    try { this._wakeRec.stop(); } catch (_) {}
  }

  _onWakeDetected(fullTranscript) {
    // Vibración corta de confirmación
    if (navigator.vibrate) navigator.vibrate([40, 30, 40]);

    this._setWakeUI('armed');
    this._log('🎙 "Oye Control" — esperando comando…', 'voice');

    // Si el comando vino en la misma frase: "oye control sube el volumen"
    let inline = fullTranscript;
    WAKE_WORDS.forEach(w => { inline = inline.replace(w, '').trim(); });
    if (inline.length > 2) {
      setTimeout(() => {
        this._processVoice(inline);
        this.wakeArmed = false;
        if (this.wakeMode) this._setWakeUI('listening');
      }, 300);
    }
  }

  _setWakeUI(state) {
    // state: 'off' | 'listening' | 'armed'
    const bar       = document.getElementById('wakeBar');
    const orb       = document.getElementById('wakeOrb');
    const barText   = document.getElementById('wakeBarText');
    const micBtn    = document.getElementById('micBtn');
    const voiceStat = document.getElementById('voiceStatus');
    const transcript = document.getElementById('voiceTranscript');

    if (!bar) return;

    if (state === 'off') {
      bar.classList.add('hidden');
      if (orb) orb.setAttribute('data-state', 'off');
      if (transcript) transcript.textContent = '';

    } else if (state === 'listening') {
      bar.classList.remove('hidden');
      if (orb) orb.setAttribute('data-state', 'listening');
      if (barText) barText.innerHTML = 'Di <strong>"Oye Control"</strong> seguido del comando';
      if (voiceStat) voiceStat.textContent = 'Manos libres activo';
      if (transcript) transcript.textContent = '';
      // Micrófono en modo espera (no pulsing)
      if (micBtn) micBtn.classList.remove('listening');

    } else if (state === 'armed') {
      bar.classList.remove('hidden');
      if (orb) orb.setAttribute('data-state', 'armed');
      if (barText) barText.innerHTML = '🎤 <strong>Di tu comando…</strong>';
      if (voiceStat) voiceStat.textContent = 'Escuchando comando…';
      // Activar animación del mic grande
      if (micBtn) micBtn.classList.add('listening');
    }
  }

  // ────── Network scanner ──────────────────────────────────

  async _scanNetwork() {
    if (this.scanActive) return;
    this.scanActive = true;

    const btn     = document.getElementById('scanBtn');
    const results = document.getElementById('scanResults');
    btn.style.opacity = '.4';
    results.classList.remove('hidden');
    results.innerHTML = '<span style="font-size:12px;color:var(--text-muted)">Buscando TVs Samsung en la red…</span>';

    // Derive base from current IP or fallback
    const base = this._getNetworkBase();
    const found = [];
    const pending = [];

    for (let i = 1; i <= 254; i++) {
      const ip = base + i;
      pending.push(this._probeTV(ip).then(ok => { if (ok) found.push(ip); }));
    }

    await Promise.allSettled(pending);

    if (found.length === 0) {
      results.innerHTML = '<span style="font-size:12px;color:var(--warning)">No se encontraron TVs Samsung en la red ' + base + '0/24</span>';
    } else {
      results.innerHTML = '';
      found.forEach(ip => {
        const b = document.createElement('button');
        b.className = 'scan-ip-btn';
        b.textContent = '📺 ' + ip;
        b.addEventListener('click', () => {
          document.getElementById('tvIP').value = ip;
          this._connect();
          results.classList.add('hidden');
        });
        results.appendChild(b);
      });
    }

    btn.style.opacity = '1';
    this.scanActive = false;
  }

  _probeTV(ip) {
    return new Promise(resolve => {
      const timeout = 800;
      let ws;
      const timer = setTimeout(() => {
        try { ws && ws.close(); } catch (_) {}
        resolve(false);
      }, timeout);

      try {
        ws = new WebSocket(this._buildWsUrl(ip));
        ws.onopen  = () => { clearTimeout(timer); ws.close(); resolve(true); };
        ws.onerror = () => { clearTimeout(timer); resolve(false); };
      } catch (_) {
        clearTimeout(timer);
        resolve(false);
      }
    });
  }

  _getNetworkBase() {
    const stored = localStorage.getItem('tvIP') || '192.168.0.44';
    const parts  = stored.split('.');
    if (parts.length === 4) return parts.slice(0, 3).join('.') + '.';
    return '192.168.0.';
  }

  // ────── Log ──────────────────────────────────────────────

  _log(message, type = 'info') {
    const container = document.getElementById('commandLog');
    const empty     = container.querySelector('.log-empty');
    if (empty) empty.remove();

    const now  = new Date();
    const time = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const entry = document.createElement('div');
    entry.className = 'log-entry ' + type;
    entry.innerHTML =
      '<span class="log-time">' + time + '</span>' +
      '<span class="log-msg">' + this._escapeHtml(message) + '</span>';

    container.insertBefore(entry, container.firstChild);

    // Keep last 60 entries
    while (container.children.length > 60) container.removeChild(container.lastChild);
  }

  _clearLog() {
    document.getElementById('commandLog').innerHTML =
      '<p class="log-empty">Los comandos enviados aparecerán aquí</p>';
  }

  // ────── Helpers ──────────────────────────────────────────

  _ripple(selector) {
    const el = document.querySelector(selector);
    if (!el) return;
    el.classList.add('pressed');
    setTimeout(() => el.classList.remove('pressed'), 200);
  }

  _toast(msg, duration = 2500) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), duration);
  }

  _escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

// ────── Boot ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  window.tv = new TVController();
});
