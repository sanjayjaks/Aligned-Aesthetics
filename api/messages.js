import crypto from 'node:crypto';
import { applyCorsHeaders, handleCorsPreflight, readJsonBody, sendJson } from './_lib/http.js';
import { saveClientMessage } from './_lib/messages.js';

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
    const clientName = String(body.client_name || '').trim();
    const clientEmail = String(body.client_email || '').trim();
    const clientMobile = String(body.client_mobile || '').trim();
    const selectedService = String(body.selected_service || '').trim();
    const clientMessage = String(body.client_message || '').trim();

    if (!clientName || !clientEmail || !clientMobile || !selectedService || !clientMessage) {
      sendJson(response, 400, { ok: false, error: 'Please complete every field before sending.' });
      return;
    }

    const message = {
      id: crypto.randomUUID(),
      clientName,
      clientEmail,
      clientMobile,
      selectedService,
      clientMessage,
      createdAt: new Date().toISOString(),
      status: 'new'
    };

    await saveClientMessage(message);

    sendJson(response, 200, { ok: true });
  } catch (error) {
    sendJson(response, 500, {
      ok: false,
      error: error.message || 'Unable to save your message right now.'
    });
  }
}
