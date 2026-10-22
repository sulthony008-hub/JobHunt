(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const state = {
    page: "ringkasan",
    summary: null,
    lamaran: [],
    profile: null,
    email: null,
    sources: [],
    cv: null,
    statuses: [],
    editingNo: null,
    editingSource: null,
  };

  const pageMeta = {
    ringkasan: ["Ringkasan", "Pipeline lamaran kerja kamu."],
    lamaran: ["Lamaran", "Semua lamaran yang tercatat di tracker."],
    cv: ["CV", "Simpan CV terbaru; versi lama otomatis diarsipkan."],
    profil: ["Profil & Akun", "Data pelamar, kriteria, dan koneksi email."],
    sumber: ["Sumber", "Daftar sumber lowongan yang dipakai agen."],
  };

  const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[char]));

  function toast(message, type = "ok") {
    const node = $("#toast");
    node.textContent = message;
    node.className = `toast ${type}`;
    node.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { node.hidden = true; }, 4200);
  }

  async function api(path, options = {}) {
    const opts = { cache: "no-store", ...options, headers: { ...(options.headers || {}) } };
    if (opts.body && !(opts.body instanceof FormData) && typeof opts.body !== "string") {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(opts.body);
    }
    const response = await fetch(path, opts);
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { ok: false, error: text.slice(0, 400) || `HTTP ${response.status}` };
    }
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || data.detail || `HTTP ${response.status}`);
    }
    return data;
  }

  function fmtDate(value) {
    if (!value) return "—";
    const raw = String(value).slice(0, 10);
    const parts = raw.split("-").map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return raw;
    return new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function fmtDateTime(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  }

  function statusClass(status) {
    return `status-${String(status || "").toLowerCase().replace(/\s+/g, "-")}`;
  }

  function statusBadge(status) {
    const label = status || "—";
    return `<span class="badge ${statusClass(label)}">${esc(label)}</span>`;
  }

  function todayISO() {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
  }

  function setPage(page, push = true) {
    if (!pageMeta[page]) page = "ringkasan";
    state.page = page;
    $$(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.page === page));
    $$(".page").forEach((item) => item.classList.toggle("active", item.id === `page-${page}`));
    const [title, sub] = pageMeta[page];
    $("#page-title").textContent = title;
    $("#page-sub").textContent = sub;
    if (push) history.replaceState(null, "", `#${page}`);
    if (page === "lamaran") renderLamaran();
    if (page === "cv") renderCV();
    if (page === "profil") renderProfil();
    if (page === "sumber") renderSources();
  }

  function renderServer(online) {
    const node = $("#server-status");
    node.classList.toggle("online", online);
    node.innerHTML = `<span class="dot"></span>${online ? "Server aktif" : "Server tidak merespons"}`;
  }

  function renderEmailPill() {
    const email = state.email || {};
    const pill = $("#email-pill");
    const label = $("span", pill);
    if (email.verified) {
      pill.classList.add("ok");
      pill.classList.remove("warn");
      label.textContent = "Email terverifikasi";
    } else if (email.ready) {
      pill.classList.add("warn");
      pill.classList.remove("ok");
      label.textContent = "Email perlu tes";
    } else {
      pill.classList.add("warn");
      pill.classList.remove("ok");
      label.textContent = "Email belum disetel";
    }
  }

  // ---------------------------------------------------------------- summary
  function renderSummary() {
    const summary = state.summary;
    if (!summary) return;
    const profile = summary.profile || {};
    const missing = profile.missing || [];
    $("#hero-name").textContent = profile.nama_lengkap ? `Halo, ${profile.nama_lengkap}` : "Halo!";
    $("#hero-sub").textContent = missing.length
      ? `Lengkapi ${missing.slice(0, 2).join(" dan ")} supaya agen bisa mulai mencari lowongan.`
      : "Otomasi sudah siap. Cari lowongan, siapkan lamaran, lalu pantau balasan dari sini.";

    $("#hero-email").textContent = summary.email?.email || "Belum disetel";
    $("#hero-cv").textContent = summary.cv?.exists
      ? `Ada · ${summary.cv.size_label}`
      : "Belum ada";
    $("#hero-sources").textContent = `${summary.sources.active} aktif / ${summary.sources.total}`;

    $("#stat-total").textContent = summary.total;
    $("#stat-terkirim").textContent = summary.counts["Terkirim"] || 0;
    const interview = (summary.counts["Interview"] || 0) + (summary.counts["Tes"] || 0) + (summary.counts["Offer"] || 0);
    $("#stat-interview").textContent = interview;
    $("#stat-followup").textContent = summary.followup_due.length;

    renderPipeline(summary);
    renderAttention(summary);
    renderRecent(summary.recent || []);
    renderSourceChips();
    renderEmailPill();
  }

  function renderPipeline(summary) {
    const max = Math.max(1, ...Object.values(summary.counts));
    $("#pipeline-total").textContent = `${summary.total} total`;
    $("#pipeline").innerHTML = summary.statuses
      .map((status) => {
        const count = summary.counts[status] || 0;
        const width = count ? Math.max(6, Math.round((count / max) * 100)) : 0;
        return `<div class="pipe-row">
          <span title="${esc(status)}">${esc(status)}</span>
          <div class="pipe-bar"><i style="width:${width}%"></i></div>
          <strong>${count}</strong>
        </div>`;
      })
      .join("");
  }

  function attentionItem(icon, title, desc, page) {
    return `<button class="attn" data-goto="${page}">
      <svg class="icon"><use href="#${icon}"/></svg>
      <span><strong>${esc(title)}</strong><small>${esc(desc)}</small></span>
    </button>`;
  }

  function renderAttention(summary) {
    const items = [];
    if ((summary.profile.missing || []).length) {
      items.push(attentionItem("i-alert", "Profil belum lengkap", summary.profile.missing.join(", "), "profil"));
    }
    if (!summary.cv?.exists) {
      items.push(attentionItem("i-file", "CV belum diunggah", "Upload PDF supaya lamaran bisa dilampiri.", "cv"));
    }
    if (!summary.email?.ready) {
      items.push(attentionItem("i-mail", "Email agen belum terhubung", "Setel Gmail + App Password, lalu tes koneksi.", "profil"));
    } else if (!summary.email?.verified) {
      items.push(attentionItem("i-mail", "Email belum diverifikasi", "Config sudah ada. Klik Tes koneksi di Profil & Akun.", "profil"));
    }
    summary.followup_due.slice(0, 4).forEach((item) => {
      items.push(attentionItem(
        "i-alert",
        `Follow-up: ${item.perusahaan}`,
        `${item.days} hari sejak kirim · ${item.posisi}`,
        "lamaran",
      ));
    });
    summary.upcoming.slice(0, 4).forEach((item) => {
      items.push(attentionItem(
        "i-check",
        `${item.status}: ${item.perusahaan}`,
        `${item.tahap || "Cek tracker"} · ${item.posisi}`,
        "lamaran",
      ));
    });
    if (!items.length) {
      items.push(`<div class="attn ok"><svg class="icon"><use href="#i-check"/></svg>
        <span><strong>Tidak ada yang mendesak</strong><small>Semua aman. Waktunya cari lowongan baru.</small></span></div>`);
    }
    $("#attention").innerHTML = items.slice(0, 6).join("");
  }

  function renderRecent(items) {
    const body = $("#recent-body");
    $("#recent-empty").hidden = items.length > 0;
    body.innerHTML = items
      .map((item) => `<tr data-edit="${item.no}" style="cursor:pointer">
        <td class="num">#${item.no}</td>
        <td><strong>${esc(item.perusahaan)}</strong><span class="sub">${esc(item.sumber || "—")}</span></td>
        <td>${esc(item.posisi)}</td>
        <td>${statusBadge(item.status)}</td>
        <td class="muted">${fmtDate(item.update_terakhir)}</td>
      </tr>`)
      .join("");
  }

  function renderSourceChips() {
    const active = state.sources.filter((item) => item.aktif);
    $("#source-chips").innerHTML = active.length
      ? active.map((item) => `<span class="chip"><span class="dot"></span>${esc(item.nama)}</span>`).join("")
      : `<span class="muted small">Belum ada sumber aktif.</span>`;
  }

  // ----------------------------------------------------------------- lamaran
  function fillStatusSelects() {
    const options = state.statuses.map((status) => `<option value="${esc(status)}">${esc(status)}</option>`).join("");
    const filter = $("#filter-status");
    const current = filter.value;
    filter.innerHTML = `<option value="">Semua status</option>${options}`;
    filter.value = current;
    const modalSelect = $('#lamaran-form select[name="status"]');
    if (modalSelect) {
      const selected = modalSelect.value;
      modalSelect.innerHTML = options;
      if (selected) modalSelect.value = selected;
    }
  }

  function fillSourceControls() {
    const names = new Set();
    state.sources.forEach((item) => names.add(item.nama));
    state.lamaran.forEach((item) => { if (item.sumber) names.add(item.sumber); });
    const list = Array.from(names).sort((a, b) => a.localeCompare(b, "id"));
    const filter = $("#filter-sumber");
    const current = filter.value;
    filter.innerHTML = `<option value="">Semua sumber</option>${list
      .map((name) => `<option value="${esc(name)}">${esc(name)}</option>`)
      .join("")}`;
    filter.value = current;
    $("#sumber-options").innerHTML = list
      .map((name) => `<option value="${esc(name)}"></option>`)
      .join("");
  }

  function filteredLamaran() {
    const query = state.filters.q.toLowerCase();
    return state.lamaran.filter((item) => {
      if (state.filters.status && item.status !== state.filters.status) return false;
      if (state.filters.sumber && String(item.sumber || "").toLowerCase() !== state.filters.sumber.toLowerCase()) return false;
      if (!query) return true;
      return ["perusahaan", "posisi", "lokasi", "catatan", "email", "sumber"]
        .map((field) => String(item[field] || "").toLowerCase())
        .join(" ")
        .includes(query);
    });
  }

  function renderLamaran() {
    fillStatusSelects();
    fillSourceControls();
    const items = filteredLamaran();
    $("#lamaran-empty").hidden = items.length > 0;
    $("#lamaran-body").innerHTML = items
      .map((item) => `<tr>
        <td class="num">#${item.no}</td>
        <td><strong>${esc(item.perusahaan)}</strong><span class="sub">${esc(item.status)} · ${fmtDate(item.tanggal_kirim)}</span></td>
        <td>${esc(item.posisi)}</td>
        <td>${esc(item.lokasi || "—")}</td>
        <td>${esc(item.sumber || "—")}</td>
        <td>${statusBadge(item.status)}</td>
        <td>${item.email ? `<a href="mailto:${esc(item.email)}">${esc(item.email)}</a>` : "—"}</td>
        <td>${fmtDate(item.deadline)}</td>
        <td class="actions"><button class="btn tiny ghost" data-edit="${item.no}">Edit</button></td>
      </tr>`)
      .join("");
  }

  state.filters = { q: "", status: "", sumber: "" };

  function openLamaran(item = null) {
    const dialog = $("#modal-lamaran");
    const form = $("#lamaran-form");
    form.reset();
    state.editingNo = item ? item.no : null;
    $("#lamaran-modal-title").textContent = item ? `Edit lamaran #${item.no}` : "Tambah lamaran";
    fillStatusSelects();
    if (item) {
      Object.entries(item).forEach(([key, value]) => {
        const field = form.querySelector(`[name="${key}"]`);
        if (field && value !== null && value !== undefined) field.value = String(value).slice(0, 10) === String(value) && /^\d{4}-\d{2}-\d{2}/.test(String(value)) ? String(value).slice(0, 10) : value;
      });
    } else {
      form.elements.status.value = "Ditemukan";
      form.elements.tanggal_ditemukan.value = todayISO();
    }
    dialog.showModal();
    setTimeout(() => form.elements.perusahaan.focus(), 30);
  }

  async function submitLamaran(event) {
    event.preventDefault();
    const form = $("#lamaran-form");
    const data = Object.fromEntries(new FormData(form).entries());
    if (!data.perusahaan?.trim() || !data.posisi?.trim()) {
      toast("Perusahaan dan posisi wajib diisi.", "error");
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      if (state.editingNo) {
        await api(`/api/lamaran/${state.editingNo}`, { method: "PATCH", body: data });
        toast(`Lamaran #${state.editingNo} diperbarui.`);
      } else {
        const result = await api("/api/lamaran", { method: "POST", body: data });
        toast(result.message || "Lamaran ditambahkan.");
      }
      $("#modal-lamaran").close();
      await loadAll();
    } catch (error) {
      toast(error.message, "error");
    } finally {
      button.disabled = false;
    }
  }

  // ---------------------------------------------------------------------- cv
  function renderCV() {
    const cv = state.cv || { exists: false };
    const pill = $("#cv-pill");
    pill.textContent = cv.exists ? "Siap" : "Belum ada";
    pill.className = `pill ${cv.exists ? "ok" : "warn"}`;
    $("#cv-meta").innerHTML = `
      <div><span>Status</span><strong>${cv.exists ? "CV aktif tersimpan" : "Belum diunggah"}</strong></div>
      <div><span>Ukuran</span><strong>${cv.exists ? esc(cv.size_label) : "—"}</strong></div>
      <div><span>Terakhir diubah</span><strong>${cv.exists ? fmtDateTime(cv.modified) : "—"}</strong></div>
      <div><span>Nama file</span><strong>${cv.exists ? esc(cv.download_name) : "CV.pdf"}</strong></div>`;
    const frame = $("#cv-frame");
    const empty = $("#cv-empty");
    if (cv.exists) {
      frame.src = cv.url;
      frame.hidden = false;
      empty.hidden = true;
      $("#cv-download").hidden = false;
      $("#cv-open").hidden = false;
    } else {
      frame.src = "about:blank";
      frame.hidden = true;
      empty.hidden = false;
      $("#cv-download").hidden = true;
      $("#cv-open").hidden = true;
    }
  }

  async function uploadCV(file) {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast("File harus PDF.", "error");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast("Ukuran CV maksimal 10 MB.", "error");
      return;
    }
    const body = new FormData();
    body.append("cv", file);
    const button = $("#cv-upload-btn");
    button.disabled = true;
    try {
      const result = await api("/api/cv", { method: "POST", body });
      state.cv = result.cv;
      renderCV();
      await loadSummary();
      toast("CV diperbarui. Versi lama diarsipkan.");
    } catch (error) {
      toast(error.message, "error");
    } finally {
      button.disabled = false;
      $("#cv-input").value = "";
    }
  }

  // ------------------------------------------------------------------ profil
  function setField(form, name, value) {
    const field = form.querySelector(`[name="${name}"]`);
    if (!field) return;
    if (field.type === "checkbox") field.checked = Boolean(value);
    else field.value = value ?? "";
  }

  function renderProfil() {
    const profile = state.profile || {};
    const form = $("#profil-form");
    ["nama_lengkap", "email_agen", "no_hp", "kota_domisili", "linkedin", "portfolio"].forEach((key) => {
      setField(form, key, profile[key]);
    });
    const kriteria = profile.kriteria || {};
    ["posisi", "lokasi", "mode", "level", "industri", "kata_kunci_wajib", "kata_kunci_hindari"].forEach((key) => {
      setField(form, `kriteria.${key}`, (kriteria[key] || []).join(", "));
    });
    setField(form, "kriteria.gaji_min", kriteria.gaji_min ?? "");
    const pengiriman = profile.pengiriman || {};
    setField(form, "pengiriman.mode", pengiriman.mode || "draft_approval");
    setField(form, "pengiriman.batas_per_hari", pengiriman.batas_per_hari ?? 10);
    setField(form, "pengiriman.follow_up_hari", pengiriman.follow_up_hari ?? 7);
    setField(form, "pengiriman.follow_up_maksimal", pengiriman.follow_up_maksimal ?? 2);
    setField(form, "notifikasi.telegram", (profile.notifikasi || {}).telegram);
    renderEmailCard();
  }

  function renderEmailCard() {
    const email = state.email || {};
    const badge = $("#email-badge");
    badge.textContent = email.verified ? "Terhubung" : email.ready ? "Belum diverifikasi" : "Belum siap";
    badge.className = `pill ${email.verified ? "ok" : "warn"}`;
    $("#account-email").textContent = email.email || "Belum disetel";
    $("#account-status").textContent = email.verified
      ? "Terverifikasi · IMAP berhasil"
      : email.ready
        ? "Config lengkap · klik Tes koneksi"
        : "Perlu config + App Password";
    $("#account-config").textContent = email.config_exists ? "Config ditemukan" : "Config belum ada";
    $("#email-config-path").textContent = email.config_path || "—";
    const address = $("#email-setup-address");
    if (address && !address.value) address.value = email.email || "";
    renderEmailPill();
  }

  async function submitProfil(event) {
    event.preventDefault();
    const form = $("#profil-form");
    const fd = new FormData(form);
    const get = (name) => String(fd.get(name) ?? "").trim();
    const payload = {
      nama_lengkap: get("nama_lengkap"),
      email_agen: get("email_agen"),
      no_hp: get("no_hp"),
      kota_domisili: get("kota_domisili"),
      linkedin: get("linkedin"),
      portfolio: get("portfolio"),
      kriteria: {
        posisi: get("kriteria.posisi"),
        lokasi: get("kriteria.lokasi"),
        mode: get("kriteria.mode"),
        level: get("kriteria.level"),
        gaji_min: get("kriteria.gaji_min"),
        industri: get("kriteria.industri"),
        kata_kunci_wajib: get("kriteria.kata_kunci_wajib"),
        kata_kunci_hindari: get("kriteria.kata_kunci_hindari"),
      },
      pengiriman: {
        mode: get("pengiriman.mode"),
        batas_per_hari: get("pengiriman.batas_per_hari"),
        follow_up_hari: get("pengiriman.follow_up_hari"),
        follow_up_maksimal: get("pengiriman.follow_up_maksimal"),
      },
      notifikasi: { telegram: fd.get("notifikasi.telegram") === "on" },
    };
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const result = await api("/api/profil", { method: "PUT", body: payload });
      state.profile = result.profil;
      await loadAll();
      toast(result.message || "Profil disimpan.");
    } catch (error) {
      toast(error.message, "error");
    } finally {
      button.disabled = false;
    }
  }

  async function testEmail() {
    const button = $("#btn-email-test");
    button.disabled = true;
    try {
      const result = await api("/api/email/test", { method: "POST" });
      if (result.email) state.email = result.email;
      renderEmailCard();
      await loadSummary();
      toast(result.message || "Koneksi berhasil.");
    } catch (error) {
      toast(error.message, "error");
      await loadSummary();
    } finally {
      button.disabled = false;
    }
  }

  async function submitEmail(event) {
    event.preventDefault();
    const email = $("#email-setup-address").value.trim();
    const password = $("#email-setup-password").value.replace(/\s+/g, "");
    if (!email) return toast("Email agen wajib diisi.", "error");
    if (password.length !== 16) return toast("App Password harus 16 karakter (spasi otomatis dihapus).", "error");
    const button = event.submitter;
    if (button) button.disabled = true;
    try {
      const result = await api("/api/email/setup", { method: "POST", body: { email, password } });
      $("#email-setup-password").value = "";
      state.email = result.email;
      renderEmailCard();
      await loadAll();
      toast(result.message || "Akun disimpan.");
    } catch (error) {
      toast(error.message, "error");
    } finally {
      if (button) button.disabled = false;
    }
  }

  // ------------------------------------------------------------------ sumber
  function renderSources() {
    const list = state.sources || [];
    $("#sources-empty").hidden = list.length > 0;
    $("#sumber-sub").textContent = `${list.length} sumber · ${list.filter((item) => item.aktif).length} aktif. Tambah, edit, atau nonaktifkan kapan saja.`;
    $("#sources-list").innerHTML = list
      .map((item) => `<article class="card source-card ${item.aktif ? "" : "off"}">
        <div class="top">
          <div>
            <h4>${esc(item.nama)}</h4>
            <span class="type">${esc(item.tipe || "Job board")}</span>
          </div>
          <label class="switch" title="Aktif/nonaktif">
            <input type="checkbox" data-source-toggle="${esc(item.id)}" ${item.aktif ? "checked" : ""}>
            <i></i>
          </label>
        </div>
        ${item.url ? `<a class="url" href="${esc(item.url)}" target="_blank" rel="noreferrer">${esc(item.url)}</a>` : `<span class="url muted">Tanpa URL</span>`}
        <p class="note">${esc(item.catatan || "—")}</p>
        <div class="foot">
          <span class="muted small">${item.aktif ? "Dipakai agen" : "Nonaktif"}</span>
          <span class="row gap">
            <button class="btn tiny ghost" data-source-edit="${esc(item.id)}">Edit</button>
            <button class="btn tiny danger" data-source-del="${esc(item.id)}">Hapus</button>
          </span>
        </div>
      </article>`)
      .join("");
    fillSourceControls();
  }

  function openSource(item = null) {
    const dialog = $("#modal-sumber");
    const form = $("#sumber-form");
    form.reset();
    state.editingSource = item ? item.id : null;
    $("#sumber-modal-title").textContent = item ? "Edit sumber" : "Tambah sumber";
    if (item) {
      ["nama", "url", "tipe", "catatan"].forEach((key) => setField(form, key, item[key]));
      setField(form, "aktif", item.aktif);
    } else {
      setField(form, "aktif", true);
    }
    dialog.showModal();
    setTimeout(() => form.elements.nama.focus(), 30);
  }

  async function submitSource(event) {
    event.preventDefault();
    const form = $("#sumber-form");
    const fd = new FormData(form);
    const payload = {
      nama: String(fd.get("nama") || "").trim(),
      url: String(fd.get("url") || "").trim(),
      tipe: String(fd.get("tipe") || "Job board"),
      catatan: String(fd.get("catatan") || "").trim(),
      aktif: fd.get("aktif") === "on",
    };
    if (!payload.nama) return toast("Nama sumber wajib diisi.", "error");
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const path = state.editingSource ? `/api/sumber/${state.editingSource}` : "/api/sumber";
      const method = state.editingSource ? "PUT" : "POST";
      const result = await api(path, { method, body: payload });
      $("#modal-sumber").close();
      state.sources = result.sources;
      await loadAll();
      toast(result.message || "Sumber disimpan.");
    } catch (error) {
      toast(error.message, "error");
    } finally {
      button.disabled = false;
    }
  }

  async function toggleSource(id, aktif) {
    try {
      const result = await api(`/api/sumber/${id}`, { method: "PUT", body: { aktif } });
      state.sources = result.sources;
      renderSources();
      await loadSummary();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  async function deleteSource(id) {
    const source = state.sources.find((item) => item.id === id);
    if (!source || !confirm(`Hapus sumber "${source.nama}"?`)) return;
    try {
      const result = await api(`/api/sumber/${id}`, { method: "DELETE" });
      state.sources = result.sources;
      await loadAll();
      toast(result.message || "Sumber dihapus.");
    } catch (error) {
      toast(error.message, "error");
    }
  }

  // ------------------------------------------------------------------- data
  async function loadAll() {
    try {
      const [summary, lamaran, profil, sumber, cv] = await Promise.all([
        api("/api/summary"),
        api("/api/lamaran"),
        api("/api/profil"),
        api("/api/sumber"),
        api("/api/cv"),
      ]);
      state.summary = summary;
      state.lamaran = lamaran.items || [];
      state.statuses = summary.statuses || [];
      state.profile = profil.profil;
      state.email = profil.email;
      state.sources = sumber.sources || [];
      state.cv = cv.cv;
      renderServer(true);
      fillStatusSelects();
      fillSourceControls();
      renderSummary();
      renderLamaran();
      renderCV();
      renderProfil();
      renderSources();
    } catch (error) {
      renderServer(false);
      toast(error.message || "Gagal memuat data.", "error");
    }
  }

  async function loadSummary() {
    try {
      state.summary = await api("/api/summary");
      renderSummary();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  // ------------------------------------------------------------------- bind
  function bind() {
    $$(".nav-item").forEach((item) => item.addEventListener("click", () => setPage(item.dataset.page)));
    document.addEventListener("click", (event) => {
      const go = event.target.closest("[data-goto]");
      if (go) {
        event.preventDefault();
        setPage(go.dataset.goto);
        return;
      }
      const close = event.target.closest("[data-close]");
      if (close) {
        close.closest("dialog")?.close();
        return;
      }
      const edit = event.target.closest("[data-edit]");
      if (edit) {
        const item = state.lamaran.find((row) => String(row.no) === String(edit.dataset.edit));
        if (item) openLamaran(item);
        return;
      }
      const sourceEdit = event.target.closest("[data-source-edit]");
      if (sourceEdit) {
        const item = state.sources.find((row) => row.id === sourceEdit.dataset.sourceEdit);
        if (item) openSource(item);
        return;
      }
      const sourceDel = event.target.closest("[data-source-del]");
      if (sourceDel) {
        deleteSource(sourceDel.dataset.sourceDel);
      }
    });

    $("#btn-refresh").addEventListener("click", async () => {
      await loadAll();
      toast("Data dimuat ulang.");
    });
    $("#btn-add-lamaran").addEventListener("click", () => openLamaran());
    $("#hero-add").addEventListener("click", () => { setPage("lamaran"); openLamaran(); });
    $("#btn-add-source").addEventListener("click", () => openSource());

    $("#lamaran-form").addEventListener("submit", submitLamaran);
    $("#sumber-form").addEventListener("submit", submitSource);
    $("#profil-form").addEventListener("submit", submitProfil);
    $("#email-form").addEventListener("submit", submitEmail);
    $("#btn-email-test").addEventListener("click", testEmail);
    $("#btn-email-toggle").addEventListener("click", () => {
      const form = $("#email-form");
      form.hidden = !form.hidden;
      if (!form.hidden) $("#email-setup-address").focus();
    });

    $("#filter-q").addEventListener("input", (event) => {
      state.filters.q = event.target.value.trim();
      renderLamaran();
    });
    $("#filter-status").addEventListener("change", (event) => {
      state.filters.status = event.target.value;
      renderLamaran();
    });
    $("#filter-sumber").addEventListener("change", (event) => {
      state.filters.sumber = event.target.value;
      renderLamaran();
    });

    $("#sources-list").addEventListener("change", (event) => {
      const toggle = event.target.closest("[data-source-toggle]");
      if (toggle) toggleSource(toggle.dataset.sourceToggle, toggle.checked);
    });

    $("#cv-upload-btn").addEventListener("click", () => $("#cv-input").click());
    $("#cv-input").addEventListener("change", (event) => uploadCV(event.target.files[0]));
    const drop = $("#cv-drop");
    drop.addEventListener("click", () => $("#cv-input").click());
    drop.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        $("#cv-input").click();
      }
    });
    ["dragenter", "dragover"].forEach((name) => drop.addEventListener(name, (event) => {
      event.preventDefault();
      drop.classList.add("drag");
    }));
    ["dragleave", "drop"].forEach((name) => drop.addEventListener(name, (event) => {
      event.preventDefault();
      drop.classList.remove("drag");
    }));
    drop.addEventListener("drop", (event) => uploadCV(event.dataTransfer.files[0]));

    $$("dialog").forEach((dialog) => {
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) dialog.close();
      });
    });

    window.addEventListener("hashchange", () => {
      const page = location.hash.replace("#", "") || "ringkasan";
      if (page !== state.page) setPage(page, false);
    });
  }

  async function init() {
    bind();
    const page = location.hash.replace("#", "") || "ringkasan";
    setPage(pageMeta[page] ? page : "ringkasan", false);
    await loadAll();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
