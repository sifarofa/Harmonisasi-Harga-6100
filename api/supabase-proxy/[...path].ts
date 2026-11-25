import type { IncomingMessage, ServerResponse } from 'node:http';

const SUPABASE_TARGET_URL = (
  process.env.VITE_SUPABASE_URL || 'https://pjzhpweddmrnzkvigehg.supabase.co'
)
  .trim()
  .replace(/^["']|["']$/g, '')
  .replace(/\/+$/, '');

export const config = {
  api: {
    bodyParser: false,
  },
};

async function readRawBody(req: IncomingMessage & { body?: any }): Promise<Uint8Array | undefined> {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;

  if (req.body !== undefined && req.body !== null) {
    if (Buffer.isBuffer(req.body)) return req.body.length > 0 ? new Uint8Array(req.body) : undefined;
    if (typeof req.body === 'string') return req.body.length > 0 ? new TextEncoder().encode(req.body) : undefined;
    return new TextEncoder().encode(JSON.stringify(req.body));
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return undefined;
  return new Uint8Array(Buffer.concat(chunks));
}

export default async function handler(
  req: IncomingMessage & { query?: Record<string, string | string[]>; body?: any },
  res: ServerResponse
) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, apikey, Accept, Prefer, Range, X-Client-Info, Accept-Profile, Content-Profile'
  );

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  const rawUrl = req.url || '/';
  let upstreamPath = rawUrl;
  if (upstreamPath.startsWith('/api/supabase-proxy')) {
    upstreamPath = upstreamPath.slice('/api/supabase-proxy'.length) || '/';
  } else if (req.query?.path) {
    const pathParts = Array.isArray(req.query.path) ? req.query.path.join('/') : req.query.path;
    const qIdx = rawUrl.indexOf('?');
    const queryStr = qIdx >= 0 ? rawUrl.slice(qIdx) : '';
    upstreamPath = `/${pathParts}${queryStr}`;
  }

  const targetUrl = `${SUPABASE_TARGET_URL}${upstreamPath.startsWith('/') ? '' : '/'}${upstreamPath}`;

  const forwardHeaders: Record<string, string> = {};
  const allowedHeaderKeys = [
    'apikey',
    'authorization',
    'content-type',
    'accept',
    'prefer',
    'range',
    'x-client-info',
    'accept-profile',
    'content-profile',
  ];
  for (const key of allowedHeaderKeys) {
    const val = req.headers[key];
    if (typeof val === 'string' && val.length > 0) {
      forwardHeaders[key] = val;
    } else if (Array.isArray(val) && val.length > 0) {
      forwardHeaders[key] = val.join(', ');
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const rawBody = await readRawBody(req);
    const upstream = await fetch(targetUrl, {
      method: req.method || 'GET',
      headers: forwardHeaders,
      body: rawBody as any,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const responseBuffer = Buffer.from(await upstream.arrayBuffer());
    const copyHeaderKeys = ['content-type', 'content-range', 'preference-applied'];
    for (const key of copyHeaderKeys) {
      const val = upstream.headers.get(key);
      if (val) res.setHeader(key, val);
    }
    res.setHeader('Cache-Control', 'no-store');
    res.statusCode = upstream.status;
    res.end(responseBuffer);
  } catch (err: any) {
    clearTimeout(timeout);
    const causeMsg = err?.cause?.code || err?.cause?.message || err?.message || 'Koneksi gagal';
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 502;
    res.end(
      JSON.stringify({
        message: `Supabase (${SUPABASE_TARGET_URL}) tidak dapat dijangkau (${causeMsg}). Pastikan project Supabase aktif / tidak di-pause.`,
        error: causeMsg,
      })
    );
  }
}
