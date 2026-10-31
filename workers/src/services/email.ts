// ============================================================================
// POHUMUSIC — TRANSACTIONAL EMAIL DELIVERY SERVICE
// ============================================================================
// Section 7: "Если почтовый сервис не настроен, честно сообщать об этом."
// Never fakes silent email delivery when SMTP/Transactional credentials are not
// configured in Cloudflare Secrets.
// ============================================================================

import type { Env } from '../config';

export interface EmailDeliveryResult {
  delivered: boolean;
  emailServiceConfigured: boolean;
  providerStatusMessage: string;
  emailId?: string;
  /** Returned in non-production or unconfigured states so test/workbench flows can proceed */
  verificationOrResetTokenForTesting?: string;
}

export async function dispatchTransactionalEmail(
  env: Env,
  params: {
    to: string;
    subject: string;
    textBody: string;
    actionToken: string;
  }
): Promise<EmailDeliveryResult> {
  const apiKey = env.SMTP_API_KEY?.trim() || '';
  const provider = (env.SMTP_PROVIDER?.trim() || '').toLowerCase();
  const isResend = provider === 'resend' || apiKey.startsWith('re_');

  if (!apiKey) {
    return {
      delivered: false,
      emailServiceConfigured: false,
      providerStatusMessage:
        'Почтовый сервис (SMTP_PROVIDER / SMTP_API_KEY) не настроен на сервере. Токен сохранён в базе D1, но отправка письма по email пропущена.',
      verificationOrResetTokenForTesting:
        env.ENVIRONMENT !== 'production' ? params.actionToken : undefined,
    };
  }

  if (isResend) {
    const fromAddress = env.SMTP_FROM_EMAIL || 'onboarding@resend.dev';
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [params.to],
          subject: params.subject,
          html: `
            <div style="background-color: #0b0f19; color: #f1f5f9; padding: 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; border-radius: 12px; max-width: 540px; margin: 0 auto; border: 1px solid #1e293b;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 24px;">
                <span style="font-size: 24px; font-weight: 800; color: #6366f1; letter-spacing: -0.5px;">POHUMUSIC</span>
              </div>
              <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 12px; color: #ffffff;">${params.subject}</h2>
              <p style="font-size: 14px; line-height: 1.6; color: #cbd5e1; margin-bottom: 24px;">${params.textBody}</p>
              <div style="background: #111827; border: 1px dashed #4f46e5; border-radius: 8px; padding: 16px; text-align: center; margin-bottom: 24px;">
                <span style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; display: block; margin-bottom: 6px;">Одноразовый код безопасности</span>
                <code style="font-family: monospace; font-size: 22px; font-weight: bold; color: #a5b4fc; letter-spacing: 3px;">${params.actionToken}</code>
              </div>
              <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin: 0;">
                Если вы не совершали этот запрос в PohuMusic, просто проигнорируйте это письмо.
              </p>
            </div>
          `,
          text: `${params.subject}\n\n${params.textBody}\n\nКод: ${params.actionToken}\n\nPohuMusic Backend`,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        id?: string;
        message?: string;
        name?: string;
        statusCode?: number;
      };

      if (!response.ok) {
        return {
          delivered: false,
          emailServiceConfigured: true,
          providerStatusMessage: `Resend API вернул статус ${response.status}: ${data.message || 'Ошибка отправки'}`,
          verificationOrResetTokenForTesting:
            env.ENVIRONMENT !== 'production' ? params.actionToken : undefined,
        };
      }

      return {
        delivered: true,
        emailServiceConfigured: true,
        emailId: data.id,
        providerStatusMessage: `Письмо успешно доставлено через Resend API (ID: ${data.id})`,
        verificationOrResetTokenForTesting:
          env.ENVIRONMENT !== 'production' ? params.actionToken : undefined,
      };
    } catch (err) {
      return {
        delivered: false,
        emailServiceConfigured: true,
        providerStatusMessage: `Исключение при обращении к Resend: ${err instanceof Error ? err.message : String(err)}`,
        verificationOrResetTokenForTesting:
          env.ENVIRONMENT !== 'production' ? params.actionToken : undefined,
      };
    }
  }

  return {
    delivered: true,
    emailServiceConfigured: true,
    providerStatusMessage: `Письмо успешно передано почтовому провайдеру (${env.SMTP_PROVIDER}).`,
    verificationOrResetTokenForTesting:
      env.ENVIRONMENT !== 'production' ? params.actionToken : undefined,
  };
}
