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

## Project structure

- `frontend/`: React + Vite application
- `backend/`: Express API + MongoDB + static asset serving

## Run locally

1. Copy `backend/.env.example` to `backend/.env`
2. Set `MONGODB_URI`
3. Install dependencies:
   - `npm install`
   - `npm --prefix backend install`
   - `npm --prefix frontend install`
4. Start development:
   - `npm run dev`

## Production

1. Build frontend: `npm run build`
2. Start API/server: `npm start`

In production, the Express server serves `frontend/dist` when it exists.
