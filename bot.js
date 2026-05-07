require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildPresences, GatewayIntentBits.GuildVoiceStates],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

const PREFIX = '!';
const COLORS = { primary: 0x00aaff, danger: 0xff3355, warning: 0xffaa00, info: 0x8888ff, xp: 0xf0c040 };
const XP_FILE = path.join(__dirname, 'data', 'xp.json');
const XP_COOLDOWN = 60000; // 60 seconds
const xpCooldowns = new Map();

// ─── XP Helpers ────────────────────────────────────────────────────────────────

function loadXP() {
  try { return JSON.parse(fs.readFileSync(XP_FILE, 'utf8')); } catch { return {}; }
}

function saveXP(data) {
  fs.writeFileSync(XP_FILE, JSON.stringify(data, null, 2));
}

function xpForNextLevel(level) {
  return level * 100;
}

function getUser(data, userId) {
  if (!data[userId]) data[userId] = { xp: 0, level: 0, messages: 0 };
  return data[userId];
}

async function addXP(message) {
  const userId = message.author.id;
  const now = Date.now();
  if (xpCooldowns.has(userId) && now - xpCooldowns.get(userId) < XP_COOLDOWN) return;
  xpCooldowns.set(userId, now);

  const data = loadXP();
  const user = getUser(data, userId);
  const earned = Math.floor(Math.random() * 16) + 10; // 10–25
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

// ─── Member Count Auto-Update ──────────────────────────────────────────────────

function startMemberCountUpdater(guild) {
  async function update() {
    const ch = guild.channels.cache.find(c => c.name && c.name.startsWith('👥'));
    if (ch) {
      try { await ch.setName(`👥 الأعضاء: ${guild.memberCount}`); } catch (_) {}
    }
  }
  update();
  setInterval(update, 10 * 60 * 1000); // every 10 minutes
}

// ─── Ready ─────────────────────────────────────────────────────────────────────

client.once('ready', () => {
  console.log(`Bot online: ${client.user.tag}`);
  client.user.setPresence({ activities: [{ name: '🎮 PC Gaming Hub | !help', type: 0 }], status: 'online' });
  for (const guild of client.guilds.cache.values()) startMemberCountUpdater(guild);
});

// ─── Welcome / Leave ───────────────────────────────────────────────────────────

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
  const ch = guild.channels.cache.find(c => c.name === '👋الترحيب | welcome');
  if (ch) ch.send({ embeds: [new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle(`🎮 ${member.user.username} انضم إلينا! | just dropped in!`)
    .setDescription(`أهلاً بك في **${guild.name}**! العضو رقم **#${guild.memberCount}**.\n\nWelcome to **${guild.name}**! Member **#${guild.memberCount}**.`)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setTimestamp()] });
});

// ─── Mod Log ───────────────────────────────────────────────────────────────────

function logAction(guild, action, mod, target, reason) {
  const ch = guild.channels.cache.find(c => c.name === '📋سجل الإدارة | mod-log');
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

  // Filter bad words
  if (BAD_WORDS.some(w => message.content.toLowerCase().includes(w))) {
    message.delete().catch(() => {});
    return;
  }

  // Award XP for every message
  await addXP(message);

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
      { name: '🎫 التذاكر | Tickets', value: '!تذكرة (ticket) | !إغلاق (closeticket)' },
      { name: '🎲 الترفيه | Fun', value: '!نرد (roll) | !عملة (coinflip) | !8ball' }
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
    const user = getUser(data, target.id);
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
    const data = loadXP();
    const user = getUser(data, target.id);
    const needed = xpForNextLevel(user.level + 1);
    const sorted = Object.entries(data).sort((a, b) => {
      const totalA = a[1].level * 1000 + a[1].xp;
      const totalB = b[1].level * 1000 + b[1].xp;
      return totalB - totalA;
    });
    const rank = sorted.findIndex(([id]) => id === target.id) + 1;
    return message.reply({ embeds: [new EmbedBuilder()
      .setColor(COLORS.xp)
      .setTitle(`📊 إحصائيات | Stats — ${target.user.username}`)
      .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '⭐ المستوى | Level', value: `${user.level}`, inline: true },
        { name: '✨ الخبرة | XP', value: `${user.xp} / ${needed}`, inline: true },
        { name: '🏅 الترتيب | Rank', value: `#${rank}`, inline: true },
        { name: '💬 الرسائل | Messages', value: `${user.messages}`, inline: true }
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
      const member = message.guild.members.cache.get(id);
      const name = member ? member.user.username : `<@${id}>`;
      return `${medal} **${name}** — المستوى | Lv. ${u.level} • ${u.xp} XP`;
    });
    return message.reply({ embeds: [new EmbedBuilder()
      .setColor(COLORS.xp)
      .setTitle('🏆 المتصدرون | Leaderboard')
      .setDescription(lines.length ? lines.join('\n') : 'لا يوجد بيانات بعد. | No data yet.')
      .setTimestamp()] });
  }

  // ── !ticket | !تذكرة ──────────────────────────────────────────────────────────
  if (command === 'ticket' || command === 'تذكرة') {
    const guild = message.guild;
    const existing = guild.channels.cache.find(c => c.name === `ticket-${message.author.username.toLowerCase()}`);
    if (existing) return message.reply(`❌ لديك تذكرة مفتوحة بالفعل | You already have an open ticket: ${existing}`);

    const modRole = guild.roles.cache.find(r => r.name === '🛡️ Moderator');
    const adminRole = guild.roles.cache.find(r => r.name === '👑 Admin');
    const overwrites = [
      { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
      { id: message.author.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    ];
    if (modRole) overwrites.push({ id: modRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
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
});

client.login(process.env.DISCORD_TOKEN);
