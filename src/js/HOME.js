function makeSwiperScroll(selector, cardSelector) {
  const el = document.querySelector(selector);
  if (!el) return;

  const swiper = new Swiper(selector, {
    slidesPerView: "auto",
    freeMode: { enabled: true, sticky: true },
    grabCursor: true,
    mousewheel: { forceToAxis: true },
    breakpoints: {
      0: { spaceBetween: 14 },
      1001: { spaceBetween: 40 },
    },
  });

  // Swiper's own end boundary still lets the last card rest half-cut
  // (same fixed track width, doesn't divide evenly into full cards per
  // screen) — pad just enough trailing space so it always lands whole.
  function fixTrailingOffset() {
    const cards = el.querySelectorAll(cardSelector);
    if (!cards.length) return;
    const cardWidth = cards[0].getBoundingClientRect().width;
    const gap = swiper.params.spaceBetween || 0;
    const step = cardWidth + gap;
    const totalWidth = cards.length * cardWidth + (cards.length - 1) * gap;
    const naturalMax = totalWidth - el.clientWidth;
    let offset = 0;
    if (naturalMax > 0 && step > 0) {
      const remainder = naturalMax % step;
      offset = remainder < 0.5 ? 0 : step - remainder;
    }
    swiper.params.slidesOffsetAfter = offset;
    swiper.update();
    // spaceBetween changes across breakpoints, so a translate that was
    // card-aligned under the old gap can land mid-card under the new one.
    swiper.slideTo(0, 0);
  }

  swiper.on("breakpoint", fixTrailingOffset);
  swiper.on("resize", fixTrailingOffset);
  fixTrailingOffset();
}

makeSwiperScroll(".room-grid", ".room-card");
makeSwiperScroll(".event-grid", ".event-card");

function initRoomModal() {
  const modal = document.getElementById("imgModal");
  const modalImg = document.getElementById("modalImg");
  if (!modal || !modalImg) return;

  document.querySelectorAll(".room-card").forEach((card) => {
    const img = card.querySelector(".zoom-img");
    if (!img) return;
    card.addEventListener("click", () => {
      modalImg.src = img.src;
      modalImg.alt = img.alt;
      modal.classList.add("open");
    });
  });

  modal.addEventListener("click", () => {
    modal.classList.remove("open");
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") modal.classList.remove("open");
  });
}

initRoomModal();
