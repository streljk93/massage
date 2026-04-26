import type { ApiLocale } from '../../common/i18n/api-locale';

export const REGISTRATION_OTP_I18N: Record<
  ApiLocale,
  {
    subject: string;
    emailTitle: string;
    preview: string;
    greeting: (name: string) => string;
    instruction: string;
    footer: string;
    textBody: (name: string, code: string) => string;
  }
> = {
  en: {
    subject: 'Your verification code',
    emailTitle: 'Verify your email',
    preview: 'Use this code within 15 minutes to finish signing up.',
    greeting: (name) => `Hi ${name},`,
    instruction: 'Enter this code to confirm your address:',
    footer: 'Expires in 15 minutes. If you didn’t request this, you can safely ignore this message.',
    textBody: (name, code) =>
      `Hello ${name},\n\nYour verification code is: ${code}\n\nIt expires in 15 minutes. If you did not request this, you can ignore this email.`,
  },
  ru: {
    subject: 'Код подтверждения',
    emailTitle: 'Подтвердите email',
    preview: 'Введите код в течение 15 минут, чтобы завершить регистрацию.',
    greeting: (name) => `Здравствуйте, ${name}!`,
    instruction: 'Введите этот код, чтобы подтвердить адрес:',
    footer:
      'Код действует 15 минут. Если вы не запрашивали письмо, просто проигнорируйте его.',
    textBody: (name, code) =>
      `Здравствуйте, ${name}!\n\nКод подтверждения: ${code}\n\nСрок действия — 15 минут. Если вы не регистрировались, это письмо можно не учитывать.`,
  },
  vi: {
    subject: 'Mã xác nhận email',
    emailTitle: 'Xác minh email của bạn',
    preview: 'Dùng mã này trong 15 phút để hoàn tất đăng ký.',
    greeting: (name) => `Xin chào ${name},`,
    instruction: 'Nhập mã sau để xác nhận địa chỉ email:',
    footer:
      'Mã có hiệu lực trong 15 phút. Nếu bạn không yêu cầu, vui lòng bỏ qua email này.',
    textBody: (name, code) =>
      `Xin chào ${name},\n\nMã xác nhận của bạn: ${code}\n\nMã hết hạn sau 15 phút. Nếu bạn không đăng ký, có thể bỏ qua email này.`,
  },
};
