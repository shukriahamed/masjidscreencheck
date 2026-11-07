// POST   /api/upload   raw file body; headers: x-id, x-name (url-encoded), content-type  -> { url }
// DELETE /api/upload   JSON { url }                                                    -> { ok }
// Admin token required. Files live in Vercel Blob (public URLs, served from Vercel's CDN).
// Note: Vercel functions accept request bodies up to ~4.5 MB — the admin page compresses images first.
import { put, del } from '@vercel/blob';
import { requireAdmin } from './_auth.js';

export default async function handler(req, res) {
  try {
    if (!requireAdmin(req, res)) return;

    if (req.method === 'POST') {
      const id   = String(req.headers['x-id'] || 'file').replace(/[^a-zA-Z0-9_-]/g, '');
      const name = decodeURIComponent(String(req.headers['x-name'] || 'file')).replace(/[^a-zA-Z0-9._-]/g, '_').slice(-60);
      const blob = await put(`media/${id}-${name}`, req, {
        access: 'public',
        addRandomSuffix: true,
        contentType: req.headers['content-type'] || 'application/octet-stream',
        cacheControlMaxAge: 31536000,   // files never change in place (new upload = new URL)
      });
      return res.status(200).json({ url: blob.url });
    }

    if (req.method === 'DELETE') {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      let body = {};
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch (e) {}
      if (body.url && /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//.test(body.url)) await del(body.url);
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message || e) });
  }
}

export const config = { api: { bodyParser: false } };
