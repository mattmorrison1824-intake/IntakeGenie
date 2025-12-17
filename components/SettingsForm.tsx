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
        
        // Only provision number if firm doesn't have one yet
        if (!firm.vapi_phone_number) {
          try {
            const provisionResponse = await fetch('/api/vapi/provision-number', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ firmId }),
            });

            if (!provisionResponse.ok) {
              const errorData = await provisionResponse.json();
              console.error('Error provisioning Vapi number:', errorData);
              console.error('Error details:', errorData.details);
              console.error('Error message:', errorData.message);
              // Show user-friendly error
              setError(errorData.message || errorData.error || 'Failed to provision number. Check console for details.');
              // Don't throw - allow settings update to succeed
            }
          } catch (provisionError) {
            console.error('Error calling provision-number API:', provisionError);
            // Don't throw - allow settings update to succeed
          }
        }
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

        // Automatically provision Vapi phone number for new firm
        // The API endpoint will check and skip if number already exists
        try {
          const provisionResponse = await fetch('/api/vapi/provision-number', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ firmId }),
          });

          if (!provisionResponse.ok) {
            const errorData = await provisionResponse.json();
            console.error('Error provisioning Vapi number:', errorData);
            console.error('Error details:', errorData.details);
            console.error('Error message:', errorData.message);
            // Show user-friendly error
            setError(errorData.message || errorData.error || 'Failed to provision number. Check console for details.');
            // Don't throw - allow firm creation to succeed even if number provision fails
            // User can retry later via the provision button if needed
          }
        } catch (provisionError) {
          console.error('Error calling provision-number API:', provisionError);
          // Don't throw - allow firm creation to succeed
        }
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

            {/* Vapi Phone Number */}
            {firm && (
      <div>
                <label 
                  htmlFor="vapi_phone_number" 
                  className="block text-xs font-semibold uppercase tracking-wide mb-2"
                  style={{ color: '#4A5D73' }}
                >
                  Phone Number
          </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!supabase || !firm) return;
                      
                      setLoading(true);
                      setError(null);
                      
                      try {
                        const response = await fetch('/api/vapi/provision-number', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({ 
                            firmId: firm.id
                          }),
                        });

                        const data = await response.json();
                        
                        if (!response.ok) {
                          const errorMsg = data.error || data.message || 'Failed to provision number';
                          throw new Error(errorMsg);
                        }

                        setSuccess(true);
                        setTimeout(() => {
                          setSuccess(false);
                          onSave();
                        }, 2000);
                      } catch (err: any) {
                        console.error('Error provisioning number:', err);
                        setError(err.message || 'Failed to provision number. Check browser console for details.');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                    className="h-12 px-6 rounded-lg font-semibold text-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: loading ? '#4A5D73' : '#0B1F3B',
                      color: '#FFFFFF',
                    }}
                  >
                    {loading ? 'Provisioning...' : 'Provision Phone Number'}
                  </button>
                </div>
                <p className="mt-1.5 text-xs" style={{ color: '#4A5D73', opacity: 0.7 }}>
                  Each firm is assigned a dedicated AI intake number automatically. Calls to this number are handled by IntakeGenie.
                </p>
                {(firm.vapi_phone_number || firm.twilio_number) && (
                  <div className="mt-2">
                    <p className="text-sm font-medium" style={{ color: '#0B1F3B' }}>
                      Current number: {firm.vapi_phone_number || firm.twilio_number}
                    </p>
                    {firm.vapi_phone_number && (firm.vapi_phone_number.includes('ID:') || firm.vapi_phone_number.includes('Dashboard')) && (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={async () => {
                            if (!supabase || !firm) return;
                            
                            setLoading(true);
                            setError(null);
                            
                            try {
                              const response = await fetch('/api/vapi/refresh-phone-number', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({ firmId: firm.id }),
                              });

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
                                setError(data.note || 'Phone number not yet available via API. Check Vapi dashboard.');
                                if (data.dashboardUrl) {
                                  window.open(data.dashboardUrl, '_blank');
                                }
                              }
                            } catch (err: any) {
                              console.error('Error refreshing number:', err);
                              setError(err.message || 'Failed to refresh number');
                            } finally {
                              setLoading(false);
                            }
                          }}
                          disabled={loading}
                          className="text-xs px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
                        >
                          Refresh Number
                        </button>
                        <p className="text-xs text-gray-500 mt-1">
                          Vapi assigns numbers asynchronously. Check <a href="https://dashboard.vapi.ai" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Vapi dashboard</a> to see the number.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
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

