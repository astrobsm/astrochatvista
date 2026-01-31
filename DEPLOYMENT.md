# ChatVista Deployment Guide

## Architecture Overview

ChatVista uses a distributed deployment architecture:

- **Frontend**: Deployed on **Vercel** (Next.js app)
- **Backend API**: Deployed on **DigitalOcean App Platform**
- **Database**: **DigitalOcean Managed PostgreSQL**
- **Cache**: **DigitalOcean Managed Redis** (optional)
- **Recordings**: Stored **locally on user's device** (IndexedDB)

```
┌─────────────────────────────────────────────────────────────────┐
│                         Users                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Vercel (Frontend)                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Next.js App (chatvista-frontend)                        │    │
│  │  - PWA Support                                           │    │
│  │  - Local Recording Storage (IndexedDB)                   │    │
│  │  - WebRTC Video Calls                                    │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ API Requests
┌─────────────────────────────────────────────────────────────────┐
│              DigitalOcean App Platform (Backend)                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Express.js API (chatvista-api)                          │    │
│  │  - Authentication                                        │    │
│  │  - Meeting Management                                    │    │
│  │  - User Management                                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────┐  ┌──────────────────────────────┐    │
│  │  Managed PostgreSQL  │  │  Managed Redis (optional)     │    │
│  │  - User Data         │  │  - Session Cache              │    │
│  │  - Meeting Metadata  │  │  - Rate Limiting              │    │
│  └──────────────────────┘  └──────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

1. [GitHub account](https://github.com) with your repository
2. [Vercel account](https://vercel.com)
3. [DigitalOcean account](https://digitalocean.com)
4. [DigitalOcean CLI (doctl)](https://docs.digitalocean.com/reference/doctl/how-to/install/)

---

## Part 1: Deploy Backend on DigitalOcean

### Step 1: Create PostgreSQL Database

1. Go to [DigitalOcean Databases](https://cloud.digitalocean.com/databases)
2. Click **Create Database Cluster**
3. Choose:
   - **Engine**: PostgreSQL 16
   - **Size**: Basic ($15/month for production, or Dev Database $7/month for testing)
   - **Region**: Choose closest to your users
   - **Name**: `chatvista-db`
4. Click **Create Database Cluster**
5. Wait for provisioning (~5 minutes)
6. Copy the **Connection String** from the dashboard

### Step 2: Create Redis Cache (Optional but Recommended)

1. Go to [DigitalOcean Databases](https://cloud.digitalocean.com/databases)
2. Click **Create Database Cluster**
3. Choose:
   - **Engine**: Redis
   - **Size**: Basic ($15/month)
   - **Region**: Same as PostgreSQL
   - **Name**: `chatvista-redis`
4. Copy the **Connection String** (starts with `rediss://`)

### Step 3: Deploy Backend App

#### Option A: Using DigitalOcean Dashboard

