import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';

import { api } from './api';
import {
  statusLabel,
  type Profile,
  type Snapshot,
} from './model';
import {
  PolicyDraft,
  type PolicyDraftEvent,
  type ProfileInputValues,
  type ProfileKey,
  type StageKey,
} from './policyDraft';

const stages: StageKey[] = ['lock', 'display', 'suspend'];

const stageMeta: Record<StageKey, { label: string; english: string }> = {
  lock: { label: '锁屏', english: 'LOCK' },
  display: { label: '熄屏', english: 'DISPLAY OFF' },
  suspend: { label: '挂起', english: 'SUSPEND' },
};

const profileMeta: Record<ProfileKey, { label: string; english: string }> = {
  battery: { label: '电池', english: 'ON BATTERY' },
  ac: { label: '交流电', english: 'PLUGGED IN' },
};

interface UiMessage {
  text: string;
  kind: 'error' | 'success';
}

function previewNotice(): UiMessage | null {
  const notice = new URLSearchParams(window.location.search).get('notice');
  if (notice === 'success') return { text: '策略已保存。所有权状态没有改变。', kind: 'success' };
  if (notice === 'error') {
    return { text: '操作未完成：无法确认锁屏状态，请检查 QuickShell 或 swaylock。', kind: 'error' };
  }
  return null;
}

