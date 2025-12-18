'use client';

import { useRouter } from 'next/navigation';
import { Call, CallStatus, UrgencyLevel } from '@/types';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

interface CallsListProps {
  calls: Call[];
  searchParams: { status?: string; urgency?: string };
}

export default function CallsList({ calls, searchParams }: CallsListProps) {
  const router = useRouter();

  const getStatusBadgeClass = (status: CallStatus) => {
    switch (status) {
      case 'emailed':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'error':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'in_progress':
      case 'transcribing':
      case 'summarizing':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getUrgencyValue = (urgency: UrgencyLevel): number => {
    switch (urgency) {
      case 'emergency_redirected':
        return 5;
      case 'high':
        return 4;
      default:
        return 1;
    }
  };

  const getUrgencyColor = (urgency: UrgencyLevel): string => {
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
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const callDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    if (callDate.getTime() === today.getTime()) {
      return `Today, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    }
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (callDate.getTime() === yesterday.getTime()) {
      return `Yesterday, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    }
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const getCategory = (call: Call): string => {
    // Use stored call_category if available (extracted from summary title)
    if ((call as any).call_category) {
      return (call as any).call_category;
    }
    // Fallback: try to extract from summary title
    const summary = call.summary_json as any;
    if (summary?.title) {
      const match = summary.title.match(/^([^-]+?)(?:\s*-\s*|$)/);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    // Final fallback: use intake reason or route reason
    const intake = call.intake_json as any;
    if (intake?.reason_for_call) {
      const reason = intake.reason_for_call.toLowerCase();
      if (reason.includes('work') || reason.includes('injury')) return 'Work Injury';
      if (reason.includes('accident') || reason.includes('car')) return 'Accident';
      if (reason.includes('question') || reason.includes('inquiry')) return 'General Questioning';
    }
    if (call.route_reason === 'after_hours') return 'After Hours';
    if (call.route_reason === 'no_answer') return 'No Answer';
    return 'Intake Call';
  };

  const handleCallSelect = (callId: string) => {
    router.push(`/calls/${callId}`);
  };

  const handleFilter = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newParams = new URLSearchParams();
    if (formData.get('status')) newParams.set('status', formData.get('status') as string);
    if (formData.get('urgency')) newParams.set('urgency', formData.get('urgency') as string);
    router.push(`/calls?${newParams.toString()}`);
  };

  return (
    <div className="flex flex-col">
      {/* Filters */}
      <div className="p-6 border-b border-gray-200">
        <form onSubmit={handleFilter} className="flex gap-4 flex-wrap items-end">
          <div className="flex-1 min-w-[150px]">
            <label 
              htmlFor="status" 
              className="block text-xs font-semibold uppercase tracking-wide mb-2"
              style={{ color: '#4A5D73' }}
            >
              Status
            </label>
            <select
              id="status"
              name="status"
              className="w-full h-10 px-3 rounded-lg border text-sm"
              style={{
                borderColor: '#E5E7EB',
                backgroundColor: '#FFFFFF',
              }}
              defaultValue={searchParams.status || ''}
            >
              <option value="">All</option>
              <option value="in_progress">In Progress</option>
              <option value="transcribing">Transcribing</option>
              <option value="summarizing">Summarizing</option>
              <option value="emailed">Emailed</option>
              <option value="error">Error</option>
            </select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label 
              htmlFor="urgency" 
              className="block text-xs font-semibold uppercase tracking-wide mb-2"
              style={{ color: '#4A5D73' }}
            >
              Urgency
            </label>
            <select
              id="urgency"
              name="urgency"
              className="w-full h-10 px-3 rounded-lg border text-sm"
              style={{
                borderColor: '#E5E7EB',
                backgroundColor: '#FFFFFF',
              }}
              defaultValue={searchParams.urgency || ''}
            >
              <option value="">All</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="emergency_redirected">Emergency</option>
            </select>
          </div>
          <div>
            <Button 
              type="submit"
              className="h-10 px-4 rounded-lg font-semibold text-sm"
              style={{ backgroundColor: '#0B1F3B', color: '#FFFFFF' }}
            >
              Filter
            </Button>
          </div>
        </form>
      </div>

      {/* Table */}
      <div className="overflow-auto">
        {!calls || calls.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm" style={{ color: '#4A5D73', opacity: 0.8 }}>No calls found.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr className="border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A5D73' }}>
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A5D73' }}>
                  From
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A5D73' }}>
                  Category
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A5D73' }}>
                  Urgency
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A5D73' }}>
                  Duration
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A5D73' }}>
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A5D73' }}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {calls.map((call) => {
                const urgencyValue = getUrgencyValue(call.urgency);
                const urgencyColor = getUrgencyColor(call.urgency);
                
                return (
                  <tr
                    key={call.id}
                    className="border-b border-gray-100 transition-colors hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/calls/${call.id}`)}
                  >
                    <td className="px-4 py-3 text-sm" style={{ color: '#0B1F3B' }}>
                      {formatDate(call.started_at)}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: '#0B1F3B' }}>
                      {call.from_number}
                    </td>
                    <td className="px-4 py-3 text-sm capitalize" style={{ color: '#4A5D73' }}>
                      {getCategory(call)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium" style={{ color: '#0B1F3B' }}>
                          {urgencyValue}/5
                        </span>
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden" style={{ maxWidth: '80px' }}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${(urgencyValue / 5) * 100}%`,
                              backgroundColor: urgencyColor,
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: '#4A5D73' }}>
                      {formatDuration(call.started_at, call.ended_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-1 inline-flex text-xs leading-4 font-semibold rounded-full ${
                            call.status === 'emailed' 
                              ? 'bg-green-50 text-green-700' 
                              : 'bg-gray-50 text-gray-700'
                          }`}
                        >
                          {call.status === 'emailed' ? 'Resolved' : call.status}
                        </span>
                        {call.transcript_text && (
                          <span className="text-xs text-green-600" title="Transcript available">
                            📝
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (confirm('Are you sure you want to delete this call? This action cannot be undone.')) {
                              try {
                                const response = await fetch(`/api/calls/${call.id}`, {
                                  method: 'DELETE',
                                  headers: {
                                    'Content-Type': 'application/json',
                                  },
                                });
                                
                                let data;
                                try {
                                  data = await response.json();
                                } catch (jsonError) {
                                  const text = await response.text();
                                  console.error('Failed to parse response:', text);
                                  alert(`Failed to delete call: Server returned invalid response`);
                                  return;
                                }
                                
                                if (response.ok && data.success) {
                                  // Force a hard refresh of the page to ensure the call is removed
                                  window.location.reload();
                                } else {
                                  const errorMessage = data.error || 'Failed to delete call';
                                  console.error('Delete failed:', errorMessage, 'Response:', response.status);
                                  alert(`Failed to delete call: ${errorMessage}`);
                                }
                              } catch (error) {
                                console.error('Error deleting call:', error);
                                alert('Failed to delete call. Please check the console for details.');
                              }
                            }
                          }}
                          className="p-1 hover:bg-red-100 rounded hover:text-red-600"
                          style={{ color: '#4A5D73' }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {calls && calls.length > 0 && (
        <div className="p-6 border-t border-gray-200 flex items-center justify-between text-sm" style={{ color: '#4A5D73' }}>
          <div>
            Items per page: 10
          </div>
          <div>
            1-{Math.min(10, calls.length)} of {calls.length}
          </div>
        </div>
      )}
    </div>
  );
}

