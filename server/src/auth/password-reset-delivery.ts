import { Injectable, ServiceUnavailableException } from '@nestjs/common';

/**
 * External delivery is strictly opt-in. Never log tokens, never return them
 * to callers, and never treat a missing provider configuration as success.
 */
@Injectable()
export class PasswordResetDelivery {
  isConfigured(): boolean {
    return Boolean(process.env.RESEND_API_KEY && process.env.PASSWORD_RESET_FROM && process.env.PASSWORD_RESET_URL);
  }

  async send(email: string, rawToken: string): Promise<void> {
    if (!this.isConfigured()) throw new ServiceUnavailableException('Email delivery is not configured');
    const base = process.env.PASSWORD_RESET_URL!;
    const url = new URL(base);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.search) {
      throw new ServiceUnavailableException('Password reset URL requires a secure HTTPS origin without parameters');
    }
    url.searchParams.set('token', rawToken);
    let result: Response;
    try {
      result = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.PASSWORD_RESET_FROM,
          to: [email],
          subject: 'WhereMyBook: восстановление доступа',
          text: 'Чтобы задать новый пароль, откройте ссылку (действует 15 минут): ' + url.toString() + '\nЕсли вы не запрашивали восстановление, проигнорируйте письмо.',
        }),
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new ServiceUnavailableException('Password reset delivery unavailable');
    }
    if (!result.ok) throw new ServiceUnavailableException('Password reset delivery rejected');
  }
}
