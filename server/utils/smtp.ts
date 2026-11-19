import nodemailer from 'nodemailer';

const DEFAULT_SMTP_HOST = 'smtp.hostinger.com';
const DEFAULT_SMTP_PORT = 465;

/**
 * Mailbox used as the From address. Hostinger only delivers mail
 * sent as the authenticated account.
 */
export function getSmtpFromAddress(): string {
  return process.env.SMTP_USER || '';
}

export async function sendSmtpEmail(options: {
  from: string;
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASSWORD || '';
  const host = process.env.SMTP_HOST || DEFAULT_SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || DEFAULT_SMTP_PORT);

  if (!user || !pass || !host || !Number.isInteger(port)) {
    throw new Error('SMTP is not configured');
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: options.from,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });
}
