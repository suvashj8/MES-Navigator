import { initSchema } from './db.js';
import { seedDefaultUsers } from './auth.js';
import { createApp } from './app.js';

const PORT = process.env.PORT || 3001;

async function start() {
  await initSchema();
  await seedDefaultUsers();
  const app = createApp();
  app.listen(PORT, () => console.log(`MES API running on http://localhost:${PORT}`));
}

start().catch((e) => {
  console.error(e);
  process.exit(1);
});
