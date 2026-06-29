import { getAdminSession } from '../_lib/auth.js';
import { applyCorsHeaders, handleCorsPreflight, sendJson } from '../_lib/http.js';
import { loadClientMessages } from '../_lib/messages.js';

export default async function handler(request, response) {
  applyCorsHeaders(request, response);

  if (handleCorsPreflight(request, response)) {
    return;
  }

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    sendJson(response, 405, { ok: false, error: 'Method not allowed' });
    return;
  }

  if (!getAdminSession(request)) {
    sendJson(response, 401, { ok: false, error: 'Unauthorized' });
    return;
  }

  try {
    const messages = await loadClientMessages();
    sendJson(response, 200, { ok: true, messages });
  } catch (error) {
    sendJson(response, 500, { ok: false, error: 'Unable to load messages right now.' });
  }
}
