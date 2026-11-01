import { spawn, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const node = process.execPath;
const db = spawnSync(node, ['scripts/postgres.mjs', 'start'], { cwd: root, stdio: 'inherit', windowsHide: true });
if (db.status !== 0) process.exit(db.status ?? 1);
const migration = spawnSync(node, ['--import', 'tsx', 'server/migrate.ts'], { cwd: root, stdio: 'inherit', windowsHide: true });
if (migration.status !== 0) process.exit(migration.status ?? 1);
const processes = [
  spawn(node, ['--import', 'tsx', 'server/index.ts'], { cwd: root, stdio: 'inherit', windowsHide: true }),
  spawn(node, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1'], { cwd: root, stdio: 'inherit', windowsHide: true }),
];
function stop() { for (const child of processes) child.kill(); }
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const child of processes) child.on('exit', code => { stop(); process.exitCode = code ?? 0; });
