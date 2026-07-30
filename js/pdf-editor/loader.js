// PDF editor module loader.
// Keep the stable July 20 runtime, with selected July 24 core upgrades.
(function () {
  if (window.__pdfEditorModuleLoaderV16) return;
  window.__pdfEditorModuleLoaderV16 = true;

  function installPreviewToolbarLayoutFix() {
    if (!document.getElementById('pdfEditorPreviewToolbarWidthFix')) {
      const style = document.createElement('style');
      style.id = 'pdfEditorPreviewToolbarWidthFix';
      style.textContent = `
        .preview-info {
          min-width: 0 !important;
          overflow: hidden !important;
        }
        #previewInfo {
          flex: 1 1 auto !important;
          min-width: 0 !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }
        #previewPages {
          flex: 0 1 auto !important;
          min-width: 0 !important;
          max-width: 220px !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }
        .preview-zoom {
          min-width: 0 !important;
          max-width: 100% !important;
          flex: 0 0 auto !important;
          overflow: hidden !important;
        }
        #perRowSelect {
          width: 86px !important;
          min-width: 86px !important;
          max-width: 86px !important;
          flex: 0 0 86px !important;
          padding: 2px 22px 2px 7px !important;
        }
        .preview-zoom > * {
          flex-shrink: 0;
        }
        #thumbArea .thumb-wrap[data-sidebar-current="true"] {
          border-color: #2563eb !important;
          box-shadow: 0 0 0 2px rgba(37,99,235,.18);
        }
        #previewScroll .page-preview[data-sidebar-focus="true"] {
          outline: 3px solid #2563eb;
          outline-offset: 3px;
        }
      `;
      document.head.appendChild(style);
    }

    const select = document.getElementById('perRowSelect');
    if (select && !select.getAttribute('aria-label')) {
      select.setAttribute('aria-label', '미리보기 한 줄당 페이지 수');
    }
  }

  let focusedPageId = '';
  let focusClearTimer = null;
  let thumbnailObserver = null;

  function getParsedPageFromWrap(wrap) {
    const id = wrap?.closest('.thumb-item')?.dataset?.id;
    if (!id || typeof parsedPages === 'undefined') return null;
    return parsedPages.find(page => page.id === id) || null;
  }

  function decorateThumbnailWraps() {
    document.querySelectorAll('#thumbArea .thumb-wrap').forEach(wrap => {
      const page = getParsedPageFromWrap(wrap);
      if (!page) return;
      wrap.tabIndex = 0;
      wrap.setAttribute('role', 'button');
      wrap.setAttribute('aria-label', `${wrap.querySelector('.thumb-num')?.textContent || ''}페이지 미리보기로 이동`);
      wrap.title = '클릭: 미리보기 이동 · 마우스 오른쪽 클릭: 페이지 메뉴';
      wrap.style.cursor = 'pointer';
      if (page.id === focusedPageId) wrap.dataset.sidebarCurrent = 'true';
      else delete wrap.dataset.sidebarCurrent;
    });
  }

  function getPreviewLocationForPage(page) {
    if (!page || page.excluded || typeof parsedPages === 'undefined') return null;
    const active = parsedPages.filter(item => !item.excluded);
    let ordered = active;

    try {
      const bookletEnabled = Boolean(document.getElementById('bookletCheck')?.checked)
        && typeof BOOKLET_STRIPS !== 'undefined'
        && typeof nup !== 'undefined'
        && nup in BOOKLET_STRIPS;
      if (bookletEnabled && typeof bookletReorderPreview === 'function') {
        ordered = bookletReorderPreview(active, nup) || active;
      }
    } catch (error) {
      console.warn('[thumbnail] booklet preview order could not be read', error);
    }

    if (typeof groupByNup !== 'function' || typeof getLayout !== 'function') {
      const fallbackIndex = active.indexOf(page);
      return fallbackIndex < 0 ? null : { index: fallbackIndex, total: active.length };
    }

    const outputGroups = [];
    for (const group of groupByNup(ordered)) {
      const layout = getLayout(group.n);
      const perPage = Math.max(1, Number(layout?.cols || 1) * Number(layout?.rows || 1));
      for (let start = 0; start < group.pages.length; start += perPage) {
        outputGroups.push(group.pages.slice(start, start + perPage));
      }
    }

    const index = outputGroups.findIndex(group => group.includes(page));
    return index < 0 ? null : { index, total: outputGroups.length };
  }

  function markFocusedThumbnail(page) {
    focusedPageId = page.id;
    document.querySelectorAll('#thumbArea .thumb-wrap').forEach(wrap => {
      const selected = getParsedPageFromWrap(wrap)?.id === page.id;
      if (selected) wrap.dataset.sidebarCurrent = 'true';
      else delete wrap.dataset.sidebarCurrent;
    });
  }

  function installPreviewCoordinator(attempt = 0) {
    if (window.__pdfEditorPreviewCoordinatorV8) return window.__pdfEditorPreviewCoordinatorV8;
    if (typeof triggerPreview !== 'function') {
      if (attempt < 20) setTimeout(() => installPreviewCoordinator(attempt + 1), 100 + attempt * 25);
      return null;
    }

    const originalTriggerPreview = triggerPreview;
    let delegate = (context, args) => originalTriggerPreview.apply(context, args);
    let inFlight = null;
    let rerenderQueued = false;
    let queuedManual = false;
    let queuedContext = null;
    let queuedArgs = [];

    const request = function coordinatedPreviewRequest(...args) {
      const manual = !!window.__pdfEditorManualPreviewRequest;
      window.__pdfEditorManualPreviewRequest = false;

      if (inFlight) {
        rerenderQueued = true;
        queuedManual = queuedManual || manual;
        queuedContext = this;
        queuedArgs = args;
        return inFlight;
      }

      const initialContext = this;
      const initialArgs = args;
      inFlight = (async () => {
        let nextManual = manual;
        let nextContext = initialContext;
        let nextArgs = initialArgs;
        let result;
        let pendingError = null;

        while (true) {
          rerenderQueued = false;
          pendingError = null;
          try {
            result = await delegate(nextContext, nextArgs, nextManual);
          } catch (error) {
            pendingError = error;
          }

          if (!rerenderQueued) {
            if (pendingError) throw pendingError;
            return result;
          }

          nextManual = queuedManual;
          nextContext = queuedContext;
          nextArgs = queuedArgs;
          queuedManual = false;
          queuedContext = null;
          queuedArgs = [];
        }
      })().finally(() => {
        inFlight = null;
        rerenderQueued = false;
        queuedManual = false;
        queuedContext = null;
        queuedArgs = [];
        window.__pdfEditorManualPreviewRequest = false;
      });
      return inFlight;
    };

    const coordinator = {
      request,
      setDelegate(nextDelegate) {
        if (typeof nextDelegate === 'function') delegate = nextDelegate;
      },
      getOriginal: () => originalTriggerPreview,
      getInFlight: () => inFlight,
      hasQueuedRerender: () => rerenderQueued,
    };
    window.__pdfEditorPreviewCoordinatorV8 = coordinator;
    triggerPreview = request;
    window.triggerPreview = request;
    return coordinator;
  }

  window.__pdfEditorEnsurePreviewCoordinatorV8 = installPreviewCoordinator;

  async function refreshPreviewForNavigation() {
    if (typeof triggerPreview !== 'function') return;
    window.__pdfEditorManualPreviewRequest = true;
    await triggerPreview();
  }

  function showLimitedPreviewNotice(previews) {
    const visibleCount = Math.max(0, previews.length);
    if (typeof showStatus === 'function') {
      showStatus(`초대용량 문서는 앞 ${visibleCount}개 출력면까지만 미리보기로 표시됩니다. 선택한 페이지는 최종 저장에는 정상 반영됩니다.`, 'error');
    }
  }

  async function focusPageInPreview(page) {
    if (!page) return;
    if (page.excluded) {
      if (typeof showStatus === 'function') {
        showStatus('숨김 페이지입니다. 마우스 오른쪽 메뉴에서 숨김 해제를 선택하세요.', 'error');
      }
      return;
    }

    markFocusedThumbnail(page);
    let location = getPreviewLocationForPage(page);
    let previews = [...document.querySelectorAll('#previewScroll .page-preview')];
    let target = location ? previews[location.index] : null;
    const intentionallyLimitedExtreme = Boolean(window.__pdfEditorExtremeMode)
      && previews.length > 0
      && location
      && previews.length < location.total;
    const staleOrdinaryPreview = Boolean(location)
      && previews.length !== location.total
      && !intentionallyLimitedExtreme;
    if (staleOrdinaryPreview) target = null;

    if (!target) {
      if (intentionallyLimitedExtreme && location?.index >= previews.length) {
        showLimitedPreviewNotice(previews);
        return;
      }

      await refreshPreviewForNavigation();
      location = getPreviewLocationForPage(page);
      previews = [...document.querySelectorAll('#previewScroll .page-preview')];
      target = location ? previews[location.index] : null;

      const refreshedLimitedExtreme = Boolean(window.__pdfEditorExtremeMode)
        && previews.length > 0
        && location
        && previews.length < location.total;
      const stillStaleAfterAwait = Boolean(location)
        && previews.length !== location.total
        && !refreshedLimitedExtreme;
      if (stillStaleAfterAwait) {
        await refreshPreviewForNavigation();
        location = getPreviewLocationForPage(page);
        previews = [...document.querySelectorAll('#previewScroll .page-preview')];
        target = location ? previews[location.index] : null;
      }
    }

    if (!target) {
      if (window.__pdfEditorExtremeMode && previews.length > 0) {
        showLimitedPreviewNotice(previews);
      } else if (typeof showStatus === 'function') {
        showStatus('선택한 페이지의 미리보기를 찾지 못했습니다.', 'error');
      }
      return;
    }

    previews.forEach(node => delete node.dataset.sidebarFocus);
    target.dataset.sidebarFocus = 'true';
    target.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
    clearTimeout(focusClearTimer);
    focusClearTimer = setTimeout(() => delete target.dataset.sidebarFocus, 1600);
  }

  function togglePageHiddenFromContextMenu(page) {
    if (!page) return;
    page.excluded = !page.excluded;
    if (page.excluded && focusedPageId === page.id) focusedPageId = '';
    if (typeof renderThumbs === 'function') renderThumbs();
    if (typeof schedulePreview === 'function') schedulePreview(80);
    if (typeof showStatus === 'function') {
      showStatus(page.excluded ? '페이지를 숨겼습니다.' : '페이지 숨김을 해제했습니다.', 'success');
      if (typeof hideStatus === 'function') setTimeout(hideStatus, 1200);
    }
  }

  function repositionContextMenu(menu, event) {
    if (!menu) return;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const menuWidth = menu.offsetWidth;
    const menuHeight = menu.offsetHeight;
    const fallbackLeft = Number.parseFloat(menu.style.left) || 6;
    const fallbackTop = Number.parseFloat(menu.style.top) || 6;
    const anchorX = Number.isFinite(event?.clientX) ? event.clientX : fallbackLeft;
    const anchorY = Number.isFinite(event?.clientY) ? event.clientY : fallbackTop;
    const maxX = Math.max(6, viewportWidth - menuWidth - 6);
    const maxY = Math.max(6, viewportHeight - menuHeight - 6);
    menu.style.left = Math.min(Math.max(6, anchorX), maxX) + 'px';
    menu.style.top = Math.min(Math.max(6, anchorY), maxY) + 'px';
  }

  function addHideActionToContextMenu(page, event) {
    const menu = document.getElementById('thumbCtxMenu');
    const danger = menu?.querySelector('.ctx-item.danger');
    if (!menu || !danger || menu.querySelector('[data-page-hidden-action="true"]')) return;

    const action = document.createElement('div');
    action.className = 'ctx-item';
    action.dataset.pageHiddenAction = 'true';
    action.innerHTML = `<span class="ctx-icon">${page.excluded ? '👁' : '🙈'}</span>${page.excluded ? '페이지 숨김 해제' : '페이지 숨기기'}`;
    action.addEventListener('click', clickEvent => {
      clickEvent.preventDefault();
      clickEvent.stopPropagation();
      menu.classList.remove('open');
      togglePageHiddenFromContextMenu(page);
    });

    const separator = document.createElement('div');
    separator.className = 'ctx-sep';
    menu.insertBefore(action, danger);
    menu.insertBefore(separator, danger);
    repositionContextMenu(menu, event);
  }

  function installThumbnailPageBehavior(attempt = 0) {
    const area = document.getElementById('thumbArea');
    const originalMenu = window._openThumbCtxMenu;

    if (area && area.dataset.sidebarClickNavigation !== 'true') {
      area.dataset.sidebarClickNavigation = 'true';
      area.addEventListener('click', event => {
        const wrap = event.target.closest('.thumb-wrap');
        if (!wrap || !area.contains(wrap)) return;
        const page = getParsedPageFromWrap(wrap);
        if (!page) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        focusPageInPreview(page).catch(error => {
          console.error('[thumbnail] preview navigation failed', error);
          if (typeof showStatus === 'function') showStatus('선택한 페이지로 이동하지 못했습니다.', 'error');
        });
      }, true);
      area.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const wrap = event.target.closest('.thumb-wrap');
        if (!wrap || !area.contains(wrap)) return;
        const page = getParsedPageFromWrap(wrap);
        if (!page) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        focusPageInPreview(page).catch(error => console.error('[thumbnail] keyboard navigation failed', error));
      }, true);
      thumbnailObserver = new MutationObserver(decorateThumbnailWraps);
      thumbnailObserver.observe(area, { childList: true, subtree: true });
      decorateThumbnailWraps();
    }

    if (typeof originalMenu === 'function' && !window.__pdfEditorHiddenContextActionV1) {
      window.__pdfEditorHiddenContextActionV1 = true;
      window._openThumbCtxMenu = function(event, page, index) {
        const result = originalMenu.call(this, event, page, index);
        addHideActionToContextMenu(page, event);
        return result;
      };
    }

    if ((!area || typeof window._openThumbCtxMenu !== 'function') && attempt < 20) {
      setTimeout(() => installThumbnailPageBehavior(attempt + 1), 100 + attempt * 25);
    }
  }

  function bootEditorEnhancements() {
    installPreviewToolbarLayoutFix();
    installPreviewCoordinator(0);
    installThumbnailPageBehavior(0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootEditorEnhancements, { once: true });
  } else {
    bootEditorEnhancements();
  }

  const MODULES = [
    '/js/pdf-editor/font-render-fix.js?v=20260618-1',
    '/js/pdf-editor/upload-fix.js?v=20260724-5',
    '/js/pdf-editor/live-preview.js?v=20260724-4',
    '/js/pdf-editor/layout-export.js?v=20260724-5',
    '/js/pdf-editor/page-count-hint.js?v=20260724-2',
    '/js/pdf-editor/nup-helper.js?v=20260724-2',
    '/js/pdf-editor/preview-row-default.js?v=20260602-1',
    '/js/pdf-editor/divider-helper.js?v=20260724-2-safe1'
  ];

  function loadScript(src) {
    const clean = src.split('?')[0];
    if ([...document.scripts].some(script => script.src && script.src.includes(clean))) return;
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    document.head.appendChild(script);
  }

  MODULES.forEach(loadScript);
})();
