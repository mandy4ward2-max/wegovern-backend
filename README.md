# wegovern-backend

Node.js + Express + PostgreSQL backend using Prisma ORM.

## Features
- REST API endpoints for motions, tasks, comments, and users
- PostgreSQL database (configure connection in `.env`)
- Prisma ORM for database access

## Setup
1. Install dependencies:
   ```sh
   npm install
   ```
2. Configure your PostgreSQL connection in `.env` (see `.env.example`).
3. Initialize the database:
   ```sh
   npx prisma migrate dev --name init
   ```
4. Start the server:
   ```sh
   node index.js
   ```

## Scripts
- `npm start` — Start the server
- `npx prisma studio` — Open Prisma Studio (DB GUI)

## Endpoints
- `/motions` — Motions API
- `/tasks` — Tasks API
- `/comments` — Comments API
- `/users` — Users API

---

Replace placeholders and add your database credentials in `.env` before running.
