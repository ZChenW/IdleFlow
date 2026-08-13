import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { api } from './api';
import {
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

function previewNotice(): string | null {
  const notice = new URLSearchParams(window.location.search).get('notice');
  if (notice === 'success') return '策略已保存。所有权状态没有改变。';
  if (notice === 'error') return '操作未完成：无法确认锁屏状态，请检查 QuickShell 或 swaylock。';
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

function ArrowIcon() {
  return (
    <LineIcon>
      <path d="M4 12h16M15 7l5 5-5 5" />
    </LineIcon>
  );
}

function PauseIcon() {
  return (
    <LineIcon>
      <path d="M8 5v14M16 5v14" />
    </LineIcon>
  );
}

function StageIcon({ stage }: { stage: StageKey }) {
  if (stage === 'lock') return <LockIcon />;
  if (stage === 'display') return <DisplayIcon />;
  return <SleepIcon />;
}

function policyValue(profile: Profile, stage: StageKey): number | null {
  if (stage === 'lock') return profile.lock_after_seconds;
  if (stage === 'display') return profile.display_off_after_seconds;
  return profile.suspend_after_seconds;
}

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
        onChange={(event) => onChange(event.target.checked)}
      />
      <span aria-hidden="true"><i /></span>
      <b>{label}</b>
    </label>
  );
}

