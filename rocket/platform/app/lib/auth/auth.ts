import {betterAuth} from 'better-auth';
import {drizzleAdapter} from 'better-auth/adapters/drizzle';

import {db, schema} from '@/app/lib/db';
import {
  sendEmailVerificationEmail,
  sendPasswordResetEmail,
} from '@/app/lib/email';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    async sendResetPassword({user, url}) {
      await sendPasswordResetEmail({
        to: user.email,
        url,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: false,
    async sendVerificationEmail({user, token}) {
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL!;
      const verificationUrl = `${appUrl}/auth/verify-email?token=${token}`;

      await sendEmailVerificationEmail({
        to: user.email,
        url: verificationUrl,
      });
    },
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
});
