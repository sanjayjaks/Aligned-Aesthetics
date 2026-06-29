import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');

const port = process.env.PORT || (portIndex >= 0 ? Number(args[portIndex + 1]) : 3000);

const ALLOWED_FILES = new Set([
  '/',
  '/index.html',
  '/admin.html',
  '/style.css',
  '/script.js',
  '/favicon.ico'
]);

const MESSAGE_STORE_DIR = path.join(__dirname, '.data');
const MESSAGE_STORE_FILE = path.join(MESSAGE_STORE_DIR, 'messages.json');
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'AA@12479';
const SESSION_COOKIE = 'aa_admin_session';
const SESSION_SECRET = 'aligned-aesthetics-local-session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function sendJson(response, statusCode, payload, headers) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    ...headers
  });
  response.end(JSON.stringify(payload));
}

function parseCookies(cookieHeader) {
  const cookies = {};
  String(cookieHeader || '')
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((cookie) => {
      const separatorIndex = cookie.indexOf('=');
      if (separatorIndex === -1) {
        return;
      }

      const name = cookie.slice(0, separatorIndex);
      const value = cookie.slice(separatorIndex + 1);
      cookies[name] = value;
    });

  return cookies;
}

function signSession(payload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');

  return encodedPayload + '.' + signature;
}

function verifySession(token) {
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

function buildSessionCookie(token) {
  const cookieParts = [
    SESSION_COOKIE + '=' + token,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=' + Math.floor(SESSION_TTL_MS / 1000)
  ];

  return cookieParts.join('; ');
}

function buildClearedCookie() {
  return [SESSION_COOKIE + '=;', 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'].join('; ');
}

async function ensureStore() {
  await fs.mkdir(MESSAGE_STORE_DIR, { recursive: true });

  try {
    await fs.access(MESSAGE_STORE_FILE);
  } catch (error) {
    await fs.writeFile(MESSAGE_STORE_FILE, '[]', 'utf8');
  }
}

async function readStore() {
  await ensureStore();
  try {
    const raw = await fs.readFile(MESSAGE_STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

async function writeStore(messages) {
  await ensureStore();
  await fs.writeFile(MESSAGE_STORE_FILE, JSON.stringify(messages.slice(0, 200), null, 2), 'utf8');
}

async function readRequestBody(request) {
  return await new Promise((resolve, reject) => {
    let rawBody = '';

    request.on('data', function (chunk) {
      rawBody += chunk;

      if (rawBody.length > 1e6) {
        reject(new Error('Payload too large'));
        request.destroy();
      }
    });

    request.on('end', function () {
      if (!rawBody) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(rawBody));
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });

    request.on('error', reject);
  });
}

function serveFile(response, filePath, contentType) {
  fs.readFile(filePath)
    .then((content) => {
      response.writeHead(200, { 'Content-Type': contentType });
      response.end(content);
    })
    .catch(() => {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    });
}

function isAuthenticated(request) {
  const cookies = parseCookies(request.headers.cookie);
  return Boolean(verifySession(cookies[SESSION_COOKIE]));
}

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === '.html') return 'text/html; charset=utf-8';
  if (extension === '.css') return 'text/css; charset=utf-8';
  if (extension === '.js') return 'application/javascript; charset=utf-8';
  if (extension === '.json') return 'application/json; charset=utf-8';
  if (extension === '.png') return 'image/png';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.svg') return 'image/svg+xml';
  return 'application/octet-stream';
}

async function handleApi(request, response) {
  const url = new URL(request.url, 'http://localhost');

  if (url.pathname === '/api/messages' && request.method === 'POST') {
    try {
      const body = await readRequestBody(request);
      const clientName = String(body.client_name || '').trim();
      const clientEmail = String(body.client_email || '').trim();
      const clientMobile = String(body.client_mobile || '').trim();
      const selectedService = String(body.selected_service || '').trim();
      const clientMessage = String(body.client_message || '').trim();

      if (!clientName || !clientEmail || !clientMobile || !selectedService || !clientMessage) {
        sendJson(response, 400, { ok: false, error: 'Please complete every field before sending.' });
        return;
      }

      const messages = await readStore();
      messages.unshift({
        id: crypto.randomUUID(),
        clientName,
        clientEmail,
        clientMobile,
        selectedService,
        clientMessage,
        createdAt: new Date().toISOString(),
        status: 'new'
      });

      await writeStore(messages);
      sendJson(response, 200, { ok: true });
    } catch (error) {
      sendJson(response, 500, { ok: false, error: error.message || 'Unable to save your message right now.' });
    }
    return;
  }

  if (url.pathname === '/api/admin/login' && request.method === 'POST') {
    try {
      const body = await readRequestBody(request);
      const username = String(body.username || '').trim();
      const password = String(body.password || '');

      if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
        sendJson(response, 401, { ok: false, error: 'Invalid admin credentials.' });
        return;
      }

      const sessionToken = signSession({
        username: ADMIN_USERNAME,
        expiresAt: Date.now() + SESSION_TTL_MS
      });

      sendJson(response, 200, { ok: true }, { 'Set-Cookie': buildSessionCookie(sessionToken) });
    } catch (error) {
      sendJson(response, 500, { ok: false, error: 'Unable to sign in right now.' });
    }
    return;
  }

  if (url.pathname === '/api/admin/session' && request.method === 'GET') {
    if (!isAuthenticated(request)) {
      sendJson(response, 401, { ok: false, authenticated: false });
      return;
    }

    sendJson(response, 200, { ok: true, authenticated: true, username: ADMIN_USERNAME });
    return;
  }

  if (url.pathname === '/api/admin/messages' && request.method === 'GET') {
    if (!isAuthenticated(request)) {
      sendJson(response, 401, { ok: false, error: 'Unauthorized' });
      return;
    }

    const messages = await readStore();
    sendJson(response, 200, { ok: true, messages });
    return;
  }

  if (url.pathname === '/api/admin/logout' && request.method === 'POST') {
    sendJson(response, 200, { ok: true }, { 'Set-Cookie': buildClearedCookie() });
    return;
  }

  sendJson(response, 404, { ok: false, error: 'Not found' });
}

function handleStatic(request, response) {
  const requestUrl = new URL(request.url, 'http://localhost');
  const pathname = requestUrl.pathname;

  if (pathname.startsWith('/api/')) {
    return false;
  }

  let targetPath = pathname;

  // Handle trailing slashes explicitly
  if (pathname === '/' || pathname === '') {
    targetPath = '/index.html';
  } else if (pathname === '/admin' || pathname === '/admin/') {
    targetPath = '/admin.html';
  }

  if (!ALLOWED_FILES.has(targetPath) && !targetPath.startsWith('/images/')) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return true;
  }

  const filePath = path.join(__dirname, targetPath.replace(/^\//, ''));
  serveFile(response, filePath, getContentType(filePath));
  return true;
}

const server = http.createServer(async function (request, response) {
  try {
    if (request.url.startsWith('/api/')) {
      await handleApi(request, response);
      return;
    }

    if (!handleStatic(request, response)) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    }
  } catch (error) {
    sendJson(response, 500, { ok: false, error: error.message || 'Server error' });
  }
});

server.listen(port, function () {
  console.log('Aligned Asthetics server running at http://localhost:' + port);
});

