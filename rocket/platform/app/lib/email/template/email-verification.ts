export interface EmailVerificationTemplateParams {
  url: string;
}

export interface EmailTemplateOutput {
  subject: string;
  html: string;
  text: string;
}

export function emailVerificationTemplate({
  url,
}: EmailVerificationTemplateParams): EmailTemplateOutput {
  const subject = 'Verify your email address for Rocket';
  const text = `Verify your email address by following this link: ${url}\n\nIf you did not sign up for a Rocket account, you can safely ignore this email.`;
  const html = `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #111;">Verify your Rocket account</h2>
      <p style="font-size: 16px; color: #444;">Click the link below to verify your email address and activate your account:</p>
      <p style="margin: 24px 0;">
        <a href="${url}" style="background-color: #000; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Verify Email</a>
      </p>
      <p style="font-size: 13px; color: #777;">If you did not sign up for a Rocket account, you can safely ignore this email.</p>
    </div>
  `.trim();

  return {subject, html, text};
}
