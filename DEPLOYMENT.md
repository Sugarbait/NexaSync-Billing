# Deployment Guide - NexaSync Billing

This guide covers deploying the NexaSync Billing platform to production.

## Pre-Deployment Checklist

### Code Preparation
- [ ] All code reviewed and tested
- [ ] Cost services integrated with CareXPS
- [ ] Authentication and MFA implemented
- [ ] Environment variables configured
- [ ] Database migrations tested
- [ ] Build succeeds locally (`npm run build`)

### Security Verification
- [ ] RLS policies active on all tables
- [ ] MFA middleware implemented
- [ ] API keys encrypted
- [ ] No PHI data in system
- [ ] Audit logging configured
- [ ] Rate limiting added

### Testing
- [ ] All features tested in dev
- [ ] Invoice generation verified with test data
- [ ] Stripe integration tested in test mode
- [ ] Mobile responsiveness verified
- [ ] Error handling tested

## Deployment Options

### Option 1: Vercel (Recommended)

Vercel is the easiest deployment option for Next.js applications.

#### Steps:

1. **Install Vercel CLI**:
```bash
npm install -g vercel
```

2. **Login to Vercel**:
```bash
vercel login
```

3. **Deploy**:
```bash
cd nexasync-billing
vercel
```

4. **Configure Environment Variables** in Vercel Dashboard:
   - Go to Project Settings > Environment Variables
   - Add all variables from `.env.local`

5. **Configure Production Domain**:
   - Go to Domains in project settings
   - Add your custom domain (e.g., billing.nexasync.com)

#### Vercel Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL=your_production_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE=pk_live_...
NEXT_PUBLIC_APP_URL=https://billing.nexasync.com
```

### Option 2: Azure Static Web Apps

If you're already on Azure with CareXPS:

#### Steps:

1. **Create Azure Static Web App**:
```bash
az staticwebapp create \
  --name nexasync-billing \
  --resource-group your-resource-group \
  --source . \
  --location eastus2 \
  --branch main
```

2. **Configure Build**:
Create `staticwebapp.config.json`:
```json
{
  "routes": [
    {
      "route": "/*",
      "allowedRoles": ["authenticated"]
    }
  ],
  "navigationFallback": {
    "rewrite": "/index.html"
  },
  "platform": {
    "apiRuntime": "node:18"
  }
}
```

3. **Set Environment Variables** in Azure Portal:
   - Go to Configuration > Application Settings
   - Add all environment variables

4. **Deploy**:
```bash
npm run build
az staticwebapp deploy
```

### Option 3: Docker + Any Cloud

For AWS, GCP, or any Docker-based deployment:

#### Create Dockerfile:

```dockerfile
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
```

#### Build and Deploy:

```bash
docker build -t nexasync-billing .
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=... \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
  nexasync-billing
```

## Database Deployment

### Supabase Production Setup

1. **Create Production Project**:
   - Go to https://app.supabase.com
   - Create new project for production
   - Note the URL and anon key

2. **Run Migrations**:
```sql
-- In Supabase SQL Editor, run:
-- supabase/migrations/20251001000001_create_billing_tables.sql
```

3. **Verify RLS Policies**:
   - Check all tables have RLS enabled
   - Test policies with test user

4. **Create Indexes**:
```sql
-- Verify indexes exist:
SELECT * FROM pg_indexes
WHERE tablename IN ('billing_customers', 'invoice_records', 'billing_settings');
```

5. **Set Up Realtime** (optional):
```sql
-- Enable realtime for invoice updates
ALTER PUBLICATION supabase_realtime ADD TABLE invoice_records;
```

## Stripe Production Setup

### Switch to Live Mode

1. **Get Live API Keys**:
   - Go to Stripe Dashboard > Developers > API keys
   - Copy "Publishable key" (starts with `pk_live_`)
   - Copy "Secret key" (starts with `sk_live_`)

2. **Update Environment Variables**:
```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE=pk_live_...
# Secret key entered in app Settings page
```

3. **Configure Webhooks** (for Phase 2):
   - Stripe Dashboard > Developers > Webhooks
   - Add endpoint: `https://your-domain.com/api/webhooks/stripe`
   - Select events:
     - `invoice.paid`
     - `invoice.payment_failed`
     - `invoice.finalized`

4. **Test in Live Mode**:
   - Create test customer
   - Generate test invoice
   - Verify invoice appears in Stripe Dashboard

## Post-Deployment Steps

### 1. Verify Application

