import esES from '@/i18n/locales/es-ES.json';
import caES from '@/i18n/locales/ca-ES.json';
import euES from '@/i18n/locales/eu-ES.json';
import glES from '@/i18n/locales/gl-ES.json';
import enUS from '@/i18n/locales/en-US.json';
import enGB from '@/i18n/locales/en-GB.json';
import {
  AUTH_EMAIL_FROM_NAME,
  AUTH_EMAIL_TYPE,
  type AuthEmailType,
} from '@/constants/domain/authEmail';
import {
  URL_TO_I18N_MAP,
  type UrlLanguageCode,
} from '@/constants/urlLanguageCodes';

type EmailCopy = {
  subject: string;
  preheader: string;
  headline: string;
  body: string;
  button: string;
  fallback: string;
  footer: string;
};

type LocaleFile = {
  auth: {
    emails: Record<'signup' | 'magicLink' | 'recovery', EmailCopy>;
  };
};

const LOCALES: Record<string, LocaleFile> = {
  'es-ES': esES as LocaleFile,
  'ca-ES': caES as LocaleFile,
  'eu-ES': euES as LocaleFile,
  'gl-ES': glES as LocaleFile,
  'en-US': enUS as LocaleFile,
  'en-GB': enGB as LocaleFile,
};

const COPY_KEY: Record<AuthEmailType, 'signup' | 'magicLink' | 'recovery'> = {
  [AUTH_EMAIL_TYPE.SIGNUP]: 'signup',
  [AUTH_EMAIL_TYPE.MAGIC_LINK]: 'magicLink',
  [AUTH_EMAIL_TYPE.RECOVERY]: 'recovery',
};

const EMAIL_BACKGROUND = '#011627';
const EMAIL_TEXT = '#ffffff';
const EMAIL_MUTED = '#cbd5e1';
const EMAIL_FOOTER = '#94a3b8';
const EMAIL_BUTTON = '#f97316';
const EMAIL_LINK = '#fdba74';
const EMAIL_DIVIDER = '#1e293b';

export function getAuthEmailCopy(
  lang: UrlLanguageCode,
  type: AuthEmailType
): EmailCopy {
  const localeCode = URL_TO_I18N_MAP[lang];
  const copy = LOCALES[localeCode]?.auth.emails[COPY_KEY[type]];

  if (!copy?.subject || !copy.headline || !copy.button) {
    throw new Error(`Missing auth email copy for ${lang} ${type}`);
  }

  return copy;
}

export function buildAuthEmailFrom(fromEmail: string): string {
  return `${AUTH_EMAIL_FROM_NAME} <${fromEmail}>`;
}

export function buildAuthRedirectUrl(
  baseUrl: string,
  lang: UrlLanguageCode,
  type: AuthEmailType
): string {
  const base = baseUrl.replace(/\/$/, '');
  const callback = `${base}/${lang}/auth/callback`;

  if (type === AUTH_EMAIL_TYPE.RECOVERY) {
    return `${callback}?next=/${lang}/auth/reset-password`;
  }

  return callback;
}

export function buildAuthEmailHtml(options: {
  logoUrl: string;
  copy: EmailCopy;
  actionUrl: string;
}): string {
  const logoUrl = escapeHtml(options.logoUrl);
  const actionUrl = escapeHtml(options.actionUrl);
  const { copy } = options;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(copy.subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:${EMAIL_BACKGROUND};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      ${escapeHtml(copy.preheader)}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${EMAIL_BACKGROUND};">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
            <tr>
              <td align="center" style="padding-bottom:32px;">
                <img src="${logoUrl}" width="180" alt="${AUTH_EMAIL_FROM_NAME}" style="display:block;border:0;outline:none;text-decoration:none;height:auto;" />
              </td>
            </tr>
            <tr>
              <td style="font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:32px;font-weight:700;color:${EMAIL_TEXT};">
                ${escapeHtml(copy.headline)}
              </td>
            </tr>
            <tr>
              <td style="padding-top:12px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;color:${EMAIL_MUTED};">
                ${escapeHtml(copy.body)}
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-top:28px;">
                <a href="${actionUrl}" style="display:inline-block;background:${EMAIL_BUTTON};color:${EMAIL_TEXT};font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;line-height:20px;text-decoration:none;padding:14px 28px;border-radius:8px;">
                  ${escapeHtml(copy.button)}
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding-top:28px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:${EMAIL_FOOTER};">
                ${escapeHtml(copy.fallback)}<br />
                <a href="${actionUrl}" style="color:${EMAIL_LINK};word-break:break-all;">${actionUrl}</a>
              </td>
            </tr>
            <tr>
              <td style="padding-top:32px;border-top:1px solid ${EMAIL_DIVIDER};font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:${EMAIL_FOOTER};">
                ${escapeHtml(copy.footer)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
