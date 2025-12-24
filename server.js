require("dotenv").config();
const fs = require("fs");
const express = require("express");
const { Client, GatewayIntentBits, Events } = require("discord.js");

/* ================== EXPRESS ================== */
const app = express();
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
const DATA_FILE = "fundData.json";

/* ================== DATA ================== */
function loadData() {
  if (!fs.existsSync(DATA_FILE)) return {};
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

/* ================== DISCORD BOT ================== */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

/* ================== REGEX ================== */
const depositRegex = /đã gửi\s+\$([\d]+)/i;
const withdrawRegex = /đã rút\s+\$([\d]+)/i;
const fundRegex = /vào quỹ\s+([a-zA-Z0-9_]+)|từ quỹ\s+([a-zA-Z0-9_]+)/i;
const balanceRegex = /Số tiền (?:hiện tại|còn lại):\s*\$([\d]+)/i;

/* ================== XỬ LÝ LOG ================== */
function processMessage(msg, data) {
  if (!msg.embeds.length) return false;

  const embed = msg.embeds[0];
  const title = embed.title || "";
  const desc = embed.description || "";

  const fundMatch = desc.match(fundRegex);
  if (!fundMatch) return false;

  const fund = (fundMatch[1] || fundMatch[2]).toLowerCase();

  if (!data[fund]) {
    data[fund] = {
      deposit: 0,
      withdraw: 0,
      balance: 0,
      lastUpdate: null
    };
  }

  if (title === "Deposit Money") {
    const m = desc.match(depositRegex);
    if (m) data[fund].deposit += parseInt(m[1]);
  }

  if (title === "Withdraw Money") {
    const m = desc.match(withdrawRegex);
    if (m) data[fund].withdraw += parseInt(m[1]);
  }

  const bal = desc.match(balanceRegex);
  if (bal) {
    data[fund].balance = parseInt(bal[1]);
    data[fund].lastUpdate = msg.createdAt.toISOString();
  }

  return true;
}

/* ================== LOAD TOÀN BỘ LOG ================== */
async function loadAllHistory() {
  const channel = await client.channels.fetch(process.env.LOG_CHANNEL_ID);
  if (!channel || !channel.isTextBased()) {
    console.log("❌ Không tìm thấy channel log");
    return;
  }

  let lastId = null;
  let totalMessages = 0;
  let validLogs = 0;
  let data = {};

  console.log("⏳ Bắt đầu load toàn bộ log cũ...");

  while (true) {
    const messages = await channel.messages.fetch({
      limit: 100,
      before: lastId
    });

    if (messages.size === 0) break;

    for (const msg of messages.values()) {
      totalMessages++;

      if (!msg.author.bot) {
        lastId = msg.id;
        continue;
      }

      if (processMessage(msg, data)) {
        validLogs++;
      }

      lastId = msg.id;
    }

    console.log(
      `📥 Đã load ${totalMessages} tin | Log hợp lệ: ${validLogs}`
    );

    await new Promise((r) => setTimeout(r, 250));
  }

  saveData(data);

  console.log(`✅ HOÀN TẤT – Tổng log hợp lệ: ${validLogs}`);
}

/* ================== EVENTS ================== */
client.once(Events.ClientReady, async () => {
  console.log(`🤖 Bot online: ${client.user.tag}`);
  await loadAllHistory();
});

client.on(Events.MessageCreate, (msg) => {
  if (!msg.author.bot) return;
  if (msg.channel.id !== process.env.LOG_CHANNEL_ID) return;

  const data = loadData();
  if (processMessage(msg, data)) {
    saveData(data);
    console.log("📌 Log mới đã được ghi");
  }
});

/* ================== API ================== */
app.get("/api/fund/:key", (req, res) => {
  const fund = req.params.key.toLowerCase();
  const data = loadData();

  if (!data[fund]) {
    return res.json({ error: "Quỹ không tồn tại" });
  }

  res.json({
    fund,
    totalDeposit: data[fund].deposit,
    totalWithdraw: data[fund].withdraw,
    balance: data[fund].balance,
    lastUpdate: data[fund].lastUpdate
  });
});
app.get("/api/funds", (req, res) => {
  const data = loadData();

  const keys = [
    "rongdo",
    "khongchalimex",
    "quanrauma",
    "petrol36",
    "mechanic",
    "barber",
    "cardealer",
    "tacoo"
  ];

  const result = keys.map((key) => {
    const fund = data[key] || {
      deposit: 0,
      withdraw: 0,
      balance: 0,
      lastUpdate: null
    };

    return {
      key,
      deposit: fund.deposit,
      withdraw: fund.withdraw,
      balance: fund.balance,
      lastUpdate: fund.lastUpdate
    };
  });

  res.json(result);
});

/* ================== START ================== */
app.listen(PORT, () => {
  console.log(`🌐 Web chạy tại: http://localhost:${PORT}`);
});

client.login(process.env.DISCORD_TOKEN);
