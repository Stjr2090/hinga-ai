# HINGA AI Assistant

HINGA AI Assistant provides localized agricultural guidance for smallholder farmers in East Africa.

## Live application

- Application: [https://hingaai.tech](https://hingaai.tech)
- Canonical redirect: [https://www.hingaai.tech](https://www.hingaai.tech)
- Backend health: [https://hinga-backend.wittyplant-ea872425.italynorth.azurecontainerapps.io/health](https://hinga-backend.wittyplant-ea872425.italynorth.azurecontainerapps.io/health)

`www.hingaai.tech` redirects permanently to `hingaai.tech`. Both hostnames use Azure-managed HTTPS certificates.

## Architecture

HINGA is an npm workspace with two independently deployed services:

```text
Browser
  -> React and Vite frontend on Azure Container Apps
  -> Fastify API on Azure Container Apps
     -> Groq agricultural advisory
     -> Sunbird English-Luganda translation
     -> Open-Meteo weather and forecast data
```

The frontend is served by an unprivileged Nginx container. Provider credentials remain in the backend and are stored as Azure Container App secrets.

## Run locally

Prerequisite: Node.js 22.

1. Install dependencies with `npm ci`.
2. Copy `frontend/.env.example` to `frontend/.env`.
3. Copy `backend/.env.example` to `backend/.env`.
4. Start the frontend with `npm run dev:frontend`.
5. Start the backend with `npm run dev:backend`.

## Validate locally

```powershell
npm.cmd run lint --workspace frontend
npm.cmd test --workspace frontend -- --run
npm.cmd run build --workspace frontend
npm.cmd run lint --workspace backend
npm.cmd test --workspace backend -- --run
npm.cmd run build --workspace backend
```

`npm.cmd` avoids the Windows PowerShell script-execution restriction that can block `npm.ps1`.

## Backend local runtime

The approved Windows development launch is:

```powershell
cd backend
npm.cmd run build
node dist/index.js
```

Run this as the signed-in development user, not as Administrator. The working
directory must be `backend/` so the process loads provider credentials from
`backend/.env`. Keep that file local and do not copy its values into commands,
logs, or tracked configuration.

The default local environment binds the API to `127.0.0.1:8080`. The backend
requires outbound HTTPS on TCP port 443 to the provider hosts configured by
`GROQ_API_KEY`, `SUNBIRD_BASE_URL`, and `OPEN_METEO_BASE_URL`. Do not add an
inbound firewall exception for this loopback-only development server, and do
not add a broad outbound exception when the normal user runtime already permits
these HTTPS connections.

A launch performed inside an IDE or agent sandbox is diagnostic only: it can
confirm build and bind behavior, but provider failures there do not establish
that the normal development runtime is blocked. Release validation must use the
normal user launch above, then check `GET /health` and exercise Groq, Sunbird,
and Open-Meteo from that running backend process.

## Deployment

Frontend and backend deployments use separate GitHub Actions workflows. A push to `main` triggers only the workflow affected by the changed paths. Each workflow validates types, runs tests, builds a Linux container, publishes an immutable Git SHA image to Azure Container Registry, deploys an Azure Container Apps revision, and verifies health.

The production browser origin allowed by backend CORS is `https://hingaai.tech`.

## Documentation

Canonical project documentation is maintained in the sibling
[`HINGA-PROJECT-DOCS`](../HINGA-PROJECT-DOCS/) repository.

- [Technical report](../HINGA-PROJECT-DOCS/HINGA_TECHNICAL_REPORT.md)
