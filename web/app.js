const root = document.getElementById("root");

root.innerHTML = `
  <main class="container">
    <h1>Credit MVP</h1>

    <section class="card">
      <h2>Session</h2>
      <div class="grid2">
        <label>Access token
          <textarea id="accessToken" rows="2" placeholder="Paste access token"></textarea>
        </label>
        <label>Refresh token
          <textarea id="refreshToken" rows="2" placeholder="Paste refresh token"></textarea>
        </label>
      </div>
      <div class="actions mt8">
        <button id="btnRefresh" type="button">Refresh tokens</button>
        <button id="btnLogout" type="button" class="btn-warn">Logout</button>
        <button id="btnClearTokens" type="button" class="ghost">Clear</button>
      </div>
    </section>

    <section class="card">
      <h2>Authentication</h2>
      <div class="split">
        <form id="registerForm">
          <h3>Register client</h3>
          <input id="regEmail" type="email" placeholder="client@example.com" required>
          <input id="regPassword" type="password" placeholder="Password (10+ chars)" required>
          <input id="regFullName" type="text" placeholder="Full name" required>
          <button type="submit">Register</button>
        </form>
        <form id="loginForm">
          <h3>Login</h3>
          <input id="loginEmail" type="email" placeholder="email" required>
          <input id="loginPassword" type="password" placeholder="password" required>
          <button type="submit">Login</button>
        </form>
      </div>
    </section>

    <section class="card">
      <h2>Profile</h2>
      <div class="split">
        <div>
          <h3>View my profile</h3>
          <p class="hint">Returns id, email, full_name, role, created_at, loan_limit.</p>
          <button id="btnGetProfile" type="button">Get profile</button>
        </div>
        <form id="updateProfileForm">
          <h3>Update name</h3>
          <input id="profileFullName" type="text" placeholder="New full name" required>
          <button type="submit">Save changes</button>
        </form>
      </div>
    </section>

    <section class="card">
      <h2>Loan applications (client)</h2>
      <div class="split">
        <form id="createLoanForm">
          <h3>Create application</h3>
          <input id="loanAmount" type="number" min="10000" placeholder="amount_cents (e.g. 50000000)" required>
          <select id="loanCurrency" required>
            <option value="RUB">RUB</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
          <input id="loanTerm" type="number" min="1" max="120" placeholder="term_months" required>
          <textarea id="loanPurpose" rows="2" placeholder="Loan purpose" required></textarea>
          <button type="submit">Submit application</button>
        </form>
        <div>
          <h3>My applications</h3>
          <button id="btnMyLoans" type="button">Get my loans</button>
          <form id="getLoanByIDForm" class="mt8">
            <h3>Loan by ID</h3>
            <input id="loanId" type="number" min="1" placeholder="Loan ID" required>
            <button type="submit">Get loan</button>
          </form>
        </div>
      </div>
    </section>

    <section class="card">
      <h2>Documents</h2>
      <div class="split">
        <form id="uploadDocForm">
          <h3>Upload document to loan</h3>
          <input id="uploadLoanId" type="number" min="1" placeholder="Loan ID" required>
          <div class="file-label">
            <label for="docFile">Choose file</label>
            <input id="docFile" type="file" required>
            <span id="docFileName" class="file-name">No file chosen</span>
          </div>
          <button type="submit">Upload</button>
        </form>
        <form id="downloadDocForm">
          <h3>Download document</h3>
          <input id="downloadLoanId" type="number" min="1" placeholder="Loan ID" required>
          <input id="downloadFilename" type="text" placeholder="filename.pdf" required>
          <button type="submit">Download</button>
        </form>
      </div>
    </section>

    <section class="card">
      <h2>Manager - decisions</h2>
      <div class="split">
        <div>
          <h3>Pending applications</h3>
          <button id="btnPending" type="button">Load pending</button>
        </div>
        <form id="decisionForm">
          <h3>Make decision</h3>
          <input id="decisionLoanId" type="number" min="1" placeholder="Loan ID" required>
          <select id="decisionStatus" required>
            <option value="approved">approved</option>
            <option value="rejected">rejected</option>
          </select>
          <textarea id="decisionReason" rows="2" placeholder="Decision reason (5+ chars)" required></textarea>
          <button type="submit">Submit decision</button>
        </form>
      </div>
    </section>

    <section class="card">
      <h2>Credit risk scoring (manager)</h2>
      <div class="split">
        <form id="scoreLoanForm">
          <h3>Calculate risk score</h3>
          <input id="scoreLoanId" type="number" min="1" placeholder="Loan ID" required>
          <button type="submit">Calculate score</button>
          <p class="hint">Returns score 0-100 and risk level (low / medium / high).</p>
        </form>
        <div id="scoreDisplay" class="score-box hidden">
          <div class="score-circle" id="scoreCircle">-</div>
          <div class="score-label" id="scoreLabel">-</div>
          <div class="score-meta" id="scoreMeta"></div>
        </div>
      </div>
    </section>

    <section class="card">
      <h2>Reports (manager)</h2>
      <div class="split">
        <div>
          <h3>Export loans CSV</h3>
          <select id="exportStatus">
            <option value="">all statuses</option>
            <option value="pending">pending</option>
            <option value="approved">approved</option>
            <option value="rejected">rejected</option>
          </select>
          <select id="exportCurrency">
            <option value="">all currencies</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="RUB">RUB</option>
          </select>
          <button id="btnExportCSV" type="button">Download CSV</button>
        </div>
        <form id="checksumForm">
          <h3>Loan integrity checksum</h3>
          <input id="checksumLoanId" type="number" min="1" placeholder="Loan ID" required>
          <button type="submit">Get checksum</button>
        </form>
      </div>
    </section>

    <section class="card">
      <h2>Admin panel (manager only)</h2>
      <div class="split">
        <form id="pingForm">
          <h3>Host ping</h3>
          <input id="pingHost" type="text" placeholder="127.0.0.1" value="127.0.0.1">
          <button type="submit">Ping</button>
        </form>
        <form id="webhookForm">
          <h3>Webhook test</h3>
          <input id="webhookUrl" type="text" placeholder="https://example.com/hook" value="https://httpbin.org/get">
          <button type="submit">Fire request</button>
        </form>
      </div>
      <div class="mt8">
        <h3>Dashboard stats</h3>
        <button id="btnAdminStats" type="button">Load stats</button>
        <div id="statsDisplay" class="stats-grid hidden"></div>
      </div>
    </section>

    <section class="card">
      <h2>Output</h2>
      <div class="actions mb8">
        <button id="btnClearOutput" type="button" class="ghost">Clear output</button>
      </div>
      <pre id="output">Ready.</pre>
    </section>
  </main>
`;

