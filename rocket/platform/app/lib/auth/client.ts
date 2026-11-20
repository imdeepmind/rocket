import {usernameClient} from 'better-auth/client/plugins';
import {createAuthClient} from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  plugins: [usernameClient()],
});

export interface AuthActionResult<T = unknown> {
  success: boolean;
  error: string | null;
  data?: T;
}

export interface SignInUsernameParams {
  username: string;
  password: string;
}

export interface SignUpEmailParams {
  email: string;
  password: string;
  username: string;
  name?: string;
}

export interface ResetPasswordParams {
  newPassword: string;
  token?: string | null;
}

export type SocialProvider = 'google' | 'github' | 'Google' | 'GitHub';

export async function forgotPassword(
  email: string,
  redirectTo = '/auth/reset-password',
): Promise<AuthActionResult> {
  try {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      return {
        success: false,
        error: 'Please provide a valid email address',
      };
    }

    const result = await authClient.requestPasswordReset({
      email: trimmedEmail,
      redirectTo,
    });

    if (result?.error) {
      return {
        success: false,
        error: result.error.message || 'Failed to dispatch reset link',
      };
    }

    return {success: true, error: null, data: result?.data};
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : 'An unexpected error occurred while requesting password reset';
    return {success: false, error: message};
  }
}

export const forgetPassword = forgotPassword;

export async function resetPassword({
  newPassword,
  token,
}: ResetPasswordParams): Promise<AuthActionResult> {
  try {
    if (!token) {
      return {
        success: false,
        error: 'Reset token is missing or invalid',
      };
    }

    if (!newPassword || newPassword.length < 8) {
      return {
        success: false,
        error: 'Password must be at least 8 characters long',
      };
    }

    const result = await authClient.resetPassword({
      newPassword,
      token,
    });

    if (result?.error) {
      return {
        success: false,
        error: result.error.message || 'Failed to reset password',
      };
    }

    return {success: true, error: null, data: result?.data};
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Failed to reset password';
    return {success: false, error: message};
  }
}

export async function signInWithUsername({
  username,
  password,
}: SignInUsernameParams): Promise<AuthActionResult> {
  try {
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      return {success: false, error: 'Please enter your username'};
    }
    if (!password) {
      return {success: false, error: 'Please enter your password'};
    }

    const result = await authClient.signIn.username({
      username: trimmedUsername,
      password,
    });

    if (result?.error) {
      return {
        success: false,
        error: result.error.message || 'Invalid username or password',
      };
    }

    return {success: true, error: null, data: result?.data};
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : 'An unexpected error occurred during sign in';
    return {success: false, error: message};
  }
}

export const signIn = signInWithUsername;

export async function signUpWithEmail({
  email,
  password,
  username,
  name,
}: SignUpEmailParams): Promise<AuthActionResult> {
  try {
    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();

    if (!trimmedUsername) {
      return {success: false, error: 'Please choose a username'};
    }
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      return {success: false, error: 'Please provide a valid email address'};
    }
    if (!password || password.length < 8) {
      return {
        success: false,
        error: 'Password must be at least 8 characters long',
      };
    }

    const result = await authClient.signUp.email({
      email: trimmedEmail,
      password,
      name: name?.trim() || trimmedUsername,
      username: trimmedUsername,
    });

    if (result?.error) {
      return {
        success: false,
        error: result.error.message || 'Failed to create account',
      };
    }

    return {success: true, error: null, data: result?.data};
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : 'An unexpected error occurred during account creation';
    return {success: false, error: message};
  }
}

export const signUp = signUpWithEmail;

export async function signInWithSocial(
  provider: SocialProvider,
  callbackURL = '/',
): Promise<AuthActionResult> {
  const normalizedProvider = provider.toLowerCase() as 'google' | 'github';
  const displayProvider = normalizedProvider === 'google' ? 'Google' : 'GitHub';

  try {
    const result = await authClient.signIn.social({
      provider: normalizedProvider,
      callbackURL,
    });

    if (result?.error) {
      return {
        success: false,
        error:
          result.error.message || `${displayProvider} authentication failed.`,
      };
    }

    return {success: true, error: null, data: result?.data};
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : `${displayProvider} OAuth is not available. Please verify your credentials.`;
    return {success: false, error: message};
  }
}

export const signInWithOAuth = signInWithSocial;
export const signOut = authClient.signOut;
export const useSession = authClient.useSession;
