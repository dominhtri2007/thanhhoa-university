
# Discord Kill Log Panel + Action Bot 

Hệ thống **Panel web + Discord Bot** dùng để:
- Theo dõi log kill từ Discord embed
- Hiển thị realtime trên web (Socket.IO)
- Teleport / Revive người chơi
- Gửi thông báo xử phạt Discord
- Quản lý bằng đăng nhập JWT

⚠️ **Toàn bộ log chỉ lưu trong RAM (memory)**  
→ Restart server là **mất log cũ**.

---

## 🧩 Công nghệ sử dụng
- Node.js
- Express
- Discord.js v14
- Socket.IO
- JWT Authentication
- Fetch Discord API (Bot Token + User Token)

---

## 📁 Cấu trúc dự án

text
project/
├── server.js        # Backend + Discord Bot (1 file)
├── package.json
├── .env             # ❌ KHÔNG push
├── .gitignore
└── public/
    ├── index.html
    ├── login.html
    └── script.js    # Frontend logic

## 🔐 Cấu hình `.env`

env
# ================= SERVER =================
PORT=

# ================= DISCORD =================
DISCORD_TOKEN=            # Bot token Discord
CHANNEL_ID=               # Channel chứa embed log (Player Death)
SEND_CHANNEL_ID=          # Channel bot gửi thông báo xử phạt
ACTION_CHANNEL_ID=        # Channel nhận lệnh teleport / revive
USER_TOKEN=               # Token user Discord (self-bot)

# ================= AUTH =================
JWT_SECRET=               # Secret ký JWT (ví dụ: mysecret123)
JWT_EXPIRE=2h             # Thời gian hết hạn token
INTERNAL_JWT=             # Token nội bộ server gọi API

ADMIN_USER=admin          # Tài khoản đăng nhập panel
ADMIN_PASS=123456         # Mật khẩu đăng nhập panel
````
---

## 🔑 Đăng nhập Panel

### API

```
POST /login
```

Body:

```json
{
  "username": "admin",
  "password": "123456"
}
```

Response:

```json
{
  "token": "JWT_TOKEN"
}
```

Token được lưu vào `localStorage` và dùng cho toàn bộ panel.

---

## 📡 API sử dụng

### 🔹 Lấy danh sách log

```
GET /api/logs
Authorization: Bearer <JWT>
```

---

### 🔹 Nhận log từ bot (nội bộ)

```
POST /api/logs
Authorization: Bearer INTERNAL_JWT
```

---

### 🔹 Gửi thông báo xử phạt Discord

```
POST /api/sendMessage
Authorization: Bearer <JWT>
```

Template:

* `1`: Có bài tố cáo
* `2`: Không có bài tố cáo

---

### 🔹 Hành động (Teleport / Revive)

```
POST /api/action
Authorization: Bearer <JWT>
```

Teleport:

```json
{
  "type": "teleport",
  "id": "123",
  "location": "tx1"
}
```

Revive:

```json
{
  "type": "revive",
  "id": "123"
}
```

---

## 🤖 Discord Bot hoạt động thế nào

* Bot login bằng `DISCORD_TOKEN`
* Lắng nghe embed có title **"Player Death"**
* Parse dữ liệu:

  * Nạn nhân
  * Người gây ra
  * Vũ khí
  * Khoảng cách
* Đẩy log vào server qua API nội bộ
* Phát realtime về web bằng Socket.IO

---

## 🌐 Panel Web

Panel có các chức năng:

* Xem log realtime
* Lọc theo:

  * Victim ID
  * Killer ID
  * Ngày / giờ / khoảng phút
* Teleport người chơi
* Revive người chơi
* Gửi xử phạt Discord
* Không cần reload trang

---

## 🚀 Chạy project

### Cài dependency

```bash
npm install
```

### Chạy server

```bash
node server.js
```

### Chạy bằng PM2 (khuyên dùng)

```bash
pm2 start server.js --name kill-panel
pm2 save
```

---

## ⚠️ CẢNH BÁO BẢO MẬT

* `USER_TOKEN` là **self-bot**
* Discord **có thể ban account**
* Chỉ dùng **account phụ**
* Nếu lộ token → **đổi ngay**

---

## 📝 Ghi chú

* Log chỉ lưu trong RAM
* Restart server = reset log
* Không dùng database
* Phù hợp VPS / Render / local

---

## 📌 Có thể mở rộng

* Lưu log ra file JSON
* Giới hạn số log theo RAM
* Thay USER_TOKEN bằng webhook
* Phân quyền nhiều admin

```

🛠️ Developed & maintained by **tricoder_gojosama**
