import { useCallback, useRef, useState } from 'react';
import {
  APPS,
  GEMINI_ENDPOINT,
  GEMINI_HISTORY_MAX,
  buildSystemPrompt,
  type AIResponse,
} from '../constants';

interface UseGeminiOptions {
  apiKey:   string;
  userName: string;
}

interface UseGeminiReturn {
  ask:       (audio: { base64: string; mimeType: string }) => Promise<AIResponse | null>;
  isLoading: boolean;
  clearHistory: () => void;
}

type ConvTurn = { role: 'user' | 'model'; parts: { text: string }[] };

export function useGemini({ apiKey, userName }: UseGeminiOptions): UseGeminiReturn {
  const [isLoading, setIsLoading]     = useState(false);
  const historyRef = useRef<ConvTurn[]>([]);

  const ask = useCallback(async (audio: { base64: string; mimeType: string }): Promise<AIResponse | null> => {
    if (!apiKey) return null;
    setIsLoading(true);

    // Contenido actual: audio del usuario
    const userContent = {
      role: 'user' as const,
      parts: [
        { inlineData: { mimeType: audio.mimeType, data: audio.base64 } },
      ],
    };

    // Historial previo (solo texto) + turno actual con audio
    const contents = [...historyRef.current, userContent];

    const body = {
      system_instruction: { parts: [{ text: buildSystemPrompt(userName) }] },
      contents,
      generationConfig: {
        temperature:      0.8,
        maxOutputTokens:  200,
        responseMimeType: 'application/json',
      },
    };

    try {
      const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
        throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
      }

      const data = await res.json() as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
      if (!rawText) throw new Error('Respuesta vacía');

      const result = JSON.parse(rawText) as AIResponse;

      // Guardar solo el texto en el historial (no el audio — es costoso)
      const transcript = `[voz] → ${result.speak}`;
      historyRef.current.push({ role: 'user',  parts: [{ text: transcript }] });
      historyRef.current.push({ role: 'model', parts: [{ text: rawText }] });
      if (historyRef.current.length > GEMINI_HISTORY_MAX) {
        historyRef.current.splice(0, 2);
      }

      return result;
    } catch (e) {
      console.error('Gemini error:', e);
      return {
        action: 'unknown',
        value:  null,
        speak:  `Hubo un error ${userName}, intenta de nuevo`,
        repeat: 1,
      };
    } finally {
      setIsLoading(false);
    }
  }, [apiKey, userName]);

  const clearHistory = useCallback(() => {
    historyRef.current = [];
  }, []);

  return { ask, isLoading, clearHistory };
}
