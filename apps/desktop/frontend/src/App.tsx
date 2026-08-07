import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api } from './api';
import {
  fromMinutes,
  minutes,
  statusLabel,
  validateProfile,
  type Policy,
  type Profile,
  type Snapshot,
} from './model';

type ProfileKey = 'battery' | 'ac';
type StageKey = 'lock' | 'display' | 'suspend';

function previewNotice(): string | null {
  const notice = new URLSearchParams(window.location.search).get('notice');
  if (notice === 'success') return '策略已保存。所有权状态没有改变。';
  if (notice === 'error') return '操作未完成：无法确认锁屏状态，请检查 QuickShell 或 swaylock。';
  return null;
}

const stageMeta: Record<StageKey, { label: string; short: string }> = {
  lock: { label: '锁屏', short: '锁' },
  display: { label: '熄屏', short: '屏' },
  suspend: { label: '挂起', short: '眠' },
};

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
      <path d="M20 7v5h-5" /><path d="M4 17v-5h5" />
      <path d="M6.1 8.5A7 7 0 0 1 18.7 7M17.9 15.5A7 7 0 0 1 5.3 17" />
    </LineIcon>
  );
}

function LockIcon() {
  return <LineIcon><rect x="5" y="10" width="14" height="10" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2" /></LineIcon>;
}

function DisplayIcon() {
  return <LineIcon><rect x="3" y="4" width="18" height="13" /><path d="M8 21h8M12 17v4" /></LineIcon>;
}

function SleepIcon() {
  return <LineIcon><path d="M18.5 15.5A8 8 0 0 1 8.5 5 8 8 0 1 0 18.5 15.5Z" /><path d="M15 5h4l-4 4h4" /></LineIcon>;
}

function BatteryIcon() {
  return <LineIcon><rect x="3" y="6" width="16" height="12" /><path d="M19 10h2v4h-2M6 9v6" /></LineIcon>;
}

function PlugIcon() {
  return <LineIcon><path d="M8 3v6M16 3v6M6 9h12v2a6 6 0 0 1-12 0V9ZM12 17v4" /></LineIcon>;
}

function ShieldIcon() {
  return <LineIcon><path d="M12 3 5 6v5c0 4.7 2.8 8 7 10 4.2-2 7-5.3 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-5" /></LineIcon>;
}

function NoticeIcon({ kind }: { kind: 'error' | 'success' }) {
  return kind === 'error' ? (
    <LineIcon><path d="M12 3 3 20h18L12 3Z" /><path d="M12 8v6M12 17v.1" /></LineIcon>
  ) : (
    <LineIcon><path d="M20 11a8 8 0 1 1-4-6.9" /><path d="m8.5 11.5 2.5 2.5 6-7" /></LineIcon>
  );
}

function CloseIcon() {
  return <LineIcon><path d="m6 6 12 12M18 6 6 18" /></LineIcon>;
}

function ArrowIcon() {
  return <LineIcon><path d="M4 12h16M15 7l5 5-5 5" /></LineIcon>;
}

