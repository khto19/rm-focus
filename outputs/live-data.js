(() => {
  const status = document.getElementById("fixture-feed-status");
  const refreshButton = document.getElementById("refresh-fixtures");
  const fixturesHost = document.getElementById("fixtures-list");
  const resultHost = document.getElementById("last-result-card");
  const nextTeams = document.getElementById("next-match-teams");
  const nextMeta = document.getElementById("next-match-meta");
  const nextNote = document.getElementById("next-match-note");
  if (!status || !fixturesHost || !resultHost) return;

  const logo = "https://www.realmadrid.com/StaticFiles/RealMadridResponsive/images/header_logo.svg";
  const apiUrl = new URL("api/fixtures.json", document.baseURI);
  const officialFixtures = "https://www.realmadrid.com/en-US/football/first-team/fixtures";
  let baseMatches = [];
  let lastLive = [];
  let generatedAt = "";
  let timer = 0;

  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const madridDate = value => new Intl.DateTimeFormat("vi-VN", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
  const madridTime = value => new Intl.DateTimeFormat("vi-VN", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
  const vnTime = value => new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
  const localDate = (day, time) => {
    const [year, month, date] = day.split("-").map(Number);
    const [hour, minute] = (time || "12:00").split(":").map(Number);
    return new Date(Date.UTC(year, month - 1, date, hour, minute));
  };
  const readableDay = day => {
    const [year, month, date] = day.split("-");
    return `${date}/${month}<small>${year}</small>`;
  };
  const isMadrid = name => /real madrid/i.test(name || "");
  const matchKey = match => `${match.date}|${isMadrid(match.home) ? "home" : "away"}`;
  const sortMatches = list => list.sort((a, b) => `${a.date} ${a.time || "23:59"}`.localeCompare(`${b.date} ${b.time || "23:59"}`));
  const setStatus = (message, state) => {
    status.dataset.state = state;
    const dot = document.createElement("i");
    dot.className = "feed-dot";
    status.replaceChildren(dot, document.createTextNode(` ${message}`));
  };

  function combinedMatches() {
    const byKey = new Map(baseMatches.map(match => [matchKey(match), { ...match }]));
    lastLive.forEach(match => byKey.set(matchKey(match), { ...byKey.get(matchKey(match)), ...match }));
    return sortMatches([...byKey.values()]);
  }

  function render() {
    const all = combinedMatches();
    if (!all.length) return; // Keep the HTML snapshot visible when opened offline or via file://.
    const now = Date.now();
    const live = all.filter(match => match.status === "live");
    const upcoming = all.filter(match => match.status !== "finished" && (match.dateTime ? new Date(match.dateTime).getTime() : localDate(match.date, match.time).getTime()) >= now - 3 * 60 * 60 * 1000);
    const next = upcoming[0];
    const recent = all.filter(match => match.status === "finished" && match.score).slice().reverse()[0];

    fixturesHost.innerHTML = (upcoming.slice(0, 4).length ? upcoming.slice(0, 4).map(match => {
      const liveNow = match.status === "live";
      const score = match.score ? `${match.score.home} — ${match.score.away}` : "";
      const madrid = match.dateTime ? madridTime(match.dateTime) : match.time || "Giờ chưa xác nhận";
      const vietnam = match.dateTime ? vnTime(match.dateTime) : "";
      return `<article class="fixture${liveNow ? " is-live" : ""}"><div class="fixture-date">${readableDay(esc(match.date))}</div><div class="fixture-main"><b>${esc(match.home)} · ${esc(match.away)}${score ? ` <em>${esc(score)}</em>` : ""}</b><span>${esc(match.competition || "LaLiga")}${match.round ? ` · ${esc(match.round)}` : ""}</span></div><div class="fixture-time">${liveNow ? esc(match.clock || "LIVE") : esc(madrid)}<br><span>${liveNow ? "ĐANG DIỄN RA" : vietnam ? `${esc(vietnam)} · VN` : "Giờ Madrid"}</span></div></article>`;
    }).join("") : `<article class="fixture"><div class="fixture-date">—</div><div class="fixture-main"><b>Chưa có lịch mới</b><span>Xem lịch chính thức của câu lạc bộ</span></div><div class="fixture-time">—</div></article>`);

    if (recent) {
      const date = recent.date.split("-").reverse().join(".");
      resultHost.innerHTML = `<span class="label">${esc(recent.competition || "Trận gần nhất")} · ${esc(date)}</span><div class="result-line"><strong>${esc(recent.home)}</strong><span>${esc(recent.score?.home ?? "—")} — ${esc(recent.score?.away ?? "—")}</span><strong>${esc(recent.away)}</strong></div><div class="result-foot">${esc(recent.round || "Kết quả được đối chiếu từ nguồn dữ liệu trận đấu.")}</div><a class="result-link" href="${officialFixtures}" target="_blank" rel="noreferrer">Lịch và kết quả chính thức ↗</a>`;
    }

    if (next && nextTeams && nextMeta) {
      const opponent = isMadrid(next.home) ? next.away : next.home;
      const madridIsHome = isMadrid(next.home);
      const opponentMark = opponent.split(/\s+/).filter(Boolean).slice(0, 3).map(word => word[0]).join("").toUpperCase();
      const dateTime = next.dateTime ? madridDate(next.dateTime) : next.date.split("-").reverse().join("/");
      const kickoff = next.dateTime ? madridTime(next.dateTime) : next.time || "Chưa xác nhận";
      nextTeams.innerHTML = `<div>${madridIsHome ? `<div class="team-mark"><img src="${logo}" alt="Logo Real Madrid"></div>` : `<div class="team-mark">${esc(opponentMark)}</div>`}<div class="team-label">${esc(madridIsHome ? "Real Madrid" : opponent)}</div></div><div class="vs">vs</div><div>${madridIsHome ? `<div class="team-mark">${esc(opponentMark)}</div>` : `<div class="team-mark"><img src="${logo}" alt="Logo Real Madrid"></div>`}<div class="team-label">${esc(madridIsHome ? opponent : "Real Madrid")}</div></div>`;
      nextMeta.innerHTML = `<span><b>${esc(dateTime)}</b> · ${esc(next.competition || "LaLiga")}</span><span>${esc(kickoff)} Madrid</span>`;
      nextNote.textContent = next.dateTime ? `Giờ Việt Nam: ${vnTime(next.dateTime)} · Dữ liệu trận đấu tự làm mới` : "Giờ Madrid · giờ bóng lăn sẽ hiện khi ban tổ chức xác nhận";
    }

    if (live.length) {
      setStatus(`ĐANG LIVE · ESPN · tự làm mới 90 giây${generatedAt ? ` · lịch nền ${new Date(generatedAt).toLocaleDateString("vi-VN")}` : ""}`, "live");
    } else if (lastLive.length) {
      setStatus(`Tỷ số ESPN đã kiểm tra · lịch Openfootball cập nhật hằng ngày${generatedAt ? ` · ${new Date(generatedAt).toLocaleDateString("vi-VN")}` : ""}`, "ok");
    } else {
      setStatus(baseMatches.length ? `Lịch Openfootball · cập nhật hằng ngày${generatedAt ? ` · đồng bộ ${new Date(generatedAt).toLocaleDateString("vi-VN")}` : ""}` : "Đang dùng lịch dự phòng · kết nối lại để làm mới", baseMatches.length ? "ok" : "offline");
    }
    if (live.length && nextTeams) {
      const current = live[0];
      const opponent = isMadrid(current.home) ? current.away : current.home;
      const madridIsHome = isMadrid(current.home);
      const opponentMark = opponent.split(/\s+/).filter(Boolean).slice(0, 3).map(word => word[0]).join("").toUpperCase();
      nextTeams.innerHTML = `<div><div class="team-mark">${madridIsHome ? `<img src="${logo}" alt="Logo Real Madrid">` : esc(opponentMark)}</div><div class="team-label">${esc(madridIsHome ? "Real Madrid" : opponent)}</div></div><div class="vs">${esc(current.score?.home ?? "0")} — ${esc(current.score?.away ?? "0")}</div><div><div class="team-mark">${madridIsHome ? esc(opponentMark) : `<img src="${logo}" alt="Logo Real Madrid">`}</div><div class="team-label">${esc(madridIsHome ? opponent : "Real Madrid")}</div></div>`;
      nextMeta.innerHTML = `<span><b>${esc(current.competition || "LaLiga")}</b></span><span>${esc(current.clock || "ĐANG ĐÁ")}</span>`;
      nextNote.textContent = "Tỷ số trực tiếp từ feed công khai ESPN · có thể trễ hoặc gián đoạn";
    }
  }

  async function loadSchedule() {
    try {
      const url = new URL(apiUrl);
      url.searchParams.set("v", String(Date.now()));
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.matches)) throw new Error("Feed không hợp lệ");
      baseMatches = data.matches.filter(match => isMadrid(match.home) || isMadrid(match.away));
      generatedAt = data.updatedAt || "";
    } catch (_) {
      setStatus("Không kết nối được API lịch · đang hiển thị dữ liệu dự phòng", "offline");
    }
    render();
  }

  function dateKey(date) { return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`; }
  async function loadLive() {
    const from = new Date(Date.now() - 7 * 86400000);
    const to = new Date(Date.now() + 21 * 86400000);
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard?dates=${dateKey(from)}-${dateKey(to)}&limit=100`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
      if (!response.ok) throw new Error(`ESPN ${response.status}`);
      const data = await response.json();
      lastLive = (data.events || []).flatMap(event => {
        const competition = event.competitions?.[0];
        const competitors = competition?.competitors || [];
        if (!competitors.some(item => isMadrid(item.team?.displayName || item.team?.name))) return [];
        const home = competitors.find(item => item.homeAway === "home") || competitors[0];
        const away = competitors.find(item => item.homeAway === "away") || competitors[1];
        if (!home || !away) return [];
        const instant = event.date;
        const state = event.status?.type?.state;
        const completed = Boolean(event.status?.type?.completed) || state === "post";
        const isLive = state === "in";
        const score = (completed || isLive) ? { home: Number(home.score || 0), away: Number(away.score || 0) } : null;
        const dateTime = new Date(instant);
        const parts = new Intl.DateTimeFormat("en", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(dateTime);
        const part = type => parts.find(entry => entry.type === type)?.value;
        const date = part("year") && part("month") && part("day") ? `${part("year")}-${part("month")}-${part("day")}` : instant.slice(0, 10);
        return [{ id: event.id, date, dateTime: instant, time: madridTime(instant), home: home.team?.displayName || home.team?.name, away: away.team?.displayName || away.team?.name, score, status: isLive ? "live" : completed ? "finished" : "scheduled", clock: event.status?.displayClock || event.status?.type?.shortDetail || "LIVE", competition: event.season?.name || competition?.notes?.[0]?.headline || "LaLiga", round: event.name || "" }];
      });
    } catch (_) {
      lastLive = [];
    } finally {
      clearTimeout(timeout);
      render();
    }
  }

  async function refresh() {
    refreshButton?.setAttribute("disabled", "disabled");
    if (refreshButton) refreshButton.textContent = "Đang tải…";
    await loadSchedule();
    await loadLive();
    if (refreshButton) {
      refreshButton.removeAttribute("disabled");
      refreshButton.textContent = "Làm mới ↻";
    }
    clearTimeout(timer);
    const isLive = combinedMatches().some(match => match.status === "live");
    timer = setTimeout(refresh, isLive ? 90000 : 15 * 60 * 1000);
  }

  refreshButton?.addEventListener("click", refresh);
  refresh();

  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && "IntersectionObserver" in window) {
    const reveals = document.querySelectorAll(".section-head, .match-reading");
    reveals.forEach(element => element.classList.add("motion-pending"));
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("motion-in");
        observer.unobserve(entry.target);
      }
    }), { threshold: 0.08 });
    reveals.forEach(element => observer.observe(element));
  }
})();
