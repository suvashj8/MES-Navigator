import rateLimit from 'express-rate-limit';
import { getClientIp } from '../lib/loginProtection.js';

const isProd = process.env.NODE_ENV === 'production';

const WINDOW_MS = Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
const MAX_PER_IP = Number(process.env.LOGIN_RATE_LIMIT_MAX) || (isProd ? 30 : 120);

/** Broad per-IP cap on login POSTs (includes successes and failures). */
export const loginIpRateLimit = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX_PER_IP,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  message: { error: 'Too many login requests from this network. Please wait and try again.' },
  handler(req, res, _next, options) {
    res.status(options.statusCode).json(options.message);
  },
});
