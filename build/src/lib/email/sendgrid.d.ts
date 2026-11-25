import { SendgridEmailOptions } from '../../interfaces/config.js';
import { EmailSender } from '../../interfaces/email.js';
/**
 * Create a SendGrid email sender using the `@sendgrid/mail` singleton.
 *
 * The API key is applied once when the sender is created; every message is
 * then delivered through `sgMail.send()` with both an HTML and a plain-text
 * body.
 */
export declare function createSendgridEmailSender(options: SendgridEmailOptions): EmailSender;
