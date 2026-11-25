import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { generateInitialDatasets } from './src/data/initialData';
import { generateInitialIhkDataset } from './src/data/initialIhkData';
import { generateInitialHpbsDataset, generatePeriodsFromRecords } from './src/data/initialHpbsData';
import { filterValidHpbsRecords } from './src/utils/hpbsAnalysis';
import {
  migrateHarmonizationDatasets,
  migrateIhkDataset,
  migrateHpbsDataset,
} from './src/utils/schemaMigration';

const app = express();

const isProduction = process.env.NODE_ENV === 'production';
// Hardcoded to port 3000 as required by the AI Studio nginx reverse proxy infrastructure
const PORT = 3000;

// Real-time SSE Broadcast Pool for Instant Multi-Device Sync
const sseClients = new Set<express.Response>();

function broadcastSync(event: { type: string; lastUpdated: string; payload?: any }) {
  const payloadString = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payloadString);
    } catch (_) {
      sseClients.delete(client);
    }
  }
}

// Cross-Origin Resource Sharing (CORS) to support cross-device, mobile, and preview syncing
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, Accept, Prefer, Range, X-Client-Info, Accept-Profile, Content-Profile, Cache-Control, Pragma, Expires');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const SUPABASE_TARGET_URL = (process.env.VITE_SUPABASE_URL || 'https://pjzhpweddmrnzkvigehg.supabase.co').replace(/\/+$/, '');

// Same-origin Supabase Reverse Proxy (handles ISP/DNS/firewall blocks or browser CORS issues on *.supabase.co)
app.use('/api/supabase-proxy', express.raw({ type: '*/*', limit: '50mb' }), async (req, res) => {
  const upstreamPath = req.originalUrl.replace(/^\/api\/supabase-proxy/, '') || '/';
  const targetUrl = `${SUPABASE_TARGET_URL}${upstreamPath}`;

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
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
    const rawBody =
      hasBody && Buffer.isBuffer(req.body) && req.body.length > 0 ? new Uint8Array(req.body) : undefined;

    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      body: rawBody,
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
    return res.status(upstream.status).send(responseBuffer);
  } catch (err: any) {
    clearTimeout(timeout);
    const causeMsg = err?.cause?.code || err?.cause?.message || err?.message || 'Koneksi gagal';
    console.warn(`[Supabase Proxy] Error forwarding ${req.method} ${upstreamPath}:`, causeMsg);
    return res.status(502).json({
      message: `Supabase (${SUPABASE_TARGET_URL}) tidak dapat dijangkau (${causeMsg}). Pastikan project Supabase aktif / tidak di-pause.`,
      error: causeMsg,
    });
  }
});

// Body parser with 50MB limit to handle large multi-month and multi-commodity datasets
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Determine persistent data directories and files
const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const HARMONIZATION_FILE = path.join(DATA_DIR, 'publishedDatasets.json');
const IHK_FILE = path.join(DATA_DIR, 'publishedIhkDataset.json');
const HPBS_FILE = path.join(DATA_DIR, 'publishedHpbsDataset.json');

// In-memory cache for fast, non-blocking reads
let cachedHarmonizationDatasets: any = null;
let cachedIhkDataset: any = null;
let cachedHpbsDataset: any = null;
let lastHarmonizationUpdated: string | null = null;
let lastIhkUpdated: string | null = null;
let lastHpbsUpdated: string | null = null;

// Track build ID and boot time for live device sync
const SERVER_BOOT_TIME = new Date().toISOString();
const APP_VERSION = '1.5.0';
const APP_BUILD_ID = `v${APP_VERSION}`;

