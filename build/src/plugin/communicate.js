import fp from 'fastify-plugin';
import { createEmailSender } from '../lib/email/index.js';
export default fp(async (fastify) => {
    const emailConfig = fastify.appConfig.integrations.email;
    if (!emailConfig) {
        throw new Error('communicate plugin requires integrations.email to be configured');
    }
    fastify.decorate('communicate', {
        sendEmail: createEmailSender(emailConfig),
    });
});
//# sourceMappingURL=communicate.js.map