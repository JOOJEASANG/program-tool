import fs from 'node:fs';
import { after, before, beforeEach, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  deleteObject,
  getBytes,
  ref,
  uploadString,
} from 'firebase/storage';

const projectId = 'demo-program-tool';
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: fs.readFileSync('firestore.rules', 'utf8'),
    },
    storage: {
      rules: fs.readFileSync('storage.rules', 'utf8'),
    },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
});

after(async () => {
  await env.cleanup();
});

async function seedApprovedUser(uid = 'approved-user') {
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(
      doc(context.firestore(), 'user_permissions', uid),
      { status: 'approved' }
    );
    await setDoc(
      doc(context.firestore(), 'cover_templates', 'public-template'),
      { name: '이전 공개 템플릿', isPublic: true }
    );
    await setDoc(
      doc(context.firestore(), 'cover_templates', 'private-template'),
      { name: '이전 비공개 템플릿', isPublic: false }
    );
    await uploadString(
      ref(context.storage(), 'cover_templates/public-template/legacy.png'),
      'legacy-image',
      'raw',
      { contentType: 'image/png' }
    );
  });
}

test('approved users cannot read retired administrator-provided image records', async () => {
  await seedApprovedUser();
  const db = env.authenticatedContext(
    'approved-user',
    { email: 'approved@example.com' }
  ).firestore();

  await assertFails(getDoc(doc(db, 'cover_templates', 'public-template')));
  await assertFails(
    getDocs(query(collection(db, 'cover_templates'), orderBy('name')))
  );
  await assertFails(
    getDocs(query(
      collection(db, 'cover_templates'),
      where('isPublic', '==', true),
      orderBy('name')
    ))
  );
});

test('members cannot create or update retired administrator-provided image records', async () => {
  await seedApprovedUser();
  const db = env.authenticatedContext(
    'approved-user',
    { email: 'approved@example.com' }
  ).firestore();

  await assertFails(
    setDoc(doc(db, 'cover_templates', 'new-template'), { name: '새 제공 이미지', isPublic: true })
  );
  await assertFails(
    updateDoc(doc(db, 'cover_templates', 'public-template'), { name: '변경 시도' })
  );
});

test('administrators can inspect and delete retired records but cannot create replacements', async () => {
  await seedApprovedUser();
  const db = env.authenticatedContext(
    'admin-user',
    { email: 'admin@example.com', admin: true }
  ).firestore();

  await assertSucceeds(getDoc(doc(db, 'cover_templates', 'public-template')));
  await assertFails(
    setDoc(doc(db, 'cover_templates', 'replacement-template'), { name: '새 제공 이미지', isPublic: true })
  );
  await assertSucceeds(deleteDoc(doc(db, 'cover_templates', 'private-template')));
});

test('retired provider storage is not member-readable or writable and remains admin-deletable', async () => {
  await seedApprovedUser();
  const memberStorage = env.authenticatedContext(
    'approved-user',
    { email: 'approved@example.com' }
  ).storage();
  const adminStorage = env.authenticatedContext(
    'admin-user',
    { email: 'admin@example.com', admin: true }
  ).storage();
  const path = 'cover_templates/public-template/legacy.png';

  await assertFails(getBytes(ref(memberStorage, path)));
  await assertFails(
    uploadString(
      ref(memberStorage, 'cover_templates/public-template/member.png'),
      'member-image',
      'raw',
      { contentType: 'image/png' }
    )
  );
  await assertSucceeds(getBytes(ref(adminStorage, path)));
  await assertFails(
    uploadString(
      ref(adminStorage, 'cover_templates/public-template/replacement.png'),
      'admin-image',
      'raw',
      { contentType: 'image/png' }
    )
  );
  await assertSucceeds(deleteObject(ref(adminStorage, path)));
});

test('temporary PDF input is owner-only and bounded to the expected path shape', async () => {
  await seedApprovedUser();
  const ownerStorage = env.authenticatedContext(
    'approved-user',
    { email: 'approved@example.com' }
  ).storage();
  const otherStorage = env.authenticatedContext(
    'other-user',
    { email: 'other@example.com' }
  ).storage();
  const valid = ref(
    ownerStorage,
    'pdf_temp/approved-user/session-1/source.pdf'
  );

  await assertSucceeds(
    uploadString(valid, '%PDF-test', 'raw', { contentType: 'application/pdf' })
  );
  await assertFails(
    uploadString(
      ref(ownerStorage, 'pdf_temp/approved-user/source.pdf'),
      '%PDF-test',
      'raw',
      { contentType: 'application/pdf' }
    )
  );
  await assertFails(
    getBytes(ref(otherStorage, 'pdf_temp/approved-user/session-1/source.pdf'))
  );
});

test('generated results are server-created and owner-readable/deletable only', async () => {
  await seedApprovedUser();
  const path = 'pdf_results/approved-user/result-1/output.pdf';
  await env.withSecurityRulesDisabled(async context => {
    await uploadString(
      ref(context.storage(), path),
      '%PDF-result',
      'raw',
      { contentType: 'application/pdf' }
    );
  });

  const ownerStorage = env.authenticatedContext(
    'approved-user',
    { email: 'approved@example.com' }
  ).storage();
  const otherStorage = env.authenticatedContext(
    'other-user',
    { email: 'other@example.com' }
  ).storage();

  await assertSucceeds(getBytes(ref(ownerStorage, path)));
  await assertFails(getBytes(ref(otherStorage, path)));
  await assertFails(
    uploadString(
      ref(ownerStorage, 'pdf_results/approved-user/result-2/output.pdf'),
      '%PDF-client',
      'raw',
      { contentType: 'application/pdf' }
    )
  );
  await assertSucceeds(deleteObject(ref(ownerStorage, path)));
});
