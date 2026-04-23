import { BadRequestException } from '@nestjs/common';

export const DIRECTORY_LIST_DEFAULT_LIMIT = 20;
export const DIRECTORY_LIST_MAX_LIMIT = 100;

export function parseDirectoryListLimit(raw: string | undefined): number {
  if (raw === undefined || raw === '') {
    return DIRECTORY_LIST_DEFAULT_LIMIT;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) {
    throw new BadRequestException({
      code: 'INVALID_LIMIT',
      message: 'limit must be a positive integer',
    });
  }
  return Math.min(n, DIRECTORY_LIST_MAX_LIMIT);
}
