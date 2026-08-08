// Rich emoji icon picker for administrator-managed home program cards.
(function () {
  'use strict';
  if (window.__adminProgramIconPaletteV1) return;
  window.__adminProgramIconPaletteV1 = true;

  const path = location.pathname.replace(/\/+$/, '') || '/';
  if (path !== '/admin' && path !== '/admin.html' && !path.endsWith('/admin.html')) return;

  const STYLE_ID = 'adminProgramIconPaletteStyles';
  const PALETTE_CLASS = 'pcat-icon-palette';
  const GROUPS = [
    { id: 'document', label: '문서·PDF', icons: [
      ['📄','문서'],['📃','문서 페이지'],['📑','탭 문서'],['🗒️','메모장'],['📝','작성'],['📋','클립보드'],['🧾','영수증'],['📜','문서 양식'],['📇','카드 목록'],['🗞️','신문'],['📚','책 묶음'],['📖','열린 책']
    ]},
    { id: 'print', label: '인쇄·출판', icons: [
      ['🖨️','프린터'],['📘','파란 책'],['📕','빨간 책'],['📗','초록 책'],['📙','주황 책'],['🏷️','라벨'],['✂️','재단'],['📐','삼각자'],['📏','자'],['🗂️','분류 파일'],['📦','포장'],['📰','인쇄물']
    ]},
    { id: 'design', label: '이미지·디자인', icons: [
      ['🖼️','이미지'],['🎨','팔레트'],['🖌️','붓'],['✏️','연필'],['✒️','펜촉'],['🖊️','펜'],['📷','카메라'],['🎞️','필름'],['🌈','색상'],['🧩','레이아웃'],['🔲','프레임'],['💠','디자인']
    ]},
    { id: 'office', label: '사무·파일', icons: [
      ['📁','폴더'],['📂','열린 폴더'],['🗃️','파일 박스'],['🗄️','파일 캐비닛'],['📌','핀'],['📎','클립'],['📊','막대 그래프'],['📈','상승 그래프'],['📉','하락 그래프'],['🧮','계산기'],['🗓️','달력'],['🕒','시간']
    ]},
    { id: 'education', label: '교육·행사', icons: [
      ['🏫','학교'],['🎓','교육'],['🏆','상장'],['🥇','수상'],['🏅','메달'],['🎪','행사'],['🎟️','티켓'],['🎤','마이크'],['📣','안내'],['👥','단체'],['🪪','명찰'],['🎉','축하']
    ]},
    { id: 'ai', label: 'AI·기술', icons: [
      ['🤖','AI 로봇'],['🧠','AI 두뇌'],['✨','AI 생성'],['💡','아이디어'],['💻','노트북'],['🖥️','컴퓨터'],['⌨️','키보드'],['📡','연결'],['☁️','클라우드'],['🔍','검색'],['⚡','빠른 처리'],['🔬','분석']
    ]},
    { id: 'tools', label: '도구·설정', icons: [
      ['⚙️','설정'],['🛠️','도구'],['🔧','정비'],['🔨','작업'],['🧰','도구 상자'],['🧭','탐색'],['🔄','변환'],['🔗','연결'],['✅','완료'],['☑️','체크'],['🔒','보안'],['🔑','권한']
    ]},
    { id: 'business', label: '업무·소통', icons: [
      ['💼','업무'],['🏢','회사'],['🏭','생산'],['💬','대화'],['✉️','메일'],['📧','이메일'],['📞','전화'],['📢','공지'],['🛒','주문'],['💳','결제'],['💰','금액'],['🚚','배송']
    ]},
    { id: 'general', label: '기타·추천', icons: [
      ['⭐','추천'],['🌟','특별'],['❤️','즐겨찾기'],['🎯','목표'],['🚀','시작'],['🌐','웹'],['🔔','알림'],['⏱️','타이머'],['🧱','구성'],['🗺️','안내'],['🔖','북마크'],['🪄','자동화']
    ]}
  ];

  const ALL_ICONS = GROUPS.flatMap((group) => group.icons.map(([icon, label]) => ({ icon, label, groupId: group.id, groupLabel: group.label })));
  const normalize = (value) => String(value || '').trim().toLowerCase();

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .pcat-icon-palette{grid-column:1/-1;border:1px solid #dde6ef;border-radius:12px;background:#f8fafc;padding:10px;margin-top:1px}.pcat-icon-top{display:flex;align-items:center;gap:9px;margin-bottom:9px}.pcat-icon-preview{width:42px;height:42px;border:1px solid #dce4ed;border-radius:11px;background:#fff;display:grid;place-items:center;font-size:24px}.pcat-icon-copy{min-width:0;flex:1}.pcat-icon-copy strong{display:block;font-size:10px}.pcat-icon-copy span{display:block;font-size:8px;color:#667085;margin-top:3px}.pcat-icon-search{width:180px!important;min-width:120px;border:1px solid #cfd8e3;border-radius:9px;padding:8px 9px;background:#fff;font-size:9px}.pcat-icon-groups{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px}.pcat-icon-group{border:1px solid #d8e1ea;background:#fff;color:#475467;border-radius:999px;padding:5px 8px;font-size:8px;font-weight:900;cursor:pointer}.pcat-icon-group.on{border-color:#1769e0;background:#edf5ff;color:#175ea8}.pcat-icon-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:5px;max-height:220px;overflow:auto;padding:2px}.pcat-icon-choice{min-width:0;height:48px;border:1px solid #e0e7ef;background:#fff;border-radius:9px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer}.pcat-icon-choice:hover{border-color:#8db8e9;background:#f5f9ff}.pcat-icon-choice.on{border-color:#1769e0;background:#edf5ff;box-shadow:0 0 0 2px #1769e012}.pcat-icon-choice .emoji{font-size:19px;line-height:1}.pcat-icon-choice .label{font-size:7px;color:#667085;max-width:100%;padding:0 3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pcat-icon-empty{grid-column:1/-1;padding:18px;text-align:center;color:#98a2b3;font-size:9px}
      @media(max-width:1200px){.pcat-icon-grid{grid-template-columns:repeat(9,minmax(0,1fr))}}@media(max-width:850px){.pcat-icon-top{align-items:stretch;flex-wrap:wrap}.pcat-icon-search{width:100%!important}.pcat-icon-grid{grid-template-columns:repeat(6,minmax(0,1fr))}}@media(max-width:520px){.pcat-icon-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
    `;
    document.head.appendChild(style);
  }

  function dispatchIcon(input, icon) {
    input.value = icon;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function enhanceInput(input) {
    const field = input.closest('.pcat-field');
    if (!field || field.querySelector(`.${PALETTE_CLASS}`)) return;

    const palette = document.createElement('div');
    palette.className = PALETTE_CLASS;
    palette.dataset.group = 'all';
    palette.innerHTML = `
      <div class="pcat-icon-top">
        <div class="pcat-icon-preview" aria-hidden="true"></div>
        <div class="pcat-icon-copy"><strong>아이콘 선택</strong><span>목록에서 고르거나 위 입력칸에 원하는 이모지를 직접 입력할 수 있습니다.</span></div>
        <input class="pcat-icon-search" type="search" placeholder="아이콘 검색" aria-label="프로그램 아이콘 검색">
      </div>
      <div class="pcat-icon-groups" role="group" aria-label="아이콘 분류"></div>
      <div class="pcat-icon-grid" role="listbox" aria-label="프로그램 아이콘 목록"></div>`;
    field.appendChild(palette);

    const preview = palette.querySelector('.pcat-icon-preview');
    const search = palette.querySelector('.pcat-icon-search');
    const groups = palette.querySelector('.pcat-icon-groups');
    const grid = palette.querySelector('.pcat-icon-grid');

    function buildGroups() {
      groups.replaceChildren();
      [{ id: 'all', label: `전체 ${ALL_ICONS.length}` }, ...GROUPS.map((group) => ({ id: group.id, label: group.label }))].forEach((group) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `pcat-icon-group${palette.dataset.group === group.id ? ' on' : ''}`;
        button.textContent = group.label;
        button.addEventListener('click', () => { palette.dataset.group = group.id; buildGroups(); renderIcons(); });
        groups.appendChild(button);
      });
    }

    function filteredIcons() {
      const group = palette.dataset.group || 'all';
      const query = normalize(search.value);
      return ALL_ICONS.filter((item) => {
        if (group !== 'all' && item.groupId !== group) return false;
        if (!query) return true;
        return normalize(`${item.label} ${item.groupLabel} ${item.icon}`).includes(query);
      });
    }

    function syncSelection() {
      const value = input.value || '🧰';
      preview.textContent = value;
      grid.querySelectorAll('.pcat-icon-choice').forEach((button) => button.classList.toggle('on', button.dataset.icon === value));
    }

    function renderIcons() {
      const list = filteredIcons();
      grid.replaceChildren();
      if (!list.length) {
        const empty = document.createElement('div');
        empty.className = 'pcat-icon-empty';
        empty.textContent = '검색 결과가 없습니다. 위 아이콘 입력칸에는 직접 입력할 수도 있습니다.';
        grid.appendChild(empty);
        syncSelection();
        return;
      }
      list.forEach((item) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'pcat-icon-choice';
        button.dataset.icon = item.icon;
        button.title = `${item.groupLabel} · ${item.label}`;
        button.setAttribute('role', 'option');
        button.setAttribute('aria-label', `${item.label} 아이콘 ${item.icon}`);
        const emoji = document.createElement('span');
        emoji.className = 'emoji'; emoji.textContent = item.icon;
        const label = document.createElement('span');
        label.className = 'label'; label.textContent = item.label;
        button.append(emoji, label);
        button.addEventListener('click', () => { dispatchIcon(input, item.icon); syncSelection(); });
        grid.appendChild(button);
      });
      syncSelection();
    }

    input.addEventListener('input', syncSelection);
    search.addEventListener('input', renderIcons);
    buildGroups();
    renderIcons();
  }

  function scan() {
    installStyles();
    document.querySelectorAll('#adminProgramCatalogPanel input[data-prog-field="icon"]').forEach(enhanceInput);
  }

  function install() {
    scan();
    const root = document.getElementById('adminProgramCatalogPanel') || document.body;
    if (!root) return;
    const observer = new MutationObserver(scan);
    observer.observe(root, { childList: true, subtree: true });
    window.AdminProgramIconPalette.observer = observer;
  }

  window.AdminProgramIconPalette = {
    stage: 'categorized-program-icon-picker',
    groups: GROUPS,
    icons: ALL_ICONS,
    iconCount: ALL_ICONS.length,
    install
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
