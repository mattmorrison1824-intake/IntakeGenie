import { createServerClient } from '@/lib/clients/supabase';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { CallStatus, UrgencyLevel } from '@/types';
import { PlatformLayout } from '@/components/platform-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default async function CallsPage({
  searchParams,
}: {
  searchParams: { status?: string; urgency?: string };
}) {
  try {
    const supabase = await createServerClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      redirect('/login');
    }

    // Get user's firm
    const { data: firmData, error: firmError } = await supabase
      .from('firms')
      .select('id')
      .eq('owner_user_id', session.user.id)
      .limit(1)
      .single();

    if (firmError || !firmData) {
      redirect('/settings');
    }

    const firm = firmData as any;

    // Build query
    let query = supabase
      .from('calls')
      .select('*')
      .eq('firm_id', firm.id)
      .order('started_at', { ascending: false });

    // Apply filters
    if (searchParams.status) {
      query = query.eq('status', searchParams.status);
    }
    if (searchParams.urgency) {
      query = query.eq('urgency', searchParams.urgency);
    }

    const { data: calls, error } = await query;

    if (error) {
      console.error('Error fetching calls:', error);
    }

    const callsList = calls || [];

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

  const getUrgencyBadgeClass = (urgency: UrgencyLevel) => {
    switch (urgency) {
      case 'high':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'emergency_redirected':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <PlatformLayout>
      <div className="w-full px-4 py-4">
        <div className="max-w-7xl mx-auto px-4 py-8 rounded-xl" style={{ backgroundColor: '#F5F7FA', minHeight: 'calc(100vh - 4rem)' }}>
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ color: '#0B1F3B' }}>
              Call Logs
            </h1>
            <p className="text-sm" style={{ color: '#4A5D73' }}>
              View and manage all incoming calls and their status
            </p>
          </div>

          {/* Filters */}
          <div 
            className="bg-white rounded-xl shadow-sm p-6 mb-6"
            style={{
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
            }}
          >
            <form method="get" className="flex gap-4 flex-wrap items-end">
              <div className="flex-1 min-w-[200px]">
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
              <div className="flex-1 min-w-[200px]">
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
                  defaultValue={searchParams.urgency || ''}
                >
                  <option value="">All</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="emergency_redirected">Emergency Redirected</option>
                </select>
              </div>
              <div>
                <Button 
                  type="submit"
                  className="h-12 px-6 rounded-lg font-semibold cursor-pointer"
                  style={{ backgroundColor: '#0B1F3B', color: '#FFFFFF' }}
                >
                  Filter
                </Button>
              </div>
            </form>
          </div>

          {/* Calls Table */}
          {!callsList || callsList.length === 0 ? (
            <div 
              className="bg-white rounded-xl shadow-sm p-12 text-center"
              style={{
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
              }}
            >
              <p className="text-sm" style={{ color: '#4A5D73', opacity: 0.8 }}>No calls found.</p>
            </div>
          ) : (
            <div 
              className="bg-white rounded-xl shadow-sm overflow-hidden"
              style={{
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
              }}
            >
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A5D73' }}>
                        Caller
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A5D73' }}>
                        Date
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A5D73' }}>
                        Route Reason
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A5D73' }}>
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A5D73' }}>
                        Urgency
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A5D73' }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {callsList.map((call: any) => {
                      const intake = call.intake_json as any;
                      const callerName = intake?.full_name || call.from_number || 'Unknown';
                      return (
                        <tr key={call.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: '#0B1F3B' }}>
                            {callerName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: '#4A5D73', opacity: 0.8 }}>
                            {new Date(call.started_at).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm capitalize" style={{ color: '#4A5D73', opacity: 0.8 }}>
                            {call.route_reason?.replace('_', ' ')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${getStatusBadgeClass(
                                call.status
                              )}`}
                            >
                              {call.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${getUrgencyBadgeClass(
                                call.urgency
                              )}`}
                            >
                              {call.urgency}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <Link
                              href={`/calls/${call.id}`}
                              className="cursor-pointer hover:underline"
                              style={{ color: '#0B1F3B' }}
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </PlatformLayout>
  );
  } catch (error) {
    console.error('Error in CallsPage:', error);
    // Return a safe fallback UI
    return (
      <PlatformLayout>
        <div className="w-full px-4 py-4">
          <div className="max-w-7xl mx-auto px-4 py-8 rounded-xl" style={{ backgroundColor: '#F5F7FA', minHeight: 'calc(100vh - 4rem)' }}>
            <div className="mb-8">
              <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ color: '#0B1F3B' }}>
                Call Logs
              </h1>
              <p className="text-sm" style={{ color: '#4A5D73' }}>
                View and manage all incoming calls and their status
              </p>
            </div>
            <div 
              className="bg-white rounded-xl shadow-sm p-12 text-center"
              style={{
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
              }}
            >
              <p className="text-sm" style={{ color: '#4A5D73', opacity: 0.8 }}>
                Unable to load calls. Please try again later.
              </p>
            </div>
          </div>
        </div>
      </PlatformLayout>
    );
  }
}

