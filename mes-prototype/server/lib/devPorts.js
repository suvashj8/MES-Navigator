import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Dev-only ports — change here for local work; production uses server/.env PORT. */
export function loadDevPorts() {
  const file = path.join(__dirname, '..', '..', 'dev-ports.json');
  const raw = fs.readFileSync(file, 'utf8');
  const { api, ui, db } = JSON.parse(raw);
  return {
    api: Number(api),
    ui: Number(ui),
    db: Number(db),
  };
}
