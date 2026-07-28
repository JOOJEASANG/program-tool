#!/usr/bin/env python3
"""One-time source migration from the legacy PDF permission bridge to ProgramAccess."""
from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: Path, old: str, new: str) -> None:
    source = path.read_text(encoding="utf-8")
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"Expected exactly one match in {path}, found {count}")
    path.write_text(source.replace(old, new, 1), encoding="utf-8")


def migrate_firebase_config() -> None:
    path = ROOT / "js" / "firebase-config.js"
    legacy_bridge = """// Temporary bridge for the legacy PDF editor's inline permission check.
// It is scoped to that page and avoids mutating Firebase SDK prototypes.
(() => {
  const isPdfEditor = /\\/(?:tools\\/pdf-editor\\.html|pdf-editor(?:\\/index\\.html)?)\\/?$/.test(location.pathname);
  if (!isPdfEditor || db.__programStudioLegacyPdfEditorBridge) return;

  const originalCollection = db.collection.bind(db);
  Object.defineProperty(db, '__programStudioLegacyPdfEditorBridge', { value: true });

  db.collection = function(collectionName) {
    const collection = originalCollection(collectionName);
    if (!['settings', 'user_permissions'].includes(collectionName)) return collection;

    const originalDocument = collection.doc.bind(collection);
    collection.doc = function(documentId) {
      const reference = originalDocument(documentId);
      const originalGet = reference.get.bind(reference);
      reference.get = async function(...args) {
        try {
          const snapshot = await originalGet(...args);
          if (collectionName !== 'user_permissions' || !snapshot.exists) return snapshot;
          const data = snapshot.data();
          if (!data || data.status !== 'approved') return snapshot;
          return {
            exists: true,
            id: snapshot.id,
            ref: snapshot.ref,
            data: () => ({
              ...data,
              programs: {
                ...(data.programs || {}),
                'pdf-editor': true,
                preflight: true,
                'design-studio': true
              }
            })
          };
        } catch (error) {
          const optionalSettingsRead = collectionName === 'settings'
            && ['admin', 'programs'].includes(documentId);
          const code = String(error?.code || '').toLowerCase();
          if (optionalSettingsRead && (code.includes('permission-denied') || code.includes('permission_denied'))) {
            return { exists: false, id: documentId, ref: reference, data: () => undefined };
          }
          throw error;
        }
      };
      return reference;
    };
    return collection;
  };
})();

"""
    replace_once(path, legacy_bridge, "")

    old_bootstrap = """(() => {
  const programId = ProgramAccess.programForPath(location.pathname);
  if (auth && programId) {
    const root = document.documentElement;
    root.style.visibility = 'hidden';
    root.dataset.accessChecking = 'true';
    const watchdog = setTimeout(() => {
      root.style.visibility = '';
      root.dataset.accessWatchdog = 'released';
    }, 8500);
    ProgramAccess.guardTool({ programId, timeoutMs: 8000 }).finally(() => {
      clearTimeout(watchdog);
      root.style.visibility = '';
      delete root.dataset.accessChecking;
    });
  }
})();
"""
    new_bootstrap = """window.ProgramAccessReady = Promise.resolve(null);

(() => {
  const programId = ProgramAccess.programForPath(location.pathname);
  if (!auth || !programId) return;

  const root = document.documentElement;
  root.style.visibility = 'hidden';
  root.dataset.accessChecking = 'true';
  const watchdog = setTimeout(() => {
    root.style.visibility = '';
    root.dataset.accessWatchdog = 'released';
  }, 8500);
  const accessPromise = ProgramAccess.guardTool({ programId, timeoutMs: 8000 });
  window.ProgramAccessReady = accessPromise;
  accessPromise.finally(() => {
    clearTimeout(watchdog);
    root.style.visibility = '';
    delete root.dataset.accessChecking;
  });
})();
"""
    replace_once(path, old_bootstrap, new_bootstrap)


def migrate_pdf_editor() -> None:
    path = ROOT / "pdf-editor" / "index.html"
    legacy_auth = """auth.onAuthStateChanged(async user => {
  if (!user) { location.href = '../login.html'; return; }
  document.getElementById('navUserName').textContent = user.displayName || user.email.split('@')[0];

  try {
    const userEmail = String(user.email || '').trim().toLowerCase();
    const [adminDoc, programsDoc, permDoc] = await Promise.all([
      db.collection('settings').doc('admin').get(),
      db.collection('settings').doc('programs').get(),
      db.collection('user_permissions').doc(user.uid).get(),
    ]);
    const adminEmails = (adminDoc.exists ? (adminDoc.data().emails || []) : [])
      .map(e => String(e).trim().toLowerCase());
    const isAdmin = adminEmails.includes(userEmail);
    const isPublic = !!(programsDoc.exists && programsDoc.data().public?.['pdf-editor']);
    const isApproved = permDoc.exists && permDoc.data().programs?.['pdf-editor'] === true;

    if (!isAdmin && !isPublic && !isApproved) {
      denyPdfAccess('PDF 편집기는 관리자 승인 후 사용할 수 있습니다.');
      return;
    }
  } catch(e) {
    console.error('Permission check failed', e);
    denyPdfAccess('권한 확인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    return;
  }

  document.getElementById('authLoading').style.display = 'none';
  document.getElementById('navSessionBtn').style.display = 'flex';
  document.getElementById('navSessionLoadBtn').style.display = 'flex';
});
"""
    shared_auth = """async function initializePdfEditorAccess() {
  try {
    const access = await window.ProgramAccessReady;
    const user = auth.currentUser;
    if (!access || !user) return;

    document.getElementById('navUserName').textContent =
      user.displayName || String(user.email || '').split('@')[0];
    document.getElementById('authLoading').style.display = 'none';
    document.getElementById('navSessionBtn').style.display = 'flex';
    document.getElementById('navSessionLoadBtn').style.display = 'flex';
  } catch (error) {
    console.error('Shared permission check failed', error);
    denyPdfAccess('권한 확인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
  }
}
initializePdfEditorAccess();
"""
    replace_once(path, legacy_auth, shared_auth)


def main() -> None:
    migrate_firebase_config()
    migrate_pdf_editor()
    print("ProgramAccess source migration completed.")


if __name__ == "__main__":
    main()
