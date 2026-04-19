require('dotenv').config();
const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');
const { Telegraf } = require('telegraf');
const { addDays, startOfDay, endOfDay } = require('date-fns');

const prisma = new PrismaClient();
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function checkAndSendAlerts() {
  try {
    const now = new Date();
    const alertDate = addDays(now, 5); // Alert 5 days before each date
    const alertDateStart = startOfDay(alertDate);
    const alertDateEnd = endOfDay(alertDate);

    // Get all users
    const users = await prisma.user.findMany({
      include: { relationships: { include: { customDates: true } } },
    });

    for (const user of users) {
      const dailyDigest = [];
      const emailAlerts = [];
      const telegramAlerts = [];

      // Check each relationship for events
      user.relationships.forEach((rel) => {
        // Birthday
        if (user.trackBirthdays && rel.birthDate) {
          const bd = new Date(rel.birthDate);
          const bday = new Date(alertDate.getFullYear(), bd.getMonth(), bd.getDate());
          
          if (bday >= alertDateStart && bday <= alertDateEnd) {
            const age = alertDate.getFullYear() - bd.getFullYear();
            const daysUntil = Math.ceil((bday - now) / (1000 * 60 * 60 * 24));
            const eventTitle = `${rel.name}'s Birthday (${age}) in ${daysUntil} days`;
            emailAlerts.push(eventTitle);
            telegramAlerts.push(`🎂 ${eventTitle}`);
            dailyDigest.push(eventTitle);
          }
        }

        // Anniversary
        if (user.trackAnniversaries && rel.anniversary) {
          const an = new Date(rel.anniversary);
          const anniv = new Date(alertDate.getFullYear(), an.getMonth(), an.getDate());
          
          if (anniv >= alertDateStart && anniv <= alertDateEnd) {
            const daysUntil = Math.ceil((anniv - now) / (1000 * 60 * 60 * 24));
            const eventTitle = `${rel.name}'s Anniversary in ${daysUntil} days`;
            emailAlerts.push(eventTitle);
            telegramAlerts.push(`💑 ${eventTitle}`);
            dailyDigest.push(eventTitle);
          }
        }

        // Custom dates
        if (user.trackCustom) {
          rel.customDates.forEach((cd) => {
            if (cd.isAnnual) {
              const c = new Date(cd.date);
              const custom = new Date(alertDate.getFullYear(), c.getMonth(), c.getDate());
              
              if (custom >= alertDateStart && custom <= alertDateEnd) {
                const daysUntil = Math.ceil((custom - now) / (1000 * 60 * 60 * 24));
                const eventTitle = `${rel.name}'s ${cd.title} in ${daysUntil} days`;
                emailAlerts.push(eventTitle);
                telegramAlerts.push(`📌 ${eventTitle}`);
                dailyDigest.push(eventTitle);
              }
            }
          });
        }
      });

      // Send email alerts
      if (emailAlerts.length > 0 && user.alertEmail) {
        const emailBody = emailAlerts.map((e) => `• ${e}`).join('\n');

        try {
          await transporter.sendMail({
            from: process.env.SMTP_FROM,
            to: user.alertEmail,
            subject: `🎉 Reminder: ${emailAlerts.length} upcoming event${emailAlerts.length > 1 ? 's' : ''} in 5 days`,
            html: `
              <h2>📅 Upcoming Reminders</h2>
              <p>You have ${emailAlerts.length} event${emailAlerts.length > 1 ? 's' : ''} coming up in 5 days:</p>
              <ul>
                ${emailAlerts.map((e) => `<li>${e}</li>`).join('')}
              </ul>
              <p><a href="${process.env.NEXT_PUBLIC_APP_URL}">View in app</a></p>
            `,
          });

          // Update alert records
          for (const email of emailAlerts) {
            // This is a simplified record; in production, link to specific relationships
            await prisma.alert.create({
              data: {
                userId: user.id,
                relationshipId: user.relationships[0].id, // simplified
                eventType: 'reminder',
                eventDate: alertDate,
                eventTitle: email,
                sentViaEmail: true,
                sentAt: now,
              },
            });
          }
        } catch (err) {
          console.error(`Email error for user ${user.id}:`, err.message);
        }
      }

      // Send Telegram alerts
      if (telegramAlerts.length > 0 && user.telegramId) {
        try {
          const message = `🔔 *Reminder: ${telegramAlerts.length} event${telegramAlerts.length > 1 ? 's' : ''} in 5 days*\n\n${telegramAlerts.join('\n')}`;
          await bot.telegram.sendMessage(user.telegramId, message, { parse_mode: 'Markdown' });

          // Update alert records
          for (const alert of telegramAlerts) {
            await prisma.alert.create({
              data: {
                userId: user.id,
                relationshipId: user.relationships[0].id, // simplified
                eventType: 'reminder',
                eventDate: alertDate,
                eventTitle: alert,
                sentViaTelegram: true,
                sentAt: now,
              },
            });
          }
        } catch (err) {
          console.error(`Telegram error for user ${user.id}:`, err.message);
        }
      }
    }

    console.log(`✅ Alert check complete at ${now.toISOString()}`);
  } catch (err) {
    console.error('Alert scheduler error:', err);
  }
}

// Schedule alert check daily at specified hour
const alertHour = parseInt(process.env.ALERT_CHECK_HOUR || '6');
const cronExpression = `0 ${alertHour} * * *`; // Daily at specified hour

exports.start = function () {
  cron.schedule(cronExpression, checkAndSendAlerts);
  console.log(`⏰ Alert scheduler started (checks daily at ${alertHour}:00 UTC)`);

  // Also check on startup
  checkAndSendAlerts();
};
