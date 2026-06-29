import { buildAdminSessionCookie, issueAdminSession, validateAdminCredentials } from '../_lib/auth.js';
import { applyCorsHeaders, handleCorsPreflight, readJsonBody, sendJson } from '../_lib/http.js';

export default async function handler(request, response) {
  applyCorsHeaders(request, response);

  if (handleCorsPreflight(request, response)) {
    return;
  }

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    sendJson(response, 405, { ok: false, error: 'Method not allowed' });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const username = String(body.username || '').trim();
    const password = String(body.password || '');

    if (!validateAdminCredentials(username, password)) {
      sendJson(response, 401, { ok: false, error: 'Invalid admin credentials.' });
      return;
    }

    const sessionToken = issueAdminSession();

    response.setHeader('Set-Cookie', buildAdminSessionCookie(sessionToken));
    sendJson(response, 200, { ok: true });
  } catch (error) {
    sendJson(response, 500, { ok: false, error: 'Unable to sign in right now.' });
  }
}
