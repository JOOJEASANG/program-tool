const assert = require('assert');
require('../../js/program-catalog-core.js');
const core = globalThis.ProgramCatalogCore;

assert(core);
assert.equal(core.stage, 'public-home-program-catalog-model');
const defaults = core.defaultCatalog();
assert.equal(defaults.categories[0].name, 'PDF·인쇄');
assert(defaults.categories[0].programs.some((item) => item.id === 'pdf-editor'));
assert(defaults.categories[0].programs.some((item) => item.id === 'perfect-binding-cover'));

const normalized = core.normalizeCatalog({
  categories: [
    {
      id: 'custom',
      name: '자유 카테고리명',
      visible: true,
      accent: '#ABCDEF',
      programs: [
        { id: 'tool', name: '자유 프로그램명', url: 'javascript:alert(1)', tags: ['1','2','3','4','5','6','7','8','9'], visible: true, status: 'active' },
        { id: 'tool', name: '중복 아이디 프로그램', url: 'https://example.com/tool', visible: false, status: 'coming' }
      ]
    }
  ]
});

assert.equal(normalized.categories[0].name, '자유 카테고리명');
assert.equal(normalized.categories[0].accent, '#abcdef');
assert.equal(normalized.categories[0].programs[0].name, '자유 프로그램명');
assert.equal(normalized.categories[0].programs[0].url, '');
assert.equal(normalized.categories[0].programs[0].tags.length, 8);
assert.notEqual(normalized.categories[0].programs[0].id, normalized.categories[0].programs[1].id);
assert.equal(core.safeUrl('pdf-editor/'), 'pdf-editor/');
assert.equal(core.safeUrl('https://example.com/tool'), 'https://example.com/tool');

const publicOnly = core.publicCatalog(normalized);
assert.equal(publicOnly.categories.length, 1);
assert.equal(publicOnly.categories[0].programs.length, 1);
assert.equal(publicOnly.categories[0].programs[0].name, '자유 프로그램명');

console.log('program catalog behavior passed');
