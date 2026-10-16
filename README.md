# Rentera

Production-style rental marketplace built with React, Node.js, Express, MongoDB, and Mongoose.

## Features

- Flipkart-inspired top navigation
- Category filter for clothing, electronics, bike, cars, furniture, and house
- Add item flow with main image, additional image, video, address, pin code, and phone number
- Your item dashboard
- Your order dashboard
- File upload support with local storage in `backend/uploads`
- MongoDB persistence with Mongoose
- Redis-backed login sessions, OTPs, API rate limits, and public item caching

## Project structure

- `frontend/`: React + Vite application
- `backend/`: Express API + MongoDB + static asset serving

## Run locally

1. Copy `backend/.env.example` to `backend/.env`
2. Set `MONGODB_URI`, `REDIS_URL`, a strong, unique `SESSION_SECRET`, and environment-specific `ADMIN_EMAIL` and `ADMIN_PASSWORD`
3. Start Redis locally, for example with `docker run --rm -p 6379:6379 redis:7-alpine`
4. Install dependencies:
   - `npm install`
   - `npm --prefix backend install`
   - `npm --prefix frontend install`
5. Start development:
   - `npm run dev`

The frontend uses `http://localhost:5000/api` during development by default. Set `VITE_API_URL` in `frontend/.env` only when the API runs at a different URL.

## Production

1. Build frontend: `npm run build`
2. Start API/server: `npm start`

In production, the Express server serves `frontend/dist` when it exists, and the frontend uses the same server's `/api` by default. Set `VITE_API_URL` at frontend build time only when hosting the frontend separately.

Forwarded client IP headers are not trusted by default. If deploying behind a reverse proxy, set `TRUSTED_PROXIES` to a comma-separated list of the proxy IPs or CIDRs, ensure the app is reachable only through those proxies, and configure them to overwrite/sanitize `X-Forwarded-For`. This is important because API rate limits use the client IP.

## Continuous integration

GitHub Actions runs on pushes and pull requests. The workflow installs backend and frontend dependencies from their lockfiles, checks backend JavaScript syntax, and builds the frontend with Node.js 22. The project does not currently define a backend test suite or lint script, so those checks are not part of CI.

After those checks pass on a push to `main`, the workflow builds the root `Dockerfile` and pushes `anshu620/ranter-app` to Docker Hub with `latest` and commit-SHA tags. Add a Docker Hub access token as the `DOCKERHUB_TOKEN` Actions repository secret before enabling image publishing. Pull requests and pushes to other branches do not publish images.

## Run with Docker

1. Make sure Docker Desktop is installed and running.
2. Create `backend/.env` from `backend/.env.example`, then set strong `SESSION_SECRET` and admin credentials, plus your Cloudinary, Razorpay, and email credentials. Docker Compose supplies the MongoDB and Redis connection strings.
3. From the project root, build and start the app, MongoDB, and Redis:

   ```sh
   docker compose up --build
   ```

4. Open `http://localhost:5000`. Check the API with `http://localhost:5000/api/health`.

MongoDB remains the permanent application database. Redis stores seven-day sessions, short-lived OTPs and rate-limit counters, plus public item-list cache entries with a 60-second TTL. The Redis container enables append-only persistence and stores its data in the `redis_data` volume.

The database is stored in the `mongo_data` Docker volume. Stop the containers with `docker compose down`; use `docker compose down -v` only when you intend to delete database and Redis data. MongoDB and Redis are not published to the host.

Do not commit `.env` files. The current environment example and payment controller contain live-looking credentials; rotate them before deployment and load replacement credentials only through environment variables.
