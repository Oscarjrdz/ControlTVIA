import { useCallback, useEffect, useRef, useState } from 'react';
import { APP_NAME_B64, APPS, WS_PATH, WS_PORT, type TVStatus } from '../constants';

interface UseSamsungTVReturn {
  status:     TVStatus;
  connect:    (ip: string) => void;
  disconnect: () => void;
  sendKey:    (key: string) => void;
  openApp:    (appId: string) => void;
  lastEvent:  string | null;
}

export function useSamsungTV(): UseSamsungTVReturn {
  const [status, setStatus]       = useState<TVStatus>('disconnected');
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus('disconnected');
  }, []);

  const connect = useCallback((ip: string) => {
    disconnect();
    setStatus('connecting');

    // Desde app nativa podemos usar ws:// directamente — sin restricción HTTPS
    const url = `ws://${ip}:${WS_PORT}${WS_PATH}?name=${APP_NAME_B64}`;
    const ws  = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      setLastEvent('Conectado a la TV ✓');
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data as string);
        if (data.event === 'ms.channel.connect') {
          setLastEvent('Canal listo');
        } else if (data.event === 'ms.channel.unauthorized') {
          setLastEvent('⚠ Acepta el permiso en la TV');
        }
      } catch (_) {}
    };

    ws.onerror = () => {
      setStatus('error');
      setLastEvent('Error — verifica IP y que la TV esté encendida');
    };

    ws.onclose = () => {
      setStatus('disconnected');
      wsRef.current = null;
    };
  }, [disconnect]);

  const send = useCallback((payload: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  const sendKey = useCallback((key: string) => {
    send({
      method: 'ms.remote.control',
      params: {
        Cmd: 'Click',
        DataOfCmd: key,
        Option: 'false',
        TypeOfRemote: 'SendRemoteKey',
      },
    });
  }, [send]);

  const openApp = useCallback((appId: string) => {
    send({
      method: 'ms.channel.emit',
      params: {
        event: 'ed.apps.launch',
        to: 'host',
        data: { appId },
      },
    });
  }, [send]);

  useEffect(() => () => { disconnect(); }, [disconnect]);

  return { status, connect, disconnect, sendKey, openApp, lastEvent };
}
