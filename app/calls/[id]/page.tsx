import { createServerClient } from '@/lib/clients/supabase';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import CallDetail from '@/components/CallDetail';
import { PlatformLayout } from '@/components/platform-layout';
import { Button } from '@/components/ui/button';

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic';

export default async function CallDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  // Get call
  const { data: call, error } = await supabase
    .from('calls')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error || !call) {
    redirect('/calls');
  }

  // Verify user owns the firm that owns this call
  const { data: firmData } = await supabase
    .from('firms')
    .select('owner_user_id')
    .eq('id', (call as any).firm_id)
    .single();

  const firm = firmData as any;
  if (!firm || firm.owner_user_id !== session.user.id) {
    redirect('/calls');
  }

  return (
    <PlatformLayout>
      <div className="w-full px-4 py-4">
        <div className="max-w-7xl mx-auto px-4 py-8 rounded-xl" style={{ backgroundColor: '#F5F7FA', minHeight: 'calc(100vh - 4rem)' }}>
          <div className="mb-6">
            <Button 
              variant="ghost" 
              asChild 
              className="mb-4 h-10 px-4 rounded-lg cursor-pointer"
              style={{ color: '#0B1F3B' }}
            >
              <Link href="/calls">← Back to Calls</Link>
            </Button>
            <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ color: '#0B1F3B' }}>
              Call Details
            </h1>
            <p className="text-sm" style={{ color: '#4A5D73' }}>
              View detailed information about this call
            </p>
          </div>
          <CallDetail call={call as any} />
        </div>
      </div>
    </PlatformLayout>
  );
}

