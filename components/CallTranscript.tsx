'use client';

import { Call, IntakeData, SummaryData } from '@/types';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ChevronDown, ChevronUp, Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface CallTranscriptProps {
  call: Call;
}

export default function CallTranscript({ call }: CallTranscriptProps) {
  const router = useRouter();
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(true); // Default to open
  const [transcriptOpen, setTranscriptOpen] = useState(false); // Default to closed

  const intake = (call.intake_json as IntakeData) || {};
  const summary = (call.summary_json as SummaryData) || null;

  const getUrgencyValue = (urgency: string): number => {
    switch (urgency) {
      case 'emergency_redirected':
        return 5;
      case 'high':
        return 4;
      default:
        return 1;
    }
  };

  const getUrgencyColor = (urgency: string): string => {
    const value = getUrgencyValue(urgency);
    if (value >= 4) return '#DC2626'; // red
    if (value >= 3) return '#F59E0B'; // orange
    return '#10B981'; // green
  };

  const formatDuration = (startedAt: string, endedAt: string | null): string => {
    if (!endedAt) return 'Ongoing';
    const start = new Date(startedAt).getTime();
    const end = new Date(endedAt).getTime();
    const seconds = Math.floor((end - start) / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  // Parse transcript into conversation turns
  const parseTranscript = (transcript: string | null): Array<{ role: 'assistant' | 'user'; content: string }> => {
    if (!transcript) return [];
    
    // Simple parsing - split by lines and identify speaker
    const lines = transcript.split('\n').filter(line => line.trim());
    const turns: Array<{ role: 'assistant' | 'user'; content: string }> = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // Check if line starts with common patterns
      if (trimmed.toLowerCase().includes('ai') || trimmed.toLowerCase().includes('assistant') || trimmed.toLowerCase().includes('receptionist')) {
        turns.push({ role: 'assistant', content: trimmed });
      } else if (trimmed.toLowerCase().includes('caller') || trimmed.toLowerCase().includes('user')) {
        turns.push({ role: 'user', content: trimmed });
      } else {
        // Default to user if unclear
        turns.push({ role: 'user', content: trimmed });
      }
    }
    
    return turns.length > 0 ? turns : [{ role: 'assistant', content: transcript }];
  };

  const transcriptTurns = parseTranscript(call.transcript_text);
  const urgencyValue = getUrgencyValue(call.urgency);
  const urgencyColor = getUrgencyColor(call.urgency);

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => {
              router.push('/calls');
            }}
            className="flex items-center gap-2 text-sm hover:opacity-70 transition-opacity"
            style={{ color: '#0B1F3B' }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex items-center gap-2">
            <span
              className="px-3 py-1 text-xs font-semibold rounded-full"
              style={{
                backgroundColor: urgencyColor,
                color: '#FFFFFF',
              }}
            >
              {urgencyValue}/5
            </span>
            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-50 text-green-700">
              {call.status === 'emailed' ? 'Resolved' : call.status}
            </span>
          </div>
        </div>
        <h1 className="text-2xl font-bold mb-1" style={{ color: '#0B1F3B' }}>
          Call Transcript
        </h1>
        <p className="text-sm" style={{ color: '#4A5D73' }}>
          Review the conversation
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Call Details Card */}
        <div className="bg-white rounded-xl shadow-sm p-6" style={{ boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#4A5D73' }}>
                Status
              </div>
              <div style={{ color: '#0B1F3B' }}>
                {call.status === 'emailed' ? 'Resolved' : call.status}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#4A5D73' }}>
                Time
              </div>
              <div style={{ color: '#0B1F3B' }}>
                {formatDate(call.started_at)}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#4A5D73' }}>
                Duration
              </div>
              <div style={{ color: '#0B1F3B' }}>
                {formatDuration(call.started_at, call.ended_at)}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#4A5D73' }}>
                Caller
              </div>
              <div className="font-medium" style={{ color: '#0B1F3B' }}>
                {call.from_number}
              </div>
            </div>
          </div>
        </div>

        {/* Call Review (Expandable) - Default Open */}
        {summary && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden" style={{ boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
            <button
              onClick={() => setReviewOpen(!reviewOpen)}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <span className="font-semibold" style={{ color: '#0B1F3B' }}>Call Review</span>
              {reviewOpen ? <ChevronUp className="w-5 h-5" style={{ color: '#4A5D73' }} /> : <ChevronDown className="w-5 h-5" style={{ color: '#4A5D73' }} />}
            </button>
            {reviewOpen && (
              <div className="p-4 border-t border-gray-200 space-y-4">
                <div>
                  <h4 className="text-sm font-semibold mb-2" style={{ color: '#0B1F3B' }}>
                    {summary.title}
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-sm" style={{ color: '#4A5D73' }}>
                    {summary.summary_bullets.map((bullet, idx) => (
                      <li key={idx}>{bullet}</li>
                    ))}
                  </ul>
                </div>
                {summary.follow_up_recommendation && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#4A5D73' }}>
                      Follow-up Recommendation
                    </h4>
                    <p className="text-sm" style={{ color: '#0B1F3B' }}>
                      {summary.follow_up_recommendation}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Call Recording */}
        {call.recording_url && (
          <div className="bg-white rounded-xl shadow-sm p-6" style={{ boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: '#0B1F3B' }}>
                Call Recording
              </h2>
              <Button
                className="h-9 px-4 rounded-lg font-semibold text-sm flex items-center gap-2"
                style={{ backgroundColor: '#0B1F3B', color: '#FFFFFF' }}
                onClick={() => window.open(call.recording_url || '', '_blank')}
              >
                <Play className="w-4 h-4" />
                Listen to Recording
              </Button>
            </div>
            <p className="text-sm" style={{ color: '#4A5D73' }}>
              Click the button above to listen to the full call recording in a new tab.
            </p>
          </div>
        )}

        {/* Full Transcript (Collapsible, Default Closed) */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden" style={{ boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
          <button
            onClick={() => setTranscriptOpen(!transcriptOpen)}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="font-semibold" style={{ color: '#0B1F3B' }}>Full Transcript</span>
              {call.transcript_text ? (
                <span className="text-xs px-2 py-1 rounded-full bg-green-50 text-green-700">Available</span>
              ) : (
                <span className="text-xs px-2 py-1 rounded-full bg-gray-50 text-gray-500">Not available</span>
              )}
            </div>
            {transcriptOpen ? <ChevronUp className="w-5 h-5" style={{ color: '#4A5D73' }} /> : <ChevronDown className="w-5 h-5" style={{ color: '#4A5D73' }} />}
          </button>
          {transcriptOpen && (
            <div className="p-6 border-t border-gray-200">
                {transcriptTurns.length > 0 ? (
                  <div className="space-y-4">
                    {transcriptTurns.map((turn, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-semibold"
                          style={{
                            backgroundColor: turn.role === 'assistant' ? '#9333EA' : '#6B7280',
                          }}
                        >
                          {turn.role === 'assistant' ? 'AI' : 'C'}
                        </div>
                        <div className="flex-1">
                          <div className="text-xs font-semibold mb-1" style={{ color: '#4A5D73' }}>
                            {turn.role === 'assistant' ? 'AI Receptionist' : 'Caller'}
                          </div>
                          <div className="text-sm leading-relaxed" style={{ color: '#0B1F3B' }}>
                            {turn.content}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : call.transcript_text ? (
                  <div className="rounded-xl p-4" style={{ backgroundColor: '#F5F7FA' }}>
                    <pre className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: '#0B1F3B' }}>
                      {call.transcript_text}
                    </pre>
                  </div>
                ) : (
                  <div className="text-sm text-center py-8" style={{ color: '#4A5D73', opacity: 0.8 }}>
                    <p className="mb-2">No transcript available for this call.</p>
                    <p className="text-xs" style={{ color: '#4A5D73', opacity: 0.7 }}>
                      {call.status === 'transcribing' || call.status === 'summarizing' 
                        ? 'Transcript is being processed...' 
                        : call.status === 'error'
                        ? 'Transcript generation failed. Recording may not be available.'
                        : 'This call may not have been recorded or transcription is pending.'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

        {/* Call Analytics (Expandable) - Below Full Transcript */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden" style={{ boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
          <button
            onClick={() => setAnalyticsOpen(!analyticsOpen)}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <span className="font-semibold" style={{ color: '#0B1F3B' }}>Call Analytics</span>
            {analyticsOpen ? <ChevronUp className="w-5 h-5" style={{ color: '#4A5D73' }} /> : <ChevronDown className="w-5 h-5" style={{ color: '#4A5D73' }} />}
          </button>
          {analyticsOpen && (
            <div className="p-4 border-t border-gray-200">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#4A5D73' }}>
                    Route Reason
                  </div>
                  <div className="capitalize" style={{ color: '#0B1F3B' }}>
                    {call.route_reason?.replace('_', ' ')}
                  </div>
                </div>
                {intake.full_name && (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#4A5D73' }}>
                      Caller Name
                    </div>
                    <div style={{ color: '#0B1F3B' }}>
                      {intake.full_name}
                    </div>
                  </div>
                )}
                {intake.callback_number && (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#4A5D73' }}>
                      Callback Number
                    </div>
                    <div style={{ color: '#0B1F3B' }}>
                      {intake.callback_number}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

