const out = document.getElementById("output");
const accessTokenInput = document.getElementById("accessToken");
const refreshTokenInput = document.getElementById("refreshToken");

function logLine(title, payload) {
  const ts = new Date().toISOString();
  const text = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  out.textContent = `[${ts}] ${title}\n${text}\n\n` + out.textContent;
}

function getTokens() {
  return {
    access: accessTokenInput.value.trim(),
    refresh: refreshTokenInput.value.trim()
  };
}

function setTokens(tokens) {
  if (tokens.access_token) accessTokenInput.value = tokens.access_token;
  if (tokens.refresh_token) refreshTokenInput.value = tokens.refresh_token;
}

async function api(path, method, body, authRequired = false) {
  const headers = { "Content-Type": "application/json" };
  if (authRequired) {
    const access = getTokens().access;
    if (!access) throw new Error("Access token is empty");
    headers.Authorization = `Bearer ${access}`;
  }

  const response = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  let data = {};
  try {
    data = await response.json();
  } catch (_) {
    data = { error: "non-json response" };
  }

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${JSON.stringify(data)}`);
  }
  return data;
}

document.getElementById("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const data = await api("/auth/register", "POST", {
      email: document.getElementById("regEmail").value,
      password: document.getElementById("regPassword").value,
      full_name: document.getElementById("regFullName").value
    });
    logLine("Register success", data);
  } catch (err) {
    logLine("Register error", err.message);
  }
});

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const data = await api("/auth/login", "POST", {
      email: document.getElementById("loginEmail").value,
      password: document.getElementById("loginPassword").value
    });
    setTokens(data);
    logLine("Login success", data);
  } catch (err) {
    logLine("Login error", err.message);
  }
});

document.getElementById("btnRefresh").addEventListener("click", async () => {
  try {
    const refresh = getTokens().refresh;
    const data = await api("/auth/refresh", "POST", { refresh_token: refresh });
    setTokens(data);
    logLine("Refresh success", data);
  } catch (err) {
    logLine("Refresh error", err.message);
  }
});

document.getElementById("btnLogout").addEventListener("click", async () => {
  try {
    const refresh = getTokens().refresh;
    const data = await api("/auth/logout", "POST", { refresh_token: refresh }, true);
    logLine("Logout success", data);
  } catch (err) {
    logLine("Logout error", err.message);
  }
});

document.getElementById("btnClearTokens").addEventListener("click", () => {
  accessTokenInput.value = "";
  refreshTokenInput.value = "";
  logLine("Tokens cleared", {});
});

document.getElementById("createLoanForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const data = await api("/loans/", "POST", {
      amount_cents: Number(document.getElementById("loanAmount").value),
      currency: document.getElementById("loanCurrency").value,
      term_months: Number(document.getElementById("loanTerm").value),
      purpose: document.getElementById("loanPurpose").value
    }, true);
    logLine("Create loan success", data);
  } catch (err) {
    logLine("Create loan error", err.message);
  }
});

document.getElementById("btnMyLoans").addEventListener("click", async () => {
  try {
    const data = await api("/loans/my", "GET", null, true);
    logLine("My loans", data);
  } catch (err) {
    logLine("My loans error", err.message);
  }
});

document.getElementById("getLoanByIDForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const id = document.getElementById("loanId").value;
    const data = await api(`/loans/${id}`, "GET", null, true);
    logLine("Loan by id", data);
  } catch (err) {
    logLine("Loan by id error", err.message);
  }
});

document.getElementById("btnPending").addEventListener("click", async () => {
  try {
    const data = await api("/manager/loans/pending", "GET", null, true);
    logLine("Pending loans", data);
  } catch (err) {
    logLine("Pending loans error", err.message);
  }
});

document.getElementById("decisionForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const id = document.getElementById("decisionLoanId").value;
    const data = await api(`/manager/loans/${id}/decision`, "PATCH", {
      status: document.getElementById("decisionStatus").value,
      reason: document.getElementById("decisionReason").value
    }, true);
    logLine("Decision success", data);
  } catch (err) {
    logLine("Decision error", err.message);
  }
});
