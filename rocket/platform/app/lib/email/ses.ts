import {
  SESClient,
  SendEmailCommand,
  type Body,
} from '@aws-sdk/client-ses';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
}

export interface SendOtpEmailOptions {
  to: string;
  otp: string;
  type: 'sign-in' | 'email-verification' | 'forget-password' | string;
}

let sesClientInstance: SESClient | null = null;

export function getSesClient(): SESClient {
  if (!sesClientInstance) {
    sesClientInstance = new SESClient({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }

  return sesClientInstance;
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  from,
}: SendEmailOptions): Promise<string | undefined> {
  const ses = getSesClient();
  const recipients = Array.isArray(to) ? to : [to];
  const sender = from || process.env.SES_FROM_EMAIL;
  if (!sender) {
    throw new Error('SES_FROM_EMAIL environment variable is not defined');
  }

  const body: Body = {};
  if (text) {
    body.Text = {
      Charset: 'UTF-8',
      Data: text,
    };
  }
  if (html) {
    body.Html = {
      Charset: 'UTF-8',
      Data: html,
    };
  }

  const command = new SendEmailCommand({
    Source: sender,
    Destination: {
      ToAddresses: recipients,
    },
    Message: {
      Subject: {
        Charset: 'UTF-8',
        Data: subject,
      },
      Body: body,
    },
  });

  const response = await ses.send(command);
  return response.MessageId;
}

export async function sendOtpEmail({
  to,
  otp,
  type,
}: SendOtpEmailOptions): Promise<string | undefined> {
  const subjectMap: Record<string, string> = {
    'sign-in': 'Your Rocket Sign In Verification Code',
    'email-verification': 'Verify your email address for Rocket',
    'forget-password': 'Reset your Rocket password',
  };

  const subject = subjectMap[type] || 'Your Rocket Verification Code';
  const text = `Your verification code is: ${otp}\n\nThis code will expire shortly. If you did not request this, you can safely ignore this email.`;
  const html = `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #111;">Verification Code</h2>
      <p style="font-size: 16px; color: #444;">Use the following code to complete your verification:</p>
      <div style="background-color: #f4f4f5; padding: 16px; border-radius: 8px; font-size: 28px; font-weight: bold; letter-spacing: 4px; text-align: center; color: #111; margin: 20px 0;">
        ${otp}
      </div>
      <p style="font-size: 14px; color: #777;">This code will expire shortly. If you did not request this, please ignore this email.</p>
    </div>
  `.trim();

  return await sendEmail({
    to,
    subject,
    text,
    html,
  });
}
