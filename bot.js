require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildPresences, GatewayIntentBits.GuildVoiceStates],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});
const PREFIX = '!';
const COLORS = { primary: 0x00aaff, danger: 0xff3355, warning: 0xffaa00, info: 0x8888ff };

client.once('ready', () => {
  console.log(`Bot online: ${client.user.tag}`);
  client.user.setPresence({ activities: [{ name: '🎮 PC Gaming Hub | !help', type: 0 }], status: 'online' });
});

client.on('guildMemberAdd', async (member) => {
  const guild = member.guild;
  try {
    await member.send({ embeds: [new EmbedBuilder()
      .setColor(COLORS.primary)
      .setTitle('🎮 أهلاً بك في PC Gaming Hub! | Welcome to PC Gaming Hub!')
      .setDescription(`مرحباً **${member.user.username}**، سعداء بانضمامك!\nتفقّد **#rules** واختر دورك في **#pick-your-game**.\n\nHey **${member.user.username}**, glad you joined!\nCheck **#rules** and pick your role in **#pick-your-game**.`)
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

const BAD_WORDS = ['spam', 'scam'];
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (BAD_WORDS.some(w => message.content.toLowerCase().includes(w))) { message.delete().catch(() => {}); return; }
  if (!message.content.startsWith(PREFIX)) return;
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // !help | !مساعدة
  if (command === 'help' || command === 'مساعدة') return message.reply({ embeds: [new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle('🎮 الأوامر | Commands')
    .setDescription('استخدم ! قبل أي أمر | Use ! before any command')
    .addFields(
      { name: '🛡️ الإشراف | Moderation', value: '!حظر (ban) | !طرد (kick) | !كتم (mute) | !تحذير (warn) | !مسح (clear)' },
      { name: '🔧 الأدوات | Utility', value: '!بينغ (ping) | !سيرفر (serverinfo) | !مستخدم (userinfo)' },
      { name: '🎲 الترفيه | Fun', value: '!نرد (roll) | !عملة (coinflip) | !8ball' }
    )
    .setFooter({ text: 'PC Gaming Hub | النواة' })
    .setTimestamp()] });

  // !ping | !بينغ
  if (command === 'ping' || command === 'بينغ') {
    const s = await message.reply('🏓 جارٍ القياس... | Pinging...');
    return s.edit(`🏓 **${s.createdTimestamp - message.createdTimestamp}ms** | API: **${Math.round(client.ws.ping)}ms**`);
  }

  // !serverinfo | !سيرفر
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

  // !userinfo | !مستخدم
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

  // !clear | !مسح
  if (command === 'clear' || command === 'مسح') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages))
      return message.reply('❌ ليس لديك صلاحية. | No permission.');
    const n = parseInt(args[0]);
    if (isNaN(n) || n < 1 || n > 100)
      return message.reply('⚠️ أدخل رقماً بين 1 و100. | Enter a number between 1-100.');
    await message.channel.bulkDelete(n + 1, true);
    return;
  }
});

client.login(process.env.DISCORD_TOKEN);
