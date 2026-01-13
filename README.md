# Expo AI Chat Demo

Minimal microservice-style chat demo with a Fastify backend-for-frontend proxying to a FastAPI AI service and Postgres.

Minimal end-to-end chat demo built with Expo, Fastify, and FastAPI.

## Overview
- Expo TypeScript app (`apps/app`) sends `{ email, prompt }` to the Fastify API.
- Node Fastify API (`services/api-node`) upserts the user, calls the Python FastAPI service, and returns `{ answer }`.
- Python FastAPI service (`services/ai-python`) calls OpenAI, logs the prompt/response to Postgres, and forwards the answer.
- Postgres stores users and AI logs. Schema is under `infra/schema.sql`.

## Prerequisites (Windows)
1. Install Node.js LTS (18+) from https://nodejs.org.
2. Install pnpm: `npm install -g pnpm`.
3. Install Python 3.10+ from https://www.python.org/downloads/.
4. Install Expo CLI globally: `pnpm add -g expo-cli`.

## Postgres setup
1. Install Postgres for Windows (https://www.postgresql.org/download/windows/).
2. Create the `app` user/database.

   **PowerShell / CMD (psql CLI)**
   ```
   psql -U postgres -c "CREATE USER app WITH PASSWORD 'app';"
   psql -U postgres -c "CREATE DATABASE app OWNER app;"
   ```

   **pgAdmin option** - open pgAdmin, connect as `postgres`, run the two SQL statements above in the Query Tool, and ensure the `app` role owns the `app` database.

3. Apply the schema:
   ```
   psql -U app -d app -h localhost -p 5432 -f infra/schema.sql
   ```

## Environment configuration
1. Copy env samples (PowerShell / CMD):
   ```
   Copy-Item services/api-node/.env.example services/api-node/.env
   Copy-Item services/ai-python/.env.example services/ai-python/.env
   ```
   or
   ```
   copy services\\api-node\\.env.example services\\api-node\\.env
   copy services\\ai-python\\.env.example services\\ai-python\\.env
   ```
2. Update `services/ai-python/.env` with your `OPENAI_API_KEY`.

## Running the Python FastAPI service
1. `cd services/ai-python`
2. `python -m venv .venv`
3. PowerShell: `.\.venv\Scripts\Activate.ps1`; CMD: `.\.venv\Scripts\activate.bat`
4. `pip install -r requirements.txt`
5. `uvicorn main:app --reload --port 8000`

## Running the Node Fastify API
1. `cd services/api-node`
2. `pnpm install`
3. `pnpm dev`

## Running the Expo app
1. `cd apps/app`
2. `pnpm install`
3. `pnpm start` (or `expo start`)
4. For web, press `w`.
5. For a physical device, find your PC LAN IP (`ipconfig`) and open `http://<LAN>:19000` or set `API_BASE_URL` in `apps/app/src/config.ts` to `http://<LAN>:3001` before running so the phone can reach the Node API.

## Smoke tests
1. Node API health:
   ```
   curl http://localhost:3001/health
   ```
2. Python health:
   ```
   curl http://localhost:8000/health
   ```
3. Full chat (replace email/prompt):
   ```
   curl -X POST http://localhost:3001/api/ask -H "Content-Type: application/json" -d "{\"email\":\"you@example.com\",\"prompt\":\"Hello\"}"
   ```
   Expected: `{ "answer": "<ai reply>" }`

## Notes
- Expo app defaults to `http://localhost:3001` for the Fastify API. Update `src/config.ts` if your Node API runs elsewhere.
- Keep `.env` files out of source control; only `.env.example` lives in the repo.
