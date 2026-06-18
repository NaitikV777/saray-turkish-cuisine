import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { menuSections } from '../src/data/menu.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 5174);
const staffPin = process.env.STAFF_PIN || '2468';
const reservationsFile = path.join(__dirname, 'data', 'reservations.json');
const distPath = path.join(__dirname, '..', 'dist');

app.use(cors({ origin: true }));
app.use(express.json());

async function ensureReservationsFile() {
  await fs.mkdir(path.dirname(reservationsFile), { recursive: true });

  try {
    await fs.access(reservationsFile);
  } catch {
    await fs.writeFile(reservationsFile, '[]', 'utf8');
  }
}

async function readReservations() {
  await ensureReservationsFile();
  const raw = await fs.readFile(reservationsFile, 'utf8');
  return JSON.parse(raw || '[]');
}

async function writeReservations(reservations) {
  await fs.writeFile(reservationsFile, JSON.stringify(reservations, null, 2), 'utf8');
}

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  return digits.length >= 10 ? `+${digits}` : '';
}

function createReference(existing) {
  const used = new Set(existing.map((reservation) => reservation.reference));
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  let reference = '';
  do {
    const code = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
    reference = `SRY-${new Date().getFullYear()}-${code}`;
  } while (used.has(reference));

  return reference;
}

function requireStaff(req, res) {
  const suppliedPin = String(req.headers['x-staff-pin'] || req.query.pin || '');

  if (suppliedPin !== staffPin) {
    res.status(401).json({ error: 'Staff PIN is required.' });
    return false;
  }

  return true;
}

function sortReservations(reservations) {
  return [...reservations].sort((a, b) => {
    const aKey = `${a.date} ${a.time}`;
    const bKey = `${b.date} ${b.time}`;
    return aKey.localeCompare(bKey);
  });
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, restaurant: 'Saray Turkish Cuisine' });
});

app.get('/api/menu', (_req, res) => {
  res.json({ sections: menuSections });
});

app.post('/api/auth/login', async (req, res) => {
  const phone = normalizePhone(req.body.phone);

  if (!phone) {
    return res.status(400).json({ error: 'Enter a valid mobile number.' });
  }

  const reservations = await readReservations();
  const customerReservations = sortReservations(reservations).filter((reservation) => reservation.phone === phone);
  res.json({ phone, reservations: customerReservations });
});

app.post('/api/reservations', async (req, res) => {
  const reservations = await readReservations();
  const name = String(req.body.name || '').trim();
  const phone = normalizePhone(req.body.phone);
  const date = String(req.body.date || '').trim();
  const time = String(req.body.time || '').trim();
  const partySize = Number(req.body.partySize);
  const occasion = String(req.body.occasion || '').trim();
  const notes = String(req.body.notes || '').trim();

  if (!name || !phone || !date || !time || !Number.isInteger(partySize) || partySize < 1 || partySize > 30) {
    return res.status(400).json({ error: 'Please complete the reservation form with valid details.' });
  }

  const reservation = {
    reference: createReference(reservations),
    name,
    phone,
    date,
    time,
    partySize,
    occasion,
    notes,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  reservations.push(reservation);
  await writeReservations(reservations);

  res.status(201).json({ reservation });
});

app.patch('/api/reservations/:reference/cancel', async (req, res) => {
  const reservations = await readReservations();
  const reservation = reservations.find((item) => item.reference === req.params.reference);

  if (!reservation) {
    return res.status(404).json({ error: 'Reservation not found.' });
  }

  const isStaff = String(req.headers['x-staff-pin'] || '') === staffPin;
  const phone = normalizePhone(req.body.phone);

  if (!isStaff && reservation.phone !== phone) {
    return res.status(403).json({ error: 'This reservation belongs to a different mobile number.' });
  }

  reservation.status = 'cancelled';
  reservation.cancelledAt = new Date().toISOString();
  reservation.updatedAt = new Date().toISOString();
  await writeReservations(reservations);

  res.json({ reservation });
});

app.get('/api/staff/reservations', async (req, res) => {
  if (!requireStaff(req, res)) {
    return;
  }

  const reservations = sortReservations(await readReservations());
  res.json({ reservations });
});

app.patch('/api/staff/reservations/:reference', async (req, res) => {
  if (!requireStaff(req, res)) {
    return;
  }

  const allowedStatuses = new Set(['pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no-show']);
  const nextStatus = String(req.body.status || '');

  if (!allowedStatuses.has(nextStatus)) {
    return res.status(400).json({ error: 'Choose a valid reservation status.' });
  }

  const reservations = await readReservations();
  const reservation = reservations.find((item) => item.reference === req.params.reference);

  if (!reservation) {
    return res.status(404).json({ error: 'Reservation not found.' });
  }

  reservation.status = nextStatus;
  reservation.updatedAt = new Date().toISOString();
  await writeReservations(reservations);

  res.json({ reservation });
});

try {
  await fs.access(path.join(distPath, 'index.html'));
  app.use(express.static(distPath));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} catch {
  // Vite serves the app during development. Static files are registered after `npm run build`.
}

await ensureReservationsFile();

app.listen(port, () => {
  console.log(`Saray API running on http://127.0.0.1:${port}`);
});