1. Go to [DigitalOcean Apps](https://cloud.digitalocean.com/apps)
2. Click **Create App**
3. Choose **GitHub** and authorize access
4. Select your repository: `astrobsm/astrochatvista`
5. Select branch: `main`
6. Configure build settings:
   - **Source Directory**: `/apps/backend`
   - **Dockerfile Path**: `apps/backend/Dockerfile`
7. Add Environment Variables:
   ```
   NODE_ENV=production
   PORT=4000
   DATABASE_URL=[Your PostgreSQL connection string]
   REDIS_URL=[Your Redis connection string]
   JWT_SECRET=[Generate with: openssl rand -base64 64]
   FRONTEND_URL=https://your-app.vercel.app
   CORS_ORIGINS=https://your-app.vercel.app
   ```
8. Click **Next** and **Create Resources**

#### Option B: Using doctl CLI

```bash
# Authenticate with DigitalOcean
doctl auth init

# Create app from spec file
doctl apps create --spec .do/app.yaml

# Set environment variables
doctl apps update <app-id> --spec .do/app.yaml
```

### Step 4: Run Database Migrations

After deployment, SSH into the app or use the console:

```bash
npx prisma migrate deploy
```

Or configure the startup command in Dockerfile (already included).

### Step 5: Get Your Backend URL

Your backend will be available at:
```
https://chatvista-backend-xxxxx.ondigitalocean.app
```

Note this URL for the frontend configuration.

---

## Part 2: Deploy Frontend on Vercel

### Step 1: Connect Repository

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **Add New Project**
3. Import your GitHub repository: `astrobsm/astrochatvista`
4. Configure project:
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/frontend`
   - **Build Command**: `pnpm build`
   - **Install Command**: `pnpm install`

### Step 2: Configure Environment Variables

Add these environment variables in Vercel Dashboard:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://your-backend.ondigitalocean.app/api/v1` |
| `NEXT_PUBLIC_WS_URL` | `wss://your-backend.ondigitalocean.app` |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` |
| `NEXT_PUBLIC_APP_NAME` | `ChatVista` |
| `NEXT_PUBLIC_STORAGE_MODE` | `local` |
| `NEXT_PUBLIC_ENABLE_PWA` | `true` |
| `NEXT_PUBLIC_ENABLE_LOCAL_RECORDINGS` | `true` |

### Step 3: Deploy

1. Click **Deploy**
2. Wait for build to complete (~2-3 minutes)
3. Your app is live at: `https://your-app.vercel.app`

### Step 4: Configure Custom Domain (Optional)

1. Go to **Settings** > **Domains**
2. Add your domain: `chatvista.yourdomain.com`
3. Follow DNS configuration instructions

---

## Part 3: Post-Deployment Configuration

### Update Backend CORS

After getting your Vercel URL, update the backend environment:

```bash
# DigitalOcean Dashboard > Apps > Your App > Settings > Environment
FRONTEND_URL=https://chatvista.vercel.app
CORS_ORIGINS=https://chatvista.vercel.app,https://your-custom-domain.com
```

### Update Vercel API Rewrites

In `apps/frontend/vercel.json`, update the API rewrite:

```json
{
  "rewrites": [
    {
      "source": "/api/v1/:path*",
      "destination": "https://your-backend.ondigitalocean.app/api/v1/:path*"
    }
  ]
}
```

Commit and push to trigger redeploy.

---

## Recording Storage

### How It Works

ChatVista stores meeting recordings **locally on the user's device** using IndexedDB:

1. **No Cloud Upload**: Recordings never leave the user's device
2. **Privacy First**: Users have full control over their recordings
3. **Offline Access**: Recordings are available even without internet
4. **Export Options**: Users can download recordings as files

### Technical Details

- **Storage**: IndexedDB in browser
- **Format**: WebM (video/audio)
- **Limit**: Browser storage quota (typically 50% of free disk space)

### Usage in App

```typescript
import { useLocalRecordings } from '@/hooks/useLocalRecordings';

function RecordingsPage() {
  const { recordings, saveRecording, deleteRecording } = useLocalRecordings({
    userId: user.id
  });
  
  // Save a new recording
  await saveRecording({
    meetingId: 'meeting-123',
    userId: user.id,
    title: 'Team Standup',
    blob: recordingBlob,
    duration: 300, // seconds
  });
}
```

---

## Monitoring & Maintenance

### DigitalOcean Monitoring

1. Go to **Apps** > **Your App** > **Insights**
2. Monitor:
   - CPU & Memory usage
   - HTTP response times
   - Error rates

### Vercel Analytics

1. Go to **Your Project** > **Analytics**
2. Monitor:
   - Web Vitals (LCP, FID, CLS)
   - Page views
   - Geographic distribution

### Logs

**Backend Logs (DigitalOcean)**:
```bash
doctl apps logs <app-id> --follow
```

**Frontend Logs (Vercel)**:
- View in Vercel Dashboard > Logs

---

## Troubleshooting

### Common Issues

#### 1. CORS Errors
- Ensure `CORS_ORIGINS` in backend includes your frontend URL
- Check for trailing slashes (remove them)

#### 2. Database Connection Failed
- Verify `DATABASE_URL` is correct
- Check if IP is whitelisted in DO database settings

#### 3. Recordings Not Saving
- Check browser IndexedDB quota
- Ensure user has granted storage permissions

#### 4. WebRTC Issues
- Verify STUN/TURN server configuration
- Check browser camera/microphone permissions

---

## Cost Estimate

| Service | Size | Monthly Cost |
|---------|------|--------------|
| DigitalOcean App Platform | Basic (1 vCPU, 512MB) | $5 |
| DigitalOcean PostgreSQL | Basic (1 vCPU, 1GB) | $15 |
| DigitalOcean Redis | Basic | $15 |
| Vercel | Hobby/Pro | $0-20 |
| **Total** | | **$35-55/month** |

*Prices as of 2025. Check current pricing on provider websites.*

---

## Security Checklist

- [ ] Generate strong JWT_SECRET (64+ characters)
- [ ] Enable SSL on all endpoints
- [ ] Configure proper CORS origins
- [ ] Set up rate limiting
- [ ] Enable database connection encryption (sslmode=require)
- [ ] Use environment variables for all secrets
- [ ] Enable 2FA on DigitalOcean and Vercel accounts

---

## Support

For issues or questions:
- Open an issue on [GitHub](https://github.com/astrobsm/astrochatvista/issues)
- Check [DigitalOcean Docs](https://docs.digitalocean.com)
- Check [Vercel Docs](https://vercel.com/docs)
