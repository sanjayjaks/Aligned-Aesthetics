import crypto from 'node:crypto';

export const ADMIN_USERNAME = 'admin';
export const ADMIN_PASSWORD = 'AA@12479';
export const SESSION_COOKIE = 'aa_admin_session';

const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'aligned-aesthetics-admin-session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export function validateAdminCredentials(username, password) {
  return username === ADMIN_USERNAME && password === ADMIN_PASSWORD;
}

function signPayload(payload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');

  return encodedPayload + '.' + signature;
}

export function issueAdminSession() {
  return signPayload({
    username: ADMIN_USERNAME,
    expiresAt: Date.now() + SESSION_TTL_MS
  });
}

export function verifyAdminSession(token) {
  if (!token) {
    return null;
  }

  const parts = token.split('.');

  if (parts.length !== 2) {
    return null;
  }

  const payloadPart = parts[0];
  const signaturePart = parts[1];
  const expectedSignature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadPart)
    .digest('base64url');

  if (signaturePart.length !== expectedSignature.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(Buffer.from(signaturePart), Buffer.from(expectedSignature))) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));

    if (payload.username !== ADMIN_USERNAME || typeof payload.expiresAt !== 'number') {
      return null;
    }

    if (Date.now() > payload.expiresAt) {
      return null;
    }

    return payload;
  } catch (error) {
    return null;
  }
}

export function getCookieValue(request, cookieName) {
  const cookieHeader = request.headers.cookie || '';
  const cookies = cookieHeader.split(';').map(function (cookie) {
    return cookie.trim();
  });

  for (let index = 0; index < cookies.length; index += 1) {
    const cookie = cookies[index];
    const separatorIndex = cookie.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const name = cookie.slice(0, separatorIndex);
    const value = cookie.slice(separatorIndex + 1);

    if (name === cookieName) {
      return value;
    }
  }

  return null;
}

export function getAdminSession(request) {
  return verifyAdminSession(getCookieValue(request, SESSION_COOKIE));
}

export function buildAdminSessionCookie(token) {
  const cookieParts = [
    SESSION_COOKIE + '=' + token,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=' + Math.floor(SESSION_TTL_MS / 1000)
  ];

  if (process.env.NODE_ENV === 'production') {
    cookieParts.push('Secure');
  }

  return cookieParts.join('; ');
}

export function clearAdminSessionCookie() {
  const cookieParts = [
    SESSION_COOKIE + '=;',
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0'
  ];

  if (process.env.NODE_ENV === 'production') {
    cookieParts.push('Secure');
  }

  return cookieParts.join('; ');
}