function WindowTitleBar({ title }: { title: string }) {
  return <div className="window-titlebar"><span>{title}</span></div>;
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

function updatePolicyValue(profile: Profile, stage: StageKey, seconds: number): Profile {
  if (stage === 'lock') return { ...profile, lock_after_seconds: seconds };
  if (stage === 'display') return { ...profile, display_off_after_seconds: seconds };
  return { ...profile, suspend_after_seconds: seconds };
}

function PixelSwitch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className="pixel-switch" title={label}>
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

function PolicyDial({
  profile,
  profileKey,
  selectedStage,
  onSelectStage,
  onToggleProfile,
}: {
  profile: Profile;
  profileKey: ProfileKey;
  selectedStage: StageKey;
  onSelectStage: (stage: StageKey) => void;
  onToggleProfile: () => void;
}) {
  const sourceLabel = profileKey === 'battery' ? '电池' : '交流电';
  const values: Record<StageKey, number | null> = {
    lock: policyValue(profile, 'lock'),
    display: policyValue(profile, 'display'),
    suspend: policyValue(profile, 'suspend'),
  };

  return (
    <section className={`policy-dial ${profileKey}`} aria-label={`${sourceLabel}策略圆形总览`}>
      <svg className="dial-track" viewBox="0 0 260 260" aria-hidden="true">
        <circle className="dial-rail rail-back" cx="130" cy="130" r="99" />
        <circle className="dial-rail rail-dash" cx="130" cy="130" r="99" />
        <path className="dial-route" d="M130 31A99 99 0 0 1 216 179A99 99 0 0 1 44 179A99 99 0 0 1 130 31" />
      </svg>

      {(['lock', 'display', 'suspend'] as StageKey[]).map((stage) => {
        const value = values[stage];
        return (
          <button
            key={stage}
            type="button"
            className={`dial-node ${stage} ${selectedStage === stage ? 'selected' : ''} ${value === null ? 'dormant' : ''}`}
            onClick={() => onSelectStage(stage)}
            aria-pressed={selectedStage === stage}
            aria-label={`${stageMeta[stage].label}，${value === null ? '已关闭' : `${minutes(value)} 分钟`}`}
          >
            <StageIcon stage={stage} />
            <strong>{stageMeta[stage].label}</strong>
            <span>{value === null ? '—' : minutes(value)}</span>
            <small>{value === null ? '关闭' : '分钟'}</small>
          </button>
        );
      })}

      <button
        type="button"
        className="dial-core"
        onClick={onToggleProfile}
        aria-label={`当前为${sourceLabel}策略，切换到${profileKey === 'battery' ? '交流电' : '电池'}策略`}
      >
        <span className="source-icon">{profileKey === 'battery' ? <BatteryIcon /> : <PlugIcon />}</span>
        <strong>{sourceLabel}</strong>
      </button>
    </section>
  );
}

function RouteStage({
  stage,
  profile,
  selected,
  onSelect,
  onChange,
}: {
  stage: StageKey;
  profile: Profile;
  selected: boolean;
  onSelect: () => void;
  onChange: (profile: Profile) => void;
}) {
  const value = policyValue(profile, stage);
  const isSuspend = stage === 'suspend';
  const enabled = value !== null;

  return (
    <div className={`route-stage ${selected ? 'selected' : ''} ${!enabled ? 'dormant' : ''}`}>
      <button
        type="button"
        className="stage-name"
        onClick={onSelect}
        aria-pressed={selected}
      >
        <StageIcon stage={stage} />
        <span>{stageMeta[stage].label}</span>
      </button>

      <label className="minute-ticket">
        <span className="sr-only">{stageMeta[stage].label}等待分钟数</span>
        <input
          type="number"
          min="1"
          disabled={!enabled}
          value={value === null ? '' : minutes(value)}
          onFocus={onSelect}
          onChange={(event) => onChange(updatePolicyValue(profile, stage, fromMinutes(Number(event.target.value))))}
        />
        <small>{enabled ? 'MIN' : 'OFF'}</small>
      </label>

      {isSuspend && (
        <PixelSwitch
          checked={enabled}
          label={enabled ? '挂起已启用' : '挂起已关闭'}
          onChange={(checked) =>
            onChange({
              ...profile,
              suspend_after_seconds: checked
                ? Math.max(profile.display_off_after_seconds + 60, 30 * 60)
                : null,
            })
          }
        />
      )}
    </div>
  );
}

function RouteRow({
  profileKey,
  profile,
  active,
  selectedStage,
  onActivate,
  onSelectStage,
  onChange,
}: {
  profileKey: ProfileKey;
  profile: Profile;
  active: boolean;
  selectedStage: StageKey;
  onActivate: () => void;
  onSelectStage: (stage: StageKey) => void;
  onChange: (profile: Profile) => void;
}) {
  const sourceLabel = profileKey === 'battery' ? '电池' : '交流电';

  return (
    <section
      className={`route-row ${profileKey} ${active ? 'active' : ''}`}
      aria-label={`${sourceLabel}休眠路线`}
      onFocusCapture={onActivate}
    >
      <button
        type="button"
        className="route-source"
        onClick={onActivate}
        aria-pressed={active}
      >
        {profileKey === 'battery' ? <BatteryIcon /> : <PlugIcon />}
        <span><strong>{sourceLabel}</strong><small>{active ? '正在编辑' : '选择路线'}</small></span>
      </button>

      <div className="route-line" aria-hidden="true"><i /><i /></div>

      <div className="route-stages">
        {(['lock', 'display', 'suspend'] as StageKey[]).map((stage) => (
          <RouteStage
            key={stage}
            stage={stage}
            profile={profile}
            selected={active && selectedStage === stage}
            onSelect={() => { onActivate(); onSelectStage(stage); }}
            onChange={onChange}
          />
        ))}
      </div>
    </section>
  );
}

function LoadingScreen({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <main className="loading-shell">
      <div className="loading-signal" aria-hidden="true"><i /></div>
      <h1>IdleFlow</h1>
      <p>{message ?? '正在读取休眠策略…'}</p>
      {message && <button onClick={onRetry}>重新连接</button>}
    </main>
  );
}

export default function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [draft, setDraft] = useState<Policy | null>(null);
  const [profileKey, setProfileKey] = useState<ProfileKey>('battery');
  const [selectedStage, setSelectedStage] = useState<StageKey>('lock');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(() => previewNotice());

  const refresh = useCallback(async () => {
    try {
      const next = await api.snapshot();
      setSnapshot(next);
      setDraft(next.policy);
      setMessage(previewNotice());
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
      setDraft(next.policy);
      setMessage(success);
    } catch (error) {
      setMessage(`操作未完成：${String(error)}`);
    } finally {
      setBusy(false);
    }
  }, []);

  const validation = useMemo(() => {
    if (!draft) return null;
    return validateProfile(draft.battery) ?? validateProfile(draft.ac);
  }, [draft]);

  const hasChanges = useMemo(() => {
    if (!draft || !snapshot) return false;
    return JSON.stringify(draft) !== JSON.stringify(snapshot.policy);
  }, [draft, snapshot]);

  if (!snapshot || !draft) {
    return <LoadingScreen message={message} onRetry={() => void refresh()} />;
  }

  const { status } = snapshot;
  const activeSource = status.power_source === 'battery' ? '电池' : status.power_source === 'ac' ? '交流电' : '未知';
  const owner = status.enabled ? 'IdleFlow' : status.external_swayidle_detected ? 'swayidle' : '未检测到策略进程';
  const currentProfile = draft[profileKey];
  const notice = status.last_error ?? validation ?? message;
  const noticeKind = status.last_error || validation || message?.startsWith('操作未完成') ? 'error' : 'success';

  const setProfile = (key: ProfileKey, profile: Profile) => {
    setDraft({ ...draft, [key]: profile });
  };

  return (
    <main className={`app-shell ${busy ? 'is-busy' : ''}`}>
      <header className="system-menu">
        <div className="app-name" aria-label="IdleFlow">
          <span className="app-pixel" aria-hidden="true"><i>I</i></span>
        </div>
        <div className="menu-status">
          <span>POWER: {activeSource}</span>
          <button className="refresh-button" onClick={() => void refresh()} disabled={busy}>
            <RefreshIcon /><span>刷新</span>
          </button>
        </div>
      </header>

      <div className="desktop-field">
        <section className={`window-frame status-window ${status.enabled ? 'managed' : 'observing'} ${status.inhibited ? 'inhibited' : ''}`}>
          <WindowTitleBar title="SYSTEM STATUS" />
          <div className="status-window-body">
            <div className="owner-signal" aria-hidden="true"><i /></div>
            <div className="owner-copy">
              <h2>{status.enabled ? 'IdleFlow 正在管理' : '原有策略正在运行'}</h2>
              <dl>
                <div><dt>MODE</dt><dd>{statusLabel(status)}</dd></div>
                <div><dt>OWNER</dt><dd>{owner}</dd></div>
                <div><dt>POWER</dt><dd>{activeSource}</dd></div>
                {status.managed_swayidle_pid && <div><dt>PID</dt><dd>{status.managed_swayidle_pid}</dd></div>}
              </dl>
            </div>
          </div>
        </section>

        <section className="window-frame controls-window">
          <WindowTitleBar title="CONTROLS" />
          <div className="controls-window-body">
            {!status.enabled ? (
              <button
                className="takeover-button"
                disabled={busy || validation !== null}
                onClick={() =>
                  void run(
                    async () => {
                      if (hasChanges) await api.save(draft);
                      return api.takeOver();
                    },
                    '接管完成。当前编辑的策略已保存并开始生效。',
                  )
                }
              >
                <span className="control-icon" aria-hidden="true"><ArrowIcon /></span>
                <span><strong>接管策略</strong><small>切换所有权</small></span>
              </button>
            ) : (
              <div className="managed-plate"><ShieldIcon /><span><strong>已接管</strong><small>锁屏保护生效</small></span></div>
            )}
            <button
              className={`inhibit-button ${status.inhibited ? 'active' : ''}`}
              disabled={busy || !status.enabled}
              title={!status.enabled ? '接管后才能临时阻止空闲动作' : undefined}
              onClick={() =>
                void run(
                  () => api.inhibited(!status.inhibited),
                  status.inhibited ? '已恢复按时间执行空闲动作。' : '已临时阻止按时间执行的空闲动作。',
                )
              }
            >
              <span className="pause-bars" aria-hidden="true"><i /><i /></span>
              <span>{status.inhibited ? '恢复策略' : status.enabled ? '临时阻止' : '接管后可用'}</span>
            </button>
          </div>
        </section>

        <section className="window-frame policy-window" key={profileKey}>
          <WindowTitleBar title="IDLE POLICY" />
          <div className="policy-workspace">
            <div className="workspace-heading">
              <div>
                <h1>配置空闲策略</h1>
                <p>选择圆环站点或路线字段，直接输入等待分钟数。</p>
              </div>
              <div className={`change-flag ${hasChanges ? 'changed' : ''}`}>
                <i />{hasChanges ? '未保存' : '已同步'}
              </div>
            </div>

            {notice && (
              <aside className={`notice ${noticeKind}`} role={noticeKind === 'error' ? 'alert' : 'status'} aria-live="polite">
                <span aria-hidden="true"><NoticeIcon kind={noticeKind} /></span>
                <p>{notice}</p>
                {message && !validation && <button onClick={() => setMessage(null)} aria-label="关闭消息"><CloseIcon /></button>}
              </aside>
            )}

            <div className="policy-layout">
              <PolicyDial
                profile={currentProfile}
                profileKey={profileKey}
                selectedStage={selectedStage}
                onSelectStage={setSelectedStage}
                onToggleProfile={() => setProfileKey(profileKey === 'battery' ? 'ac' : 'battery')}
              />

              <div className="route-board">
                <div className="route-scale" aria-hidden="true">
                  <span>策略</span><span>锁屏</span><span>熄屏</span><span>挂起</span>
                </div>
                <RouteRow
                  profileKey="battery"
                  profile={draft.battery}
                  active={profileKey === 'battery'}
                  selectedStage={selectedStage}
                  onActivate={() => setProfileKey('battery')}
                  onSelectStage={setSelectedStage}
                  onChange={(profile) => setProfile('battery', profile)}
                />
                <RouteRow
                  profileKey="ac"
                  profile={draft.ac}
                  active={profileKey === 'ac'}
                  selectedStage={selectedStage}
                  onActivate={() => setProfileKey('ac')}
                  onSelectStage={setSelectedStage}
                  onChange={(profile) => setProfile('ac', profile)}
                />
              </div>
            </div>

            <div className="policy-actions">
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
                保存策略
              </button>
            </div>
          </div>
        </section>

        <section className="window-frame safety-window">
          <WindowTitleBar title="SYSTEM SAFETY" />
          <div className="safety-strip">
            <div className="safety-title"><LockIcon /><span><strong>锁屏优先</strong><small>自动挂起前必须确认锁屏</small></span></div>
            <div className="lock-chain" aria-label="锁屏后端回退顺序：首选 QuickShell，备用 swaylock">
              <span><small>首选</small>QuickShell</span><ArrowIcon /><span><small>备用</small>swaylock</span>
            </div>
            <p>先用 QuickShell 锁屏，不可用时回退到 swaylock；两者都失败才取消自动挂起。</p>
            <button
              className="test-button"
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
                className="rollback-button"
                disabled={busy}
                onClick={() => void run(api.rollback, '已回退。原有桌面休眠策略重新接管。')}
              >
                回退原策略
              </button>
            )}
          </div>
        </section>

      </div>
    </main>
  );
}
