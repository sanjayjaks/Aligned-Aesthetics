import { clearAdminSessionCookie } from '../_lib/auth.js';
import { applyCorsHeaders, handleCorsPreflight, sendJson } from '../_lib/http.js';

export default function handler(request, response) {
  applyCorsHeaders(request, response);

  if (handleCorsPreflight(request, response)) {
    return;
  }

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    sendJson(response, 405, { ok: false, error: 'Method not allowed' });
    return;
  }

  response.setHeader('Set-Cookie', clearAdminSessionCookie());
  sendJson(response, 200, { ok: true });
}