// Helper to locate persistent dataset file across dev and production bundles
function findExistingFile(primaryPath: string, fileName: string): string | null {
  const candidates = [
    primaryPath,
    path.join(process.cwd(), 'dist', fileName),
    path.join(process.cwd(), fileName),
    path.join(process.cwd(), 'src', 'data', fileName),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

// Initialize cache from disk or defaults
function initDataStore() {
  try {
    const foundHarmFile = findExistingFile(HARMONIZATION_FILE, 'publishedDatasets.json');
    if (foundHarmFile) {
      const content = fs.readFileSync(foundHarmFile, 'utf-8');
      cachedHarmonizationDatasets = migrateHarmonizationDatasets(JSON.parse(content));
      const stat = fs.statSync(foundHarmFile);
      lastHarmonizationUpdated = stat.mtime.toISOString();
      console.log(`[Server] Loaded published harmonization dataset from ${foundHarmFile}: ${cachedHarmonizationDatasets?.length || 0} periods.`);
    } else {
      cachedHarmonizationDatasets = migrateHarmonizationDatasets(generateInitialDatasets());
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(HARMONIZATION_FILE, JSON.stringify(cachedHarmonizationDatasets, null, 2), 'utf-8');
      lastHarmonizationUpdated = new Date().toISOString();
      console.log(`[Server] Initialized published harmonization dataset with default data.`);
    }
  } catch (err) {
    console.error('[Server] Failed to initialize harmonization dataset:', err);
    cachedHarmonizationDatasets = migrateHarmonizationDatasets(generateInitialDatasets());
  }

  try {
    const foundIhkFile = findExistingFile(IHK_FILE, 'publishedIhkDataset.json');
    if (foundIhkFile) {
      const content = fs.readFileSync(foundIhkFile, 'utf-8');
      cachedIhkDataset = migrateIhkDataset(JSON.parse(content));
      const stat = fs.statSync(foundIhkFile);
      lastIhkUpdated = stat.mtime.toISOString();
      console.log(`[Server] Loaded published IHK dataset from ${foundIhkFile}: ${Object.keys(cachedIhkDataset?.regions || {}).length} regions.`);
    } else {
      cachedIhkDataset = migrateIhkDataset(generateInitialIhkDataset());
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(IHK_FILE, JSON.stringify(cachedIhkDataset, null, 2), 'utf-8');
      lastIhkUpdated = new Date().toISOString();
      console.log(`[Server] Initialized published IHK dataset with default data.`);
    }
  } catch (err) {
    console.error('[Server] Failed to initialize IHK dataset:', err);
    cachedIhkDataset = migrateIhkDataset(generateInitialIhkDataset());
  }

  try {
    const foundHpbsFile = findExistingFile(HPBS_FILE, 'publishedHpbsDataset.json');
    if (foundHpbsFile) {
      const content = fs.readFileSync(foundHpbsFile, 'utf-8');
      const parsed = JSON.parse(content);
      const stat = fs.statSync(foundHpbsFile);
      cachedHpbsDataset = migrateHpbsDataset(parsed);
      lastHpbsUpdated = cachedHpbsDataset.lastUpdated || stat.mtime.toISOString();
      console.log(`[Server] Loaded published HPBS dataset from ${foundHpbsFile}: ${cachedHpbsDataset.records.length} records.`);
    } else {
      const initial = generateInitialHpbsDataset();
      cachedHpbsDataset = migrateHpbsDataset(initial);
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(HPBS_FILE, JSON.stringify(cachedHpbsDataset, null, 2), 'utf-8');
      lastHpbsUpdated = new Date().toISOString();
      console.log(`[Server] Initialized published HPBS dataset with default data.`);
    }
  } catch (err) {
    console.error('[Server] Failed to initialize HPBS dataset:', err);
    cachedHpbsDataset = migrateHpbsDataset(generateInitialHpbsDataset());
  }
}

initDataStore();

// ==========================================
// API ROUTES FOR PUBLISHED DATA PERSISTENCE & VERSIONING
// ==========================================

// Global Anti-Cache Middleware for API routes: ensures all devices always get live data
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// App Version & Live Update Checker for multi-device sync
app.get('/api/app-version', (_req, res) => {
  res.json({
    version: APP_VERSION,
    buildId: APP_BUILD_ID,
    bootTime: SERVER_BOOT_TIME,
    lastHarmonizationUpdated,
    lastIhkUpdated,
    lastHpbsUpdated,
    serverTime: new Date().toISOString(),
  });
});

// Real-time SSE Live-Sync Endpoint for Cross-Device Instant Updates
app.get('/api/live-sync', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  // Send initial handshake state
  res.write(
    `data: ${JSON.stringify({
      type: 'CONNECTED',
      buildId: APP_BUILD_ID,
      version: APP_VERSION,
      lastHarmonizationUpdated,
      lastIhkUpdated,
      lastHpbsUpdated,
      serverTime: new Date().toISOString(),
    })}\n\n`
  );

  sseClients.add(res);

  // Heartbeat keep-alive every 20s to prevent reverse proxy timeouts
  const heartbeatTimer = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch (_) {
      clearInterval(heartbeatTimer);
      sseClients.delete(res);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeatTimer);
    sseClients.delete(res);
  });
});

// Health check and status
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    harmonizationCount: Array.isArray(cachedHarmonizationDatasets) ? cachedHarmonizationDatasets.length : 0,
    ihkRegionsCount: Object.keys(cachedIhkDataset?.regions || {}).length,
    hpbsRecordsCount: cachedHpbsDataset?.records?.length || 0,
    connectedDevices: sseClients.size,
    lastHarmonizationUpdated,
    lastIhkUpdated,
    lastHpbsUpdated,
  });
});

