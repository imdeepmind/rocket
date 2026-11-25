import fp from 'fastify-plugin';
export default fp(async (fastify) => {
    fastify.decorate('buildResponse', (code, message, data) => {
        return {
            code,
            message,
            data,
        };
    });
});
//# sourceMappingURL=response.js.map