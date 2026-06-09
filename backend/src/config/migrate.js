const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const MIGRATIONS_DIR = path.join(__dirname, '../../database/migrations');

async function runMigrations(pool) {
  const client = await pool.connect();
  try {
    // Buat tabel tracking migrasi jika belum ada
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Ambil semua file .sql di folder migrations, urutkan ascending
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('Tidak ada file migrasi ditemukan.');
      return;
    }

    // Cek migrasi yang sudah dijalankan
    const { rows: applied } = await client.query(
      'SELECT filename FROM schema_migrations'
    );
    const appliedSet = new Set(applied.map(r => r.filename));

    let ranCount = 0;
    for (const filename of files) {
      if (appliedSet.has(filename)) {
        console.log(`  [skip] ${filename} (sudah dijalankan)`);
        continue;
      }

      const filePath = path.join(MIGRATIONS_DIR, filename);
      const sql = fs.readFileSync(filePath, 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [filename]
        );
        await client.query('COMMIT');
        console.log(`  [ok]   ${filename}`);
        ranCount++;
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migrasi "${filename}" gagal: ${err.message}`);
      }
    }

    if (ranCount === 0) {
      console.log('Database sudah up-to-date, tidak ada migrasi baru.');
    } else {
      console.log(`\n${ranCount} migrasi berhasil dijalankan.`);
    }
  } finally {
    client.release();
  }
}

// Jalankan langsung jika dipanggil via CLI
if (require.main === module) {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'meeting_manager',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  });

  console.log('Menjalankan migrasi database...\n');
  runMigrations(pool)
    .then(() => {
      console.log('\nMigrasi selesai.');
      process.exit(0);
    })
    .catch(err => {
      console.error('\nError migrasi:', err.message);
      process.exit(1);
    })
    .finally(() => pool.end());
}

module.exports = runMigrations;