// 1. GET Harmonization datasets (Published)
app.get('/api/datasets', (_req, res) => {
  if (!cachedHarmonizationDatasets) {
    initDataStore();
  }
  res.json({
    success: true,
    datasets: cachedHarmonizationDatasets,
    lastUpdated: lastHarmonizationUpdated,
  });
});

// 2. POST Harmonization datasets (Update Published data)
app.post('/api/datasets', (req, res) => {
  try {
    const payload = req.body;
    const rawDatasets = Array.isArray(payload) ? payload : payload.datasets;

    if (!Array.isArray(rawDatasets)) {
      return res.status(400).json({
        success: false,
        error: 'Payload harus berupa array dataset harmonisasi atau object dengan property "datasets".',
      });
    }

    const incomingDatasets = migrateHarmonizationDatasets(rawDatasets);

    // CRITICAL PROTECTION: Prevent regression if server already has full 2026 dataset (including 2026-09)
    // and incoming dataset from an outdated browser draft has fewer periods or is missing 2026-09
    if (
      cachedHarmonizationDatasets &&
      Array.isArray(cachedHarmonizationDatasets) &&
      cachedHarmonizationDatasets.some((d: any) => d.id === '2026-09') &&
      (!incomingDatasets.some((d: any) => d.id === '2026-09') || incomingDatasets.length < cachedHarmonizationDatasets.length)
    ) {
      console.warn(
        `[Server] Ignored stale harmonization dataset submission (${incomingDatasets.length} periods vs cached ${cachedHarmonizationDatasets.length} periods, missing 2026-09).`
      );
      return res.json({
        success: true,
        message: 'Server mempertahankan versi harmonisasi terbaru (termasuk September 2026).',
        datasets: cachedHarmonizationDatasets,
        lastUpdated: lastHarmonizationUpdated,
      });
    }

    cachedHarmonizationDatasets = incomingDatasets;
    lastHarmonizationUpdated = new Date().toISOString();

    // Persist to disk
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(HARMONIZATION_FILE, JSON.stringify(incomingDatasets, null, 2), 'utf-8');
    } catch (fsErr) {
      console.warn('[Server] Could not write to src/data/publishedDatasets.json:', fsErr);
    }

    // Also write to dist/ if running production bundle
    try {
      const distDir = path.join(process.cwd(), 'dist');
      if (fs.existsSync(distDir)) {
        fs.writeFileSync(path.join(distDir, 'publishedDatasets.json'), JSON.stringify(incomingDatasets, null, 2), 'utf-8');
      }
    } catch (_) {}

    // Broadcast instant sync to all connected devices
    broadcastSync({
      type: 'HARMONIZATION_UPDATED',
      lastUpdated: lastHarmonizationUpdated,
    });

    console.log(`[Server] Published harmonization datasets updated: ${incomingDatasets.length} periods.`);
    res.json({
      success: true,
      message: 'Data harmonisasi berhasil dipublikasikan dan tersimpan di server.',
      count: incomingDatasets.length,
      lastUpdated: lastHarmonizationUpdated,
    });
  } catch (err: any) {
    console.error('[Server] Error saving harmonization datasets:', err);
    res.status(500).json({ success: false, error: err.message || 'Gagal menyimpan data harmonisasi.' });
  }
});

