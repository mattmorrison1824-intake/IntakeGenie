'use client';

import { useState, useEffect } from 'react';
import { Firm, RoutingMode } from '@/types';
import { createBrowserClient } from '@/lib/clients/supabase';

interface SettingsFormProps {
  firm: Firm | null;
  onSave: () => void;
}

const TIMEZONES = [
  { value: 'America/New_York', label: 'EST/EDT (Eastern)' },
  { value: 'America/Chicago', label: 'CST/CDT (Central)' },
  { value: 'America/Denver', label: 'MST/MDT (Mountain)' },
  { value: 'America/Los_Angeles', label: 'PST/PDT (Pacific)' },
  { value: 'America/Phoenix', label: 'MST (Arizona)' },
  { value: 'America/Anchorage', label: 'AKST/AKDT (Alaska)' },
  { value: 'Pacific/Honolulu', label: 'HST (Hawaii)' },
  { value: 'Europe/London', label: 'GMT/BST (London)' },
  { value: 'Europe/Paris', label: 'CET/CEST (Central European)' },
  { value: 'Europe/Berlin', label: 'CET/CEST (Berlin)' },
  { value: 'Europe/Madrid', label: 'CET/CEST (Madrid)' },
  { value: 'Europe/Rome', label: 'CET/CEST (Rome)' },
  { value: 'Asia/Dubai', label: 'GST (Dubai)' },
  { value: 'Asia/Tokyo', label: 'JST (Tokyo)' },
  { value: 'Asia/Shanghai', label: 'CST (Shanghai)' },
  { value: 'Asia/Hong_Kong', label: 'HKT (Hong Kong)' },
  { value: 'Australia/Sydney', label: 'AEST/AEDT (Sydney)' },
  { value: 'Australia/Melbourne', label: 'AEST/AEDT (Melbourne)' },
  { value: 'America/Toronto', label: 'EST/EDT (Toronto)' },
  { value: 'America/Vancouver', label: 'PST/PDT (Vancouver)' },
  { value: 'America/Mexico_City', label: 'CST/CDT (Mexico City)' },
  { value: 'America/Sao_Paulo', label: 'BRT/BRST (São Paulo)' },
];

const DAYS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

const ROUTING_MODES = [
  {
    value: 'after_hours' as RoutingMode,
    title: 'After Hours Only',
    description: 'Route calls to AI agent only outside business hours',
  },
  {
    value: 'failover' as RoutingMode,
    title: 'No-Answer Failover Only',
    description: 'Route to AI agent if firm doesn\'t answer during business hours',
  },
  {
    value: 'both' as RoutingMode,
    title: 'Both (After Hours + Failover)',
    description: 'Use AI agent for after-hours calls and as failover during business hours',
  },
];