```bash
# Check health
curl https://your-domain.com/

# Test API endpoint (if you add one)
curl https://your-domain.com/api/health
```

### 2. Configure DNS

```bash
# Add CNAME record
billing.nexasync.com -> your-deployment-url.vercel.app
```

### 3. SSL Certificate

- Vercel: Automatic
- Azure: Enable in Portal
- Docker: Use nginx reverse proxy with Let's Encrypt

### 4. Monitoring

#### Vercel:
- Built-in analytics available
- Check Logs tab for errors

#### Azure:
- Enable Application Insights
- Configure alerts for errors

#### Custom:
- Set up logging (Winston, Pino)
- Configure error tracking (Sentry)

### 5. Backups

```sql
-- Schedule automated Supabase backups
-- Supabase Pro plan includes daily backups
-- Download manual backup:
pg_dump -h db.xxxxx.supabase.co -U postgres billing_platform > backup.sql
```

## Performance Optimization

### 1. Caching

Add caching headers in `next.config.mjs`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/admin/billing/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-cache, no-store, must-revalidate',
          },
        ],
      },
    ]
  },
}

export default nextConfig
```

### 2. Image Optimization

```javascript
// next.config.mjs
const nextConfig = {
  images: {
    domains: ['your-cdn.com'],
    formats: ['image/avif', 'image/webp'],
  },
}
```

### 3. Database Connection Pooling

Use Supabase connection pooling:
```typescript
// lib/supabase.ts
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey, {
  db: {
    schema: 'public',
  },
  auth: {
    persistSession: true,
  },
  global: {
    headers: { 'x-connection-pool': 'true' },
  },
})
```

## Security Hardening

### 1. Add Security Headers

```javascript
// next.config.mjs
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ]
  },
}
```

### 2. Rate Limiting

Install rate limiting package:
```bash
npm install express-rate-limit
```

Create middleware for API routes:
```typescript
import rateLimit from 'express-rate-limit'

export const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
})
```

### 3. Environment Variable Security

Never commit:
- `.env.local`
- `.env.production`
- Any file with API keys

Always use:
- Platform environment variables (Vercel, Azure)
- Encrypted storage for secrets

## Rollback Plan

### Quick Rollback (Vercel)

```bash
# List deployments
vercel ls

# Rollback to previous
vercel rollback [deployment-url]
```

### Database Rollback

```sql
-- Restore from backup
psql -h db.xxxxx.supabase.co -U postgres -d billing_platform < backup.sql
```

### Emergency Maintenance Mode

Create `app/maintenance/page.tsx`:
```typescript
export default function Maintenance() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Maintenance Mode</h1>
        <p className="text-gray-600">We'll be back shortly</p>
      </div>
    </div>
  )
}
```

Redirect all traffic in production when needed.

## Monitoring & Alerts

### Set Up Alerts For:

1. **Application Errors**
   - 500 errors
   - Failed API calls
   - Database connection errors

2. **Business Metrics**
   - Failed invoice generation
   - Stripe API errors
   - Unusual billing amounts

3. **Performance**
   - Page load time > 3s
   - API response time > 1s
   - Database query time > 500ms

### Monitoring Tools

- **Vercel Analytics**: Built-in
- **Sentry**: Error tracking
- **LogRocket**: Session replay
- **Datadog**: Full monitoring

## Maintenance

### Regular Tasks

**Daily**:
- Check error logs
- Monitor invoice generation
- Review Stripe sync status

**Weekly**:
- Review database performance
- Check disk usage
- Update dependencies (security)

**Monthly**:
- Full backup verification
- Security audit
- Performance review
- Update documentation

## Support

### Escalation Path

1. **Application Issues** → Dev Team
2. **Database Issues** → Supabase Support
3. **Payment Issues** → Stripe Support
4. **Infrastructure** → Cloud Provider Support

### Documentation

Keep updated:
- API documentation
- Database schema docs
- Deployment runbook
- Incident response plan

---

## Production Launch Checklist

Final checks before going live:

- [ ] All tests passing
- [ ] Database migration successful
- [ ] Environment variables set
- [ ] Stripe live mode configured
- [ ] SSL certificate active
- [ ] Domain configured
- [ ] Monitoring enabled
- [ ] Backups scheduled
- [ ] Security headers active
- [ ] Rate limiting enabled
- [ ] Error tracking configured
- [ ] Team trained
- [ ] Documentation updated
- [ ] Rollback plan tested

**Ready to Deploy!** 🚀
