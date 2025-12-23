'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CreditCard, FileText, Calendar, AlertCircle } from 'lucide-react';

interface BillingClientProps {
  firm: any;
}

interface Invoice {
  id: string;
  number: string | null;
  amount_paid: number;
  amount_due: number;
  currency: string;
  status: string;
  created: number;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  period_start: number | null;
  period_end: number | null;
  description: string | null;
}

import { PLAN_LIMITS } from '@/lib/constants/plans';

const PLAN_DETAILS = {
  starter: { name: PLAN_LIMITS.starter.name, price: `$${PLAN_LIMITS.starter.price}`, minutes: `${PLAN_LIMITS.starter.minutesPerMonth} minutes` },
  professional: { name: PLAN_LIMITS.professional.name, price: `$${PLAN_LIMITS.professional.price}`, minutes: `${PLAN_LIMITS.professional.minutesPerMonth} minutes` },
  turbo: { name: PLAN_LIMITS.turbo.name, price: `$${PLAN_LIMITS.turbo.price}`, minutes: `${PLAN_LIMITS.turbo.minutesPerMonth} minutes` },
};

export default function BillingClient({ firm }: BillingClientProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [updatingPlan, setUpdatingPlan] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      const response = await fetch('/api/stripe/invoices');
      const data = await response.json();
      if (data.invoices) {
        setInvoices(data.invoices);
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handlePlanChange = async (newPlan: string) => {
    if (!confirm(`Are you sure you want to change your plan to ${PLAN_DETAILS[newPlan as keyof typeof PLAN_DETAILS]?.name}? You will be charged or credited for the prorated difference.`)) {
      return;
    }

    setUpdatingPlan(newPlan);
    try {
      const response = await fetch('/api/stripe/subscription/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: newPlan }),
      });

      const data = await response.json();
      if (data.success) {
        window.location.reload();
      } else {
        alert(data.error || 'Failed to update subscription');
      }
    } catch (error: any) {
      console.error('Error updating subscription:', error);
      alert('Failed to update subscription. Please try again.');
    } finally {
      setUpdatingPlan(null);
    }
  };

  const handleCancel = async (immediately: boolean = false) => {
    const message = immediately
      ? 'Are you sure you want to cancel your subscription immediately? You will lose access immediately and will not receive a refund.'
      : 'Are you sure you want to cancel your subscription? It will remain active until the end of the current billing period.';
    
    if (!confirm(message)) {
      return;
    }

    setCanceling(true);
    try {
      const response = await fetch('/api/stripe/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ immediately }),
      });

      const data = await response.json();
      if (data.success) {
        alert(data.message || 'Subscription canceled');
        window.location.reload();
      } else {
        alert(data.error || 'Failed to cancel subscription');
      }
    } catch (error: any) {
      console.error('Error canceling subscription:', error);
      alert('Failed to cancel subscription. Please try again.');
    } finally {
      setCanceling(false);
    }
  };

  const handleOpenPortal = async () => {
    setOpeningPortal(true);
    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Failed to open billing portal');
        setOpeningPortal(false);
      }
    } catch (error: any) {
      console.error('Error opening portal:', error);
      alert('Failed to open billing portal. Please try again.');
      setOpeningPortal(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'usd') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const hasActiveSubscription = firm.subscription_status && 
    ['active', 'trialing'].includes(firm.subscription_status);

  const currentPlan = (firm?.subscription_plan || 'starter') as keyof typeof PLAN_DETAILS;

  return (
    <div className="space-y-6">
      {/* Current Subscription */}
      <Card className="bg-white rounded-xl shadow-sm" style={{ boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)' }}>
        <CardHeader>
          <CardTitle style={{ color: '#0B1F3B' }}>Current Subscription</CardTitle>
          <CardDescription style={{ color: '#4A5D73' }}>
            Your active subscription plan and billing details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {hasActiveSubscription ? (
            <>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#4A5D73' }}>
                    Current Plan
                  </div>
                  <div className="text-2xl font-bold" style={{ color: '#0B1F3B' }}>
                    {PLAN_DETAILS[currentPlan]?.name || 'Unknown'}
                  </div>
                  <div className="text-sm mt-1" style={{ color: '#4A5D73' }}>
                    {PLAN_DETAILS[currentPlan]?.price}/month • {PLAN_DETAILS[currentPlan]?.minutes}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#4A5D73' }}>
                    Status
                  </div>
                  <div>
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                        firm.subscription_status === 'active' || firm.subscription_status === 'trialing'
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                      }`}
                    >
                      {firm.subscription_status === 'trialing' ? 'Trial' : firm.subscription_status.replace('_', ' ')}
                    </span>
                  </div>
                  {firm.subscription_cancel_at_period_end && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-orange-600">
                      <AlertCircle className="h-4 w-4" />
                      <span>Will cancel at period end</span>
                    </div>
                  )}
                </div>
                {firm.subscription_current_period_end && (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#4A5D73' }}>
                      {firm.subscription_cancel_at_period_end ? 'Expires On' : 'Next Billing Date'}
                    </div>
                    <div className="text-sm" style={{ color: '#0B1F3B' }}>
                      <Calendar className="inline h-4 w-4 mr-1" />
                      {new Date(firm.subscription_current_period_end).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Plan Management */}
              {!firm.subscription_cancel_at_period_end && (
                <div className="border-t border-gray-200 pt-6">
                  <div className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: '#4A5D73' }}>
                    Change Plan
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    {(['starter', 'professional', 'turbo'] as const).map((plan) => {
                      const planDetail = PLAN_DETAILS[plan];
                      const isCurrentPlan = currentPlan === plan;
                      return (
                        <div
                          key={plan}
                          className={`p-4 rounded-lg border-2 ${
                            isCurrentPlan
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="font-semibold mb-1" style={{ color: '#0B1F3B' }}>
                            {planDetail.name}
                          </div>
                          <div className="text-sm mb-3" style={{ color: '#4A5D73' }}>
                            {planDetail.price}/month
                          </div>
                          {isCurrentPlan ? (
                            <div className="text-sm text-blue-600 font-medium">Current Plan</div>
                          ) : (
                            <Button
                              onClick={() => handlePlanChange(plan)}
                              disabled={updatingPlan === plan}
                              size="sm"
                              variant="outline"
                              className="w-full"
                            >
                              {updatingPlan === plan ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Updating...
                                </>
                              ) : (
                                `Switch to ${planDetail.name}`
                              )}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="border-t border-gray-200 pt-6 flex gap-3 flex-wrap">
                <Button
                  onClick={handleOpenPortal}
                  disabled={openingPortal}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <CreditCard className="h-4 w-4" />
                  {openingPortal ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Opening...
                    </>
                  ) : (
                    'Manage Payment Method'
                  )}
                </Button>
                {!firm.subscription_cancel_at_period_end && (
                  <Button
                    onClick={() => handleCancel(false)}
                    disabled={canceling}
                    variant="outline"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    {canceling ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Canceling...
                      </>
                    ) : (
                      'Cancel Subscription'
                    )}
                  </Button>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm mb-4" style={{ color: '#4A5D73' }}>
                No active subscription. Subscribe to a plan to start using IntakeGenie.
              </p>
              <Button
                asChild
                className="h-12 px-6 rounded-lg font-semibold cursor-pointer"
                style={{ backgroundColor: '#0B1F3B', color: '#FFFFFF' }}
              >
                <a href="/">View Plans</a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billing History */}
      {hasActiveSubscription && (
        <Card className="bg-white rounded-xl shadow-sm" style={{ boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)' }}>
          <CardHeader>
            <CardTitle style={{ color: '#0B1F3B' }}>Billing History</CardTitle>
            <CardDescription style={{ color: '#4A5D73' }}>
              View and download your past invoices
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingInvoices ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" style={{ color: '#4A5D73' }} />
              </div>
            ) : invoices.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto mb-4" style={{ color: '#4A5D73', opacity: 0.5 }} />
                <p className="text-sm" style={{ color: '#4A5D73' }}>
                  No invoices yet
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A5D73' }}>
                        Invoice
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A5D73' }}>
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A5D73' }}>
                        Amount
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A5D73' }}>
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A5D73' }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => (
                      <tr key={invoice.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-4 text-sm" style={{ color: '#0B1F3B' }}>
                          {invoice.number || invoice.id.slice(-8)}
                        </td>
                        <td className="px-4 py-4 text-sm" style={{ color: '#4A5D73' }}>
                          {formatDate(invoice.created)}
                        </td>
                        <td className="px-4 py-4 text-sm font-medium" style={{ color: '#0B1F3B' }}>
                          {formatCurrency(invoice.amount_paid || invoice.amount_due, invoice.currency)}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
                              invoice.status === 'paid'
                                ? 'bg-green-50 text-green-700 border border-green-200'
                                : invoice.status === 'open'
                                ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                            }`}
                          >
                            {invoice.status}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex gap-2">
                            {invoice.hosted_invoice_url && (
                              <a
                                href={invoice.hosted_invoice_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:text-blue-700"
                              >
                                View
                              </a>
                            )}
                            {invoice.invoice_pdf && (
                              <a
                                href={invoice.invoice_pdf}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:text-blue-700"
                              >
                                PDF
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

