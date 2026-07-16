class MyFooter extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <footer>
        <h1>H</h1>

        <div class="sns">
          <a href="#"><img src="../images/instagram.png" alt="Instagram"></a>
          <a href="#"><img src="../images/facebook.png" alt="Facebook"></a>
          <a href="#"><img src="../images/youtube.png" alt="YouTube"></a>
        </div>

        <div class="info">
          <p>경기 성남시 분당구 황새울로329번길 5 한국폴리텍대학 융합기술교육원</p>
          <p>
            사업자등록번호 000-00-00000 |
            관리번호 012-345-6789 |
            팩스 01-234-5678
          </p>
          <p>이용약관 | 개인정보처리방침</p>
        </div>

        <p class="copy">
          Copyright © 2025 H Hotel All rights reserved.
        </p>
      </footer>
    `;
  }
}

customElements.define("my-footer", MyFooter);
