/**
 * Dev server with selective file watching — avoids restarts when only
 * scripts/, uploads/, or one-off files change.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const watchRel = [
  'index.js',
  'app.js',
  'auth.js',
  'db.js',
  'corsConfig.js',
  'grading.js',
  'reports.js',
  'pdf.js',
  'scope.js',
  'asyncHandler.js',
  'middleware.js',
  'productMasterLink.js',
  'validateNumbers.js',
  'validateText.js',
  'nepaliDate.js',
  'routes',
  'middleware',
  'lib',
];

const args = ['--watch'];
for (const rel of watchRel) {
  args.push('--watch-path', path.join(root, rel));
}
args.push(path.join(root, 'index.js'));

const child = spawn(process.execPath, args, {
  stdio: 'inherit',
  cwd: root,
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
