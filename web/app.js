/* ── Вспомогательные функции ─────────────────────────────────────────────── */
const out = document.getElementById("output");

function logLine(title, payload) {
  const ts   = new Date().toISOString();
  const text = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  out.textContent = `[${ts}] ${title}\n${text}\n\n` + out.textContent;
}

function getTokens() {
  return {
    access:  document.getElementById("accessToken").value.trim(),
    refresh: document.getElementById("refreshToken").value.trim()
  };
}

function setTokens(tokens) {
  if (tokens.access_token)  document.getElementById("accessToken").value  = tokens.access_token;
  if (tokens.refresh_token) document.getElementById("refreshToken").value = tokens.refresh_token;
}

function bind(id, event, handler) {
  const el = document.getElementById(id);
  if (!el) {
    console.warn(`Missing element: ${id}`);
    return;
  }
  el.addEventListener(event, handler);
}

/* ── Базовые обёртки для fetch ───────────────────────────────────────────── */
async function api(path, method, body, auth = false) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const t = getTokens().access;
    if (!t) throw new Error("Access token is empty — login first");
    headers.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = {};
  try { data = await res.json(); } catch (_) { data = { raw: await res.text() }; }
  if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(data)}`);
  return data;
}

/* Отправка multipart/form-data (загрузка файлов). */
async function apiForm(path, formData) {
  const t = getTokens().access;
  if (!t) throw new Error("Access token is empty — login first");
  const res = await fetch(path, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}` },
    body: formData
  });
  let data = {};
  try { data = await res.json(); } catch (_) { data = { raw: await res.text() }; }
  if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(data)}`);
  return data;
}

/* Скачивание файла: создаёт временную ссылку и инициирует загрузку. */
async function apiDownload(path, suggestedName) {
  const t = getTokens().access;
  if (!t) throw new Error("Access token is empty — login first");
  const res = await fetch(path, { headers: { Authorization: `Bearer ${t}` } });
  if (!res.ok) {
    let err = {};
    try { err = await res.json(); } catch (_) {}
    throw new Error(`${res.status}: ${JSON.stringify(err)}`);
  }
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), { href: url, download: suggestedName });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return `Downloaded ${suggestedName} (${blob.size} bytes, type: ${blob.type || "unknown"})`;
}

/* ── Session ─────────────────────────────────────────────────────────────── */
bind("btnRefresh", "click", async () => {
  try {
    const data = await api("/auth/refresh", "POST", { refresh_token: getTokens().refresh });
    setTokens(data);
    logLine("Tokens refreshed", data);
  } catch (err) { logLine("Refresh error", err.message); }
});

bind("btnLogout", "click", async () => {
  try {
    const data = await api("/auth/logout", "POST", { refresh_token: getTokens().refresh }, true);
    document.getElementById("accessToken").value  = "";
    document.getElementById("refreshToken").value = "";
    logLine("Logged out", data);
  } catch (err) { logLine("Logout error", err.message); }
});

bind("btnClearTokens", "click", () => {
  document.getElementById("accessToken").value  = "";
  document.getElementById("refreshToken").value = "";
  logLine("Tokens cleared", "");
});

bind("btnClearOutput", "click", () => {
  out.textContent = "Ready.";
});

/* ── Auth ────────────────────────────────────────────────────────────────── */
bind("registerForm", "submit", async (e) => {
  e.preventDefault();
  try {
    const data = await api("/auth/register", "POST", {
      email:     document.getElementById("regEmail").value,
      password:  document.getElementById("regPassword").value,
      full_name: document.getElementById("regFullName").value
    });
    logLine("Registered", data);
  } catch (err) { logLine("Register error", err.message); }
});

bind("loginForm", "submit", async (e) => {
  e.preventDefault();
  try {
    const data = await api("/auth/login", "POST", {
      email:    document.getElementById("loginEmail").value,
      password: document.getElementById("loginPassword").value
    });
    setTokens(data);
    logLine("Logged in", data);
  } catch (err) { logLine("Login error", err.message); }
});

/* ── Profile ─────────────────────────────────────────────────────────────── */
bind("btnGetProfile", "click", async () => {
  try {
    const data = await api("/profile/", "GET", null, true);
    logLine("Profile", data);
  } catch (err) { logLine("Get profile error", err.message); }
});

bind("updateProfileForm", "submit", async (e) => {
  e.preventDefault();
  try {
    const data = await api("/profile/", "PATCH", {
      full_name: document.getElementById("profileFullName").value
    }, true);
    logLine("Profile updated", data);
  } catch (err) { logLine("Update profile error", err.message); }
});

/* ── Loans ───────────────────────────────────────────────────────────────── */
bind("createLoanForm", "submit", async (e) => {
  e.preventDefault();
  try {
    const data = await api("/loans/", "POST", {
      amount_cents: Number(document.getElementById("loanAmount").value),
      currency:     document.getElementById("loanCurrency").value,
      term_months:  Number(document.getElementById("loanTerm").value),
      purpose:      document.getElementById("loanPurpose").value
    }, true);
    logLine("Loan created", data);
  } catch (err) { logLine("Create loan error", err.message); }
});

bind("btnMyLoans", "click", async () => {
  try {
    const data = await api("/loans/my", "GET", null, true);
    logLine("My loans", data);
  } catch (err) { logLine("My loans error", err.message); }
});

bind("getLoanByIDForm", "submit", async (e) => {
  e.preventDefault();
  try {
    const id   = document.getElementById("loanId").value;
    const data = await api(`/loans/${id}`, "GET", null, true);
    logLine(`Loan #${id}`, data);
  } catch (err) { logLine("Get loan error", err.message); }
});

