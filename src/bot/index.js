require('dotenv').config();
const { Telegraf } = require('telegraf');
const { PrismaClient } = require('@prisma/client');
const { Anthropic } = require('@anthropic-ai/sdk');
const nodemailer = require('nodemailer');
const { parseISO, parse, isValid } = require('date-fns');

const prisma = new PrismaClient();
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Email transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Parse natural language text to extract people
async function parseNaturalLanguage(text) {
  const prompt = `You are a data extraction assistant. Parse the following text and extract all people mentioned with their relationship and birthdate/anniversary if mentioned.

Return a JSON array with objects like:
[
  { "name": "Tyler Morris", "relation": "brother", "date": "1990-02-15", "type": "birthday" },
  { "name": "Mom", "relation": "mother", "date": "1960-12-10", "type": "birthday" }
]

Important:
- Extract all people mentioned, even if just first name
- Infer relationship if possible (e.g., "my brother" → relation: "brother")
- Dates should be YYYY-MM-DD format (assume current year if not specified, or infer from context)
- Type can be "birthday" or "anniversary"
- Return empty array if no people found
- Return ONLY the JSON array, no other text

Text to parse:
"${text}"`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const responseText = message.content[0].text.trim();
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('LLM parsing error:', err.message);
    return [];
  }
}

// Helper: Parse date string flexibly
function parseFlexibleDate(dateStr) {
  if (!dateStr) return null;

  // Try ISO format
  let date = parseISO(dateStr);
  if (isValid(date)) return date;

  // Try common formats
  const formats = [
    'yyyy-MM-dd',
    'MM/dd',
    'MM-dd',
    'MMM dd',
    'MMMM dd',
  ];

  for (const fmt of formats) {
    date = parse(dateStr, fmt, new Date());
    if (isValid(date)) {
      // If no year provided, set to current year
      if (!dateStr.includes('20') && !dateStr.includes('19')) {
        date.setFullYear(new Date().getFullYear());
      }
      return date;
    }
  }

  return null;
}

// /start - Register user
bot.start(async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const username = ctx.from.username || ctx.from.first_name;

  try {
    let user = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: `tg_${telegramId}@telegram.local`,
          telegramId,
        },
      });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const loginUrl = `${appUrl}?telegramId=${telegramId}&userId=${user.id}`;

    ctx.reply(
      `👋 Hey ${username}!\n\n` +
      `I'm your Relationship Manager. Just chat with me naturally:\n\n` +
      `📝 Examples:\n` +
      `"Add Tyler brother Feb 15"\n` +
      `"My mom's birthday is Dec 10"\n` +
      `"Add Sarah friend, John brother, Mom mother May 3"\n` +
      `"Show upcoming events"\n\n` +
      `Or use commands:\n` +
      `/upcoming - View next 30 days\n` +
      `/help - Full command list`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    console.error(err);
    ctx.reply('❌ Error registering. Please try again.');
  }
});

