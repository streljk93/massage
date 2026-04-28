import { Logger } from '@nestjs/common';

const log = new Logger('AddressHttp');

export class UpstreamAddressTimeoutError extends Error {
  override readonly name = 'UpstreamAddressTimeoutError';
}

/**
 * `fetch` с таймаутом (AbortController). 408/сеть — снаружи обрабатывать как «следующий провайдер».
 */
export async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: c.signal });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new UpstreamAddressTimeoutError();
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}

/** Переходим к следующему провайдеру в цепочке. */
export function isFallbackHttpStatus(status: number): boolean {
  if (status === 429) {
    return true;
  }
  if (status === 408) {
    return true;
  }
  if (status >= 500 && status <= 599) {
    return true;
  }
  return false;
}

export function logAddressUpstream(
  kind: 'warn' | 'debug',
  providerId: string,
  message: string,
) {
  if (kind === 'warn') {
    log.warn(`[${providerId}] ${message}`);
  } else {
    log.debug(`[${providerId}] ${message}`);
  }
}
