'use client';

import { useState, useEffect } from 'react';
import { Firm } from '@/types';
import { createBrowserClient } from '@/lib/clients/supabase';
import PhoneNumberDisplay from './PhoneNumberDisplay';

interface PhoneNumberProvisionProps {
  firm: Firm | null;
  onProvisioned?: () => void;
}

export default function PhoneNumberProvision({ firm, onProvisioned }: PhoneNumberProvisionProps) {
  const [areaCode, setAreaCode] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [supabase, setSupabase] = useState<ReturnType<typeof createBrowserClient> | null>(null);
  const [fixingWebhook, setFixingWebhook] = useState(false);
  const [fixWebhookError, setFixWebhookError] = useState<string | null>(null);
  const [fixWebhookSuccess, setFixWebhookSuccess] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSupabase(createBrowserClient());
    }
  }, []);

  // If no firm, return null
  if (!firm) {
    return null;
  }

  // If number exists, just display it
  if (firm.inbound_number_e164 || firm.vapi_phone_number || firm.twilio_number) {
    return (
      <div 
        className="bg-white rounded-xl shadow-sm p-8"
        style={{
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        }}
      >
        <div className="mb-2">
          <h2 className="text-lg font-semibold mb-1" style={{ color: '#4A5D73' }}>
            Your IntakeGenie Number
          </h2>
        </div>
        <PhoneNumberDisplay
          phoneNumber={
            firm?.inbound_number_e164 
              ? firm.inbound_number_e164
              : firm?.vapi_phone_number && typeof firm.vapi_phone_number === 'string' && firm.vapi_phone_number.match(/^\+?[1-9]\d{1,14}$/)
                ? firm.vapi_phone_number
                : firm?.twilio_number && typeof firm.twilio_number === 'string'
                  ? firm.twilio_number
                  : null
          }
          formattedNumber={
            firm?.inbound_number_e164 && typeof firm.inbound_number_e164 === 'string'
              ? firm.inbound_number_e164.replace(/^\+?(\d{1})(\d{3})(\d{3})(\d{4})$/, '+$1 ($2) $3-$4')
              : firm?.vapi_phone_number && typeof firm.vapi_phone_number === 'string' && firm.vapi_phone_number.match(/^\+?[1-9]\d{1,14}$/) 
                ? firm.vapi_phone_number.replace(/^\+?(\d{1})(\d{3})(\d{3})(\d{4})$/, '+$1 ($2) $3-$4')
                : firm?.twilio_number && typeof firm.twilio_number === 'string'
                  ? firm.twilio_number.replace(/^\+?(\d{1})(\d{3})(\d{3})(\d{4})$/, '+$1 ($2) $3-$4')
                  : firm?.vapi_phone_number_id
                    ? 'Number being assigned...'
                    : 'No number assigned'
          }
          isPending={!!(firm?.vapi_phone_number_id && !firm?.inbound_number_e164)}
        />
        {firm?.vapi_phone_number_id && !firm?.inbound_number_e164 && (
          <p className="text-sm mt-2" style={{ color: '#4A5D73', opacity: 0.7 }}>
            The number is being assigned. It will appear here automatically once ready.
            {' '}
            <a 
              href={`https://dashboard.vapi.ai/phone-numbers/${firm.vapi_phone_number_id}`}
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              View in Vapi Dashboard
            </a>
          </p>
        )}
        {firm?.inbound_number_e164 && firm?.telephony_provider && (
          <p className="text-xs mt-2" style={{ color: '#4A5D73', opacity: 0.7 }}>
            Provider: {firm.telephony_provider === 'twilio_imported_into_vapi' ? 'Twilio + Vapi' : firm.telephony_provider}
          </p>
        )}
        
        {/* Fix Webhook Button */}
        {firm.vapi_assistant_id && (
          <div className="mt-4 pt-4 border-t" style={{ borderColor: '#E5E7EB' }}>
            <p className="text-sm mb-3" style={{ color: '#4A5D73', opacity: 0.8 }}>
              Calls not appearing? Fix the webhook configuration for your assistant.
            </p>
            <button
              onClick={async () => {
                if (!firm?.id) return;
                
                setFixingWebhook(true);
                setFixWebhookError(null);
                setFixWebhookSuccess(false);

                try {
                  const response = await fetch('/api/vapi/fix-assistant-webhook', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ firmId: firm.id }),
                  });

                  const data = await response.json();

                  if (!response.ok) {
                    throw new Error(data.error || 'Failed to fix webhook');
                  }

                  setFixWebhookSuccess(true);
                  setTimeout(() => setFixWebhookSuccess(false), 5000);
                } catch (err: any) {
                  setFixWebhookError(err.message || 'Failed to fix webhook');
                  setTimeout(() => setFixWebhookError(null), 5000);
                } finally {
                  setFixingWebhook(false);
                }
              }}
              disabled={fixingWebhook}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: fixingWebhook ? '#9CA3AF' : '#0B1F3B',
                color: '#FFFFFF',
              }}
            >
              {fixingWebhook ? 'Fixing...' : 'Fix Webhook Configuration'}
            </button>
            {fixWebhookSuccess && (
              <p className="mt-2 text-sm" style={{ color: '#10B981' }}>
                <span>✅ Webhook fixed successfully! Try making a call now.</span>
              </p>
            )}
            {fixWebhookError && (
              <p className="mt-2 text-sm" style={{ color: '#EF4444' }}>
                <span>❌ {fixWebhookError}</span>
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  // If no number exists, show generation UI

  const handleGenerate = async () => {
    if (!supabase || !firm) return;
    
    setGenerating(true);
    setError(null);
    setSuccess(false);
    
    try {
      const response = await fetch('/api/telephony/provision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          firmId: firm.id,
          areaCode: areaCode || undefined,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        let errorMsg = 'Failed to generate number';
        if (data.message) {
          errorMsg = Array.isArray(data.message) ? data.message.join(', ') : data.message;
        } else if (data.error) {
          errorMsg = data.error;
        } else if (data.details) {
          errorMsg = typeof data.details === 'string' ? data.details : JSON.stringify(data.details);
        }
        
        // If number already exists, show a clear message
        if (response.status === 409 || errorMsg.includes('already generated') || errorMsg.includes('already provisioned')) {
          errorMsg = 'A phone number has already been generated for this firm. Only one number is allowed per firm.';
          // Refresh after a delay
          setTimeout(() => {
            if (typeof window !== 'undefined') {
              window.location.reload();
            } else if (onProvisioned) {
              onProvisioned();
            }
          }, 1000);
        }
        
        throw new Error(errorMsg);
      }

           setSuccess(true);
           setAreaCode('');
           setTimeout(() => {
             setSuccess(false);
             // Refresh the page to show the new number
             if (typeof window !== 'undefined') {
               window.location.reload();
             } else if (onProvisioned) {
               onProvisioned();
             }
           }, 2000);
    } catch (err: any) {
      console.error('Error generating number:', err);
      setError(err.message || 'Failed to generate number. Check browser console for details.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div 
      className="bg-white rounded-xl shadow-sm p-8"
      style={{
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
      }}
    >
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-1" style={{ color: '#4A5D73' }}>
          Phone Number
        </h2>
        <p className="text-sm" style={{ color: '#4A5D73', opacity: 0.7 }}>
          Generate a phone number for your firm. Calls are handled by IntakeGenie's AI assistant.
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <span className="text-sm">{error}</span>
        </div>
      )}

      {success && (
        <div 
          className="mb-4 border rounded-xl px-4 py-3 flex items-center justify-between"
          style={{ 
            backgroundColor: '#F5F7FA',
            borderColor: '#0B1F3B',
            color: '#0B1F3B'
          }}
        >
          <span className="text-sm font-medium">Phone number generated successfully!</span>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label 
            htmlFor="area_code" 
            className="block text-xs font-semibold uppercase tracking-wide mb-2"
            style={{ color: '#4A5D73' }}
          >
            Area Code (Optional)
          </label>
          <input
            type="text"
            id="area_code"
            value={areaCode}
            onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, '').slice(0, 3))}
            placeholder="e.g., 415"
            className="w-full h-12 px-4 rounded-lg border text-sm"
            style={{
              borderColor: '#E5E7EB',
              backgroundColor: '#FFFFFF',
              color: '#0B1F3B',
            }}
            disabled={generating}
          />
          <p className="text-xs mt-1.5" style={{ color: '#4A5D73', opacity: 0.7 }}>
            Leave blank for any available number
          </p>
        </div>
        
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="h-12 px-6 rounded-lg font-semibold text-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed w-full"
          style={{
            backgroundColor: generating ? '#4A5D73' : '#0B1F3B',
            color: '#FFFFFF',
          }}
        >
          {generating ? 'Generating...' : 'Generate Phone Number'}
        </button>
      </div>
    </div>
  );
}