const out = document.getElementById("output");

function logLine(title, payload) {
  const ts = new Date().toISOString();
  const text = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  out.textContent = `[${ts}] ${title}\n${text}\n\n` + out.textContent;
}

function getTokens() {
  return {
    access: document.getElementById("accessToken").value.trim(),
    refresh: document.getElementById("refreshToken").value.trim(),
  };
}

function setTokens(tokens) {
  if (tokens.access_token) document.getElementById("accessToken").value = tokens.access_token;
  if (tokens.refresh_token) document.getElementById("refreshToken").value = tokens.refresh_token;
}

function bind(id, event, handler) {
  const el = document.getElementById(id);
  if (!el) {
    return;
  }
  el.addEventListener(event, handler);
}

async function api(path, method, body, auth = false) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const t = getTokens().access;
    if (!t) throw new Error("Access token is empty - login first");
    headers.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = { raw: await res.text() };
  }
  if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function apiForm(path, formData) {
  const t = getTokens().access;
  if (!t) throw new Error("Access token is empty - login first");
  const res = await fetch(path, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}` },
    body: formData,
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = { raw: await res.text() };
  }
  if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function apiDownload(path, suggestedName) {
  const t = getTokens().access;
  if (!t) throw new Error("Access token is empty - login first");
  const res = await fetch(path, { headers: { Authorization: `Bearer ${t}` } });
  if (!res.ok) {
    let err = {};
    try {
      err = await res.json();
    } catch {}
    throw new Error(`${res.status}: ${JSON.stringify(err)}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: suggestedName });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return `Downloaded ${suggestedName} (${blob.size} bytes, type: ${blob.type || "unknown"})`;
}

