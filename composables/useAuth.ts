import { readonly } from 'vue';
import { validatePassword } from '@/utils/passwordValidation';
import { STORAGE_KEYS } from '@/constants/storage/keys';
import { AUTH_EMAIL_TYPE, type AuthEmailType } from '@/constants/domain/authEmail';
import { useLogger } from '@/composables/useLogger';
import { getCurrentLangUrlCode } from '@/composables/useRouteWithLang';

/**
 * Authentication composable for UpNext
 * Handles email/password and magic link authentication via Supabase
 */
function toAuthEmailError(error: unknown): Error & { code?: string } {
  const data =
    error &&
    typeof error === 'object' &&
    'data' in error &&
    error.data &&
    typeof error.data === 'object'
      ? (error.data as { message?: string; code?: string })
      : undefined;
  const authError = new Error(data?.message || 'Unknown error') as Error & {
    code?: string;
  };
  authError.code = data?.code;
  return authError;
}

export const useAuth = () => {
  const supabase = useSupabaseClient();
  const user = useSupabaseUser();
  const router = useRouter();
  const route = useRoute();
  const { routeWithLang } = useRouteWithLang();

  const requestAuthEmail = async (body: {
    type: AuthEmailType;
    email: string;
    lang: string;
    password?: string;
    displayName?: string | null;
  }) => {
    try {
      await $fetch('/api/auth/email', {
        method: 'POST',
        body,
      });
      return { data: { sent: true }, error: null };
    } catch (error: unknown) {
      return { data: null, error: toAuthEmailError(error) };
    }
  };

  /**
   * Sign up with email and password
   * Validates password on server side before sending to Supabase
   */
  const signUp = async (
    email: string,
    password: string,
    displayName?: string | null
  ) => {
    try {
      // Validate password on server side
      const validation = validatePassword(password);
      if (!validation.isValid) {
        const error = new Error(validation.errors.join('. '));
        error.name = 'PasswordValidationError';
        throw error;
      }

      // Get current language from URL (with fallback to extract from path)
      const lang = getCurrentLangUrlCode(route);

      const { data, error } = await requestAuthEmail({
        type: AUTH_EMAIL_TYPE.SIGNUP,
        email,
        password,
        lang,
        displayName: displayName || null,
      });

      if (error) throw error;

      return { data, error: null };
    } catch (error: unknown) {
      const { logError } = useLogger();
      logError('[Auth] Sign up error', error as Error);
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Unknown error'),
      };
    }
  };

  /**
   * Sign in with email and password
   */
  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      return { data, error: null };
    } catch (error: unknown) {
      const { logError } = useLogger();
      logError('[Auth] Sign in error', error as Error);
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Unknown error'),
      };
    }
  };

  /**
   * Sign in with magic link (passwordless)
   */
  const signInWithMagicLink = async (email: string) => {
    try {
      // Get current language from URL (with fallback to extract from path)
      const lang = getCurrentLangUrlCode(route);

      const { data, error } = await requestAuthEmail({
        type: AUTH_EMAIL_TYPE.MAGIC_LINK,
        email,
        lang,
      });

      if (error) throw error;

      return { data, error: null };
    } catch (error: unknown) {
      const { logError } = useLogger();
      logError('[Auth] Magic link error', error as Error);
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Unknown error'),
      };
    }
  };

  /**
   * Reset password (forgot password)
   */
  const resetPassword = async (email: string) => {
    // Get current language from URL (with fallback to extract from path)
    const lang = getCurrentLangUrlCode(route);

    try {
      const { data, error } = await requestAuthEmail({
        type: AUTH_EMAIL_TYPE.RECOVERY,
        email,
        lang,
      });

      // Set recovery flag in localStorage to detect recovery flow in callback
      // Flag includes timestamp to prevent indefinite persistence if user abandons flow
      if (!error && typeof window !== 'undefined') {
        localStorage.setItem(
          STORAGE_KEYS.AUTH_RECOVERY,
          JSON.stringify({ value: 1, ts: Date.now() })
        );
      }

      if (error) {
        const { logError } = useLogger();
        logError('[Auth] Reset password error', error as Error);

        // Handle rate limit error specifically
        if (
          error.code === 'over_email_send_rate_limit' ||
          error.message?.includes('rate_limit')
        ) {
          // Extract wait time from error message
          // Message format: "For security purposes, you can only request this after X seconds."
          const waitTimeMatch = error.message.match(/(\d+)\s*seconds?/i);
          const waitTime = waitTimeMatch
            ? parseInt(waitTimeMatch[1], 10)
            : null;

          const rateLimitError = new Error(
            waitTime
              ? `Por seguridad, debes esperar ${waitTime} segundo${waitTime !== 1 ? 's' : ''} antes de solicitar otro enlace de recuperación.`
              : 'Has solicitado demasiados enlaces de recuperación. Por favor, espera unos momentos antes de intentar de nuevo.'
          ) as Error & { code?: string; waitTime?: number | null };
          rateLimitError.name = 'RateLimitError';
          rateLimitError.code = error.code;
          rateLimitError.waitTime = waitTime;

          return {
            data: null,
            error: rateLimitError,
          };
        }

        throw error;
      }

      return { data, error: null };
    } catch (error: unknown) {
      const { logError } = useLogger();
      logError('[Auth] Reset password error', error as Error);

      // If it's already a RateLimitError, return it as is
      if (
        error &&
        typeof error === 'object' &&
        'name' in error &&
        error.name === 'RateLimitError'
      ) {
        return {
          data: null,
          error: error as Error,
        };
      }

      return {
        data: null,
        error: error instanceof Error ? error : new Error('Error desconocido'),
      };
    }
  };

  /**
   * Sign out
   */
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // Reset user store immediately to ensure clean state
      // The auth listener will also reset it, but doing it here ensures it happens synchronously
      if (import.meta.client) {
        try {
          const { useUserStore } = await import('@/stores/user');
          const userStore = useUserStore();
          userStore.reset();
        } catch (storeError) {
          // Store might not be available, but that's okay - the listener will handle it
          const { logWarn } = useLogger();
          logWarn('[Auth] Could not reset store during signOut', {
            error:
              storeError instanceof Error
                ? storeError.message
                : 'Unknown error',
          });
        }
      }

      // Get current language from URL and redirect to homepage with language
      await router.push(routeWithLang('/'));
      return { error: null };
    } catch (error: unknown) {
      const { logError } = useLogger();
      logError('[Auth] Sign out error', error as Error);
      return {
        error: error instanceof Error ? error : new Error('Unknown error'),
      };
    }
  };

  /**
   * Get user profile from profiles table
   */
  const getUserProfile = async () => {
    if (!user.value) return null;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.value.id)
        .single();

      if (error) throw error;
      return data;
    } catch (error: unknown) {
      const { logError } = useLogger();
      logError('[Auth] Get profile error', error as Error);
      return null;
    }
  };

  return {
    user: readonly(user),
    signUp,
    signIn,
    signInWithMagicLink,
    resetPassword,
    signOut,
    getUserProfile,
  };
};
