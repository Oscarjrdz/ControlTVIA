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

    this._init();
  }

  _init() {
    this._bindUI();
    this._applyTheme(localStorage.getItem('theme') || 'dark');
    this._setupSpeech();

    // PWA service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  // ────── UI binding ──────────────────────────────────────

  _bindUI() {
    const $ = id => document.getElementById(id);
    const $$ = sel => document.querySelectorAll(sel);

    // IP / connect
    $('tvIP').value = this.tvIP;
    $('connectBtn').addEventListener('click', () => this._toggleConnection());
    $('tvIP').addEventListener('keydown', e => { if (e.key === 'Enter') this._toggleConnection(); });

    // HTTPS banner / cert button
    this._setupHTTPSBanner();

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
    const banner = document.getElementById('httpsBanner');
    if (banner) banner.classList.remove('hidden');

    const certBtn = document.getElementById('certBtn');
    if (certBtn) {
      certBtn.addEventListener('click', () => {
        const ip = document.getElementById('tvIP').value.trim() || this.tvIP;
        // Open the TV's self-signed cert page so the user can accept it
        window.open(`https://${ip}:${WS_PORT_WSS}`, '_blank');
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
          this._log('Error wss:// — primero toca "Aceptar certificado" arriba y luego vuelve a conectar', 'error');
          this._toast('Toca "Aceptar certificado" en el banner de arriba');
        } else {
          this._log('Error al conectar — verifica que la IP sea correcta y la TV esté encendida', 'error');
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

  // ────── Status ───────────────────────────────────────────

  _setState(state) {
    this.state = state;
    const dot  = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    const labels = {
      connecting:   'Conectando…',
      connected:    'Conectado',
      disconnected: 'Desconectado',
      error:        'Error de conexión',
    };
    if (dot)  dot.setAttribute('data-state', state);
    if (text) text.textContent = labels[state] || state;
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
