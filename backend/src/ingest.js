import mongoose from 'mongoose';
import { Actual, Forecast } from './models.js';
import { fetchActuals, fetchForecasts } from './elexon.js';

// Decisions are made in January 2026 -> delivery days 2 Jan .. 1 Feb 2026.
// Forecasts published 1 Jan .. 31 Jan 2026; actuals for 1 Jan .. 2 Feb 2026.
const FORECAST_FROM = new Date('2026-01-01T00:00:00Z');
const FORECAST_TO = new Date('2026-02-01T00:00:00Z');
const ACTUAL_FROM = '2026-01-01';
const ACTUAL_TO = '2026-02-02';
const CHUNK_DAYS = 2;

async function upsertActuals(rows) {
  if (!rows.length) return;
  await Actual.bulkWrite(
    rows.map((r) => ({
      updateOne: { filter: { startTime: r.startTime }, update: { $set: r }, upsert: true },
    }))
  );
}

async function upsertForecasts(rows) {
  if (!rows.length) return;
  await Forecast.bulkWrite(
    rows.map((r) => ({
      updateOne: {
        filter: { startTime: r.startTime, publishTime: r.publishTime },
        update: { $set: r },
        upsert: true,
      },
    })),
    { ordered: false }
  );
}

export async function runIngest(log = console.log) {
  // Actuals: one request per ~week
  let d = new Date(ACTUAL_FROM);
  const aEnd = new Date(ACTUAL_TO);
  while (d <= aEnd) {
    const e = new Date(Math.min(d.getTime() + 6 * 864e5, aEnd.getTime()));
    const from = d.toISOString().slice(0, 10);
    const to = e.toISOString().slice(0, 10);
    const rows = await fetchActuals(from, to);
    await upsertActuals(rows);
    log(`actuals ${from}..${to}: ${rows.length}`);
    d = new Date(e.getTime() + 864e5);
  }

  // Forecasts: small chunks of publish time (many revisions per target)
  let t = FORECAST_FROM;
  while (t < FORECAST_TO) {
    const e = new Date(Math.min(t.getTime() + CHUNK_DAYS * 864e5, FORECAST_TO.getTime()));
    const rows = await fetchForecasts(t.toISOString(), e.toISOString());
    await upsertForecasts(rows);
    log(`forecasts ${t.toISOString()}..${e.toISOString()}: ${rows.length}`);
    t = e;
  }
  return { actuals: await Actual.countDocuments(), forecasts: await Forecast.countDocuments() };
}

// CLI: npm run ingest
if (process.argv[1] && process.argv[1].endsWith('ingest.js')) {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/wind');
  console.log(await runIngest());
  await mongoose.disconnect();
}
