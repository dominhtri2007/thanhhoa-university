require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
let isBackfilling = false;
const http = require('http');
const { Server } = require('socket.io');
const fetch = require('node-fetch');
const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const jwt = require("jsonwebtoken");
function authJWT(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).send("No token");

  const token = auth.split(" ")[1];
  if (token === process.env.INTERNAL_JWT) {
    req.user = { role: "bot" };
    return next();
  }
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).send("Token invalid or expired");
  }
}
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let logs = [];
app.post("/login", (req, res) => {
  const username = req.body.username?.trim();
  const password = req.body.password?.trim();

  if (username !== process.env.ADMIN_USER)
    return res.status(401).json({ error: "Invalid credentials" });

  if (password !== process.env.ADMIN_PASS.trim())
    return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign(
    { user: username, role: "admin" },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE }
  );

  res.json({ token });
});
app.get('/api/logs', authJWT, (req, res) => {
  res.json(logs.sort((a, b) => new Date(b.time) - new Date(a.time)));
});
app.post('/api/logs', authJWT, (req, res) => {
  logs.push(req.body);
  if (logs.length > 8000) logs.shift();
  io.emit('newLog', req.body);
  res.json({ success: true });
});
const botToken = process.env.DISCORD_TOKEN;
app.post('/api/sendMessage', authJWT, async (req, res) => {
  const { template, citizenId, reason, punishment, post } = req.body;

  let content = "";
  switch (template) {
    case "1":
      content = `## ⛔ Xử phạt
> **Công dân:** ${citizenId}
> **Bài tố cáo:** ${post || ""}
> **Lý do:** ${reason || ""}
> **Án phạt:** ${punishment || ""}`;
      break;
    case "2":
      content = `## ⛔ Xử phạt
> **Công dân:** ${citizenId}
> **Lý do:** ${reason || ""}
> **Án phạt:** ${punishment || ""}`;
      break;
    default:
      return res.json({ success: false, error: "Mẫu không hợp lệ" });
  }

  try {
    await fetch(`https://discord.com/api/v10/channels/${process.env.SEND_CHANNEL_ID}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bot ${botToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ content })
    });
    if (post && post.includes("discord.com/channels/")) {
      const parts = post.split("/");
      const channelId = parts[5];
      const messageId = parts[6];

      if (messageId) {
        await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
          method: "POST",
          headers: {
            "Authorization": `Bot ${botToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            content,
            message_reference: {
              message_id: messageId,
              channel_id: channelId
            }
          })
        });
      } else {
        await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
          method: "POST",
          headers: {
            "Authorization": `Bot ${botToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ content })
        });
      }
    }

    return res.json({ success: true });

  } catch (err) {
    console.error("[sendMessage] error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.post('/api/action', authJWT, async (req, res) => {
  const { type, id, location } = req.body;

  if (!id) return res.json({ success: false, error: "Thiếu ID" });

  let command = "";

  if (type === "teleport") {
    if (!location) return res.json({ success: false, error: "Thiếu location" });
    command = `!teleport ${id} ${location}`;
  }

  else if (type === "revive") {
    command = `!revive ${id}`;
  }

  else {
    return res.json({ success: false, error: "Loại hành động không hợp lệ" });
  }

  try {
    const result = await fetch(`https://discord.com/api/v9/channels/${process.env.ACTION_CHANNEL_ID}/messages`, {
      method: "POST",
      headers: {
        "Authorization": process.env.USER_TOKEN,  
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ content: command })
    });

    if (result.status === 200 || result.status === 201) {
      return res.json({ success: true });
    } else {
      return res.json({ success: false, error: "Discord từ chối request (token user?)" });
    }
  } catch (err) {
    console.error("❌ ACTION ERROR:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});
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
  console.log("⏳ Đang tải lịch sử log...");
  isBackfilling = true;
await fetchAllMessages(channel);
isBackfilling = false;
  console.log("✅ Đã load xong lịch sử log");
});
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
async function fetchAllMessages(channel) {
  let lastId;
  let fetchedCount = 0;
  const maxMessages = 8000;
  while (fetchedCount < maxMessages) {
    try {
      const options = { limit: 100 };
      if (lastId) options.before = lastId;
      const messages = await channel.messages.fetch(options);
      if (messages.size === 0) break;
      for (const msg of Array.from(messages.values()).reverse()) {
        await processMessage(msg);
      }
      lastId = messages.last().id;
      fetchedCount += messages.size;
      console.log(`📥 Đã load: ${fetchedCount} tin`);
      await sleep(350);
    } catch (err) {
      console.error("⚠️ Lỗi fetch messages (retry):", err.message);

      await sleep(1500);
    }
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
  if (!isBackfilling) {
  try {
    await db.execute(
      `INSERT IGNORE INTO kill_logs
       (discord_message_id, killer, weapon, victim, victimId, killerId, distance, time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        message.id,
        logData.killer,
        logData.weapon,
        logData.victim,
        logData.victimId,
        logData.killerId,
        logData.distance,
        new Date(logData.time)
      ]
    );
  } catch (err) {
    console.error("❌ DB insert error:", err.message);
  }
}
  try {
    await axios.post(
      `http://localhost:${process.env.PORT}/api/logs`,
      logData,
      {
        headers: {
          Authorization: `Bearer ${process.env.INTERNAL_JWT}`
        }
      }
    );
  } catch (err) {
    console.error("❌ Lỗi gửi log:", err.message);
  }
}

client.on('messageCreate', processMessage);

async function loadLogsFromDB() {
  try {
    const [rows] = await db.execute(
      "SELECT * FROM kill_logs ORDER BY time DESC LIMIT 8000"
    );

    logs = rows.map(r => ({
      killer: r.killer,
      weapon: r.weapon,
      victim: r.victim,
      victimId: r.victimId,
      killerId: r.killerId,
      distance: r.distance,
      time: r.time
    }));
    console.log(`🗄️ Đã load ${logs.length} logs từ DB`);
  } catch (err) {
    console.error("❌ Load DB logs error:", err.message);
  }
}
(async () => {
  await loadLogsFromDB();
  server.listen(process.env.PORT, () => {
    console.log(`🚀 Server chạy tại http://localhost:${process.env.PORT}`);
  });
})();
client.login(process.env.DISCORD_TOKEN);
