import express from 'express';
import cors from 'cors';
import { resolveCorsOptions } from './corsConfig.js';
import { requireAuth } from './middleware.js';
import {
  registerPublicAuthRoutes,
  registerAuthUserRoutes,
  registerAuthScopeRoutes,
} from './routes/auth.js';
import { registerApiRoutes } from './routes/index.js';

export function createApp() {
  const app = express();
  if (process.env.TRUST_PROXY === '1' || process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }
  app.use(cors(resolveCorsOptions()));
  app.use(express.json({ limit: '256kb' }));

  registerPublicAuthRoutes(app);
  registerAuthUserRoutes(app);

  app.use('/api', requireAuth);

  registerAuthScopeRoutes(app);
  registerApiRoutes(app);

  app.use((err, req, res, next) => {
    console.error(err);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Photo is too large (max 700 KB)' });
    }
    if (err.name === 'MulterError' || err.message?.includes('Photo must be an image')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(err.status || 500).json({ error: err.message || 'Server error' });
  });

  return app;
}
