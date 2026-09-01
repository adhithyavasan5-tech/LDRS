# 💞 LDRS — Long-Distance Couple Movie Date App

> _"Break the distance, together in every moment."_

A premium full-stack web application for long-distance couples to watch movies together, video call, chat, and preserve shared memories in their private digital date space.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Node.js + Express.js |
| Real-time | Socket.io |
| Video Call | WebRTC (Agora-ready) |
| Database | MongoDB Atlas + Mongoose |
| File Storage | Cloudinary (S3-ready) |
| Notifications | Firebase Cloud Messaging |
| Auth | JWT (no email/password) |

---

## Project Structure

```
LDRS/
├── client/          ← React frontend (port 5173)
├── server/          ← Express backend (port 5000)
├── .env.example     ← Environment variable template
├── package.json     ← Root workspace scripts
└── README.md
```

---

## Quick Start

### 1. Clone and install dependencies

```bash
cd LDRS
npm install          # installs root deps (concurrently)
npm run install:all  # installs server + client deps
```

### 2. Configure environment variables

```bash
# Copy the template
cp .env.example server/.env
# Fill in your values
```

Required values:
- `MONGODB_URI` — MongoDB Atlas connection string
- `JWT_SECRET` — Any random secret string
- `CLOUDINARY_*` — From your Cloudinary dashboard
- `FIREBASE_*` — From your Firebase project settings

### 3. Start development servers

```bash
npm run dev
```

This starts:
- **Frontend** at `http://localhost:5173`
- **Backend** at `http://localhost:5000`

---

## API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/users/register` | Create user profile |
| GET | `/api/users/me` | Get current user |
| GET | `/api/users/:id` | Get user by ID |
| POST | `/api/rooms/create` | Create movie date room |
| POST | `/api/rooms/join` | Join a room |
| GET | `/api/rooms/:code` | Get room by code |
| GET | `/api/couple/profile` | Get couple profile |
| PUT | `/api/couple/profile` | Update couple profile |
| GET | `/api/couple/watchlist` | Get watchlist |
| POST | `/api/couple/watchlist` | Add to watchlist |
| GET | `/api/history` | Get watch history |
| POST | `/api/history` | Add history entry |

---

## Socket.io Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `room:join` | Client → Server | Join a room |
| `room:leave` | Client → Server | Leave a room |
| `room:locked` | Server → Client | Room is now full |
| `playback:play` | Both | Sync play |
| `playback:pause` | Both | Sync pause with reason |
| `playback:seek` | Both | Sync seek position |
| `playback:volume` | Both | Sync volume |
| `chat:message` | Both | Send/receive message |
| `chat:typing` | Both | Typing indicator |
| `chat:reaction` | Both | Emoji reaction |
| `call:offer` | Client → Partner | WebRTC offer |
| `call:answer` | Client → Partner | WebRTC answer |
| `call:ice-candidate` | Both | ICE candidate |

---

## User Flow

```
Landing Page
    ↓
Create Profile (Name, Gender, Age — no password)
    ↓
Home Dashboard
    ↓
Create Room / Join Room
    ↓
Watch Together (75% movie / 25% communication)
```

---

## Environment Variables

See `.env.example` for all required variables. **Never commit your `.env` file.**

---

## Development Phases

- **Phase 1** ✅ Foundation (current)
- **Phase 2** ⏳ Movie Player & Sync
- **Phase 3** ⏳ WebRTC Video Call & Chat
- **Phase 4** ⏳ Couple Features & Notifications
