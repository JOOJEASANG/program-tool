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

async function seedPermission(uid, status = 'approved') {
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(
      doc(context.firestore(), 'user_permissions', uid),
      { status }
    );
  });
}

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

test('temporary PDF input is owner-only, approved-only and bounded to the expected path shape', async () => {
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
  const validPreflight = ref(
    ownerStorage,
    'preflight_temp/approved-user/session-1/source.pdf'
  );

  await assertSucceeds(
    uploadString(valid, '%PDF-test', 'raw', { contentType: 'application/pdf' })
  );
  await assertSucceeds(
    uploadString(validPreflight, '%PDF-test', 'raw', { contentType: 'application/pdf' })
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

test('pending users cannot stage or read PDF work before administrator approval', async () => {
  await seedPermission('pending-user', 'pending');
  await env.withSecurityRulesDisabled(async context => {
    await uploadString(
      ref(context.storage(), 'pdf_temp/pending-user/session-1/existing.pdf'),
      '%PDF-existing',
      'raw',
      { contentType: 'application/pdf' }
    );
  });
  const pendingStorage = env.authenticatedContext(
    'pending-user',
    { email: 'pending@example.com' }
  ).storage();

  await assertFails(
    uploadString(
      ref(pendingStorage, 'pdf_temp/pending-user/session-1/source.pdf'),
      '%PDF-test',
      'raw',
      { contentType: 'application/pdf' }
    )
  );
  await assertFails(
    uploadString(
      ref(pendingStorage, 'preflight_temp/pending-user/session-1/source.pdf'),
      '%PDF-test',
      'raw',
      { contentType: 'application/pdf' }
    )
  );
  await assertFails(
    getBytes(ref(pendingStorage, 'pdf_temp/pending-user/session-1/existing.pdf'))
  );
  await assertSucceeds(
    deleteObject(ref(pendingStorage, 'pdf_temp/pending-user/session-1/existing.pdf'))
  );
});

test('public PDF catalog flags cannot bypass administrator approval', async () => {
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(
      doc(context.firestore(), 'settings', 'programs'),
      { public: { 'pdf-editor': true, preflight: true } }
    );
    await setDoc(
      doc(context.firestore(), 'user_permissions', 'public-user'),
      { status: 'pending' }
    );
  });
  const publicStorage = env.authenticatedContext(
    'public-user',
    { email: 'public@example.com' }
  ).storage();

  await assertFails(
    uploadString(
      ref(publicStorage, 'pdf_temp/public-user/session-1/source.pdf'),
      '%PDF-test',
      'raw',
      { contentType: 'application/pdf' }
    )
  );
  await assertFails(
    uploadString(
      ref(publicStorage, 'preflight_temp/public-user/session-1/source.pdf'),
      '%PDF-test',
      'raw',
      { contentType: 'application/pdf' }
    )
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

test('professional program suite is public-readable and admin-writable only', async () => {
  const suitePath = 'settings/professional_program_suite';
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), suitePath), {
      version: 1,
      programs: [{ id: 'design-editor', name: '디자인 편집기' }],
    });
  });

  const publicDb = env.unauthenticatedContext().firestore();
  const memberDb = env.authenticatedContext(
    'approved-user',
    { email: 'approved@example.com' }
  ).firestore();
  const adminDb = env.authenticatedContext(
    'admin-user',
    { email: 'admin@example.com', admin: true }
  ).firestore();

  await assertSucceeds(getDoc(doc(publicDb, suitePath)));
  await assertFails(updateDoc(doc(memberDb, suitePath), { version: 2 }));
  await assertSucceeds(updateDoc(doc(adminDb, suitePath), { version: 2 }));
});

test('cloud design metadata is owner-only, approved-only and schema bounded', async () => {
  await seedPermission('design-owner', 'approved');
  const ownerDb = env.authenticatedContext('design-owner', { email: 'owner@example.com' }).firestore();
  const otherDb = env.authenticatedContext('other-user', { email: 'other@example.com' }).firestore();
  const refPath = 'users/design-owner/design_projects/design_alpha';
  const createdAt = new Date('2026-08-22T14:00:00Z');
  const metadata = {
    id: 'design_alpha',
    name: '행사 포스터',
    presetId: 'poster-a3',
    width: 297,
    height: 420,
    storagePath: 'design_projects/design-owner/design_alpha/rev_one.design.json',
    size: 2048,
    createdAt,
    updatedAt: createdAt,
  };

  await assertSucceeds(setDoc(doc(ownerDb, refPath), metadata));
  await assertSucceeds(getDoc(doc(ownerDb, refPath)));
  await assertFails(getDoc(doc(otherDb, refPath)));
  await assertFails(setDoc(doc(otherDb, 'users/design-owner/design_projects/design_hijack'), {
    ...metadata,
    id: 'design_hijack',
    storagePath: 'design_projects/design-owner/design_hijack/rev_one.design.json',
  }));
  await assertFails(updateDoc(doc(ownerDb, refPath), { createdAt: new Date('2026-08-23T00:00:00Z') }));
  await assertFails(setDoc(doc(ownerDb, 'users/design-owner/design_projects/design_extra'), {
    ...metadata,
    id: 'design_extra',
    storagePath: 'design_projects/design-owner/design_extra/rev_one.design.json',
    unexpected: true,
  }));
  await assertSucceeds(updateDoc(doc(ownerDb, refPath), { name: '수정 포스터', updatedAt: new Date('2026-08-22T15:00:00Z') }));
  await assertSucceeds(deleteDoc(doc(ownerDb, refPath)));
});

