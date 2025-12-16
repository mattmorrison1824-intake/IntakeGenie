'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/clients/supabase';
import { Firm } from '@/types';

interface AIFirmKnowledgebaseProps {
  firm: Firm | null;
  onSave?: () => void;
}

export default function AIFirmKnowledgebase({ firm, onSave }: AIFirmKnowledgebaseProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [supabase, setSupabase] = useState<ReturnType<typeof createBrowserClient> | null>(null);
  const [knowledgeBase, setKnowledgeBase] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSupabase(createBrowserClient());
    }
  }, []);

  useEffect(() => {
    if (firm) {
      setKnowledgeBase(firm.ai_knowledge_base || '');
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

      const updateData = {
        ai_knowledge_base: knowledgeBase.trim() || null,
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
      console.error('Error saving knowledge base:', err);
      setError(err.message || 'Failed to save knowledge base');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2" style={{ color: '#0B1F3B' }}>
          Firm Knowledge Base
        </h3>
        <p className="text-sm mb-4" style={{ color: '#4A5D73' }}>
          Add context about your firm to help the AI receptionist answer questions more effectively. 
          Include information like practice areas, office locations, specialties, or anything else that would help the AI assist callers.
        </p>

        <div className="mb-4">
          <label htmlFor="knowledgeBase" className="block text-sm font-semibold mb-2 uppercase tracking-wide" style={{ color: '#4A5D73' }}>
            Additional Context
          </label>
          <textarea
            id="knowledgeBase"
            value={knowledgeBase}
            onChange={(e) => setKnowledgeBase(e.target.value)}
            placeholder="Example: Our firm specializes in personal injury and workers' compensation cases. We have offices in New York, New Jersey, and Connecticut. We offer free consultations and work on a contingency basis..."
            rows={10}
            className="w-full px-3 py-2 rounded-lg border text-sm font-mono"
            style={{
              borderColor: '#E5E7EB',
              backgroundColor: '#FFFFFF',
              color: '#0B1F3B',
            }}
          />
          <p className="text-xs mt-2" style={{ color: '#6B7280' }}>
            This information will be provided to the AI to help it better understand your firm and answer questions.
          </p>
        </div>

        <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
          <p className="text-sm font-semibold mb-2" style={{ color: '#1E40AF' }}>
            💡 Tips for effective knowledge base entries:
          </p>
          <ul className="text-sm space-y-1 list-disc list-inside" style={{ color: '#1E40AF' }}>
            <li>List your practice areas and specialties</li>
            <li>Include office locations and service areas</li>
            <li>Mention any unique services or policies</li>
            <li>Note common questions you receive</li>
            <li>Keep it concise and factual</li>
          </ul>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-3 rounded-lg bg-green-50 border border-green-200">
          <p className="text-sm text-green-700">Knowledge base saved successfully!</p>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 rounded-lg font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: '#0B1F3B', color: '#FFFFFF' }}
        >
          {loading ? 'Saving...' : 'Save Knowledge Base'}
        </button>
      </div>
    </form>
  );
}

