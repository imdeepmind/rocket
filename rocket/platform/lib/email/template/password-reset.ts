export interface PasswordResetTemplateParams {
  url: string;
}

export interface PasswordResetTemplateOutput {
  subject: string;
  html: string;
  text: string;
}

export function passwordResetTemplate({
  url,
}: PasswordResetTemplateParams): PasswordResetTemplateOutput {
  const subject = 'Reset your Rocket password';
  const text = `Reset your password by following this link: ${url}\n\nIf you did not request a password reset, you can safely ignore this email.`;
  const html = `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #111;">Reset your Rocket password</h2>
      <p style="font-size: 16px; color: #444;">Click the link below to set a new password for your account:</p>
      <p style="margin: 24px 0;">
        <a href="${url}" style="background-color: #000; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Reset Password</a>
      </p>
      <p style="font-size: 13px; color: #777;">If you did not request a password reset, you can safely ignore this email.</p>
    </div>
  `.trim();

  return {subject, html, text};
}
