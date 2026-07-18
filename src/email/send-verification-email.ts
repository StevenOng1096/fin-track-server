import { Resend } from 'resend';

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }

  return resendClient;
}

function getFromAddress(): string {
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!from) {
    throw new Error('RESEND_FROM_EMAIL is not configured');
  }

  return from;
}

export async function sendVerificationEmail(
  to: string,
  verifyUrl: string,
): Promise<void> {
  const resend = getResendClient();
  const from = getFromAddress();

  const { error } = await resend.emails.send({
    from,
    to,
    subject: 'Verify your Finance Tracker email',
    html: `
      <div style="font-family: system-ui, sans-serif; line-height: 1.5; color: #1a1a1a;">
        <h2 style="margin: 0 0 12px;">Verify your email</h2>
        <p style="margin: 0 0 16px;">
          Thanks for signing up for Finance Tracker. Please confirm your email address to start using the app.
        </p>
        <p style="margin: 0 0 20px;">
          <a href="${verifyUrl}" style="display: inline-block; background: #059669; color: #fff; text-decoration: none; padding: 10px 16px; border-radius: 8px; font-weight: 600;">
            Verify email
          </a>
        </p>
        <p style="margin: 0 0 12px; font-size: 14px; color: #555;">
          If the button does not work, copy and paste this link into your browser:
        </p>
        <p style="margin: 0 0 20px; font-size: 14px; word-break: break-all;">
          <a href="${verifyUrl}">${verifyUrl}</a>
        </p>
        <p style="margin: 0; font-size: 13px; color: #777;">
          If you did not create an account, you can safely ignore this email.
        </p>
      </div>
    `,
  });

  if (error) {
    throw new Error(error.message ?? 'Failed to send verification email');
  }
}
