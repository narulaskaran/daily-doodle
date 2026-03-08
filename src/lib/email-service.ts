import { getColoringPages, ColoringPage } from './pdf-service';

export interface EmailAttachment {
  filename: string;
  content: string; // base64
  contentType: string;
}

export interface EmailSummary {
  to: string;
  subject: string;
  body: string;
  attachments: EmailAttachment[];
}

const AGENTMAIL_API_KEY = process.env.AGENTMAIL_API_KEY;
const AGENTMAIL_FROM = process.env.AGENTMAIL_FROM || 'daily-doodle@agentmail.to';

export async function sendEmail(summary: EmailSummary): Promise<{ success: boolean; message?: string }> {
  try {
    if (!AGENTMAIL_API_KEY) {
      throw new Error('AGENTMAIL_API_KEY not configured');
    }

    // Use AgentMail API to send email with attachments
    const response = await fetch('https://api.agentmail.dev/v1/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AGENTMAIL_API_KEY}`,
      },
      body: JSON.stringify({
        from: AGENTMAIL_FROM,
        to: [summary.to],
        subject: summary.subject,
        html: summary.body,
        attachments: summary.attachments.map(att => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType,
        })),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Email send failed: ${error}`);
    }

    return { success: true };
  } catch (error) {
    console.error('Email service error:', error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export function generateEmailBody(today: Date, count: number): string {
  const dateStr = today.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Doodle</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <span style="font-size: 48px;">🎨</span>
    <h1 style="color: #7c3aed; margin: 10px 0;">Daily Doodle</h1>
    <p style="color: #6b7280; font-size: 16px;">Your daily coloring pages for ${dateStr}</p>
  </div>
  
  <div style="background: #f3f4f6; border-radius: 12px; padding: 20px; margin: 20px 0;">
    <h2 style="margin-top: 0; color: #374151;">📦 Today's Package</h2>
    <p style="margin-bottom: 10px;"><strong>${count} fresh coloring pages</strong> are attached to this email, ready to print!</p>
    <p style="color: #6b7280; font-size: 14px; margin-top: 15px;">
      Each page is 8x8 inches at 300 DPI – perfect for standard printer paper.
    </p>
  </div>
  
  <div style="margin: 30px 0;">
    <h3 style="color: #374151;">🖨️ How to Print</h3>
    <ol style="color: #4b5563; padding-left: 20px;">
      <li>Download the attached PDFs</li>
      <li>Print on standard US Letter or A4 paper</li>
      <li>Start coloring!</li>
    </ol>
  </div>
  
  <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 40px; text-align: center; color: #9ca3af; font-size: 14px;">
    <p>New coloring pages delivered daily 🌅</p>
    <p style="margin-top: 10px;">
      <a href="https://daily-doodle.vercel.app" style="color: #7c3aed; text-decoration: none;">View online gallery</a>
    </p>
  </div>
</body>
</html>
  `.trim();
}

export async function generateDailyBriefing(
  recipientEmail: string,
  date: Date = new Date()
): Promise<EmailSummary | null> {
  try {
    // Get today's coloring pages
    const allPages = await getColoringPages();
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    
    // Filter to today's pages
    const todayPages = allPages.filter(page => 
      page.filename.startsWith(dateStr)
    );
    
    if (todayPages.length === 0) {
      console.log('No coloring pages found for today');
      return null;
    }

    // Read PDFs and convert to base64
    const fs = await import('fs');
    const attachments: EmailAttachment[] = [];
    
    for (const page of todayPages) {
      try {
        const pdfBuffer = fs.readFileSync(page.path);
        attachments.push({
          filename: page.filename,
          content: pdfBuffer.toString('base64'),
          contentType: 'application/pdf',
        });
      } catch (err) {
        console.error(`Failed to read PDF ${page.filename}:`, err);
      }
    }

    if (attachments.length === 0) {
      return null;
    }

    return {
      to: recipientEmail,
      subject: `🎨 Daily Doodle - ${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`,
      body: generateEmailBody(date, attachments.length),
      attachments,
    };
  } catch (error) {
    console.error('Failed to generate daily briefing:', error);
    return null;
  }
}

export async function sendDailyDoodleEmail(
  recipientEmail: string
): Promise<{ success: boolean; message?: string; pages?: number }> {
  const briefing = await generateDailyBriefing(recipientEmail);
  
  if (!briefing) {
    return { 
      success: false, 
      message: 'No coloring pages available to send' 
    };
  }

  const result = await sendEmail(briefing);
  
  if (result.success) {
    return { 
      success: true, 
      message: `Daily email sent with ${briefing.attachments.length} coloring pages`,
      pages: briefing.attachments.length
    };
  }
  
  return result;
}
