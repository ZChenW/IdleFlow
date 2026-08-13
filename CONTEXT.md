# Idle Policy Control

IdleFlow owns one desktop idle policy while preserving an explicit path back to the previous owner.

## Language

**Idle Policy**:
The canonical battery and AC schedules that order locking, display power-off, and optional suspend.
_Avoid_: Settings, timeout config

**Policy Draft**:
The user's editable form of an Idle Policy, including unfinished input that is not yet valid or saved.
_Avoid_: Form state, temporary policy

**Policy Ownership**:
The exclusive responsibility for running the active Idle Policy; it belongs either to IdleFlow after takeover or to the previous desktop owner after rollback.
_Avoid_: Enabled state, active toggle
