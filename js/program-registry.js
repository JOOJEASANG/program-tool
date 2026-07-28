(() => {
  'use strict';

  const DEFAULT_ICONS = ['📝', '🔍', '📚', '🧩', '🖨️', '📐', '✂️', '🗂️'];

  function safeUrl(value) {
    try {
      const url = new URL(String(value || ''), location.href);
      if (url.origin !== location.origin) return null;
      return `${url.pathname}${url.search}${url.hash}`;
    } catch (_) {
      return null;
    }
  }

  function safeColor(value) {
    return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : '#eef4f8';
  }

  function textElement(tag, className, value) {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = String(value || '');
    return element;
  }

  function programCard(program, index) {
    const url = safeUrl(program.url);
    if (!url) return null;
    const card = document.createElement('a');
    card.href = url;
    card.className = 'card';

    const icon = textElement(
      'div',
      'icon',
      program.icon || DEFAULT_ICONS[index % DEFAULT_ICONS.length]
    );
    icon.style.background = safeColor(program.bg);
    card.append(
      icon,
      textElement('div', 'name', program.name || program.key || '프로그램'),
      textElement(
        'div',
        'desc',
        program.description || '인쇄 문서 작업 프로그램입니다.'
      )
    );

    const tags = document.createElement('div');
    tags.className = 'tags';
    tags.appendChild(
      textElement('span', 'tag', program.category || '프로그램')
    );
    card.append(tags, textElement('div', 'cta', '시작하기 →'));
    return card;
  }

  async function renderRegistry() {
    if (!window.db || !window.auth) return;
    const user = auth.currentUser;
    if (!user) return;
    const access = await ProgramAccess.getAccess(user).catch(() => null);
    if (!access?.approved) return;

    const snapshot = await db
      .collection('settings')
      .doc('programs')
      .get()
      .catch(() => null);
    const items = snapshot?.exists && Array.isArray(snapshot.data().items)
      ? snapshot.data().items.filter(program => program?.active !== false)
      : [];
    if (!items.length) return;

    const slider = document.getElementById('slider');
    if (!slider) return;
    slider.replaceChildren();
    items.forEach((program, index) => {
      const card = programCard(program, index);
      if (card) slider.appendChild(card);
    });

    const count = document.getElementById('count');
    if (count) {
      count.textContent =
        `사용 가능 ${slider.children.length}개`
        + (access.admin ? ' · 관리자 모드' : '');
    }
  }

  window.addEventListener('load', () => setTimeout(renderRegistry, 300));
})();
