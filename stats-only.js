// stats-only.js — Standalone voice channel stats bot
// Run with: node stats-only.js
// Requires in .env: GUILD_ID, DISCORD_TOKEN, STATS_MEMBERS_CHANNEL, STATS_ONLINE_CHANNEL, STATS_BOTS_CHANNEL

require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const TOKEN               = process.env.DISCORD_TOKEN;
const GUILD_ID            = process.env.GUILD_ID;
const MEMBERS_CHANNEL_ID  = process.env.STATS_MEMBERS_CHANNEL;
const ONLINE_CHANNEL_ID   = process.env.STATS_ONLINE_CHANNEL;
const BOTS_CHANNEL_ID     = process.env.STATS_BOTS_CHANNEL;

const UPDATE_INTERVAL_MS  = 10 * 60 * 1000; // 10 minutes

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
  ],
});

async function updateStats() {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);

    // Fetch all members (including presences)
    await guild.members.fetch({ withPresences: true });

    const allMembers  = guild.members.cache;
    const totalCount  = allMembers.size;
    const botCount    = allMembers.filter(m => m.user.bot).size;
    const onlineCount = allMembers.filter(m => {
      const status = m.presence?.status;
      return status === 'online' || status === 'idle' || status === 'dnd';
    }).size;

    const updates = [
      { id: MEMBERS_CHANNEL_ID, name: `الأعضاء: ${totalCount} 👥` },
      { id: ONLINE_CHANNEL_ID,  name: `أونلاين: ${onlineCount} 🟢` },
      { id: BOTS_CHANNEL_ID,    name: `البوتات: ${botCount} 🤖` },
    ];

    for (const { id, name } of updates) {
      try {
        const channel = await client.channels.fetch(id);
        await channel.setName(name);
        console.log(`[stats] Updated channel ${id} → "${name}"`);
      } catch (err) {
        console.error(`[stats] Failed to update channel ${id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[stats] Error fetching guild or members:', err.message);
  }
}

client.once('ready', async () => {
  console.log(`[stats] Logged in as ${client.user.tag}`);
  await updateStats();
  setInterval(updateStats, UPDATE_INTERVAL_MS);
});

client.login(TOKEN);
