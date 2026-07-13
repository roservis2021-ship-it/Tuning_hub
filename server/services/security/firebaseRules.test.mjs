import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('Firebase security rules regression', () => {
  it('does not allow generic writes to arbitrary vehicle subcollections', async () => {
    const rules = await readFile(new URL('../../../firebase/firestore.rules', import.meta.url), 'utf8');
    expect(rules).not.toContain('match /{subcollection}/{documentId}');
    expect(rules).toContain("request.resource.data.diff(resource.data).affectedKeys().hasOnly");
    expect(rules).toContain('allow create: if false;');
    expect(rules).toContain("request.resource.data.reviewStatus != 'approved'");
  });

  it('keeps diagnostic media private, bounded and non-overwritable', async () => {
    const rules = await readFile(new URL('../../../firebase/storage.rules', import.meta.url), 'utf8');
    expect(rules).toContain('request.auth.uid == uid');
    expect(rules).toContain("request.resource.contentType == 'audio/webm'");
    expect(rules).not.toContain("request.resource.contentType.matches('audio/.*')");
    expect(rules).toContain('allow update: if false;');
  });
});