function TimelineStage({
  stage,
  profile,
  selected,
  inputValue,
  onSelect,
  onInputValueChange,
  onInputBlur,
  onToggleSuspend,
}: {
  stage: StageKey;
  profile: Profile;
  selected: boolean;
  inputValue: string;
  onSelect: () => void;
  onInputValueChange: (value: string) => void;
  onInputBlur: () => void;
  onToggleSuspend: (enabled: boolean) => void;
}) {
  const value = policyValue(profile, stage);
  const isSuspend = stage === 'suspend';
  const enabled = value !== null;

  return (
    <div className={`route-stage ${selected ? 'selected' : ''} ${!enabled ? 'dormant' : ''}`}>
      <button className="stage-name" type="button" onClick={onSelect} aria-pressed={selected}>
        <span className="stage-index" aria-hidden="true">0{stages.indexOf(stage) + 1}</span>
        <StageIcon stage={stage} />
        <span>
          <strong>{stageMeta[stage].label}</strong>
          <small>{stageMeta[stage].english}</small>
        </span>
      </button>

      <label className="minute-field">
        <span className="sr-only">{stageMeta[stage].label}等待分钟数</span>
        <input
          className="timeline-value"
          type="number"
          min="0"
          disabled={!enabled}
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
  inputValues: ProfileInputValues;
  selectedStage: StageKey;
  onActivate: () => void;
  onSelectStage: (stage: StageKey) => void;
  onInputValueChange: (stage: StageKey, value: string) => void;
  onInputBlur: (stage: StageKey) => void;
  onToggleSuspend: (enabled: boolean) => void;
}) {
  const sourceLabel = profileKey === 'battery' ? '电池' : '交流电';
  const englishLabel = profileKey === 'battery' ? 'ON BATTERY' : 'PLUGGED IN';

  return (
    <section
      className={`route-row ${profileKey} ${active ? 'active' : ''}`}
      aria-label={`${sourceLabel}策略`}
      onFocusCapture={onActivate}
    >
      <button className="route-source" type="button" onClick={onActivate} aria-pressed={active}>
        <span className="source-icon">{profileKey === 'battery' ? <BatteryIcon /> : <PlugIcon />}</span>
        <span><strong>{sourceLabel}</strong><small>{englishLabel}</small></span>
        <i aria-hidden="true" />
      </button>

      <div className="route-stages">
        {stages.map((stage) => (
          <TimelineStage
            key={stage}
            stage={stage}
            profile={profile}
            selected={active && selectedStage === stage}
            inputValue={inputValues[stage]}
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
      {message && <button onClick={onRetry}>重新连接</button>}
    </main>
  );
}

export default function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [policyDraft, setPolicyDraft] = useState<PolicyDraft | null>(null);
  const [profileKey, setProfileKey] = useState<ProfileKey>('battery');
  const [selectedStage, setSelectedStage] = useState<StageKey>('lock');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(() => previewNotice());

  const refresh = useCallback(async (announce = false) => {
    try {
      const next = await api.snapshot();
      setSnapshot(next);
      setPolicyDraft(PolicyDraft.from(next.policy));
      setMessage(announce ? '状态与策略已刷新。' : previewNotice());
    } catch (error) {
      setMessage(`无法连接 idled。请确认用户服务正在运行，然后重试。\n${String(error)}`);
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
      setMessage(success);
    } catch (error) {
      setMessage(`操作未完成：${String(error)}`);
    } finally {
      setBusy(false);
    }
  }, []);

  if (!snapshot || !policyDraft) {
    return <LoadingScreen message={message} onRetry={() => void refresh()} />;
  }

  const { policy: draft, inputValues, validation, dirty: hasChanges } = policyDraft.view;

  const { status } = snapshot;
  const activeSource = status.power_source === 'battery' ? '电池' : status.power_source === 'ac' ? '交流电' : '未知';
  const notice = status.last_error ?? validation ?? message;
  const noticeKind = status.last_error || validation || message?.startsWith('操作未完成') ? 'error' : 'success';

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
        <section className="system-status-strip" aria-labelledby="system-status-heading">
          <div className="status-overview">
            <div className="section-heading">
              <h2 id="system-status-heading">系统状态</h2>
              <span className={`state-mark ${status.enabled ? 'managed' : ''}`} aria-hidden="true" />
            </div>
            <p className="owner-statement">
              {status.enabled ? 'IdleFlow 正在管理' : '原有策略正在运行'}
            </p>
          </div>

          <dl className="status-list">
            <div><dt>模式</dt><dd>{status.enabled ? '已接管' : '观察中'}</dd></div>
            <div><dt>电源</dt><dd>{activeSource}</dd></div>
            <div><dt>阻止器</dt><dd>{status.inhibited ? '临时阻止' : '正常执行'}</dd></div>
            {status.managed_swayidle_pid && <div><dt>进程</dt><dd>{status.managed_swayidle_pid}</dd></div>}
          </dl>

          <div className="status-actions">
            {!status.enabled ? (
              <button
                className="rail-action takeover-button"
                disabled={busy || validation !== null}
                onClick={() => void run(async () => {
                  if (hasChanges) await api.save(draft);
                  return api.takeOver();
                }, '接管完成。当前编辑的策略已保存并开始生效。')}
              >
                <ArrowIcon /><span><strong>接管策略</strong><small>切换所有权</small></span>
              </button>
            ) : (
              <div className="managed-stamp">
                <span className="managed-stamp__icon"><ShieldIcon /></span>
                <span><strong>已接管</strong><small>锁屏保护生效</small></span>
              </div>
            )}

            <button
              className={`rail-action inhibit-button ${status.inhibited ? 'active' : ''}`}
              disabled={busy || !status.enabled}
              title={!status.enabled ? '接管后才能临时阻止空闲动作' : undefined}
              onClick={() => void run(
                () => api.inhibited(!status.inhibited),
                status.inhibited ? '已恢复按时间执行空闲动作。' : '已临时阻止按时间执行的空闲动作。',
              )}
            >
              <PauseIcon />
              <span>{status.inhibited ? '恢复策略' : status.enabled ? '临时阻止' : '接管后可用'}</span>
            </button>

            <button
              className="secondary-button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setMessage(null);
                try {
                  await api.lock();
                  setMessage('锁屏请求已发送。');
                } catch (error) {
                  setMessage(`操作未完成：${String(error)}`);
                } finally {
                  setBusy(false);
                }
              }}
            >
              测试锁屏
            </button>
            {status.enabled && (
              <button
                className="secondary-button rollback-button"
                disabled={busy}
                onClick={() => void run(api.rollback, '已回退。原有桌面休眠策略重新接管。')}
              >
                回退原策略
              </button>
            )}
          </div>
        </section>

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

          {notice && (
            <aside className={`notice ${noticeKind}`} role={noticeKind === 'error' ? 'alert' : 'status'} aria-live="polite">
              <NoticeIcon kind={noticeKind} />
              <p>{notice}</p>
              {message && !validation && (
                <button onClick={() => setMessage(null)} aria-label="关闭消息"><CloseIcon /></button>
              )}
            </aside>
          )}

          <div className="timeline-scale" aria-hidden="true">
            <span>策略 / 分钟</span>
            <div><b>LOCK</b><b>DISPLAY</b><b>SUSPEND</b></div>
          </div>

          <div className="policy-timelines">
            <PolicyTimeline
              profileKey="battery"
              profile={draft.battery}
              active={profileKey === 'battery'}
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

          <footer className="policy-actions">
            <div className="inhibitor-fact">
              <ShieldIcon />
              <span><strong>遵守应用 inhibitor</strong><small>演示、媒体播放和会议可以延后空闲动作</small></span>
              <span className="fixed-state">固定启用</span>
            </div>
            <button
              className="save-button"
              disabled={busy || validation !== null || !hasChanges}
              onClick={() => void run(() => api.save(draft), '策略已保存。所有权状态没有改变。')}
            >
              <span className="save-mark" aria-hidden="true" />
              <span><strong>保存策略</strong><small>保存但不改变所有权</small></span>
            </button>
          </footer>
        </section>
      </div>

      <footer className="app-footer">
        <span>IdleFlow / Policy desk</span>
        <span>锁屏优先 · 可逆接管 · 尊重 inhibitors</span>
      </footer>
    </main>
  );
}
