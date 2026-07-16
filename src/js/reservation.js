// ===== Reservation shared logic (gallery + calendar + total + form) =====

const API = "http://localhost:3000";

const WON = (n) => Math.round(n).toLocaleString("ko-KR");
const pad2 = (n) => String(n).padStart(2, "0");
const iso = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const MAX_STAY_NIGHTS = 5; // "6일 이상 예약 불가" -> at most 5 nights

// centered message card + dimmed backdrop, used for both the stay-limit
// warning and the booking-complete confirmation
function showOverlay(message) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "overlay-backdrop";
    backdrop.innerHTML = `
      <div class="overlay-card">
        <p>${message}</p>
        <button type="button">확인</button>
      </div>
    `;
    document.body.appendChild(backdrop);
    const close = () => {
      backdrop.remove();
      resolve();
    };
    // only the 확인 button closes this — no outside-click / auto dismiss
    backdrop.querySelector("button").addEventListener("click", close);
  });
}

// expands [startStr, endStr) into a list of "y-m-d" date strings (checkout night excluded)
function expandRange(startStr, endStr) {
  const dates = [];
  const cur = new Date(startStr);
  const end = new Date(endStr);
  while (cur < end) {
    dates.push(`${cur.getUTCFullYear()}-${pad2(cur.getUTCMonth() + 1)}-${pad2(cur.getUTCDate())}`);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

// season whose start_date~end_date (MM-DD, possibly wrapping the year) contains dateStr
function seasonForDate(dateStr, seasons) {
  const [, m, d] = dateStr.split("-").map(Number);
  const md = m * 100 + d;
  for (const s of seasons) {
    const [, sm, sd] = s.start_date.split("-").map(Number);
    const [, em, ed] = s.end_date.split("-").map(Number);
    const startMd = sm * 100 + sd;
    const endMd = em * 100 + ed;
    const inRange =
      startMd <= endMd ? md >= startMd && md <= endMd : md >= startMd || md <= endMd;
    if (inRange) return s;
  }
  return seasons[0];
}

function nightlyPrice(dateStr, roomId, prices, seasons, holidaySet) {
  const season = seasonForDate(dateStr, seasons);
  const p = prices.find((p) => p.room_id === roomId && p.season_id === season.id);
  if (!p) return 0;
  if (holidaySet.has(dateStr)) return p.holiday_price;
  const dow = new Date(dateStr).getUTCDay(); // 0=Sun ... 6=Sat
  if (dow === 5 || dow === 6) return p.weekend_price; // 금/토 = 주말
  return p.weekday_price;
}

/* -------------------------------------------------------------------------
   Calendar renderer
   opts: { year, month, selectable, checkin, checkout, booked: Set, holidays: Set }
   checkin/checkout are "y-m-d" strings (zero-padded, month 1-based)
------------------------------------------------------------------------- */
function renderCalendar(table, opts, onPick) {
  const { year, month, selectable, checkin: ci, checkout: co } = opts;
  const booked = opts.booked || new Set();
  const holidays = opts.holidays || new Set();
  const first = new Date(year, month - 1, 1);
  const startDow = first.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysPrev = new Date(year, month - 1, 0).getDate();
  const cmp = (a, b) => new Date(a) - new Date(b);

  let html =
    "<thead><tr>" +
    ["일", "월", "화", "수", "목", "금", "토"].map((d) => `<th>${d}</th>`).join("") +
    "</tr></thead><tbody>";

  let cells = [];
  for (let i = 0; i < startDow; i++) {
    cells.push({ d: daysPrev - startDow + 1 + i, muted: true });
  }
  for (let d = 1; d <= daysInMonth; d++) cells.push({ d, muted: false });
  let tail = 1;
  while (cells.length < 42) cells.push({ d: tail++, muted: true });

  for (let w = 0; w < cells.length; w += 7) {
    html += "<tr>";
    for (let i = 0; i < 7; i++) {
      const cell = cells[w + i];
      const isSun = i === 0;
      let cls = [];
      let tag = "";
      let dataAttr = "";

      if (cell.muted) {
        cls.push("muted");
      } else {
        const date = iso(year, month, cell.d);
        const isHoliday = holidays.has(date);
        if (isHoliday) cls.push("holiday");
        else if (isSun) cls.push("sun");

        if (booked.has(date)) {
          cls.push("booked");
          tag = `<span class="tag">예약완료</span>`;
        } else {
          if (selectable) {
            cls.push("selectable");
            dataAttr = `data-date="${date}"`;
          }
          if (ci && date === ci) {
            cls.push("edge");
            tag = `<span class="tag">입실</span>`;
          } else if (co && date === co) {
            cls.push("edge");
            tag = `<span class="tag">퇴실</span>`;
          } else if (ci && co && cmp(ci, date) < 0 && cmp(date, co) < 0) {
            cls.push("in-range");
          }
          if (isHoliday && !tag) tag = `<span class="tag">휴일</span>`;
        }
      }
      html += `<td class="${cls.join(" ")}" ${dataAttr}><span class="d">${cell.d}</span>${tag}</td>`;
    }
    html += "</tr>";
  }
  html += "</tbody>";
  table.innerHTML = html;

  if (selectable && onPick) {
    table.querySelectorAll("td.selectable").forEach((td) => {
      td.addEventListener("click", () => onPick(td.dataset.date));
    });
  }
}

/* -------------------------------------------------------------------------
   Booking detail page (RESERVATION3 / 3-2 / 3-3 / 3-4 / 4)
------------------------------------------------------------------------- */
async function initBooking() {
  const root = document.querySelector("[data-room-id]");
  if (!root || !document.getElementById("calGrid")) return;

  const roomId = Number(root.dataset.roomId);
  const grid = document.getElementById("calGrid");
  const title = document.getElementById("calTitle");
  const totalEl = document.getElementById("total");
  const extraEl = document.getElementById("extra");
  const bookBtn = document.getElementById("bookBtn");
  const heading = document.querySelector(".section-head h3");
  const mainImg = document.getElementById("bkMain");
  const thumbsWrap = document.getElementById("bkThumbs");
  const descKr = document.querySelector(".bk-desc .kr");
  const descEn = document.querySelector(".bk-desc .en");

  let rooms, prices, seasons, holidayRows, reservations;
  try {
    [rooms, prices, seasons, holidayRows, reservations] = await Promise.all([
      fetch(`${API}/rooms`).then((r) => r.json()),
      fetch(`${API}/price`).then((r) => r.json()),
      fetch(`${API}/season`).then((r) => r.json()),
      fetch(`${API}/holiday`).then((r) => r.json()),
      fetch(`${API}/reservation`).then((r) => r.json()),
    ]);
  } catch (err) {
    console.error(err);
    alert("예약 정보를 불러오지 못했습니다. json-server(npm start)가 실행 중인지 확인해 주세요.");
    return;
  }

  const room = rooms.find((r) => r.id === roomId);
  if (!room) return;

  const minGuests = room.min ?? 2;
  const maxGuests = room.capacity ?? minGuests;
  const maxExtra = Math.max(0, maxGuests - minGuests);
  extraEl.innerHTML =
    `<option value="0">없음</option>` +
    Array.from({ length: maxExtra }, (_, i) => i + 1)
      .map((n) => `<option value="${n}">${n}명</option>`)
      .join("");
  const peopleNote = document.querySelector(".bk-people .note");
  if (peopleNote) {
    peopleNote.textContent = `기준 인원 ${minGuests}명, 최대 인원 ${maxGuests}명, 추가 시 한 명당 객실 가격의 20%`;
  }

  if (heading) heading.textContent = room.name_eng.toUpperCase();
  if (descKr) descKr.textContent = room.desc;
  if (descEn) descEn.textContent = room.desc_eng;

  if (mainImg && thumbsWrap && room.images && room.images.length) {
    mainImg.src = `../images/${room.images[0]}`;
    mainImg.alt = room.name;
    thumbsWrap.innerHTML = room.images
      .map(
        (img, i) =>
          `<img src="../images/${img}" alt="${room.name} ${i + 1}" class="${i === 0 ? "active" : ""}" />`
      )
      .join("");
  }

  const holidaySet = new Set(holidayRows.map((h) => h.holiday_date));
  const bookedSet = new Set();
  reservations
    .filter((r) => r.room_id === roomId)
    .forEach((r) => {
      expandRange(r.check_in_date, r.check_out_date).forEach((d) => bookedSet.add(d));
    });

  const today = new Date();
  const state = {
    year: today.getFullYear(),
    month: today.getMonth() + 1,
    checkin: root.dataset.checkin || null,
    checkout: root.dataset.checkout || null,
  };

  function nightsList() {
    if (state.checkin && state.checkout) return expandRange(state.checkin, state.checkout);
    return [];
  }

  function baseTotal(nights) {
    return nights.reduce(
      (sum, d) => sum + nightlyPrice(d, roomId, prices, seasons, holidaySet),
      0
    );
  }

  function refreshTotal() {
    const extra = Number(extraEl.value);
    const nights = nightsList();
    const base = nights.length
      ? baseTotal(nights)
      : nightlyPrice(iso(state.year, state.month, today.getDate()), roomId, prices, seasons, holidaySet);
    totalEl.textContent = WON(base * (1 + 0.2 * extra));
    bookBtn.classList.toggle("active", !!(state.checkin && state.checkout));
  }

  function pick(date) {
    if (bookedSet.has(date)) return;
    if (state.checkin === date && !state.checkout) {
      state.checkin = null;
      draw();
      return;
    }
    if (!state.checkin || state.checkout) {
      state.checkin = date;
      state.checkout = null;
    } else if (new Date(date) > new Date(state.checkin)) {
      if (daysBetween(state.checkin, date) > MAX_STAY_NIGHTS) {
        showOverlay(`${MAX_STAY_NIGHTS + 1}일 이상 예약하실 수 없습니다.`);
        return;
      }
      state.checkout = date;
    } else {
      state.checkin = date;
    }
    draw();
  }

  const earliestYear = today.getFullYear();
  const earliestMonth = today.getMonth() + 1;
  const isEarliestMonth = () => state.year === earliestYear && state.month === earliestMonth;

  function draw() {
    title.textContent = `${state.year}년 ${pad2(state.month)}월`;
    renderCalendar(
      grid,
      {
        year: state.year,
        month: state.month,
        selectable: true,
        checkin: state.checkin,
        checkout: state.checkout,
        booked: bookedSet,
        holidays: holidaySet,
      },
      pick
    );
    refreshTotal();
    calPrevBtn.disabled = isEarliestMonth();
  }

  const calPrevBtn = document.getElementById("calPrev");
  const calNextBtn = document.getElementById("calNext");

  calPrevBtn.addEventListener("click", () => {
    if (isEarliestMonth()) return;
    state.month--;
    if (state.month < 1) {
      state.month = 12;
      state.year--;
    }
    draw();
  });
  calNextBtn.addEventListener("click", () => {
    state.month++;
    if (state.month > 12) {
      state.month = 1;
      state.year++;
    }
    draw();
  });
  extraEl.addEventListener("change", refreshTotal);

  // gallery thumbnail swap + drag/click on main photo (loops from last back to first)
  function bindThumbs() {
    const main = document.getElementById("bkMain");
    const getThumbs = () => Array.from(document.querySelectorAll("#bkThumbs img"));

    function setActive(index) {
      const list = getThumbs();
      const target = list[index];
      if (!target) return;
      main.src = target.src;
      list.forEach((x) => x.classList.remove("active"));
      target.classList.add("active");
    }

    function currentIndex() {
      const list = getThumbs();
      const i = list.findIndex((x) => x.classList.contains("active"));
      return i === -1 ? 0 : i;
    }

    function go(step) {
      const list = getThumbs();
      if (!list.length) return;
      setActive((currentIndex() + step + list.length) % list.length);
    }

    getThumbs().forEach((th, i) => {
      th.addEventListener("click", () => setActive(i));
    });

    main.addEventListener("dragstart", (e) => e.preventDefault());

    const DRAG_THRESHOLD = 15;
    let dragging = false;
    let startX = 0;
    let startY = 0;

    function dragStart(x, y) {
      dragging = true;
      startX = x;
      startY = y;
    }
    function dragMove(x, y, evt) {
      if (!dragging) return;
      const dx = x - startX;
      const dy = y - startY;
      if (evt && Math.abs(dx) > Math.abs(dy)) evt.preventDefault();
    }
    function dragEnd(x) {
      if (!dragging) return;
      dragging = false;
      const dx = x - startX;
      // dragged far enough = swipe (left = next, right = previous); otherwise treat as a tap = next
      go(Math.abs(dx) >= DRAG_THRESHOLD ? (dx < 0 ? 1 : -1) : 1);
    }

    main.addEventListener("mousedown", (e) => dragStart(e.pageX, e.pageY));
    window.addEventListener("mousemove", (e) => dragMove(e.pageX, e.pageY));
    window.addEventListener("mouseup", (e) => dragEnd(e.pageX));

    main.addEventListener("touchstart", (e) => {
      const t = e.touches[0];
      dragStart(t.pageX, t.pageY);
    });
    main.addEventListener(
      "touchmove",
      (e) => {
        const t = e.touches[0];
        dragMove(t.pageX, t.pageY, e);
      },
      { passive: false }
    );
    main.addEventListener("touchend", (e) => {
      dragEnd(e.changedTouches[0].pageX);
    });
  }
  bindThumbs();

  bookBtn.addEventListener("click", () => {
    if (!state.checkin) {
      alert("숙박 날짜를 선택해 주세요.");
      return;
    }
    if (!state.checkout) state.checkout = state.checkin; // 1박 처리
    const nights = expandRange(state.checkin, state.checkout);
    if (nights.some((d) => bookedSet.has(d))) {
      alert("선택하신 기간 중 이미 예약된 날짜가 있습니다.");
      return;
    }
    const extra = Number(extraEl.value);
    const booking = {
      room_id: roomId,
      room: room.name_eng.toUpperCase(),
      number_of_guests: minGuests + extra,
      checkin: state.checkin,
      checkout: state.checkout,
      total: Math.round(baseTotal(nights) * (1 + 0.2 * extra)),
    };
    localStorage.setItem("booking", JSON.stringify(booking));
    location.href = "RESERVATION5.html";
  });

  draw();
}

/* -------------------------------------------------------------------------
   Reservation form page (RESERVATION5)
------------------------------------------------------------------------- */
function initForm() {
  const form = document.getElementById("rsvForm");
  if (!form) return;

  const data = JSON.parse(localStorage.getItem("booking") || "null") || {
    room: "STANDARD",
    room_id: 1,
    number_of_guests: 2,
    checkin: "2026-07-15",
    checkout: "2026-07-17",
    total: 150000,
  };

  document.getElementById("fRoom").value = data.room;
  document.getElementById("fExtra").value = (data.number_of_guests ?? 2) + "명";
  document.getElementById("fTotal").textContent = WON(data.total);
  document.getElementById("fCheckin").value = data.checkin;
  document.getElementById("fCheckout").value = data.checkout;

  // read-only calendar (month navigable), starts on the check-in month
  const grid = document.getElementById("calGrid");
  const title = document.getElementById("calTitle");
  const parts = (data.checkin || "2026-07-15").split("-").map(Number);
  const view = { year: parts[0], month: parts[1] };

  function drawCal() {
    if (title) title.textContent = `${view.year}년 ${pad2(view.month)}월`;
    renderCalendar(grid, {
      year: view.year,
      month: view.month,
      selectable: false,
      checkin: data.checkin,
      checkout: data.checkout,
    });
  }
  const prev = document.getElementById("calPrev");
  const next = document.getElementById("calNext");
  if (prev)
    prev.addEventListener("click", () => {
      view.month--;
      if (view.month < 1) {
        view.month = 12;
        view.year--;
      }
      drawCal();
    });
  if (next)
    next.addEventListener("click", () => {
      view.month++;
      if (view.month > 12) {
        view.month = 1;
        view.year++;
      }
      drawCal();
    });
  drawCal();

  const name = document.getElementById("fName");
  const tel = document.getElementById("fTel");
  const nameErr = document.getElementById("nameErr");
  const telErr = document.getElementById("telErr");

  function validate() {
    let ok = true;
    if (!name.value.trim()) {
      nameErr.textContent = "필수 입력 값입니다.";
      ok = false;
    } else {
      nameErr.textContent = "";
    }
    const digits = tel.value.replace(/[^0-9]/g, "");
    if (!digits) {
      telErr.textContent = "필수 입력 값입니다.";
      ok = false;
    } else if (digits.length < 9) {
      telErr.textContent = "올바른 전화번호를 입력해 주세요.";
      ok = false;
    } else {
      telErr.textContent = "";
    }
    return ok;
  }

  const submitBtn = document.getElementById("submitBtn");
  submitBtn.addEventListener("click", async () => {
    if (!validate()) return;

    const payload = {
      room_id: data.room_id,
      customer_name: name.value.trim(),
      phone_number: tel.value.replace(/[^0-9]/g, ""),
      check_in_date: data.checkin,
      check_out_date: data.checkout,
      number_of_guests: data.number_of_guests ?? 2,
      total_price: data.total,
    };

    submitBtn.disabled = true;
    try {
      const res = await fetch(`${API}/reservation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      await showOverlay(`${data.room} 룸 예약이 완료되었습니다.`);
      localStorage.removeItem("booking");
      location.href = "HOME.html";
    } catch (err) {
      console.error(err);
      alert("예약 저장에 실패했습니다. json-server(npm start)가 실행 중인지 확인해 주세요.");
      submitBtn.disabled = false;
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initBooking();
  initForm();
});