bind("btnRefresh", "click", async () => {
  try {
    const data = await api("/auth/refresh", "POST", { refresh_token: getTokens().refresh });
    setTokens(data);
    logLine("Tokens refreshed", data);
  } catch (err) {
    logLine("Refresh error", err.message);
  }
});

bind("btnLogout", "click", async () => {
  try {
    const data = await api("/auth/logout", "POST", { refresh_token: getTokens().refresh }, true);
    document.getElementById("accessToken").value = "";
    document.getElementById("refreshToken").value = "";
    logLine("Logged out", data);
  } catch (err) {
    logLine("Logout error", err.message);
  }
});

bind("btnClearTokens", "click", () => {
  document.getElementById("accessToken").value = "";
  document.getElementById("refreshToken").value = "";
  logLine("Tokens cleared", "");
});

bind("btnClearOutput", "click", () => {
  out.textContent = "Ready.";
});

bind("registerForm", "submit", async (e) => {
  e.preventDefault();
  try {
    const data = await api("/auth/register", "POST", {
      email: document.getElementById("regEmail").value,
      password: document.getElementById("regPassword").value,
      full_name: document.getElementById("regFullName").value,
    });
    logLine("Registered", data);
  } catch (err) {
    logLine("Register error", err.message);
  }
});

bind("loginForm", "submit", async (e) => {
  e.preventDefault();
  try {
    const data = await api("/auth/login", "POST", {
      email: document.getElementById("loginEmail").value,
      password: document.getElementById("loginPassword").value,
    });
    setTokens(data);
    logLine("Logged in", data);
  } catch (err) {
    logLine("Login error", err.message);
  }
});

bind("btnGetProfile", "click", async () => {
  try {
    const data = await api("/profile/", "GET", null, true);
    logLine("Profile", data);
  } catch (err) {
    logLine("Get profile error", err.message);
  }
});

bind("updateProfileForm", "submit", async (e) => {
  e.preventDefault();
  try {
    const data = await api("/profile/", "PATCH", {
      full_name: document.getElementById("profileFullName").value,
    }, true);
    logLine("Profile updated", data);
  } catch (err) {
    logLine("Update profile error", err.message);
  }
});

bind("createLoanForm", "submit", async (e) => {
  e.preventDefault();
  try {
    const data = await api("/loans/", "POST", {
      amount_cents: Number(document.getElementById("loanAmount").value),
      currency: document.getElementById("loanCurrency").value,
      term_months: Number(document.getElementById("loanTerm").value),
      purpose: document.getElementById("loanPurpose").value,
    }, true);
    logLine("Loan created", data);
  } catch (err) {
    logLine("Create loan error", err.message);
  }
});

bind("btnMyLoans", "click", async () => {
  try {
    const data = await api("/loans/my", "GET", null, true);
    logLine("My loans", data);
  } catch (err) {
    logLine("My loans error", err.message);
  }
});

bind("getLoanByIDForm", "submit", async (e) => {
  e.preventDefault();
  try {
    const id = document.getElementById("loanId").value;
    const data = await api(`/loans/${id}`, "GET", null, true);
    logLine(`Loan #${id}`, data);
  } catch (err) {
    logLine("Get loan error", err.message);
  }
});

bind("docFile", "change", (e) => {
  const name = e.target.files[0]?.name ?? "No file chosen";
  document.getElementById("docFileName").textContent = name;
});

bind("uploadDocForm", "submit", async (e) => {
  e.preventDefault();
  const loanId = document.getElementById("uploadLoanId").value;
  const file = document.getElementById("docFile").files[0];
  if (!file) {
    logLine("Upload error", "No file selected");
    return;
  }
  try {
    const fd = new FormData();
    fd.append("document", file);
    const data = await apiForm(`/loans/${loanId}/documents/`, fd);
    logLine(`Document uploaded to loan #${loanId}`, data);
  } catch (err) {
    logLine("Upload error", err.message);
  }
});

