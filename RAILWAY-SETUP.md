# Railway Deployment Guide

Deploy the Telegram bot to Railway in 5 minutes.

## 1. Create a Railway Account
- Go to https://railway.app
- Sign up with GitHub (fastest)

## 2. Create a New Project
- Click "New Project"
- Select "Deploy from GitHub"
- Authorize Railway to access your GitHub repos
- Select `asaasinai/relationship-manager`

## 3. Add PostgreSQL
- In the Railway dashboard, click "Add Service"
- Select "PostgreSQL"
- The DATABASE_URL will be automatically set

## 4. Set Environment Variables
Click on your project → Variables, then add:

```
TELEGRAM_BOT_TOKEN=8715951186:AAH7vv9aTHtMDQh2N__uMUZpX1n23WkGPB8
ANTHROPIC_API_KEY=sk-ant-v7-_N3vWmhVXG4VmQxlQnMqaIw72w5Y3gF-jQ6nWaQn7g6TUjlYP1VaFIK7dUBN8eaH9yGQsV9dJYL8X-2u9dMaWg
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=noreply@example.com
NEXT_PUBLIC_APP_URL=https://your-vercel-domain.vercel.app
ALERT_CHECK_HOUR=6
```

## 5. Deploy
- Railway auto-deploys from GitHub pushes
- Watch the deployment logs in the Railway dashboard
- Once deployed, the bot will start responding to t.me/Fambam123_bot

## 6. Database Migration
First deployment might need schema setup:

```bash
npx prisma migrate deploy
```

Or Railway can run it automatically via build command. Check the logs.

## Monitoring
- View logs: Click the service → Logs tab
- Bot logs show `🤖 Telegram bot started (NLP mode with duplicate detection)...`
- Watch for alerts being sent daily at 6 UTC

## Troubleshooting

**Bot not responding:**
1. Check Railway logs for errors
2. Verify TELEGRAM_BOT_TOKEN is correct
3. Confirm DATABASE_URL is set

**Database errors:**
1. Ensure PostgreSQL service is running
2. Run migrations manually if needed
3. Check if schema exists: `npx prisma db push`

**Email alerts not sending:**
1. Verify SMTP credentials
2. Check spam folder
3. Gmail may need "App Password" (not regular password)
