use std::cell::Cell;

use idle_control_core::{LockError, Locker, Suspender, suspend_after_lock};

struct FailedLocker;

impl Locker for FailedLocker {
    fn lock_and_confirm(&self) -> Result<(), LockError> {
        Err(LockError::NotConfirmed("locker unavailable".into()))
    }
}

struct RecordingSuspender(Cell<bool>);

impl Suspender for RecordingSuspender {
    fn suspend(&self) -> Result<(), String> {
        self.0.set(true);
        Ok(())
    }
}

#[test]
fn automatic_suspend_is_cancelled_when_lock_cannot_be_confirmed() {
    let suspender = RecordingSuspender(Cell::new(false));

    let result = suspend_after_lock(&FailedLocker, &suspender);

    assert!(result.is_err());
    assert!(!suspender.0.get());
}
