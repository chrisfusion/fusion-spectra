import type { AuthUser } from '@/stores/auth'

export function createBypassUser(): AuthUser {
  return {
    sub: 'dev-user',
    name: 'Dev User',
    email: 'dev@fusion.local',
    preferred_username: 'dev',
    accessToken: 'dev-bypass-token',
  }
}

export function createTokenUser(token: string): AuthUser {
  // Decode JWT payload to extract user claims — no verification, dev only
  try {
    // JWT uses base64url — normalise to standard base64 before decoding
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, '=')
    const payload = JSON.parse(atob(padded)) as Record<string, unknown>
    return {
      sub: String(payload['sub'] ?? 'token-user'),
      name: String(payload['name'] ?? payload['preferred_username'] ?? 'Token User'),
      email: String(payload['email'] ?? ''),
      preferred_username: String(payload['preferred_username'] ?? payload['sub'] ?? 'token-user'),
      accessToken: token,
    }
  } catch {
    return {
      sub: 'token-user',
      name: 'Token User',
      email: '',
      preferred_username: 'token-user',
      accessToken: token,
    }
  }
}
