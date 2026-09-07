# Multiplayer Game Platform

A course project for a cross-platform multiplayer game ecosystem. The repository contains an Angular web client, a Flutter light client, and a NestJS/Socket.IO backend with Firebase and MongoDB integrations.

## Features

- Real-time game state, movement, combat, items, challenges, and lobby events over Socket.IO
- Authentication, friends, invitations, notifications, and room-based chat
- Flutter light client with shared game, chat, and service models
- Angular client with Electron packaging support
- Swagger API documentation and unit/e2e test scaffolding

## Repository layout

- `client/` — Angular web and Electron client
- `light_client/` — Flutter client
- `server/` — NestJS modules, gateways, services, and tests
- `common/` — shared message contracts and game interfaces

## Development

Install dependencies in the relevant workspaces, then start the client and server separately:

```bash
cd server && npm ci && npm start
cd client && npm ci && npm start
```

The server exposes Swagger at `/api/docs` when running. Use the project deployment guide for environment variables, Firebase credentials, MongoDB configuration, and production hosting.

## Quality

Run `npm run lint`, `npm run test`, and `npm run coverage` in the server or client workspace before merging. Keep shared socket event contracts synchronized with both clients.
