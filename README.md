### Student Retention – Node/Express + MongoDB API with Static Frontend

This project provides a lightweight Student Retention API built with Node/Express and MongoDB (via Mongoose) plus a static HTML/CSS/JS frontend located under `public/` and `src/`.

## Tech Stack
- **Backend**: Node.js, Express, Mongoose, CORS, morgan, dotenv
- **Database**: MongoDB (Atlas or local)
- **Frontend**: Static HTML files in `public/` and client-side assets under `src/`

## Repository Structure
- `server/` – Express server, routes, and MongoDB models
  - `server/index.js` – App entrypoint, CORS setup, health route, DB connect
  - `server/routes/entries.js` – CRUD routes for generic `Entry` documents
  - `server/models/Entry.js` – Minimal `Entry` schema (type, data, createdBy)
- `public/` – Static HTML pages (advisor/student login and dashboards)
- `src/` – Frontend assets (components, styles, utilities)
- `package.json` – Scripts and dependencies

## Prerequisites
- Node.js 18+ and npm
- A MongoDB connection string (Atlas or local)

## Quick Start
1) Install dependencies
```bash
npm install
```

2) Create `.env` in the project root:
```bash
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>/<db>?retryWrites=true&w=majority
# Optional (defaults shown):
PORT=4000
ALLOWED_ORIGINS=http://localhost:5173
```

3) Start the API (development with auto-reload):
```bash
npm run dev
```

4) Or start the API (production):
```bash
npm start
```

5) Verify health:
```
GET http://localhost:4000/api/health  => { "status": "ok" }
```

## Frontend
- Static HTML pages live in `public/` (e.g., `public/index.html`, `public/student-login.html`).
- You can open these files directly in your browser or serve them via a simple static server if needed. The API runs separately on the port configured above.

## API Overview
Base URL: `http://localhost:<PORT>/api`

### Health
- `GET /api/health` → `{ status: "ok" }`

### Entries
All routes operate on a generic `Entry` shape:
```json
{
  "type": "student | advisor | note | ...",
  "data": { "any": "json" },
  "createdBy": "optional-identifier"
}
```

- `POST /api/entries` – Create
  - Body: JSON matching the structure above
  - 201 → Created entry

- `GET /api/entries` – List with filters
  - Query params (all optional):
    - `type` – filter by entry type
    - `createdBy` – filter by creator id
    - `studentId`, `advisorId`, `email` – filter inside `data.*`
    - `limit` (max 200), `skip`

- `GET /api/entries/:id` – Get by id

- `PUT /api/entries/:id` – Update by id

- `DELETE /api/entries/:id` – Delete by id

- `DELETE /api/entries/purge-student?studentId=<id>` – Danger: bulk delete all entries where `data.studentId` matches

## CORS
The server allows requests only from origins listed in `ALLOWED_ORIGINS` (comma-separated). If you see "Not allowed by CORS", add your frontend origin to this env var and restart the server.

## Scripts
- `npm run dev` – Start with nodemon (auto-reload)
- `npm start` – Start the server

## Troubleshooting
- Missing Mongo URI: The server exits with a message if `MONGODB_URI` is not set.
- Connection issues: Ensure your IP is whitelisted in MongoDB Atlas and the database user has proper permissions.
- CORS errors: Update `ALLOWED_ORIGINS` to include your frontend origin(s).
## License
Unlicensed/educational use. Add your preferred license if required.
