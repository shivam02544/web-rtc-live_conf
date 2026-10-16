# Starting the Video Call Project

This repository is an npm-workspaces monorepo. The web app uses Next.js, the signaling service uses WebSockets, and PostgreSQL and Redis are provided by Docker Compose.

## Requirements

- Node.js 20 or newer and npm
- Docker Desktop (or Docker Engine with the Compose plugin)
- A modern browser with camera and microphone access

## First-Time Setup

Run these commands from the repository root.

1. Install workspace dependencies:

   ```powershell
   npm install
   ```

2. Create the root environment file used by the signaling server:

   ```powershell
   Copy-Item .env.example .env
   ```

   Next.js loads environment files from `apps/web`, so create one there as well:

   ```powershell
   Copy-Item .env.example apps/web/.env
   ```

   Edit both files as needed. Keep the values for `DATABASE_URL`, `REDIS_URL`, and `AUTH_SECRET` consistent. For local development, the example database and Redis URLs match the ports in `docker-compose.yml`. Replace `AUTH_SECRET` with a long, random value; do not use the example value in production.

3. Start PostgreSQL and Redis:

   ```powershell
   docker compose up -d
   ```

4. Build the shared workspace package, which the web and signaling apps import:

   ```powershell
   npm run build -w packages/shared
   ```

5. Generate the Prisma client and create/update the local database schema:

   ```powershell
   npx prisma generate --schema apps/web/prisma/schema.prisma
   npx prisma db push --schema apps/web/prisma/schema.prisma
   ```

## Run in Development

Start both applications from the repository root:

```powershell
npm run dev
```

Open the web app at [http://localhost:3000](http://localhost:3000). The signaling WebSocket server defaults to port `8080` in `apps/signaling/src/server.ts`; the web app currently defaults to `ws://localhost:8081` in `apps/web/src/hooks/useWebRTC.ts`. Set `SIGNALING_PORT` and `NEXT_PUBLIC_SIGNALING_URL` to matching values in the environment files before starting both services. For example, use `SIGNALING_PORT=8081` and `NEXT_PUBLIC_SIGNALING_URL=ws://localhost:8081` for the current web-app default.

If the web app or signaling process was already running when you changed environment variables, stop and restart it so the new values are loaded.

## Create an Account and Test a Call

1. Open [http://localhost:3000/register](http://localhost:3000/register) and create an account.
2. Open a second browser profile or a different browser and create another account. A user cannot call themselves.
3. Keep both users signed in and online, select the other user, and start a call.
4. Allow camera and microphone access when the browser requests it. Screen sharing and device selection are available during a call where supported by the browser.

## Useful Commands

```powershell
# Build all configured workspaces
npm run build

# Run workspace tests (where configured)
npm test

# Run workspace lint scripts (where configured)
npm run lint

# Stop PostgreSQL and Redis
docker compose down

# Stop services and delete local database/cache data
docker compose down -v
```

`docker compose down -v` permanently deletes the local PostgreSQL and Redis volumes. Use it only when you intend to discard local data.

## Configuration Notes

- `.env` at the repository root is loaded by the signaling service through its dotenv configuration.
- `apps/web/.env` is loaded by Next.js when the web workspace runs.
- Set the same `AUTH_SECRET` in both files; it signs web sessions that the signaling service verifies.
- The example uses PostgreSQL at `localhost:55432` and Redis at `localhost:56379`.
- `TURN_SERVER`, `TURN_USERNAME`, and `TURN_CREDENTIAL` are optional for local testing. A TURN server is typically needed for reliable calls across restrictive networks; STUN alone does not guarantee connectivity.
- The `PORT` value in `.env.example` is not used by the current Next.js dev script, which defaults to port `3000`. `SIGNALING_PORT` controls the signaling server port.

## Troubleshooting

- **Database connection errors:** Confirm `docker compose ps` shows PostgreSQL running, and check that `DATABASE_URL` uses port `55432`.
- **Redis connection errors:** Confirm Redis is running and `REDIS_URL` uses port `56379`.
- **WebSocket connection errors:** Ensure `SIGNALING_PORT` matches the port in `NEXT_PUBLIC_SIGNALING_URL`, then restart both processes.
- **Shared package import/build errors:** Run `npm run build -w packages/shared` after installing dependencies or changing shared package code.
- **Camera or microphone unavailable:** Check browser permissions and ensure another application is not exclusively using the device. Camera/microphone access generally requires localhost or HTTPS.
- **Call connects only on some networks:** Configure a TURN server and provide its URL and credentials in both environment files.
