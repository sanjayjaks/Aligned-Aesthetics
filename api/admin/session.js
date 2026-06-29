import { getAdminSession } from '../_lib/auth.js';
import { applyCorsHeaders, handleCorsPreflight, sendJson } from '../_lib/http.js';

export default function handler(request, response) {
  applyCorsHeaders(request, response);

  if (handleCorsPreflight(request, response)) {
    return;
  }

  const session = getAdminSession(request);

  if (!session) {
    sendJson(response, 401, { ok: false, authenticated: false });
    return;
  }

  sendJson(response, 200, { ok: true, authenticated: true, username: session.username });
}
