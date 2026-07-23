import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import pg from 'pg';

const { Pool: PgPool } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reservationsFile = path.join(__dirname, 'data', 'reservations.json');

let pool;
let poolType = 'json';

const postgresUrlKeys = [
  'DATABASE_URL',
  'POSTGRES_URL',
  'POSTGRES_PRISMA_URL',
  'POSTGRES_URL_NON_POOLING',
  'SUPABASE_DB_URL',
  'SUPABASE_DATABASE_URL',
];

function firstEnv(keys) {
  return keys.map((key) => process.env[key]).find(Boolean);
}

function isPostgresUrl(value = '') {
  return value.startsWith('postgres://') || value.startsWith('postgresql://');
}

function isMysqlUrl(value = '') {
  return value.startsWith('mysql://') || value.startsWith('mysql2://');
}

function getPostgresUrl() {
  return firstEnv(postgresUrlKeys.filter((key) => isPostgresUrl(process.env[key] || '')));
}

function hasPostgresConfig() {
  return Boolean(
    getPostgresUrl() ||
      (process.env.PGHOST && process.env.PGUSER && process.env.PGDATABASE),
  );
}

function hasMysqlConfig() {
  return Boolean(
    isMysqlUrl(process.env.DATABASE_URL || '') ||
      (process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME),
  );
}

function getPool() {
  if (pool) {
    return { pool, type: poolType };
  }

  if (hasPostgresConfig()) {
    const connectionString = getPostgresUrl();
    poolType = 'postgres';
    pool = connectionString
      ? new PgPool({
          connectionString,
          ssl: { rejectUnauthorized: false },
        })
      : new PgPool({
          host: process.env.PGHOST,
          port: Number(process.env.PGPORT || 5432),
          user: process.env.PGUSER,
          password: process.env.PGPASSWORD || '',
          database: process.env.PGDATABASE,
          ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
        });
    return { pool, type: poolType };
  }

  if (hasMysqlConfig()) {
    poolType = 'mysql';
    pool = isMysqlUrl(process.env.DATABASE_URL || '')
      ? mysql.createPool(process.env.DATABASE_URL)
      : mysql.createPool({
          host: process.env.DB_HOST,
          port: Number(process.env.DB_PORT || 3306),
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD || '',
          database: process.env.DB_NAME,
          waitForConnections: true,
          connectionLimit: 10,
          namedPlaceholders: true,
        });
    return { pool, type: poolType };
  }

  return null;
}

function rowToReservation(row) {
  return {
    reference: row.reference,
    name: row.name,
    phone: row.phone,
    date: row.reservation_date,
    time: row.reservation_time,
    partySize: Number(row.party_size),
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

async function query(db, mysqlSql, postgresSql = mysqlSql, params = []) {
  if (db.type === 'postgres') {
    const result = await db.pool.query(postgresSql, params);
    return result.rows;
  }

  const [rows] = await db.pool.execute(mysqlSql, params);
  return rows;
}

export function getReservationStoreName() {
  const db = getPool();
  return db?.type || 'json';
}

export async function initializeReservationStore() {
  const db = getPool();

  if (!db) {
    await ensureReservationsFile();
    return;
  }

  if (db.type === 'postgres') {
    await db.pool.query(`
      CREATE TABLE IF NOT EXISTS reservations (
        reference VARCHAR(32) PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        phone VARCHAR(32) NOT NULL,
        reservation_date VARCHAR(10) NOT NULL,
        reservation_time VARCHAR(10) NOT NULL,
        party_size INTEGER NOT NULL,
        occasion VARCHAR(120),
        notes TEXT,
        status VARCHAR(30) NOT NULL DEFAULT 'pending',
        created_at VARCHAR(32) NOT NULL,
        updated_at VARCHAR(32) NOT NULL,
        cancelled_at VARCHAR(32)
      );
    `);
    await db.pool.query('CREATE INDEX IF NOT EXISTS idx_reservations_phone ON reservations (phone);');
    await db.pool.query(
      'CREATE INDEX IF NOT EXISTS idx_reservations_date_time ON reservations (reservation_date, reservation_time);',
    );
    await db.pool.query('CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations (status);');
    return;
  }

  await db.pool.execute(`
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

  const rows = await query(
    db,
    `
      SELECT reference, name, phone, reservation_date, reservation_time, party_size,
        occasion, notes, status, created_at, updated_at, cancelled_at
      FROM reservations
    `,
  );
  return rows.map(rowToReservation);
}

export async function listReservationsByPhone(phone) {
  const db = getPool();

  if (!db) {
    const reservations = await readJsonReservations();
    return reservations.filter((reservation) => reservation.phone === phone);
  }

  const rows = await query(
    db,
    `
      SELECT reference, name, phone, reservation_date, reservation_time, party_size,
        occasion, notes, status, created_at, updated_at, cancelled_at
      FROM reservations
      WHERE phone = ?
    `,
    `
      SELECT reference, name, phone, reservation_date, reservation_time, party_size,
        occasion, notes, status, created_at, updated_at, cancelled_at
      FROM reservations
      WHERE phone = $1
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

  const rows = await query(
    db,
    `
      SELECT reference, name, phone, reservation_date, reservation_time, party_size,
        occasion, notes, status, created_at, updated_at, cancelled_at
      FROM reservations
      WHERE reference = ?
      LIMIT 1
    `,
    `
      SELECT reference, name, phone, reservation_date, reservation_time, party_size,
        occasion, notes, status, created_at, updated_at, cancelled_at
      FROM reservations
      WHERE reference = $1
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

  await query(
    db,
    `
      INSERT INTO reservations (
        reference, name, phone, reservation_date, reservation_time, party_size,
        occasion, notes, status, created_at, updated_at, cancelled_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    `
      INSERT INTO reservations (
        reference, name, phone, reservation_date, reservation_time, party_size,
        occasion, notes, status, created_at, updated_at, cancelled_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
  await query(
    db,
    `
      UPDATE reservations
      SET status = ?, updated_at = ?, cancelled_at = ?
      WHERE reference = ?
    `,
    `
      UPDATE reservations
      SET status = $1, updated_at = $2, cancelled_at = $3
      WHERE reference = $4
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
