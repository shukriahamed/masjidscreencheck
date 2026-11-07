// Shared helper: admin-only endpoints need the header  x-admin-token: <ADMIN_TOKEN env var>
export function requireAdmin(req, res) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    res.status(500).json({ error: 'ADMIN_TOKEN is not set on the server (Vercel → Settings → Environment Variables).' });
    return false;
  }
  if (req.headers['x-admin-token'] !== expected) {
    res.status(401).json({ error: 'Wrong admin token.' });
    return false;
  }
  return true;
}
