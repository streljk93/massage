export type AuthUserDto = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
};

export type AuthTokensDto = {
  accessToken: string;
  refreshToken: string;
};

export type AuthResponseDto = {
  user: AuthUserDto;
} & AuthTokensDto;
