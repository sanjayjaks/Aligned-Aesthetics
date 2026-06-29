# Aligned Asthetics

## Client site

Open `index.html` as the public landing page. The contact form posts to `/api/messages` and the submitted requests are stored for the admin inbox.

## Admin page

Open `admin.html` directly to review client requests.

Admin login:

- Username: `admin`
- Password: `AA@12479`

## Vercel deployment

This project is ready for Vercel as a static site plus API routes.

Project layout on Vercel:

- Public site: `/index.html`
- Admin page: `/admin` or `/admin.html`
- Request API: `/api/messages`
- Admin API: `/api/admin/*`

Before deploying, connect a Redis integration in Vercel so the message inbox persists:

1. Add a Redis integration in the Vercel dashboard.
2. Make sure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are available in the project environment.
3. Deploy the repo to Vercel.
4. Open the live site and visit `/admin` directly when you need the inbox.

If Redis is not connected, the public form will not be able to store incoming client requests.

Local testing note:

## Local development

Run the client and admin on separate ports so you can test them side by side:

1. `npm run dev:client` opens the public site at `http://localhost:3000`
2. `npm run dev:admin` opens the admin page at `http://localhost:3001`

Both local servers share the same file-backed request store, so a client request submitted on the client port will appear in the admin inbox on the admin port.

If you open `admin.html` from a static local server, the page still falls back to browser storage.
In production, the admin inbox uses the Vercel API routes and Redis.