function LineIcon({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <svg className={`line-icon ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  );
}

function RefreshIcon() {
  return (
    <LineIcon>
      <path d="M20 7v5h-5M4 17v-5h5" />
      <path d="M6.1 8.5A7 7 0 0 1 18.7 7M17.9 15.5A7 7 0 0 1 5.3 17" />
    </LineIcon>
  );
}

function LockIcon() {
  return (
    <LineIcon>
      <rect x="5" y="10" width="14" height="10" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2" />
    </LineIcon>
  );
}

function DisplayIcon() {
  return (
    <LineIcon>
      <rect x="3" y="4" width="18" height="13" />
      <path d="M8 21h8M12 17v4" />
    </LineIcon>
  );
}

function SleepIcon() {
  return (
    <LineIcon>
      <path d="M18.5 15.5A8 8 0 0 1 8.5 5 8 8 0 1 0 18.5 15.5Z" />
      <path d="M15 5h4l-4 4h4" />
    </LineIcon>
  );
}

function BatteryIcon() {
  return (
    <LineIcon>
      <rect x="3" y="6" width="16" height="12" />
      <path d="M19 10h2v4h-2M6 9v6" />
    </LineIcon>
  );
}

function PlugIcon() {
  return (
    <LineIcon>
      <path d="M8 3v6M16 3v6M6 9h12v2a6 6 0 0 1-12 0V9ZM12 17v4" />
    </LineIcon>
  );
}

function ShieldIcon() {
  return (
    <LineIcon>
      <path d="M12 3 5 6v5c0 4.7 2.8 8 7 10 4.2-2 7-5.3 7-10V6l-7-3Z" />
      <path d="m9 12 2 2 4-5" />
    </LineIcon>
  );
}

function NoticeIcon({ kind }: { kind: 'error' | 'success' }) {
  return kind === 'error' ? (
    <LineIcon>
      <path d="M12 3 3 20h18L12 3Z" />
      <path d="M12 8v6M12 17v.1" />
    </LineIcon>
  ) : (
    <LineIcon>
      <path d="M20 11a8 8 0 1 1-4-6.9" />
      <path d="m8.5 11.5 2.5 2.5 6-7" />
    </LineIcon>
  );
}

function CloseIcon() {
  return (
    <LineIcon>
      <path d="m6 6 12 12M18 6 6 18" />
    </LineIcon>
  );
}

function StageIcon({ stage }: { stage: StageKey }) {
  if (stage === 'lock') return <LockIcon />;
  if (stage === 'display') return <DisplayIcon />;
  return <SleepIcon />;
}

function ProfileIcon({ profileKey }: { profileKey: ProfileKey }) {
  return profileKey === 'battery' ? <BatteryIcon /> : <PlugIcon />;
}

function policyValue(profile: Profile, stage: StageKey): number | null {
  if (stage === 'lock') return profile.lock_after_seconds;
  if (stage === 'display') return profile.display_off_after_seconds;
  return profile.suspend_after_seconds;
}

const sliderBounds: Record<ProfileKey, Record<StageKey, { min: number; max: number; step: number }>> = {
  battery: {
    lock: { min: 1, max: 30, step: 1 },
    display: { min: 1, max: 60, step: 1 },
    suspend: { min: 5, max: 120, step: 1 },
  },
  ac: {
    lock: { min: 1, max: 240, step: 1 },
    display: { min: 1, max: 300, step: 1 },
    suspend: { min: 5, max: 480, step: 1 },
  },
};

function Toggle({ checked, onChange, label, disabled = false }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className="editorial-toggle">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span aria-hidden="true"><i /></span>
      <b aria-hidden="true">{label}</b>
    </label>
  );
}

function TimelineStage({
  profileKey,
  stage,
  profile,
  selected,
  inputValue,
  disabled,
  onSelect,
  onInputValueChange,
  onInputBlur,
  onToggleSuspend,
}: {
  profileKey: ProfileKey;
  stage: StageKey;
  profile: Profile;
  selected: boolean;
  inputValue: string;
  disabled: boolean;
  onSelect: () => void;
  onInputValueChange: (value: string) => void;
  onInputBlur: () => void;
  onToggleSuspend: (enabled: boolean) => void;
}) {
  const value = policyValue(profile, stage);
  const isSuspend = stage === 'suspend';
  const enabled = value !== null;
  const bounds = sliderBounds[profileKey][stage];
  const minutesValue = value === null ? bounds.min : Math.round(value / 60);
  const normalized = Math.min(1, Math.max(0, (minutesValue - bounds.min) / (bounds.max - bounds.min)));
  const nodePosition = 15 + normalized * 70;
  const stageStyle = { '--node-position': `${nodePosition}%` } as CSSProperties;

  return (
    <div className={`route-stage ${selected ? 'selected' : ''} ${!enabled ? 'dormant' : ''}`} style={stageStyle}>
      <button className="stage-name" type="button" onClick={onSelect} aria-pressed={selected}>
        <StageIcon stage={stage} />
        <span>
          <strong>{stageMeta[stage].label}</strong>
          <small>{stageMeta[stage].english}</small>
        </span>
      </button>

      <input
        className="stage-slider"
        type="range"
        min={bounds.min}
        max={bounds.max}
        step={bounds.step}
        disabled={!enabled || disabled}
        value={Math.min(bounds.max, Math.max(bounds.min, minutesValue))}
        aria-label={`${profileMeta[profileKey].label}模式${stageMeta[stage].label}时间`}
        onFocus={onSelect}
        onChange={(event) => onInputValueChange(event.target.value)}
      />
      <i className="stage-connector" aria-hidden="true" />

      <label className="minute-field">
        <span className="sr-only">{stageMeta[stage].label}等待分钟数</span>
        <input
          className="timeline-value"
          type="number"
          min="0"
          disabled={!enabled || disabled}
          value={inputValue}
          onFocus={onSelect}
          onBlur={onInputBlur}
          onChange={(event) => onInputValueChange(event.target.value)}
        />
        <small>{enabled ? 'MIN' : 'OFF'}</small>
      </label>

      {isSuspend && (
        <Toggle
          checked={enabled}
          label={enabled ? '自动挂起开启' : '自动挂起关闭'}
          disabled={disabled}
          onChange={onToggleSuspend}
        />
      )}
    </div>
  );
}

function PolicyTimeline({
  profileKey,
  profile,
  active,
  disabled,
  inputValues,
  selectedStage,
  onActivate,
  onSelectStage,
  onInputValueChange,
  onInputBlur,
  onToggleSuspend,
}: {
  profileKey: ProfileKey;
  profile: Profile;
  active: boolean;
  disabled: boolean;
  inputValues: ProfileInputValues;
  selectedStage: StageKey;
  onActivate: () => void;
  onSelectStage: (stage: StageKey) => void;
  onInputValueChange: (stage: StageKey, value: string) => void;
  onInputBlur: (stage: StageKey) => void;
  onToggleSuspend: (enabled: boolean) => void;
}) {
  const meta = profileMeta[profileKey];

  return (
    <section
      className={`route-row ${profileKey} ${active ? 'active' : ''}`}
      aria-label={`${meta.label}策略`}
      onFocusCapture={onActivate}
    >
      <div className="route-label" aria-hidden="true">
        <ProfileIcon profileKey={profileKey} />
        <strong>{meta.label}</strong>
        <small>{meta.english}</small>
      </div>
      <div className="route-stages">
        {stages.map((stage) => (
          <TimelineStage
            key={stage}
            profileKey={profileKey}
            stage={stage}
            profile={profile}
            selected={active && selectedStage === stage}
            inputValue={inputValues[stage]}
            disabled={disabled}
            onSelect={() => { onActivate(); onSelectStage(stage); }}
            onInputValueChange={(value) => onInputValueChange(stage, value)}
            onInputBlur={() => onInputBlur(stage)}
            onToggleSuspend={onToggleSuspend}
          />
        ))}
      </div>
    </section>
  );
}

function LoadingScreen({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <main className="loading-shell">
      <div className="loading-rule" aria-hidden="true"><i /></div>
      <h1>IDLEFLOW</h1>
      <p>{message ?? '正在读取休眠策略…'}</p>
      {message && <button className="save-button" onClick={onRetry}>重新连接</button>}
    </main>
  );
}

export default function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [policyDraft, setPolicyDraft] = useState<PolicyDraft | null>(null);
  const [profileKey, setProfileKey] = useState<ProfileKey>('battery');
  const [selectedStage, setSelectedStage] = useState<StageKey>('lock');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<UiMessage | null>(() => previewNotice());

  const refresh = useCallback(async (announce = false) => {
    try {
      const next = await api.snapshot();
      setSnapshot(next);
      setPolicyDraft(PolicyDraft.from(next.policy));
      setMessage(announce ? { text: '状态与策略已刷新。', kind: 'success' } : previewNotice());
    } catch (error) {
      setMessage({
        text: `无法连接 idled。请确认用户服务正在运行，然后重试。\n${String(error)}`,
        kind: 'error',
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = useCallback(async (operation: () => Promise<Snapshot>, success: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const next = await operation();
      setSnapshot(next);
      setPolicyDraft(PolicyDraft.from(next.policy));
      setMessage({ text: success, kind: 'success' });
    } catch (error) {
      setMessage({ text: `操作未完成：${String(error)}`, kind: 'error' });
    } finally {
      setBusy(false);
    }
  }, []);

  const testLock = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      await api.lock();
      setMessage({ text: '已请求锁屏。', kind: 'success' });
    } catch (error) {
      setMessage({ text: `操作未完成：${String(error)}`, kind: 'error' });
    } finally {
      setBusy(false);
    }
  }, []);

  if (!snapshot || !policyDraft) {
    return <LoadingScreen message={message?.text ?? null} onRetry={() => void refresh()} />;
  }

  const { policy: draft, inputValues, validation, dirty: hasChanges } = policyDraft.view;

  const { status } = snapshot;
  const notice: UiMessage | null = status.last_error
    ? { text: status.last_error, kind: 'error' }
    : validation
      ? { text: validation, kind: 'error' }
      : message;

  const editPolicy = (event: PolicyDraftEvent) => {
    setPolicyDraft((current) => current?.apply(event) ?? current);
  };

  return (
    <main className={`app-shell ${busy ? 'is-busy' : ''}`}>
      <header className="editorial-header">
        <div className="masthead-row">
          <h1>IDLEFLOW</h1>
          <button className="refresh-button" onClick={() => void refresh(true)} disabled={busy}>
            <RefreshIcon /><span>刷新</span>
          </button>
        </div>
      </header>

      <div className="editorial-grid">
        <section className="policy-sheet">
          <div className="policy-heading">
            <div>
              <h2>策略</h2>
              <p>按顺序设置锁屏、熄屏与挂起的等待时间。</p>
            </div>
            <div className={`change-flag ${hasChanges ? 'changed' : ''}`}>
              <i />{hasChanges ? '未保存' : '已同步'}
            </div>
          </div>

          {!status.enabled && (
            <aside className="notice mode" role="status">
              <ShieldIcon />
              <p>{statusLabel(status)} · 保存不会接管系统</p>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => void run(() => api.takeOver(), 'IdleFlow 正在管理当前策略。')}
              >
                接管当前策略
              </button>
            </aside>
          )}

          {notice && (
            <aside className={`notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'} aria-live="polite">
              <NoticeIcon kind={notice.kind} />
              <p>{notice.text}</p>
              {message && !validation && !status.last_error && (
                <button className="close-button" onClick={() => setMessage(null)} aria-label="关闭消息"><CloseIcon /></button>
              )}
            </aside>
          )}

          <div className="strategy-shell">
            <div className="policy-timelines">
              <PolicyTimeline
                profileKey="battery"
                profile={draft.battery}
                active={profileKey === 'battery'}
                disabled={busy}
                inputValues={inputValues.battery}
                selectedStage={selectedStage}
                onActivate={() => setProfileKey('battery')}
                onSelectStage={setSelectedStage}
                onInputValueChange={(stage, input) => editPolicy({
                  type: 'stage-input', profile: 'battery', stage, input,
                })}
                onInputBlur={(stage) => editPolicy({ type: 'stage-blur', profile: 'battery', stage })}
                onToggleSuspend={(enabled) => editPolicy({
                  type: 'suspend-toggle', profile: 'battery', enabled,
                })}
              />
              <PolicyTimeline
                profileKey="ac"
                profile={draft.ac}
                active={profileKey === 'ac'}
                disabled={busy}
                inputValues={inputValues.ac}
                selectedStage={selectedStage}
                onActivate={() => setProfileKey('ac')}
                onSelectStage={setSelectedStage}
                onInputValueChange={(stage, input) => editPolicy({
                  type: 'stage-input', profile: 'ac', stage, input,
                })}
                onInputBlur={(stage) => editPolicy({ type: 'stage-blur', profile: 'ac', stage })}
                onToggleSuspend={(enabled) => editPolicy({
                  type: 'suspend-toggle', profile: 'ac', enabled,
                })}
              />
            </div>
          </div>

          <footer className="policy-actions">
            <div className="inhibitor-fact">
              <ShieldIcon />
              <span><strong>遵守应用 inhibitor</strong><small>演示、媒体播放和会议可以延后空闲动作</small></span>
              <span className="fixed-state">固定启用</span>
            </div>
            <div className="utility-actions">
              <button className="text-button" disabled={busy} onClick={() => void testLock()}>
                测试锁屏
              </button>
              <button
                className="text-button"
                disabled={busy || !status.enabled}
                onClick={() => void run(() => api.rollback(), '已回退：IdleFlow 不再接管空闲策略。')}
              >
                回退原策略
              </button>
              <button
                className="text-button"
                disabled={busy || !hasChanges}
                onClick={() => editPolicy({ type: 'reset' })}
              >
                重置
              </button>
            </div>
            <div className="save-control">
              <span>保存但不改变所有权</span>
              <button
                className="save-button"
                disabled={busy || validation !== null || !hasChanges}
                onClick={() => void run(() => api.save(draft), '策略已保存。所有权状态没有改变。')}
              >
                保存策略
              </button>
            </div>
          </footer>
        </section>
      </div>
    </main>
  );
}
