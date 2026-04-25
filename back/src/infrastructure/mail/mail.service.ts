import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private resend: Resend | null = null;

  constructor(private readonly config: ConfigService) {}

  private isProduction(): boolean {
    return (this.config.get<string>('nodeEnv') ?? 'development') === 'production';
  }

  private getSmtpConfig(): { host: string; port: number; secure: boolean } {
    return this.config.getOrThrow<{
      host: string;
      port: number;
      secure: boolean;
    }>('mail.smtp');
  }

  private getResendApiKey(): string {
    return this.config.get<string>('mail.resendApiKey') ?? '';
  }

  private ensureResend(): Resend {
    if (this.resend) {
      return this.resend;
    }
    const key = this.getResendApiKey();
    this.resend = new Resend(key);
    return this.resend;
  }

  private ensureTransporter(): Transporter {
    if (this.transporter) {
      return this.transporter;
    }
    const smtp = this.getSmtpConfig();
    const user = this.config.get<string>('mail.smtp.user') ?? '';
    const pass = this.config.get<string>('mail.smtp.pass') ?? '';
    this.transporter = createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      ...(user ? { auth: { user, pass } } : {}),
    });
    return this.transporter;
  }

  /**
   * Production: только `RESEND_API_KEY`. Dev: только SMTP (например MailHog 127.0.0.1:1025).
   */
  isMailDeliveryConfigured(): boolean {
    if (this.isProduction()) {
      return this.getResendApiKey().length > 0;
    }
    return this.getSmtpConfig().host.length > 0;
  }

  /**
   * OTP при регистрации: **production** — только Resend; **dev** — только SMTP (MailHog), Resend в dev не используется.
   */
  async sendRegistrationOtp(params: {
    to: string;
    name: string;
    code: string;
  }): Promise<void> {
    const isProd = this.isProduction();
    const from = this.config.getOrThrow<string>('mail.from');
    const subject = 'Your verification code';
    const text = `Hello ${params.name},\n\nYour verification code is: ${params.code}\n\nIt expires in 15 minutes.`;
    const html = `<p>Hello ${escapeHtml(
      params.name,
    )},</p><p>Your verification code is: <strong>${escapeHtml(
      params.code,
    )}</strong></p><p>It expires in 15 minutes.</p>`;

    if (!this.isMailDeliveryConfigured()) {
      this.logger.warn(
        `[register OTP] to=${params.to} code=${params.code} (${
          isProd
            ? 'RESEND_API_KEY not set (production)'
            : 'SMTP_HOST not set (use MailHog in dev: docker compose up mailhog -d)'
        })`,
      );
      if (isProd) {
        throw new Error(
          'Production mail: set RESEND_API_KEY (SMTP is not used in production)',
        );
      }
      return;
    }

    if (isProd) {
      await this.sendViaResend({ from, to: params.to, subject, text, html });
      return;
    }

    await this.sendViaSmtp({ from, to: params.to, subject, text, html });
    this.logger.debug('Mail sent via SMTP (dev — open MailHog: http://localhost:8025)');
  }

  private async sendViaResend(params: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<void> {
    const client = this.ensureResend();
    const { data, error } = await client.emails.send({
      from: params.from,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
      tags: [
        { name: 'type', value: 'registration' },
        { name: 'kind', value: 'otp' },
      ],
    });
    if (error) {
      throw new Error(`Resend: ${error.name} — ${error.message}`);
    }
    this.logger.debug(`Resend message id: ${data?.id ?? 'unknown'}`);
  }

  private async sendViaSmtp(params: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<void> {
    const transport = this.ensureTransporter();
    await transport.sendMail({
      from: params.from,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
  }
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
