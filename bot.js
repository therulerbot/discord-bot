require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent';
const rssParser = new Parser({ customFields: { item: [['media:content', 'media'], ['media:thumbnail', 'mediaThumbnail']] } });

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

const PREFIX = '!';
const COLORS = { primary: 0x00aaff, danger: 0xff3355, warning: 0xffaa00, info: 0x8888ff, xp: 0xf0c040, coins: 0xf4c430 };
const XP_FILE       = path.join(__dirname, 'data', 'xp.json');
const COINS_FILE    = path.join(__dirname, 'data', 'coins.json');
const RR_FILE       = path.join(__dirname, 'data', 'reaction-message.json');
const NEWS_FILE     = path.join(__dirname, 'data', 'news.json');
const XP_COOLDOWN   = 60000;
const COIN_COOLDOWN = 60000;
const xpCooldowns   = new Map();
const coinCooldowns = new Map();
const processedMessages = new Set();

// ─── Reaction Role Map ─────────────────────────────────────────────────────────
// Note: CS2 uses 💥 since 🔫 is already used by Battlefield
const REACTION_ROLE_MAP = {
  '🔫': '🔫 Battlefield',
  '🦀': '🦀 Rust',
  '🎯': '🎯 COD',
  '💥': '💥 CS2',
  '🪂': '🪂 PUBG',
  '🏎️': '🏎️ Forza',
};

// ─── Shop Items ────────────────────────────────────────────────────────────────
const SHOP_ITEMS = [
  { id: 'vip',      name: '⭐ VIP',      price: 1000, role: '⭐ VIP',      description: 'رتبة VIP الحصرية | Exclusive VIP role' },
  { id: 'gamer',    name: '🎮 Gamer',    price: 500,  role: '🎮 Gamer',    description: 'رتبة Gamer | Gamer role' },
  { id: 'active',   name: '💬 Active',   price: 300,  role: '💬 Active',   description: 'رتبة Active | Active role' },
  { id: 'rookie',   name: '🟢 Rookie',   price: 150,  role: '🟢 Rookie',   description: 'رتبة Rookie | Rookie role' },
  { id: 'supporter',name: '📢 Supporter',price: 400,  role: '📢 Supporter',description: 'رتبة Supporter | Supporter role' },
];

// ─── XP Helpers ────────────────────────────────────────────────────────────────

function loadXP() {
  try { return JSON.parse(fs.readFileSync(XP_FILE, 'utf8')); } catch { return {}; }
}
function saveXP(data) {
  fs.writeFileSync(XP_FILE, JSON.stringify(data, null, 2));
}
function xpForNextLevel(level) { return level * 100; }
function getXPUser(data, userId) {
  if (!data[userId]) data[userId] = { xp: 0, level: 0, messages: 0 };
  return data[userId];
}

async function addXP(message) {
  const userId = message.author.id;
  const now = Date.now();
  if (xpCooldowns.has(userId) && now - xpCooldowns.get(userId) < XP_COOLDOWN) return;
  xpCooldowns.set(userId, now);
  const data = loadXP();
  const user = getXPUser(data, userId);
  const earned = Math.floor(Math.random() * 16) + 10;
  user.xp += earned;
  user.messages += 1;
  const needed = xpForNextLevel(user.level + 1);
  if (user.xp >= needed) {
    user.xp -= needed;
    user.level += 1;
    saveXP(data);
    message.channel.send({ embeds: [new EmbedBuilder()
      .setColor(COLORS.xp)
      .setTitle('⬆️ ترقية مستوى! | Level Up!')
      .setDescription(`مبروك ${message.author}! وصلت للمستوى **${user.level}** 🎉\nCongrats ${message.author}! You reached level **${user.level}** 🎉`)
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .setTimestamp()] });
  } else {
    saveXP(data);
  }
}

// ─── Coins Helpers ─────────────────────────────────────────────────────────────

function loadCoins() {
  try { return JSON.parse(fs.readFileSync(COINS_FILE, 'utf8')); } catch { return {}; }
}
function saveCoins(data) {
  fs.writeFileSync(COINS_FILE, JSON.stringify(data, null, 2));
}
function getCoinsUser(data, userId) {
  if (!data[userId]) data[userId] = { coins: 0, lastDaily: 0 };
  return data[userId];
}

