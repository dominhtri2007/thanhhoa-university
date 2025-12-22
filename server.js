require("dotenv").config();
const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const { Client, GatewayIntentBits } = require("discord.js");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3006;

app.use(express.static(path.join(__dirname, "public")));

let invoices = [];

const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

async function fetchAllMessages(channel) {
  let allMessages = [];
  let lastId;

  while (true) {
    const options = { limit: 100 };
    if (lastId) options.before = lastId;

    const messages = await channel.messages.fetch(options);
    if (messages.size === 0) break;

    allMessages = allMessages.concat(Array.from(messages.values()));
    lastId = messages.last().id;

    if (allMessages.length > 20000) break; 
  }
  return allMessages;
}

discordClient.login(process.env.DISCORD_TOKEN);

discordClient.on("ready", async () => {
  console.log(`Bot logged in as ${discordClient.user.tag}`);
  const channelId = process.env.DISCORD_CHANNEL;
  const channel = await discordClient.channels.fetch(channelId);

  if (channel) {
    console.log("Đang tải toàn bộ tin nhắn...");
    const messages = await fetchAllMessages(channel);

    invoices = messages
      .filter(m => m.embeds.length > 0)
      .map(m => {
        const embed = m.embeds[0];
        return {
          title: embed.title || "",
          description: embed.description || "",
          fields: embed.fields?.map(f => ({
            name: f.name.trim().toLowerCase(), 
            value: f.value,
          })),
          footer: embed.footer?.text || "",
          timestamp: m.createdTimestamp,
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp);

    console.log(`Đã load xong: ${invoices.length} hóa đơn`);
  }
});

discordClient.on("messageCreate", msg => {
  if (msg.channelId === process.env.DISCORD_CHANNEL && msg.embeds.length > 0) {
    const embed = msg.embeds[0];
    const invoice = {
      title: embed.title || "",
      description: embed.description || "",
      fields: embed.fields?.map(f => ({
        name: f.name.trim().toLowerCase(),
        value: f.value,
      })),
      footer: embed.footer?.text || "",
      timestamp: msg.createdTimestamp,
    };
    invoices.unshift(invoice);
    io.emit("newInvoice", invoice);
  }
});

io.on("connection", socket => {
  //console.log("Client connected");

  socket.on("search", ({ senderId, fromDate, toDate }) => {
    let result = invoices;

    if (senderId) {
      result = result.filter(inv =>
        inv.fields.some(
          f => f.name.includes("người gửi") && f.value.includes(senderId)
        )
      );
    }

    if (fromDate) {
      const from = new Date(fromDate);
      from.setHours(0, 0, 0, 0);
      result = result.filter(inv => inv.timestamp >= from.getTime());
    }

    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      result = result.filter(inv => inv.timestamp <= to.getTime());
    }

    if (!senderId) {
      result = result.slice(0, 20);
    }

    socket.emit("result", result);
  });

  socket.on("statistic", ({ senderId, fromDate, toDate }) => {
    let result = invoices;

    if (senderId) {
      result = result.filter(inv =>
        inv.fields.some(
          f => f.name.includes("người gửi") && f.value.includes(senderId)
        )
      );
    }

    if (fromDate) {
      const from = new Date(fromDate);
      from.setHours(0, 0, 0, 0);
      result = result.filter(inv => inv.timestamp >= from.getTime());
    }

    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      result = result.filter(inv => inv.timestamp <= to.getTime());
    }

    const count = result.length;
    const total = result.reduce((sum, inv) => {
      const amountField = inv.fields.find(f => f.name.includes("số tiền"));
      return sum + (amountField ? parseInt(amountField.value, 10) : 0);
    }, 0);

    socket.emit("statisticResult", { count, total });
  });

socket.on("getAllInvoices", () => {
    socket.emit("allInvoices", invoices);
  });

  socket.on("getMessageStatsByHour", ({ date }) => {
    const day = new Date(date);
    const start = new Date(day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(day);
    end.setHours(23, 59, 59, 999);

    const dayMessages = invoices.filter(
      inv => inv.timestamp >= start.getTime() && inv.timestamp <= end.getTime()
    );

    const hourlyStats = Array(24).fill(0);
    dayMessages.forEach(inv => {
      const hour = new Date(inv.timestamp).getHours();
      hourlyStats[hour]++;
    });

    socket.emit("messageStatsByHour", hourlyStats);
  });
});

server.listen(process.env.PORT, () => {
  console.log(`🚀 Web server chạy ở http://localhost:${process.env.PORT}`);
});