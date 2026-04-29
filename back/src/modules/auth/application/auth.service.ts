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
import { OAuthProvider, Prisma, PublicationModerationStatus } from '@prisma/client';
import { addMinutes } from 'date-fns';
import { parseApiLocale } from '../../../common/i18n/api-locale';
import { MailService } from '../../../infrastructure/mail/mail.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { ContentModerationService } from '../../moderation/application/content-moderation.service';
import type { AuthResponseDto } from '../dto/auth-response.dto';
import type { LoginBody } from '../dto/login-body.schema';
import type { OauthLoginBody } from '../dto/oauth-login-body.schema';
import type { RegisterBody } from '../dto/register-body.schema';
import type { RegisterPendingResponseDto } from '../dto/register-pending.dto';
import type { ResendEmailVerificationBody } from '../dto/resend-email-verification-body.schema';
import type { VerifyEmailRegistrationBody } from '../dto/verify-email-registration-body.schema';
import { OAuthAccountRepository } from '../infrastructure/oauth-account.repository';
import type { VerifiedOAuthProfile } from '../infrastructure/oauth-token-verifier';
import { OAuthTokenVerifier } from '../infrastructure/oauth-token-verifier';
import { PendingRegistrationRepository } from '../infrastructure/pending-registration.repository';
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
    private readonly prisma: PrismaService,
    private readonly pendingRegistration: PendingRegistrationRepository,
    private readonly oauthTokenVerifier: OAuthTokenVerifier,
    private readonly oauthAccountRepository: OAuthAccountRepository,
    private readonly contentModeration: ContentModerationService,
  ) {}

  async register(body: RegisterBody): Promise<RegisterPendingResponseDto> {
    const nodeEnv = this.config.get<string>('nodeEnv') ?? 'development';
    if (
      nodeEnv === 'production' &&
      !this.mailService.isMailDeliveryConfigured()
    ) {
      throw new ServiceUnavailableException({
        code: 'MAIL_NOT_CONFIGURED',
        message:
          'Email is not configured (production: RESEND_API_KEY; development: SMTP / MailHog).',
      });
    }
    const email = normalizeEmail(body.email);
    const existingUser = await this.userRepository.findActiveByEmail(email);
    if (existingUser?.emailVerifiedAt) {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_REGISTERED',
        message: 'Email is already registered',
      });
    }
    /** Старый поток: неподтверждённый `User` без pending — убираем, чтобы освободить email. */
    if (existingUser && !existingUser.emailVerifiedAt) {
      await this.prisma.user.deleteMany({
        where: { email, emailVerifiedAt: null, deletedAt: null },
      });
    }
    const passwordHash = await this.passwordHasher.hash(body.password);
    const code = this.generateOtp();
    const codeHash = await this.passwordHasher.hash(code);
    const expiresAt = addMinutes(new Date(), OTP_TTL_MINUTES);
    const name = body.name.trim();
    await this.pendingRegistration.upsert({
      email,
      name,
      passwordHash,
      codeHash,
      expiresAt,
    });
    try {
      await this.mailService.sendRegistrationOtp({
        to: email,
        name,
        code,
        locale: parseApiLocale(body.locale),
      });
    } catch {
      throw new ServiceUnavailableException({
        code: 'MAIL_SEND_FAILED',
        message: 'Failed to send verification email.',
      });
    }
    return { status: 'verification_required', email };
  }

  async verifyEmailRegistration(
    body: VerifyEmailRegistrationBody,
  ): Promise<AuthResponseDto> {
    const email = normalizeEmail(body.email);
    const pending = await this.pendingRegistration.findByEmail(email);
    if (!pending) {
      throw new BadRequestException({
        code: 'VERIFICATION_NOT_FOUND',
        message: 'Invalid or expired code',
      });
    }
    if (pending.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException({
        code: 'VERIFICATION_EXPIRED',
        message: 'Code has expired. Request a new one.',
      });
    }
    const ok = await this.passwordHasher.verify(body.code, pending.codeHash);
    if (!ok) {
      throw new BadRequestException({
        code: 'INVALID_CODE',
        message: 'Invalid or expired code',
      });
    }
    const existingUser = await this.userRepository.findActiveByEmail(email);
    if (existingUser?.emailVerifiedAt) {
      await this.prisma.pendingRegistration.deleteMany({ where: { email } });
      throw new BadRequestException({
        code: 'ALREADY_VERIFIED',
        message: 'Email is already verified',
      });
    }
    if (existingUser && !existingUser.emailVerifiedAt) {
      await this.prisma.user.deleteMany({
        where: { email, emailVerifiedAt: null, deletedAt: null },
      });
    }
    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const u = await tx.user.create({
          data: {
            email,
            name: pending.name,
            passwordHash: pending.passwordHash,
            emailVerifiedAt: new Date(),
            nameModerationStatus: PublicationModerationStatus.pending_review,
          },
        });
        await tx.pendingRegistration.delete({ where: { email } });
        return u;
      });
      void this.contentModeration.moderateDisplayNameInitial(user.id).catch(() => {});
      return this.issueTokens({
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'EMAIL_ALREADY_REGISTERED',
          message: 'Email is already registered',
        });
      }
      throw e;
    }
  }

  async resendEmailVerification(
    body: ResendEmailVerificationBody,
  ): Promise<void> {
    const nodeEnv = this.config.get<string>('nodeEnv') ?? 'development';
    if (
      nodeEnv === 'production' &&
      !this.mailService.isMailDeliveryConfigured()
    ) {
      throw new ServiceUnavailableException({
        code: 'MAIL_NOT_CONFIGURED',
        message:
          'Email is not configured (production: RESEND_API_KEY; development: SMTP / MailHog).',
      });
    }
    const email = normalizeEmail(body.email);
    const verifiedUser = await this.userRepository.findActiveByEmail(email);
    if (verifiedUser?.emailVerifiedAt) {
      throw new BadRequestException({
        code: 'ALREADY_VERIFIED',
        message: 'Email is already verified',
      });
    }
    const pending = await this.pendingRegistration.findByEmail(email);
    if (!pending) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }
    const match = await this.passwordHasher.verify(
      body.password,
      pending.passwordHash,
    );
    if (!match) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }
    const code = this.generateOtp();
    const codeHash = await this.passwordHasher.hash(code);
    const expiresAt = addMinutes(new Date(), OTP_TTL_MINUTES);
    await this.pendingRegistration.updateOtp(email, { codeHash, expiresAt });
    try {
      await this.mailService.sendRegistrationOtp({
        to: email,
        name: pending.name,
        code,
        locale: parseApiLocale(body.locale),
      });
    } catch {
      throw new ServiceUnavailableException({
        code: 'MAIL_SEND_FAILED',
        message: 'Failed to send verification email.',
      });
    }
  }

  async loginWithOauth(body: OauthLoginBody): Promise<AuthResponseDto> {
    const provider: OAuthProvider = 'google';
    const profile: VerifiedOAuthProfile =
      await this.oauthTokenVerifier.verifyGoogleIdToken(body.idToken);

    const linkedUserId = await this.oauthAccountRepository.findUserIdByProviderAccount(
      provider,
      profile.providerAccountId,
    );
    if (linkedUserId) {
      const user = await this.userRepository.findActiveById(linkedUserId);
      if (!user) {
        throw new UnauthorizedException({
          code: 'USER_NOT_FOUND',
          message: 'User no longer exists',
        });
      }
      if (!user.emailVerifiedAt) {
        const updated = await this.prisma.user.update({
          where: { id: user.id },
          data: { emailVerifiedAt: new Date() },
        });
        return this.issueTokens({
          id: updated.id,
          email: updated.email,
          name: updated.name,
          avatarUrl: updated.avatarUrl,
        });
      }
      return this.issueTokens(user);
    }

    if (!profile.email) {
      throw new BadRequestException({
        code: 'OAUTH_PROFILE_INCOMPLETE',
        message: 'Email is not available from the provider.',
      });
    }
    const email = normalizeEmail(profile.email);
    const existing = await this.userRepository.findActiveByEmail(email);
    if (existing) {
      return this.linkOauthToExistingUser(
        existing.id,
        provider,
        profile,
        existing,
      );
    }

    const locale = parseApiLocale(body.locale);
    try {
      const user = await this.prisma.$transaction(async (tx) => {
        await tx.pendingRegistration.deleteMany({ where: { email } });
        const u = await tx.user.create({
          data: {
            email,
            name: profile.name,
            emailVerifiedAt: new Date(),
            passwordHash: null,
            avatarUrl: profile.pictureUrl,
            locale,
            nameModerationStatus: PublicationModerationStatus.pending_review,
          },
        });
        await tx.userOAuthAccount.create({
          data: {
            userId: u.id,
            provider,
            providerAccountId: profile.providerAccountId,
          },
        });
        return u;
      });
      void this.contentModeration.moderateDisplayNameInitial(user.id).catch(() => {});
      return this.issueTokens({
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const again = await this.userRepository.findActiveByEmail(email);
        if (again) {
          return this.linkOauthToExistingUser(
            again.id,
            provider,
            profile,
            again,
          );
        }
      }
      throw e;
    }
  }

  private async linkOauthToExistingUser(
    userId: string,
    provider: OAuthProvider,
    profile: VerifiedOAuthProfile,
    existing: {
      id: string;
      email: string;
      name: string;
      avatarUrl: string | null;
      emailVerifiedAt: Date | null;
    },
  ): Promise<AuthResponseDto> {
    try {
      const user = await this.prisma.$transaction(async (tx) => {
        await tx.userOAuthAccount.create({
          data: {
            userId,
            provider,
            providerAccountId: profile.providerAccountId,
          },
        });
        if (!existing.emailVerifiedAt) {
          return tx.user.update({
            where: { id: userId },
            data: { emailVerifiedAt: new Date() },
          });
        }
        return tx.user.findFirstOrThrow({
          where: { id: userId, deletedAt: null },
        });
      });
      return this.issueTokens({
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const uid = await this.oauthAccountRepository.findUserIdByProviderAccount(
          provider,
          profile.providerAccountId,
        );
        if (uid) {
          const u2 = await this.userRepository.findActiveById(uid);
          if (u2) {
            return this.issueTokens(u2);
          }
        }
      }
      throw e;
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
