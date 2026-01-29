# ChatVista 🎥

> AI-Powered Video Conferencing Platform with Real-Time Transcription and Smart Meeting Minutes

ChatVista is a comprehensive video conferencing solution that leverages AI to enhance meeting productivity through real-time transcription, automatic meeting minutes generation, and intelligent insights.

## ✨ Features

### Video Conferencing
- 🎥 **HD Video & Audio** - Crystal clear 1080p video with adaptive quality
- 👥 **Large Meetings** - Support for up to 100 participants
- 🖥️ **Screen Sharing** - Share your screen, window, or specific tab
- 💬 **Real-Time Chat** - In-meeting chat with emoji reactions
- ✋ **Hand Raising** - Virtual hand raising for orderly discussions
- 🔐 **Secure Meetings** - End-to-end encryption and waiting rooms

### AI-Powered Features
- 📝 **Live Transcription** - Real-time speech-to-text using OpenAI Whisper
- 📋 **Smart Minutes** - AI-generated meeting summaries with GPT-4
- 🎯 **Action Items** - Automatic extraction of tasks and decisions
- 🔍 **Searchable Archive** - Full-text search across all transcripts

### Recording & Export
- 🔴 **Cloud Recording** - Record meetings with one click
- 📤 **Multiple Formats** - Export to PDF, DOCX, TXT, SRT, VTT
- ☁️ **S3 Storage** - Scalable cloud storage for recordings
- 🔄 **Automatic Transcoding** - Multiple quality options

### Enterprise Features
- 🔑 **SSO Integration** - SAML and OAuth support
- 👮 **Role-Based Access** - Fine-grained permissions
- 📊 **Analytics Dashboard** - Meeting insights and usage stats
- 🏢 **Organization Management** - Team and workspace management

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         ChatVista                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Frontend   │    │   Backend    │    │   Services   │      │
│  │   (Next.js)  │◄──►│  (Express)   │◄──►│              │      │
│  └──────────────┘    └──────────────┘    │  - OpenAI    │      │
│         │                   │            │  - Redis     │      │
│         │                   │            │  - S3/MinIO  │      │
│         ▼                   ▼            └──────────────┘      │
│  ┌──────────────┐    ┌──────────────┐                          │
│  │  Socket.IO   │◄──►│  mediasoup   │                          │
│  │  (Real-time) │    │   (WebRTC)   │                          │
│  └──────────────┘    └──────────────┘                          │
│                             │                                    │
│                             ▼                                    │
│                      ┌──────────────┐                           │
│                      │  PostgreSQL  │                           │
│                      │  (Database)  │                           │
│                      └──────────────┘                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- pnpm 8+
- PostgreSQL 14+
- Redis 7+
- FFmpeg (for recording)

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/chatvista.git
   cd chatvista
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Start infrastructure with Docker**
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```

4. **Configure environment variables**
   ```bash
   # Backend
   cp apps/backend/.env.example apps/backend/.env
   
   # Frontend
   cp apps/frontend/.env.example apps/frontend/.env.local
   ```

5. **Run database migrations**
   ```bash
   cd apps/backend
   npx prisma migrate dev
   ```

6. **Start development servers**
   ```bash
   pnpm dev
   ```

7. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:4000
   - MinIO Console: http://localhost:9001

## 📁 Project Structure

```
chatvista/
├── apps/
│   ├── backend/          # Express.js API server
│   │   ├── prisma/       # Database schema and migrations
│   │   └── src/
│   │       ├── routes/   # API endpoints
│   │       ├── services/ # Business logic
│   │       ├── lib/      # Utilities and clients
│   │       └── middleware/ # Express middleware
│   │
│   └── frontend/         # Next.js 14 application
│       └── src/
│           ├── app/      # App router pages
│           ├── components/ # React components
│           ├── hooks/    # Custom React hooks
│           ├── lib/      # Utilities
│           └── store/    # Zustand stores
│
├── packages/
│   └── types/            # Shared TypeScript types
│
├── docker-compose.yml    # Production Docker setup
├── docker-compose.dev.yml # Development Docker setup
├── turbo.json            # Turborepo configuration
└── pnpm-workspace.yaml   # pnpm workspace config
```

## 🔧 Configuration

### Backend Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | - |
| `REDIS_URL` | Redis connection string | - |
| `JWT_SECRET` | Secret for JWT tokens | - |
| `OPENAI_API_KEY` | OpenAI API key for AI features | - |
| `S3_ENDPOINT` | S3/MinIO endpoint | - |
| `S3_ACCESS_KEY` | S3 access key | - |
| `S3_SECRET_KEY` | S3 secret key | - |

### Frontend Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | http://localhost:4000 |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL | ws://localhost:4000 |

## 📚 API Documentation

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout user

### Meetings
- `POST /api/meetings` - Create meeting
- `GET /api/meetings` - List meetings
- `GET /api/meetings/:id` - Get meeting details
- `POST /api/meetings/:id/join` - Join meeting
- `POST /api/meetings/:id/end` - End meeting

### Transcripts & Minutes
- `GET /api/transcripts/:meetingId` - Get transcript
- `GET /api/minutes/:meetingId` - Get AI minutes
- `POST /api/minutes/:meetingId/generate` - Generate minutes

### Recordings
- `POST /api/recordings/start` - Start recording
- `POST /api/recordings/:id/stop` - Stop recording
- `GET /api/recordings` - List recordings

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run backend tests
pnpm test --filter=@chatvista/backend

# Run frontend tests
pnpm test --filter=@chatvista/frontend

# Run e2e tests
pnpm test:e2e
```

## 🚢 Deployment

### Docker Deployment

```bash
# Build and start production containers
docker-compose up -d --build
```

### Manual Deployment

```bash
# Build all packages
pnpm build

# Start production server
pnpm start
```

## 🛠️ Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first styling
- **Zustand** - State management
- **Socket.IO Client** - Real-time communication
- **mediasoup-client** - WebRTC client

### Backend
- **Express.js** - Web framework
- **TypeScript** - Type safety
- **Prisma** - Database ORM
- **Socket.IO** - Real-time events
- **mediasoup** - WebRTC SFU server
- **OpenAI** - AI transcription and summarization

### Infrastructure
- **PostgreSQL** - Primary database
- **Redis** - Caching and pub/sub
- **MinIO/S3** - Object storage
- **FFmpeg** - Video processing

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 🙏 Acknowledgments

- [mediasoup](https://mediasoup.org/) - Powerful WebRTC SFU
- [OpenAI](https://openai.com/) - AI capabilities
- [Vercel](https://vercel.com/) - Next.js framework

---

Made with ❤️ by the ChatVista Team
