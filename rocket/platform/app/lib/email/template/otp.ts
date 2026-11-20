export interface OtpTemplateParams {
  otp: string;
  type: 'sign-in' | 'email-verification' | 'forget-password' | string;
}

export interface OtpTemplateOutput {
  subject: string;
  html: string;
  text: string;
}

export function otpTemplate({otp, type}: OtpTemplateParams): OtpTemplateOutput {
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

  return {subject, html, text};
}
