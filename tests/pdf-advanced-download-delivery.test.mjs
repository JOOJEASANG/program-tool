import test from 'node:test';
import assert from 'node:assert/strict';
import { readDelivery } from '../js/pdf-editor-advanced/api.js';

test('advanced PDF storage result uses its attachment URL without fetching it as a blob', async () => {
  const nativeFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => { fetchCalls += 1; throw new Error('CORS-blocked fetch'); };
  try {
    const signedUrl = 'https://storage.googleapis.com/test-bucket/pdf_results%2Fexport.pdf?X-Goog-Signature=example';
    const response = new Response(JSON.stringify({
      delivery: 'storage',
      filename: 'advanced-edited.pdf',
      storage_path: 'pdf_results/test/export.pdf',
      download_url: signedUrl,
      size_bytes: 1024,
    }), { headers: { 'content-type': 'application/json' } });
    const result = await readDelivery(response);
    assert.equal(result.delivery, 'storage');
    assert.equal(result.download_url, signedUrl);
    assert.equal(result.filename, 'advanced-edited.pdf');
    assert.equal(fetchCalls, 0, 'cross-origin storage result must not be fetched as a blob');
  } finally {
    globalThis.fetch = nativeFetch;
  }
});

test('advanced PDF direct-response compatibility keeps binary downloads', async () => {
  const response = new Response(new Blob(['%PDF-1.4\n%%EOF'], { type: 'application/pdf' }), {
    headers: { 'content-type': 'application/pdf' },
  });
  const result = await readDelivery(response);
  assert.ok(result instanceof Blob);
  assert.ok(result.size > 0);
});

test('advanced PDF rejects unsafe or absent storage result URLs', async () => {
  const unsafe = new Response(JSON.stringify({
    delivery: 'storage',
    download_url: 'javascript:alert(1)',
  }), { headers: { 'content-type': 'application/json' } });
  await assert.rejects(() => readDelivery(unsafe), /안전한 PDF 다운로드 주소/);

  const missing = new Response(JSON.stringify({ delivery: 'storage' }), {
    headers: { 'content-type': 'application/json' },
  });
  await assert.rejects(() => readDelivery(missing), /다운로드 정보가 올바르지/);
});
