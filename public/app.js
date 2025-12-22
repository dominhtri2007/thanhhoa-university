const socket = io();

const senderInput = document.getElementById("senderId");
const fromInput = document.getElementById("fromDate");
const toInput = document.getElementById("toDate");
const tbody = document.querySelector("#invoiceTable tbody");
const info = document.getElementById("info");
const statBtn = document.getElementById("statBtn");
const statResult = document.getElementById("statResult");

let currentData = [];
let chart;
let weeklyChart;

function sendSearch() {
  socket.emit("search", {
    senderId: senderInput.value.trim(),
    fromDate: fromInput.value,
    toDate: toInput.value,
  });
}

function renderInvoices(data) {
  tbody.innerHTML = "";
  currentData = data;

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4">Không tìm thấy hóa đơn nào</td></tr>`;
    info.textContent = "";
    return;
  }

  data.forEach(m => addInvoiceRow(m, false));

  if (senderInput.value.trim()) {
    info.textContent = `Đang hiển thị ${data.length} hóa đơn của ID ${senderInput.value.trim()}`;
  } else {
    info.textContent = `Đang hiển thị ${data.length}/20 hóa đơn mới nhất`;
  }
}

function addInvoiceRow(m, prepend = true) {
  const sender = m.fields.find(f => f.name.includes("người gửi"))?.value || "";
  const receiver = m.fields.find(f => f.name.includes("người nhận"))?.value || "";
  const amount = m.fields.find(f => f.name.includes("số tiền"))?.value || "";

  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>${sender}</td>
    <td>${receiver}</td>
    <td>${amount}</td>
    <td>${new Date(m.timestamp).toLocaleString()}</td>
  `;

  if (prepend) {
    tbody.prepend(tr);
    currentData.unshift(m);
  } else {
    tbody.appendChild(tr);
  }
}

function updateChartRealtime(data) {
  const daily = {};
  data.forEach(m => {
    const date = new Date(m.timestamp).toLocaleDateString("vi-VN");
    const amount = parseInt(m.fields.find(f => f.name.includes("số tiền"))?.value || 0, 10);
    daily[date] = (daily[date] || 0) + amount;
  });

  const labels = Object.keys(daily);
  const values = labels.map(l => daily[l]);

  if (!chart) {
    const ctx = document.getElementById("chartRevenue").getContext("2d");
    chart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Doanh thu theo ngày",
          data: values,
          borderColor: "#3a82f7",
          backgroundColor: "rgba(58,130,247,0.2)",
          fill: true,
          tension: 0.2
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: "#fff" } } },
        scales: {
          x: { ticks: { color: "#fff" }, grid: { color: "#444" } },
          y: { ticks: { color: "#fff" }, grid: { color: "#444" } }
        }
      }
    });
  } else {
    chart.data.labels = labels;
    chart.data.datasets[0].data = values;
    chart.update();
  }
}

function updateWeeklyChartRealtime(data) {
  const weekly = {};
  const now = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(now.getDate() - 6);

  data.forEach(m => {
    const date = new Date(m.timestamp);
    if (date >= sevenDaysAgo && date <= now) {
      const key = date.toLocaleDateString("vi-VN");
      const amount = parseInt(m.fields.find(f => f.name.includes("số tiền"))?.value || 0, 10);
      weekly[key] = (weekly[key] || 0) + amount;
    }
  });

  const labels = Object.keys(weekly);
  const values = labels.map(l => weekly[l]);

  if (!weeklyChart) {
    const ctx = document.getElementById("chartWeekly").getContext("2d");
    weeklyChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Doanh thu theo tuần (7 ngày gần nhất)",
          data: values,
          backgroundColor: "rgba(58,130,247,0.6)"
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: "#fff" } } },
        scales: {
          x: { ticks: { color: "#fff" }, grid: { color: "#444" } },
          y: { ticks: { color: "#fff" }, grid: { color: "#444" } }
        }
      }
    });
  } else {
    weeklyChart.data.labels = labels;
    weeklyChart.data.datasets[0].data = values;
    weeklyChart.update();
  }
}

function updateStatsRealtime(data) {
  const total = data.reduce((sum, m) => {
    const amount = parseInt(m.fields.find(f => f.name.includes("số tiền"))?.value || 0, 10);
    return sum + amount;
  }, 0);

  document.getElementById("totalInvoices").textContent = data.length;
  document.getElementById("totalRevenue").textContent = total.toLocaleString();
}

senderInput.addEventListener("input", sendSearch);
fromInput.addEventListener("change", sendSearch);
toInput.addEventListener("change", sendSearch);

socket.on("result", renderInvoices);

statBtn.addEventListener("click", () => {
  socket.emit("statistic", {
    senderId: senderInput.value.trim(),
    fromDate: fromInput.value,
    toDate: toInput.value,
  });
});

socket.on("statisticResult", ({ count, total }) => {
  statResult.textContent = `ID này có ${count} hóa đơn, tổng số tiền là ${total.toLocaleString()} VND`;
});

socket.on("newInvoice", invoice => {
  addInvoiceRow(invoice, true);
  if (senderInput.value.trim()) {
    info.textContent = `Đang hiển thị ${currentData.length} hóa đơn của ID ${senderInput.value.trim()}`;
  } else {
    info.textContent = `Đang hiển thị ${currentData.length}/20 hóa đơn mới nhất`;
  }

  socket.emit("getAllInvoices");
});

sendSearch();
socket.emit("getAllInvoices");

socket.on("allInvoices", data => {
  updateChartRealtime(data);
  updateWeeklyChartRealtime(data);
  updateStatsRealtime(data);
});