async function addCoins(message) {
  const userId = message.author.id;
  const now = Date.now();
  if (coinCooldowns.has(userId) && now - coinCooldowns.get(userId) < COIN_COOLDOWN) return;
  coinCooldowns.set(userId, now);
  const data = loadCoins();
  const user = getCoinsUser(data, userId);
  user.coins += Math.floor(Math.random() * 11) + 5; // 5–15
  saveCoins(data);
}

// ─── Stats Channels Auto-Update ───────────────────────────────────────────────

function startStatsUpdater(guild) {
  async function update() {
    await guild.members.fetch();
    const totalMembers = guild.memberCount;
    const onlineCount  = guild.members.cache.filter(m => !m.user.bot && m.presence?.status && m.presence.status !== 'offline').size;
    const botCount     = guild.members.cache.filter(m => m.user.bot).size;
    const memberCh = guild.channels.cache.find(c => c.name && c.name.startsWith('👥'));
    const onlineCh = guild.channels.cache.find(c => c.name && c.name.startsWith('🟢'));
    const botCh    = guild.channels.cache.find(c => c.name && c.name.startsWith('🤖'));
    if (memberCh) try { await memberCh.setName(`👥 الأعضاء: ${totalMembers}`); } catch (_) {}
    if (onlineCh) try { await onlineCh.setName(`🟢 أونلاين: ${onlineCount}`); } catch (_) {}
    if (botCh)    try { await botCh.setName(`🤖 البوتات: ${botCount}`); } catch (_) {}
  }
  update();
  setInterval(update, 10 * 60 * 1000);
}

// ─── Game News ────────────────────────────────────────────────────────────────

function loadNews() {
  try { return JSON.parse(fs.readFileSync(NEWS_FILE, 'utf8')); } catch { return {}; }
}
function saveNews(data) {
  fs.writeFileSync(NEWS_FILE, JSON.stringify(data, null, 2));
}

async function postGameNews(guild) {
  const news = loadNews();
  if (news.lastPosted && Date.now() - news.lastPosted < 23 * 60 * 60 * 1000) return;

  const ch = guild.channels.cache.find(c => c.name.includes('announcements'));
  if (!ch) return;

  try {
    const feed = await rssParser.parseURL('https://www.gamespot.com/feeds/news/');
    const items = feed.items.slice(0, 3);

    for (const item of items) {
      const image =
        item.media?.$.url ||
        item.mediaThumbnail?.$.url ||
        item.enclosure?.url ||
        null;

      const embed = new EmbedBuilder()
        .setColor(COLORS.primary)
        .setTitle((item.title || 'Gaming News').slice(0, 256))
        .setURL(item.link || '')
        .setDescription(((item.contentSnippet || '').slice(0, 350) || 'No description.') + `\n\n[اقرأ المزيد | Read more](${item.link})`)
        .setFooter({ text: 'GameSpot News 🎮' })
        .setTimestamp(item.pubDate ? new Date(item.pubDate) : new Date());

      if (image) embed.setImage(image);

      await ch.send({ embeds: [embed] });
    }

    news.lastPosted = Date.now();
    saveNews(news);
    console.log('✅ Game news posted');
  } catch (err) {
    console.error('Game news error:', err.message);
  }
}

function startNewsScheduler(guild) {
  postGameNews(guild);
  setInterval(() => postGameNews(guild), 24 * 60 * 60 * 1000);
}

// ─── Reaction Roles Setup ──────────────────────────────────────────────────────

function loadRR() {
  try { return JSON.parse(fs.readFileSync(RR_FILE, 'utf8')); } catch { return {}; }
}
function saveRR(data) {
  fs.writeFileSync(RR_FILE, JSON.stringify(data, null, 2));
}

