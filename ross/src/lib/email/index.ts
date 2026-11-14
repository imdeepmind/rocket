import {
  AwsSesEmailConfig,
  EmailConfig,
  SendgridEmailConfig,
} from '@/interfaces/config';
import {EmailSender} from '@/interfaces/email';

import {createDummyEmailSender} from './dummy';
import {createSendgridEmailSender} from './sendgrid';
import {createSesEmailSender} from './ses';

export type {EmailSender};

/**
 * Create the email sender for the configured provider.
 */
export function createEmailSender(config: EmailConfig): EmailSender {
  switch (config.provider) {
    case 'dummy':
      return createDummyEmailSender();
    case 'aws-ses':
      return createSesEmailSender((config as AwsSesEmailConfig).config);
    case 'sendgrid':
      return createSendgridEmailSender((config as SendgridEmailConfig).config);
    default:
      // Unreachable at runtime when the config schema has been validated;
      // kept as a fail-fast guard for programmatic config construction.
      throw new Error(
        `Unsupported email provider: ${(config as {provider: string}).provider}`,
      );
  }
}
