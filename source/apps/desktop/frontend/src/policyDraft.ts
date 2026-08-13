import type { Policy, Profile } from './model';

export type ProfileKey = 'battery' | 'ac';
export type StageKey = 'lock' | 'display' | 'suspend';
export type ProfileInputValues = Readonly<Record<StageKey, string>>;
export type PolicyInputValues = Readonly<Record<ProfileKey, ProfileInputValues>>;

export interface PolicyDraftView {
  readonly policy: Policy;
  readonly inputValues: PolicyInputValues;
  readonly validation: string | null;
  readonly dirty: boolean;
}

export type PolicyDraftEvent =
  | { readonly type: 'stage-input'; readonly profile: ProfileKey; readonly stage: StageKey; readonly input: string }
  | { readonly type: 'stage-blur'; readonly profile: ProfileKey; readonly stage: StageKey }
  | { readonly type: 'suspend-toggle'; readonly profile: ProfileKey; readonly enabled: boolean };

function cloneProfile(profile: Profile): Profile {
  return { ...profile };
}

function clonePolicy(policy: Policy): Policy {
  return {
    ...policy,
    battery: cloneProfile(policy.battery),
    ac: cloneProfile(policy.ac),
  };
}

function minutes(seconds: number): number {
  return Math.round(seconds / 60);
}

function fromMinutes(value: number): number {
  return Math.max(0, Math.round(value)) * 60;
}

function stageValue(profile: Profile, stage: StageKey): number | null {
  if (stage === 'lock') return profile.lock_after_seconds;
  if (stage === 'display') return profile.display_off_after_seconds;
  return profile.suspend_after_seconds;
}

function withStageValue(profile: Profile, stage: StageKey, seconds: number): Profile {
  if (stage === 'lock') return { ...profile, lock_after_seconds: seconds };
  if (stage === 'display') return { ...profile, display_off_after_seconds: seconds };
  return { ...profile, suspend_after_seconds: seconds };
}

function inputValuesForProfile(profile: Profile): ProfileInputValues {
  return {
    lock: String(minutes(profile.lock_after_seconds)),
    display: String(minutes(profile.display_off_after_seconds)),
    suspend: profile.suspend_after_seconds === null ? '' : String(minutes(profile.suspend_after_seconds)),
  };
}

function inputValuesForPolicy(policy: Policy): PolicyInputValues {
  return {
    battery: inputValuesForProfile(policy.battery),
    ac: inputValuesForProfile(policy.ac),
  };
}

function validateProfile(profile: Profile): string | null {
  if (profile.lock_after_seconds < 30) return '锁屏时间不能少于 30 秒';
  if (profile.display_off_after_seconds <= profile.lock_after_seconds) {
    return '熄屏时间必须晚于锁屏时间';
  }
  if (
    profile.suspend_after_seconds !== null
    && profile.suspend_after_seconds <= profile.display_off_after_seconds
  ) {
    return '挂起时间必须晚于熄屏时间';
  }
  return null;
}

function validationFor(policy: Policy): string | null {
  return validateProfile(policy.battery) ?? validateProfile(policy.ac);
}

function samePolicy(left: Policy, right: Policy): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export class PolicyDraft {
  readonly #saved: Policy;
  readonly #policy: Policy;
  readonly #inputValues: PolicyInputValues;

  private constructor(saved: Policy, policy: Policy, inputValues: PolicyInputValues) {
    this.#saved = saved;
    this.#policy = policy;
    this.#inputValues = inputValues;
  }

  static from(policy: Policy): PolicyDraft {
    const saved = clonePolicy(policy);
    const current = clonePolicy(policy);
    return new PolicyDraft(saved, current, inputValuesForPolicy(current));
  }

  get view(): PolicyDraftView {
    return {
      policy: this.#policy,
      inputValues: this.#inputValues,
      validation: validationFor(this.#policy),
      dirty: !samePolicy(this.#saved, this.#policy),
    };
  }

  apply(event: PolicyDraftEvent): PolicyDraft {
    if (event.type === 'stage-input') return this.#applyStageInput(event);
    if (event.type === 'stage-blur') return this.#applyStageBlur(event);
    return this.#applySuspendToggle(event);
  }

  #applyStageInput(event: Extract<PolicyDraftEvent, { type: 'stage-input' }>): PolicyDraft {
    const inputs = {
      ...this.#inputValues,
      [event.profile]: { ...this.#inputValues[event.profile], [event.stage]: event.input },
    };
    const parsed = Number(event.input);
    if (event.input.trim() === '' || !Number.isFinite(parsed) || parsed < 0) {
      return new PolicyDraft(this.#saved, this.#policy, inputs);
    }
    const profile = withStageValue(this.#policy[event.profile], event.stage, fromMinutes(parsed));
    const policy = { ...this.#policy, [event.profile]: profile };
    return new PolicyDraft(this.#saved, policy, inputs);
  }

  #applyStageBlur(event: Extract<PolicyDraftEvent, { type: 'stage-blur' }>): PolicyDraft {
    const current = stageValue(this.#policy[event.profile], event.stage);
    const input = current === null ? '' : String(minutes(current));
    return new PolicyDraft(this.#saved, this.#policy, {
      ...this.#inputValues,
      [event.profile]: { ...this.#inputValues[event.profile], [event.stage]: input },
    });
  }

  #applySuspendToggle(event: Extract<PolicyDraftEvent, { type: 'suspend-toggle' }>): PolicyDraft {
    const current = this.#policy[event.profile];
    const nextValue = event.enabled
      ? Math.max(current.display_off_after_seconds + 60, 30 * 60)
      : null;
    const policy = {
      ...this.#policy,
      [event.profile]: { ...current, suspend_after_seconds: nextValue },
    };
    const input = nextValue === null ? '' : String(minutes(nextValue));
    const inputValues = {
      ...this.#inputValues,
      [event.profile]: { ...this.#inputValues[event.profile], suspend: input },
    };
    return new PolicyDraft(this.#saved, policy, inputValues);
  }
}
