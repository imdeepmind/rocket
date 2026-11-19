import { createAuthClient } from 'better-auth/react';
import { usernameClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  baseURL:
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL ||
    (typeof window !== 'undefined'
      ? window.location.origin
      : 'http://localhost:3000'),
  plugins: [usernameClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;

