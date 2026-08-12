export type PowerSource = 'ac' | 'battery' | 'unknown';

export interface Profile {
  lock_after_seconds: number;
  display_off_after_seconds: number;
  suspend_after_seconds: number | null;
}

export interface Policy {
  enabled: boolean;
  respect_inhibitors: boolean;
  battery: Profile;
  ac: Profile;
}

export interface RuntimeStatus {
  enabled: boolean;
  inhibited: boolean;
  power_source: PowerSource;
  managed_swayidle_pid: number | null;
  external_swayidle_detected: boolean;
  last_error: string | null;
}

export interface Snapshot {
  policy: Policy;
  status: RuntimeStatus;
}

export function statusLabel(status: RuntimeStatus): string {
  if (status.inhibited) return '已临时阻止空闲动作';
  if (status.enabled && status.managed_swayidle_pid !== null) return 'IdleFlow 正在管理';
  if (!status.enabled && status.external_swayidle_detected) {
    return '观察模式 · 检测到现有 swayidle';
  }
  if (status.enabled && status.last_error) return '已启用 · 等待处理冲突';
  return '观察模式';
}

export function validateProfile(profile: Profile): string | null {
  if (profile.lock_after_seconds < 30) return '锁屏时间不能少于 30 秒';
  if (profile.display_off_after_seconds <= profile.lock_after_seconds) {
    return '熄屏时间必须晚于锁屏时间';
  }
  if (
    profile.suspend_after_seconds !== null &&
    profile.suspend_after_seconds <= profile.display_off_after_seconds
  ) {
    return '挂起时间必须晚于熄屏时间';
  }
  return null;
}

export function minutes(seconds: number): number {
  return Math.round(seconds / 60);
}

export function fromMinutes(value: number): number {
  return Math.max(0, Math.round(value)) * 60;
}
