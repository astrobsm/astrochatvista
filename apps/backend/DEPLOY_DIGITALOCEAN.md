# ChatVista Backend - Digital Ocean Deployment Guide

## Overview

This guide covers deploying the ChatVista backend to Digital Ocean App Platform with:
- Managed PostgreSQL database
- Managed Redis for caching/sessions
- Digital Ocean Spaces for cloud storage
- Automatic deployments from Git

## Prerequisites

1. **Digital Ocean Account**: https://cloud.digitalocean.com
2. **doctl CLI**: `brew install doctl` or [download](https://docs.digitalocean.com/reference/doctl/how-to/install/)
3. **Git repository** with ChatVista code pushed

## Quick Deploy

```bash
# Authenticate with Digital Ocean
doctl auth init

# Create the app from spec
doctl apps create --spec .do/app.yaml

# Set secret environment variables
doctl apps update <app-id> --spec .do/app.yaml
```

## Step-by-Step Deployment

### 1. Create Digital Ocean Spaces

1. Go to **Spaces Object Storage** in DO dashboard
2. Create a new Space:
   - **Name**: `chatvista-storage`
   - **Region**: NYC3 (or your preferred region)
   - **CDN**: Enable for better performance
3. Create Spaces Access Keys:
   - Go to **API** → **Spaces Access Keys**
   - Generate new key, save both Key and Secret

### 2. Create Managed Database (PostgreSQL)

1. Go to **Databases** → **Create Database Cluster**
2. Choose:
   - **Engine**: PostgreSQL 16
   - **Plan**: Basic ($15/mo for dev, Professional for prod)
   - **Datacenter**: Same as app region
3. Note the connection string (DATABASE_URL)

### 3. Create Managed Redis

1. Go to **Databases** → **Create Database Cluster**
2. Choose:
   - **Engine**: Redis 7
   - **Plan**: Basic ($15/mo)
   - **Datacenter**: Same as app region
3. Note the connection string (REDIS_URL)

### 4. Configure Environment Variables

Create a `.env.production` file (do not commit):

```env
# Database
DATABASE_URL=postgresql://user:password@host:25060/defaultdb?sslmode=require

# Redis
REDIS_URL=rediss://default:password@host:25061

# JWT (generate with: openssl rand -hex 32)
JWT_SECRET=your-64-char-hex-secret
JWT_REFRESH_SECRET=your-64-char-hex-secret
SESSION_SECRET=your-64-char-hex-secret

# Encryption (generate with: openssl rand -hex 32)
ENCRYPTION_KEY=your-64-char-hex-key
SIGNING_KEY=your-64-char-hex-key

# Digital Ocean Spaces
DO_SPACES_ENDPOINT=https://nyc3.digitaloceanspaces.com
DO_SPACES_REGION=nyc3
DO_SPACES_BUCKET=chatvista-storage
DO_SPACES_ACCESS_KEY=your-spaces-access-key
DO_SPACES_SECRET_KEY=your-spaces-secret-key
DO_SPACES_CDN_ENDPOINT=https://chatvista-storage.nyc3.cdn.digitaloceanspaces.com

# Frontend URL (for CORS)
CORS_ORIGINS=https://your-frontend.vercel.app

# OpenAI (optional, for AI features)
OPENAI_API_KEY=sk-your-openai-key

# SMTP (for emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

### 5. Run Database Migrations

```bash
# Set DATABASE_URL
export DATABASE_URL="postgresql://..."

# Run migrations
cd apps/backend
pnpm db:migrate

# Seed database (optional)
pnpm db:seed
```

### 6. Deploy via App Platform

#### Option A: Using doctl CLI

```bash
# Create app
doctl apps create --spec .do/app.yaml

# Get app ID
doctl apps list

# Update with secrets
doctl apps update <app-id> \
  --env JWT_SECRET=... \
  --env JWT_REFRESH_SECRET=... \
  --env ENCRYPTION_KEY=...
```

#### Option B: Using Dashboard

1. Go to **Apps** → **Create App**
2. Select your GitHub repo
3. Choose `apps/backend` as source directory
4. Configure environment variables
5. Select database add-ons
6. Deploy

## Storage Architecture

ChatVista uses a dual-storage strategy:

### Local Storage (Device)
- **Location**: `/app/storage/` in container
- **Purpose**: Fast access, temporary files, backup
- **Structure**:
  ```
  /app/storage/
  ├── recordings/      # Meeting recordings
  ├── transcripts/     # AI transcriptions
  ├── minutes/         # Meeting minutes
  ├── exports/         # PDF/DOCX exports
  ├── avatars/         # User avatars
  ├── backup/
  │   ├── daily/       # Daily backups
  │   ├── weekly/      # Weekly backups
  │   └── monthly/     # Monthly backups
  ├── archive/         # Soft-deleted files
  └── temp/            # Temporary processing
  ```

### Cloud Storage (Digital Ocean Spaces)
- **Location**: S3-compatible object storage
- **Purpose**: Persistent storage, CDN delivery, cross-region access
- **Features**:
  - Automatic sync from local storage
  - Presigned URLs for secure access
  - CDN for fast global delivery
  - 99.99% durability

### Backup Strategy

1. **Immediate**: Files saved locally and synced to cloud
2. **Daily**: Local backup of all new files
3. **Weekly**: Full backup consolidation
4. **Monthly**: Archive backup for compliance
5. **Retention**: 30 days for daily, 90 days for weekly, 1 year for monthly

## Scaling

### Vertical Scaling
Increase instance size in `.do/app.yaml`:
- `professional-xs`: 1 vCPU, 1GB RAM
- `professional-s`: 1 vCPU, 2GB RAM
- `professional-m`: 2 vCPUs, 4GB RAM
- `professional-l`: 4 vCPUs, 8GB RAM

### Horizontal Scaling
Increase `instance_count` for load balancing:
```yaml
instance_count: 3
```

### Database Scaling
Upgrade database plan as needed:
- Dev: $15/mo (1 vCPU, 1GB)
- Basic: $60/mo (2 vCPUs, 4GB)
- Pro: $150/mo (4 vCPUs, 8GB)

## Monitoring

### Built-in Monitoring
- CPU/Memory usage in DO dashboard
- Request metrics
- Error rates

### Custom Health Endpoint
```
GET /health
```
Returns:
```json
{
  "status": "healthy",
  "database": "connected",
  "redis": "connected",
  "storage": {
    "local": "available",
    "cloud": "connected"
  },
  "version": "1.0.0"
}
```

## Troubleshooting

### Database Connection Issues
```bash
# Test connection
doctl databases connection <db-id> --format ConnectionStrings

# Check logs
doctl apps logs <app-id> --type run
```

### Storage Issues
```bash
# Test Spaces connection
aws s3 ls s3://chatvista-storage \
  --endpoint-url https://nyc3.digitaloceanspaces.com
```

### Common Errors

| Error | Solution |
|-------|----------|
| `ECONNREFUSED` | Check DATABASE_URL is correct |
| `Invalid Spaces credentials` | Verify DO_SPACES_ACCESS_KEY |
| `CORS error` | Update CORS_ORIGINS env var |
| `Build failed` | Check pnpm-lock.yaml is committed |

## Cost Estimate

| Resource | Monthly Cost |
|----------|--------------|
| App Platform (professional-xs) | $12 |
| PostgreSQL (basic) | $15 |
| Redis (basic) | $15 |
| Spaces (250GB) | $5 |
| CDN | $0.02/GB |
| **Total** | ~$47/month |

## Security Checklist

- [ ] All secrets stored as encrypted env vars
- [ ] Database SSL enabled
- [ ] Redis TLS enabled
- [ ] Spaces private by default
- [ ] CORS configured for frontend only
- [ ] Rate limiting enabled
- [ ] Audit logging enabled
