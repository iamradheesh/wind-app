import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { Actual, Forecast } from './models.js';
import { runIngest } from './ingest.js';
import { decisionView, errorAnalysis, errorByHorizon } from './analysis.js';

const app = express();
app.use(cors());

const parseRange = (q) => {
  const from = new Date(`${q.from}T00:00:00Z`);
  const to = new Date(new Date(`${q.to}T00:00:00Z`).getTime() + 864e5); // inclusive end date
  if (isNaN(from) || isNaN(to) || from >= to) throw new Error('Invalid from/to (use YYYY-MM-DD)');
  return [from, to];
};
const wrap = (fn) => (req, res) =>
  fn(req, res).catch((e) => res.status(400).json({ error: e.message }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/status', wrap(async (_req, res) => {
  res.json({ actuals: await Actual.countDocuments(), forecasts: await Forecast.countDocuments() });
}));

let ingesting = false;
app.post('/api/ingest', (_req, res) => {
  if (ingesting) return res.status(409).json({ error: 'ingest already running' });
  ingesting = true;
  runIngest().catch((e) => console.error('ingest failed', e)).finally(() => (ingesting = false));
  res.status(202).json({ message: 'ingest started; check /api/status' });
});

app.get('/api/decision', wrap(async (req, res) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(req.query.day || '')) throw new Error('day=YYYY-MM-DD required');
  res.json(await decisionView(req.query.day));
}));

app.get('/api/errors', wrap(async (req, res) => {
  const [from, to] = parseRange(req.query);
  const horizon = Number(req.query.horizon ?? 24);
  if (!(horizon >= 0 && horizon <= 48)) throw new Error('horizon must be 0-48 hours');
  res.json(await errorAnalysis(from, to, horizon));
}));

app.get('/api/errors/by-horizon', wrap(async (req, res) => {
  const [from, to] = parseRange(req.query);
  res.json(await errorByHorizon(from, to));
}));

const PORT = process.env.PORT || 4000;
await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/wind');
app.listen(PORT, () => console.log(`API on :${PORT}`));
