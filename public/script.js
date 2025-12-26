if (!localStorage.getItem("jwt")) {
  window.location.href = "/login.html";
}
const socket = io({
  auth: {
    token: localStorage.getItem("jwt")
  }
});
let allLogs = [];
let currentFilterVictimId = "";
let currentFilterKillerId = "";
let currentFilterDay = null;
let currentFilterMonthYear = null;
let currentFilterTime = null;
let currentFilterOffset = 0;

function authHeaders() {
  const token = localStorage.getItem("jwt");
  return {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + token
  };
}
function renderLogs(logs) {
  const tbody = document.getElementById('logTable');
  tbody.innerHTML = '';

  let filteredLogs = logs;

  if (!currentFilterVictimId && !currentFilterTime) {
    filteredLogs = logs.slice(0, 20);
  }

  if (filteredLogs.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="6" style="text-align:center; padding:10px;">Không có dữ liệu</td>`;
    tbody.appendChild(tr);
  } else {
    filteredLogs.forEach(log => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${log.killer}</td>
        <td>${log.weapon}</td>
        <td>${log.victim}</td>
        <td>${log.distance}</td>
        <td>${new Date(log.time).toLocaleString()}</td>
        <td><button class="actionBtn" data-killer="${log.killer}" data-victim="${log.victimId}">Hành động</button></td>
      `;
      tbody.appendChild(tr);
    });
  }

  const countBox = document.getElementById("logCount");

  if (!currentFilterVictimId && !currentFilterTime)
    countBox.innerText = `Đang hiển thị ${filteredLogs.length} / ${logs.length} log mới nhất`;
  else
    countBox.innerText = `Đang hiển thị ${filteredLogs.length} kết quả lọc`;
}

function applyCurrentFilter(logs) {
  let filtered = logs;

  if (currentFilterVictimId)
    filtered = filtered.filter(l => String(l.victimId) === String(currentFilterVictimId));

  if (currentFilterKillerId)
    filtered = filtered.filter(l => String(l.killerId) === String(currentFilterKillerId));

  if (currentFilterDay && currentFilterMonthYear && currentFilterTime) {
    const [month, year] = currentFilterMonthYear.split("/").map(Number);
    const [hour, minute] = currentFilterTime.split(":").map(Number);
    const baseTime = new Date(year, month - 1, currentFilterDay, hour, minute);

    const minTime = new Date(baseTime.getTime() - currentFilterOffset * 60000);
    const maxTime = new Date(baseTime.getTime() + currentFilterOffset * 60000);

    filtered = filtered.filter(l => {
      const t = new Date(l.time);
      return t >= minTime && t <= maxTime;
    });
  }

  return filtered;
}

document.getElementById('victimId').addEventListener('input', e => {
  currentFilterVictimId = e.target.value.trim();
  renderLogs(applyCurrentFilter(allLogs));
});

document.getElementById('killerId').addEventListener('input', e => {
  currentFilterKillerId = e.target.value.trim();
  renderLogs(applyCurrentFilter(allLogs));
});

document.getElementById('filterDay').addEventListener('input', e => {
  currentFilterDay = parseInt(e.target.value) || null;
  renderLogs(applyCurrentFilter(allLogs));
});

document.getElementById('filterMonthYear').addEventListener('input', e => {
  currentFilterMonthYear = e.target.value.trim();
  renderLogs(applyCurrentFilter(allLogs));
});

document.getElementById('filterTime').addEventListener('input', e => {
  let v = e.target.value.replace(/\D/g, "");
  if (v.length === 4) {
    e.target.value = v.slice(0, 2) + ":" + v.slice(2);
    currentFilterTime = e.target.value;
  } else currentFilterTime = null;

  renderLogs(applyCurrentFilter(allLogs));
});

document.getElementById('filterOffset').addEventListener('input', e => {
  currentFilterOffset = parseInt(e.target.value) || 0;
  renderLogs(applyCurrentFilter(allLogs));
});

function clearFilter() {
  document.getElementById('victimId').value = "";
  document.getElementById('killerId').value = "";
  document.getElementById('filterDay').value = "";
  document.getElementById('filterMonthYear').value = "";
  document.getElementById('filterTime').value = "";
  document.getElementById('filterOffset').value = "";

  currentFilterVictimId = "";
  currentFilterKillerId = "";
  currentFilterDay = null;
  currentFilterMonthYear = null;
  currentFilterTime = null;
  currentFilterOffset = 0;

  renderLogs(allLogs);
}

async function loadInitialLogs() {
  try {
    const res = await fetch('/api/logs', {
  headers: authHeaders()
});
    allLogs = await res.json();
    renderLogs(applyCurrentFilter(allLogs));
  } catch (err) {
    console.error(err);
  }
}

socket.on('newLog', log => {
  allLogs.unshift(log);
  renderLogs(applyCurrentFilter(allLogs));
});

const modal = document.getElementById("penaltyModal");
const closeBtn = document.querySelector(".close");

function openPenaltyModal(killer) {
  modal.style.display = "block";
  document.getElementById("penaltyCitizenId").value = killer;
  updatePenaltyFormVisibility();
  updatePenaltyPreview();
}

closeBtn.onclick = () => modal.style.display = "none";
window.onclick = e => { if (e.target === modal) modal.style.display = "none"; };

function updatePenaltyFormVisibility() {
  const template = document.getElementById("penaltyTemplate").value;

  document.getElementById("penaltyPostField").style.display = "none";
  document.getElementById("penaltyReasonField").style.display = "none";
  document.getElementById("penaltyPunishmentField").style.display = "none";

  if (template === "1") {
    document.getElementById("penaltyPostField").style.display = "block";
    document.getElementById("penaltyReasonField").style.display = "block";
    document.getElementById("penaltyPunishmentField").style.display = "block";
  } else if (template === "2") {
    document.getElementById("penaltyReasonField").style.display = "block";
    document.getElementById("penaltyPunishmentField").style.display = "block";
  }
}

