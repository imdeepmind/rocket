import {FastifyInstance} from 'fastify';
import fp from 'fastify-plugin';

const sendDummyEmail = async (
  email: string,
  htmlBody: string,
  body: string,
) => {
  console.log('Email:', email);
  console.log('HTML Body:', htmlBody);
  console.log('Body:', body);
};

export default fp(async (fastify: FastifyInstance) => {
  const communicate = {
    sendEmail: async (email: string, htmlBody: string, body: string) => {
      if (fastify.appConfig.email.emailEngine === 'dummy') {
        await sendDummyEmail(email, htmlBody, body);
      }
    },
  };

  fastify.decorate('communicate', communicate);
});