// Granular Note Saving endpoint: immediate cloud commit for individual notes
app.post('/api/harmonization-notes', (req, res) => {
  try {
    const { monthId, commodityId, regionId, note } = req.body || {};
    if (!commodityId || !regionId) {
      return res.status(400).json({ success: false, error: 'commodityId dan regionId wajib disediakan.' });
    }

    if (!cachedHarmonizationDatasets) {
      initDataStore();
    }

    const cleanNote = typeof note === 'string' ? note.trim() : '';
    const key = `${commodityId}_${regionId}`;

    let targetMonth = monthId;
    if (!targetMonth && Array.isArray(cachedHarmonizationDatasets) && cachedHarmonizationDatasets.length > 0) {
      targetMonth = cachedHarmonizationDatasets[cachedHarmonizationDatasets.length - 1].id;
    }

    let modified = false;
    if (Array.isArray(cachedHarmonizationDatasets)) {
      cachedHarmonizationDatasets = cachedHarmonizationDatasets.map((ds: any) => {
        if (ds.id === targetMonth) {
          modified = true;
          const regNotes = { ...(ds.regionalHarmonizationNotes || {}), [key]: cleanNote };
          const updatedCommodities = Array.isArray(ds.commodities)
            ? ds.commodities.map((c: any) => {
                if (c.id === commodityId || c.commodityId === commodityId) {
                  const regObj = c.regions?.[regionId] || { status: 'STABIL' };
                  return {
                    ...c,
                    regions: {
                      ...c.regions,
                      [regionId]: {
                        ...regObj,
                        catatan: cleanNote,
                        dynamicNotes: cleanNote,
                      },
                    },
                  };
                }
                return c;
              })
            : [];

          return {
            ...ds,
            regionalHarmonizationNotes: regNotes,
            commodities: updatedCommodities,
            updatedAt: new Date().toISOString(),
          };
        }
        return ds;
      });
    }

    if (modified) {
      lastHarmonizationUpdated = new Date().toISOString();
      try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(HARMONIZATION_FILE, JSON.stringify(cachedHarmonizationDatasets, null, 2), 'utf-8');
      } catch (_) {}
      try {
        const distDir = path.join(process.cwd(), 'dist');
        if (fs.existsSync(distDir)) {
          fs.writeFileSync(path.join(distDir, 'publishedDatasets.json'), JSON.stringify(cachedHarmonizationDatasets, null, 2), 'utf-8');
        }
      } catch (_) {}

      // Broadcast note update to all open browsers/devices
      broadcastSync({
        type: 'HARMONIZATION_UPDATED',
        lastUpdated: lastHarmonizationUpdated,
        payload: { monthId: targetMonth, commodityId, regionId },
      });
    }

    res.json({
      success: true,
      lastUpdated: lastHarmonizationUpdated,
      noteKey: key,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Gagal menyimpan catatan harmonisasi.' });
  }
});

// 3. GET IHK Consumer datasets (Published)
app.get('/api/ihk-datasets', (_req, res) => {
  if (!cachedIhkDataset) {
    initDataStore();
  }
  res.json({
    success: true,
    ihkDataset: cachedIhkDataset,
    lastUpdated: lastIhkUpdated,
  });
});

// 4. POST IHK Consumer dataset (Update Published data)
app.post('/api/ihk-datasets', (req, res) => {
  try {
    const payload = req.body;
    const rawIhk = payload.ihkDataset || payload;

    if (!rawIhk || !rawIhk.regions) {
      return res.status(400).json({
        success: false,
        error: 'Format dataset IHK tidak valid. Membutuhkan object dengan regions dan availableMonths.',
      });
    }

    const incomingIhk = migrateIhkDataset(rawIhk);
    cachedIhkDataset = incomingIhk;
    lastIhkUpdated = new Date().toISOString();

    // Persist to disk
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(IHK_FILE, JSON.stringify(incomingIhk, null, 2), 'utf-8');
    } catch (fsErr) {
      console.warn('[Server] Could not write to src/data/publishedIhkDataset.json:', fsErr);
    }

    // Also write to dist/ if running production bundle
    try {
      const distDir = path.join(process.cwd(), 'dist');
      if (fs.existsSync(distDir)) {
        fs.writeFileSync(path.join(distDir, 'publishedIhkDataset.json'), JSON.stringify(incomingIhk, null, 2), 'utf-8');
      }
    } catch (_) {}

    broadcastSync({
      type: 'IHK_UPDATED',
      lastUpdated: lastIhkUpdated,
    });

    console.log(`[Server] Published IHK dataset updated: ${Object.keys(incomingIhk.regions).length} regions.`);
    res.json({
      success: true,
      message: 'Data IHK berhasil dipublikasikan dan tersimpan di server.',
      regionsCount: Object.keys(incomingIhk.regions).length,
      lastUpdated: lastIhkUpdated,
    });
  } catch (err: any) {
    console.error('[Server] Error saving IHK dataset:', err);
    res.status(500).json({ success: false, error: err.message || 'Gagal menyimpan data IHK.' });
  }
});

