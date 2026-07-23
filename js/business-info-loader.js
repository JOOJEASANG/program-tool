(function () {
  'use strict';
  if (window.ProgramBusinessInfo) return;

  async function load() {
    if (typeof db === 'undefined') throw new Error('Firestore가 준비되지 않았습니다.');
    let snapshot = await db.collection('settings').doc('business').get().catch(() => null);
    if (!snapshot || !snapshot.exists) {
      snapshot = await db.collection('site_settings').doc('business').get().catch(() => null);
    }
    return snapshot && snapshot.exists ? snapshot.data() : {};
  }

  function appendLines(target, values, emptyText) {
    if (!target) return;
    target.replaceChildren();
    if (!values.length) {
      target.textContent = emptyText;
      return;
    }
    values.forEach((value, index) => {
      if (index) target.appendChild(document.createElement('br'));
      target.appendChild(document.createTextNode(value));
    });
  }

  function renderStamp(target, dataUrl) {
    if (!target) return;
    target.replaceChildren();
    if (!dataUrl) return;
    const image = document.createElement('img');
    image.src = dataUrl;
    image.alt = '사업자 직인';
    target.appendChild(image);
  }

  function lines(business, includePrivacyOfficer) {
    const values = [
      business.bizName && `상호: ${business.bizName}`,
      business.bizOwner && `대표자: ${business.bizOwner}`,
      business.bizNumber && `사업자등록번호: ${business.bizNumber}`,
      business.bizMailOrder && `통신판매업 신고번호: ${business.bizMailOrder}`,
      business.bizAddress && `주소: ${business.bizAddress}`,
      business.bizPhone && `전화: ${business.bizPhone}`,
      business.bizEmail && `이메일: ${business.bizEmail}`,
    ];
    if (includePrivacyOfficer) {
      values.push(business.bizPrivacyOfficer && `개인정보 보호책임자: ${business.bizPrivacyOfficer}`);
    }
    return values.filter(Boolean);
  }

  async function render(options = {}) {
    const text = document.getElementById(options.textId || 'bizText');
    try {
      const business = await load();
      appendLines(
        text,
        lines(business, !!options.includePrivacyOfficer),
        options.emptyText || '관리자 페이지에서 사업자 정보를 입력해 주세요.'
      );
      renderStamp(document.getElementById(options.stampId || 'stamp'), business.stampData);
      const effective = document.getElementById(options.effectiveDateId || 'effectiveDate');
      if (effective) effective.textContent = business.bizTermsEffective || options.defaultEffectiveDate || '2026.07.23';
      return business;
    } catch (error) {
      console.error(error);
      if (text) text.textContent = '사업자 정보를 불러오지 못했습니다.';
      return {};
    }
  }

  window.ProgramBusinessInfo = { load, render };
})();
