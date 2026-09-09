import { advancedState } from './state.js';

const $ = id => document.getElementById(id);
let fitFrame = 0;

function installCss() {
  if ($('pdfAdvancedLayoutV3Css')) return;
  const link = document.createElement('link');
  link.id = 'pdfAdvancedLayoutV3Css';
  link.rel = 'stylesheet';
  link.href = '/css/pdf-editor-advanced-layout-v3.css?v=20260909-1';
  document.head.appendChild(link);
}

function syncEmptyState() {
  const empty = $('emptyState');
  if (!empty) return;
  const hasPages = advancedState.pages.length > 0 && !!advancedState.selectedId;
  empty.hidden = hasPages;
  empty.style.display = hasPages ? 'none' : '';
  document.documentElement.dataset.pdfAdvancedHasPages = hasPages ? '1' : '0';
}

function updateFitVariables() {
  fitFrame = 0;
  const scroll = $('previewScroll');
  const row = $('pairPreviewRow');
  if (!scroll || !row) return;

  const mobile = window.innerWidth <= 720;
  const twoUp = !mobile && advancedState.pages.length > 1;
  const gap = mobile ? 18 : window.innerWidth <= 980 ? 22 : 28;
  const horizontalRoom = Math.max(260, scroll.clientWidth - (mobile ? 20 : 42));
  const verticalRoom = Math.max(300, scroll.clientHeight - 30);
  const baseWidth = twoUp ? Math.max(220, (horizontalRoom - gap) / 2) : horizontalRoom;
  const zoom = Math.max(.5, Math.min(2.5, Number(advancedState.zoom || 1)));

  row.style.setProperty('--advanced-pair-gap', `${gap}px`);
  row.style.setProperty('--advanced-page-max-width', `${Math.round(baseWidth * zoom)}px`);
  row.style.setProperty('--advanced-page-max-height', `${Math.round(verticalRoom * zoom)}px`);
  row.dataset.fitMode = twoUp ? 'two-up' : 'single';
}

function scheduleFit() {
  if (fitFrame) cancelAnimationFrame(fitFrame);
  fitFrame = requestAnimationFrame(() => {
    syncEmptyState();
    updateFitVariables();
  });
}

function install() {
  installCss();
  syncEmptyState();
  scheduleFit();
  window.addEventListener('pdf-advanced-state-change', scheduleFit);
  window.addEventListener('resize', scheduleFit);
  document.querySelector('.toolbar-actions')?.addEventListener('click', () => setTimeout(scheduleFit, 0), true);
  document.documentElement.dataset.pdfAdvancedLayoutV3 = 'autofit-empty-gap';
}

install();
