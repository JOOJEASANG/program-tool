(() => {
  'use strict';
  if (window.__printCheckerSimpleEditorV1) return;
  window.__printCheckerSimpleEditorV1 = true;

  const NS = 'http://www.w3.org/2000/svg';
  const byId = (id) => document.getElementById(id);
  const body = document.body;
  let root = null;
  let svg = null;
  let objects = null;
  let selectionLayer = null;
  let selectionBox = null;
  let resizeHandle = null;
  let emptyHint = null;
  let selected = null;
  let boardW = 210;
  let boardH = 297;
  let objectSerial = 0;
  let dragState = null;
  let resizeState = null;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const number = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const svgNode = (tag, attrs = {}) => {
    const node = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  };

  function currentSpec() {
    const state = window.PrintChecker?.getState?.() || {};
    const product = state.product || document.documentElement.dataset.printCheckerActiveProduct || new URLSearchParams(location.search).get('product') || 'cover';
    const value = (id, fallback = 0) => {
      const element = byId(id);
      if (element && String(element.value).trim() !== '') return number(element.value, fallback);
      return number(state.specs?.[id], fallback);
    };
    return {
      product,
      trimW: value('trimW', product === 'cover' ? 210 : 210),
      trimH: value('trimH', 297),
      bleed: value('bleed', 3),
      spine: value('spine', 0),
      wingW: value('wingW', 0),
      hasWing: Boolean(byId('hasWing')?.checked ?? state.specs?.hasWing),
    };
  }

  function boardFromSpec() {
    const spec = currentSpec();
    const bleed = Math.max(0, spec.bleed || 0);
    let width = Math.max(10, spec.trimW || 210);
    let height = Math.max(10, spec.trimH || 297);
    if (spec.product === 'cover') {
      width = width * 2 + Math.max(0, spec.spine || 0) + (spec.hasWing ? Math.max(0, spec.wingW || 0) * 2 : 0);
    }
    width += bleed * 2;
    height += bleed * 2;
    return { width, height, spec };
  }

  function modeButton(mode, label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pc-workspace-mode-btn';
    button.dataset.workspaceMode = mode;
    button.textContent = label;
    button.addEventListener('click', () => setMode(mode));
    return button;
  }

  function createButton(label, action, options = {}) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `pc-editor-btn${options.className ? ` ${options.className}` : ''}`;
    button.textContent = label;
    if (options.title) button.title = options.title;
    if (options.id) button.id = options.id;
    button.addEventListener('click', action);
    return button;
  }

  function toolGroup(...nodes) {
    const group = document.createElement('div');
    group.className = 'pc-editor-tool-group';
    nodes.filter(Boolean).forEach((node) => group.appendChild(node));
    return group;
  }

  function labeledControl(label, control) {
    const span = document.createElement('span');
    span.className = 'pc-editor-field-label';
    span.textContent = label;
    return [span, control];
  }

  function buildModeBar(main) {
    let bar = byId('pcWorkspaceModebar');
    if (bar) return bar;
    bar = document.createElement('div');
    bar.id = 'pcWorkspaceModebar';
    bar.className = 'pc-workspace-modebar';
    const label = document.createElement('span');
    label.className = 'pc-workspace-mode-label';
    label.textContent = '작업 모드';
    const review = modeButton('review', '인쇄 검토');
    const editor = modeButton('editor', '간편 편집');
    const spacer = document.createElement('span');
    spacer.className = 'pc-workspace-mode-spacer';
    const help = document.createElement('span');
    help.className = 'pc-workspace-mode-help';
    help.textContent = '간단 제작 후 바로 검토로 보낼 수 있습니다.';
    bar.append(label, review, editor, spacer, help);
    main.prepend(bar);
    return bar;
  }

  function buildEditor(main) {
    if (byId('pcSimpleEditorWorkspace')) return byId('pcSimpleEditorWorkspace');
    const section = document.createElement('section');
    section.id = 'pcSimpleEditorWorkspace';
    section.className = 'pc-simple-editor';
    section.setAttribute('aria-label', '인쇄물 간편 편집 작업공간');

    const top = document.createElement('div');
    top.className = 'pc-editor-top';
    const addText = createButton('T 글씨', addTextObject, { title: '글씨 추가' });
    const addRect = createButton('▭ 사각형', () => addShape('rect'));
    const addCircle = createButton('○ 원', () => addShape('ellipse'));
    const addLine = createButton('╱ 선', () => addShape('line'));
    const imageButton = createButton('🖼 이미지', () => byId('pcEditorImageInput')?.click());
    const imageInput = document.createElement('input');
    imageInput.type = 'file';
    imageInput.id = 'pcEditorImageInput';
    imageInput.accept = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml';
    imageInput.hidden = true;
    imageInput.addEventListener('change', handleImageInput);

    const color = document.createElement('input');
    color.type = 'color';
    color.id = 'pcEditorColor';
    color.className = 'pc-editor-color';
    color.value = '#12396d';
    color.title = '선택 개체 색상';
    color.addEventListener('input', applyColor);

    const fontSize = document.createElement('input');
    fontSize.type = 'number';
    fontSize.id = 'pcEditorFontSize';
    fontSize.className = 'pc-editor-number';
    fontSize.min = '2';
    fontSize.max = '80';
    fontSize.step = '0.5';
    fontSize.value = '8';
    fontSize.title = '글씨 크기';
    fontSize.addEventListener('input', applyFontSize);

    const duplicate = createButton('복제', duplicateSelected, { id: 'pcEditorDuplicate' });
    const remove = createButton('삭제', deleteSelected, { id: 'pcEditorDelete', className: 'danger' });
    const clear = createButton('전체 지우기', clearObjects, { className: 'danger' });
    const exportBtn = createButton('PNG 저장', downloadPng, { className: 'primary' });
    const inspectBtn = createButton('검토로 보내기', sendToReview, { className: 'primary' });

    top.append(
      toolGroup(addText, addRect, addCircle, addLine, imageButton, imageInput),
      toolGroup(...labeledControl('색상', color)),
      toolGroup(...labeledControl('글씨', fontSize)),
      toolGroup(duplicate, remove, clear),
      toolGroup(exportBtn, inspectBtn),
    );

    const sub = document.createElement('div');
    sub.className = 'pc-editor-subbar';
    sub.append(
      createButton('현재 제품 사양 적용', applyCurrentSpec, { title: '현재 선택한 제품의 작업 크기를 편집판에 적용' }),
      createButton('A4 세로', () => setBoardSize(216, 303, 'A4 + 도련 3mm')),
      createButton('A4 가로', () => setBoardSize(303, 216, 'A4 가로 + 도련 3mm')),
      createButton('정사각 210', () => setBoardSize(216, 216, '210mm + 도련 3mm')),
    );
    const summary = document.createElement('div');
    summary.className = 'pc-editor-size-summary';
    summary.innerHTML = '작업판 <strong id="pcEditorBoardSize">210 × 297 mm</strong>';
    sub.appendChild(summary);

    const editorMain = document.createElement('div');
    editorMain.className = 'pc-editor-main';
    const stage = document.createElement('div');
    stage.className = 'pc-editor-stage';
    const shell = document.createElement('div');
    shell.className = 'pc-editor-board-shell';
    svg = svgNode('svg', { id: 'pcSimpleEditorSvg', viewBox: `0 0 ${boardW} ${boardH}`, role: 'img', 'aria-label': '간편 편집 작업판' });
    const background = svgNode('rect', { id: 'pcEditorBackground', x: 0, y: 0, width: boardW, height: boardH, fill: '#ffffff' });
    objects = svgNode('g', { id: 'pcEditorObjects' });
    selectionLayer = svgNode('g', { id: 'pcEditorSelectionLayer' });
    selectionBox = svgNode('rect', { id: 'pcEditorSelectionBox', x: 0, y: 0, width: 0, height: 0, visibility: 'hidden' });
    resizeHandle = svgNode('circle', { id: 'pcEditorResizeHandle', cx: 0, cy: 0, r: 2.8, visibility: 'hidden' });
    selectionLayer.append(selectionBox, resizeHandle);
    svg.append(background, objects, selectionLayer);
    emptyHint = document.createElement('div');
    emptyHint.className = 'pc-editor-empty-hint';
    emptyHint.textContent = '글씨·도형·이미지를 추가한 뒤 마우스로 자유롭게 배치하세요.';
    shell.append(svg, emptyHint);
    stage.appendChild(shell);

    const inspector = buildInspector();
    editorMain.append(stage, inspector);
    section.append(top, sub, editorMain);
    main.insertBefore(section, byId('previewZoomToolbar') || main.firstChild?.nextSibling || null);

    svg.addEventListener('pointerdown', (event) => {
      if (event.target === svg || event.target.id === 'pcEditorBackground') selectObject(null);
    });
    resizeHandle.addEventListener('pointerdown', startResize);
    document.addEventListener('pointermove', pointerMove);
    document.addEventListener('pointerup', pointerUp);
    document.addEventListener('keydown', keyboardControl);
    return section;
  }

  function buildInspector() {
    const aside = document.createElement('aside');
    aside.className = 'pc-editor-inspector';
    const selectionSection = document.createElement('div');
    selectionSection.className = 'pc-editor-inspector-section';
    const title = document.createElement('h3');
    title.textContent = '선택 개체';
    const name = document.createElement('div');
    name.id = 'pcEditorSelectionName';
    name.className = 'pc-editor-selection-name empty';
    name.textContent = '개체를 선택하세요';
    const grid = document.createElement('div');
    grid.className = 'pc-editor-inspector-grid';
    const width = inspectorInput('pcEditorObjectW', '너비 mm', resizeFromInspector);
    const height = inspectorInput('pcEditorObjectH', '높이 mm', resizeFromInspector);
    grid.append(width.wrapper, height.wrapper);
    selectionSection.append(title, name, grid);

    const alignSection = document.createElement('div');
    alignSection.className = 'pc-editor-inspector-section';
    const alignTitle = document.createElement('h3');
    alignTitle.textContent = '작업판 정렬';
    const alignGrid = document.createElement('div');
    alignGrid.className = 'pc-editor-align-grid';
    [['왼쪽','left'],['가운데','center'],['오른쪽','right'],['위','top'],['중앙','middle'],['아래','bottom']].forEach(([label, key]) => {
      const button = createButton(label, () => alignSelected(key));
      button.dataset.requiresSelection = '1';
      alignGrid.appendChild(button);
    });
    alignSection.append(alignTitle, alignGrid);

    const stackSection = document.createElement('div');
    stackSection.className = 'pc-editor-inspector-section';
    const stackTitle = document.createElement('h3');
    stackTitle.textContent = '배치 순서';
    const stack = document.createElement('div');
    stack.className = 'pc-editor-stack';
    const back = createButton('맨 뒤로', () => moveLayer('back'));
    const front = createButton('맨 앞으로', () => moveLayer('front'));
    back.dataset.requiresSelection = '1';
    front.dataset.requiresSelection = '1';
    stack.append(back, front);
    const note = document.createElement('p');
    note.className = 'pc-editor-note';
    note.textContent = 'Delete: 삭제 · 방향키: 미세 이동 · Shift+방향키: 2mm 이동 · Ctrl/Cmd+D: 복제 · 글씨 더블클릭: 내용 수정';
    stackSection.append(stackTitle, stack, note);

    aside.append(selectionSection, alignSection, stackSection);
    return aside;
  }

  function inspectorInput(id, label, handler) {
    const wrapper = document.createElement('label');
    wrapper.textContent = label;
    const input = document.createElement('input');
    input.type = 'number';
    input.id = id;
    input.min = '1';
    input.step = '0.5';
    input.addEventListener('change', handler);
    wrapper.appendChild(input);
    return { wrapper, input };
  }

  function setMode(mode) {
    const next = mode === 'editor' ? 'editor' : 'review';
    body.dataset.printCheckerWorkspace = next;
    document.querySelectorAll('[data-workspace-mode]').forEach((button) => button.classList.toggle('active', button.dataset.workspaceMode === next));
    if (next === 'editor') {
      if (!objects?.children.length) applyCurrentSpec();
      updateSelectionUi();
    }
    try { sessionStorage.setItem('print-checker-workspace-mode', next); } catch (_) {}
    window.dispatchEvent(new CustomEvent('programstudio:print-checker-workspace-mode', { detail: { mode: next } }));
  }

  function applyCurrentSpec() {
    const result = boardFromSpec();
    const label = result.spec.product === 'cover' ? '표지 전체 작업 크기' : '현재 제품 작업 크기';
    setBoardSize(result.width, result.height, label);
  }

  function setBoardSize(width, height, label = '') {
    boardW = Math.max(10, number(width, 210));
    boardH = Math.max(10, number(height, 297));
    svg?.setAttribute('viewBox', `0 0 ${boardW} ${boardH}`);
    const background = byId('pcEditorBackground');
    background?.setAttribute('width', boardW);
    background?.setAttribute('height', boardH);
    const maxPx = 900;
    const minPx = 300;
    const cssW = clamp(boardW * 2.5, minPx, maxPx);
    if (svg) {
      svg.style.width = `${cssW}px`;
      svg.style.height = `${cssW * boardH / boardW}px`;
    }
    const summary = byId('pcEditorBoardSize');
    if (summary) summary.textContent = `${trimNumber(boardW)} × ${trimNumber(boardH)} mm${label ? ` · ${label}` : ''}`;
    updateSelectionOverlay();
  }

  function trimNumber(value) {
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  }

  function nextId(type) {
    objectSerial += 1;
    return `pc-editor-${type}-${objectSerial}`;
  }

  function bindObject(element, type, label) {
    element.dataset.editorObject = '1';
    element.dataset.objectType = type;
    element.dataset.objectLabel = label || type;
    element.id ||= nextId(type);
    element.setAttribute('tabindex', '0');
    element.addEventListener('pointerdown', startDrag);
    element.addEventListener('click', (event) => { event.stopPropagation(); selectObject(element); });
    element.addEventListener('focus', () => selectObject(element));
    if (type === 'text') {
      element.addEventListener('dblclick', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const value = window.prompt('글씨 내용을 수정하세요.', element.textContent || '');
        if (value !== null) {
          element.textContent = value || ' ';
          updateSelectionOverlay();
        }
      });
    }
    return element;
  }

  function addObject(element, type, label) {
    bindObject(element, type, label);
    objects.appendChild(element);
    emptyHint.hidden = true;
    selectObject(element);
  }

  function addTextObject() {
    const value = window.prompt('추가할 글씨를 입력하세요.', '텍스트');
    if (value === null) return;
    const size = clamp(number(byId('pcEditorFontSize')?.value, 8), 2, 80);
    const text = svgNode('text', {
      x: Math.max(5, boardW * .12),
      y: Math.max(size + 4, boardH * .18),
      fill: byId('pcEditorColor')?.value || '#12396d',
      'font-size': size,
      'font-family': 'Pretendard, Noto Sans KR, sans-serif',
      'font-weight': '700',
      'dominant-baseline': 'alphabetic',
    });
    text.textContent = value || '텍스트';
    addObject(text, 'text', `글씨 · ${text.textContent.slice(0, 20)}`);
  }

  function addShape(type) {
    const color = byId('pcEditorColor')?.value || '#12396d';
    if (type === 'rect') {
      addObject(svgNode('rect', { x: boardW * .25, y: boardH * .25, width: Math.min(55, boardW * .35), height: Math.min(35, boardH * .22), rx: 1.5, fill: color, opacity: .9 }), 'rect', '사각형');
    } else if (type === 'ellipse') {
      const w = Math.min(42, boardW * .3);
      const h = Math.min(42, boardH * .2);
      addObject(svgNode('ellipse', { cx: boardW * .5, cy: boardH * .4, rx: w / 2, ry: h / 2, fill: color, opacity: .9 }), 'ellipse', '원/타원');
    } else if (type === 'line') {
      addObject(svgNode('line', { x1: boardW * .25, y1: boardH * .4, x2: boardW * .7, y2: boardH * .4, stroke: color, 'stroke-width': 1.2, 'stroke-linecap': 'round', 'vector-effect': 'non-scaling-stroke' }), 'line', '선');
    }
  }

  async function handleImageInput(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      window.alert('PNG, JPEG, WEBP, GIF, SVG 이미지 파일을 선택해 주세요.');
      return;
    }
    const dataUrl = await readDataUrl(file);
    const imageMeta = await loadImage(dataUrl);
    const maxW = Math.max(20, boardW * .45);
    const maxH = Math.max(20, boardH * .45);
    let width = Math.min(maxW, 90);
    let height = width * imageMeta.height / Math.max(1, imageMeta.width);
    if (height > maxH) {
      height = maxH;
      width = height * imageMeta.width / Math.max(1, imageMeta.height);
    }
    const image = svgNode('image', {
      x: Math.max(0, (boardW - width) / 2),
      y: Math.max(0, (boardH - height) / 2),
      width,
      height,
      href: dataUrl,
      preserveAspectRatio: 'xMidYMid meet',
    });
    image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', dataUrl);
    addObject(image, 'image', `이미지 · ${file.name}`);
  }

  function readDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('파일을 읽지 못했습니다.'));
      reader.readAsDataURL(file);
    });
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('이미지를 불러오지 못했습니다.'));
      image.src = url;
    });
  }

  function selectObject(element) {
    if (selected === element) {
      updateSelectionUi();
      return;
    }
    selected?.classList.remove('is-selected');
    selected = element && element.dataset?.editorObject === '1' ? element : null;
    selected?.classList.add('is-selected');
    updateSelectionUi();
  }

  function getBounds(element = selected) {
    if (!element) return null;
    try {
      const box = element.getBBox();
      return { x: box.x, y: box.y, w: Math.max(.01, box.width), h: Math.max(.01, box.height) };
    } catch (_) {
      return null;
    }
  }

  function updateSelectionUi() {
    const name = byId('pcEditorSelectionName');
    const width = byId('pcEditorObjectW');
    const height = byId('pcEditorObjectH');
    const type = selected?.dataset.objectType || '';
    const box = getBounds();
    if (name) {
      name.textContent = selected ? (selected.dataset.objectLabel || type) : '개체를 선택하세요';
      name.classList.toggle('empty', !selected);
    }
    if (width) {
      width.disabled = !selected || type === 'text';
      width.value = box ? trimNumber(box.w) : '';
    }
    if (height) {
      height.disabled = !selected || type === 'text';
      height.value = box ? trimNumber(box.h) : '';
    }
    document.querySelectorAll('[data-requires-selection="1"],#pcEditorDuplicate,#pcEditorDelete').forEach((button) => { button.disabled = !selected; });
    const font = byId('pcEditorFontSize');
    if (font) {
      font.disabled = type !== 'text';
      if (type === 'text') font.value = trimNumber(number(selected.getAttribute('font-size'), 8));
    }
    const color = byId('pcEditorColor');
    if (color) {
      color.disabled = !selected || type === 'image';
      if (selected && type !== 'image') color.value = normalizeColor(type === 'line' ? selected.getAttribute('stroke') : selected.getAttribute('fill'));
    }
    updateSelectionOverlay();
  }

  function normalizeColor(value) {
    const raw = String(value || '').trim();
    return /^#[0-9a-f]{6}$/i.test(raw) ? raw : '#12396d';
  }

  function updateSelectionOverlay() {
    if (!selectionBox || !resizeHandle) return;
    const box = getBounds();
    if (!selected || !box) {
      selectionBox.setAttribute('visibility', 'hidden');
      resizeHandle.setAttribute('visibility', 'hidden');
      return;
    }
    selectionBox.setAttribute('x', box.x);
    selectionBox.setAttribute('y', box.y);
    selectionBox.setAttribute('width', box.w);
    selectionBox.setAttribute('height', box.h);
    selectionBox.setAttribute('visibility', 'visible');
    const resizable = selected.dataset.objectType !== 'text';
    resizeHandle.setAttribute('cx', box.x + box.w);
    resizeHandle.setAttribute('cy', box.y + box.h);
    resizeHandle.setAttribute('visibility', resizable ? 'visible' : 'hidden');
  }

  function pointFromEvent(event) {
    if (!svg) return { x: 0, y: 0 };
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const matrix = svg.getScreenCTM()?.inverse();
    if (!matrix) return { x: 0, y: 0 };
    const result = point.matrixTransform(matrix);
    return { x: result.x, y: result.y };
  }

  function startDrag(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    selectObject(event.currentTarget);
    const point = pointFromEvent(event);
    dragState = { element: event.currentTarget, point };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function startResize(event) {
    if (!selected || selected.dataset.objectType === 'text') return;
    event.preventDefault();
    event.stopPropagation();
    const point = pointFromEvent(event);
    const box = getBounds();
    if (!box) return;
    resizeState = { element: selected, point, box };
    resizeHandle.setPointerCapture?.(event.pointerId);
  }

  function pointerMove(event) {
    if (resizeState) {
      const point = pointFromEvent(event);
      const dx = point.x - resizeState.point.x;
      const dy = point.y - resizeState.point.y;
      resizeElement(resizeState.element, Math.max(2, resizeState.box.w + dx), Math.max(2, resizeState.box.h + dy), resizeState.box);
      updateSelectionUi();
      return;
    }
    if (!dragState) return;
    const point = pointFromEvent(event);
    const dx = point.x - dragState.point.x;
    const dy = point.y - dragState.point.y;
    moveBy(dragState.element, dx, dy);
    dragState.point = point;
    updateSelectionUi();
  }

  function pointerUp() {
    dragState = null;
    resizeState = null;
  }

  function moveBy(element, dx, dy) {
    if (!element || (!dx && !dy)) return;
    const type = element.dataset.objectType;
    if (type === 'rect' || type === 'image') {
      element.setAttribute('x', number(element.getAttribute('x')) + dx);
      element.setAttribute('y', number(element.getAttribute('y')) + dy);
    } else if (type === 'ellipse') {
      element.setAttribute('cx', number(element.getAttribute('cx')) + dx);
      element.setAttribute('cy', number(element.getAttribute('cy')) + dy);
    } else if (type === 'line') {
      element.setAttribute('x1', number(element.getAttribute('x1')) + dx);
      element.setAttribute('y1', number(element.getAttribute('y1')) + dy);
      element.setAttribute('x2', number(element.getAttribute('x2')) + dx);
      element.setAttribute('y2', number(element.getAttribute('y2')) + dy);
    } else if (type === 'text') {
      element.setAttribute('x', number(element.getAttribute('x')) + dx);
      element.setAttribute('y', number(element.getAttribute('y')) + dy);
    }
  }

  function resizeElement(element, width, height, originalBox = null) {
    if (!element) return;
    const type = element.dataset.objectType;
    const box = originalBox || getBounds(element);
    if (!box) return;
    if (type === 'rect' || type === 'image') {
      element.setAttribute('width', width);
      element.setAttribute('height', height);
    } else if (type === 'ellipse') {
      element.setAttribute('cx', box.x + width / 2);
      element.setAttribute('cy', box.y + height / 2);
      element.setAttribute('rx', width / 2);
      element.setAttribute('ry', height / 2);
    } else if (type === 'line') {
      const x1 = number(element.getAttribute('x1'));
      const y1 = number(element.getAttribute('y1'));
      element.setAttribute('x2', x1 + width);
      element.setAttribute('y2', y1 + height);
    }
  }

  function resizeFromInspector() {
    if (!selected || selected.dataset.objectType === 'text') return;
    const width = Math.max(1, number(byId('pcEditorObjectW')?.value, getBounds()?.w || 1));
    const height = Math.max(1, number(byId('pcEditorObjectH')?.value, getBounds()?.h || 1));
    resizeElement(selected, width, height);
    updateSelectionUi();
  }

  function applyColor(event) {
    if (!selected || selected.dataset.objectType === 'image') return;
    const color = event.target.value;
    if (selected.dataset.objectType === 'line') selected.setAttribute('stroke', color);
    else selected.setAttribute('fill', color);
  }

  function applyFontSize(event) {
    if (!selected || selected.dataset.objectType !== 'text') return;
    selected.setAttribute('font-size', clamp(number(event.target.value, 8), 2, 80));
    updateSelectionOverlay();
  }

  function alignSelected(position) {
    const box = getBounds();
    if (!selected || !box) return;
    let targetX = box.x;
    let targetY = box.y;
    if (position === 'left') targetX = 0;
    if (position === 'center') targetX = (boardW - box.w) / 2;
    if (position === 'right') targetX = boardW - box.w;
    if (position === 'top') targetY = 0;
    if (position === 'middle') targetY = (boardH - box.h) / 2;
    if (position === 'bottom') targetY = boardH - box.h;
    moveBy(selected, targetX - box.x, targetY - box.y);
    updateSelectionUi();
  }

  function moveLayer(direction) {
    if (!selected) return;
    if (direction === 'front') objects.appendChild(selected);
    else objects.insertBefore(selected, objects.firstChild);
    updateSelectionOverlay();
  }

  function duplicateSelected() {
    if (!selected) return;
    const clone = selected.cloneNode(true);
    clone.removeAttribute('id');
    clone.classList.remove('is-selected');
    bindObject(clone, selected.dataset.objectType, selected.dataset.objectLabel);
    objects.appendChild(clone);
    moveBy(clone, 4, 4);
    selectObject(clone);
  }

  function deleteSelected() {
    if (!selected) return;
    const target = selected;
    selectObject(null);
    target.remove();
    emptyHint.hidden = objects.children.length > 0;
  }

  function clearObjects() {
    if (!objects?.children.length) return;
    if (!window.confirm('편집 작업판의 모든 개체를 지울까요?')) return;
    selectObject(null);
    objects.replaceChildren();
    emptyHint.hidden = false;
  }

  function keyboardControl(event) {
    if (body.dataset.printCheckerWorkspace !== 'editor' || !selected) return;
    const tag = event.target?.tagName?.toLowerCase();
    if (['input','select','textarea'].includes(tag)) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      duplicateSelected();
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      deleteSelected();
      return;
    }
    const step = event.shiftKey ? 2 : .5;
    const movement = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
    }[event.key];
    if (movement) {
      event.preventDefault();
      moveBy(selected, movement[0], movement[1]);
      updateSelectionUi();
    }
  }

  async function renderPngBlob() {
    const clone = svg.cloneNode(true);
    clone.querySelector('#pcEditorSelectionLayer')?.remove();
    clone.querySelectorAll('.is-selected').forEach((node) => node.classList.remove('is-selected'));
    clone.setAttribute('xmlns', NS);
    const dpi = 300;
    let pixelW = Math.max(1, Math.round(boardW / 25.4 * dpi));
    let pixelH = Math.max(1, Math.round(boardH / 25.4 * dpi));
    const maxDimension = 10000;
    const reduction = Math.min(1, maxDimension / Math.max(pixelW, pixelH));
    pixelW = Math.max(1, Math.round(pixelW * reduction));
    pixelH = Math.max(1, Math.round(pixelH * reduction));
    clone.setAttribute('width', pixelW);
    clone.setAttribute('height', pixelH);
    const xml = new XMLSerializer().serializeToString(clone);
    const source = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(source);
    try {
      const image = await loadImage(url);
      const canvas = document.createElement('canvas');
      canvas.width = pixelW;
      canvas.height = pixelH;
      const context = canvas.getContext('2d', { alpha: false });
      context.fillStyle = '#fff';
      context.fillRect(0, 0, pixelW, pixelH);
      context.drawImage(image, 0, 0, pixelW, pixelH);
      return await new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG 생성 실패')), 'image/png', 1));
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function downloadPng() {
    try {
      const blob = await renderPngBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `인쇄물-간편편집-${new Date().toISOString().slice(0,10)}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error('[print-checker-simple-editor] export failed', error);
      window.alert('PNG 파일을 만들지 못했습니다. 이미지 파일 상태를 확인해 주세요.');
    }
  }

  async function sendToReview() {
    const button = event?.currentTarget;
    try {
      if (button) button.disabled = true;
      const blob = await renderPngBlob();
      const file = new File([blob], `간편편집-${Date.now()}.png`, { type: 'image/png' });
      setMode('review');
      const ok = await window.PrintChecker?.inspectFile?.(file);
      if (!ok) throw new Error('검토 화면으로 파일을 전달하지 못했습니다.');
    } catch (error) {
      console.error('[print-checker-simple-editor] send to review failed', error);
      window.alert('검토 화면으로 보내지 못했습니다. PNG 저장 후 직접 업로드해 주세요.');
    } finally {
      if (button) button.disabled = false;
    }
  }

  function install() {
    const main = byId('printCheckerMain');
    if (!main) return;
    root = buildEditor(main);
    buildModeBar(main);
    const compareSection = byId('uploadZone')?.closest('.sb-section');
    if (compareSection) compareSection.id ||= 'fileCompareSection';
    const actionRow = document.querySelector('.print-checker-page .action-row');
    if (actionRow) actionRow.id ||= 'reviewActionRow';
    let initial = 'review';
    try { initial = sessionStorage.getItem('print-checker-workspace-mode') || 'review'; } catch (_) {}
    setBoardSize(boardW, boardH);
    setMode(initial);
    window.PrintCheckerSimpleEditor = Object.freeze({
      setMode,
      applyCurrentSpec,
      setBoardSize,
      renderPngBlob,
      getState: () => ({ mode: body.dataset.printCheckerWorkspace || 'review', widthMm: boardW, heightMm: boardH, objectCount: objects?.children.length || 0 }),
      stage: 'print-production-simple-editor-v1',
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
