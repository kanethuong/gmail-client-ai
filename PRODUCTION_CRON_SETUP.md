# Production Cron Setup for Vercel

## Option 1: Vercel Cron Functions (Recommended - Pro Plan Required)

### Setup Steps:

1. **Configure vercel.json** (✅ Already done)
   ```json
   {
     "crons": [
       {
         "path": "/api/sync/scheduled",
         "schedule": "*/30 * * * *"
       }
     ]
   }
   ```

2. **Deploy to Vercel Pro**
   ```bash
   vercel --prod
   ```

3. **Environment Variables** (Set in Vercel Dashboard)
   ```
   SCHEDULED_SYNC_ENABLED=true
   SYNC_INTERVAL_MINUTES=30
   CRON_SECRET=your-secure-secret-key
   ```

4. **Verify Setup**
   - Check Vercel Dashboard > Functions > Crons
   - Monitor execution in Function logs

---

## Option 2: GitHub Actions (Free Alternative)

### Setup Steps:

1. **Configure GitHub Secrets** (Go to repo Settings > Secrets and variables > Actions)
   ```
   CRON_SECRET=your-secure-secret-key
   APP_URL=https://your-app.vercel.app
   ```

2. **GitHub Action** (✅ Already created: `.github/workflows/scheduled-sync.yml`)

3. **Enable Actions**
   - Go to repo > Actions tab
   - Enable workflows if needed

4. **Monitor**
   - Check Actions tab for execution history
   - View logs for debugging

---

## Option 3: Cron-job.org (Free External Service)

### Setup Steps:

1. **Create Account** at https://cron-job.org

2. **Create Cron Job**
   - URL: `https://your-app.vercel.app/api/sync/scheduled`
   - Schedule: `*/30 * * * *` (every 30 minutes)
   - Method: POST
   - Headers: `Authorization: Bearer your-secret-key`

3. **Configure Request**
   ```
   URL: https://your-app.vercel.app/api/sync/scheduled
   Method: POST
   Headers:
     Authorization: Bearer your-secret-key
     Content-Type: application/json
   Schedule: */30 * * * *
   ```

---

## Option 4: EasyCron (Alternative External Service)

### Setup Steps:

1. **Create Account** at https://www.easycron.com

2. **Create Cron Job**
   - URL: `https://your-app.vercel.app/api/sync/scheduled`
   - Schedule: Every 30 minutes
   - HTTP Method: POST
   - Headers: `Authorization: Bearer your-secret-key`

---

## Environment Variables for Production

Set these in your Vercel Dashboard (Project Settings > Environment Variables):

```bash
# Database
DATABASE_URL=your-production-database-url

# OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=https://your-app.vercel.app

# AWS S3
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=your-aws-region
S3_BUCKET_NAME=your-s3-bucket

# Redis (optional)
REDIS_URL=your-redis-url

# AI Service
GEMINI_API_KEY=your-gemini-api-key

# Scheduled Sync
SCHEDULED_SYNC_ENABLED=true
SYNC_INTERVAL_MINUTES=30
CRON_SECRET=your-secure-secret-key-change-this
```

---

## Testing Production Setup

### 1. Manual Test

```bash
curl -X POST \
  -H "Authorization: Bearer your-secret-key" \
  -H "Content-Type: application/json" \
  "https://your-app.vercel.app/api/sync/scheduled"
```

### 2. Check Status

```bash
curl "https://your-app.vercel.app/api/sync/status"
```

### 3. Monitor Logs

- **Vercel**: Dashboard > Functions > View logs
- **GitHub Actions**: Repository > Actions tab
- **External Services**: Check their respective dashboards

---

## Monitoring & Maintenance

### Health Checks

1. **API Status Endpoint**
   ```
   GET https://your-app.vercel.app/api/sync/status
   ```

2. **Sync Panel UI**
   - Login to your app
   - Navigate to sync panel
   - Check "Scheduled Sync" section

### Troubleshooting

1. **Check Environment Variables**
   - Verify all required env vars are set in Vercel
   - Ensure CRON_SECRET matches between service and app

2. **Verify Permissions**
   - Check OAuth tokens are valid
   - Verify database connectivity
   - Test Gmail API access

3. **Monitor Quotas**
   - Gmail API quota limits
   - Database connection limits
   - Vercel function execution limits

---

## Recommendations

### For Production:

1. **Vercel Pro Plan**: Use Vercel Cron Functions for seamless integration
2. **Free Plan**: Use GitHub Actions for reliable, free scheduling
3. **Backup**: Setup external service (cron-job.org) as backup

### Security:

1. Use strong, unique CRON_SECRET
2. Monitor API access logs
3. Set up alerts for failed syncs
4. Regularly rotate secrets

### Performance:

1. Adjust SYNC_INTERVAL_MINUTES based on user count
2. Monitor execution time and optimize if needed
3. Consider user timezone distribution for optimal scheduling