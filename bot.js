require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});
client.once('ready', async () => {
  console.log(`🤖 Bot đã login: ${client.user.tag}`);
  const channel = await client.channels.fetch(process.env.CHANNEL_ID);
  if (!channel) return console.error("❌ Không tìm thấy channel");
  await fetchAllMessages(channel);
  console.log("Đã load toàn bộ lịch sử kill log");
});
async function fetchAllMessages(channel) {
  let lastId;
  let fetchedCount = 0;
  const maxMessages = 8000;
  while (fetchedCount < maxMessages) {
    const options = { limit: 100 };
    if (lastId) options.before = lastId;
    const messages = await channel.messages.fetch(options);
    if (messages.size === 0) break;
    for (const msg of Array.from(messages.values()).reverse()) {
      await processMessage(msg);
    }
    lastId = messages.last().id;
    fetchedCount += messages.size;
    console.log(`📥 Đã load ${fetchedCount} tin`);
  }
}
async function processMessage(message) {
  if (!message.author.bot) return;
  if (message.embeds.length === 0) return;
  const embed = message.embeds[0];
  if (embed.title !== "Player Death") return;
  let victim = "", killer = "", weapon = "", distance = "";
  embed.fields.forEach(f => {
    if (f.name === "Nạn nhân") victim = f.value;
    if (f.name === "Người gây ra") killer = f.value;
    if (f.name === "Vũ khí") weapon = f.value;
    if (f.name === "Khoảng cách") distance = f.value;
  });
  const victimId = victim.match(/\[(\d+)\]/)?.[1] || "Unknown";
  const killerId = killer.match(/\[(\d+)\]/)?.[1] || "Unknown";
  const logData = {
    killer,
    weapon,
    victim,
    victimId,
    killerId,
    distance,
    time: message.createdAt.toISOString()
  };
  try {
    await axios.post(`http://localhost:${process.env.PORT}/api/logs`, logData);
  } catch (err) {
    console.error("❌ Lỗi gửi log:", err.message);
  }
}
client.on('messageCreate', processMessage);
client.login(process.env.DISCORD_TOKEN);