// 5. POST Reset Data to initial
app.post('/api/reset-data', (_req, res) => {
  try {
    const initial = migrateHarmonizationDatasets(generateInitialDatasets());
    cachedHarmonizationDatasets = initial;
    lastHarmonizationUpdated = new Date().toISOString();
    try {
      fs.writeFileSync(HARMONIZATION_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    } catch (_) {}
    broadcastSync({
      type: 'HARMONIZATION_UPDATED',
      lastUpdated: lastHarmonizationUpdated,
    });
    res.json({ success: true, message: 'Data harmonisasi telah direset ke data awal resmi.', datasets: initial });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/reset-ihk', (_req, res) => {
  try {
    const initial = migrateIhkDataset(generateInitialIhkDataset());
    cachedIhkDataset = initial;
    lastIhkUpdated = new Date().toISOString();
    try {
      fs.writeFileSync(IHK_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    } catch (_) {}
    broadcastSync({
      type: 'IHK_UPDATED',
      lastUpdated: lastIhkUpdated,
    });
    res.json({ success: true, message: 'Data IHK telah direset ke data awal resmi.', ihkDataset: initial });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. GET HPBS datasets (Published)
app.get('/api/hpbs-datasets', (_req, res) => {
  if (!cachedHpbsDataset) {
    initDataStore();
  }
  res.json({
    success: true,
    dataset: cachedHpbsDataset,
    lastUpdated: lastHpbsUpdated,
  });
});

// 7. POST HPBS datasets (Update published data)
app.post('/api/hpbs-datasets', (req, res) => {
  try {
    const payload = req.body;
    const incoming = payload.dataset || payload;

    if (!incoming || !Array.isArray(incoming.records)) {
      return res.status(400).json({
        success: false,
        error: 'Format dataset HPBS tidak valid. Membutuhkan object dengan array "records".',
      });
    }

    const cleanIncomingRecords = filterValidHpbsRecords(incoming.records);

    let cleanPeriods = incoming.periods || (cachedHpbsDataset && (cachedHpbsDataset as any).periods) || undefined;
    if (Array.isArray(cleanPeriods)) {
      cleanPeriods = cleanPeriods.map((p: any) => ({
        ...p,
        records: filterValidHpbsRecords(p.records),
      }));
    }

    // Store complete representation including monthly periods and commodity notes
    const toStore = migrateHpbsDataset({
      periodTitle: incoming.periodTitle || 'September 2026 vs Bulan Sebelumnya',
      records: cleanIncomingRecords,
      activePeriodId: incoming.activePeriodId || '2026-09',
      periods: cleanPeriods,
      commodityNotes: incoming.commodityNotes || (cachedHpbsDataset && cachedHpbsDataset.commodityNotes) || {},
      lastUpdated: new Date().toISOString(),
      version: (incoming.version || 1) + 1,
    });

    cachedHpbsDataset = toStore;
    lastHpbsUpdated = toStore.lastUpdated;

    // Persist to disk
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(HPBS_FILE, JSON.stringify(toStore, null, 2), 'utf-8');
    } catch (fsErr) {
      console.warn('[Server] Could not write to src/data/publishedHpbsDataset.json:', fsErr);
    }

    // Also write to dist/ if running production bundle
    try {
      const distDir = path.join(process.cwd(), 'dist');
      if (fs.existsSync(distDir)) {
        fs.writeFileSync(path.join(distDir, 'publishedHpbsDataset.json'), JSON.stringify(toStore, null, 2), 'utf-8');
      }
    } catch (_) {}

    broadcastSync({
      type: 'HPBS_UPDATED',
      lastUpdated: lastHpbsUpdated,
    });

    console.log(`[Server] Published HPBS dataset updated: ${toStore.records.length} records.`);
    res.json({
      success: true,
      message: 'Data HPBS berhasil dipublikasikan dan tersimpan di server.',
      recordsCount: toStore.records.length,
      lastUpdated: lastHpbsUpdated,
    });
  } catch (err: any) {
    console.error('[Server] Error saving HPBS dataset:', err);
    res.status(500).json({ success: false, error: err.message || 'Gagal menyimpan data HPBS.' });
  }
});

// 8. POST Reset HPBS to initial
app.post('/api/reset-hpbs', (_req, res) => {
  try {
    const initial = migrateHpbsDataset(generateInitialHpbsDataset());
    cachedHpbsDataset = initial;
    lastHpbsUpdated = new Date().toISOString();
    try {
      fs.writeFileSync(HPBS_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    } catch (_) {}
    broadcastSync({
      type: 'HPBS_UPDATED',
      lastUpdated: lastHpbsUpdated,
    });
    res.json({ success: true, message: 'Data HPBS telah direset ke data awal resmi.', dataset: initial });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// VITE MIDDLEWARE & STATIC ASSETS
// ==========================================

async function startServer() {
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    // Force no-cache on HTML documents so mobile devices always get latest scripts
    app.use((req, res, next) => {
      const isHtmlRequest =
        req.headers.accept?.includes('text/html') ||
        req.path === '/' ||
        (!req.path.includes('.') && !req.path.startsWith('/api'));
      if (isHtmlRequest) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');
      }
      next();
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
          } else if (filePath.includes('/assets/')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Running on http://0.0.0.0:${PORT} (${isProduction ? 'production' : 'development'})`);
  });
}

startServer();
