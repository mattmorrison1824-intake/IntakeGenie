import { createServerClient } from '@/lib/clients/supabase';
import { redirect } from 'next/navigation';
import { PlatformLayout } from '@/components/platform-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import PhoneNumberProvision from '@/components/PhoneNumberProvision';

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
  const { data: firmData, error: firmError } = await supabase
    .from('firms')
    .select('*')
    .eq('owner_user_id', session.user.id)
    .limit(1)
    .maybeSingle(); // Use maybeSingle() instead of single() - returns null instead of error when no row found

  // Check for actual errors (not just "no rows found")
  if (firmError && firmError.code !== 'PGRST116') {
    console.error('[Dashboard] Error fetching firm:', firmError);
    // Return error state only for real errors
    return (
      <PlatformLayout>
        <div className="p-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <p>Error loading firm data. Please try refreshing the page.</p>
          </div>
        </div>
      </PlatformLayout>
    );
  }

  const firm = firmData || null;

  // Get recent calls count (only if firm exists)
  const { count: callsCount } = firm
    ? await supabase
        .from('calls')
        .select('*', { count: 'exact', head: true })
        .eq('firm_id', (firm as any).id)
    : { count: 0 };

  // Get leads count (calls where customer provided their name)
  // A lead is defined as a call with a full_name in intake_json that is not null/empty
  // Using PostgREST JSONB operator: intake_json->>'full_name' extracts text value
  let leadsCount = 0;
  if (firm) {
    try {
      const { count, error } = await supabase
        .from('calls')
        .select('*', { count: 'exact', head: true })
        .eq('firm_id', (firm as any).id)
        .not('intake_json->>full_name', 'is', null)
        .neq('intake_json->>full_name', '');
      
      if (error) {
        console.error('[Dashboard] Error counting leads, using fallback:', error);
        // Fallback: fetch calls and filter in memory
        const { data: allCalls } = await supabase
          .from('calls')
          .select('intake_json')
          .eq('firm_id', (firm as any).id);
        
        leadsCount = (allCalls || []).filter((call: any) => {
          const intake = call.intake_json as any;
          return intake?.full_name && intake.full_name.trim().length > 0;
        }).length;
      } else {
        leadsCount = count || 0;
      }
    } catch (err) {
      console.error('[Dashboard] Exception counting leads:', err);
      // Fallback: fetch calls and filter in memory
      const { data: allCalls } = await supabase
        .from('calls')
        .select('intake_json')
        .eq('firm_id', (firm as any).id);
      
      leadsCount = (allCalls || []).filter((call: any) => {
        const intake = call.intake_json as any;
        return intake?.full_name && intake.full_name.trim().length > 0;
      }).length;
    }
  }

  // Get recent calls (only if firm exists)
  const { data: recentCallsData } = firm
    ? await supabase
        .from('calls')
        .select('*')
        .eq('firm_id', (firm as any).id)
        .order('started_at', { ascending: false })
        .limit(5)
    : { data: null };

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
                    Leads Generated
                      </div>
                  <div className="text-3xl font-bold" style={{ color: '#0B1F3B' }}>
                    {leadsCount || 0}
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
                    {(firm as any).firm_name}
                  </div>
                </div>
                      </div>

              {/* Subscription Status */}
              <div 
                className="bg-white rounded-xl shadow-sm p-8"
                style={{
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                }}
              >
                <div className="mb-6">
                  <h2 className="text-lg font-semibold mb-1" style={{ color: '#4A5D73' }}>
                    Subscription
                  </h2>
                  <p className="text-sm" style={{ color: '#4A5D73', opacity: 0.7 }}>
                    Your current subscription plan and status
                  </p>
                </div>
                
                {(firm as any).subscription_status && (firm as any).subscription_status !== 'inactive' ? (
                  <div className="space-y-4">
                    <div className="grid gap-6 md:grid-cols-2 border-b border-gray-200 pb-6">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#4A5D73' }}>
                          Current Plan
                        </div>
                        <div className="text-lg font-bold capitalize" style={{ color: '#0B1F3B' }}>
                          {(firm as any).subscription_plan || 'Unknown'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#4A5D73' }}>
                          Status
                        </div>
                        <div>
                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                              (firm as any).subscription_status === 'active' || (firm as any).subscription_status === 'trialing'
                                ? 'bg-green-50 text-green-700 border border-green-200'
                                : (firm as any).subscription_status === 'canceled' || (firm as any).subscription_status === 'past_due' || (firm as any).subscription_status === 'unpaid'
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                            }`}
                          >
                            {(firm as any).subscription_status === 'trialing' ? 'Trial' : (firm as any).subscription_status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                      {(firm as any).subscription_current_period_end && ((firm as any).subscription_status === 'active' || (firm as any).subscription_status === 'trialing') && (
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#4A5D73' }}>
                            {(firm as any).subscription_cancel_at_period_end ? 'Expires On' : 'Renews On'}
                          </div>
                          <div className="text-sm" style={{ color: '#0B1F3B' }}>
                            {new Date((firm as any).subscription_current_period_end).toLocaleDateString('en-US', { 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}
                          </div>
                        </div>
                      )}
                      {(firm as any).subscription_cancel_at_period_end && (
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#4A5D73' }}>
                            Cancellation
                          </div>
                          <div className="text-sm text-orange-600">
                            Will cancel at period end
                          </div>
                        </div>
                      )}
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
                      <Link href="/">Manage Subscription</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="pb-6">
                      <p className="text-sm" style={{ color: '#4A5D73', opacity: 0.8 }}>
                        No active subscription. Subscribe to a plan to start using IntakeGenie.
                      </p>
                    </div>
                    <Button 
                      asChild 
                      className="h-12 px-6 rounded-lg font-semibold cursor-pointer"
                      style={{ backgroundColor: '#0B1F3B', color: '#FFFFFF' }}
                    >
                      <Link href="/">View Plans</Link>
                    </Button>
                  </div>
                )}
              </div>

              {/* Phone Number Provision/Display */}
              <PhoneNumberProvision 
                firm={firm}
              />

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
                      Notification Emails
                    </div>
                    <div className="text-sm" style={{ color: '#0B1F3B' }}>{(firm as any).notify_emails?.join(', ') || 'None'}</div>
                    </div>
                    <div>
                    <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#4A5D73' }}>
                      Timezone
                    </div>
                    <div className="text-sm" style={{ color: '#0B1F3B' }}>{(firm as any).timezone}</div>
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
