import React, { useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import { getDecision, getErrors, getByHorizon, getStatus } from './api.js';

const fmt = (x, d = 0) => (x == null ? '-' : Number(x).toFixed(d));
const tick = (t) => new Date(t).toISOString().slice(5, 16).replace('T', ' ');

function Stats({ stats }) {
  if (!stats || !stats.n) return <p>No overlapping forecast/actual data.</p>;
  const rows = [
    ['Points', stats.n], ['MAE (MW)', fmt(stats.mae)], ['RMSE (MW)', fmt(stats.rmse)],
    ['Bias (MW, +=over-forecast)', fmt(stats.bias)], ['MAPE (%)', fmt(stats.mape, 1)],
    ['Median abs error (MW)', fmt(stats.medianAbsError)], ['P90 abs error (MW)', fmt(stats.p90AbsError)],
    ['P99 abs error (MW)', fmt(stats.p99AbsError)], ['Max abs error (MW)', fmt(stats.maxAbsError)],
  ];
  return (
    <table border="1" cellPadding="4" style={{ borderCollapse: 'collapse' }}>
      <tbody>{rows.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}</tbody>
    </table>
  );
}

function SeriesChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="startTime" tickFormatter={tick} minTickGap={40} />
        <YAxis unit=" MW" width={80} />
        <Tooltip labelFormatter={tick} />
        <Legend />
        <Line type="monotone" dataKey="forecast" stroke="#1f77b4" dot={false} name="Forecast" />
        <Line type="monotone" dataKey="actual" stroke="#d62728" dot={false} name="Actual" connectNulls={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function DecisionView() {
  const [day, setDay] = useState('2026-01-15');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true); setErr('');
    try { setData(await getDecision(day)); } catch (e) { setErr(e.message); setData(null); }
    setLoading(false);
  };

  return (
    <section>
      <h2>1. Day-ahead decision view</h2>
      <p>Latest wind forecast available at the decision time (09:00 UTC the day before) for a delivery day.</p>
      <label>Delivery day: <input type="date" value={day} min="2026-01-02" max="2026-02-01" onChange={(e) => setDay(e.target.value)} /></label>{' '}
      <button onClick={load} disabled={loading}>{loading ? 'Loading...' : 'Show'}</button>
      {err && <p style={{ color: 'crimson' }}>{err}</p>}
      {data && (
        <>
          <p>
            Decision cutoff: <b>{new Date(data.decisionCutoff).toISOString().replace('T', ' ').slice(0, 16)} UTC</b>.
            Latest forecast used was published: {data.summary.latestPublishTime ? new Date(data.summary.latestPublishTime).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : '-'}.
          </p>
          <p>
            Forecast wind: mean {fmt(data.summary.meanForecastMW)} MW, min {fmt(data.summary.minForecastMW)} MW, max {fmt(data.summary.maxForecastMW)} MW
            ({data.summary.points} half-hours).
          </p>
          <SeriesChart data={data.series} />
          <h4>Accuracy for this day (where actuals are available)</h4>
          <Stats stats={data.stats} />
        </>
      )}
    </section>
  );
}

function ErrorView() {
  const [from, setFrom] = useState('2026-01-02');
  const [to, setTo] = useState('2026-01-31');
  const [horizon, setHorizon] = useState(24);
  const [res, setRes] = useState(null);
  const [byH, setByH] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true); setErr('');
    try {
      const [a, b] = await Promise.all([getErrors(from, to, horizon), getByHorizon(from, to)]);
      setRes(a); setByH(b);
    } catch (e) { setErr(e.message); }
    setLoading(false);
  };

  return (
    <section>
      <h2>2. Forecast accuracy</h2>
      <p>Compares actual vs. the latest forecast published at least <i>horizon</i> hours before each half-hour.</p>
      <label>From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>{' '}
      <label>To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>{' '}
      <label>Horizon: {horizon}h <input type="range" min="0" max="48" value={horizon} onChange={(e) => setHorizon(+e.target.value)} /></label>{' '}
      <button onClick={load} disabled={loading}>{loading ? 'Loading...' : 'Analyse'}</button>
      {err && <p style={{ color: 'crimson' }}>{err}</p>}
      {res && (
        <>
          <SeriesChart data={res.series} />
          <h4>Error statistics at {res.horizonHours}h horizon</h4>
          <Stats stats={res.stats} />
        </>
      )}
      {byH && (
        <>
          <h4>MAE / P90 error by forecast horizon</h4>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byH}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="horizonHours" label={{ value: 'horizon (h)', position: 'insideBottom', offset: -2 }} />
              <YAxis unit=" MW" width={80} />
              <Tooltip /><Legend />
              <Bar dataKey="mae" fill="#1f77b4" name="MAE" />
              <Bar dataKey="p90AbsError" fill="#ff7f0e" name="P90 abs error" />
            </BarChart>
          </ResponsiveContainer>
        </>
      )}
    </section>
  );
}

export default function App() {
  const [status, setStatus] = useState(null);
  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 16, fontFamily: 'sans-serif' }}>
      <h1>UK Wind Forecast Monitor</h1>
      <p>National wind generation (Elexon FUELHH actuals, WINDFOR forecasts) for January 2026 day-ahead decisions.</p>
      <button onClick={async () => setStatus(await getStatus().catch((e) => ({ error: e.message })))}>Check data status</button>
      {status && <span> {JSON.stringify(status)}</span>}
      <DecisionView />
      <ErrorView />
    </div>
  );
}
