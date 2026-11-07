// GET  /api/state  -> the whole display state (settings, slides, announcements, image index). Public.
// PUT  /api/state  -> replace it. Admin token required.
// Stored as JSON in Vercel Blob. Every save is a new file (state/state-<time>.json); the newest wins and
// older ones are removed, so CDN caching can never serve a stale copy.
import { put, list, del } from '@vercel/blob';
import { requireAdmin } from './_auth.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { blobs } = await list({ prefix: 'state/state-' });
      if (!blobs.length) return res.status(200).json({});
      blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
      const r = await fetch(blobs[0].url + '?t=' + Date.now());
      if (!r.ok) return res.status(502).json({ error: 'Could not read stored state.' });
      return res.status(200).json(await r.json());
    }

    if (req.method === 'PUT') {
      if (!requireAdmin(req, res)) return;
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body || typeof body !== 'object' || !body.settings) return res.status(400).json({ error: 'Bad state.' });
      const updatedAt = Date.now();
      const stored = await put(`state/state-${updatedAt}.json`, JSON.stringify({ ...body, updatedAt }), {
        access: 'public', contentType: 'application/json', addRandomSuffix: false, cacheControlMaxAge: 60,
      });
      // tidy: remove older copies
      const { blobs } = await list({ prefix: 'state/state-' });
      const old = blobs.filter(b => b.url !== stored.url).map(b => b.url);
      if (old.length) await del(old);
      return res.status(200).json({ ok: true, updatedAt });
    }

    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message || e) });
  }
}
