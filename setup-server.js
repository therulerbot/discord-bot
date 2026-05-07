require('dotenv').config();
const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const GUILD_ID = process.env.GUILD_ID;

const ROLES = [
  { name: '👑 Admin', color: 0xff2244, hoist: true, permissions: [PermissionFlagsBits.Administrator] },
  { name: '🛡️ Moderator', color: 0xff8800, hoist: true, permissions: [PermissionFlagsBits.ManageMessages, PermissionFlagsBits.KickMembers, PermissionFlagsBits.BanMembers] },
  { name: '🔫 Battlefield', color: 0xf5a623 },
  { name: '⚔️ Age of Empires', color: 0x8b6914 },
  { name: '🏰 Rise of Kingdoms', color: 0x228b22 },
  { name: '🧊 Whiteout Survival', color: 0x00bfff },
  { name: '🪓 Viking Rise', color: 0x8b0000 },
  { name: '👾 PC Gamer', color: 0x7289da, hoist: true },
];

const STRUCTURE = [
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
  { category: '⚔️ العاب الاستراتيجية | STRATEGY', channels: [
    { name: '⚔️عصر الامبراطوريات | aoe', type: ChannelType.GuildText },
    { name: '🏰صعود الممالك | rok', type: ChannelType.GuildText },
    { name: '🪓صعود الفايكنج | viking', type: ChannelType.GuildText },
    { name: '🧊وايتاوت | whiteout', type: ChannelType.GuildText },
  ]},
  { category: '🎙️ الصوتيات العامة | VOICE', channels: [
    { name: '🎙️الاستراحة | Lounge', type: ChannelType.GuildVoice },
    { name: '🔫فريق باتلفيلد | BF Squad', type: ChannelType.GuildVoice },
    { name: '⚔️غرفة الاستراتيجية | Strategy', type: ChannelType.GuildVoice },
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
    const cat = await guild.channels.create({
      name: section.category,
      type: ChannelType.GuildCategory,
      permissionOverwrites: section.adminOnly
        ? [{ id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] }, ...(modRole ? [{ id: modRole.id, allow: [PermissionFlagsBits.ViewChannel] }] : [])]
        : [],
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
