# ChatVista Frontend - Vercel Deployment

## Quick Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/chatvista&env=NEXTAUTH_SECRET,NEXTAUTH_URL,NEXT_PUBLIC_API_URL&project-name=chatvista-frontend&root-directory=apps/frontend)

## Manual Deployment Steps

### 1. Prerequisites
- Vercel account (https://vercel.com)
- GitHub/GitLab/Bitbucket repository with ChatVista code
- Backend API already deployed (Digital Ocean)

### 2. Connect Repository
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import your Git repository
4. Select `apps/frontend` as the Root Directory

### 3. Configure Build Settings
- **Framework Preset**: Next.js
- **Build Command**: `pnpm build`
- **Install Command**: `pnpm install`
- **Output Directory**: `.next`

### 4. Environment Variables

Add these environment variables in Vercel dashboard:

```env
# Application
NEXT_PUBLIC_APP_NAME=ChatVista
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
NEXT_PUBLIC_API_URL=https://api.your-domain.com

# WebSocket
NEXT_PUBLIC_WS_URL=wss://api.your-domain.com

# NextAuth
NEXTAUTH_URL=https://your-domain.vercel.app
NEXTAUTH_SECRET=your-secure-secret-key-here

# Features
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_E2E_ENCRYPTION=true
```

### 5. Domain Configuration
1. Go to Project Settings > Domains
2. Add your custom domain
3. Configure DNS records as shown

### 6. Production Checklist

- [ ] Set correct `NEXT_PUBLIC_API_URL` to Digital Ocean backend
- [ ] Generate strong `NEXTAUTH_SECRET` (use `openssl rand -hex 32`)
- [ ] Configure CORS on backend to allow Vercel domain
- [ ] Enable Vercel Analytics (optional)
- [ ] Set up Vercel Speed Insights (optional)
- [ ] Configure preview deployments

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_APP_NAME` | No | Application name (default: ChatVista) |
| `NEXT_PUBLIC_APP_URL` | Yes | Frontend URL |
| `NEXT_PUBLIC_API_URL` | Yes | Backend API URL |
| `NEXT_PUBLIC_WS_URL` | Yes | WebSocket URL |
| `NEXTAUTH_URL` | Yes | NextAuth callback URL |
| `NEXTAUTH_SECRET` | Yes | NextAuth encryption secret |

## Monorepo Configuration

This project uses pnpm workspaces. Vercel handles this automatically when you:

1. Set Root Directory to `apps/frontend`
2. Use `pnpm install` as install command
3. The `vercel.json` file configures the rest

## Troubleshooting

### Build Failures
- Ensure all environment variables are set
- Check that `@chatvista/types` package builds correctly
- Run `pnpm build` locally first

### API Connection Issues
- Verify `NEXT_PUBLIC_API_URL` is correct
- Check CORS configuration on backend
- Ensure backend is running and accessible

### WebSocket Connection Issues
- Use `wss://` for production
- Ensure backend supports WebSocket upgrades
- Check firewall/proxy settings