async function setupReactionRoles(guild) {
  const pickCh = guild.channels.cache.find(c => c.name && c.name.includes('pick-game'));
  if (!pickCh) return;

  const rr = loadRR();

  // Delete old message if it still exists in this channel
  if (rr[guild.id]) {
    try {
      const oldMsg = await pickCh.messages.fetch(rr[guild.id]);
      await oldMsg.delete();
    } catch (_) {
      // already gone or in a different channel — ignore
    }
  }

  // Always post a fresh embed so reactions are correct after channel resets
  const embed = new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle('🎮 اختر لعبتك | Pick Your Game')
    .setDescription(
      'تفاعل بالإيموجي للحصول على دور اللعبة | React to get your game role\n\n' +
      '🔫 ـ Battlefield\n' +
      '🦀 ـ Rust\n' +
      '🎯 ـ COD\n' +
      '💥 ـ CS2\n' +
      '🪂 ـ PUBG\n' +
      '🏎️ ـ Forza'
    )
    .setFooter({ text: 'يمكنك اختيار أكثر من لعبة | You can pick multiple games' })
    .setTimestamp();

  const msg = await pickCh.send({ embeds: [embed] });
  for (const emoji of Object.keys(REACTION_ROLE_MAP)) {
    await msg.react(emoji);
  }

  rr[guild.id] = msg.id;
  saveRR(rr);
  console.log(`✅ Reaction roles message posted in ${pickCh.name}`);
}

// ─── Ready ─────────────────────────────────────────────────────────────────────

client.once('ready', async () => {
  console.log(`Bot online: ${client.user.tag}`);
  client.user.setPresence({ activities: [{ name: '🎮 PC Gaming Hub | !help', type: 0 }], status: 'online' });
  for (const guild of client.guilds.cache.values()) {
    startStatsUpdater(guild);
    await setupReactionRoles(guild);
    startNewsScheduler(guild);
  }
});

// ─── Reaction Role Add ─────────────────────────────────────────────────────────

client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) try { await reaction.fetch(); } catch { return; }
  const rr = loadRR();
  const guild = reaction.message.guild;
  if (!guild || reaction.message.id !== rr[guild.id]) return;
  const roleName = REACTION_ROLE_MAP[reaction.emoji.name];
  if (!roleName) return;
  const role = guild.roles.cache.find(r => r.name === roleName);
  if (!role) return;
  const member = await guild.members.fetch(user.id).catch(() => null);
  if (member) member.roles.add(role).catch(() => {});
});

// ─── Reaction Role Remove ──────────────────────────────────────────────────────

client.on('messageReactionRemove', async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) try { await reaction.fetch(); } catch { return; }
  const rr = loadRR();
  const guild = reaction.message.guild;
  if (!guild || reaction.message.id !== rr[guild.id]) return;
  const roleName = REACTION_ROLE_MAP[reaction.emoji.name];
  if (!roleName) return;
  const role = guild.roles.cache.find(r => r.name === roleName);
  if (!role) return;
  const member = await guild.members.fetch(user.id).catch(() => null);
  if (member) member.roles.remove(role).catch(() => {});
});

// ─── Welcome ───────────────────────────────────────────────────────────────────

client.on('guildMemberAdd', async (member) => {
  const guild = member.guild;
  try {
    await member.send({ embeds: [new EmbedBuilder()
      .setColor(COLORS.primary)
      .setTitle('🎮 أهلاً بك في PC Gaming Hub! | Welcome to PC Gaming Hub!')
      .setDescription(`مرحباً **${member.user.username}**، سعداء بانضمامك!\nتفقّد **#القوانين** واختر دورك في **#اختر-لعبتك**.\n\nHey **${member.user.username}**, glad you joined!\nCheck **#rules** and pick your role in **#pick-game**.`)
      .setFooter({ text: 'حظاً موفقاً يا جندي 🔫 | Good luck soldier 🔫' })
      .setTimestamp()] });
  } catch (_) {}
  const memberRole = guild.roles.cache.find(r => r.name === '👤 Member');
  if (memberRole) member.roles.add(memberRole).catch(() => {});
  const ch = guild.channels.cache.find(c => c.name.includes('welcome'));
  if (ch) ch.send({ embeds: [new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle(`🎮 ${member.user.username} انضم إلينا! | just dropped in!`)
    .setDescription(`أهلاً بك في **${guild.name}**! العضو رقم **#${guild.memberCount}**.\n\nWelcome to **${guild.name}**! Member **#${guild.memberCount}**.`)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setTimestamp()] });
});

// ─── Mod Log ───────────────────────────────────────────────────────────────────

