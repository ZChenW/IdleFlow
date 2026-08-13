import assert from 'node:assert/strict';
import test from 'node:test';

import type { Policy } from './model.ts';
import { PolicyDraft } from './policyDraft.ts';

function policy(): Policy {
  return {
    enabled: false,
    respect_inhibitors: true,
    battery: {
      lock_after_seconds: 10 * 60,
      display_off_after_seconds: 15 * 60,
      suspend_after_seconds: 30 * 60,
    },
    ac: {
      lock_after_seconds: 15 * 60,
      display_off_after_seconds: 30 * 60,
      suspend_after_seconds: 120 * 60,
    },
  };
}

test('unfinished input stays in the Policy Draft until it becomes valid', () => {
  let draft = PolicyDraft.from(policy());
  draft = draft.apply({ type: 'stage-input', profile: 'battery', stage: 'lock', input: '' });
  assert.equal(draft.view.inputValues.battery.lock, '');
  assert.equal(draft.view.policy.battery.lock_after_seconds, 10 * 60);
  assert.equal(draft.view.dirty, false);

  draft = draft.apply({ type: 'stage-input', profile: 'battery', stage: 'lock', input: '240' });
  assert.equal(draft.view.policy.battery.lock_after_seconds, 240 * 60);
  assert.equal(draft.view.dirty, true);
  assert.equal(draft.view.validation, '熄屏时间必须晚于锁屏时间');
});

test('zero remains visible and blur restores unfinished input from the canonical value', () => {
  let draft = PolicyDraft.from(policy());
  draft = draft.apply({ type: 'stage-input', profile: 'battery', stage: 'lock', input: '0' });
  assert.equal(draft.view.inputValues.battery.lock, '0');
  assert.equal(draft.view.policy.battery.lock_after_seconds, 0);
  assert.equal(draft.view.validation, '锁屏时间不能少于 30 秒');

  draft = draft.apply({ type: 'stage-input', profile: 'battery', stage: 'lock', input: '' });
  draft = draft.apply({ type: 'stage-blur', profile: 'battery', stage: 'lock' });
  assert.equal(draft.view.inputValues.battery.lock, '0');
});

test('suspend toggling owns null and fallback timing semantics', () => {
  let draft = PolicyDraft.from(policy());
  draft = draft.apply({ type: 'suspend-toggle', profile: 'battery', enabled: false });
  assert.equal(draft.view.policy.battery.suspend_after_seconds, null);
  assert.equal(draft.view.inputValues.battery.suspend, '');

  draft = draft.apply({ type: 'suspend-toggle', profile: 'battery', enabled: true });
  assert.equal(draft.view.policy.battery.suspend_after_seconds, 30 * 60);
  assert.equal(draft.view.inputValues.battery.suspend, '30');
});

test('a new Policy Draft replaces both saved and editable state', () => {
  let draft = PolicyDraft.from(policy());
  draft = draft.apply({ type: 'stage-input', profile: 'ac', stage: 'display', input: '45' });
  assert.equal(draft.view.dirty, true);

  const saved = draft.view.policy;
  const replacement = PolicyDraft.from(saved);
  assert.equal(replacement.view.inputValues.ac.display, '45');
  assert.equal(replacement.view.dirty, false);
});
