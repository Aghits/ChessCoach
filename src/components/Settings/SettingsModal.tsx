import React, { useState } from 'react';
import { AppSettings, PROVIDER_DEFAULTS, ProviderType } from '../../lib/settings/storage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (newSettings: AppSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [provider, setProvider] = useState<ProviderType>(settings.provider);
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [model, setModel] = useState(settings.model);
  const [customBaseUrl, setCustomBaseUrl] = useState(settings.customBaseUrl || '');
  const [showKey, setShowKey] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleProviderChange = (newProvider: ProviderType) => {
    setProvider(newProvider);
    setModel(PROVIDER_DEFAULTS[newProvider].defaultModel);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      provider,
      apiKey: apiKey.trim(),
      model: model.trim(),
      customBaseUrl: customBaseUrl.trim(),
    });
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-900 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-5">
          <h2 className="text-base font-semibold text-zinc-100">AI Coach Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 transition-colors text-sm px-2 py-1"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              AI Provider
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(PROVIDER_DEFAULTS) as ProviderType[]).map((pKey) => (
                <button
                  key={pKey}
                  type="button"
                  onClick={() => handleProviderChange(pKey)}
                  className={`rounded border px-3 py-2 text-left text-xs font-medium transition-colors ${
                    provider === pKey
                      ? 'border-amber-500 bg-amber-500/10 text-amber-200'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                  }`}
                >
                  {PROVIDER_DEFAULTS[pKey].name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-zinc-400">
                API Key
              </label>
              {PROVIDER_DEFAULTS[provider].helpUrl && (
                <a
                  href={PROVIDER_DEFAULTS[provider].helpUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-amber-400 hover:underline"
                >
                  Get free key ↗
                </a>
              )}
            </div>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste your API key here..."
                className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 pr-12 text-xs text-zinc-100 placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-300"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">
              Keys are stored securely in your browser's localStorage and never transmitted to our servers.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Model Name
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. gemini-2.5-flash"
              className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
            />
            {provider === 'openrouter' && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
                <span>Free presets:</span>
                <button
                  type="button"
                  onClick={() => setModel('openrouter/free')}
                  className={`rounded px-1.5 py-0.5 border text-[10px] font-mono transition-colors ${
                    model === 'openrouter/free'
                      ? 'border-amber-500 text-amber-300 bg-amber-950/40'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  openrouter/free
                </button>
                <button
                  type="button"
                  onClick={() => setModel('minimax/minimax-m2.7:free')}
                  className={`rounded px-1.5 py-0.5 border text-[10px] font-mono transition-colors ${
                    model === 'minimax/minimax-m2.7:free'
                      ? 'border-amber-500 text-amber-300 bg-amber-950/40'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  minimax/minimax-m2.7:free
                </button>
              </div>
            )}
          </div>

          {provider === 'custom' && (
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Base URL
              </label>
              <input
                type="text"
                value={customBaseUrl}
                onChange={(e) => setCustomBaseUrl(e.target.value)}
                placeholder="https://api.openai.com/v1"
                className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded bg-amber-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-amber-500 transition-colors"
            >
              {savedSuccess ? 'Saved ✓' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
