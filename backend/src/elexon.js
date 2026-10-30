const BASE = 'https://data.elexon.co.uk/bmrs/api/v1/datasets';

async function getJson(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (res.ok) return res.json();
    if (attempt === 3) throw new Error(`Elexon ${res.status} for ${url}`);
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
}

// Actual wind generation (FUELHH, fuelType WIND), by settlement date range (YYYY-MM-DD)
export async function fetchActuals(fromDate, toDate) {
  const qs = new URLSearchParams({
    settlementDateFrom: fromDate,
    settlementDateTo: toDate,
    fuelType: 'WIND',
  });
  const rows = await getJson(`${BASE}/FUELHH/stream?${qs}`);
  return rows
    .filter((r) => r.fuelType === 'WIND')
    .map((r) => ({ startTime: new Date(r.startTime), generation: r.generation }));
}

// Wind forecasts (WINDFOR), by publish time range (ISO strings)
export async function fetchForecasts(fromIso, toIso) {
  const qs = new URLSearchParams({
    publishDateTimeFrom: fromIso,
    publishDateTimeTo: toIso,
  });
  const rows = await getJson(`${BASE}/WINDFOR/stream?${qs}`);
  return rows.map((r) => ({
    startTime: new Date(r.startTime),
    publishTime: new Date(r.publishTime),
    generation: r.generation,
  }));
}
