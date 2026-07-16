const API = "http://localhost:3000";

function fmtMD(isoDate) {
  const [, m, d] = isoDate.split("-");
  return `${m}.${d}`;
}

function won(n) {
  return n.toLocaleString("ko-KR");
}

// rate table is wider than the viewport on mobile; drag (like ROOMS/EVENT
// on HOME) instead of shrinking the table to fit
function makeDragScroll(selector) {
  const el = document.querySelector(selector);
  if (!el) return;

  let isDown = false;
  let startX = 0;
  let startScrollLeft = 0;

  el.addEventListener("mousedown", (e) => {
    isDown = true;
    el.classList.add("dragging");
    startX = e.pageX;
    startScrollLeft = el.scrollLeft;
  });

  window.addEventListener("mouseup", () => {
    isDown = false;
    el.classList.remove("dragging");
  });

  el.addEventListener("mousemove", (e) => {
    if (!isDown) return;
    e.preventDefault();
    const walk = e.pageX - startX;
    el.scrollLeft = startScrollLeft - walk;
  });
}

makeDragScroll(".rsv-table-wrap");

async function renderRsvTable() {
  const tbody = document.getElementById("rsvTableBody");
  if (!tbody) return;

  try {
    const [rooms, prices, seasons] = await Promise.all([
      fetch(`${API}/rooms`).then((res) => res.json()),
      fetch(`${API}/price`).then((res) => res.json()),
      fetch(`${API}/season`).then((res) => res.json()),
    ]);

    const seasonsSorted = [...seasons].sort((a, b) => a.id - b.id);

    document.querySelectorAll(".season-th").forEach((th, i) => {
      const season = seasonsSorted[i];
      if (season) {
        th.textContent = `${season.name} (${fmtMD(season.start_date)} - ${fmtMD(season.end_date)})`;
      }
    });

    tbody.innerHTML = [...rooms]
      .sort((a, b) => a.id - b.id)
      .map((room) => {
        const priceCells = seasonsSorted
          .map((season) => {
            const p = prices.find(
              (p) => p.room_id === room.id && p.season_id === season.id
            );
            if (!p) return `<td>-</td><td>-</td><td>-</td>`;
            return `<td>${won(p.weekday_price)}</td><td>${won(p.weekend_price)}</td><td>${won(p.holiday_price)}</td>`;
          })
          .join("");
        return `<tr><td>${room.name}</td><td>${room.area}㎡</td><td>${room.min}/${room.capacity}</td>${priceCells}</tr>`;
      })
      .join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="9">요금 정보를 불러오지 못했습니다. json-server(npm start)가 실행 중인지 확인해 주세요.</td></tr>`;
    console.error(err);
  }
}

document.addEventListener("DOMContentLoaded", renderRsvTable);