bind("downloadDocForm", "submit", async (e) => {
  e.preventDefault();
  const loanId = document.getElementById("downloadLoanId").value;
  const filename = document.getElementById("downloadFilename").value;
  try {
    const result = await apiDownload(`/loans/${loanId}/documents/${filename}`, filename);
    logLine("Document downloaded", result);
  } catch (err) {
    logLine("Download error", err.message);
  }
});

bind("btnPending", "click", async () => {
  try {
    const data = await api("/manager/loans/pending", "GET", null, true);
    logLine("Pending loans", data);
  } catch (err) {
    logLine("Pending error", err.message);
  }
});

bind("decisionForm", "submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("decisionLoanId").value;
  try {
    const data = await api(`/manager/loans/${id}/decision`, "PATCH", {
      status: document.getElementById("decisionStatus").value,
      reason: document.getElementById("decisionReason").value,
    }, true);
    logLine(`Decision on loan #${id}`, data);
  } catch (err) {
    logLine("Decision error", err.message);
  }
});

bind("scoreLoanForm", "submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("scoreLoanId").value;
  try {
    const data = await api(`/manager/loans/${id}/score`, "GET", null, true);
    logLine(`Risk score for loan #${id}`, data);
    renderScore(data.score, data.risk_level, `Loan #${data.loan_id}`);
  } catch (err) {
    logLine("Score error", err.message);
  }
});

function renderScore(score, riskLevel, meta) {
  const box = document.getElementById("scoreDisplay");
  const circle = document.getElementById("scoreCircle");
  const label = document.getElementById("scoreLabel");
  const metaEl = document.getElementById("scoreMeta");
  const level = (riskLevel || "").toLowerCase();
  circle.textContent = score;
  circle.className = `score-circle ${level}`;
  label.textContent = level || "-";
  label.className = `score-label ${level}`;
  metaEl.textContent = meta;
  box.classList.remove("hidden");
}

bind("btnExportCSV", "click", async () => {
  const status = document.getElementById("exportStatus").value;
  const currency = document.getElementById("exportCurrency").value;
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (currency) params.set("currency", currency);
  try {
    const result = await apiDownload(`/manager/reports/export?${params}`, `loans_export_${Date.now()}.csv`);
    logLine("CSV export downloaded", result);
  } catch (err) {
    logLine("Export error", err.message);
  }
});

bind("checksumForm", "submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("checksumLoanId").value;
  try {
    const data = await api(`/manager/reports/checksum?id=${id}`, "GET", null, true);
    logLine(`Checksum for loan #${id}`, data);
  } catch (err) {
    logLine("Checksum error", err.message);
  }
});

bind("pingForm", "submit", async (e) => {
  e.preventDefault();
  const host = document.getElementById("pingHost").value;
  try {
    const data = await api(`/admin/ping?host=${encodeURIComponent(host)}`, "GET", null, true);
    logLine(`Ping -> ${host}`, data);
  } catch (err) {
    logLine("Ping error", err.message);
  }
});

bind("webhookForm", "submit", async (e) => {
  e.preventDefault();
  const url = document.getElementById("webhookUrl").value;
  try {
    const data = await api(`/admin/webhook-test?url=${encodeURIComponent(url)}`, "GET", null, true);
    logLine(`Webhook test -> ${url}`, data);
  } catch (err) {
    logLine("Webhook error", err.message);
  }
});

bind("btnAdminStats", "click", async () => {
  try {
    const data = await api("/admin/stats", "GET", null, true);
    logLine("Admin stats", data);
    renderStats(data);
  } catch (err) {
    logLine("Stats error", err.message);
  }
});

function renderStats(data) {
  const grid = document.getElementById("statsDisplay");
  const entries = [
    { val: data.total_users ?? "-", label: "Users" },
    { val: data.total_loans ?? "-", label: "Loans total" },
    { val: data.pending_loans ?? "-", label: "Pending" },
    { val: data.total_loan_comments ?? "-", label: "Loan comments" },
  ];
  grid.innerHTML = entries
    .map((e) => `<div class="stat-card"><div class="stat-val">${e.val}</div><div class="stat-key">${e.label}</div></div>`)
    .join("");
  grid.classList.remove("hidden");
}
