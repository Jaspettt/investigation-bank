var __unused = (() => {
  const { useEffect, useMemo, useRef, useState } = React;
  const TOKENS_KEY = "credit_mvp_v2_tokens";
  const NAV_PAGES = [
    { id: "profile", label: "\u041F\u0440\u043E\u0444\u0438\u043B\u044C", role: null },
    { id: "loans", label: "\u0417\u0430\u044F\u0432\u043A\u0438", role: null },
    { id: "documents", label: "\u0414\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u044B", role: null },
    { id: "comments", label: "\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0438", role: null },
    { id: "manager", label: "\u041C\u0435\u043D\u0435\u0434\u0436\u0435\u0440", role: "manager" },
    { id: "admin", label: "\u0410\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440", role: "manager" }
  ];
  function decodeJwtPayload(token) {
    if (!token) return null;
    try {
      const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(atob(b64));
    } catch {
      return null;
    }
  }
  function nowIso() {
    return (/* @__PURE__ */ new Date()).toISOString();
  }
  async function decodeResponse(res) {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return res.json();
    return { raw: await res.text() };
  }
  async function apiFetch(path, method, body, accessToken) {
    const headers = { "Content-Type": "application/json" };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const res = await fetch(path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : void 0
    });
    const data = await decodeResponse(res);
    if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(data)}`);
    return data;
  }
  async function apiForm(path, file, accessToken) {
    if (!accessToken) throw new Error("\u041D\u0435 \u0430\u0443\u0442\u0435\u043D\u0442\u0438\u0444\u0438\u0446\u0438\u0440\u043E\u0432\u0430\u043D");
    const payload = new FormData();
    payload.append("document", file);
    const res = await fetch(path, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: payload
    });
    const data = await decodeResponse(res);
    if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(data)}`);
    return data;
  }
  async function apiDownload(path, name, accessToken) {
    if (!accessToken) throw new Error("\u041D\u0435 \u0430\u0443\u0442\u0435\u043D\u0442\u0438\u0444\u0438\u0446\u0438\u0440\u043E\u0432\u0430\u043D");
    const res = await fetch(path, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      const err = await decodeResponse(res);
      throw new Error(`${res.status}: ${JSON.stringify(err)}`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return { ok: true, bytes: blob.size, type: blob.type || "unknown" };
  }
  function AuthGate({ setTokens, writeLog }) {
    const [tab, setTab] = useState("login");
    const [reg, setReg] = useState({ email: "", password: "", full_name: "" });
    const [log, setLog] = useState({ email: "", password: "" });
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    const [ok, setOk] = useState("");
    async function handleLogin(e) {
      e.preventDefault();
      setErr("");
      setBusy(true);
      try {
        const data = await apiFetch("/auth/login", "POST", log);
        setTokens({ access: data.access_token || "", refresh: data.refresh_token || "" });
        writeLog("\u0412\u0445\u043E\u0434 \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D", data);
      } catch (ex) {
        setErr(ex.message);
      } finally {
        setBusy(false);
      }
    }
    async function handleRegister(e) {
      e.preventDefault();
      setErr("");
      setOk("");
      setBusy(true);
      try {
        const data = await apiFetch("/auth/register", "POST", reg);
        writeLog("\u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044F", data);
        setOk("\u0410\u043A\u043A\u0430\u0443\u043D\u0442 \u0441\u043E\u0437\u0434\u0430\u043D. \u0422\u0435\u043F\u0435\u0440\u044C \u0432\u044B \u043C\u043E\u0436\u0435\u0442\u0435 \u0432\u043E\u0439\u0442\u0438.");
        setTab("login");
        setLog({ email: reg.email, password: "" });
      } catch (ex) {
        setErr(ex.message);
      } finally {
        setBusy(false);
      }
    }
    return /* @__PURE__ */ React.createElement("div", { className: "gate-wrap" }, /* @__PURE__ */ React.createElement("div", { className: "gate-brand" }, /* @__PURE__ */ React.createElement("div", { className: "gate-logo" }, "CM"), /* @__PURE__ */ React.createElement("h1", { className: "gate-title" }, "Credit MVP"), /* @__PURE__ */ React.createElement("p", { className: "gate-sub" }, "\u041F\u043B\u0430\u0442\u0444\u043E\u0440\u043C\u0430 \u0443\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u044F \u043A\u0440\u0435\u0434\u0438\u0442\u043D\u044B\u043C\u0438 \u0437\u0430\u044F\u0432\u043A\u0430\u043C\u0438")), /* @__PURE__ */ React.createElement("div", { className: "gate-card" }, /* @__PURE__ */ React.createElement("div", { className: "gate-tabs" }, /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: `gate-tab ${tab === "login" ? "active" : ""}`,
        onClick: () => {
          setTab("login");
          setErr("");
          setOk("");
        }
      },
      "\u0412\u043E\u0439\u0442\u0438"
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: `gate-tab ${tab === "register" ? "active" : ""}`,
        onClick: () => {
          setTab("register");
          setErr("");
          setOk("");
        }
      },
      "\u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044F"
    )), err && /* @__PURE__ */ React.createElement("div", { className: "gate-alert err" }, err), ok && /* @__PURE__ */ React.createElement("div", { className: "gate-alert ok" }, ok), tab === "login" ? /* @__PURE__ */ React.createElement("form", { onSubmit: handleLogin, className: "gate-form" }, /* @__PURE__ */ React.createElement("label", null, "Email", /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "email",
        placeholder: "you@example.com",
        value: log.email,
        onChange: (e) => setLog((p) => ({ ...p, email: e.target.value })),
        required: true
      }
    )), /* @__PURE__ */ React.createElement("label", null, "\u041F\u0430\u0440\u043E\u043B\u044C", /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "password",
        placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
        value: log.password,
        onChange: (e) => setLog((p) => ({ ...p, password: e.target.value })),
        required: true
      }
    )), /* @__PURE__ */ React.createElement("button", { type: "submit", disabled: busy, className: "gate-submit" }, busy ? "\u0412\u0445\u043E\u0434\u2026" : "\u0412\u043E\u0439\u0442\u0438")) : /* @__PURE__ */ React.createElement("form", { onSubmit: handleRegister, className: "gate-form" }, /* @__PURE__ */ React.createElement("label", null, "\u041F\u043E\u043B\u043D\u043E\u0435 \u0438\u043C\u044F", /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        placeholder: "\u0418\u0432\u0430\u043D\u043E\u0432 \u0418\u0432\u0430\u043D \u0418\u0432\u0430\u043D\u043E\u0432\u0438\u0447",
        value: reg.full_name,
        onChange: (e) => setReg((p) => ({ ...p, full_name: e.target.value })),
        required: true
      }
    )), /* @__PURE__ */ React.createElement("label", null, "Email", /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "email",
        placeholder: "you@example.com",
        value: reg.email,
        onChange: (e) => setReg((p) => ({ ...p, email: e.target.value })),
        required: true
      }
    )), /* @__PURE__ */ React.createElement("label", null, "\u041F\u0430\u0440\u043E\u043B\u044C ", /* @__PURE__ */ React.createElement("span", { className: "hint" }, "(10+ \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432)"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "password",
        placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
        value: reg.password,
        onChange: (e) => setReg((p) => ({ ...p, password: e.target.value })),
        required: true
      }
    )), /* @__PURE__ */ React.createElement("button", { type: "submit", disabled: busy, className: "gate-submit" }, busy ? "\u0421\u043E\u0437\u0434\u0430\u043D\u0438\u0435 \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u0430\u2026" : "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u0430\u043A\u043A\u0430\u0443\u043D\u0442"))));
  }
  function Navbar({ viewer, page, changePage, logout }) {
    const role = viewer?.role || "";
    const name = viewer?.full_name || viewer?.email || `#${viewer?.sub || viewer?.user_id || "?"}`;
    const roleLabel = role === "manager" ? "\u043C\u0435\u043D\u0435\u0434\u0436\u0435\u0440" : role || "\u043A\u043B\u0438\u0435\u043D\u0442";
    const visiblePages = NAV_PAGES.filter((p) => !p.role || p.role === role);
    return /* @__PURE__ */ React.createElement("header", { className: "navbar" }, /* @__PURE__ */ React.createElement("div", { className: "nb-brand" }, /* @__PURE__ */ React.createElement("span", { className: "nb-logo" }, "CM"), /* @__PURE__ */ React.createElement("span", { className: "nb-name" }, "Credit MVP")), /* @__PURE__ */ React.createElement("nav", { className: "nb-nav" }, visiblePages.map((p) => /* @__PURE__ */ React.createElement(
      "button",
      {
        key: p.id,
        type: "button",
        className: `nb-link ${p.id === page ? "active" : ""}`,
        onClick: () => changePage(p.id)
      },
      p.label
    ))), /* @__PURE__ */ React.createElement("div", { className: "nb-right" }, /* @__PURE__ */ React.createElement("span", { className: "nb-role-pill", "data-role": role }, roleLabel), /* @__PURE__ */ React.createElement("span", { className: "nb-user" }, name), /* @__PURE__ */ React.createElement("button", { type: "button", className: "nb-logout", onClick: logout }, "\u0412\u044B\u0439\u0442\u0438")));
  }
  function ActivityLog({ logs, clearLogs }) {
    const endRef = useRef(null);
    const entries = useMemo(() => logs.map((l) => ({
      ...l,
      isErr: /ошибка|error/i.test(l.title),
      body: typeof l.payload === "string" ? l.payload : JSON.stringify(l.payload, null, 2)
    })), [logs]);
    return /* @__PURE__ */ React.createElement("section", { className: "activity-section" }, /* @__PURE__ */ React.createElement("div", { className: "activity-header" }, /* @__PURE__ */ React.createElement("h2", { className: "activity-title" }, "\u0416\u0443\u0440\u043D\u0430\u043B \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0441\u0442\u0438"), /* @__PURE__ */ React.createElement("span", { className: "activity-count" }, logs.length, " \u0437\u0430\u043F\u0438\u0441\u0435\u0439"), /* @__PURE__ */ React.createElement("button", { type: "button", className: "ghost activity-clear", onClick: clearLogs }, "\u041E\u0447\u0438\u0441\u0442\u0438\u0442\u044C")), !entries.length ? /* @__PURE__ */ React.createElement("div", { className: "activity-empty" }, "\u041D\u0435\u0442 \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0441\u0442\u0438. \u0412\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0432\u044B\u0448\u0435.") : /* @__PURE__ */ React.createElement("div", { className: "activity-list" }, entries.map((l, i) => /* @__PURE__ */ React.createElement("article", { key: `${l.ts}-${i}`, className: `activity-item ${l.isErr ? "err" : "ok"}` }, /* @__PURE__ */ React.createElement("div", { className: "activity-meta" }, /* @__PURE__ */ React.createElement("span", { className: `activity-badge ${l.isErr ? "err" : "ok"}` }, l.isErr ? "\u041E\u0428\u0411" : "OK"), /* @__PURE__ */ React.createElement("span", { className: "activity-label" }, l.title), /* @__PURE__ */ React.createElement("time", { className: "activity-ts" }, l.ts.replace("T", " ").slice(0, 19))), /* @__PURE__ */ React.createElement("pre", { className: "activity-body" }, l.body))), /* @__PURE__ */ React.createElement("div", { ref: endRef })));
  }
  function Section({ accent, title, children }) {
    return /* @__PURE__ */ React.createElement("section", { className: "card", style: accent ? { borderLeft: `4px solid ${accent}` } : {} }, title && /* @__PURE__ */ React.createElement("h2", null, title), children);
  }
  function ProfilePage({ accessToken, writeLog }) {
    const [fullName, setFullName] = useState("");
    async function load() {
      try {
        writeLog("\u041F\u0440\u043E\u0444\u0438\u043B\u044C \u043F\u043E\u043B\u0443\u0447\u0435\u043D", await apiFetch("/profile/", "GET", null, accessToken));
      } catch (e) {
        writeLog("\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u043E\u0444\u0438\u043B\u044F", e.message);
      }
    }
    async function save(e) {
      e.preventDefault();
      try {
        writeLog("\u041F\u0440\u043E\u0444\u0438\u043B\u044C \u043E\u0431\u043D\u043E\u0432\u043B\u0451\u043D", await apiFetch("/profile/", "PATCH", { full_name: fullName }, accessToken));
      } catch (e2) {
        writeLog("\u041E\u0448\u0438\u0431\u043A\u0430 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F", e2.message);
      }
    }
    return /* @__PURE__ */ React.createElement(Section, { title: "\u041F\u0440\u043E\u0444\u0438\u043B\u044C \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F" }, /* @__PURE__ */ React.createElement("div", { className: "split" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", null, "\u041F\u0440\u043E\u0441\u043C\u043E\u0442\u0440 \u043F\u0440\u043E\u0444\u0438\u043B\u044F"), /* @__PURE__ */ React.createElement("p", { className: "hint" }, "\u0412\u043E\u0437\u0432\u0440\u0430\u0449\u0430\u0435\u0442 id, email, \u0438\u043C\u044F, \u0440\u043E\u043B\u044C, \u0434\u0430\u0442\u0443 \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u044F \u0438 \u043A\u0440\u0435\u0434\u0438\u0442\u043D\u044B\u0439 \u043B\u0438\u043C\u0438\u0442."), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: load }, "\u041F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u043F\u0440\u043E\u0444\u0438\u043B\u044C")), /* @__PURE__ */ React.createElement("form", { onSubmit: save }, /* @__PURE__ */ React.createElement("h3", null, "\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u0438\u043C\u044F"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        placeholder: "\u041D\u043E\u0432\u043E\u0435 \u043F\u043E\u043B\u043D\u043E\u0435 \u0438\u043C\u044F",
        value: fullName,
        onChange: (e) => setFullName(e.target.value),
        required: true
      }
    ), /* @__PURE__ */ React.createElement("button", { type: "submit" }, "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F"))));
  }
  function LoansPage({ accessToken, writeLog }) {
    const [loan, setLoan] = useState({ amount_cents: "50000000", currency: "RUB", term_months: "12", purpose: "" });
    const [loanID, setLoanID] = useState("");
    async function create(e) {
      e.preventDefault();
      try {
        writeLog("\u0417\u0430\u044F\u0432\u043A\u0430 \u0441\u043E\u0437\u0434\u0430\u043D\u0430", await apiFetch("/loans/", "POST", {
          amount_cents: Number(loan.amount_cents),
          currency: loan.currency,
          term_months: Number(loan.term_months),
          purpose: loan.purpose
        }, accessToken));
      } catch (e2) {
        writeLog("\u041E\u0448\u0438\u0431\u043A\u0430 \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u044F \u0437\u0430\u044F\u0432\u043A\u0438", e2.message);
      }
    }
    async function listMine() {
      try {
        writeLog("\u041C\u043E\u0438 \u0437\u0430\u044F\u0432\u043A\u0438", await apiFetch("/loans/my", "GET", null, accessToken));
      } catch (e) {
        writeLog("\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u0437\u0430\u044F\u0432\u043E\u043A", e.message);
      }
    }
    async function getByID(e) {
      e.preventDefault();
      try {
        writeLog(`\u0417\u0430\u044F\u0432\u043A\u0430 #${loanID}`, await apiFetch(`/loans/${loanID}`, "GET", null, accessToken));
      } catch (e2) {
        writeLog("\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u0438\u044F \u0437\u0430\u044F\u0432\u043A\u0438", e2.message);
      }
    }
    return /* @__PURE__ */ React.createElement(Section, { title: "\u041A\u0440\u0435\u0434\u0438\u0442\u043D\u044B\u0435 \u0437\u0430\u044F\u0432\u043A\u0438" }, /* @__PURE__ */ React.createElement("div", { className: "split" }, /* @__PURE__ */ React.createElement("form", { onSubmit: create }, /* @__PURE__ */ React.createElement("h3", null, "\u041D\u043E\u0432\u0430\u044F \u0437\u0430\u044F\u0432\u043A\u0430"), /* @__PURE__ */ React.createElement("label", null, "\u0421\u0443\u043C\u043C\u0430 (\u0432 \u043A\u043E\u043F\u0435\u0439\u043A\u0430\u0445)", /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        min: "10000",
        value: loan.amount_cents,
        onChange: (e) => setLoan((p) => ({ ...p, amount_cents: e.target.value })),
        required: true
      }
    )), /* @__PURE__ */ React.createElement("label", null, "\u0412\u0430\u043B\u044E\u0442\u0430", /* @__PURE__ */ React.createElement("select", { value: loan.currency, onChange: (e) => setLoan((p) => ({ ...p, currency: e.target.value })), required: true }, /* @__PURE__ */ React.createElement("option", null, "RUB"), /* @__PURE__ */ React.createElement("option", null, "USD"), /* @__PURE__ */ React.createElement("option", null, "EUR"))), /* @__PURE__ */ React.createElement("label", null, "\u0421\u0440\u043E\u043A (\u043C\u0435\u0441\u044F\u0446\u044B)", /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        min: "1",
        max: "120",
        value: loan.term_months,
        onChange: (e) => setLoan((p) => ({ ...p, term_months: e.target.value })),
        required: true
      }
    )), /* @__PURE__ */ React.createElement("label", null, "\u0426\u0435\u043B\u044C \u043A\u0440\u0435\u0434\u0438\u0442\u0430", /* @__PURE__ */ React.createElement(
      "textarea",
      {
        rows: "2",
        placeholder: "\u041E\u043F\u0438\u0448\u0438\u0442\u0435 \u0446\u0435\u043B\u044C \u043A\u0440\u0435\u0434\u0438\u0442\u0430\u2026",
        value: loan.purpose,
        onChange: (e) => setLoan((p) => ({ ...p, purpose: e.target.value })),
        required: true
      }
    )), /* @__PURE__ */ React.createElement("button", { type: "submit" }, "\u041F\u043E\u0434\u0430\u0442\u044C \u0437\u0430\u044F\u0432\u043A\u0443")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", null, "\u041C\u043E\u0438 \u0437\u0430\u044F\u0432\u043A\u0438"), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: listMine }, "\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u043C\u043E\u0438 \u0437\u0430\u044F\u0432\u043A\u0438"), /* @__PURE__ */ React.createElement("form", { className: "mt8", onSubmit: getByID }, /* @__PURE__ */ React.createElement("h3", null, "\u041F\u043E\u0438\u0441\u043A \u043F\u043E ID"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        min: "1",
        placeholder: "ID \u0437\u0430\u044F\u0432\u043A\u0438",
        value: loanID,
        onChange: (e) => setLoanID(e.target.value),
        required: true
      }
    ), /* @__PURE__ */ React.createElement("button", { type: "submit" }, "\u041D\u0430\u0439\u0442\u0438 \u0437\u0430\u044F\u0432\u043A\u0443")))));
  }
  function DocumentsPage({ accessToken, writeLog }) {
    const [uploadID, setUploadID] = useState("");
    const [dl, setDl] = useState({ loanID: "", filename: "" });
    const [file, setFile] = useState(null);
    async function upload(e) {
      e.preventDefault();
      if (!file) {
        writeLog("\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438", "\u0424\u0430\u0439\u043B \u043D\u0435 \u0432\u044B\u0431\u0440\u0430\u043D");
        return;
      }
      try {
        writeLog(`\u0414\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D \u2192 \u0437\u0430\u044F\u0432\u043A\u0430 #${uploadID}`, await apiForm(`/loans/${uploadID}/documents/`, file, accessToken));
      } catch (e2) {
        writeLog("\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u0444\u0430\u0439\u043B\u0430", e2.message);
      }
    }
    async function download(e) {
      e.preventDefault();
      try {
        writeLog("\u0424\u0430\u0439\u043B \u0441\u043A\u0430\u0447\u0430\u043D", await apiDownload(`/loans/${dl.loanID}/documents/${dl.filename}`, dl.filename, accessToken));
      } catch (e2) {
        writeLog("\u041E\u0448\u0438\u0431\u043A\u0430 \u0441\u043A\u0430\u0447\u0438\u0432\u0430\u043D\u0438\u044F", e2.message);
      }
    }
    return /* @__PURE__ */ React.createElement(Section, { title: "\u0414\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u044B" }, /* @__PURE__ */ React.createElement("div", { className: "split" }, /* @__PURE__ */ React.createElement("form", { onSubmit: upload }, /* @__PURE__ */ React.createElement("h3", null, "\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        min: "1",
        placeholder: "ID \u0437\u0430\u044F\u0432\u043A\u0438",
        value: uploadID,
        onChange: (e) => setUploadID(e.target.value),
        required: true
      }
    ), /* @__PURE__ */ React.createElement("div", { className: "file-label" }, /* @__PURE__ */ React.createElement("label", { htmlFor: "docFile" }, "\u0412\u044B\u0431\u0440\u0430\u0442\u044C \u0444\u0430\u0439\u043B"), /* @__PURE__ */ React.createElement("input", { id: "docFile", type: "file", onChange: (e) => setFile(e.target.files[0] || null), required: true }), /* @__PURE__ */ React.createElement("span", { className: "file-name" }, file?.name || "\u0424\u0430\u0439\u043B \u043D\u0435 \u0432\u044B\u0431\u0440\u0430\u043D")), /* @__PURE__ */ React.createElement("button", { type: "submit" }, "\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C")), /* @__PURE__ */ React.createElement("form", { onSubmit: download }, /* @__PURE__ */ React.createElement("h3", null, "\u0421\u043A\u0430\u0447\u0430\u0442\u044C \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        min: "1",
        placeholder: "ID \u0437\u0430\u044F\u0432\u043A\u0438",
        value: dl.loanID,
        onChange: (e) => setDl((p) => ({ ...p, loanID: e.target.value })),
        required: true
      }
    ), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        placeholder: "\u0438\u043C\u044F_\u0444\u0430\u0439\u043B\u0430.pdf",
        value: dl.filename,
        onChange: (e) => setDl((p) => ({ ...p, filename: e.target.value })),
        required: true
      }
    ), /* @__PURE__ */ React.createElement("button", { type: "submit" }, "\u0421\u043A\u0430\u0447\u0430\u0442\u044C"))));
  }
  function CommentsPage({ accessToken, writeLog }) {
    const [listID, setListID] = useState("");
    const [form, setForm] = useState({ loanID: "", category: "review", body: "", is_internal: false });
    async function list(e) {
      e.preventDefault();
      try {
        writeLog(`\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0438 \u043A \u0437\u0430\u044F\u0432\u043A\u0435 #${listID}`, await apiFetch(`/loans/${listID}/comments/`, "GET", null, accessToken));
      } catch (e2) {
        writeLog("\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0435\u0432", e2.message);
      }
    }
    async function create(e) {
      e.preventDefault();
      try {
        writeLog(`\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439 \u2192 \u0437\u0430\u044F\u0432\u043A\u0430 #${form.loanID}`, await apiFetch(`/loans/${form.loanID}/comments/`, "POST", {
          category: form.category,
          body: form.body,
          is_internal: form.is_internal
        }, accessToken));
      } catch (e2) {
        writeLog("\u041E\u0448\u0438\u0431\u043A\u0430 \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0438\u044F \u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u044F", e2.message);
      }
    }
    return /* @__PURE__ */ React.createElement(Section, { title: "\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0438" }, /* @__PURE__ */ React.createElement("div", { className: "split" }, /* @__PURE__ */ React.createElement("form", { onSubmit: list }, /* @__PURE__ */ React.createElement("h3", null, "\u0421\u043F\u0438\u0441\u043E\u043A \u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0435\u0432"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        min: "1",
        placeholder: "ID \u0437\u0430\u044F\u0432\u043A\u0438",
        value: listID,
        onChange: (e) => setListID(e.target.value),
        required: true
      }
    ), /* @__PURE__ */ React.createElement("button", { type: "submit" }, "\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C")), /* @__PURE__ */ React.createElement("form", { onSubmit: create }, /* @__PURE__ */ React.createElement("h3", null, "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        min: "1",
        placeholder: "ID \u0437\u0430\u044F\u0432\u043A\u0438",
        value: form.loanID,
        onChange: (e) => setForm((p) => ({ ...p, loanID: e.target.value })),
        required: true
      }
    ), /* @__PURE__ */ React.createElement("select", { value: form.category, onChange: (e) => setForm((p) => ({ ...p, category: e.target.value })) }, /* @__PURE__ */ React.createElement("option", { value: "review" }, "review \u2014 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430"), /* @__PURE__ */ React.createElement("option", { value: "risk" }, "risk \u2014 \u0440\u0438\u0441\u043A"), /* @__PURE__ */ React.createElement("option", { value: "verification" }, "verification \u2014 \u0432\u0435\u0440\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u044F"), /* @__PURE__ */ React.createElement("option", { value: "follow_up" }, "follow_up \u2014 \u0443\u0442\u043E\u0447\u043D\u0435\u043D\u0438\u0435")), /* @__PURE__ */ React.createElement(
      "textarea",
      {
        rows: "3",
        placeholder: "\u0422\u0435\u043A\u0441\u0442 \u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u044F (5\u2013500 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432)",
        value: form.body,
        onChange: (e) => setForm((p) => ({ ...p, body: e.target.value })),
        required: true
      }
    ), /* @__PURE__ */ React.createElement("label", null, /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "checkbox",
        checked: form.is_internal,
        onChange: (e) => setForm((p) => ({ ...p, is_internal: e.target.checked }))
      }
    ), "\u0412\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0439 (\u0442\u043E\u043B\u044C\u043A\u043E \u0434\u043B\u044F \u043C\u0435\u043D\u0435\u0434\u0436\u0435\u0440\u0430)"), /* @__PURE__ */ React.createElement("button", { type: "submit" }, "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439"))));
  }
  function ManagerPage({ accessToken, writeLog }) {
    const [dec, setDec] = useState({ loanID: "", status: "approved", reason: "" });
    const [scoreID, setScoreID] = useState("");
    const [score, setScore] = useState(null);
    const [exp, setExp] = useState({ status: "", currency: "" });
    const [csumID, setCsumID] = useState("");
    const ACCENT = "#0ea5e9";
    async function pending() {
      try {
        writeLog("\u041E\u0436\u0438\u0434\u0430\u044E\u0449\u0438\u0435 \u0437\u0430\u044F\u0432\u043A\u0438", await apiFetch("/manager/loans/pending", "GET", null, accessToken));
      } catch (e) {
        writeLog("\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u043E\u0447\u0435\u0440\u0435\u0434\u0438", e.message);
      }
    }
    async function decide(e) {
      e.preventDefault();
      try {
        writeLog(`\u0420\u0435\u0448\u0435\u043D\u0438\u0435 \u043F\u043E \u0437\u0430\u044F\u0432\u043A\u0435 #${dec.loanID}`, await apiFetch(`/manager/loans/${dec.loanID}/decision`, "PATCH", { status: dec.status, reason: dec.reason }, accessToken));
      } catch (e2) {
        writeLog("\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438\u043D\u044F\u0442\u0438\u044F \u0440\u0435\u0448\u0435\u043D\u0438\u044F", e2.message);
      }
    }
    async function calcScore(e) {
      e.preventDefault();
      try {
        const data = await apiFetch(`/manager/loans/${scoreID}/score`, "GET", null, accessToken);
        setScore(data);
        writeLog(`\u041E\u0446\u0435\u043D\u043A\u0430 \u0437\u0430\u044F\u0432\u043A\u0438 #${scoreID}`, data);
      } catch (e2) {
        writeLog("\u041E\u0448\u0438\u0431\u043A\u0430 \u0440\u0430\u0441\u0447\u0451\u0442\u0430 \u043E\u0446\u0435\u043D\u043A\u0438", e2.message);
      }
    }
    async function exportCsv() {
      const p = new URLSearchParams();
      if (exp.status) p.set("status", exp.status);
      if (exp.currency) p.set("currency", exp.currency);
      try {
        writeLog("CSV \u044D\u043A\u0441\u043F\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u043D", await apiDownload(`/manager/reports/export?${p}`, `loans_${Date.now()}.csv`, accessToken));
      } catch (e) {
        writeLog("\u041E\u0448\u0438\u0431\u043A\u0430 \u044D\u043A\u0441\u043F\u043E\u0440\u0442\u0430", e.message);
      }
    }
    async function checksum(e) {
      e.preventDefault();
      try {
        writeLog(`\u041A\u043E\u043D\u0442\u0440\u043E\u043B\u044C\u043D\u0430\u044F \u0441\u0443\u043C\u043C\u0430 \u0437\u0430\u044F\u0432\u043A\u0438 #${csumID}`, await apiFetch(`/manager/reports/checksum?id=${csumID}`, "GET", null, accessToken));
      } catch (e2) {
        writeLog("\u041E\u0448\u0438\u0431\u043A\u0430 \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044C\u043D\u043E\u0439 \u0441\u0443\u043C\u043C\u044B", e2.message);
      }
    }
    const lvl = (score?.risk_level || "").toLowerCase();
    return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Section, { title: "\u0420\u0430\u0431\u043E\u0447\u0435\u0435 \u043C\u0435\u0441\u0442\u043E \u043C\u0435\u043D\u0435\u0434\u0436\u0435\u0440\u0430", accent: ACCENT }, /* @__PURE__ */ React.createElement("div", { className: "manager-grid" }, /* @__PURE__ */ React.createElement("article", { className: "manager-panel" }, /* @__PURE__ */ React.createElement("h3", null, "\u041E\u0447\u0435\u0440\u0435\u0434\u044C \u043E\u0436\u0438\u0434\u0430\u043D\u0438\u044F"), /* @__PURE__ */ React.createElement("p", { className: "hint" }, "\u0417\u0430\u044F\u0432\u043A\u0438, \u043E\u0436\u0438\u0434\u0430\u044E\u0449\u0438\u0435 \u0440\u0435\u0448\u0435\u043D\u0438\u044F \u043F\u043E \u043E\u0434\u043E\u0431\u0440\u0435\u043D\u0438\u044E \u0438\u043B\u0438 \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u044E."), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: pending }, "\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u043E\u0436\u0438\u0434\u0430\u044E\u0449\u0438\u0435")), /* @__PURE__ */ React.createElement("form", { className: "manager-panel compact-form", onSubmit: decide }, /* @__PURE__ */ React.createElement("h3", null, "\u041F\u0440\u0438\u043D\u044F\u0442\u044C \u0440\u0435\u0448\u0435\u043D\u0438\u0435"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        min: "1",
        placeholder: "ID \u0437\u0430\u044F\u0432\u043A\u0438",
        value: dec.loanID,
        onChange: (e) => setDec((p) => ({ ...p, loanID: e.target.value })),
        required: true
      }
    ), /* @__PURE__ */ React.createElement("select", { value: dec.status, onChange: (e) => setDec((p) => ({ ...p, status: e.target.value })) }, /* @__PURE__ */ React.createElement("option", { value: "approved" }, "\u043E\u0434\u043E\u0431\u0440\u0438\u0442\u044C"), /* @__PURE__ */ React.createElement("option", { value: "rejected" }, "\u043E\u0442\u043A\u043B\u043E\u043D\u0438\u0442\u044C")), /* @__PURE__ */ React.createElement(
      "textarea",
      {
        rows: "2",
        placeholder: "\u041F\u0440\u0438\u0447\u0438\u043D\u0430 (5+ \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432)",
        value: dec.reason,
        onChange: (e) => setDec((p) => ({ ...p, reason: e.target.value })),
        required: true
      }
    ), /* @__PURE__ */ React.createElement("button", { type: "submit" }, "\u041F\u0440\u0438\u043C\u0435\u043D\u0438\u0442\u044C \u0440\u0435\u0448\u0435\u043D\u0438\u0435")))), /* @__PURE__ */ React.createElement(Section, { title: "\u041E\u0446\u0435\u043D\u043A\u0430 \u043A\u0440\u0435\u0434\u0438\u0442\u043D\u043E\u0433\u043E \u0440\u0438\u0441\u043A\u0430", accent: ACCENT }, /* @__PURE__ */ React.createElement("div", { className: "manager-grid" }, /* @__PURE__ */ React.createElement("form", { className: "manager-panel compact-form", onSubmit: calcScore }, /* @__PURE__ */ React.createElement("h3", null, "\u0420\u0430\u0441\u0441\u0447\u0438\u0442\u0430\u0442\u044C \u043E\u0446\u0435\u043D\u043A\u0443"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        min: "1",
        placeholder: "ID \u0437\u0430\u044F\u0432\u043A\u0438",
        value: scoreID,
        onChange: (e) => setScoreID(e.target.value),
        required: true
      }
    ), /* @__PURE__ */ React.createElement("button", { type: "submit" }, "\u0420\u0430\u0441\u0441\u0447\u0438\u0442\u0430\u0442\u044C"), /* @__PURE__ */ React.createElement("p", { className: "hint" }, "\u0412\u043E\u0437\u0432\u0440\u0430\u0449\u0430\u0435\u0442 \u043E\u0446\u0435\u043D\u043A\u0443 0\u2013100 \u0438 \u0443\u0440\u043E\u0432\u0435\u043D\u044C \u0440\u0438\u0441\u043A\u0430: \u043D\u0438\u0437\u043A\u0438\u0439 / \u0441\u0440\u0435\u0434\u043D\u0438\u0439 / \u0432\u044B\u0441\u043E\u043A\u0438\u0439.")), /* @__PURE__ */ React.createElement("div", { className: `score-box manager-panel ${score ? "" : "hidden"}` }, /* @__PURE__ */ React.createElement("div", { className: `score-circle ${lvl}` }, score?.score ?? "\u2013"), /* @__PURE__ */ React.createElement("div", { className: `score-label ${lvl}` }, lvl === "low" ? "\u043D\u0438\u0437\u043A\u0438\u0439" : lvl === "medium" ? "\u0441\u0440\u0435\u0434\u043D\u0438\u0439" : lvl === "high" ? "\u0432\u044B\u0441\u043E\u043A\u0438\u0439" : "\u2013"), /* @__PURE__ */ React.createElement("div", { className: "score-meta" }, score ? `\u0417\u0430\u044F\u0432\u043A\u0430 #${score.loan_id}` : "")))), /* @__PURE__ */ React.createElement(Section, { title: "\u041E\u0442\u0447\u0451\u0442\u044B", accent: ACCENT }, /* @__PURE__ */ React.createElement("div", { className: "manager-grid" }, /* @__PURE__ */ React.createElement("div", { className: "manager-panel compact-form" }, /* @__PURE__ */ React.createElement("h3", null, "\u042D\u043A\u0441\u043F\u043E\u0440\u0442 \u0432 CSV"), /* @__PURE__ */ React.createElement("select", { value: exp.status, onChange: (e) => setExp((p) => ({ ...p, status: e.target.value })) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "\u0432\u0441\u0435 \u0441\u0442\u0430\u0442\u0443\u0441\u044B"), /* @__PURE__ */ React.createElement("option", { value: "pending" }, "\u043E\u0436\u0438\u0434\u0430\u043D\u0438\u0435"), /* @__PURE__ */ React.createElement("option", { value: "approved" }, "\u043E\u0434\u043E\u0431\u0440\u0435\u043D\u043E"), /* @__PURE__ */ React.createElement("option", { value: "rejected" }, "\u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u043E")), /* @__PURE__ */ React.createElement("select", { value: exp.currency, onChange: (e) => setExp((p) => ({ ...p, currency: e.target.value })) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "\u0432\u0441\u0435 \u0432\u0430\u043B\u044E\u0442\u044B"), /* @__PURE__ */ React.createElement("option", { value: "USD" }, "USD"), /* @__PURE__ */ React.createElement("option", { value: "EUR" }, "EUR"), /* @__PURE__ */ React.createElement("option", { value: "RUB" }, "RUB")), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: exportCsv }, "\u0421\u043A\u0430\u0447\u0430\u0442\u044C CSV")), /* @__PURE__ */ React.createElement("form", { className: "manager-panel compact-form", onSubmit: checksum }, /* @__PURE__ */ React.createElement("h3", null, "\u041A\u043E\u043D\u0442\u0440\u043E\u043B\u044C\u043D\u0430\u044F \u0441\u0443\u043C\u043C\u0430"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        min: "1",
        placeholder: "ID \u0437\u0430\u044F\u0432\u043A\u0438",
        value: csumID,
        onChange: (e) => setCsumID(e.target.value),
        required: true
      }
    ), /* @__PURE__ */ React.createElement("button", { type: "submit" }, "\u041F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u0445\u044D\u0448")))));
  }
  function AdminPage({ accessToken, writeLog }) {
    const [host, setHost] = useState("127.0.0.1");
    const [webhook, setWebhook] = useState("https://httpbin.org/get");
    const [stats, setStats] = useState(null);
    const ACCENT = "#f59e0b";
    async function ping(e) {
      e.preventDefault();
      try {
        writeLog(`\u041F\u0438\u043D\u0433 \u2192 ${host}`, await apiFetch(`/admin/ping?host=${encodeURIComponent(host)}`, "GET", null, accessToken));
      } catch (e2) {
        writeLog("\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0438\u043D\u0433\u0430", e2.message);
      }
    }
    async function fireWebhook(e) {
      e.preventDefault();
      try {
        writeLog(`\u0412\u0435\u0431\u0445\u0443\u043A \u2192 ${webhook}`, await apiFetch(`/admin/webhook-test?url=${encodeURIComponent(webhook)}`, "GET", null, accessToken));
      } catch (e2) {
        writeLog("\u041E\u0448\u0438\u0431\u043A\u0430 \u0432\u0435\u0431\u0445\u0443\u043A\u0430", e2.message);
      }
    }
    async function loadStats() {
      try {
        const data = await apiFetch("/admin/stats", "GET", null, accessToken);
        setStats(data);
        writeLog("\u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0430 \u0441\u0438\u0441\u0442\u0435\u043C\u044B", data);
      } catch (e) {
        writeLog("\u041E\u0448\u0438\u0431\u043A\u0430 \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0438", e.message);
      }
    }
    return /* @__PURE__ */ React.createElement(React.Fragment, null, stats && /* @__PURE__ */ React.createElement("div", { className: "stats-row" }, [
      { val: stats.total_users, label: "\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u0438" },
      { val: stats.total_loans, label: "\u0417\u0430\u044F\u0432\u043A\u0438" },
      { val: stats.pending_loans, label: "\u0412 \u043E\u0436\u0438\u0434\u0430\u043D\u0438\u0438" },
      { val: stats.total_loan_comments, label: "\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0438" }
    ].map((s) => /* @__PURE__ */ React.createElement("div", { key: s.label, className: "stat-card" }, /* @__PURE__ */ React.createElement("div", { className: "stat-val" }, s.val ?? "\u2013"), /* @__PURE__ */ React.createElement("div", { className: "stat-key" }, s.label)))), /* @__PURE__ */ React.createElement(Section, { title: "\u041F\u0430\u043D\u0435\u043B\u044C \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u0430", accent: ACCENT }, /* @__PURE__ */ React.createElement("div", { className: "split" }, /* @__PURE__ */ React.createElement("form", { onSubmit: ping }, /* @__PURE__ */ React.createElement("h3", null, "\u041F\u0438\u043D\u0433 \u0445\u043E\u0441\u0442\u0430"), /* @__PURE__ */ React.createElement("input", { type: "text", value: host, onChange: (e) => setHost(e.target.value) }), /* @__PURE__ */ React.createElement("button", { type: "submit" }, "\u041F\u0438\u043D\u0433\u043E\u0432\u0430\u0442\u044C")), /* @__PURE__ */ React.createElement("form", { onSubmit: fireWebhook }, /* @__PURE__ */ React.createElement("h3", null, "\u0422\u0435\u0441\u0442 \u0432\u0435\u0431\u0445\u0443\u043A\u0430"), /* @__PURE__ */ React.createElement("input", { type: "text", value: webhook, onChange: (e) => setWebhook(e.target.value) }), /* @__PURE__ */ React.createElement("button", { type: "submit" }, "\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0437\u0430\u043F\u0440\u043E\u0441"))), /* @__PURE__ */ React.createElement("div", { className: "mt8" }, /* @__PURE__ */ React.createElement("button", { type: "button", onClick: loadStats }, "\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0443 \u0441\u0438\u0441\u0442\u0435\u043C\u044B"))));
  }
  function App() {
    const [tokens, setTokens] = useState(() => {
      try {
        const raw = localStorage.getItem(TOKENS_KEY);
        if (!raw) return { access: "", refresh: "" };
        const p = JSON.parse(raw);
        return { access: p?.access || "", refresh: p?.refresh || "" };
      } catch {
        return { access: "", refresh: "" };
      }
    });
    const [logs, setLogs] = useState([]);
    const [page, setPage] = useState(() => {
      const seg = window.location.pathname.replace(/^\/ui\/?/, "").replace(/\/$/, "");
      return NAV_PAGES.some((p) => p.id === seg) ? seg : NAV_PAGES[0].id;
    });
    const isAuthed = Boolean(tokens.access);
    const viewer = useMemo(() => decodeJwtPayload(tokens.access), [tokens.access]);
    useEffect(() => {
      localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
    }, [tokens]);
    useEffect(() => {
      const handler = () => {
        const seg = window.location.pathname.replace(/^\/ui\/?/, "").replace(/\/$/, "");
        setPage(NAV_PAGES.some((p) => p.id === seg) ? seg : NAV_PAGES[0].id);
      };
      window.addEventListener("popstate", handler);
      return () => window.removeEventListener("popstate", handler);
    }, []);
    function changePage(next) {
      window.history.pushState({}, "", `/ui/${next}`);
      setPage(next);
    }
    function writeLog(title, payload) {
      setLogs((prev) => [{ ts: nowIso(), title, payload }, ...prev].slice(0, 300));
    }
    async function logout() {
      try {
        if (tokens.access)
          await apiFetch("/auth/logout", "POST", { refresh_token: tokens.refresh }, tokens.access);
      } catch (_) {
      }
      setTokens({ access: "", refresh: "" });
      setPage(NAV_PAGES[0].id);
      window.history.pushState({}, "", "/ui");
    }
    if (!isAuthed) {
      return /* @__PURE__ */ React.createElement("div", { className: "layout-gate" }, /* @__PURE__ */ React.createElement(AuthGate, { setTokens, writeLog }));
    }
    return /* @__PURE__ */ React.createElement("div", { className: "layout-app" }, /* @__PURE__ */ React.createElement(Navbar, { viewer, page, changePage, logout }), /* @__PURE__ */ React.createElement("main", { className: "app-main" }, page === "profile" && /* @__PURE__ */ React.createElement(ProfilePage, { accessToken: tokens.access, writeLog }), page === "loans" && /* @__PURE__ */ React.createElement(LoansPage, { accessToken: tokens.access, writeLog }), page === "documents" && /* @__PURE__ */ React.createElement(DocumentsPage, { accessToken: tokens.access, writeLog }), page === "comments" && /* @__PURE__ */ React.createElement(CommentsPage, { accessToken: tokens.access, writeLog }), page === "manager" && /* @__PURE__ */ React.createElement(ManagerPage, { accessToken: tokens.access, writeLog }), page === "admin" && /* @__PURE__ */ React.createElement(AdminPage, { accessToken: tokens.access, writeLog }), /* @__PURE__ */ React.createElement(ActivityLog, { logs, clearLogs: () => setLogs([]) })));
  }
  ReactDOM.createRoot(document.getElementById("root")).render(/* @__PURE__ */ React.createElement(App, null));
})();
