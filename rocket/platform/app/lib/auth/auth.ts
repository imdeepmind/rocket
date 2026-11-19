import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { username } from 'better-auth/plugins';
import { db, schema } from '@/app/lib/db';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  secret:
    process.env.BETTER_AUTH_SECRET ||
    'rocket_platform_better_auth_secret_dev_key_12345',
  baseURL:
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3000',
  emailAndPassword: {
    enabled: true,
  },
  plugins: [username()],
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || 'github_client_id_placeholder',
      clientSecret:
        process.env.GITHUB_CLIENT_SECRET || 'github_client_secret_placeholder',
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || 'google_client_id_placeholder',
      clientSecret:
        process.env.GOOGLE_CLIENT_SECRET || 'google_client_secret_placeholder',
    },
  },
});
