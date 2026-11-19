/**
 * Auth email types sent through Resend.
 * The values match the Supabase admin generateLink types.
 */
export const AUTH_EMAIL_TYPE = {
  SIGNUP: 'signup',
  MAGIC_LINK: 'magiclink',
  RECOVERY: 'recovery',
} as const;

export type AuthEmailType =
  (typeof AUTH_EMAIL_TYPE)[keyof typeof AUTH_EMAIL_TYPE];

export const AUTH_EMAIL_TYPES: readonly AuthEmailType[] = [
  AUTH_EMAIL_TYPE.SIGNUP,
  AUTH_EMAIL_TYPE.MAGIC_LINK,
  AUTH_EMAIL_TYPE.RECOVERY,
];

/** Display name in the From header. The address is SMTP_USER. */
export const AUTH_EMAIL_FROM_NAME = 'UpNext';
