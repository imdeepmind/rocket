export default function validateCorsConstraints(config) {
    const errors = [];
    const cors = config.application?.cors;
    if (cors && cors.enabled) {
        if (!cors.origins || cors.origins.length === 0) {
            errors.push('application.cors: origins must contain at least one origin when cors is enabled');
        }
        if (cors.credentials && cors.origins?.includes('*')) {
            errors.push('application.cors: credentials cannot be true when origins includes "*"');
        }
    }
    return errors;
}
//# sourceMappingURL=validate-cors.js.map