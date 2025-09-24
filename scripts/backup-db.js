// Simple PostgreSQL backup script
// Creates a timestamped .dump file in the backups directory using pg_dump
// It reads DATABASE_URL from .env and does not print secrets

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) + '-' +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL is not set in .env');
    process.exit(1);
  }

  const backupsDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const file = path.join(backupsDir, `wegovern-${timestamp()}.dump`);
  console.log(`Creating database backup: ${path.basename(file)}`);

  const args = ['-Fc', '-f', file, '--dbname', dbUrl];
  const child = spawn('pg_dump', args, { stdio: 'inherit' });

  child.on('error', (err) => {
    console.error('Failed to start pg_dump. Is it installed and on PATH?');
    console.error(err.message);
    process.exit(1);
  });

  child.on('exit', (code) => {
    if (code === 0) {
      console.log('Backup completed successfully.');
    } else {
      console.error(`pg_dump exited with code ${code}`);
      process.exit(code || 1);
    }
  });
}

main();
