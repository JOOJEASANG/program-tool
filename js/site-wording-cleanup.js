// Normalize legacy entertainment-oriented wording in static and dynamically loaded UI copy.
(function () {
  'use strict';
  if (window.__programStudioWordingCleanupV1) return;
  window.__programStudioWordingCleanupV1 = true;

  const TARGET = '\uac8c\uc784';
  const PROGRAM = '\ud504\ub85c\uadf8\ub7a8';
  const RULES = [
    [TARGET + ' ' + PROGRAM, PROGRAM],
    ['\ubbf8\ub2c8' + TARGET, '\uac04\ud3b8 \ub3c4\uad6c'],
    ['\uc6f9' + TARGET, '\uc6f9 ' + PROGRAM],
    [TARGET + ' \ud50c\ub7ab\ud3fc', '\uc5c5\ubb34 ' + PROGRAM + ' \ud50c\ub7ab\ud3fc'],
    [TARGET + ' \uc11c\ube44\uc2a4', PROGRAM + ' \uc11c\ube44\uc2a4'],
    [TARGET + ' \ub3c4\uad6c', '\uc5c5\ubb34 \ub3c4\uad6c'],
    [TARGET + ' \uae30\ub2a5', PROGRAM + ' \uae30\ub2a5'],
    [TARGET + ' \ubaa9\ub85d', PROGRAM + ' \ubaa9\ub85d'],
    [TARGET + ' \uad00\ub9ac', PROGRAM + ' \uad00\ub9ac'],
    [TARGET + ' \uc774\uc6a9', PROGRAM + ' \uc774\uc6a9'],
    [TARGET + ' \uc0ac\uc6a9', PROGRAM + ' \uc0ac\uc6a9'],
    [TARGET, PROGRAM],
  ];

  const BLOCKED_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE', 'PRE']);
  const ATTRIBUTES = ['title', 'aria-label', 'placeholder', 'alt'];

  function cleanText(value) {
    let result = String(value == null ? '' : value);
    for (const [from, to] of RULES) result = result.split(from).join(to);
    return result;
  }

  function isBlocked(node) {
    const element = node && (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement);
    return !element || BLOCKED_TAGS.has(element.tagName) || element.isContentEditable;
  }

  function cleanTextNode(node) {
    if (!node || isBlocked(node) || !node.nodeValue || !node.nodeValue.includes(TARGET)) return;
    const next = cleanText(node.nodeValue);
    if (next !== node.nodeValue) node.nodeValue = next;
  }

  function cleanElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE || isBlocked(element)) return;
    for (const name of ATTRIBUTES) {
      const value = element.getAttribute(name);
      if (value && value.includes(TARGET)) element.setAttribute(name, cleanText(value));
    }
    if (element.tagName === 'META' && element.hasAttribute('content')) {
      const value = element.getAttribute('content');
      if (value && value.includes(TARGET)) element.setAttribute('content', cleanText(value));
    }
  }

  function scan(root) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      cleanTextNode(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;

    if (root.nodeType === Node.ELEMENT_NODE) cleanElement(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE) cleanTextNode(node);
      else cleanElement(node);
    }
  }

  function boot() {
    scan(document.documentElement);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') cleanTextNode(mutation.target);
        else if (mutation.type === 'attributes') cleanElement(mutation.target);
        else mutation.addedNodes.forEach(scan);
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRIBUTES.concat('content'),
    });
  }

  window.ProgramWordingCleanup = { cleanText, scan };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
