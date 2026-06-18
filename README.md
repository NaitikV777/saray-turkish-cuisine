# Saray Turkish Cuisine Website

This project contains two connected websites:

- Customer website at `/` for menu browsing, mobile-number lookup, reservations, and cancellations.
- Staff website at `/staff` for restaurant members to view and manage reservations.

The site uses a maroon Turkish-inspired theme, local generated restaurant imagery, item-level menu photos, animated cards, and a small Express API. Reservations are currently saved to `server/data/reservations.json`.

## Run On Your Laptop

PowerShell blocks `npm.ps1` on this machine, so use `npm.cmd`:

```powershell
npm.cmd install
npm.cmd run build
npm.cmd run start
```

Open:

- Customer site: http://127.0.0.1:3000
- Staff site: http://127.0.0.1:3000/staff

Default staff PIN:

```text
2468
```

## Environment Variables

Create a `.env` file from `.env.example`:

```powershell
Copy-Item .env.example .env
```

Set a private staff PIN before production:

```text
STAFF_PIN=choose-a-secure-pin
```

## Hostinger Deployment Notes

Use Hostinger Business Web Hosting or Cloud hosting with Node.js Web Apps.

Recommended settings:

```text
Node version: 22.x
Install command: npm install
Build command: Not needed if Hostinger does not show this field. The app builds automatically after `npm install`.
Start command: npm run start
Entry file: app.cjs
```

If Hostinger asks for a port, use `3000`. The app also supports a platform-provided `PORT` environment variable.

Before real restaurant launch, replace the local JSON reservation file with a real database such as Supabase Postgres, Hostinger MySQL, Neon Postgres, or MongoDB Atlas. A JSON file is fine for demo/testing, but a database is safer for backups, concurrent users, and redeploys.

## Production Checklist

1. Buy/connect a domain name.
2. Set `STAFF_PIN` in Hostinger environment variables.
3. Deploy from GitHub through Hostinger's Node.js Web App flow.
4. Enable HTTPS/SSL.
5. Replace JSON reservation storage with a production database.
6. Add proper staff accounts before giving multiple staff members access.
7. Add privacy/terms language for collecting names and phone numbers.

One note: the original project request mentioned Waterloo, but the provided address is in Barrie. The site currently uses the Barrie address exactly as provided.
