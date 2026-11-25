/**
 * Create an email sender that logs the message instead of delivering it.
 *
 * Useful for local development and tests.
 */
export function createDummyEmailSender() {
    return async (email, subject, htmlBody, body) => {
        console.log('Email:', email);
        console.log('Subject:', subject);
        console.log('HTML Body:', htmlBody);
        console.log('Body:', body);
    };
}
//# sourceMappingURL=dummy.js.map