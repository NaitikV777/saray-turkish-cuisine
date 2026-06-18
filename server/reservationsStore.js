import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reservationsFile = path.join(__dirname, 'data', 'reservations.json');

let pool;

function hasDatabaseConfig() {
  return Boolean(process.env.DATABASE_URL || (process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME));
}

function getPool() {
  if (!hasDatabaseConfig()) {
    return null;
  }

  if (!pool) {
    if (process.env.DATABASE_URL) {
      pool = mysql.createPool(process.env.DATABASE_URL);
    } else {
      pool = mysql.createPool({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        namedPlaceholders: true,
      });
    }
  }

  return pool;
}

function rowToReservation(row) {
  return {
    reference: row.reference,
    name: row.name,
    phone: row.phone,
    date: row.reservation_date,
    time: row.reservation_time,
    partySize: row.party_size,
    occasion: row.occasion || '',
    notes: row.notes || '',
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    cancelledAt: row.cancelled_at || undefined,
  };
}

async function ensureReservationsFile() {
  await fs.mkdir(path.dirname(reservationsFile), { recursive: true });

  try {
    await fs.access(reservationsFile);
  } catch {
    await fs.writeFile(reservationsFile, '[]', 'utf8');
  }
}

async function readJsonReservations() {
  await ensureReservationsFile();
  const raw = await fs.readFile(reservationsFile, 'utf8');
  return JSON.parse(raw || '[]');
}

async function writeJsonReservations(reservations) {
  await fs.writeFile(reservationsFile, JSON.stringify(reservations, null, 2), 'utf8');
}

export function getReservationStoreName() {
  return getPool() ? 'mysql' : 'json';
}

export async function initializeReservationStore() {
  const db = getPool();

  if (!db) {
    await ensureReservationsFile();
    return;
  }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS reservations (
      reference VARCHAR(32) PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      phone VARCHAR(32) NOT NULL,
      reservation_date VARCHAR(10) NOT NULL,
      reservation_time VARCHAR(10) NOT NULL,
      party_size INT NOT NULL,
      occasion VARCHAR(120),
      notes TEXT,
      status VARCHAR(30) NOT NULL DEFAULT 'pending',
      created_at VARCHAR(32) NOT NULL,
      updated_at VARCHAR(32) NOT NULL,
      cancelled_at VARCHAR(32),
      INDEX idx_reservations_phone (phone),
      INDEX idx_reservations_date_time (reservation_date, reservation_time),
      INDEX idx_reservations_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

export async function listReservations() {
  const db = getPool();

  if (!db) {
    return readJsonReservations();
  }

  const [rows] = await db.execute(`
    SELECT reference, name, phone, reservation_date, reservation_time, party_size,
      occasion, notes, status, created_at, updated_at, cancelled_at
    FROM reservations
  `);
  return rows.map(rowToReservation);
}

export async function listReservationsByPhone(phone) {
  const db = getPool();

  if (!db) {
    const reservations = await readJsonReservations();
    return reservations.filter((reservation) => reservation.phone === phone);
  }

  const [rows] = await db.execute(
    `
      SELECT reference, name, phone, reservation_date, reservation_time, party_size,
        occasion, notes, status, created_at, updated_at, cancelled_at
      FROM reservations
      WHERE phone = ?
    `,
    [phone],
  );
  return rows.map(rowToReservation);
}

export async function findReservationByReference(reference) {
  const db = getPool();

  if (!db) {
    const reservations = await readJsonReservations();
    return reservations.find((reservation) => reservation.reference === reference) || null;
  }

  const [rows] = await db.execute(
    `
      SELECT reference, name, phone, reservation_date, reservation_time, party_size,
        occasion, notes, status, created_at, updated_at, cancelled_at
      FROM reservations
      WHERE reference = ?
      LIMIT 1
    `,
    [reference],
  );
  return rows[0] ? rowToReservation(rows[0]) : null;
}

export async function saveReservation(reservation) {
  const db = getPool();

  if (!db) {
    const reservations = await readJsonReservations();
    reservations.push(reservation);
    await writeJsonReservations(reservations);
    return reservation;
  }

  await db.execute(
    `
      INSERT INTO reservations (
        reference, name, phone, reservation_date, reservation_time, party_size,
        occasion, notes, status, created_at, updated_at, cancelled_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      reservation.reference,
      reservation.name,
      reservation.phone,
      reservation.date,
      reservation.time,
      reservation.partySize,
      reservation.occasion || null,
      reservation.notes || null,
      reservation.status,
      reservation.createdAt,
      reservation.updatedAt,
      reservation.cancelledAt || null,
    ],
  );

  return reservation;
}

export async function updateReservationStatus(reference, status, updatedAt, cancelledAt) {
  const db = getPool();

  if (!db) {
    const reservations = await readJsonReservations();
    const reservation = reservations.find((item) => item.reference === reference);

    if (!reservation) {
      return null;
    }

    reservation.status = status;
    reservation.updatedAt = updatedAt;

    if (cancelledAt) {
      reservation.cancelledAt = cancelledAt;
    }

    await writeJsonReservations(reservations);
    return reservation;
  }

  const existing = await findReservationByReference(reference);

  if (!existing) {
    return null;
  }

  const nextCancelledAt = cancelledAt || existing.cancelledAt || null;
  await db.execute(
    `
      UPDATE reservations
      SET status = ?, updated_at = ?, cancelled_at = ?
      WHERE reference = ?
    `,
    [status, updatedAt, nextCancelledAt, reference],
  );

  return {
    ...existing,
    status,
    updatedAt,
    cancelledAt: nextCancelledAt || undefined,
  };
}
