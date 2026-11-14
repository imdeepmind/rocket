/**
 * Sends a transactional email.
 *
 * @param email Recipient address.
 * @param subject Message subject line.
 * @param htmlBody HTML body.
 * @param body Plain-text body.
 */
export type EmailSender = (
  email: string,
  subject: string,
  htmlBody: string,
  body: string,
) => Promise<void>;
