import { Resend } from 'resend';
import { SummaryData, IntakeData, UrgencyLevel } from '@/types';

const apiKey = process.env.RESEND_API_KEY;

if (!apiKey) {
  throw new Error('Missing RESEND_API_KEY');
}

export const resend = new Resend(apiKey);

export async function sendIntakeEmail(
  to: string[],
  intake: IntakeData,
  summary: SummaryData,
  transcript: string | null,
  recordingUrl: string | null,
  urgency: UrgencyLevel
) {
  const subject = urgency === 'high' 
    ? `[HIGH URGENCY] New Intake Call: ${intake.full_name || 'Unknown'} — ${new Date().toLocaleDateString()}`
    : `New Intake Call: ${intake.full_name || 'Unknown'} — ${new Date().toLocaleDateString()}`;

  const callerDetails = `
    <h3>Caller Details</h3>
    <ul>
      <li><strong>Name:</strong> ${intake.full_name || 'Not provided'}</li>
      <li><strong>Phone:</strong> ${intake.callback_number || 'Not provided'}</li>
      <li><strong>Email:</strong> ${intake.email || 'Not provided'}</li>
    </ul>
  `;

  const summarySection = `
    <h3>Summary</h3>
    <ul>
      ${summary.summary_bullets.map(bullet => `<li>${bullet}</li>`).join('')}
    </ul>
  `;

  const keyFacts = `
    <h3>Key Facts</h3>
    <ul>
      ${summary.key_facts.incident_date ? `<li><strong>Incident Date:</strong> ${summary.key_facts.incident_date}</li>` : ''}
      ${summary.key_facts.location ? `<li><strong>Location:</strong> ${summary.key_facts.location}</li>` : ''}
      ${summary.key_facts.injuries ? `<li><strong>Injuries:</strong> ${summary.key_facts.injuries}</li>` : ''}
      ${summary.key_facts.treatment ? `<li><strong>Treatment:</strong> ${summary.key_facts.treatment}</li>` : ''}
      ${summary.key_facts.insurance ? `<li><strong>Insurance:</strong> ${summary.key_facts.insurance}</li>` : ''}
    </ul>
  `;

  const actionItems = `
    <h3>Action Items</h3>
    <ul>
      ${summary.action_items.map(item => `<li>${item}</li>`).join('')}
    </ul>
  `;

  // Transcript and recording are available in the platform, not in email
  const recordingLink = recordingUrl 
    ? `<p style="margin-top: 1em;">
        <strong>Call Recording:</strong> <a href="${recordingUrl}" target="_blank" style="color: #2563eb; text-decoration: underline;">Listen to Recording</a>
      </p>`
    : '';
  
  const platformNote = `
    <div style="margin-top: 2em; padding: 1em; background: #f0f9ff; border-left: 4px solid #2563eb; border-radius: 4px;">
      <strong>Note:</strong> Full transcript and call recording are available in the IntakeGenie platform. Please log in to view the complete details.
      ${recordingLink}
    </div>
  `;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          h2 { color: #2563eb; }
          h3 { color: #1e40af; margin-top: 1.5em; }
          ul { margin: 0.5em 0; }
        </style>
      </head>
      <body>
        <h2>${summary.title}</h2>
        ${callerDetails}
        ${summarySection}
        ${keyFacts}
        ${actionItems}
        <h3>Follow-up Recommendation</h3>
        <p>${summary.follow_up_recommendation}</p>
        ${platformNote}
      </body>
    </html>
  `;

  // Check API key
  if (!apiKey) {
    const error = new Error('RESEND_API_KEY not configured');
    console.error('[Resend] Configuration error:', error.message);
    throw error;
  }

  const maxRetries = 3;
  let lastError: any = null;

  // Use Resend's default from address (works out of the box)
  const fromAddress = 'IntakeGenie <onboarding@resend.dev>';

  console.log('[Resend] Attempting to send intake email:', {
    to,
    from: fromAddress,
    subject,
    urgency,
  });

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Resend] Email attempt ${attempt}/${maxRetries}...`);
      
    const { data, error } = await resend.emails.send({
        from: fromAddress,
      to,
      subject,
      html,
    });

    if (error) {
        console.error(`[Resend] Resend API returned error on attempt ${attempt}:`, error);
      throw error;
    }

      console.log('[Resend] Email sent successfully:', {
        id: data?.id,
        to,
        subject,
      });

    return data;
  } catch (error) {
      lastError = error;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Resend] Email attempt ${attempt}/${maxRetries} failed:`, {
        error: errorMessage,
        attempt,
        to,
      });
      
      if (attempt < maxRetries) {
        // Wait before retry (exponential backoff: 1s, 2s, 4s)
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.log(`[Resend] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
  }
    }
  }

  // All retries failed
  console.error('[Resend] All email attempts failed after', maxRetries, 'retries');
  throw lastError || new Error('Email sending failed after retries');
}

