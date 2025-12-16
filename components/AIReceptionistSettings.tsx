'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/clients/supabase';
import { AITone, Firm } from '@/types';

interface AIReceptionistSettingsProps {
  firm: Firm | null;
  onSave?: () => void;
}

const DEFAULT_GREETING = "Thank you for calling {FIRM_NAME}. I'm an automated assistant for the firm. I can't give legal advice. But I can collect your information so the firm can follow up. Are you in a safe place to talk right now?";

const TONE_OPTIONS: Array<{ value: AITone; label: string; description: string }> = [
  {
    value: 'professional',
    label: 'Professional',
    description: 'Calm, clear, and businesslike',
  },
  {
    value: 'warm',
    label: 'Warm',
    description: 'Friendly and empathetic',
  },
  {
    value: 'friendly',
    label: 'Friendly',
    description: 'Conversational and approachable',
  },
  {
    value: 'formal',
    label: 'Formal',
    description: 'Reserved and respectful',
  },
];

export default function AIReceptionistSettings({ firm, onSave }: AIReceptionistSettingsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [supabase, setSupabase] = useState<ReturnType<typeof createBrowserClient> | null>(null);
  const [customGreeting, setCustomGreeting] = useState('');
  const [tone, setTone] = useState<AITone>('professional');
  const [useCustomGreeting, setUseCustomGreeting] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSupabase(createBrowserClient());
    }
  }, []);

  useEffect(() => {
    if (firm) {
      setCustomGreeting(firm.ai_greeting_custom || '');
      setTone(firm.ai_tone || 'professional');
      setUseCustomGreeting(!!firm.ai_greeting_custom);
    }
  }, [firm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !firm) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const updateData: any = {
        ai_tone: tone,
        ai_greeting_custom: useCustomGreeting && customGreeting.trim() ? customGreeting.trim() : null,
      };

      const { error: updateError } = await supabase
        .from('firms')
        // @ts-ignore - Supabase type inference issue with new fields
        .update(updateData)
        .eq('id', firm.id);

      if (updateError) throw updateError;

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      if (onSave) onSave();
    } catch (err: any) {
      console.error('Error saving AI settings:', err);
      setError(err.message || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const displayGreeting = useCustomGreeting && customGreeting.trim()
    ? customGreeting.replace(/{FIRM_NAME}/g, firm?.firm_name || 'the firm')
    : DEFAULT_GREETING.replace(/{FIRM_NAME}/g, firm?.firm_name || 'the firm');

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4" style={{ color: '#0B1F3B' }}>
          Greeting Customization
        </h3>
        <p className="text-sm mb-4" style={{ color: '#4A5D73' }}>
          Customize how the AI receptionist greets callers. Use {'{FIRM_NAME}'} as a placeholder for your firm name.
        </p>

        <div className="mb-4">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useCustomGreeting}
              onChange={(e) => setUseCustomGreeting(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300"
              style={{ accentColor: '#0B1F3B' }}
            />
            <span className="text-sm font-medium" style={{ color: '#0B1F3B' }}>
              Use custom greeting
            </span>
          </label>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-semibold mb-2 uppercase tracking-wide" style={{ color: '#4A5D73' }}>
            Default Greeting (Preview)
          </label>
          <div
            className="p-3 rounded-lg border text-sm"
            style={{
              backgroundColor: '#F9FAFB',
              borderColor: '#E5E7EB',
              color: '#4A5D73',
            }}
          >
            {DEFAULT_GREETING.replace(/{FIRM_NAME}/g, firm?.firm_name || 'the firm')}
          </div>
        </div>

        {useCustomGreeting && (
          <div className="mb-4">
            <label htmlFor="customGreeting" className="block text-sm font-semibold mb-2 uppercase tracking-wide" style={{ color: '#4A5D73' }}>
              Custom Greeting
            </label>
            <textarea
              id="customGreeting"
              value={customGreeting}
              onChange={(e) => setCustomGreeting(e.target.value)}
              placeholder="Enter your custom greeting. Use {FIRM_NAME} as a placeholder."
              rows={4}
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{
                borderColor: '#E5E7EB',
                backgroundColor: '#FFFFFF',
                color: '#0B1F3B',
              }}
            />
            {customGreeting.trim() && (
              <div className="mt-2">
                <p className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: '#4A5D73' }}>
                  Preview:
                </p>
                <div
                  className="p-3 rounded-lg border text-sm"
                  style={{
                    backgroundColor: '#F0F9FF',
                    borderColor: '#BFDBFE',
                    color: '#0B1F3B',
                  }}
                >
                  {displayGreeting}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4" style={{ color: '#0B1F3B' }}>
          Tone Setting
        </h3>
        <p className="text-sm mb-4" style={{ color: '#4A5D73' }}>
          Choose the communication style for your AI receptionist.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {TONE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`relative flex items-start p-4 rounded-lg border cursor-pointer transition-colors ${
                tone === option.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="tone"
                value={option.value}
                checked={tone === option.value}
                onChange={(e) => setTone(e.target.value as AITone)}
                className="sr-only"
              />
              <div className="flex-1">
                <div className="flex items-center mb-1">
                  <div
                    className={`w-4 h-4 rounded-full border-2 mr-3 ${
                      tone === option.value
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300'
                    }`}
                  >
                    {tone === option.value && (
                      <div className="w-full h-full rounded-full bg-white scale-50" />
                    )}
                  </div>
                  <span className="font-semibold" style={{ color: '#0B1F3B' }}>
                    {option.label}
                  </span>
                </div>
                <p className="text-sm ml-7" style={{ color: '#4A5D73' }}>
                  {option.description}
                </p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-3 rounded-lg bg-green-50 border border-green-200">
          <p className="text-sm text-green-700">Settings saved successfully!</p>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 rounded-lg font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: '#0B1F3B', color: '#FFFFFF' }}
        >
          {loading ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </form>
  );
}

