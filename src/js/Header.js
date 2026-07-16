const menus = [
  {
    title: "ABOUT",
    items: [
      { text: "호텔소개", href: "" },
      { text: "오시는길", href: "" },
    ],
  },
  {
    title: "ROOMS",
    items: [
      { text: "ROOM1", href: "" },
      { text: "ROOM2", href: "" },
      { text: "ROOM3", href: "" },
    ],
  },
  {
    title: "RESERVATION",
    items: [
      { text: "예약안내", href: "RESERVATION1.html" },
      { text: "실시간예약", href: "RESERVATION2.html" },
    ],
  },
  {
    title: "COMMUNITY",
    items: [
      { text: "공지사항", href: "" },
      { text: "이벤트", href: "" },
      { text: "FAQ", href: "" },
    ],
  },
];

class MyHeader extends HTMLElement {
  connectedCallback() {
    const header = document.createElement("header");

    const h1 = document.createElement("h1");

    const logo = document.createElement("a");
    logo.href = "HOME.html"; // 홈으로 이동
    logo.textContent = "H";
    logo.className = "logo";

    h1.appendChild(logo);

    const nav = document.createElement("nav");

    // mobile: hover dropdowns don't work on touch, so this shared panel
    // shows a menu's items as a plain row under the nav bar instead. It
    // starts pre-filled with the current page's own section (no tap
    // needed), and tapping ANY top-level item (ABOUT/ROOMS/RESERVATION/
    // COMMUNITY) swaps it to that menu — so every section stays reachable
    // no matter which page you're on. Lives inside `header` (not as a
    // sibling) so it scrolls together with the sticky header.
    const subnav = document.createElement("nav");
    subnav.className = "mobile-subnav";

    function fillSubnav(menuData, activeHref) {
      subnav.innerHTML = "";
      menuData.items.forEach((item) => {
        const a = document.createElement("a");
        a.href = item.href || "#";
        a.textContent = item.text;
        if (item.href && item.href === activeHref) a.classList.add("active");
        subnav.appendChild(a);
      });
      subnav.classList.add("open");
      // header grows to fit the extra row (90px -> 120px on mobile, see CSS)
      header.classList.add("subnav-open");
    }

    menus.forEach((menuData) => {
      const menu = document.createElement("div");
      menu.className = "menu";

      const title = document.createElement("a");
      title.href = "#";
      title.textContent = menuData.title;

      const submenu = document.createElement("div");
      submenu.className = "submenu";

      menuData.items.forEach((item) => {
        const a = document.createElement("a");
        a.href = item.href;
        a.textContent = item.text;
        submenu.appendChild(a);
      });

      title.addEventListener("click", (e) => {
        e.preventDefault();
        fillSubnav(menuData, null);
      });

      menu.append(title, submenu);
      nav.appendChild(menu);
    });

    const page = location.pathname.split("/").pop() || "";
    const activeMenu = menus.find((m) => page.toUpperCase().startsWith(m.title));
    if (activeMenu) {
      const activeHref =
        activeMenu.title === "RESERVATION"
          ? page.toUpperCase().startsWith("RESERVATION1")
            ? "RESERVATION1.html"
            : "RESERVATION2.html"
          : null;
      fillSubnav(activeMenu, activeHref);
    }

    header.append(h1, nav, subnav);
    this.appendChild(header);

    // To-Top Button: 헤더를 쓰는 모든 페이지에 자동 포함.
    // position: fixed 이라 <my-header> 자식이어도 화면 우하단에 고정 노출.
    const topBtn = document.createElement("button");
    topBtn.id = "topBtn";
    topBtn.setAttribute("aria-label", "맨 위로");

    const topImg = document.createElement("img");
    topImg.src = "images/TO TOP BUTTON.png";
    topImg.alt = "맨 위로";
    topBtn.appendChild(topImg);

    topBtn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    this.appendChild(topBtn);
  }
}

customElements.define("my-header", MyHeader);
