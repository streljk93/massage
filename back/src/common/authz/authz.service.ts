import { ForbiddenException } from '@nestjs/common';

export function throwPolicyForbidden(
  capability: string,
  reason: string,
): never {
  throw new ForbiddenException({
    code: 'ACCESS_DENIED',
    capability,
    reason,
    message: 'Access denied',
  });
}

