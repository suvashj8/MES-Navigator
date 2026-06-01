import { login } from '../auth.js';
import {
  checkLoginAllowed,
  recordLoginFailure,
  recordLoginSuccess,
  getClientIp,
  failDelayMs,
  sleep,
} from '../lib/loginProtection.js';

/**
 * Enforces lockout after repeated failures and a small delay on bad passwords.
 */
export async function loginHandler(req, res) {
  const { username, password } = req.body ?? {};
  const ip = getClientIp(req);

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const gate = checkLoginAllowed(ip, username);
  if (!gate.allowed) {
    if (gate.retryAfterSec) res.setHeader('Retry-After', String(gate.retryAfterSec));
    return res.status(429).json({ error: gate.message });
  }

  const result = await login(username, password);

  if (!result) {
    recordLoginFailure(ip, username);
    await sleep(failDelayMs());
    const afterFail = checkLoginAllowed(ip, username);
    if (!afterFail.allowed) {
      if (afterFail.retryAfterSec) res.setHeader('Retry-After', String(afterFail.retryAfterSec));
      return res.status(429).json({ error: afterFail.message });
    }
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  recordLoginSuccess(ip, username);
  return res.json(result);
}
