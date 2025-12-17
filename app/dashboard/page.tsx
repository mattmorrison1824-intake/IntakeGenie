import { createServerClient } from '@/lib/clients/supabase';
import { redirect } from 'next/navigation';
import { PlatformLayout } from '@/components/platform-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  // Get user's firm
  const { data: firmData } = await supabase
    .from('firms')
    .select('*')
    .eq('owner_user_id', session.user.id)
    .limit(1)
    .single();

  const firm = firmData as any;

  // Get recent calls count
  const { count: callsCount } = await supabase
    .from('calls')
    .select('*', { count: 'exact', head: true })
    .eq('firm_id', firm?.id || '');

  // Get recent calls
  const { data: recentCallsData } = await supabase
    .from('calls')
    .select('*')
    .eq('firm_id', firm?.id || '')
    .order('started_at', { ascending: false })
    .limit(5);

  const recentCalls = (recentCallsData || []) as any[];

  return (
    <PlatformLayout>
      <div className="w-full px-4 py-4">
        <div className="max-w-7xl mx-auto px-4 py-8 rounded-xl" style={{ backgroundColor: '#F5F7FA', minHeight: 'calc(100vh - 4rem)' }}>
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ color: '#0B1F3B' }}>
              Dashboard
            </h1>
            <p className="text-sm" style={{ color: '#4A5D73' }}>
              Overview of your firm's call activity and settings
            </p>
          </div>

          {!firm ? (
            <div 
              className="bg-white rounded-xl shadow-sm p-8"
              style={{
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
              }}
            >
              <h2 className="text-xl font-semibold mb-2" style={{ color: '#0B1F3B' }}>
                No Firm Configured
              </h2>
              <p className="text-sm mb-6" style={{ color: '#4A5D73', opacity: 0.8 }}>
                Please configure your firm settings to start receiving calls.
              </p>
              <Button 
                asChild
                className="h-12 px-6 rounded-lg font-semibold cursor-pointer"
                style={{ backgroundColor: '#0B1F3B', color: '#FFFFFF' }}
              >
                <Link href="/settings">Go to Settings</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid gap-6 md:grid-cols-3">
                <div 
                  className="bg-white rounded-xl shadow-sm p-6"
                  style={{
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                  }}
                >
                  <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#4A5D73' }}>
                    Total Calls
                  </div>
                  <div className="text-3xl font-bold" style={{ color: '#0B1F3B' }}>
                    {callsCount || 0}
                  </div>
                </div>
                <div 
                  className="bg-white rounded-xl shadow-sm p-6"
                  style={{
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                  }}
                >
                  <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#4A5D73' }}>
                    Firm Name
                  </div>
                  <div className="text-2xl font-bold" style={{ color: '#0B1F3B' }}>
                    {firm.firm_name}
                  </div>
                </div>
                <div 
                  className="bg-white rounded-xl shadow-sm p-6"
                  style={{
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                  }}
                >
                  <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#4A5D73' }}>
                    Routing Mode
                  </div>
                  <div className="text-2xl font-bold capitalize" style={{ color: '#0B1F3B' }}>
                    {firm.mode.replace('_', ' ')}
                  </div>
                </div>
              </div>

              {/* IntakeGenie Number Card */}
              {firm.twilio_number && (
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
                  <div className="text-2xl font-bold" style={{ color: '#0B1F3B' }}>
                    {firm.twilio_number.replace(/^\+?(\d{1})(\d{3})(\d{3})(\d{4})$/, '+$1 ($2) $3-$4')}
                  </div>
                </div>
              )}

              {/* Firm Settings Summary */}
              <div 
                className="bg-white rounded-xl shadow-sm p-8"
                style={{
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                }}
              >
                <div className="mb-6">
                  <h2 className="text-lg font-semibold mb-1" style={{ color: '#4A5D73' }}>
                    Firm Settings Summary
                  </h2>
                  <p className="text-sm" style={{ color: '#4A5D73', opacity: 0.7 }}>
                    Current configuration for your firm
                  </p>
                </div>
                <div className="grid gap-6 md:grid-cols-2 border-b border-gray-200 pb-6 mb-6">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#4A5D73' }}>
                      Forward To Number
                    </div>
                    <div className="text-sm" style={{ color: '#0B1F3B' }}>{firm.forward_to_number}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#4A5D73' }}>
                      Notification Emails
                    </div>
                    <div className="text-sm" style={{ color: '#0B1F3B' }}>{firm.notify_emails?.join(', ') || 'None'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#4A5D73' }}>
                      Timezone
                    </div>
                    <div className="text-sm" style={{ color: '#0B1F3B' }}>{firm.timezone}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#4A5D73' }}>
                      Business Hours
                    </div>
                    <div className="text-sm" style={{ color: '#0B1F3B' }}>{firm.open_time} - {firm.close_time}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#4A5D73' }}>
                      Open Days
                    </div>
                    <div className="text-sm" style={{ color: '#0B1F3B' }}>
                      {firm.open_days
                        .map((d: number) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d])
                        .join(', ')}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#4A5D73' }}>
                      Failover Ring Duration
                    </div>
                    <div className="text-sm" style={{ color: '#0B1F3B' }}>{firm.failover_ring_seconds} seconds</div>
                  </div>
                </div>
                <Button 
                  asChild 
                  variant="outline"
                  className="h-12 px-6 rounded-lg font-semibold cursor-pointer border"
                  style={{ 
                    borderColor: '#E5E7EB',
                    color: '#0B1F3B',
                  }}
                >
                  <Link href="/settings">Edit Settings</Link>
                </Button>
              </div>

              {/* Recent Calls */}
              {recentCalls && recentCalls.length > 0 && (
                <div 
                  className="bg-white rounded-xl shadow-sm overflow-hidden"
                  style={{
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                  }}
                >
                  <div className="p-8 border-b border-gray-200">
                    <h2 className="text-lg font-semibold mb-1" style={{ color: '#4A5D73' }}>
                      Recent Calls
                    </h2>
                    <p className="text-sm" style={{ color: '#4A5D73', opacity: 0.7 }}>
                      Latest call activity
                    </p>
                  </div>
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
                            Status
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A5D73' }}>
                            Urgency
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentCalls.map((call) => {
                          const intake = call.intake_json as any;
                          const callerName = intake?.full_name || call.from_number || 'Unknown';
                          return (
                            <tr key={call.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 text-sm" style={{ color: '#0B1F3B' }}>{callerName}</td>
                              <td className="px-6 py-4 text-sm" style={{ color: '#4A5D73', opacity: 0.8 }}>
                                {new Date(call.started_at).toLocaleString()}
                              </td>
                              <td className="px-6 py-4">
                                <span
                                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                                    call.status === 'emailed'
                                      ? 'bg-green-50 text-green-700 border border-green-200'
                                      : call.status === 'error'
                                        ? 'bg-red-50 text-red-700 border border-red-200'
                                        : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                                  }`}
                                >
                                  {call.status}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <span
                                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                                    call.urgency === 'high'
                                      ? 'bg-red-50 text-red-700 border border-red-200'
                                      : call.urgency === 'emergency_redirected'
                                        ? 'bg-orange-50 text-orange-700 border border-orange-200'
                                        : 'bg-gray-50 text-gray-700 border border-gray-200'
                                  }`}
                                >
                                  {call.urgency}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="p-6 border-t border-gray-200">
                    <Button 
                      asChild 
                      variant="outline"
                      className="h-12 px-6 rounded-lg font-semibold cursor-pointer border"
                      style={{ 
                        borderColor: '#E5E7EB',
                        color: '#0B1F3B',
                      }}
                    >
                      <Link href="/calls">View All Calls</Link>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </PlatformLayout>
  );
}
