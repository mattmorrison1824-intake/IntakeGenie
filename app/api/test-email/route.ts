import { NextRequest, NextResponse } from 'next/server';
import { resend } from '@/lib/clients/resend';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Test endpoint to verify Resend email configuration
 * Call: GET /api/test-email?to=your@email.com
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const to = searchParams.get('to');

    if (!to) {
      return NextResponse.json(
        { error: 'Missing "to" parameter. Use: /api/test-email?to=your@email.com' },
        { status: 400 }
      );
    }

    console.log('[Test Email] Attempting to send test email to:', to);
    console.log('[Test Email] RESEND_API_KEY exists:', !!process.env.RESEND_API_KEY);
    console.log('[Test Email] RESEND_API_KEY length:', process.env.RESEND_API_KEY?.length || 0);

    // Check if API key exists
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { 
          error: 'RESEND_API_KEY not configured',
          hint: 'Make sure RESEND_API_KEY is set in your environment variables'
        },
        { status: 500 }
      );
    }

    // Try to send a test email
    const { data, error } = await resend.emails.send({
      from: 'IntakeGenie <noreply@intakegenie.com>',
      to: [to],
      subject: 'IntakeGenie Test Email',
      html: `
        <h2>Test Email from IntakeGenie</h2>
        <p>If you're reading this, your Resend email configuration is working correctly!</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
      `,
    });

    if (error) {
      console.error('[Test Email] Resend API error:', error);
      return NextResponse.json(
        { 
          error: 'Failed to send email',
          details: error,
          hint: 'Check that the domain "intakegenie.com" is verified in your Resend account, or update the "from" address to a verified domain'
        },
        { status: 500 }
      );
    }

    console.log('[Test Email] Email sent successfully:', data);
    return NextResponse.json({
      success: true,
      message: 'Test email sent successfully',
      emailId: data?.id,
    });
  } catch (error) {
    console.error('[Test Email] Unexpected error:', error);
    return NextResponse.json(
      { 
        error: 'Unexpected error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

