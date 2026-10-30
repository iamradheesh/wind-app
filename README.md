# UK Wind Forecast Monitor (MERN)

Web app for a day-ahead power buying team. It shows (1) the latest wind forecast available at decision time and (2) quantified forecast accuracy, using national wind data from Elexon BMRS only (FUELHH actuals, WINDFOR forecasts), scoped to decisions made in January 2026.

**AI tools:** Built with assistance from Claude (Anthropic).

## Stack
MongoDB, Express, React (Vite + Recharts), Node.js. Docker Compose for local run.

## Structure
- `backend/src/elexon.js` – Elexon API client (FUELHH `fuelType=WIND`, WINDFOR)
- `backend/src/ingest.js` – pulls Jan 2026 data into MongoDB (idempotent upserts)
- `backend/src/models.js` – `Actual` (startTime), `Forecast` (startTime + publishTime, unique)
- `backend/src/analysis.js` – decision view, error metrics, error by horizon
- `backend/src/index.js` – REST API
- `backend/test/` – unit tests for the metrics (`npm test`)
- `frontend/src/App.jsx` – UI (decision view + accuracy view)
- `docker-compose.yml` – mongo + backend + frontend (nginx)

## Run
```
docker compose up --build
curl -X POST http://localhost:4000/api/ingest     # one-off data load, takes a few minutes
curl http://localhost:4000/api/status             # check counts
```
Open http://localhost:3000.

Without Docker: run `mongod`, then `cd backend && npm i && npm run ingest && npm start`, and `cd frontend && npm i && npm run dev`.

## Method
- **Decision view:** for delivery day D, uses the latest forecast per half-hour published at or before 09:00 UTC on D-1 (assumed day-ahead decision time; UK time equals UTC in January). Change `DECISION_HOUR_UTC` in `analysis.js` to adjust.
- **Accuracy:** for each target half-hour, takes the latest forecast published at least `horizon` hours earlier, joins to actuals, and reports error = forecast - actual: MAE, RMSE, bias, MAPE, median/P90/P99/max absolute error. Also MAE and P90 by horizon (1-48h).

## API
- `GET /api/decision?day=YYYY-MM-DD`
- `GET /api/errors?from=&to=&horizon=`
- `GET /api/errors/by-horizon?from=&to=`
- `POST /api/ingest`, `GET /api/status`

## Deployment
Link: _add here_ (frontend on Vercel with `VITE_API_URL` pointing at the hosted backend; backend + MongoDB Atlas on Render/Heroku).
