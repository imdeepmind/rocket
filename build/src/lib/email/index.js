import { createDummyEmailSender } from './dummy.js';
import { createSendgridEmailSender } from './sendgrid.js';
import { createSesEmailSender } from './ses.js';
/**
 * Create the email sender for the configured provider.
 */
export function createEmailSender(config) {
    switch (config.provider) {
        case 'dummy':
            return createDummyEmailSender();
        case 'aws-ses':
            return createSesEmailSender(config.config);
        case 'sendgrid':
            return createSendgridEmailSender(config.config);
        default:
            // Unreachable at runtime when the config schema has been validated;
            // kept as a fail-fast guard for programmatic config construction.
            throw new Error(`Unsupported email provider: ${config.provider}`);
    }
}
//# sourceMappingURL=index.js.map