const {
  useEffect,
  useMemo,
  useState
} = React;
const PAGE_CONFIG = [{
  id: "auth",
  title: "Authentication",
  hint: "Registration, login, refresh and logout flows.",
  endpoints: ["POST /auth/register", "POST /auth/login", "POST /auth/refresh", "POST /auth/logout"]
}, {
  id: "profile",
  title: "Profile",
  hint: "Read and update current user profile.",
  endpoints: ["GET /profile/", "PATCH /profile/"]
}, {
  id: "loans",
  title: "Loans",
  hint: "Client loan applications and loan lookup.",
  endpoints: ["POST /loans/", "GET /loans/my", "GET /loans/{id}"]
}, {
  id: "documents",
  title: "Documents",
  hint: "Upload and download loan documents.",
  endpoints: ["POST /loans/{id}/documents/", "GET /loans/{id}/documents/{filename}"]
}, {
  id: "comments",
  title: "Comments",
  hint: "Thread-style comments for each loan application.",
  endpoints: ["GET /loans/{id}/comments/", "POST /loans/{id}/comments/"]
}, {
  id: "manager",
  title: "Manager",
  hint: "Pending queue, decisions, scoring and reports.",
  endpoints: ["GET /manager/loans/pending", "PATCH /manager/loans/{id}/decision", "GET /manager/loans/{id}/score", "GET /manager/reports/export", "GET /manager/reports/checksum?id={id}"]
}, {
  id: "admin",
  title: "Admin",
  hint: "Infrastructure checks and aggregated stats.",
  endpoints: ["GET /admin/ping?host=", "GET /admin/webhook-test?url=", "GET /admin/stats"]
}];
function nowIso() {
  return new Date().toISOString();
}
async function decodeResponse(res) {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return await res.json();
  }
  const text = await res.text();
  return {
    raw: text
  };
}
async function api(path, method, body, accessToken) {
  const headers = {
    "Content-Type": "application/json"
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await decodeResponse(res);
  if (!res.ok) {
    throw new Error(`${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}
async function apiForm(path, file, accessToken) {
  if (!accessToken) {
    throw new Error("Access token is required");
  }
  const payload = new FormData();
  payload.append("document", file);
  const res = await fetch(path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    body: payload
  });
  const data = await decodeResponse(res);
  if (!res.ok) {
    throw new Error(`${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}
async function apiDownload(path, suggestedName, accessToken) {
  if (!accessToken) {
    throw new Error("Access token is required");
  }
  const res = await fetch(path, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  if (!res.ok) {
    const err = await decodeResponse(res);
    throw new Error(`${res.status}: ${JSON.stringify(err)}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = suggestedName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return {
    ok: true,
    bytes: blob.size,
    type: blob.type || "unknown"
  };
}
function AuthPage({
  tokens,
  setTokens,
  writeLog
}) {
  const [registerData, setRegisterData] = useState({
    email: "",
    password: "",
    full_name: ""
  });
  const [loginData, setLoginData] = useState({
    email: "",
    password: ""
  });
  async function register(e) {
    e.preventDefault();
    try {
      const data = await api("/auth/register", "POST", registerData);
      writeLog("Registered", data);
    } catch (error) {
      writeLog("Register error", error.message);
    }
  }
  async function login(e) {
    e.preventDefault();
    try {
      const data = await api("/auth/login", "POST", loginData);
      setTokens(prev => ({
        ...prev,
        access: data.access_token || prev.access,
        refresh: data.refresh_token || prev.refresh
      }));
      writeLog("Logged in", data);
    } catch (error) {
      writeLog("Login error", error.message);
    }
  }
  async function refresh() {
    try {
      const data = await api("/auth/refresh", "POST", {
        refresh_token: tokens.refresh
      });
      setTokens(prev => ({
        ...prev,
        access: data.access_token || prev.access,
        refresh: data.refresh_token || prev.refresh
      }));
      writeLog("Tokens refreshed", data);
    } catch (error) {
      writeLog("Refresh error", error.message);
    }
  }
  async function logout() {
    try {
      const data = await api("/auth/logout", "POST", {
        refresh_token: tokens.refresh
      }, tokens.access);
      setTokens({
        access: "",
        refresh: ""
      });
      writeLog("Logged out", data);
    } catch (error) {
      writeLog("Logout error", error.message);
    }
  }
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("section", {
    className: "card"
  }, /*#__PURE__*/React.createElement("h2", null, "Session"), /*#__PURE__*/React.createElement("div", {
    className: "grid2"
  }, /*#__PURE__*/React.createElement("label", null, "Access token", /*#__PURE__*/React.createElement("textarea", {
    rows: "2",
    value: tokens.access,
    onChange: e => setTokens(prev => ({
      ...prev,
      access: e.target.value
    })),
    placeholder: "Paste access token"
  })), /*#__PURE__*/React.createElement("label", null, "Refresh token", /*#__PURE__*/React.createElement("textarea", {
    rows: "2",
    value: tokens.refresh,
    onChange: e => setTokens(prev => ({
      ...prev,
      refresh: e.target.value
    })),
    placeholder: "Paste refresh token"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "actions mt8"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: refresh
  }, "Refresh tokens"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn-warn",
    onClick: logout
  }, "Logout"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "ghost",
    onClick: () => setTokens({
      access: "",
      refresh: ""
    })
  }, "Clear"))), /*#__PURE__*/React.createElement("section", {
    className: "card"
  }, /*#__PURE__*/React.createElement("h2", null, "Authentication"), /*#__PURE__*/React.createElement("div", {
    className: "split"
  }, /*#__PURE__*/React.createElement("form", {
    onSubmit: register
  }, /*#__PURE__*/React.createElement("h3", null, "Register client"), /*#__PURE__*/React.createElement("input", {
    type: "email",
    placeholder: "client@example.com",
    value: registerData.email,
    onChange: e => setRegisterData(prev => ({
      ...prev,
      email: e.target.value
    })),
    required: true
  }), /*#__PURE__*/React.createElement("input", {
    type: "password",
    placeholder: "Password (10+ chars)",
    value: registerData.password,
    onChange: e => setRegisterData(prev => ({
      ...prev,
      password: e.target.value
    })),
    required: true
  }), /*#__PURE__*/React.createElement("input", {
    type: "text",
    placeholder: "Full name",
    value: registerData.full_name,
    onChange: e => setRegisterData(prev => ({
      ...prev,
      full_name: e.target.value
    })),
    required: true
  }), /*#__PURE__*/React.createElement("button", {
    type: "submit"
  }, "Register")), /*#__PURE__*/React.createElement("form", {
    onSubmit: login
  }, /*#__PURE__*/React.createElement("h3", null, "Login"), /*#__PURE__*/React.createElement("input", {
    type: "email",
    placeholder: "email",
    value: loginData.email,
    onChange: e => setLoginData(prev => ({
      ...prev,
      email: e.target.value
    })),
    required: true
  }), /*#__PURE__*/React.createElement("input", {
    type: "password",
    placeholder: "password",
    value: loginData.password,
    onChange: e => setLoginData(prev => ({
      ...prev,
      password: e.target.value
    })),
    required: true
  }), /*#__PURE__*/React.createElement("button", {
    type: "submit"
  }, "Login")))));
}
function ProfilePage({
  accessToken,
  writeLog
}) {
  const [fullName, setFullName] = useState("");
  async function loadProfile() {
    try {
      const data = await api("/profile/", "GET", null, accessToken);
      writeLog("Profile", data);
    } catch (error) {
      writeLog("Get profile error", error.message);
    }
  }
  async function saveProfile(e) {
    e.preventDefault();
    try {
      const data = await api("/profile/", "PATCH", {
        full_name: fullName
      }, accessToken);
      writeLog("Profile updated", data);
    } catch (error) {
      writeLog("Update profile error", error.message);
    }
  }
  return /*#__PURE__*/React.createElement("section", {
    className: "card"
  }, /*#__PURE__*/React.createElement("h2", null, "Profile"), /*#__PURE__*/React.createElement("div", {
    className: "split"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", null, "View my profile"), /*#__PURE__*/React.createElement("p", {
    className: "hint"
  }, "Returns id, email, full_name, role, created_at, loan_limit."), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: loadProfile
  }, "Get profile")), /*#__PURE__*/React.createElement("form", {
    onSubmit: saveProfile
  }, /*#__PURE__*/React.createElement("h3", null, "Update name"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    placeholder: "New full name",
    value: fullName,
    onChange: e => setFullName(e.target.value),
    required: true
  }), /*#__PURE__*/React.createElement("button", {
    type: "submit"
  }, "Save changes"))));
}
function LoansPage({
  accessToken,
  writeLog
}) {
  const [loanData, setLoanData] = useState({
    amount_cents: "50000000",
    currency: "RUB",
    term_months: "12",
    purpose: ""
  });
  const [loanID, setLoanID] = useState("");
  async function createLoan(e) {
    e.preventDefault();
    try {
      const data = await api("/loans/", "POST", {
        amount_cents: Number(loanData.amount_cents),
        currency: loanData.currency,
        term_months: Number(loanData.term_months),
        purpose: loanData.purpose
      }, accessToken);
      writeLog("Loan created", data);
    } catch (error) {
      writeLog("Create loan error", error.message);
    }
  }
  async function listMyLoans() {
    try {
      const data = await api("/loans/my", "GET", null, accessToken);
      writeLog("My loans", data);
    } catch (error) {
      writeLog("My loans error", error.message);
    }
  }
  async function getLoanByID(e) {
    e.preventDefault();
    try {
      const data = await api(`/loans/${loanID}`, "GET", null, accessToken);
      writeLog(`Loan #${loanID}`, data);
    } catch (error) {
      writeLog("Get loan error", error.message);
    }
  }
  return /*#__PURE__*/React.createElement("section", {
    className: "card"
  }, /*#__PURE__*/React.createElement("h2", null, "Loan applications (client)"), /*#__PURE__*/React.createElement("div", {
    className: "split"
  }, /*#__PURE__*/React.createElement("form", {
    onSubmit: createLoan
  }, /*#__PURE__*/React.createElement("h3", null, "Create application"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "10000",
    value: loanData.amount_cents,
    onChange: e => setLoanData(prev => ({
      ...prev,
      amount_cents: e.target.value
    })),
    required: true
  }), /*#__PURE__*/React.createElement("select", {
    value: loanData.currency,
    onChange: e => setLoanData(prev => ({
      ...prev,
      currency: e.target.value
    })),
    required: true
  }, /*#__PURE__*/React.createElement("option", {
    value: "RUB"
  }, "RUB"), /*#__PURE__*/React.createElement("option", {
    value: "USD"
  }, "USD"), /*#__PURE__*/React.createElement("option", {
    value: "EUR"
  }, "EUR")), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "1",
    max: "120",
    value: loanData.term_months,
    onChange: e => setLoanData(prev => ({
      ...prev,
      term_months: e.target.value
    })),
    required: true
  }), /*#__PURE__*/React.createElement("textarea", {
    rows: "2",
    placeholder: "Loan purpose",
    value: loanData.purpose,
    onChange: e => setLoanData(prev => ({
      ...prev,
      purpose: e.target.value
    })),
    required: true
  }), /*#__PURE__*/React.createElement("button", {
    type: "submit"
  }, "Submit application")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", null, "My applications"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: listMyLoans
  }, "Get my loans"), /*#__PURE__*/React.createElement("form", {
    className: "mt8",
    onSubmit: getLoanByID
  }, /*#__PURE__*/React.createElement("h3", null, "Loan by ID"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "1",
    placeholder: "Loan ID",
    value: loanID,
    onChange: e => setLoanID(e.target.value),
    required: true
  }), /*#__PURE__*/React.createElement("button", {
    type: "submit"
  }, "Get loan")))));
}
function DocumentsPage({
  accessToken,
  writeLog
}) {
  const [uploadLoanID, setUploadLoanID] = useState("");
  const [download, setDownload] = useState({
    loanID: "",
    filename: ""
  });
  const [file, setFile] = useState(null);
  async function uploadFile(e) {
    e.preventDefault();
    if (!file) {
      writeLog("Upload error", "No file selected");
      return;
    }
    try {
      const data = await apiForm(`/loans/${uploadLoanID}/documents/`, file, accessToken);
      writeLog(`Document uploaded to loan #${uploadLoanID}`, data);
    } catch (error) {
      writeLog("Upload error", error.message);
    }
  }
  async function downloadFile(e) {
    e.preventDefault();
    try {
      const data = await apiDownload(`/loans/${download.loanID}/documents/${download.filename}`, download.filename, accessToken);
      writeLog("Document downloaded", data);
    } catch (error) {
      writeLog("Download error", error.message);
    }
  }
  return /*#__PURE__*/React.createElement("section", {
    className: "card"
  }, /*#__PURE__*/React.createElement("h2", null, "Documents"), /*#__PURE__*/React.createElement("div", {
    className: "split"
  }, /*#__PURE__*/React.createElement("form", {
    onSubmit: uploadFile
  }, /*#__PURE__*/React.createElement("h3", null, "Upload document to loan"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "1",
    placeholder: "Loan ID",
    value: uploadLoanID,
    onChange: e => setUploadLoanID(e.target.value),
    required: true
  }), /*#__PURE__*/React.createElement("div", {
    className: "file-label"
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: "docFile"
  }, "Choose file"), /*#__PURE__*/React.createElement("input", {
    id: "docFile",
    type: "file",
    onChange: e => setFile(e.target.files[0] || null),
    required: true
  }), /*#__PURE__*/React.createElement("span", {
    className: "file-name"
  }, file?.name || "No file chosen")), /*#__PURE__*/React.createElement("button", {
    type: "submit"
  }, "Upload")), /*#__PURE__*/React.createElement("form", {
    onSubmit: downloadFile
  }, /*#__PURE__*/React.createElement("h3", null, "Download document"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "1",
    placeholder: "Loan ID",
    value: download.loanID,
    onChange: e => setDownload(prev => ({
      ...prev,
      loanID: e.target.value
    })),
    required: true
  }), /*#__PURE__*/React.createElement("input", {
    type: "text",
    placeholder: "filename.pdf",
    value: download.filename,
    onChange: e => setDownload(prev => ({
      ...prev,
      filename: e.target.value
    })),
    required: true
  }), /*#__PURE__*/React.createElement("button", {
    type: "submit"
  }, "Download"))));
}
function CommentsPage({
  accessToken,
  writeLog
}) {
  const [loanID, setLoanID] = useState("");
  const [createData, setCreateData] = useState({
    loanID: "",
    category: "review",
    body: "",
    is_internal: false
  });
  async function listComments(e) {
    e.preventDefault();
    try {
      const data = await api(`/loans/${loanID}/comments/`, "GET", null, accessToken);
      writeLog(`Comments for loan #${loanID}`, data);
    } catch (error) {
      writeLog("List comments error", error.message);
    }
  }
  async function createComment(e) {
    e.preventDefault();
    try {
      const data = await api(`/loans/${createData.loanID}/comments/`, "POST", {
        category: createData.category,
        body: createData.body,
        is_internal: createData.is_internal
      }, accessToken);
      writeLog(`Comment created for loan #${createData.loanID}`, data);
    } catch (error) {
      writeLog("Create comment error", error.message);
    }
  }
  return /*#__PURE__*/React.createElement("section", {
    className: "card"
  }, /*#__PURE__*/React.createElement("h2", null, "Loan comments"), /*#__PURE__*/React.createElement("div", {
    className: "split"
  }, /*#__PURE__*/React.createElement("form", {
    onSubmit: listComments
  }, /*#__PURE__*/React.createElement("h3", null, "List comments"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "1",
    placeholder: "Loan ID",
    value: loanID,
    onChange: e => setLoanID(e.target.value),
    required: true
  }), /*#__PURE__*/React.createElement("button", {
    type: "submit"
  }, "Load comments")), /*#__PURE__*/React.createElement("form", {
    onSubmit: createComment
  }, /*#__PURE__*/React.createElement("h3", null, "Add comment"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "1",
    placeholder: "Loan ID",
    value: createData.loanID,
    onChange: e => setCreateData(prev => ({
      ...prev,
      loanID: e.target.value
    })),
    required: true
  }), /*#__PURE__*/React.createElement("select", {
    value: createData.category,
    onChange: e => setCreateData(prev => ({
      ...prev,
      category: e.target.value
    })),
    required: true
  }, /*#__PURE__*/React.createElement("option", {
    value: "review"
  }, "review"), /*#__PURE__*/React.createElement("option", {
    value: "risk"
  }, "risk"), /*#__PURE__*/React.createElement("option", {
    value: "verification"
  }, "verification"), /*#__PURE__*/React.createElement("option", {
    value: "follow_up"
  }, "follow_up")), /*#__PURE__*/React.createElement("textarea", {
    rows: "3",
    placeholder: "Comment body (5-500 chars)",
    value: createData.body,
    onChange: e => setCreateData(prev => ({
      ...prev,
      body: e.target.value
    })),
    required: true
  }), /*#__PURE__*/React.createElement("label", null, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: createData.is_internal,
    onChange: e => setCreateData(prev => ({
      ...prev,
      is_internal: e.target.checked
    }))
  }), "Internal comment (manager mode)"), /*#__PURE__*/React.createElement("button", {
    type: "submit"
  }, "Create comment"))));
}
function ManagerPage({
  accessToken,
  writeLog
}) {
  const [decision, setDecision] = useState({
    loanID: "",
    status: "approved",
    reason: ""
  });
  const [scoreLoanID, setScoreLoanID] = useState("");
  const [scoreView, setScoreView] = useState(null);
  const [exportFilters, setExportFilters] = useState({
    status: "",
    currency: ""
  });
  const [checksumLoanID, setChecksumLoanID] = useState("");
  async function loadPending() {
    try {
      const data = await api("/manager/loans/pending", "GET", null, accessToken);
      writeLog("Pending loans", data);
    } catch (error) {
      writeLog("Pending error", error.message);
    }
  }
  async function submitDecision(e) {
    e.preventDefault();
    try {
      const data = await api(`/manager/loans/${decision.loanID}/decision`, "PATCH", {
        status: decision.status,
        reason: decision.reason
      }, accessToken);
      writeLog(`Decision on loan #${decision.loanID}`, data);
    } catch (error) {
      writeLog("Decision error", error.message);
    }
  }
  async function scoreLoan(e) {
    e.preventDefault();
    try {
      const data = await api(`/manager/loans/${scoreLoanID}/score`, "GET", null, accessToken);
      setScoreView(data);
      writeLog(`Risk score for loan #${scoreLoanID}`, data);
    } catch (error) {
      writeLog("Score error", error.message);
    }
  }
  async function downloadCSV() {
    const params = new URLSearchParams();
    if (exportFilters.status) {
      params.set("status", exportFilters.status);
    }
    if (exportFilters.currency) {
      params.set("currency", exportFilters.currency);
    }
    try {
      const data = await apiDownload(`/manager/reports/export?${params.toString()}`, `loans_export_${Date.now()}.csv`, accessToken);
      writeLog("CSV export downloaded", data);
    } catch (error) {
      writeLog("Export error", error.message);
    }
  }
  async function checksum(e) {
    e.preventDefault();
    try {
      const data = await api(`/manager/reports/checksum?id=${checksumLoanID}`, "GET", null, accessToken);
      writeLog(`Checksum for loan #${checksumLoanID}`, data);
    } catch (error) {
      writeLog("Checksum error", error.message);
    }
  }
  const scoreLevel = (scoreView?.risk_level || "").toLowerCase();
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("section", {
    className: "card manager-suite"
  }, /*#__PURE__*/React.createElement("h2", null, "Manager workspace"), /*#__PURE__*/React.createElement("div", {
    className: "manager-grid"
  }, /*#__PURE__*/React.createElement("article", {
    className: "manager-panel"
  }, /*#__PURE__*/React.createElement("h3", null, "Pending applications"), /*#__PURE__*/React.createElement("p", {
    className: "hint"
  }, "Open queue for manual review and decisioning."), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: loadPending
  }, "Load pending")), /*#__PURE__*/React.createElement("form", {
    className: "manager-panel compact-form",
    onSubmit: submitDecision
  }, /*#__PURE__*/React.createElement("h3", null, "Make decision"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "1",
    placeholder: "Loan ID",
    value: decision.loanID,
    onChange: e => setDecision(prev => ({
      ...prev,
      loanID: e.target.value
    })),
    required: true
  }), /*#__PURE__*/React.createElement("select", {
    value: decision.status,
    onChange: e => setDecision(prev => ({
      ...prev,
      status: e.target.value
    }))
  }, /*#__PURE__*/React.createElement("option", {
    value: "approved"
  }, "approved"), /*#__PURE__*/React.createElement("option", {
    value: "rejected"
  }, "rejected")), /*#__PURE__*/React.createElement("textarea", {
    rows: "3",
    placeholder: "Decision reason (5+ chars)",
    value: decision.reason,
    onChange: e => setDecision(prev => ({
      ...prev,
      reason: e.target.value
    })),
    required: true
  }), /*#__PURE__*/React.createElement("button", {
    type: "submit"
  }, "Submit decision")))), /*#__PURE__*/React.createElement("section", {
    className: "card manager-suite"
  }, /*#__PURE__*/React.createElement("h2", null, "Credit risk scoring"), /*#__PURE__*/React.createElement("div", {
    className: "manager-grid"
  }, /*#__PURE__*/React.createElement("form", {
    className: "manager-panel compact-form",
    onSubmit: scoreLoan
  }, /*#__PURE__*/React.createElement("h3", null, "Calculate risk score"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "1",
    placeholder: "Loan ID",
    value: scoreLoanID,
    onChange: e => setScoreLoanID(e.target.value),
    required: true
  }), /*#__PURE__*/React.createElement("button", {
    type: "submit"
  }, "Calculate score"), /*#__PURE__*/React.createElement("p", {
    className: "hint"
  }, "Returns score 0-100 and risk level (low / medium / high).")), /*#__PURE__*/React.createElement("div", {
    className: `score-box manager-panel ${scoreView ? "" : "hidden"}`
  }, /*#__PURE__*/React.createElement("div", {
    className: `score-circle ${scoreLevel}`
  }, scoreView?.score ?? "-"), /*#__PURE__*/React.createElement("div", {
    className: `score-label ${scoreLevel}`
  }, scoreLevel || "-"), /*#__PURE__*/React.createElement("div", {
    className: "score-meta"
  }, scoreView ? `Loan #${scoreView.loan_id}` : "")))), /*#__PURE__*/React.createElement("section", {
    className: "card manager-suite"
  }, /*#__PURE__*/React.createElement("h2", null, "Reports"), /*#__PURE__*/React.createElement("div", {
    className: "manager-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "manager-panel compact-form"
  }, /*#__PURE__*/React.createElement("h3", null, "Export loans CSV"), /*#__PURE__*/React.createElement("select", {
    value: exportFilters.status,
    onChange: e => setExportFilters(prev => ({
      ...prev,
      status: e.target.value
    }))
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "all statuses"), /*#__PURE__*/React.createElement("option", {
    value: "pending"
  }, "pending"), /*#__PURE__*/React.createElement("option", {
    value: "approved"
  }, "approved"), /*#__PURE__*/React.createElement("option", {
    value: "rejected"
  }, "rejected")), /*#__PURE__*/React.createElement("select", {
    value: exportFilters.currency,
    onChange: e => setExportFilters(prev => ({
      ...prev,
      currency: e.target.value
    }))
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "all currencies"), /*#__PURE__*/React.createElement("option", {
    value: "USD"
  }, "USD"), /*#__PURE__*/React.createElement("option", {
    value: "EUR"
  }, "EUR"), /*#__PURE__*/React.createElement("option", {
    value: "RUB"
  }, "RUB")), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: downloadCSV
  }, "Download CSV")), /*#__PURE__*/React.createElement("form", {
    className: "manager-panel compact-form",
    onSubmit: checksum
  }, /*#__PURE__*/React.createElement("h3", null, "Loan integrity checksum"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "1",
    placeholder: "Loan ID",
    value: checksumLoanID,
    onChange: e => setChecksumLoanID(e.target.value),
    required: true
  }), /*#__PURE__*/React.createElement("button", {
    type: "submit"
  }, "Get checksum")))));
}
function AdminPage({
  accessToken,
  writeLog
}) {
  const [host, setHost] = useState("127.0.0.1");
  const [webhook, setWebhook] = useState("https://httpbin.org/get");
  const [stats, setStats] = useState(null);
  async function ping(e) {
    e.preventDefault();
    try {
      const data = await api(`/admin/ping?host=${encodeURIComponent(host)}`, "GET", null, accessToken);
      writeLog(`Ping -> ${host}`, data);
    } catch (error) {
      writeLog("Ping error", error.message);
    }
  }
  async function fireWebhook(e) {
    e.preventDefault();
    try {
      const data = await api(`/admin/webhook-test?url=${encodeURIComponent(webhook)}`, "GET", null, accessToken);
      writeLog(`Webhook test -> ${webhook}`, data);
    } catch (error) {
      writeLog("Webhook error", error.message);
    }
  }
  async function loadStats() {
    try {
      const data = await api("/admin/stats", "GET", null, accessToken);
      setStats(data);
      writeLog("Admin stats", data);
    } catch (error) {
      writeLog("Stats error", error.message);
    }
  }
  return /*#__PURE__*/React.createElement("section", {
    className: "card"
  }, /*#__PURE__*/React.createElement("h2", null, "Admin panel (manager only)"), /*#__PURE__*/React.createElement("div", {
    className: "split"
  }, /*#__PURE__*/React.createElement("form", {
    onSubmit: ping
  }, /*#__PURE__*/React.createElement("h3", null, "Host ping"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: host,
    onChange: e => setHost(e.target.value)
  }), /*#__PURE__*/React.createElement("button", {
    type: "submit"
  }, "Ping")), /*#__PURE__*/React.createElement("form", {
    onSubmit: fireWebhook
  }, /*#__PURE__*/React.createElement("h3", null, "Webhook test"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: webhook,
    onChange: e => setWebhook(e.target.value)
  }), /*#__PURE__*/React.createElement("button", {
    type: "submit"
  }, "Fire request"))), /*#__PURE__*/React.createElement("div", {
    className: "mt8"
  }, /*#__PURE__*/React.createElement("h3", null, "Dashboard stats"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: loadStats
  }, "Load stats"), /*#__PURE__*/React.createElement("div", {
    className: `stats-grid ${stats ? "" : "hidden"}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat-val"
  }, stats?.total_users ?? "-"), /*#__PURE__*/React.createElement("div", {
    className: "stat-key"
  }, "Users")), /*#__PURE__*/React.createElement("div", {
    className: "stat-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat-val"
  }, stats?.total_loans ?? "-"), /*#__PURE__*/React.createElement("div", {
    className: "stat-key"
  }, "Loans total")), /*#__PURE__*/React.createElement("div", {
    className: "stat-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat-val"
  }, stats?.pending_loans ?? "-"), /*#__PURE__*/React.createElement("div", {
    className: "stat-key"
  }, "Pending")), /*#__PURE__*/React.createElement("div", {
    className: "stat-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat-val"
  }, stats?.total_loan_comments ?? "-"), /*#__PURE__*/React.createElement("div", {
    className: "stat-key"
  }, "Comments")))));
}
function OutputPanel({
  logs,
  clearLogs
}) {
  const prepared = useMemo(() => logs.map(line => ({
    ...line,
    body: typeof line.payload === "string" ? line.payload : JSON.stringify(line.payload, null, 2)
  })), [logs]);
  return /*#__PURE__*/React.createElement("section", {
    className: "card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "output-header"
  }, /*#__PURE__*/React.createElement("h2", null, "Output"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "ghost",
    onClick: clearLogs
  }, "Clear output")), !prepared.length && /*#__PURE__*/React.createElement("div", {
    className: "output-empty"
  }, "Ready. Execute an action to see logs here."), /*#__PURE__*/React.createElement("div", {
    className: "output-list"
  }, prepared.map((line, idx) => /*#__PURE__*/React.createElement("article", {
    key: `${line.ts}-${idx}`,
    className: "output-item"
  }, /*#__PURE__*/React.createElement("div", {
    className: "output-meta"
  }, /*#__PURE__*/React.createElement("span", null, line.title), /*#__PURE__*/React.createElement("time", null, line.ts)), /*#__PURE__*/React.createElement("pre", {
    className: "output-body"
  }, line.body)))));
}
function App() {
  const [tokens, setTokens] = useState({
    access: "",
    refresh: ""
  });
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(() => {
    const path = window.location.pathname.replace(/^\/ui\/?/, "").replace(/\/$/, "");
    return PAGE_CONFIG.some(item => item.id === path) ? path : PAGE_CONFIG[0].id;
  });
  useEffect(() => {
    function syncPageFromPath() {
      const path = window.location.pathname.replace(/^\/ui\/?/, "").replace(/\/$/, "");
      if (PAGE_CONFIG.some(item => item.id === path)) {
        setPage(path);
        return;
      }
      setPage(PAGE_CONFIG[0].id);
    }
    window.addEventListener("popstate", syncPageFromPath);
    return () => window.removeEventListener("popstate", syncPageFromPath);
  }, []);
  function changePage(next) {
    window.history.pushState({}, "", `/ui/${next}`);
    setPage(next);
  }
  function writeLog(title, payload) {
    setLogs(prev => [{
      ts: nowIso(),
      title,
      payload
    }, ...prev].slice(0, 250));
  }
  const selectedPage = PAGE_CONFIG.find(item => item.id === page) || PAGE_CONFIG[0];
  return /*#__PURE__*/React.createElement("main", {
    className: "container"
  }, /*#__PURE__*/React.createElement("h1", null, "Credit MVP - React cockpit"), /*#__PURE__*/React.createElement("section", {
    className: "card page-selector"
  }, /*#__PURE__*/React.createElement("h2", null, "Logical pages"), /*#__PURE__*/React.createElement("div", {
    className: "page-tabs"
  }, PAGE_CONFIG.map(item => /*#__PURE__*/React.createElement("button", {
    key: item.id,
    type: "button",
    className: `tab-btn ${item.id === page ? "active" : "ghost"}`,
    onClick: () => changePage(item.id)
  }, item.title))), /*#__PURE__*/React.createElement("p", {
    className: "hint"
  }, selectedPage.hint)), page === "auth" && /*#__PURE__*/React.createElement(AuthPage, {
    tokens: tokens,
    setTokens: setTokens,
    writeLog: writeLog
  }), page === "profile" && /*#__PURE__*/React.createElement(ProfilePage, {
    accessToken: tokens.access,
    writeLog: writeLog
  }), page === "loans" && /*#__PURE__*/React.createElement(LoansPage, {
    accessToken: tokens.access,
    writeLog: writeLog
  }), page === "documents" && /*#__PURE__*/React.createElement(DocumentsPage, {
    accessToken: tokens.access,
    writeLog: writeLog
  }), page === "comments" && /*#__PURE__*/React.createElement(CommentsPage, {
    accessToken: tokens.access,
    writeLog: writeLog
  }), page === "manager" && /*#__PURE__*/React.createElement(ManagerPage, {
    accessToken: tokens.access,
    writeLog: writeLog
  }), page === "admin" && /*#__PURE__*/React.createElement(AdminPage, {
    accessToken: tokens.access,
    writeLog: writeLog
  }), /*#__PURE__*/React.createElement(OutputPanel, {
    logs: logs,
    clearLogs: () => setLogs([])
  }));
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(App, null));