function updatePenaltyPreview() {
  const template = document.getElementById("penaltyTemplate").value;
  const citizenId = document.getElementById("penaltyCitizenId").value;
  const post = document.getElementById("penaltyPost").value;
  const reason = document.getElementById("penaltyReason").value;
  const punishment = document.getElementById("penaltyPunishment").value;

  let content = "";

  if (template === "1") {
    content =
`## ⛔ Xử phạt
> **Công dân:** ${citizenId}
> **Bài tố cáo**: ${post}
> **Lý do:** ${reason}
> **Án phạt:** ${punishment}`;
  } else {
    content =
`## ⛔ Xử phạt
> **Công dân:** ${citizenId}
> **Lý do:** ${reason}
> **Án phạt:** ${punishment}`;
  }

  document.getElementById("penaltyPreview").innerText = content;
}

document.getElementById("penaltyTemplate").addEventListener("change", () => {
  updatePenaltyFormVisibility();
  updatePenaltyPreview();
});

["penaltyCitizenId", "penaltyPost", "penaltyReason", "penaltyPunishment"]
  .forEach(id => document.getElementById(id).addEventListener("input", updatePenaltyPreview));

document.getElementById("penaltyForm").addEventListener("submit", async e => {
  e.preventDefault();

  const data = {
    template: document.getElementById("penaltyTemplate").value,
    citizenId: document.getElementById("penaltyCitizenId").value,
    post: document.getElementById("penaltyPost").value,
    reason: document.getElementById("penaltyReason").value,
    punishment: document.getElementById("penaltyPunishment").value,
    account: document.getElementById("penaltyAccount").value
  };

  try {
    const res = await fetch("/api/sendMessage", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(data)
    });

    const result = await res.json();

    if (result.success) {
      Swal.fire({
        icon: 'success',
        title: 'Xong!',
        text: 'Gửi rồi đấy',
        confirmButtonColor: '#3085d6'
      }).then(() => modal.style.display = "none");
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Lỗi khi gửi!',
        text: result.error || 'Không thể gửi tin nhắn',
        confirmButtonColor: '#d33'
      });
    }
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'Lỗi hệ thống!',
      text: err.message,
      confirmButtonColor: '#d33'
    });
  }
});

const actionSelectModal = document.getElementById("actionSelectModal");
const closeActionSelect = document.querySelector(".closeActionSelect");

let selectedVictim = "";
let selectedKiller = "";
let selectedId = "";

function openActionSelect(id) {
  selectedId = id;
  document.getElementById("selectedActionUserId").innerText = id;
  actionSelectModal.style.display = "block";
}

closeActionSelect.onclick = () => actionSelectModal.style.display = "none";

window.onclick = e => {
  if (e.target === actionSelectModal) actionSelectModal.style.display = "none";
};

document.addEventListener("click", e => {
  if (e.target.classList.contains("actionBtn")) {
    selectedVictim = e.target.dataset.victim;
    selectedKiller = e.target.dataset.killer;
    openActionSelect(selectedVictim);
  }
});

document.getElementById("selectTeleport").onclick = () => {
  actionSelectModal.style.display = "none";
  document.getElementById("teleportUserId").innerText = selectedVictim;
  teleportModal.style.display = "block";
};

document.getElementById("selectRevive").onclick = () => {
  actionSelectModal.style.display = "none";
  document.getElementById("reviveUserId").innerText = selectedVictim;
  reviveModal.style.display = "block";
};

document.getElementById("selectPenalty").onclick = () => {
  actionSelectModal.style.display = "none";
  openPenaltyModal(selectedKiller);
};

const teleportModal = document.getElementById("teleportModal");
const closeTeleport = document.querySelector(".closeTeleport");

closeTeleport.onclick = () => teleportModal.style.display = "none";

document.getElementById("sendTeleportBtn").onclick = async () => {
  const location = document.getElementById("teleportLocation").value;

  try {
    const res = await fetch("/api/action", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        type: "teleport",
        id: selectedVictim,
        location
      })
    });

    const data = await res.json();

    if (data.success) {
      Swal.fire({
        icon: 'success',
        title: 'Teleport thành công!',
        text: `Đã teleport người chơi ${selectedVictim} đến ${location.toUpperCase()}`,
        confirmButtonColor: '#3085d6'
      }).then(() => teleportModal.style.display = "none");
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Lỗi teleport!',
        text: data.error || 'Không gửi được lệnh.',
        confirmButtonColor: '#d33'
      });
    }
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'Lỗi hệ thống!',
      text: err.message,
      confirmButtonColor: '#d33'
    });
  }
};

const reviveModal = document.getElementById("reviveModal");
const closeRevive = document.querySelector(".closeRevive");

closeRevive.onclick = () => reviveModal.style.display = "none";

document.getElementById("sendReviveBtn").onclick = async () => {
  try {
    const res = await fetch("/api/action", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        type: "revive",
        id: selectedVictim
      })
    });

    const data = await res.json();

    if (data.success) {
      Swal.fire({
        icon: 'success',
        title: 'Revive thành công!',
        text: `Đã revive người chơi ${selectedVictim}`,
        confirmButtonColor: '#27ae60'
      }).then(() => reviveModal.style.display = "none");
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Lỗi revive!',
        text: data.error || 'Không gửi được lệnh.',
        confirmButtonColor: '#d33'
      });
    }
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'Lỗi hệ thống!',
      text: err.message,
      confirmButtonColor: '#d33'
    });
  }
};

loadInitialLogs();
