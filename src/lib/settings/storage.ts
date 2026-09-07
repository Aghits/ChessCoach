export type ProviderType = 'gemini' | 'groq' | 'openrouter' | 'custom';

export interface AppSettings {
  provider: ProviderType;
  apiKey: string;
  model: string;
  customBaseUrl?: string;
}

export const PROVIDER_DEFAULTS: Record<ProviderType, { name: string; defaultModel: string; baseUrl: string; helpUrl: string }> = {
  gemini: {
    name: 'Google Gemini (Free AI Studio)',
    defaultModel: 'gemini-2.5-flash',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    helpUrl: 'https://aistudio.google.com/app/apikey',
  },
  groq: {
    name: 'Groq Cloud (Free Tier)',
    defaultModel: 'llama-3.3-70b-versatile',
    baseUrl: 'https://api.groq.com/openai/v1',
    helpUrl: 'https://console.groq.com/keys',
  },
  openrouter: {
    name: 'OpenRouter (Free Models)',
    defaultModel: 'openrouter/free',
    baseUrl: 'https://openrouter.ai/api/v1',
    helpUrl: 'https://openrouter.ai/keys',
  },
  custom: {
    name: 'Custom OpenAI-Compatible',
    defaultModel: 'gpt-4o-mini',
    baseUrl: 'https://api.openai.com/v1',
    helpUrl: '',
  },
};

const STORAGE_KEY = 'chess_coach_settings_v1';

export function loadSettings(): AppSettings {
  const envKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AI_API_KEY) || '';
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        provider: 'openrouter',
        apiKey: envKey,
        model: 'openrouter/free',
      };
    }
    const parsed = JSON.parse(raw);
    let model = parsed.model;
    // Auto-heal decommissioned OpenRouter experimental model
    if (!model || model === 'google/gemini-2.0-flash-exp:free') {
      model = 'openrouter/free';
    }

    const key = parsed.apiKey || envKey;
    let provider = parsed.provider || 'openrouter';

    // Auto-align provider based on key format
    if (key.startsWith('sk-or-')) {
      provider = 'openrouter';
    } else if (key.startsWith('AIzaSy')) {
      provider = 'gemini';
    } else if (key.startsWith('gsk_')) {
      provider = 'groq';
    }

    return {
      provider,
      apiKey: key,
      model,
      customBaseUrl: parsed.customBaseUrl || '',
    };
  } catch {
    return {
      provider: 'openrouter',
      apiKey: envKey,
      model: 'openrouter/free',
    };
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to persist settings to localStorage:', err);
  }
}