export default function SettingsForm({ firm, onSave }: SettingsFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [supabase, setSupabase] = useState<ReturnType<typeof createBrowserClient> | null>(null);
  const [manualTwilioNumber, setManualTwilioNumber] = useState('');
  const [areaCode, setAreaCode] = useState('');
  const [provisioning, setProvisioning] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSupabase(createBrowserClient());
    }
  }, []);

  const [formData, setFormData] = useState({
    firm_name: firm?.firm_name || '',
    forward_to_number: firm?.forward_to_number || '',
    notify_emails: firm?.notify_emails?.join(', ') || '',
    timezone: firm?.timezone || 'America/New_York',
    mode: (firm?.mode || 'both') as RoutingMode,
    open_days: firm?.open_days || [1, 2, 3, 4, 5],
    open_time: firm?.open_time || '09:00',
    close_time: firm?.close_time || '17:00',
    failover_ring_seconds: firm?.failover_ring_seconds || 20,
  });

  useEffect(() => {
    if (firm) {
      setFormData({
        firm_name: firm.firm_name,
        forward_to_number: firm.forward_to_number,
        notify_emails: firm.notify_emails?.join(', ') || '',
        timezone: firm.timezone,
        mode: firm.mode,
        open_days: firm.open_days,
        open_time: firm.open_time,
        close_time: firm.close_time,
        failover_ring_seconds: firm.failover_ring_seconds,
      });
    }
  }, [firm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const notifyEmailsArray = formData.notify_emails
        .split(',')
        .map((e) => e.trim())
        .filter((e) => e.length > 0);

      if (notifyEmailsArray.length === 0) {
        throw new Error('At least one notification email is required');
      }

      const firmData = {
        firm_name: formData.firm_name,
        forward_to_number: formData.forward_to_number,
        notify_emails: notifyEmailsArray,
        timezone: formData.timezone,
        mode: formData.mode,
        open_days: formData.open_days,
        open_time: formData.open_time,
        close_time: formData.close_time,
        failover_ring_seconds: formData.failover_ring_seconds,
      };

      let firmId: string;

      if (firm) {
        // Update existing firm
        firmId = firm.id;
        const { error: updateError } = await supabase
          .from('firms')
          // @ts-ignore - Supabase type inference issue
          .update(firmData)
          // @ts-ignore - Supabase type inference issue
          .eq('id', firm.id);

        if (updateError) throw updateError;
        
        // Phone number provisioning is now manual via the "Provision Phone Number" button
        // No auto-provisioning on save
      } else {
        // Create new firm
        // @ts-ignore - Supabase type inference issue
        const { data: newFirmData, error: insertError } = await supabase.from('firms').insert({
          ...firmData,
          owner_user_id: user.id,
        }).select().single();

        if (insertError) throw insertError;
        if (!newFirmData) throw new Error('Failed to create firm');
        
        const newFirm = newFirmData as any;
        firmId = newFirm.id;

        // Phone number provisioning is now manual via the "Provision Phone Number" button
        // No auto-provisioning on firm creation
      }

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onSave();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const toggleDay = (day: number) => {
    setFormData((prev) => ({
      ...prev,
      open_days: prev.open_days.includes(day)
        ? prev.open_days.filter((d) => d !== day)
        : [...prev.open_days, day],
    }));
  };

  return (
    <div className="w-full max-w-[900px] mx-auto">
      {/* Success Toast */}
      {success && (
        <div 
          className="mb-6 border rounded-xl px-4 py-3 flex items-center justify-between"
          style={{ 
            backgroundColor: '#F5F7FA',
            borderColor: '#0B1F3B',
            color: '#0B1F3B'
          }}
        >
          <span className="text-sm font-medium">Settings saved successfully</span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <span className="text-sm">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-0">
        {/* Phone Number Section - Show First */}
        {firm && (
          <section className="pb-8 border-b border-gray-200">
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-1" style={{ color: '#4A5D73' }}>
                Phone Number
              </h2>
              <p className="text-sm" style={{ color: '#4A5D73', opacity: 0.7 }}>
                Provision a phone number for your firm. Calls are handled by IntakeGenie's AI assistant.
              </p>
            </div>

            <div className="space-y-5">
              {/* Display current number if exists */}
              {(firm.inbound_number_e164 || firm.vapi_phone_number || firm.twilio_number) && (
                <div className="p-4 rounded-lg border" style={{ borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: '#0B1F3B' }}>
                        {firm.inbound_number_e164 || firm.vapi_phone_number || firm.twilio_number}
                      </p>
                      {firm.telephony_provider && (
                        <p className="text-xs mt-1" style={{ color: '#4A5D73', opacity: 0.7 }}>
                          Provider: {firm.telephony_provider === 'twilio_imported_into_vapi' ? 'Twilio + Vapi' : firm.telephony_provider}
                        </p>
                      )}
                    </div>
                    {firm.inbound_number_e164 && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(firm.inbound_number_e164!);
                          setSuccess(true);
                          setTimeout(() => setSuccess(false), 2000);
                        }}
                        className="px-4 py-2 text-xs rounded-lg font-medium transition-all"
                        style={{ backgroundColor: '#0B1F3B', color: '#FFFFFF' }}
                      >
                        Copy
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Provision new number - only show if no number exists */}
              {!firm.inbound_number_e164 && !firm.vapi_phone_number_id && !firm.twilio_phone_number_sid && (
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
                      disabled={provisioning}
                    />
                    <p className="text-xs mt-1.5" style={{ color: '#4A5D73', opacity: 0.7 }}>
                      Leave blank for any available number
                    </p>
                  </div>
                  
                  <button
                    type="button"
                    onClick={async () => {
                      if (!supabase || !firm) return;
                      
                      setProvisioning(true);
                      setLoading(true);
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
                          let errorMsg = 'Failed to provision number';
                          if (data.message) {
                            errorMsg = Array.isArray(data.message) ? data.message.join(', ') : data.message;
                          } else if (data.error) {
                            errorMsg = data.error;
                          } else if (data.details) {
                            errorMsg = typeof data.details === 'string' ? data.details : JSON.stringify(data.details);
                          }
                          
                          // If number already exists, show a clear message
                          if (response.status === 409 || errorMsg.includes('already provisioned')) {
                            errorMsg = 'A phone number has already been provisioned for this firm. Only one number is allowed per firm.';
                            // Refresh the form to show the existing number
                            setTimeout(() => {
                              onSave();
                            }, 1000);
                          }
                          
                          throw new Error(errorMsg);
                        }

                        setSuccess(true);
                        setAreaCode('');
                        setTimeout(() => {
                          setSuccess(false);
                          onSave();
                        }, 2000);
                      } catch (err: any) {
                        console.error('Error provisioning number:', err);
                        setError(err.message || 'Failed to provision number. Check browser console for details.');
                      } finally {
                        setLoading(false);
                        setProvisioning(false);
                      }
                    }}
                    disabled={loading || provisioning}
                    className="h-12 px-6 rounded-lg font-semibold text-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: (loading || provisioning) ? '#4A5D73' : '#0B1F3B',
                      color: '#FFFFFF',
                    }}
                  >
                    {loading || provisioning ? 'Provisioning...' : 'Provision Phone Number'}
                  </button>
                </div>
              )}

              {/* Refresh button for existing numbers */}
              {firm.vapi_phone_number_id && !firm.inbound_number_e164 && (
                <div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!supabase || !firm) return;
                      
                      setLoading(true);
                      setError(null);
                      
                      try {
                        const response = await fetch(`/api/telephony/refresh-number?firmId=${firm.id}`);

                        const data = await response.json();
                        
                        if (!response.ok) {
                          throw new Error(data.error || 'Failed to refresh number');
                        }

                        if (data.phoneNumber) {
                          setSuccess(true);
                          setTimeout(() => {
                            setSuccess(false);
                            onSave();
                          }, 2000);
                        } else {
                          setError('Number not yet assigned');
                        }
                      } catch (err: any) {
                        console.error('Error refreshing number:', err);
                        setError(err.message || 'Failed to refresh number');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                    className="h-10 px-4 rounded-lg font-semibold text-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: '#4A5D73', color: '#FFFFFF' }}
                  >
                    {loading ? 'Refreshing...' : 'Refresh Number from Vapi'}
                  </button>
                </div>
              )}

              {/* Link Existing Phone Number */}
              <div className="mt-4 p-3 rounded-lg border" style={{ borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}>
                <p className="text-xs font-semibold mb-2" style={{ color: '#4A5D73' }}>
                  Link Existing Vapi Phone Number
                </p>
                <p className="text-xs mb-2" style={{ color: '#4A5D73', opacity: 0.7 }}>
                  If you have a phone number already in Vapi (e.g., imported from Twilio), enter its ID to link it to this firm.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    id="link_phone_number_id"
                    placeholder="Enter Vapi phone number ID"
                    className="flex-1 h-10 px-3 rounded-lg border text-sm"
                    style={{
                      borderColor: '#E5E7EB',
                      backgroundColor: '#FFFFFF',
                    }}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter' && !loading) {
                        const phoneNumberId = (e.target as HTMLInputElement).value.trim();
                        if (!phoneNumberId || !supabase || !firm) return;
                        
                        setLoading(true);
                        setError(null);
                        
                        try {
                          const response = await fetch('/api/vapi/link-number', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ 
                              firmId: firm.id,
                              phoneNumberId: phoneNumberId
                            }),
                          });

                          const data = await response.json();
                          
                          if (!response.ok) {
                            throw new Error(data.error || data.details || 'Failed to link number');
                          }

                          setSuccess(true);
                          (e.target as HTMLInputElement).value = '';
                          setTimeout(() => {
                            setSuccess(false);
                            onSave();
                          }, 2000);
                        } catch (err: any) {
                          console.error('Error linking number:', err);
                          setError(err.message || 'Failed to link number. Check browser console for details.');
                        } finally {
                          setLoading(false);
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!supabase || !firm) return;
                      
                      const input = document.getElementById('link_phone_number_id') as HTMLInputElement;
                      const phoneNumberId = input?.value.trim();
                      
                      if (!phoneNumberId) {
                        setError('Please enter a phone number ID');
                        return;
                      }
                      
                      setLoading(true);
                      setError(null);
                      
                      try {
                        const response = await fetch('/api/vapi/link-number', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({ 
                            firmId: firm.id,
                            phoneNumberId: phoneNumberId
                          }),
                        });

                        const data = await response.json();
                        
                        if (!response.ok) {
                          console.error('Link number error response:', data);
                          
                          let errorMsg = 'Failed to link number';
                          if (data.message && Array.isArray(data.message)) {
                            errorMsg = data.message.join(', ');
                          } else if (data.message && typeof data.message === 'string') {
                            errorMsg = data.message;
                          } else if (data.error) {
                            errorMsg = data.error;
                          } else if (data.details) {
                            if (typeof data.details === 'object' && data.details.message) {
                              errorMsg = Array.isArray(data.details.message) 
                                ? data.details.message.join(', ')
                                : data.details.message;
                            } else {
                              errorMsg = JSON.stringify(data.details);
                            }
                          }
                          
                          throw new Error(errorMsg);
                        }

                        setSuccess(true);
                        input.value = '';
                        setTimeout(() => {
                          setSuccess(false);
                          onSave();
                        }, 2000);
                      } catch (err: any) {
                        console.error('Error linking number:', err);
                        setError(err.message || 'Failed to link number. Check browser console for details.');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                    className="h-10 px-4 rounded-lg font-semibold text-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    style={{
                      backgroundColor: loading ? '#4A5D73' : '#0B1F3B',
                      color: '#FFFFFF',
                    }}
                  >
                    Link Number
                  </button>
                </div>
                <p className="text-xs mt-2" style={{ color: '#4A5D73', opacity: 0.7 }}>
                  Find the phone number ID in the Vapi dashboard URL: <code className="bg-gray-200 px-1 rounded">/phone-numbers/[ID]</code>
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Firm Information Section */}
        <section className="pb-8 border-b border-gray-200 last:border-b-0">
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-1" style={{ color: '#4A5D73' }}>
              Firm Information
            </h2>
            <p className="text-sm" style={{ color: '#4A5D73', opacity: 0.7 }}>
              Basic details about your law firm
            </p>
          </div>

          <div className="space-y-5">
      <div>
              <label 
                htmlFor="firm_name" 
                className="block text-xs font-semibold uppercase tracking-wide mb-2"
                style={{ color: '#4A5D73' }}
              >
          Firm Name
        </label>
        <input
          type="text"
          id="firm_name"
          required
                className="w-full h-12 px-4 rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-offset-0"
                style={{
                  borderColor: '#E5E7EB',
                  backgroundColor: '#FFFFFF',
                  fontSize: '14px',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#0B1F3B';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(11, 31, 59, 0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#E5E7EB';
                  e.currentTarget.style.boxShadow = 'none';
                }}
          value={formData.firm_name}
          onChange={(e) => setFormData({ ...formData, firm_name: e.target.value })}
        />
      </div>

      <div>
              <label 
                htmlFor="forward_to_number" 
                className="block text-xs font-semibold uppercase tracking-wide mb-2"
                style={{ color: '#4A5D73' }}
              >
                Forward To Number
        </label>
        <input
          type="tel"
          id="forward_to_number"
          required
          pattern="^\+[1-9]\d{1,14}$"
                placeholder="+15551234567"
                className="w-full h-12 px-4 rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-offset-0"
                style={{
                  borderColor: '#E5E7EB',
                  backgroundColor: '#FFFFFF',
                  fontSize: '14px',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#0B1F3B';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(11, 31, 59, 0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#E5E7EB';
                  e.currentTarget.style.boxShadow = 'none';
                }}
          value={formData.forward_to_number}
          onChange={(e) => setFormData({ ...formData, forward_to_number: e.target.value })}
        />
              <p className="mt-1.5 text-xs" style={{ color: '#4A5D73', opacity: 0.7 }}>
                E.164 format required (e.g., +15551234567)
              </p>
      </div>

      <div>
              <label 
                htmlFor="notify_emails" 
                className="block text-xs font-semibold uppercase tracking-wide mb-2"
                style={{ color: '#4A5D73' }}
              >
                Notification Emails
        </label>
        <input
          type="text"
          id="notify_emails"
          required
                placeholder="email1@example.com, email2@example.com"
                className="w-full h-12 px-4 rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-offset-0"
                style={{
                  borderColor: '#E5E7EB',
                  backgroundColor: '#FFFFFF',
                  fontSize: '14px',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#0B1F3B';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(11, 31, 59, 0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#E5E7EB';
                  e.currentTarget.style.boxShadow = 'none';
                }}
          value={formData.notify_emails}
          onChange={(e) => setFormData({ ...formData, notify_emails: e.target.value })}
        />
              <p className="mt-1.5 text-xs" style={{ color: '#4A5D73', opacity: 0.7 }}>
                Comma-separated list of email addresses
              </p>
      </div>

      <div>
              <label 
                htmlFor="timezone" 
                className="block text-xs font-semibold uppercase tracking-wide mb-2"
                style={{ color: '#4A5D73' }}
              >
          Timezone
        </label>
        <select
          id="timezone"
                className="w-full h-12 px-4 rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-offset-0"
                style={{
                  borderColor: '#E5E7EB',
                  backgroundColor: '#FFFFFF',
                  fontSize: '14px',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#0B1F3B';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(11, 31, 59, 0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#E5E7EB';
                  e.currentTarget.style.boxShadow = 'none';
                }}
          value={formData.timezone}
          onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
        >
          {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
            </option>
          ))}
        </select>
      </div>
          </div>
        </section>

        {/* Call Routing Rules Section */}
        <section className="py-8 border-b border-gray-200 last:border-b-0">
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-1" style={{ color: '#4A5D73' }}>
              Call Routing Rules
            </h2>
            <p className="text-sm" style={{ color: '#4A5D73', opacity: 0.7 }}>
              Configure when calls should be routed to the AI agent
            </p>
          </div>

          <div className="space-y-3">
            {ROUTING_MODES.map((mode) => (
              <label
                key={mode.value}
                className="block cursor-pointer"
                onClick={() => setFormData({ ...formData, mode: mode.value })}
              >
                <div
                  className={`p-4 rounded-lg border-2 transition-all ${
                    formData.mode === mode.value
                      ? 'border-[#0B1F3B]'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  style={{
                    backgroundColor: formData.mode === mode.value ? 'rgba(11, 31, 59, 0.05)' : '#FFFFFF',
                  }}
                >
                  <div className="flex items-start">
            <input
              type="radio"
              name="mode"
                      value={mode.value}
                      checked={formData.mode === mode.value}
                      onChange={() => setFormData({ ...formData, mode: mode.value })}
                      className="mt-0.5 mr-3"
                      style={{ accentColor: '#0B1F3B' }}
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-sm mb-1" style={{ color: '#0B1F3B' }}>
                        {mode.title}
                      </div>
                      <div className="text-sm" style={{ color: '#4A5D73', opacity: 0.8 }}>
                        {mode.description}
                      </div>
                    </div>
        </div>
      </div>
            </label>
          ))}
          </div>
        </section>

        {/* Business Hours Section */}
        <section className="py-8 border-b border-gray-200 last:border-b-0">
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-1" style={{ color: '#4A5D73' }}>
              Business Hours
            </h2>
            <p className="text-sm" style={{ color: '#4A5D73', opacity: 0.7 }}>
              Define when your firm is open for calls
            </p>
          </div>

          <div className="space-y-5">
            <div>
              <label 
                className="block text-xs font-semibold uppercase tracking-wide mb-3"
                style={{ color: '#4A5D73' }}
              >
                Open Days
              </label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((day) => {
                  const isSelected = formData.open_days.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDay(day.value)}
                      className="px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer"
                      style={{
                        backgroundColor: isSelected ? '#0B1F3B' : '#F3F4F6',
                        color: isSelected ? '#FFFFFF' : '#4A5D73',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = '#E5E7EB';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = '#F3F4F6';
                        }
                      }}
                    >
                      {day.label}
                    </button>
                  );
                })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
                <label 
                  htmlFor="open_time" 
                  className="block text-xs font-semibold uppercase tracking-wide mb-2"
                  style={{ color: '#4A5D73' }}
                >
            Open Time
          </label>
          <input
            type="time"
            id="open_time"
            required
                  className="w-full h-12 px-4 rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-offset-0"
                  style={{
                    borderColor: '#E5E7EB',
                    backgroundColor: '#FFFFFF',
                    fontSize: '14px',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#0B1F3B';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(11, 31, 59, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#E5E7EB';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
            value={formData.open_time}
            onChange={(e) => setFormData({ ...formData, open_time: e.target.value })}
          />
        </div>
        <div>
                <label 
                  htmlFor="close_time" 
                  className="block text-xs font-semibold uppercase tracking-wide mb-2"
                  style={{ color: '#4A5D73' }}
                >
            Close Time
          </label>
          <input
            type="time"
            id="close_time"
            required
                  className="w-full h-12 px-4 rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-offset-0"
                  style={{
                    borderColor: '#E5E7EB',
                    backgroundColor: '#FFFFFF',
                    fontSize: '14px',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#0B1F3B';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(11, 31, 59, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#E5E7EB';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
            value={formData.close_time}
            onChange={(e) => setFormData({ ...formData, close_time: e.target.value })}
          />
        </div>
            </div>
          </div>
        </section>

        {/* Failover Behavior Section */}
        <section className="py-8">
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-1" style={{ color: '#4A5D73' }}>
              Failover Behavior
            </h2>
            <p className="text-sm" style={{ color: '#4A5D73', opacity: 0.7 }}>
              Configure how long to ring before routing to AI agent
            </p>
      </div>

      <div>
            <label 
              htmlFor="failover_ring_seconds" 
              className="block text-xs font-semibold uppercase tracking-wide mb-2"
              style={{ color: '#4A5D73' }}
            >
              Failover Ring Duration
        </label>
        <input
          type="number"
          id="failover_ring_seconds"
          required
          min="5"
          max="60"
              className="w-full h-12 px-4 rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-offset-0"
              style={{
                borderColor: '#E5E7EB',
                backgroundColor: '#FFFFFF',
                fontSize: '14px',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#0B1F3B';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(11, 31, 59, 0.1)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#E5E7EB';
                e.currentTarget.style.boxShadow = 'none';
              }}
          value={formData.failover_ring_seconds}
          onChange={(e) =>
            setFormData({ ...formData, failover_ring_seconds: parseInt(e.target.value) })
          }
        />
            <p className="mt-1.5 text-xs" style={{ color: '#4A5D73', opacity: 0.7 }}>
              Number of seconds to ring before routing to AI agent (5-60 seconds)
            </p>
      </div>
        </section>

        {/* Save Button */}
        <div className="pt-6 border-t border-gray-200 sticky bottom-0 bg-white -mx-6 -mb-6 px-6 pb-6 rounded-b-lg">
        <button
          type="submit"
          disabled={loading}
            className="w-full h-12 rounded-lg font-semibold text-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: loading ? '#4A5D73' : '#0B1F3B',
              color: '#FFFFFF',
            }}
            onMouseEnter={(e) => {
              if (!loading && !e.currentTarget.disabled) {
                e.currentTarget.style.backgroundColor = '#0A1A33';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading && !e.currentTarget.disabled) {
                e.currentTarget.style.backgroundColor = '#0B1F3B';
              }
            }}
        >
          {loading ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </form>
    </div>
  );
}

