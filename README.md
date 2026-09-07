# Kazuma

Kazuma is a cross-platform multiplayer game built around a real-time game server. Players can create or join games, move through maps, fight opponents, collect items, complete challenges, and stay connected through chat and social features.

The project is split into three application components and one shared contract layer:

- **Web client**: Angular application with an optional Electron build.
- **Light client**: Flutter application for mobile and desktop platforms.
- **Game server**: NestJS application exposing REST endpoints and Socket.IO gateways.
- **Shared contracts**: TypeScript interfaces and socket event definitions used by the web client and server.

## Features

- Real-time lobbies, movement, turns, combat, items, and end-game events
- Classic and capture-the-flag game modes
- Map creation and management backed by MongoDB
- Firebase authentication and persistent player statistics
- Friends, game invitations, user status, notifications, and room chat
- Player profiles, currencies, themes, challenges, and leaderboards/statistics
- Bots and turn-based game support
- Swagger documentation for the server API

## Architecture

```text
client/       Angular web client and Electron packaging
light_client/ Flutter light client
server/       NestJS REST API and Socket.IO game server
common/       Shared TypeScript interfaces and socket contracts
assets/       Images, tiles, items, fonts, sounds, and HUD resources
```

The local development setup expects the Angular client and Flutter client to connect to the NestJS server at `http://localhost:3000`. The Angular development server runs at `http://localhost:4200` by default.

## Prerequisites

- Node.js and npm
- MongoDB, either locally or through a hosted instance
- Flutter SDK (only required for the light client)
- A Firebase project and service account for authentication and statistics

## Run locally

Install dependencies once in each JavaScript workspace:

```bash
cd server
npm ci

cd ../client
npm ci
```

Configure the server's MongoDB and Firebase credentials before starting it. The server supports `DATABASE_CONNECTION_STRING` for MongoDB and `FIREBASE_SERVICE_ACCOUNT_PATH` for the Firebase service-account JSON file. Keep credentials out of version control.

Start the server and web client in separate terminals:

```bash
# Terminal 1
cd server
npm start

# Terminal 2
cd client
npm start
```

Then open `http://localhost:4200`. The server's Swagger UI is available at `http://localhost:3000/api/docs`.

### Flutter light client

```bash
cd light_client
flutter pub get
flutter run
```

Use `flutter devices` to choose a connected emulator or device. The light client must be configured to use the same server instance as the web client.

## Useful commands

Run these from the relevant workspace:

| Workspace | Build | Test | Lint |
| --- | --- | --- | --- |
| `client/` | `npm run build` | `npm test` | `npm run lint` |
| `server/` | `npm run build` | `npm test` | `npm run lint` |
| `light_client/` | `flutter build apk` | `flutter test` | `flutter analyze` |

For coverage, use `npm run coverage` in `client/` or `server/`.

## Configuration

The Angular development environment points to the local server:

```text
REST API:  http://localhost:3000/api
WebSocket: http://localhost:3000
```

Production endpoints are configured in `client/src/environments/environment.prod.ts`. Update that file, or provide an equivalent deployment configuration, before building for a hosted environment.

## Deployment

The full deployment guide covers GitLab Pages, the dynamic server, AWS EC2, environment variables, and production configuration:

- [Deployment guide](DEPLOYMENT.md)

## Contributing

Before opening a merge request:

1. Run the relevant build, test, and lint commands.
2. Keep interfaces and Socket.IO event names in `common/` synchronized with both clients.
3. Do not commit Firebase credentials, local environment files, generated build output, or other secrets.

See [CONTRIBUTING.md](CONTRIBUTING.md) for repository-specific contribution notes.
