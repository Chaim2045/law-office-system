/**
 * claim-writer.test.js — Pre-H.0.0.F read-merge-write primitives (legacy-js project)
 *
 * Proves the canonical claim-edit helpers preserve non-role fields (the §7.5
 * no-clobber prerequisite carried from E) and edit ONLY the `role` key.
 */
'use strict';

const { mergeRoleClaim, removeRoleClaim } = require('../shared/claim-writer');

describe('claim-writer.mergeRoleClaim', () => {
  it('sets role on empty/undefined/null claims', () => {
    expect(mergeRoleClaim(undefined, 'admin')).toEqual({ role: 'admin' });
    expect(mergeRoleClaim(null, 'partner')).toEqual({ role: 'partner' });
    expect(mergeRoleClaim({}, 'admin')).toEqual({ role: 'admin' });
  });

  it('overwrites an existing role (drift correction)', () => {
    expect(mergeRoleClaim({ role: 'admin' }, 'partner')).toEqual({ role: 'partner' });
  });

  it('PRESERVES other claim fields while setting role (no-clobber)', () => {
    expect(mergeRoleClaim({ role: 'admin', oldUsername: 'legacy' }, 'partner'))
      .toEqual({ role: 'partner', oldUsername: 'legacy' });
    expect(mergeRoleClaim({ oldUsername: 'x' }, 'admin'))
      .toEqual({ oldUsername: 'x', role: 'admin' });
  });

  it('does not mutate the input object', () => {
    const input = { role: 'admin', oldUsername: 'x' };
    mergeRoleClaim(input, 'partner');
    expect(input).toEqual({ role: 'admin', oldUsername: 'x' });
  });

  it('rejects an empty / non-string role', () => {
    expect(() => mergeRoleClaim({}, '')).toThrow();
    expect(() => mergeRoleClaim({}, undefined)).toThrow();
  });
});

describe('claim-writer.removeRoleClaim', () => {
  it('drops ONLY the role key, preserving other fields (no-clobber revoke)', () => {
    expect(removeRoleClaim({ role: 'admin', oldUsername: 'legacy' }))
      .toEqual({ oldUsername: 'legacy' });
  });

  it('returns an empty object when role was the only field', () => {
    expect(removeRoleClaim({ role: 'lawyer' })).toEqual({});
  });

  it('is a no-op shape when there is no role', () => {
    expect(removeRoleClaim({ oldUsername: 'x' })).toEqual({ oldUsername: 'x' });
    expect(removeRoleClaim({})).toEqual({});
    expect(removeRoleClaim(undefined)).toEqual({});
    expect(removeRoleClaim(null)).toEqual({});
  });

  it('does not mutate the input object', () => {
    const input = { role: 'admin', oldUsername: 'x' };
    removeRoleClaim(input);
    expect(input).toEqual({ role: 'admin', oldUsername: 'x' });
  });
});