/* ── Documents ───────────────────────────────────────────────────────────── */
bind("docFile", "change", (e) => {
  const name = e.target.files[0]?.name ?? "No file chosen";
  document.getElementById("docFileName").textContent = name;
});

bind("uploadDocForm", "submit", async (e) => {
  e.preventDefault();
  const loanId = document.getElementById("uploadLoanId").value;
  const file   = document.getElementById("docFile").files[0];
  if (!file) { logLine("Upload error", "No file selected"); return; }
  try {
    const fd = new FormData();
    fd.append("document", file);
    const data = await apiForm(`/loans/${loanId}/documents/`, fd);
    logLine(`Document uploaded to loan #${loanId}`, data);
  } catch (err) { logLine("Upload error", err.message); }
});

bind("downloadDocForm", "submit", async (e) => {
  e.preventDefault();
  const loanId   = document.getElementById("downloadLoanId").value;
  const filename = document.getElementById("downloadFilename").value;
  try {
    const result = await apiDownload(`/loans/${loanId}/documents/${filename}`, filename);
    logLine("Document downloaded", result);
  } catch (err) { logLine("Download error", err.message); }
});

/* ── Manager: decisions ──────────────────────────────────────────────────── */
bind("btnPending", "click", async () => {
  try {
    const data = await api("/manager/loans/pending", "GET", null, true);
    logLine("Pending loans", data);
  } catch (err) { logLine("Pending error", err.message); }
});

bind("decisionForm", "submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("decisionLoanId").value;
  try {
    const data = await api(`/manager/loans/${id}/decision`, "PATCH", {
      status: document.getElementById("decisionStatus").value,
      reason: document.getElementById("decisionReason").value
    }, true);
    logLine(`Decision on loan #${id}`, data);
  } catch (err) { logLine("Decision error", err.message); }
});

/* ── Scoring ─────────────────────────────────────────────────────────────── */
bind("scoreLoanForm", "submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("scoreLoanId").value;
  try {
    const data = await api(`/manager/loans/${id}/score`, "GET", null, true);
    logLine(`Risk score for loan #${id}`, data);
    renderScore(data.score, data.risk_level, `Loan #${data.loan_id}`);
  } catch (err) { logLine("Score error", err.message); }
});

function renderScore(score, riskLevel, meta) {
  const box    = document.getElementById("scoreDisplay");
  const circle = document.getElementById("scoreCircle");
  const label  = document.getElementById("scoreLabel");
  const metaEl = document.getElementById("scoreMeta");
  const level  = (riskLevel || "").toLowerCase();
  circle.textContent = score;
  circle.className   = `score-circle ${level}`;
  label.textContent  = level || "-";
  label.className    = `score-label ${level}`;
  metaEl.textContent = meta;
  box.classList.remove("hidden");
}

/* ── Reports ─────────────────────────────────────────────────────────────── */
bind("btnExportCSV", "click", async () => {
  const status   = document.getElementById("exportStatus").value;
  const currency = document.getElementById("exportCurrency").value;
  const params   = new URLSearchParams();
  if (status)   params.set("status",   status);
  if (currency) params.set("currency", currency);
  try {
    const result = await apiDownload(
      `/manager/reports/export?${params}`,
      `loans_export_${Date.now()}.csv`
    );
    logLine("CSV export downloaded", result);
  } catch (err) { logLine("Export error", err.message); }
});

bind("checksumForm", "submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("checksumLoanId").value;
  try {
    const data = await api(`/manager/reports/checksum?id=${id}`, "GET", null, true);
    logLine(`Checksum for loan #${id}`, data);
  } catch (err) { logLine("Checksum error", err.message); }
});

/* ── Admin ───────────────────────────────────────────────────────────────── */
bind("pingForm", "submit", async (e) => {
  e.preventDefault();
  const host = document.getElementById("pingHost").value;
  try {
    const data = await api(`/admin/ping?host=${encodeURIComponent(host)}`, "GET", null, true);
    logLine(`Ping -> ${host}`, data);
  } catch (err) { logLine("Ping error", err.message); }
});

bind("webhookForm", "submit", async (e) => {
  e.preventDefault();
  const url = document.getElementById("webhookUrl").value;
  try {
    const data = await api(`/admin/webhook-test?url=${encodeURIComponent(url)}`, "GET", null, true);
    logLine(`Webhook test -> ${url}`, data);
  } catch (err) { logLine("Webhook error", err.message); }
});

bind("btnAdminStats", "click", async () => {
  try {
    const data = await api("/admin/stats", "GET", null, true);
    logLine("Admin stats", data);
    renderStats(data);
  } catch (err) { logLine("Stats error", err.message); }
});

function renderStats(data) {
  const grid = document.getElementById("statsDisplay");
  const entries = [
    { val: data.total_users   ?? "-", label: "Users" },
    { val: data.total_loans   ?? "-", label: "Loans total" },
    { val: data.pending_loans ?? "-", label: "Pending" }
  ];
  grid.innerHTML = entries.map(e =>
    `<div class="stat-card">
       <div class="stat-val">${e.val}</div>
       <div class="stat-key">${e.label}</div>
     </div>`
  ).join("");
  grid.classList.remove("hidden");
}
