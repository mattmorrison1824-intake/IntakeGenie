import { createServerClient } from '@/lib/clients/supabase';
import { redirect } from 'next/navigation';
import AIFirmKnowledgebase from '@/components/AIFirmKnowledgebase';
import { PlatformLayout } from '@/components/platform-layout';

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic';

export default async function KnowledgeBasePage() {
  const supabase = await createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  // Get user's firm
  const { data: firms, error } = await supabase
    .from('firms')
    .select('*')
    .eq('owner_user_id', session.user.id)
    .limit(1)
    .single();

  const firm = firms || null;

  const refreshData = async () => {
    'use server';
    // This will trigger a refresh of the page
  };

  return (
    <PlatformLayout>
      <div className="w-full flex justify-center px-4 py-4">
        <div className="w-full max-w-[900px] px-4 py-8 rounded-xl" style={{ backgroundColor: '#F5F7FA', minHeight: 'calc(100vh - 4rem)' }}>
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ color: '#0B1F3B' }}>
              Firm Knowledge Base
            </h1>
            <p className="text-sm" style={{ color: '#4A5D73' }}>
              Provide context about your firm to help the AI assist callers effectively
            </p>
          </div>

          <div 
            className="bg-white rounded-xl shadow-sm p-6 md:p-8"
            style={{
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
            }}
          >
            <AIFirmKnowledgebase firm={firm} onSave={refreshData} />
          </div>
        </div>
      </div>
    </PlatformLayout>
  );
}

