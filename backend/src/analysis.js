import { Actual, Forecast } from './models.js';

const HOUR = 36e5;
// Day-ahead decision cutoff: 09:00 UTC on D-1 (UK time == UTC in January).
export const DECISION_HOUR_UTC = 9;

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

// pairs: [{ forecast, actual }]
export function computeStats(pairs) {
  const n = pairs.length;
  if (!n) return { n: 0 };
  const errs = pairs.map((p) => p.forecast - p.actual);
  const abs = errs.map(Math.abs).sort((a, b) => a - b);
  const mae = abs.reduce((s, x) => s + x, 0) / n;
  const rmse = Math.sqrt(errs.reduce((s, x) => s + x * x, 0) / n);
  const bias = errs.reduce((s, x) => s + x, 0) / n;
  const nonZero = pairs.filter((p) => p.actual > 0);
  const mape = nonZero.length
    ? (nonZero.reduce((s, p) => s + Math.abs(p.forecast - p.actual) / p.actual, 0) / nonZero.length) * 100
    : null;
  return {
    n,
    mae,
    rmse,
    bias,
    mape,
    medianAbsError: percentile(abs, 50),
    p90AbsError: percentile(abs, 90),
    p99AbsError: percentile(abs, 99),
    maxAbsError: abs[n - 1],
  };
}

// Latest forecast for each target in [from, to) published at least `horizonHours` before the target.
export async function latestForecasts(from, to, horizonHours) {
  return Forecast.aggregate([
    {
      $match: {
        startTime: { $gte: from, $lt: to },
        $expr: { $lte: ['$publishTime', { $subtract: ['$startTime', horizonHours * HOUR] }] },
      },
    },
    { $sort: { startTime: 1, publishTime: -1 } },
    {
      $group: {
        _id: '$startTime',
        publishTime: { $first: '$publishTime' },
        generation: { $first: '$generation' },
      },
    },
    { $sort: { _id: 1 } },
  ]);
}

async function actualsMap(from, to) {
  const rows = await Actual.find({ startTime: { $gte: from, $lt: to } }).lean();
  return new Map(rows.map((r) => [r.startTime.getTime(), r.generation]));
}

// Forecast available at the day-ahead decision time for delivery day `day` (YYYY-MM-DD)
export async function decisionView(day) {
  const start = new Date(`${day}T00:00:00Z`);
  const end = new Date(start.getTime() + 24 * HOUR);
  const cutoff = new Date(start.getTime() - 24 * HOUR + DECISION_HOUR_UTC * HOUR);
  const rows = await Forecast.aggregate([
    { $match: { startTime: { $gte: start, $lt: end }, publishTime: { $lte: cutoff } } },
    { $sort: { startTime: 1, publishTime: -1 } },
    {
      $group: {
        _id: '$startTime',
        publishTime: { $first: '$publishTime' },
        generation: { $first: '$generation' },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  const actuals = await actualsMap(start, end);
  const series = rows.map((r) => ({
    startTime: r._id,
    publishTime: r.publishTime,
    forecast: r.generation,
    actual: actuals.get(r._id.getTime()) ?? null,
  }));
  const pairs = series.filter((s) => s.actual !== null).map((s) => ({ forecast: s.forecast, actual: s.actual }));
  const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
  return {
    day,
    decisionCutoff: cutoff,
    summary: {
      points: series.length,
      meanForecastMW: mean(series.map((s) => s.forecast)),
      minForecastMW: series.length ? Math.min(...series.map((s) => s.forecast)) : null,
      maxForecastMW: series.length ? Math.max(...series.map((s) => s.forecast)) : null,
      latestPublishTime: series.length ? series.map((s) => s.publishTime).sort((a, b) => b - a)[0] : null,
    },
    stats: computeStats(pairs),
    series,
  };
}

// Forecast vs actual over a range for a fixed minimum horizon
export async function errorAnalysis(from, to, horizonHours) {
  const fc = await latestForecasts(from, to, horizonHours);
  const actuals = await actualsMap(from, to);
  const series = fc
    .filter((f) => actuals.has(f._id.getTime()))
    .map((f) => ({
      startTime: f._id,
      publishTime: f.publishTime,
      forecast: f.generation,
      actual: actuals.get(f._id.getTime()),
      error: f.generation - actuals.get(f._id.getTime()),
    }));
  return { horizonHours, stats: computeStats(series), series };
}

export async function errorByHorizon(from, to, horizons = [1, 2, 4, 6, 8, 12, 16, 24, 32, 40, 48]) {
  const out = [];
  for (const h of horizons) {
    const { stats } = await errorAnalysis(from, to, h);
    out.push({ horizonHours: h, ...stats });
  }
  return out;
}
