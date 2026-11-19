import { validatePassword } from '@/utils/passwordValidation';
import {
  AUTH_EMAIL_TYPE,
  AUTH_EMAIL_TYPES,
  type AuthEmailType,
} from '@/constants/domain/authEmail';
import {
  VALID_URL_CODES,
  type UrlLanguageCode,
} from '@/constants/urlLanguageCodes';
type EmailBody = {
  type?: string;
  email?: string;
  lang?: string;
  password?: string;
  displayName?: string | null;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const body = await readBody<EmailBody>(event);
  const type = body.type;
  const email = body.email?.trim().toLowerCase() || '';
  const lang = body.lang;

  if (!isAuthEmailType(type) || !isUrlLanguage(lang) || !EMAIL_PATTERN.test(email)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid auth email request',
      data: { message: 'Invalid auth email request' },
    });
  }

  if (type === AUTH_EMAIL_TYPE.SIGNUP) {
    const password = body.password || '';
    const validation = validatePassword(password);
    if (!validation.isValid) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid password',
        data: { message: validation.errors.join('. ') },
      });
    }
  }

  const fromEmail = getSmtpFromAddress();
  if (!fromEmail || !process.env.SMTP_PASSWORD || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    logError(
      '[AuthEmail] Missing SMTP_USER, SMTP_PASSWORD, or SUPABASE_SERVICE_ROLE_KEY',
      new Error('Auth email is not configured')
    );
    throw createError({
      statusCode: 500,
      statusMessage: 'Auth email is not configured',
      data: { message: 'Auth email is not configured' },
    });
  }

  const redirectTo = buildAuthRedirectUrl(config.public.baseUrl, lang, type);
  const supabase = createServerSupabaseClient(config);
  const displayName = body.displayName?.trim() || null;

  const { data, error } = await generateAuthLink(
    supabase,
    type,
    email,
    redirectTo,
    body.password,
    displayName
  );

  if (error || !data?.properties?.action_link) {
    throw authLinkError(error);
  }

  const copy = getAuthEmailCopy(lang, type);
  const logoUrl = `${config.public.baseUrl.replace(/\/$/, '')}/logo-dark.png`;

  try {
    await sendSmtpEmail({
      from: buildAuthEmailFrom(fromEmail),
      to: email,
      subject: copy.subject,
      html: buildAuthEmailHtml({
        logoUrl,
        copy,
        actionUrl: data.properties.action_link,
      }),
    });
  } catch (sendError) {
    logError('[AuthEmail] SMTP failed', sendError as Error);
    throw createError({
      statusCode: 502,
      statusMessage: 'Error sending email',
      data: { code: 'error_sending_email', message: 'Error sending email' },
    });
  }

  return { sent: true };
});

function isAuthEmailType(value: string | undefined): value is AuthEmailType {
  return AUTH_EMAIL_TYPES.includes(value as AuthEmailType);
}

function isUrlLanguage(value: string | undefined): value is UrlLanguageCode {
  return VALID_URL_CODES.includes(value as UrlLanguageCode);
}

async function generateAuthLink(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  type: AuthEmailType,
  email: string,
  redirectTo: string,
  password: string | undefined,
  displayName: string | null
) {
  if (type === AUTH_EMAIL_TYPE.SIGNUP) {
    return supabase.auth.admin.generateLink({
      type: AUTH_EMAIL_TYPE.SIGNUP,
      email,
      password: password || '',
      options: {
        redirectTo,
        data: { display_name: displayName },
      },
    });
  }

  if (type === AUTH_EMAIL_TYPE.MAGIC_LINK) {
    return supabase.auth.admin.generateLink({
      type: AUTH_EMAIL_TYPE.MAGIC_LINK,
      email,
      options: { redirectTo },
    });
  }

  return supabase.auth.admin.generateLink({
    type: AUTH_EMAIL_TYPE.RECOVERY,
    email,
    options: { redirectTo },
  });
}

function authLinkError(error: { message?: string; code?: string; status?: number } | null) {
  const code = error?.code;
  const status =
    error?.status === 429 || code === 'over_email_send_rate_limit' ? 429 : 400;

  logError(
    '[AuthEmail] Failed to generate auth link',
    new Error(error?.message || 'Unknown auth link error')
  );

  return createError({
    statusCode: status,
    statusMessage: 'Auth link failed',
    data: {
      code,
      message: error?.message || 'Auth link failed',
    },
  });
}
