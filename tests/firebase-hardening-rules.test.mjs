import assert from 'node:assert/strict';
import fs from 'node:fs';
import { after, before, beforeEach, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadString } from 'firebase/storage';

const projectId = 'demo-program-tool';
const storageRules = fs.readFileSync('storage.rules', 'utf8');
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8') },
    storage: { rules: storageRules },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
});

after(async () => {
  await env.cleanup();
});

async function approve(uid) {
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'user_permissions', uid), { status: 'approved' });
  });
}

function sessionMetadata(overrides = {}) {
  return {
    name: '비용 방어 테스트',
    sessionId: 'session_ab12',
    storagePaths: ['pdf_sessions/cost-owner/session_ab12/src_0.pdf'],
    fileCount: 1,
    pageCount: 1,
    totalBytes: 1024,
    state: JSON.stringify({ pages: [{ pageType: 'pdf', file_index: 0, page_index: 0 }] }),
    createdAt: new Date('2026-08-31T05:00:00Z'),
    ...overrides,
  };
}

test('storage rules keep the 200 MiB single-object ceiling and explicit default deny', () => {
  assert.match(storageRules, /validPdfUpload\(209715200\)/);
  assert.match(storageRules, /match \/\{allPaths=\*\*\}/);
  assert.match(storageRules, /allow read, write: if false/);
});

test('temporary staging cannot be overwritten after the first upload', async () => {
  await approve('cost-owner');
  const storage = env.authenticatedContext('cost-owner', { email: 'owner@example.com' }).storage();
  const target = ref(storage, 'pdf_temp/cost-owner/session_ab12/source.pdf');

  await assertSucceeds(uploadString(target, '%PDF-first', 'raw', { contentType: 'application/pdf' }));
  await assertFails(uploadString(target, '%PDF-second', 'raw', { contentType: 'application/pdf' }));
});

test('saved PDF session objects require owner and session metadata', async () => {
  await approve('cost-owner');
  const storage = env.authenticatedContext('cost-owner', { email: 'owner@example.com' }).storage();
  const target = ref(storage, 'pdf_sessions/cost-owner/session_ab12/src_0.pdf');

  await assertFails(uploadString(target, '%PDF-no-meta', 'raw', { contentType: 'application/pdf' }));
  await assertSucceeds(uploadString(target, '%PDF-with-meta', 'raw', {
    contentType: 'application/pdf',
    customMetadata: {
      ownerUid: 'cost-owner',
      purpose: 'pdf-session-source',
      sessionId: 'session_ab12',
    },
  }));
});

test('PDF session Firestore snapshots are schema and 300 MiB bounded and immutable', async () => {
  await approve('cost-owner');
  const db = env.authenticatedContext('cost-owner', { email: 'owner@example.com' }).firestore();
  const target = doc(db, 'users/cost-owner/pdf_sessions/snapshot-one');

  await assertSucceeds(setDoc(target, sessionMetadata()));
  await assertFails(updateDoc(target, { name: '덮어쓰기 시도' }));
  await assertFails(setDoc(doc(db, 'users/cost-owner/pdf_sessions/too-large'), sessionMetadata({
    totalBytes: 314572801,
  })));
  await assertFails(setDoc(doc(db, 'users/cost-owner/pdf_sessions/extra-field'), {
    ...sessionMetadata(),
    unexpected: true,
  }));
});

test('design project metadata cannot point at another user or project path', async () => {
  await approve('design-owner');
  const db = env.authenticatedContext('design-owner', { email: 'owner@example.com' }).firestore();
  const createdAt = new Date('2026-08-31T05:00:00Z');
  const base = {
    id: 'design_alpha',
    name: '인쇄물',
    presetId: 'poster-a4',
    width: 210,
    height: 297,
    storagePath: 'design_projects/design-owner/design_alpha/rev_one.design.json',
    size: 1024,
    createdAt,
    updatedAt: createdAt,
  };

  await assertSucceeds(setDoc(doc(db, 'users/design-owner/design_projects/design_alpha'), base));
  await assertFails(setDoc(doc(db, 'users/design-owner/design_projects/design_beta'), {
    ...base,
    id: 'design_beta',
    storagePath: 'design_projects/other-owner/design_beta/rev_one.design.json',
  }));
  await assertFails(setDoc(doc(db, 'users/design-owner/design_projects/design_gamma'), {
    ...base,
    id: 'design_gamma',
    storagePath: 'design_projects/design-owner/design_alpha/rev_two.design.json',
  }));
});

test('design project Storage revisions are immutable', async () => {
  await approve('design-owner');
  const storage = env.authenticatedContext('design-owner', { email: 'owner@example.com' }).storage();
  const target = ref(storage, 'design_projects/design-owner/design_alpha/rev_one.design.json');
  const metadata = {
    contentType: 'application/json',
    customMetadata: {
      ownerUid: 'design-owner',
      format: 'program-studio-design-project',
    },
  };

  await assertSucceeds(uploadString(target, '{"version":1}', 'raw', metadata));
  await assertFails(uploadString(target, '{"version":2}', 'raw', metadata));
});
