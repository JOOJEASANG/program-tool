import fs from 'node:fs';
import { after, before, beforeEach, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
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
      { name: '공개 템플릿', isPublic: true }
    );
    await setDoc(
      doc(context.firestore(), 'cover_templates', 'private-template'),
      { name: '비공개 템플릿', isPublic: false }
    );
  });
}

test('approved users must constrain cover template queries to public documents', async () => {
  await seedApprovedUser();
  const db = env.authenticatedContext(
    'approved-user',
    { email: 'approved@example.com' }
  ).firestore();

  await assertFails(
    getDocs(query(collection(db, 'cover_templates'), orderBy('name')))
  );
  await assertSucceeds(
    getDocs(query(
      collection(db, 'cover_templates'),
      where('isPublic', '==', true),
      orderBy('name')
    ))
  );
});

test('unapproved users cannot read public cover templates', async () => {
  await seedApprovedUser();
  const db = env.authenticatedContext(
    'pending-user',
    { email: 'pending@example.com' }
  ).firestore();
  await assertFails(
    getDocs(query(
      collection(db, 'cover_templates'),
      where('isPublic', '==', true),
      orderBy('name')
    ))
  );
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