function logAction(guild, action, mod, target, reason) {
  const ch = guild.channels.cache.find(c => c.name === 'mod-log--سجل الإدارة');
  if (!ch) return;
  const icon = action === 'BAN' ? '🔨' : action === 'KICK' ? '👟' : '⚠️';
  const arLabel = action === 'BAN' ? 'حظر' : action === 'KICK' ? 'طرد' : 'تحذير';
  ch.send({ embeds: [new EmbedBuilder()
    .setColor(action === 'BAN' ? COLORS.danger : COLORS.warning)
    .setTitle(`${icon} ${arLabel} | ${action}`)
    .addFields(
      { name: '🎯 الهدف | Target', value: `${target.tag}`, inline: true },
      { name: '🛡️ المشرف | Mod', value: mod.tag, inline: true },
      { name: '📝 السبب | Reason', value: reason }
    )
    .setTimestamp()] });
}

// ─── Messages ──────────────────────────────────────────────────────────────────

const BAD_WORDS = ['spam', 'scam'];
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;
  if (processedMessages.has(message.id)) return;
  processedMessages.add(message.id);
  setTimeout(() => processedMessages.delete(message.id), 5000);

  if (BAD_WORDS.some(w => message.content.toLowerCase().includes(w))) {
    message.delete().catch(() => {});
    return;
  }

  await addXP(message);
  await addCoins(message);

  // ─── Auto-replies ─────────────────────────────────────────────────────────────
  const msg = message.content.toLowerCase();
  if (msg.includes('مرحبا') || msg.includes('هلا') || msg.includes('سلام'))
    return message.reply('أهلاً وسهلاً! 👋 مرحبا بك في النواة');
  if (msg.includes('!discord'))
    return message.reply('🔗 رابط السيرفر | Server invite: discord.gg/النواة');
  if (msg.includes('بوت') || msg.includes('bot'))
    return message.reply('أنا rulerbot 🤖 اكتب !help لقائمة الأوامر | Type !help for commands');

  if (!message.content.startsWith(PREFIX)) return;
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // ── !help | !مساعدة ──────────────────────────────────────────────────────────
  if (command === 'help' || command === 'مساعدة') return message.reply({ embeds: [new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle('🎮 الأوامر | Commands')
    .setDescription('استخدم ! قبل أي أمر | Use ! before any command')
    .addFields(
      { name: '🛡️ الإشراف | Moderation', value: '!حظر (ban) | !طرد (kick) | !كتم (mute) | !تحذير (warn) | !مسح (clear)' },
      { name: '🔧 الأدوات | Utility', value: '!بينغ (ping) | !سيرفر (serverinfo) | !مستخدم (userinfo)' },
      { name: '🏆 المستوى | XP', value: '!رتبة (rank) | !إحصائيات (stats) | !متصدرون (leaderboard)' },
      { name: '💰 الاقتصاد | Economy', value: '!عملاتي (coins) | !يومي (daily) | !متصدرون-عملات (leaderboard-coins) | !متجر (shop) | !شراء (buy)' },
      { name: '🎫 التذاكر | Tickets', value: '!تذكرة (ticket) | !إغلاق (closeticket)' },
      { name: '🎲 الترفيه | Fun', value: '!نرد (roll) | !عملة (coinflip) | !8ball' },
      { name: '🤖 الذكاء الاصطناعي | AI', value: '!ai [سؤال | question]' }
    )
    .setFooter({ text: 'PC Gaming Hub | النواة' })
    .setTimestamp()] });

  // ── !ping | !بينغ ─────────────────────────────────────────────────────────────
  if (command === 'ping' || command === 'بينغ') {
    const s = await message.reply('🏓 جارٍ القياس... | Pinging...');
    return s.edit(`🏓 **${s.createdTimestamp - message.createdTimestamp}ms** | API: **${Math.round(client.ws.ping)}ms**`);
  }

  // ── !serverinfo | !سيرفر ──────────────────────────────────────────────────────
  if (command === 'serverinfo' || command === 'سيرفر') {
    const g = message.guild;
    return message.reply({ embeds: [new EmbedBuilder()
      .setColor(COLORS.info)
      .setTitle(`🌐 ${g.name}`)
      .setThumbnail(g.iconURL({ dynamic: true }))
      .addFields(
        { name: '👥 الأعضاء | Members', value: `${g.memberCount}`, inline: true },
        { name: '💬 القنوات | Channels', value: `${g.channels.cache.size}`, inline: true },
        { name: '🎭 الرتب | Roles', value: `${g.roles.cache.size}`, inline: true }
      )
      .setTimestamp()] });
  }

  // ── !userinfo | !مستخدم ───────────────────────────────────────────────────────
  if (command === 'userinfo' || command === 'مستخدم') {
    const t = message.mentions.members.first() || message.member;
    return message.reply({ embeds: [new EmbedBuilder()
      .setColor(COLORS.info)
      .setTitle(`👤 ${t.user.tag}`)
      .setThumbnail(t.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '🆔 المعرّف | ID', value: t.id, inline: true },
        { name: '📅 انضم | Joined', value: `<t:${Math.floor(t.joinedTimestamp / 1000)}:R>`, inline: true }
      )
      .setTimestamp()] });
  }

  // ── !clear | !مسح ─────────────────────────────────────────────────────────────
  if (command === 'clear' || command === 'مسح') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages))
      return message.reply('❌ ليس لديك صلاحية. | No permission.');
    const n = parseInt(args[0]);
    if (isNaN(n) || n < 1 || n > 100)
      return message.reply('⚠️ أدخل رقماً بين 1 و100. | Enter a number between 1-100.');
    await message.channel.bulkDelete(n + 1, true);
    return;
  }

  // ── !rank | !رتبة ─────────────────────────────────────────────────────────────
  if (command === 'rank' || command === 'رتبة') {
    const target = message.mentions.members.first() || message.member;
    const data = loadXP();
    const user = getXPUser(data, target.id);
    const needed = xpForNextLevel(user.level + 1);
    const progress = Math.floor((user.xp / needed) * 10);
    const bar = '█'.repeat(progress) + '░'.repeat(10 - progress);
    return message.reply({ embeds: [new EmbedBuilder()
      .setColor(COLORS.xp)
      .setTitle(`🏆 ${target.user.username}`)
      .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '⭐ المستوى | Level', value: `${user.level}`, inline: true },
        { name: '✨ الخبرة | XP', value: `${user.xp} / ${needed}`, inline: true },
        { name: '📊 التقدم | Progress', value: `\`[${bar}]\`` }
      )
      .setTimestamp()] });
  }

  // ── !stats | !إحصائيات ────────────────────────────────────────────────────────
  if (command === 'stats' || command === 'إحصائيات') {
    const target = message.mentions.members.first() || message.member;
    const xpData = loadXP();
    const user = getXPUser(xpData, target.id);
    const needed = xpForNextLevel(user.level + 1);
    const sorted = Object.entries(xpData).sort((a, b) => (b[1].level * 1000 + b[1].xp) - (a[1].level * 1000 + a[1].xp));
    const rank = sorted.findIndex(([id]) => id === target.id) + 1;
    const coinsData = loadCoins();
    const coins = getCoinsUser(coinsData, target.id).coins;
    return message.reply({ embeds: [new EmbedBuilder()
      .setColor(COLORS.xp)
      .setTitle(`📊 إحصائيات | Stats — ${target.user.username}`)
      .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '⭐ المستوى | Level', value: `${user.level}`, inline: true },
        { name: '✨ الخبرة | XP', value: `${user.xp} / ${needed}`, inline: true },
        { name: '🏅 الترتيب | Rank', value: `#${rank}`, inline: true },
        { name: '💬 الرسائل | Messages', value: `${user.messages}`, inline: true },
        { name: '💰 العملات | Coins', value: `${coins}`, inline: true }
      )
      .setTimestamp()] });
  }

  // ── !leaderboard | !متصدرون ───────────────────────────────────────────────────
  if (command === 'leaderboard' || command === 'متصدرون') {
    const data = loadXP();
    const sorted = Object.entries(data)
      .sort((a, b) => (b[1].level * 1000 + b[1].xp) - (a[1].level * 1000 + a[1].xp))
      .slice(0, 10);
    const medals = ['🥇', '🥈', '🥉'];
    const lines = sorted.map(([id, u], i) => {
      const medal = medals[i] || `**${i + 1}.**`;
      const mem = message.guild.members.cache.get(id);
      const name = mem ? mem.user.username : `<@${id}>`;
      return `${medal} **${name}** — Lv. ${u.level} • ${u.xp} XP`;
    });
    return message.reply({ embeds: [new EmbedBuilder()
      .setColor(COLORS.xp)
      .setTitle('🏆 متصدرو الخبرة | XP Leaderboard')
      .setDescription(lines.length ? lines.join('\n') : 'لا يوجد بيانات بعد. | No data yet.')
      .setTimestamp()] });
  }

  // ── !coins | !عملاتي ──────────────────────────────────────────────────────────
  if (command === 'coins' || command === 'عملاتي') {
    const target = message.mentions.members.first() || message.member;
    const data = loadCoins();
    const user = getCoinsUser(data, target.id);
    return message.reply({ embeds: [new EmbedBuilder()
      .setColor(COLORS.coins)
      .setTitle(`💰 ${target.user.username}`)
      .setDescription(`رصيدك | Balance: **${user.coins} 🪙**`)
      .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
      .setTimestamp()] });
  }

  // ── !daily | !يومي ────────────────────────────────────────────────────────────
  if (command === 'daily' || command === 'يومي') {
    const data = loadCoins();
    const user = getCoinsUser(data, message.author.id);
    const now = Date.now();
    const cooldown = 24 * 60 * 60 * 1000;
    if (now - user.lastDaily < cooldown) {
      const remaining = cooldown - (now - user.lastDaily);
      const hours = Math.floor(remaining / 3600000);
      const mins  = Math.floor((remaining % 3600000) / 60000);
      return message.reply(`⏳ المكافأة اليومية متاحة بعد **${hours}س ${mins}د** | Come back in **${hours}h ${mins}m**`);
    }
    user.coins += 100;
    user.lastDaily = now;
    saveCoins(data);
    return message.reply({ embeds: [new EmbedBuilder()
      .setColor(COLORS.coins)
      .setTitle('🎁 مكافأة يومية | Daily Reward')
      .setDescription(`حصلت على **100 🪙**! رصيدك الآن: **${user.coins} 🪙**\nYou claimed **100 🪙**! Balance: **${user.coins} 🪙**`)
      .setTimestamp()] });
  }

  // ── !leaderboard-coins | !متصدرون-عملات ──────────────────────────────────────
  if (command === 'leaderboard-coins' || command === 'متصدرون-عملات') {
    const data = loadCoins();
    const sorted = Object.entries(data)
      .sort((a, b) => b[1].coins - a[1].coins)
      .slice(0, 10);
    const medals = ['🥇', '🥈', '🥉'];
    const lines = sorted.map(([id, u], i) => {
      const medal = medals[i] || `**${i + 1}.**`;
      const mem = message.guild.members.cache.get(id);
      const name = mem ? mem.user.username : `<@${id}>`;
      return `${medal} **${name}** — ${u.coins} 🪙`;
    });
    return message.reply({ embeds: [new EmbedBuilder()
      .setColor(COLORS.coins)
      .setTitle('💰 أغنى الأعضاء | Coins Leaderboard')
      .setDescription(lines.length ? lines.join('\n') : 'لا يوجد بيانات بعد. | No data yet.')
      .setTimestamp()] });
  }

  // ── !shop | !متجر ─────────────────────────────────────────────────────────────
  if (command === 'shop' || command === 'متجر') {
    const lines = SHOP_ITEMS.map(item =>
      `**${item.name}** — ${item.price} 🪙\n↳ ${item.description} • \`!buy ${item.id}\``
    );
    return message.reply({ embeds: [new EmbedBuilder()
      .setColor(COLORS.coins)
      .setTitle('🛒 المتجر | Shop')
      .setDescription(lines.join('\n\n'))
      .setFooter({ text: 'استخدم !buy [id] للشراء | Use !buy [id] to purchase' })
      .setTimestamp()] });
  }

  // ── !buy | !شراء ──────────────────────────────────────────────────────────────
  if (command === 'buy' || command === 'شراء') {
    const itemId = args[0]?.toLowerCase();
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) return message.reply(`❌ عنصر غير موجود. | Item not found. Use \`!shop\` to see available items.`);
    const data = loadCoins();
    const user = getCoinsUser(data, message.author.id);
    if (user.coins < item.price)
      return message.reply(`❌ رصيدك غير كافٍ! تحتاج **${item.price} 🪙** ولديك **${user.coins} 🪙**.\nNot enough coins! Need **${item.price} 🪙**, you have **${user.coins} 🪙**.`);
    const role = message.guild.roles.cache.find(r => r.name === item.role);
    if (!role) return message.reply('❌ الرتبة غير متوفرة حالياً. | Role not available.');
    if (message.member.roles.cache.has(role.id))
      return message.reply('❌ لديك هذه الرتبة بالفعل. | You already have this role.');
    user.coins -= item.price;
    saveCoins(data);
    await message.member.roles.add(role).catch(() => {});
    return message.reply({ embeds: [new EmbedBuilder()
      .setColor(COLORS.coins)
      .setTitle('✅ تم الشراء! | Purchase Successful!')
      .setDescription(`اشتريت **${item.name}** بـ **${item.price} 🪙**!\nرصيدك الآن: **${user.coins} 🪙**\n\nYou bought **${item.name}** for **${item.price} 🪙**!\nBalance: **${user.coins} 🪙**`)
      .setTimestamp()] });
  }

  // ── !ticket | !تذكرة ──────────────────────────────────────────────────────────
  if (command === 'ticket' || command === 'تذكرة') {
    const guild = message.guild;
    const existing = guild.channels.cache.find(c => c.name === `ticket-${message.author.username.toLowerCase()}`);
    if (existing) return message.reply(`❌ لديك تذكرة مفتوحة بالفعل | You already have an open ticket: ${existing}`);
    const modRole   = guild.roles.cache.find(r => r.name === '🛡️ Moderator');
    const adminRole = guild.roles.cache.find(r => r.name === '👑 Admin');
    const overwrites = [
      { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
      { id: message.author.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    ];
    if (modRole)   overwrites.push({ id: modRole.id,   allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
    if (adminRole) overwrites.push({ id: adminRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
    const ticketCh = await guild.channels.create({
      name: `ticket-${message.author.username.toLowerCase()}`,
      type: ChannelType.GuildText,
      permissionOverwrites: overwrites,
    });
    await ticketCh.send({ embeds: [new EmbedBuilder()
      .setColor(COLORS.primary)
      .setTitle('🎫 تذكرة دعم | Support Ticket')
      .setDescription(`مرحباً ${message.author}، سيتواصل معك أحد المشرفين قريباً.\nاكتب **!إغلاق** أو **!closeticket** لإغلاق التذكرة.\n\nHello ${message.author}, a moderator will assist you shortly.\nType **!closeticket** to close this ticket.`)
      .setFooter({ text: `Ticket by ${message.author.tag}` })
      .setTimestamp()] });
    return message.reply(`✅ تم إنشاء تذكرتك | Ticket created: ${ticketCh}`);
  }

  // ── !closeticket | !إغلاق ─────────────────────────────────────────────────────
  if (command === 'closeticket' || command === 'إغلاق') {
    if (!message.channel.name.startsWith('ticket-'))
      return message.reply('❌ هذا الأمر يعمل داخل قنوات التذاكر فقط. | This command only works inside ticket channels.');
    await message.channel.send('🔒 جارٍ إغلاق التذكرة... | Closing ticket...');
    setTimeout(() => message.channel.delete().catch(() => {}), 3000);
    return;
  }

  // ── !ai ───────────────────────────────────────────────────────────────────────
  if (command === 'ai') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey)
      return message.reply('❌ مفتاح Gemini غير مضبوط. | GEMINI_API_KEY is not set.');
    const question = args.join(' ').trim();
    if (!question)
      return message.reply('❌ اكتب سؤالك بعد الأمر | Write your question: `!ai [question]`');

    const thinking = await message.reply('🤔 جارٍ التفكير... | Thinking...');
    try {
      const prompt =
        `أجب باللغتين العربية والإنجليزية (العربية أولاً ثم الإنجليزية). كن مختصراً وواضحاً.\n` +
        `Answer in both Arabic and English (Arabic first, then English). Be concise and clear.\n\n` +
        `السؤال | Question: ${question}`;

      const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`);

      const text = (data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response.').slice(0, 4096);
      await thinking.edit({ content: '', embeds: [new EmbedBuilder()
        .setColor(COLORS.info)
        .setTitle('🤖 AI — Gemini 2.0 Flash')
        .setDescription(text)
        .setFooter({ text: `${message.author.tag} • Powered by Google Gemini` })
        .setTimestamp()] });
    } catch (err) {
      await thinking.edit(`❌ حدث خطأ | Error: ${err.message}`);
    }
    return;
  }
});

client.login(process.env.DISCORD_TOKEN);
