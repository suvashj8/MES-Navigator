import { initSchema } from './db.js';
import { seedDefaultUsers } from './auth.js';
import { createApp } from './app.js';
import { loadDevPorts } from './lib/devPorts.js';

const devPorts = process.env.NODE_ENV !== 'production' ? loadDevPorts() : null;
const PORT = Number(process.env.PORT) || devPorts?.api || 3101;
const HOST = process.env.HOST || '0.0.0.0';

async function start() {
  await initSchema();
  await seedDefaultUsers();
  const app = createApp();
  const server = app.listen(PORT, HOST, () => {
    console.log(`MES API running on http://${HOST}:${PORT}`);
    if (devPorts) console.log(`MES UI (dev): http://localhost:${devPorts.ui}`);
  });
  server.on('error', (e) => {
    if (e?.code === 'EADDRINUSE') {
      console.error(
        `\nPort ${PORT} is already in use. MES dev API uses port ${PORT} (see dev-ports.json).\n` +
          `Stop the other process on that port, or edit dev-ports.json and server/.env PORT.\n`
      );
    }
    throw e;
  });
}

start().catch((e) => {
  if (e?.code === '28P01') {
    console.error('\nPostgreSQL login failed. For local dev, start the Docker DB:\n  cd mes-prototype && npm run db:docker\nThen: npm run db:setup --prefix server && npm run seed --prefix server\n');
  } else if (e?.code === 'ECONNREFUSED' || e?.code === 'ENOTFOUND') {
    console.error('\nCannot reach PostgreSQL. Start Docker DB:\n  cd mes-prototype && npm run db:docker\n');
  }
  console.error(e);
  process.exit(1);
});
