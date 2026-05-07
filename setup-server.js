require('dotenv').config();
const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const GUILD_ID = process.env.GUILD_ID;

const ROLES = [
  // Staff
  { name: '👑 Admin', color: 0xff2244, hoist: true, permissions: [PermissionFlagsBits.Administrator] },
  { name: '🛡️ Moderator', color: 0xff8800, hoist: true, permissions: [PermissionFlagsBits.ManageMessages, PermissionFlagsBits.KickMembers, PermissionFlagsBits.BanMembers] },
  // Achievement / status roles
  { name: '⚡ Legend', color: 0xffff00 },
  { name: '🏆 Champion', color: 0xe67e22 },
  { name: '💎 Premium', color: 0x00ffff },
  { name: '⭐ VIP', color: 0xffd700 },
  { name: '🎯 Sharpshooter', color: 0x8b0000 },
  { name: '🧠 Strategist', color: 0x00008b },
  { name: '🎮 Gamer', color: 0x9b59b6 },
  { name: '📢 Supporter', color: 0xe74c3c },
  { name: '🚀 Booster', color: 0x87ceeb },
  { name: '💬 Active', color: 0x2ecc71 },
  { name: '🟢 Rookie', color: 0x32cd32 },
  // Game roles
  { name: '🔫 Battlefield', color: 0xf5a623 },
  { name: '⚔️ Age of Empires', color: 0x8b6914 },
  { name: '🏰 Rise of Kingdoms', color: 0x228b22 },
  { name: '🧊 Whiteout Survival', color: 0x00bfff },
  { name: '🪓 Viking Rise', color: 0x8b0000 },
  // Base roles
  { name: '👾 PC Gamer', color: 0x7289da, hoist: true },
  { name: '👤 Member', color: 0x99aab5 },
];

const STRUCTURE = [
  { category: '📊 الاحصائيات | STATS', statsOnly: true, channels: [
    { name: '👥 الأعضاء: 0', type: ChannelType.GuildVoice },
    { name: '🟢 أونلاين: 0', type: ChannelType.GuildVoice },
    { name: '🤖 البوتات: 0', type: ChannelType.GuildVoice },
  ]},
  { category: '📋 المعلومات | INFO', channels: [
    { name: '📢الاخبار | announcements', type: ChannelType.GuildText },
    { name: '📜القوانين | rules', type: ChannelType.GuildText },
    { name: '👋الترحيب | welcome', type: ChannelType.GuildText },
  ]},
  { category: '🎮 ادوار الالعاب | GAME ROLES', channels: [
    { name: '🎮اختر لعبتك | pick-game', type: ChannelType.GuildText },
  ]},
  { category: '💬 المحادثات العامة | GENERAL', channels: [
    { name: '💬العام | general', type: ChannelType.GuildText },
    { name: '🎮الالعاب | gaming', type: ChannelType.GuildText },
    { name: '🖥️تجميعات | pc-builds', type: ChannelType.GuildText },
    { name: '🤖اوامر | commands', type: ChannelType.GuildText },
    { name: '📸صور | pictures', type: ChannelType.GuildText },
    { name: '🔗روابط | links', type: ChannelType.GuildText },
  ]},
  { category: '🔫 باتلفيلد | BATTLEFIELD', channels: [
    { name: '🔫باتلفيلد | battlefield', type: ChannelType.GuildText },
    { name: '🔍البحث عن فريق | lfg', type: ChannelType.GuildText },
  ]},
  { category: '🖥️ العاب الكمبيوتر | PC GAMES', channels: [
    { name: '🦀rust--راست', type: ChannelType.GuildText },
    { name: '🎯cod--كول اوف ديوتي', type: ChannelType.GuildText },
    { name: '🔫cs2--كاونتر', type: ChannelType.GuildText },
    { name: '🪂pubg--ببجي', type: ChannelType.GuildText },
    { name: '🏎️forza--فورزا', type: ChannelType.GuildText },
  ]},
  { category: '🎙️ الصوتيات العامة | VOICE', channels: [
    { name: '🎙️الاستراحة | Lounge', type: ChannelType.GuildVoice },
    { name: '🔫فريق باتلفيلد | BF Squad', type: ChannelType.GuildVoice },
    { name: '🎯 COD Squad', type: ChannelType.GuildVoice },
    { name: '🎮جلسة الالعاب | Gaming', type: ChannelType.GuildVoice },
  ]},
  { category: '🛡️ الادارة فقط | MOD ONLY', adminOnly: true, channels: [
    { name: '📋سجل الإدارة | mod-log', type: ChannelType.GuildText },
    { name: '🛡️دردشة الإدارة | mod-chat', type: ChannelType.GuildText },
  ]},
];

const delay = ms => new Promise(r => setTimeout(r, ms));

client.once('ready', async () => {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) { console.error('❌ Guild not found'); process.exit(1); }
  console.log(`🚀 Setting up: ${guild.name}`);

  // Delete all existing channels
  console.log('🗑️  Deleting existing channels...');
  const existingChannels = [...guild.channels.cache.values()];
  for (const ch of existingChannels) {
    try { await ch.delete(); await delay(300); } catch (_) {}
  }
  console.log('✅ Channels cleared.');

  // Create roles (skip if already exist)
  const existingRoles = guild.roles.cache.map(r => r.name);
  for (const role of ROLES) {
    if (existingRoles.includes(role.name)) { console.log(`⏭️ Skipped role: ${role.name}`); continue; }
    await guild.roles.create({ name: role.name, color: role.color, hoist: role.hoist || false, permissions: role.permissions || [] });
    console.log(`✅ Role: ${role.name}`); await delay(300);
  }

  // Create categories and channels
  for (const section of STRUCTURE) {
    const modRole = guild.roles.cache.find(r => r.name === '🛡️ Moderator');
    const adminRole = guild.roles.cache.find(r => r.name === '👑 Admin');

    let categoryOverwrites = [];
    if (section.adminOnly) {
      categoryOverwrites = [
        { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
        ...(modRole ? [{ id: modRole.id, allow: [PermissionFlagsBits.ViewChannel] }] : []),
      ];
    } else if (section.statsOnly) {
      categoryOverwrites = [
        { id: guild.roles.everyone, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.Connect, PermissionFlagsBits.ManageChannels] },
        ...(adminRole ? [{ id: adminRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels], deny: [PermissionFlagsBits.Connect] }] : []),
      ];
    }

    const cat = await guild.channels.create({
      name: section.category,
      type: ChannelType.GuildCategory,
      permissionOverwrites: categoryOverwrites,
    });
    console.log(`📁 ${section.category}`);
    for (const ch of section.channels) {
      await guild.channels.create({ name: ch.name, type: ch.type, parent: cat.id });
      console.log(`  ✅ ${ch.name}`);
      await delay(400);
    }
  }

  console.log('✅ Done!');
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
