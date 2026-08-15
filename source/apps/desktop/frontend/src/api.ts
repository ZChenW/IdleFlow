import { invoke } from '@tauri-apps/api/core';

import type { Policy, Snapshot } from './model';

const previewMode = new URLSearchParams(window.location.search).has('preview');

let previewSnapshot: Snapshot = {
  policy: {
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
  },
  status: {
    enabled: false,
    inhibited: false,
    power_source: 'ac',
    managed_swayidle_pid: null,
    external_swayidle_detected: true,
    last_error: null,
  },
};

function previewResult(): Snapshot {
  return structuredClone(previewSnapshot);
}

const previewApi = {
  snapshot: async () => previewResult(),
  save: async (policy: Policy) => {
    previewSnapshot.policy = structuredClone(policy);
    return previewResult();
  },
  takeOver: async () => {
    previewSnapshot.policy.enabled = true;
    previewSnapshot.status = {
      ...previewSnapshot.status,
      enabled: true,
      external_swayidle_detected: false,
      managed_swayidle_pid: 4242,
    };
    return previewResult();
  },
  rollback: async () => {
    previewSnapshot.policy.enabled = false;
    previewSnapshot.status = {
      ...previewSnapshot.status,
      enabled: false,
      inhibited: false,
      external_swayidle_detected: true,
      managed_swayidle_pid: null,
    };
    return previewResult();
  },
  lock: async () => 'preview-lock-requested',
};

const tauriApi = {
  snapshot: () => invoke<Snapshot>('get_snapshot'),
  save: (policy: Policy) => invoke<Snapshot>('save_policy', { policy }),
  takeOver: () => invoke<Snapshot>('take_over'),
  rollback: () => invoke<Snapshot>('rollback'),
  lock: () => invoke<string>('lock_now'),
};

export const api = previewMode ? previewApi : tauriApi;
