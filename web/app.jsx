const { useEffect, useMemo, useRef, useState } = React;

const TOKENS_KEY = "credit_mvp_v2_tokens";

const NAV_PAGES = [
  { id: "profile",   label: "Профиль",       role: null },
  { id: "loans",     label: "Заявки",         role: null },
  { id: "documents", label: "Документы",      role: null },
  { id: "comments",  label: "Комментарии",    role: null },
  { id: "manager",   label: "Менеджер",       role: "manager" },
  { id: "admin",     label: "Администратор",  role: "manager" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function decodeJwtPayload(token) {
  if (!token) return null;
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b64));
  } catch { return null; }
}

function nowIso() { return new Date().toISOString(); }

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
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await decodeResponse(res);
  if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function apiForm(path, file, accessToken) {
  if (!accessToken) throw new Error("Не аутентифицирован");
  const payload = new FormData();
  payload.append("document", file);
  const res = await fetch(path, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: payload,
  });
  const data = await decodeResponse(res);
  if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function apiDownload(path, name, accessToken) {
  if (!accessToken) throw new Error("Не аутентифицирован");
  const res = await fetch(path, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    const err = await decodeResponse(res);
    throw new Error(`${res.status}: ${JSON.stringify(err)}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  return { ok: true, bytes: blob.size, type: blob.type || "unknown" };
}

// ─── Auth Gate ────────────────────────────────────────────────────────────────

function AuthGate({ setTokens, writeLog }) {
  const [tab, setTab] = useState("login");
  const [reg, setReg] = useState({ email: "", password: "", full_name: "" });
  const [log, setLog] = useState({ email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  async function handleLogin(e) {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      const data = await apiFetch("/auth/login", "POST", log);
      setTokens({ access: data.access_token || "", refresh: data.refresh_token || "" });
      writeLog("Вход выполнен", data);
    } catch (ex) { setErr(ex.message); }
    finally { setBusy(false); }
  }

  async function handleRegister(e) {
    e.preventDefault(); setErr(""); setOk(""); setBusy(true);
    try {
      const data = await apiFetch("/auth/register", "POST", reg);
      writeLog("Регистрация", data);
      setOk("Аккаунт создан. Теперь вы можете войти.");
      setTab("login");
      setLog({ email: reg.email, password: "" });
    } catch (ex) { setErr(ex.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="gate-wrap">
      <div className="gate-brand">
        <div className="gate-logo">CM</div>
        <h1 className="gate-title">Credit MVP</h1>
        <p className="gate-sub">Платформа управления кредитными заявками</p>
      </div>

      <div className="gate-card">
        <div className="gate-tabs">
          <button
            type="button"
            className={`gate-tab ${tab === "login" ? "active" : ""}`}
            onClick={() => { setTab("login"); setErr(""); setOk(""); }}
          >Войти</button>
          <button
            type="button"
            className={`gate-tab ${tab === "register" ? "active" : ""}`}
            onClick={() => { setTab("register"); setErr(""); setOk(""); }}
          >Регистрация</button>
        </div>

        {err && <div className="gate-alert err">{err}</div>}
        {ok  && <div className="gate-alert ok">{ok}</div>}

        {tab === "login" ? (
          <form onSubmit={handleLogin} className="gate-form">
            <label>Email
              <input type="email" placeholder="you@example.com" value={log.email}
                onChange={e => setLog(p => ({ ...p, email: e.target.value }))} required />
            </label>
            <label>Пароль
              <input type="password" placeholder="••••••••••" value={log.password}
                onChange={e => setLog(p => ({ ...p, password: e.target.value }))} required />
            </label>
            <button type="submit" disabled={busy} className="gate-submit">
              {busy ? "Вход…" : "Войти"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="gate-form">
            <label>Полное имя
              <input type="text" placeholder="Иванов Иван Иванович" value={reg.full_name}
                onChange={e => setReg(p => ({ ...p, full_name: e.target.value }))} required />
            </label>
            <label>Email
              <input type="email" placeholder="you@example.com" value={reg.email}
                onChange={e => setReg(p => ({ ...p, email: e.target.value }))} required />
            </label>
            <label>Пароль <span className="hint">(10+ символов)</span>
              <input type="password" placeholder="••••••••••" value={reg.password}
                onChange={e => setReg(p => ({ ...p, password: e.target.value }))} required />
            </label>
            <button type="submit" disabled={busy} className="gate-submit">
              {busy ? "Создание аккаунта…" : "Создать аккаунт"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Navbar ───────────────────────────────────────────────────────────────────

function Navbar({ viewer, page, changePage, logout }) {
  const role = viewer?.role || "";
  const name = viewer?.full_name || viewer?.email || `#${viewer?.sub || viewer?.user_id || "?"}`;
  const roleLabel = role === "manager" ? "менеджер" : role || "клиент";
  const visiblePages = NAV_PAGES.filter(p => !p.role || p.role === role);

  return (
    <header className="navbar">
      <div className="nb-brand">
        <span className="nb-logo">CM</span>
        <span className="nb-name">Credit MVP</span>
      </div>

      <nav className="nb-nav">
        {visiblePages.map(p => (
          <button
            key={p.id}
            type="button"
            className={`nb-link ${p.id === page ? "active" : ""}`}
            onClick={() => changePage(p.id)}
          >{p.label}</button>
        ))}
      </nav>

      <div className="nb-right">
        <span className="nb-role-pill" data-role={role}>{roleLabel}</span>
        <span className="nb-user">{name}</span>
        <button type="button" className="nb-logout" onClick={logout}>Выйти</button>
      </div>
    </header>
  );
}

// ─── Activity Log ─────────────────────────────────────────────────────────────

function ActivityLog({ logs, clearLogs }) {
  const endRef = useRef(null);

  const entries = useMemo(() =>
    logs.map(l => ({
      ...l,
      isErr: /ошибка|error/i.test(l.title),
      body: typeof l.payload === "string"
        ? l.payload
        : JSON.stringify(l.payload, null, 2),
    })), [logs]);

  return (
    <section className="activity-section">
      <div className="activity-header">
        <h2 className="activity-title">Журнал активности</h2>
        <span className="activity-count">{logs.length} записей</span>
        <button type="button" className="ghost activity-clear" onClick={clearLogs}>Очистить</button>
      </div>

      {!entries.length
        ? <div className="activity-empty">Нет активности. Выполните действие выше.</div>
        : (
          <div className="activity-list">
            {entries.map((l, i) => (
              <article key={`${l.ts}-${i}`} className={`activity-item ${l.isErr ? "err" : "ok"}`}>
                <div className="activity-meta">
                  <span className={`activity-badge ${l.isErr ? "err" : "ok"}`}>
                    {l.isErr ? "ОШБ" : "OK"}
                  </span>
                  <span className="activity-label">{l.title}</span>
                  <time className="activity-ts">{l.ts.replace("T", " ").slice(0, 19)}</time>
                </div>
                <pre className="activity-body">{l.body}</pre>
              </article>
            ))}
            <div ref={endRef} />
          </div>
        )
      }
    </section>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ accent, title, children }) {
  return (
    <section className="card" style={accent ? { borderLeft: `4px solid ${accent}` } : {}}>
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}

// ─── Профиль ─────────────────────────────────────────────────────────────────

function ProfilePage({ accessToken, writeLog }) {
  const [fullName, setFullName] = useState("");

  async function load() {
    try { writeLog("Профиль получен", await apiFetch("/profile/", "GET", null, accessToken)); }
    catch (e) { writeLog("Ошибка профиля", e.message); }
  }

  async function save(e) {
    e.preventDefault();
    try { writeLog("Профиль обновлён", await apiFetch("/profile/", "PATCH", { full_name: fullName }, accessToken)); }
    catch (e) { writeLog("Ошибка обновления", e.message); }
  }

  return (
    <Section title="Профиль пользователя">
      <div className="split">
        <div>
          <h3>Просмотр профиля</h3>
          <p className="hint">Возвращает id, email, имя, роль, дату создания и кредитный лимит.</p>
          <button type="button" onClick={load}>Получить профиль</button>
        </div>
        <form onSubmit={save}>
          <h3>Изменить имя</h3>
          <input type="text" placeholder="Новое полное имя" value={fullName}
            onChange={e => setFullName(e.target.value)} required />
          <button type="submit">Сохранить изменения</button>
        </form>
      </div>
    </Section>
  );
}

// ─── Заявки ───────────────────────────────────────────────────────────────────

function LoansPage({ accessToken, writeLog }) {
  const [loan, setLoan] = useState({ amount_cents: "50000000", currency: "RUB", term_months: "12", purpose: "" });
  const [loanID, setLoanID] = useState("");

  async function create(e) {
    e.preventDefault();
    try {
      writeLog("Заявка создана", await apiFetch("/loans/", "POST", {
        amount_cents: Number(loan.amount_cents),
        currency: loan.currency,
        term_months: Number(loan.term_months),
        purpose: loan.purpose,
      }, accessToken));
    } catch (e) { writeLog("Ошибка создания заявки", e.message); }
  }

  async function listMine() {
    try { writeLog("Мои заявки", await apiFetch("/loans/my", "GET", null, accessToken)); }
    catch (e) { writeLog("Ошибка загрузки заявок", e.message); }
  }

  async function getByID(e) {
    e.preventDefault();
    try { writeLog(`Заявка #${loanID}`, await apiFetch(`/loans/${loanID}`, "GET", null, accessToken)); }
    catch (e) { writeLog("Ошибка получения заявки", e.message); }
  }

  return (
    <Section title="Кредитные заявки">
      <div className="split">
        <form onSubmit={create}>
          <h3>Новая заявка</h3>
          <label>Сумма (в копейках)
            <input type="number" min="10000" value={loan.amount_cents}
              onChange={e => setLoan(p => ({ ...p, amount_cents: e.target.value }))} required />
          </label>
          <label>Валюта
            <select value={loan.currency} onChange={e => setLoan(p => ({ ...p, currency: e.target.value }))} required>
              <option>RUB</option><option>USD</option><option>EUR</option>
            </select>
          </label>
          <label>Срок (месяцы)
            <input type="number" min="1" max="120" value={loan.term_months}
              onChange={e => setLoan(p => ({ ...p, term_months: e.target.value }))} required />
          </label>
          <label>Цель кредита
            <textarea rows="2" placeholder="Опишите цель кредита…" value={loan.purpose}
              onChange={e => setLoan(p => ({ ...p, purpose: e.target.value }))} required />
          </label>
          <button type="submit">Подать заявку</button>
        </form>

        <div>
          <h3>Мои заявки</h3>
          <button type="button" onClick={listMine}>Загрузить мои заявки</button>

          <form className="mt8" onSubmit={getByID}>
            <h3>Поиск по ID</h3>
            <input type="number" min="1" placeholder="ID заявки" value={loanID}
              onChange={e => setLoanID(e.target.value)} required />
            <button type="submit">Найти заявку</button>
          </form>
        </div>
      </div>
    </Section>
  );
}

// ─── Документы ────────────────────────────────────────────────────────────────

function DocumentsPage({ accessToken, writeLog }) {
  const [uploadID, setUploadID] = useState("");
  const [dl, setDl] = useState({ loanID: "", filename: "" });
  const [file, setFile] = useState(null);

  async function upload(e) {
    e.preventDefault();
    if (!file) { writeLog("Ошибка загрузки", "Файл не выбран"); return; }
    try { writeLog(`Документ загружен → заявка #${uploadID}`, await apiForm(`/loans/${uploadID}/documents/`, file, accessToken)); }
    catch (e) { writeLog("Ошибка загрузки файла", e.message); }
  }

  async function download(e) {
    e.preventDefault();
    try { writeLog("Файл скачан", await apiDownload(`/loans/${dl.loanID}/documents/${dl.filename}`, dl.filename, accessToken)); }
    catch (e) { writeLog("Ошибка скачивания", e.message); }
  }

  return (
    <Section title="Документы">
      <div className="split">
        <form onSubmit={upload}>
          <h3>Загрузить документ</h3>
          <input type="number" min="1" placeholder="ID заявки" value={uploadID}
            onChange={e => setUploadID(e.target.value)} required />
          <div className="file-label">
            <label htmlFor="docFile">Выбрать файл</label>
            <input id="docFile" type="file" onChange={e => setFile(e.target.files[0] || null)} required />
            <span className="file-name">{file?.name || "Файл не выбран"}</span>
          </div>
          <button type="submit">Загрузить</button>
        </form>
        <form onSubmit={download}>
          <h3>Скачать документ</h3>
          <input type="number" min="1" placeholder="ID заявки" value={dl.loanID}
            onChange={e => setDl(p => ({ ...p, loanID: e.target.value }))} required />
          <input type="text" placeholder="имя_файла.pdf" value={dl.filename}
            onChange={e => setDl(p => ({ ...p, filename: e.target.value }))} required />
          <button type="submit">Скачать</button>
        </form>
      </div>
    </Section>
  );
}

// ─── Комментарии ──────────────────────────────────────────────────────────────

function CommentsPage({ accessToken, writeLog }) {
  const [listID, setListID] = useState("");
  const [form, setForm] = useState({ loanID: "", category: "review", body: "", is_internal: false });

  async function list(e) {
    e.preventDefault();
    try { writeLog(`Комментарии к заявке #${listID}`, await apiFetch(`/loans/${listID}/comments/`, "GET", null, accessToken)); }
    catch (e) { writeLog("Ошибка загрузки комментариев", e.message); }
  }

  async function create(e) {
    e.preventDefault();
    try {
      writeLog(`Комментарий → заявка #${form.loanID}`, await apiFetch(`/loans/${form.loanID}/comments/`, "POST", {
        category: form.category, body: form.body, is_internal: form.is_internal,
      }, accessToken));
    } catch (e) { writeLog("Ошибка добавления комментария", e.message); }
  }

  return (
    <Section title="Комментарии">
      <div className="split">
        <form onSubmit={list}>
          <h3>Список комментариев</h3>
          <input type="number" min="1" placeholder="ID заявки" value={listID}
            onChange={e => setListID(e.target.value)} required />
          <button type="submit">Загрузить</button>
        </form>
        <form onSubmit={create}>
          <h3>Добавить комментарий</h3>
          <input type="number" min="1" placeholder="ID заявки" value={form.loanID}
            onChange={e => setForm(p => ({ ...p, loanID: e.target.value }))} required />
          <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
            <option value="review">review — проверка</option>
            <option value="risk">risk — риск</option>
            <option value="verification">verification — верификация</option>
            <option value="follow_up">follow_up — уточнение</option>
          </select>
          <textarea rows="3" placeholder="Текст комментария (5–500 символов)" value={form.body}
            onChange={e => setForm(p => ({ ...p, body: e.target.value }))} required />
          <label>
            <input type="checkbox" checked={form.is_internal}
              onChange={e => setForm(p => ({ ...p, is_internal: e.target.checked }))} />
            Внутренний (только для менеджера)
          </label>
          <button type="submit">Добавить комментарий</button>
        </form>
      </div>
    </Section>
  );
}

// ─── Менеджер ─────────────────────────────────────────────────────────────────

function ManagerPage({ accessToken, writeLog }) {
  const [dec, setDec] = useState({ loanID: "", status: "approved", reason: "" });
  const [scoreID, setScoreID] = useState("");
  const [score, setScore] = useState(null);
  const [exp, setExp] = useState({ status: "", currency: "" });
  const [csumID, setCsumID] = useState("");

  const ACCENT = "#0ea5e9";

  async function pending() {
    try { writeLog("Ожидающие заявки", await apiFetch("/manager/loans/pending", "GET", null, accessToken)); }
    catch (e) { writeLog("Ошибка загрузки очереди", e.message); }
  }

  async function decide(e) {
    e.preventDefault();
    try { writeLog(`Решение по заявке #${dec.loanID}`, await apiFetch(`/manager/loans/${dec.loanID}/decision`, "PATCH", { status: dec.status, reason: dec.reason }, accessToken)); }
    catch (e) { writeLog("Ошибка принятия решения", e.message); }
  }

  async function calcScore(e) {
    e.preventDefault();
    try {
      const data = await apiFetch(`/manager/loans/${scoreID}/score`, "GET", null, accessToken);
      setScore(data); writeLog(`Оценка заявки #${scoreID}`, data);
    } catch (e) { writeLog("Ошибка расчёта оценки", e.message); }
  }

  async function exportCsv() {
    const p = new URLSearchParams();
    if (exp.status) p.set("status", exp.status);
    if (exp.currency) p.set("currency", exp.currency);
    try { writeLog("CSV экспортирован", await apiDownload(`/manager/reports/export?${p}`, `loans_${Date.now()}.csv`, accessToken)); }
    catch (e) { writeLog("Ошибка экспорта", e.message); }
  }

  async function checksum(e) {
    e.preventDefault();
    try { writeLog(`Контрольная сумма заявки #${csumID}`, await apiFetch(`/manager/reports/checksum?id=${csumID}`, "GET", null, accessToken)); }
    catch (e) { writeLog("Ошибка контрольной суммы", e.message); }
  }

  const lvl = (score?.risk_level || "").toLowerCase();

  return (
    <>
      <Section title="Рабочее место менеджера" accent={ACCENT}>
        <div className="manager-grid">
          <article className="manager-panel">
            <h3>Очередь ожидания</h3>
            <p className="hint">Заявки, ожидающие решения по одобрению или отклонению.</p>
            <button type="button" onClick={pending}>Загрузить ожидающие</button>
          </article>
          <form className="manager-panel compact-form" onSubmit={decide}>
            <h3>Принять решение</h3>
            <input type="number" min="1" placeholder="ID заявки" value={dec.loanID}
              onChange={e => setDec(p => ({ ...p, loanID: e.target.value }))} required />
            <select value={dec.status} onChange={e => setDec(p => ({ ...p, status: e.target.value }))}>
              <option value="approved">одобрить</option>
              <option value="rejected">отклонить</option>
            </select>
            <textarea rows="2" placeholder="Причина (5+ символов)" value={dec.reason}
              onChange={e => setDec(p => ({ ...p, reason: e.target.value }))} required />
            <button type="submit">Применить решение</button>
          </form>
        </div>
      </Section>

      <Section title="Оценка кредитного риска" accent={ACCENT}>
        <div className="manager-grid">
          <form className="manager-panel compact-form" onSubmit={calcScore}>
            <h3>Рассчитать оценку</h3>
            <input type="number" min="1" placeholder="ID заявки" value={scoreID}
              onChange={e => setScoreID(e.target.value)} required />
            <button type="submit">Рассчитать</button>
            <p className="hint">Возвращает оценку 0–100 и уровень риска: низкий / средний / высокий.</p>
          </form>
          <div className={`score-box manager-panel ${score ? "" : "hidden"}`}>
            <div className={`score-circle ${lvl}`}>{score?.score ?? "–"}</div>
            <div className={`score-label ${lvl}`}>
              {lvl === "low" ? "низкий" : lvl === "medium" ? "средний" : lvl === "high" ? "высокий" : "–"}
            </div>
            <div className="score-meta">{score ? `Заявка #${score.loan_id}` : ""}</div>
          </div>
        </div>
      </Section>

      <Section title="Отчёты" accent={ACCENT}>
        <div className="manager-grid">
          <div className="manager-panel compact-form">
            <h3>Экспорт в CSV</h3>
            <select value={exp.status} onChange={e => setExp(p => ({ ...p, status: e.target.value }))}>
              <option value="">все статусы</option>
              <option value="pending">ожидание</option>
              <option value="approved">одобрено</option>
              <option value="rejected">отклонено</option>
            </select>
            <select value={exp.currency} onChange={e => setExp(p => ({ ...p, currency: e.target.value }))}>
              <option value="">все валюты</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="RUB">RUB</option>
            </select>
            <button type="button" onClick={exportCsv}>Скачать CSV</button>
          </div>
          <form className="manager-panel compact-form" onSubmit={checksum}>
            <h3>Контрольная сумма</h3>
            <input type="number" min="1" placeholder="ID заявки" value={csumID}
              onChange={e => setCsumID(e.target.value)} required />
            <button type="submit">Получить хэш</button>
          </form>
        </div>
      </Section>
    </>
  );
}

// ─── Администратор ────────────────────────────────────────────────────────────

function AdminPage({ accessToken, writeLog }) {
  const [host, setHost] = useState("127.0.0.1");
  const [webhook, setWebhook] = useState("https://httpbin.org/get");
  const [stats, setStats] = useState(null);
  const ACCENT = "#f59e0b";

  async function ping(e) {
    e.preventDefault();
    try { writeLog(`Пинг → ${host}`, await apiFetch(`/admin/ping?host=${encodeURIComponent(host)}`, "GET", null, accessToken)); }
    catch (e) { writeLog("Ошибка пинга", e.message); }
  }

  async function fireWebhook(e) {
    e.preventDefault();
    try { writeLog(`Вебхук → ${webhook}`, await apiFetch(`/admin/webhook-test?url=${encodeURIComponent(webhook)}`, "GET", null, accessToken)); }
    catch (e) { writeLog("Ошибка вебхука", e.message); }
  }

  async function loadStats() {
    try {
      const data = await apiFetch("/admin/stats", "GET", null, accessToken);
      setStats(data); writeLog("Статистика системы", data);
    } catch (e) { writeLog("Ошибка статистики", e.message); }
  }

  return (
    <>
      {stats && (
        <div className="stats-row">
          {[
            { val: stats.total_users,         label: "Пользователи" },
            { val: stats.total_loans,         label: "Заявки" },
            { val: stats.pending_loans,       label: "В ожидании" },
            { val: stats.total_loan_comments, label: "Комментарии" },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-val">{s.val ?? "–"}</div>
              <div className="stat-key">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <Section title="Панель администратора" accent={ACCENT}>
        <div className="split">
          <form onSubmit={ping}>
            <h3>Пинг хоста</h3>
            <input type="text" value={host} onChange={e => setHost(e.target.value)} />
            <button type="submit">Пинговать</button>
          </form>
          <form onSubmit={fireWebhook}>
            <h3>Тест вебхука</h3>
            <input type="text" value={webhook} onChange={e => setWebhook(e.target.value)} />
            <button type="submit">Отправить запрос</button>
          </form>
        </div>
        <div className="mt8">
          <button type="button" onClick={loadStats}>Обновить статистику системы</button>
        </div>
      </Section>
    </>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

function App() {
  const [tokens, setTokens] = useState(() => {
    try {
      const raw = localStorage.getItem(TOKENS_KEY);
      if (!raw) return { access: "", refresh: "" };
      const p = JSON.parse(raw);
      return { access: p?.access || "", refresh: p?.refresh || "" };
    } catch { return { access: "", refresh: "" }; }
  });

  const [logs,  setLogs]  = useState([]);
  const [page,  setPage]  = useState(() => {
    const seg = window.location.pathname.replace(/^\/ui\/?/, "").replace(/\/$/, "");
    return NAV_PAGES.some(p => p.id === seg) ? seg : NAV_PAGES[0].id;
  });

  const isAuthed = Boolean(tokens.access);
  const viewer   = useMemo(() => decodeJwtPayload(tokens.access), [tokens.access]);

  useEffect(() => {
    localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
  }, [tokens]);

  useEffect(() => {
    const handler = () => {
      const seg = window.location.pathname.replace(/^\/ui\/?/, "").replace(/\/$/, "");
      setPage(NAV_PAGES.some(p => p.id === seg) ? seg : NAV_PAGES[0].id);
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  function changePage(next) {
    window.history.pushState({}, "", `/ui/${next}`);
    setPage(next);
  }

  function writeLog(title, payload) {
    setLogs(prev => [{ ts: nowIso(), title, payload }, ...prev].slice(0, 300));
  }

  async function logout() {
    try {
      if (tokens.access)
        await apiFetch("/auth/logout", "POST", { refresh_token: tokens.refresh }, tokens.access);
    } catch (_) {}
    setTokens({ access: "", refresh: "" });
    setPage(NAV_PAGES[0].id);
    window.history.pushState({}, "", "/ui");
  }

  if (!isAuthed) {
    return (
      <div className="layout-gate">
        <AuthGate setTokens={setTokens} writeLog={writeLog} />
      </div>
    );
  }

  return (
    <div className="layout-app">
      <Navbar viewer={viewer} page={page} changePage={changePage} logout={logout} />

      <main className="app-main">
        {page === "profile"   && <ProfilePage   accessToken={tokens.access} writeLog={writeLog} />}
        {page === "loans"     && <LoansPage     accessToken={tokens.access} writeLog={writeLog} />}
        {page === "documents" && <DocumentsPage accessToken={tokens.access} writeLog={writeLog} />}
        {page === "comments"  && <CommentsPage  accessToken={tokens.access} writeLog={writeLog} />}
        {page === "manager"   && <ManagerPage   accessToken={tokens.access} writeLog={writeLog} />}
        {page === "admin"     && <AdminPage     accessToken={tokens.access} writeLog={writeLog} />}

        <ActivityLog logs={logs} clearLogs={() => setLogs([])} />
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