test('pending design owners cannot read or save cloud projects', async () => {
  await seedPermission('pending-design-owner', 'pending');
  const refPath = 'users/pending-design-owner/design_projects/design_alpha';
  const createdAt = new Date('2026-08-22T14:00:00Z');
  const metadata = {
    id: 'design_alpha',
    name: '행사 포스터',
    presetId: 'poster-a3',
    width: 297,
    height: 420,
    storagePath: 'design_projects/pending-design-owner/design_alpha/rev_one.design.json',
    size: 2048,
    createdAt,
    updatedAt: createdAt,
  };
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), refPath), metadata);
    await uploadString(
      ref(context.storage(), metadata.storagePath),
      '{"format":"program-studio-design-project"}',
      'raw',
      {
        contentType: 'application/json',
        customMetadata: {
          ownerUid: 'pending-design-owner',
          format: 'program-studio-design-project',
        },
      }
    );
  });

  const db = env.authenticatedContext('pending-design-owner', { email: 'pending@example.com' }).firestore();
  const storage = env.authenticatedContext('pending-design-owner', { email: 'pending@example.com' }).storage();

  await assertFails(getDoc(doc(db, refPath)));
  await assertFails(setDoc(doc(db, 'users/pending-design-owner/design_projects/design_beta'), {
    ...metadata,
    id: 'design_beta',
    storagePath: 'design_projects/pending-design-owner/design_beta/rev_one.design.json',
  }));
  await assertFails(getBytes(ref(storage, metadata.storagePath)));
  await assertFails(uploadString(
    ref(storage, 'design_projects/pending-design-owner/design_alpha/rev_two.design.json'),
    '{}',
    'raw',
    {
      contentType: 'application/json',
      customMetadata: {
        ownerUid: 'pending-design-owner',
        format: 'program-studio-design-project',
      },
    }
  ));
  await assertSucceeds(deleteDoc(doc(db, refPath)));
  await assertSucceeds(deleteObject(ref(storage, metadata.storagePath)));
});

test('cloud design storage is owner-only, approved-only and validates json metadata', async () => {
  await seedPermission('design-owner', 'approved');
  const ownerStorage = env.authenticatedContext('design-owner', { email: 'owner@example.com' }).storage();
  const otherStorage = env.authenticatedContext('other-user', { email: 'other@example.com' }).storage();
  // Use a distinct project/revision path from the immutability regression suite.
  // This test covers authorization and metadata validation, while the hardening
  // suite separately verifies that an existing revision cannot be overwritten.
  const path = 'design_projects/design-owner/design_rules/rev_access.design.json';
  const validMetadata = {
    contentType: 'application/json',
    customMetadata: {
      ownerUid: 'design-owner',
      format: 'program-studio-design-project',
    },
  };

  await assertSucceeds(uploadString(ref(ownerStorage, path), '{"format":"program-studio-design-project"}', 'raw', validMetadata));
  await assertSucceeds(getBytes(ref(ownerStorage, path)));
  await assertFails(getBytes(ref(otherStorage, path)));
  await assertFails(uploadString(
    ref(otherStorage, 'design_projects/design-owner/design_rules/rev_other.design.json'),
    '{}',
    'raw',
    validMetadata
  ));
  await assertFails(uploadString(
    ref(ownerStorage, 'design_projects/design-owner/design_rules/rev_bad.design.json'),
    '{}',
    'raw',
    { contentType: 'text/plain', customMetadata: { ownerUid: 'design-owner', format: 'program-studio-design-project' } }
  ));
  await assertFails(uploadString(
    ref(ownerStorage, 'design_projects/design-owner/design_rules/rev_missing.design.json'),
    '{}',
    'raw',
    { contentType: 'application/json' }
  ));
  await assertSucceeds(deleteObject(ref(ownerStorage, path)));
});