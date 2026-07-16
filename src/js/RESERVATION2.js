const API = "http://localhost:3000";

// db.json room images are mostly missing from src/images/, so band backgrounds
// keep using the local room1~4.jpg that already exist in the project.
const ROOM_LINKS = {
  1: { href: "RESERVATION3.html", img: "../images/room1.jpg" },
  2: { href: "RESERVATION3-2.html", img: "../images/room2.jpg" },
  3: { href: "RESERVATION3-3.html", img: "../images/room3.jpg" },
  4: { href: "RESERVATION3-4.html", img: "../images/room4.jpg" },
};

async function renderRoomBands() {
  const container = document.getElementById("rsvRooms");
  if (!container) return;

  try {
    const rooms = await fetch(`${API}/rooms`).then((res) => res.json());

    container.innerHTML = [...rooms]
      .sort((a, b) => a.id - b.id)
      .map((room) => {
        const link = ROOM_LINKS[room.id];
        if (!link) return "";
        return `<a class="rsv-band" href="${link.href}" style="background-image: url('${link.img}')">
          <span class="band-name">${room.name_eng.toUpperCase()}</span>
          <span class="band-arrow"></span>
        </a>`;
      })
      .join("");
  } catch (err) {
    container.innerHTML = `<p>객실 정보를 불러오지 못했습니다. json-server(npm start)가 실행 중인지 확인해 주세요.</p>`;
    console.error(err);
  }
}

document.addEventListener("DOMContentLoaded", renderRoomBands);
