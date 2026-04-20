export type AuthUserDto = {
  id: string;
  email: string;
  name: string;
};

export type AuthTokensDto = {
  accessToken: string;
  refreshToken: string;
};

export type AuthResponseDto = {
  user: AuthUserDto;
} & AuthTokensDto;