// /upcoming - Show next 30 days
bot.command('upcoming', async (ctx) => {
  const telegramId = ctx.from.id.toString();

  try {
    const user = await prisma.user.findUnique({
      where: { telegramId },
      include: { relationships: { include: { customDates: true } } },
    });

    if (!user) {
      return ctx.reply('👤 Please use /start first to register.');
    }

    const events = [];
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    user.relationships.forEach((rel) => {
      if (rel.birthDate) {
        const bd = new Date(rel.birthDate);
        const bday = new Date(now.getFullYear(), bd.getMonth(), bd.getDate());
        if (bday < now) bday.setFullYear(now.getFullYear() + 1);
        if (bday <= thirtyDaysFromNow) {
          const age = now.getFullYear() - bd.getFullYear();
          events.push({
            date: bday,
            text: `🎂 ${rel.name} (${rel.relation}) - Birthday (${age})`,
          });
        }
      }

      if (rel.anniversary) {
        const an = new Date(rel.anniversary);
        const anniv = new Date(now.getFullYear(), an.getMonth(), an.getDate());
        if (anniv < now) anniv.setFullYear(now.getFullYear() + 1);
        if (anniv <= thirtyDaysFromNow) {
          events.push({
            date: anniv,
            text: `💑 ${rel.name} (${rel.relation}) - Anniversary`,
          });
        }
      }

      rel.customDates.forEach((cd) => {
        if (cd.isAnnual) {
          const c = new Date(cd.date);
          const custom = new Date(now.getFullYear(), c.getMonth(), c.getDate());
          if (custom < now) custom.setFullYear(now.getFullYear() + 1);
          if (custom <= thirtyDaysFromNow) {
            events.push({
              date: custom,
              text: `📌 ${rel.name} - ${cd.title}`,
            });
          }
        }
      });
    });

    if (events.length === 0) {
      return ctx.reply('📭 No events in the next 30 days.');
    }

    events.sort((a, b) => a.date - b.date);

    let message = '📅 *Upcoming Events (Next 30 Days)*\n\n';
    events.forEach((e) => {
      const days = Math.ceil((e.date - now) / (1000 * 60 * 60 * 24));
      message += `${e.text}\n_${e.date.toLocaleDateString()} (in ${days} day${days !== 1 ? 's' : ''})_\n\n`;
    });

    ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error(err);
    ctx.reply('❌ Error fetching events.');
  }
});

// /help
bot.command('help', (ctx) => {
  ctx.reply(
    `*Chat Mode*\n\n` +
    `Just type naturally!\n` +
    `"Add my brother Tyler, birthday Feb 15"\n` +
    `"Mom's birthday is May 3"\n` +
    `"Add Sarah (friend), John (brother), Dad (father) Jan 5"\n\n` +
    `*Commands*\n` +
    `/upcoming - View events (next 30 days)\n` +
    `/start - Register\n` +
    `/help - Show this`,
    { parse_mode: 'Markdown' }
  );
});

// Handle all text messages (natural language)
bot.on('text', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const text = ctx.message.text;

  // Skip if it's a command
  if (text.startsWith('/')) {
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      return ctx.reply('👤 Please use /start first to register.');
    }

    // Show typing indicator
    await ctx.sendChatAction('typing');

    // Parse natural language
    const people = await parseNaturalLanguage(text);

    if (people.length === 0) {
      return ctx.reply('❓ I didn\'t find any people to add. Try: "Add John brother May 15" or "My mom\'s birthday is Dec 10"');
    }

    // Add all parsed people
    const results = [];
    for (const person of people) {
      try {
        const birthDate = person.date ? parseFlexibleDate(person.date) : null;

        const rel = await prisma.relationship.create({
          data: {
            userId: user.id,
            name: person.name,
            relation: person.relation || 'friend',
            birthDate: birthDate && isValid(birthDate) ? birthDate : null,
          },
        });

        const dateStr = birthDate && isValid(birthDate) ? birthDate.toLocaleDateString() : 'no date';
        results.push(`✅ ${person.name} (${person.relation || 'friend'}) - ${dateStr}`);
      } catch (err) {
        console.error(`Error adding ${person.name}:`, err.message);
        results.push(`❌ ${person.name} - error`);
      }
    }

    const message = results.length > 0
      ? `Added ${people.length} person${people.length !== 1 ? 's' : ''}:\n\n${results.join('\n')}`
      : '❌ No people were added.';

    ctx.reply(message);
  } catch (err) {
    console.error(err);
    ctx.reply('❌ Error processing message. Please try again.');
  }
});

// Handle errors
bot.catch((err, ctx) => {
  console.error(err);
  ctx.reply('❌ Something went wrong. Please try again.');
});

// Start bot
bot.launch();

console.log('🤖 Telegram bot started (NLP mode)...');

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// Alert scheduler (runs in background)
const alertScheduler = require('./alertScheduler');
alertScheduler.start();
