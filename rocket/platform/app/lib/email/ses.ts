import {SendEmailCommand, SESClient, type Body} from '@aws-sdk/client-ses';

import {
  emailVerificationTemplate,
  otpTemplate,
  passwordResetTemplate,
} from '@/app/lib/email/template';

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
  const {subject, html, text} = otpTemplate({otp, type});

  return await sendEmail({
    to,
    subject,
    text,
    html,
  });
}

export async function sendPasswordResetEmail({
  to,
  url,
}: {
  to: string;
  url: string;
}): Promise<string | undefined> {
  const {subject, html, text} = passwordResetTemplate({url});

  return await sendEmail({
    to,
    subject,
    text,
    html,
  });
}

export async function sendEmailVerificationEmail({
  to,
  url,
}: {
  to: string;
  url: string;
}): Promise<string | undefined> {
  const {subject, html, text} = emailVerificationTemplate({url});

  return await sendEmail({
    to,
    subject,
    text,
    html,
  });
}
