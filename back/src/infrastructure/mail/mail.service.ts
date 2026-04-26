import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import { Resend } from 'resend';
import type { ApiLocale } from '../../common/i18n/api-locale';
import { mailHeroImageUrlFromConfig } from './mail-hero-image';
import { MailTemplateService } from './mail-template.service';
import { REGISTRATION_OTP_I18N } from './registration-otp.i18n';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private resend: Resend | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly mailTemplates: MailTemplateService,
  ) {}

  private isProduction(): boolean {
    return (
      (this.config.get<string>('nodeEnv') ?? 'development') === 'production'
    );
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
    locale: ApiLocale;
  }): Promise<void> {
    const isProd = this.isProduction();
    const from = this.config.getOrThrow<string>('mail.from');
    const t = REGISTRATION_OTP_I18N[params.locale];
    const subject = t.subject;
    const text = t.textBody(params.name, params.code);
    const html = this.renderRegistrationOtpHtml(params);

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
      await this.sendViaResend({
        from,
        to: params.to,
        subject,
        text,
        html,
        tags: [
          { name: 'type', value: 'registration' },
          { name: 'kind', value: 'otp' },
        ],
      });
      return;
    }

    await this.sendViaSmtp({ from, to: params.to, subject, text, html });
    this.logger.debug(
      'Mail sent via SMTP (dev — open MailHog: http://localhost:8025)',
    );
  }

  /**
   * Транзакционные письма (уведомления о брони и т.п.). Без throw при сбое или отсутствии провайдера — только лог.
   * Задайте ровно одно из: **`html`** (оборачивается в шаблон `transactional-notification`) или **`template`** (готовый HTML из `mail-templates/dist`, без обёртки).
   * @returns true, если отправка выполнена.
   */
  async sendTransactionalNotification(params: {
    to: string;
    subject: string;
    text: string;
    /** Готовый фрагмент тела; будет вложен в MJML `transactional-notification`. */
    html?: string;
    /** Слот из `mail-templates/dist/{slug}.html` (полное письмо). */
    template?: { slug: string; variables: Record<string, string> };
    resendTags?: { name: string; value: string }[];
  }): Promise<boolean> {
    const to = params.to.trim();
    if (!to) {
      return false;
    }
    if (!this.isMailDeliveryConfigured()) {
      this.logger.warn(
        `Notification email skipped (mail not configured): to=${to} subject=${params.subject}`,
      );
      return false;
    }
    const from = this.config.getOrThrow<string>('mail.from');
    const html = this.resolveTransactionalHtml(params);
    if (html == null) {
      return false;
    }
    const tags = [
      { name: 'type', value: 'notification' },
      ...(params.resendTags ?? []),
    ];
    try {
      if (this.isProduction()) {
        await this.sendViaResend({
          from,
          to,
          subject: params.subject,
          text: params.text,
          html,
          tags,
        });
      } else {
        await this.sendViaSmtp({
          from,
          to,
          subject: params.subject,
          text: params.text,
          html,
        });
      }
      return true;
    } catch (e) {
      this.logger.warn(
        `Transactional notification mail failed to=${to}: ${e instanceof Error ? e.message : e}`,
      );
      return false;
    }
  }

  private async sendViaResend(params: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
    tags?: { name: string; value: string }[];
  }): Promise<void> {
    const client = this.ensureResend();
    const { data, error } = await client.emails.send({
      from: params.from,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
      ...(params.tags && params.tags.length > 0 ? { tags: params.tags } : {}),
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

  private renderRegistrationOtpHtml(params: {
    name: string;
    code: string;
    locale: ApiLocale;
  }): string {
    const t = REGISTRATION_OTP_I18N[params.locale];
    if (!this.mailTemplates.hasTemplate('registration-otp')) {
      return registrationOtpFallbackHtml(params);
    }
    try {
      return this.mailTemplates.render('registration-otp', {
        emailTitle: escapeHtml(t.emailTitle),
        preview: escapeHtml(t.preview),
        heroImageUrl: escapeHtml(mailHeroImageUrlFromConfig(this.config)),
        greetingLine: escapeHtml(t.greeting(params.name)),
        instructionText: escapeHtml(t.instruction),
        footerText: escapeHtml(t.footer),
        code: escapeHtml(params.code),
      });
    } catch {
      return registrationOtpFallbackHtml(params);
    }
  }

  private resolveTransactionalHtml(params: {
    subject: string;
    html?: string;
    template?: { slug: string; variables: Record<string, string> };
  }): string | null {
    const useTemplate = params.template != null;
    const useHtml = params.html != null && params.html.length > 0;
    if (useTemplate === useHtml) {
      this.logger.warn(
        'sendTransactionalNotification: укажите ровно одно из `template` или непустой `html`',
      );
      return null;
    }
    if (params.template) {
      if (!this.mailTemplates.hasTemplate(params.template.slug)) {
        this.logger.warn(
          `Mail template dist/${params.template.slug}.html не найден`,
        );
        return null;
      }
      try {
        return this.mailTemplates.render(
          params.template.slug,
          params.template.variables,
        );
      } catch (e) {
        this.logger.warn(
          `Mail template render failed (${params.template.slug}): ${e instanceof Error ? e.message : e}`,
        );
        return null;
      }
    }
    if (params.html == null || params.html.length === 0) {
      return null;
    }
    return this.renderTransactionalNotificationHtml({
      subject: params.subject,
      html: params.html,
    });
  }

  private renderTransactionalNotificationHtml(params: {
    subject: string;
    html: string;
  }): string {
    if (!this.mailTemplates.hasTemplate('transactional-notification')) {
      return params.html;
    }
    try {
      const contentHtml = `<tr><td align="left" style="font-size:0px;padding:10px 25px;word-break:break-word;"><div style="font-family:Ubuntu, Helvetica, Arial, sans-serif;font-size:16px;line-height:24px;text-align:left;color:#18181b;">${params.html}</div></td></tr>`;
      return this.mailTemplates.render('transactional-notification', {
        title: escapeHtml(params.subject),
        heroImageUrl: escapeHtml(mailHeroImageUrlFromConfig(this.config)),
        contentHtml,
      });
    } catch {
      return params.html;
    }
  }
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function registrationOtpFallbackHtml(params: {
  name: string;
  code: string;
  locale: ApiLocale;
}): string {
  const t = REGISTRATION_OTP_I18N[params.locale];
  return `<p>${escapeHtml(t.greeting(params.name))}</p><p>${escapeHtml(t.instruction)} <strong>${escapeHtml(params.code)}</strong></p><p>${escapeHtml(t.footer)}</p>`;
}
