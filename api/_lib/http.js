export function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let rawBody = '';

    request.setEncoding('utf8');

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

export function sendJson(response, statusCode, payload, extraHeaders) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (extraHeaders) {
    Object.keys(extraHeaders).forEach(function (headerName) {
      response.setHeader(headerName, extraHeaders[headerName]);
    });
  }

  response.end(JSON.stringify(payload));
}

export function applyCorsHeaders(request, response) {
  const origin = request.headers.origin;
  const allowOrigin = origin || 'null';

  response.setHeader('Access-Control-Allow-Origin', allowOrigin);
  response.setHeader('Vary', 'Origin');
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export function handleCorsPreflight(request, response) {
  if (request.method !== 'OPTIONS') {
    return false;
  }

  applyCorsHeaders(request, response);
  response.statusCode = 204;
  response.end();
  return true;
}
