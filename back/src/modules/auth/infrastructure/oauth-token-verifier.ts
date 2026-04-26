import { BadRequestException, Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { OAuthProvider } from '@prisma/client';

function envOrConfig(
  config: ConfigService | undefined,
  key: `oauth.${string}`,
  envName: string,
): string {
  const from = config?.get<string>(key);
  if (typeof from === 'string' && from.trim() !== '') {
    return from.trim();
  }
  return process.env[envName]?.trim() ?? '';
}

export type VerifiedOAuthProfile = {
  provider: OAuthProvider;
  /** Стабильный id у провайдера (Google `sub`). */
  providerAccountId: string;
  email: string | null;
  name: string;
  pictureUrl: string | null;
};

@Injectable()
export class OAuthTokenVerifier {
  private googleClient: OAuth2Client | null = null;

  constructor(
    @Optional() @Inject(ConfigService) private readonly config: ConfigService | undefined,
  ) {}

  private googleAudiencesFromEnv(): string[] {
    const raw = envOrConfig(
      this.config,
      'oauth.google.clientId',
      'GOOGLE_OAUTH_CLIENT_ID',
    );
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  private getGoogleClient(): OAuth2Client | null {
    const audiences = this.googleAudiencesFromEnv();
    if (audiences.length === 0) {
      return null;
    }
    if (!this.googleClient) {
      this.googleClient = new OAuth2Client(audiences[0]);
    }
    return this.googleClient;
  }

  async verifyGoogleIdToken(idToken: string): Promise<VerifiedOAuthProfile> {
    const googleAudiences = this.googleAudiencesFromEnv();
    const client = this.getGoogleClient();
    if (!client || googleAudiences.length === 0) {
      throw new BadRequestException({
        code: 'OAUTH_NOT_CONFIGURED',
        message: 'Google sign-in is not configured (GOOGLE_OAUTH_CLIENT_ID)',
      });
    }
    type GoogleIdPayload = {
      sub?: string;
      email?: string;
      name?: string;
      picture?: string;
    };
    let payload: GoogleIdPayload | null;
    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: googleAudiences,
      });
      payload = (ticket.getPayload() ?? null) as GoogleIdPayload | null;
    } catch {
      throw new BadRequestException({
        code: 'OAUTH_INVALID_TOKEN',
        message: 'Invalid Google ID token',
      });
    }
    if (!payload?.sub) {
      throw new BadRequestException({
        code: 'OAUTH_INVALID_TOKEN',
        message: 'Invalid Google ID token (missing sub)',
      });
    }
    const email = payload.email
      ? String(payload.email).trim().toLowerCase() || null
      : null;
    if (!email) {
      throw new BadRequestException({
        code: 'OAUTH_EMAIL_REQUIRED',
        message: 'Google did not return an email for this account',
      });
    }
    const name =
      (typeof payload.name === 'string' && payload.name.trim()
        ? payload.name.trim()
        : null) ?? this.fallbackNameFromEmail(email) ?? 'User';
    const pictureUrl =
      typeof payload.picture === 'string' && payload.picture.length > 0
        ? payload.picture
        : null;
    return {
      provider: 'google' as const,
      providerAccountId: payload.sub,
      email,
      name: name.slice(0, 120),
      pictureUrl,
    };
  }

  private fallbackNameFromEmail(email: string | null): string | null {
    if (!email) {
      return null;
    }
    const local = email.split('@')[0] ?? email;
    return local ? local.slice(0, 120) : null;
  }
}
