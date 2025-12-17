import { NextRequest, NextResponse } from 'next/server';
import { sendIntakeEmail } from '@/lib/clients/resend';
import { IntakeData, SummaryData, UrgencyLevel } from '@/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Test endpoint to send a sample intake email
 * Call: GET /api/test-intake-email?to=your@email.com
 * Note: This is a test endpoint and should be protected in production
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const to = searchParams.get('to');
    
    // Optional: Add a simple token check for basic security
    // For now, leaving it open for testing purposes

    if (!to) {
      return NextResponse.json(
        { error: 'Missing "to" parameter. Use: /api/test-intake-email?to=your@email.com' },
        { status: 400 }
      );
    }

    console.log('[Test Intake Email] Sending sample intake email to:', to);

    // Sample intake data
    const sampleIntake: IntakeData = {
      full_name: 'John Doe',
      callback_number: '+15551234567',
      email: 'john.doe@example.com',
      reason_for_call: 'Car accident on Main Street',
      incident_date_or_timeframe: 'Yesterday afternoon around 3 PM',
      incident_location: 'Main Street and 1st Avenue, Downtown',
      injury_description: 'Lower back pain and whiplash',
      medical_treatment_received: 'yes',
      insurance_involved: 'yes',
      urgency_level: 'normal',
    };

    // Sample summary data
    const sampleSummary: SummaryData = {
      title: 'Car Accident - Personal Injury Intake',
      summary_bullets: [
        'Caller was involved in a car accident yesterday afternoon',
        'Incident occurred at Main Street and 1st Avenue intersection',
        'Caller reports lower back pain and whiplash symptoms',
        'Has received medical treatment and insurance is involved',
        'Standard follow-up recommended within 24 hours',
      ],
      key_facts: {
        incident_date: 'Yesterday afternoon around 3 PM',
        location: 'Main Street and 1st Avenue, Downtown',
        injuries: 'Lower back pain and whiplash',
        treatment: 'yes',
        insurance: 'yes',
      },
      action_items: [
        'Review intake details and medical records',
        'Contact caller to schedule consultation',
        'Gather insurance information',
        'Review police report if available',
      ],
      urgency_level: 'normal',
      follow_up_recommendation: 'Schedule initial consultation within 24-48 hours to discuss case details and next steps.',
    };

    const sampleTranscript = `AI Receptionist: Thank you for calling the firm. I'm an automated assistant for the firm. I'm not a lawyer and I can't provide legal advice, but I can take your information so the firm can follow up. Are you in a safe place to talk right now?

Caller: Yes, I'm safe.

AI Receptionist: Great. What's your full name?

Caller: John Doe.

AI Receptionist: Thanks. What's the best phone number for the firm to call you back?

Caller: 555-123-4567.

AI Receptionist: Do you want to share an email address as well, or should we just use your phone number?

Caller: john.doe@example.com is fine.

AI Receptionist: Briefly, what are you calling about today?

Caller: I was in a car accident yesterday afternoon.

AI Receptionist: When did this happen? An exact date is great, but an approximate timeframe is fine too.

Caller: Yesterday around 3 PM.

AI Receptionist: Where did this happen? City and state, if you know them.

Caller: Main Street and 1st Avenue, Downtown.

AI Receptionist: What injuries were involved, if any?

Caller: I have lower back pain and whiplash.

AI Receptionist: Have you received medical treatment for this yet?

Caller: Yes, I went to the emergency room.

AI Receptionist: Was any insurance involved?

Caller: Yes, I have car insurance.

AI Receptionist: Is there anything time-sensitive or urgent the firm should know, like a hospitalization, severe injury, or an upcoming deadline?

Caller: No, nothing urgent.

AI Receptionist: Thanks. Just to confirm, your name is John Doe and the best callback number is 555-123-4567. Is that correct?

Caller: Yes, that's correct.

AI Receptionist: Thank you. I've shared this information with the firm. Someone from the firm will review it and contact you within one business day. If this becomes urgent or you feel unsafe, please call 911. Take care.`;

    const sampleRecordingUrl = 'https://api.twilio.com/2010-04-01/Accounts/ACxxxxx/Recordings/RExxxxx.mp3';

    try {
      const emailResult = await sendIntakeEmail(
        [to],
        sampleIntake,
        sampleSummary,
        sampleTranscript,
        sampleRecordingUrl,
        'normal' as UrgencyLevel
      );

      console.log('[Test Intake Email] Sample intake email sent successfully:', emailResult);
      return NextResponse.json({
        success: true,
        message: 'Sample intake email sent successfully',
        recipient: to,
        emailId: emailResult?.id || 'unknown',
        from: 'IntakeGenie <onboarding@resend.dev>',
        note: 'Check your inbox and spam folder. Emails from onboarding@resend.dev may go to spam.',
      });
    } catch (error) {
      console.error('[Test Intake Email] Error sending email:', error);
      const errorDetails = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json(
        {
          error: 'Failed to send sample intake email',
          details: errorDetails,
          recipient: to,
          hint: 'Check server logs for detailed error information. Verify RESEND_API_KEY is configured correctly.',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[Test Intake Email] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Unexpected error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

