import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AuthResponseDto } from '../dto/auth-response.dto';
import type { LoginBody } from '../dto/login-body.schema';
import type { RegisterBody } from '../dto/register-body.schema';
import { PasswordHasher } from '../infrastructure/password-hasher';
import { UserRepository } from '../infrastructure/user.repository';

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
  ) {}

  async register(body: RegisterBody): Promise<AuthResponseDto> {
    const email = normalizeEmail(body.email);
    const passwordHash = await this.passwordHasher.hash(body.password);
    try {
      const user = await this.userRepository.createUser({
        email,
        name: body.name.trim(),
        passwordHash,
      });
      return this.issueTokens(user);
    } catch (error) {
      if (this.userRepository.isUniqueViolation(error)) {
        throw new ConflictException({
          code: 'EMAIL_ALREADY_REGISTERED',
          message: 'Email is already registered',
        });
      }
      throw error;
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
}
