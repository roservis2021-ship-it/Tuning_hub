import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
const patterns = [
  ['OpenAI API key', /\bsk-(?!x{8,})[A-Za-z0-9_-]{20,}\b/g],
  ['Stripe live secret', /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b/g],
  ['Stripe webhook secret', /\bwhsec_(?!x{8,})[A-Za-z0-9]{20,}\b/g],
  ['Private key block', /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g],
  ['Service account private key', /"private_key"\s*:\s*"-----BEGIN/g],
];
const findings = [];

function scanContent(source, content) {
  for (const [label, pattern] of patterns) {
    pattern.lastIndex = 0;
    if (pattern.test(content)) findings.push(`${source}: ${label}`);
  }
}

for (const file of files) {
  if (/^(?:node_modules|dist|playwright-report|test-results)\//.test(file.replaceAll('\\', '/'))) continue;
  let content;
  try { content = readFileSync(file, 'utf8'); }
  catch { continue; }
  scanContent(file, content);
}

try {
  const history = execFileSync(
    'git',
    ['log', '-p', '--all', '--no-ext-diff', '--format=commit:%H', '--', '.'],
    { encoding: 'utf8', maxBuffer: 100 * 1024 * 1024 },
  );
  scanContent('Historial Git', history);
} catch {
  findings.push('Historial Git: no se pudo completar la comprobacion');
}

if (findings.length) {
  console.error(`Posibles secretos detectados:\n${findings.map((finding) => `- ${finding}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Comprobación completada: ${String(files.length)} archivos actuales y el historial Git revisados, sin secretos de alto riesgo detectados.`);
}
