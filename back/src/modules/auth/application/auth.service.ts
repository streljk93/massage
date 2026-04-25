import { randomInt } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { addMinutes } from 'date-fns';
import { MailService } from '../../../infrastructure/mail/mail.service';
import type { AuthResponseDto } from '../dto/auth-response.dto';
import type { LoginBody } from '../dto/login-body.schema';
import type { RegisterBody } from '../dto/register-body.schema';
import type { RegisterPendingResponseDto } from '../dto/register-pending.dto';
import type { ResendEmailVerificationBody } from '../dto/resend-email-verification-body.schema';
import type { VerifyEmailRegistrationBody } from '../dto/verify-email-registration-body.schema';
import { EmailVerificationOtpRepository } from '../infrastructure/email-verification-otp.repository';
import { PasswordHasher } from '../infrastructure/password-hasher';
import { UserRepository } from '../infrastructure/user.repository';

const OTP_TTL_MINUTES = 15;

type JwtPayload = {
  sub: string;
  email: string;
  name: string;
  tokenUse: 'access' | 'refresh';
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly mailService: MailService,
    private readonly emailVerificationOtp: EmailVerificationOtpRepository,
  ) {}

  async register(
    body: RegisterBody,
  ): Promise<RegisterPendingResponseDto> {
    const nodeEnv = this.config.get<string>('nodeEnv') ?? 'development';
    if (nodeEnv === 'production' && !this.mailService.isMailDeliveryConfigured()) {
      throw new ServiceUnavailableException({
        code: 'MAIL_NOT_CONFIGURED',
        message:
          'Email is not configured (production: RESEND_API_KEY; development: SMTP / MailHog).',
      });
    }
    const email = normalizeEmail(body.email);
    const passwordHash = await this.passwordHasher.hash(body.password);
    let user: Awaited<ReturnType<UserRepository['createUser']>>;
    try {
      user = await this.userRepository.createUser({
        email,
        name: body.name.trim(),
        passwordHash,
      });
    } catch (error) {
      if (this.userRepository.isUniqueViolation(error)) {
        throw new ConflictException({
          code: 'EMAIL_ALREADY_REGISTERED',
          message: 'Email is already registered',
        });
      }
      throw error;
    }
    const code = this.generateOtp();
    const codeHash = await this.passwordHasher.hash(code);
    const expiresAt = addMinutes(new Date(), OTP_TTL_MINUTES);
    await this.emailVerificationOtp.upsert(user.id, { codeHash, expiresAt });
    try {
      await this.mailService.sendRegistrationOtp({
        to: user.email,
        name: user.name,
        code,
      });
    } catch {
      throw new ServiceUnavailableException({
        code: 'MAIL_SEND_FAILED',
        message: 'Failed to send verification email.',
      });
    }
    return { status: 'verification_required', email: user.email };
  }

  async verifyEmailRegistration(
    body: VerifyEmailRegistrationBody,
  ): Promise<AuthResponseDto> {
    const email = normalizeEmail(body.email);
    const user = await this.userRepository.findActiveByEmail(email);
    if (!user?.passwordHash) {
      throw new BadRequestException({
        code: 'VERIFICATION_NOT_FOUND',
        message: 'Invalid or expired code',
      });
    }
    if (user.emailVerifiedAt) {
      throw new BadRequestException({
        code: 'ALREADY_VERIFIED',
        message: 'Email is already verified',
      });
    }
    const record = await this.emailVerificationOtp.findByUserId(user.id);
    if (!record) {
      throw new BadRequestException({
        code: 'VERIFICATION_NOT_FOUND',
        message: 'Invalid or expired code',
      });
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException({
        code: 'VERIFICATION_EXPIRED',
        message: 'Code has expired. Request a new one.',
      });
    }
    const ok = await this.passwordHasher.verify(body.code, record.codeHash);
    if (!ok) {
      throw new BadRequestException({
        code: 'INVALID_CODE',
        message: 'Invalid or expired code',
      });
    }
    await this.emailVerificationOtp.deleteByUserId(user.id);
    const verified = await this.userRepository.setEmailVerifiedAt(user.id);
    return this.issueTokens(verified);
  }

  async resendEmailVerification(
    body: ResendEmailVerificationBody,
  ): Promise<void> {
    const nodeEnv = this.config.get<string>('nodeEnv') ?? 'development';
    if (nodeEnv === 'production' && !this.mailService.isMailDeliveryConfigured()) {
      throw new ServiceUnavailableException({
        code: 'MAIL_NOT_CONFIGURED',
        message:
          'Email is not configured (production: RESEND_API_KEY; development: SMTP / MailHog).',
      });
    }
    const email = normalizeEmail(body.email);
    const user = await this.userRepository.findActiveByEmail(email);
    if (!user?.passwordHash) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }
    const match = await this.passwordHasher.verify(
      body.password,
      user.passwordHash,
    );
    if (!match) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }
    if (user.emailVerifiedAt) {
      throw new BadRequestException({
        code: 'ALREADY_VERIFIED',
        message: 'Email is already verified',
      });
    }
    const code = this.generateOtp();
    const codeHash = await this.passwordHasher.hash(code);
    const expiresAt = addMinutes(new Date(), OTP_TTL_MINUTES);
    await this.emailVerificationOtp.upsert(user.id, { codeHash, expiresAt });
    try {
      await this.mailService.sendRegistrationOtp({
        to: user.email,
        name: user.name,
        code,
      });
    } catch {
      throw new ServiceUnavailableException({
        code: 'MAIL_SEND_FAILED',
        message: 'Failed to send verification email.',
      });
    }
  }

  async login(body: LoginBody): Promise<AuthResponseDto> {
    const email = normalizeEmail(body.email);
    const user = await this.userRepository.findActiveByEmail(email);
    if (!user?.passwordHash) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }
    if (!user.emailVerifiedAt) {
      throw new ForbiddenException({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Confirm your email to sign in',
      });
    }
    const ok = await this.passwordHasher.verify(
      body.password,
      user.passwordHash,
    );
    if (!ok) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }
    return this.issueTokens(user);
  }

  async refresh(refreshToken: string): Promise<AuthResponseDto> {
    const secret = this.config.getOrThrow<string>('jwt.secret');
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret,
      });
    } catch {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Invalid or expired refresh token',
      });
    }
    if (payload.tokenUse !== 'refresh') {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Invalid refresh token',
      });
    }
    const user = await this.userRepository.findActiveById(payload.sub);
    if (!user) {
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: 'User no longer exists',
      });
    }
    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException({
        code: 'USER_NOT_VERIFIED',
        message: 'Session is no longer valid',
      });
    }
    return this.issueTokens(user);
  }

  private issueTokens(user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  }): AuthResponseDto {
    const accessExpiresSec = this.config.getOrThrow<number>(
      'jwt.accessExpiresSec',
    );
    const refreshExpiresSec = this.config.getOrThrow<number>(
      'jwt.refreshExpiresSec',
    );
    const base = {
      sub: user.id,
      email: user.email,
      name: user.name,
    };
    const accessPayload: JwtPayload = { ...base, tokenUse: 'access' };
    const refreshPayload: JwtPayload = { ...base, tokenUse: 'refresh' };

    const accessToken = this.jwtService.sign(accessPayload, {
      expiresIn: accessExpiresSec,
    });
    const refreshToken = this.jwtService.sign(refreshPayload, {
      expiresIn: refreshExpiresSec,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
      accessToken,
      refreshToken,
    };
  }

  private generateOtp(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }
}
