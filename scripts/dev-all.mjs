import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), '..');
const viteBin = path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const viteArgs = process.argv.slice(2).length ? process.argv.slice(2) : ['--host', '127.0.0.1'];

function startProcess(label, command, args) {
  const child = spawn(command, args, {
    cwd: projectRoot,
    env: process.env,
    shell: false,
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => {
    process.stdout.write(`[${label}] ${chunk}`);
  });

  child.stderr.on('data', (chunk) => {
    process.stderr.write(`[${label}] ${chunk}`);
  });

  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      process.exitCode = code;
    }
  });

  return child;
}

const backend = startProcess('api', process.execPath, ['server/app.mjs']);
const frontend = startProcess('vite', process.execPath, [viteBin, ...viteArgs]);

function shutdown() {
  backend.kill();
  frontend.kill();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
