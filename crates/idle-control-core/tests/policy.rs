use idle_control_core::{Policy, ValidationError};

#[test]
fn default_policy_matches_the_agreed_ac_and_battery_profiles() {
    let policy = Policy::default();

    assert!(!policy.enabled, "first launch must remain observe-only");
    assert!(policy.respect_inhibitors);
    assert_eq!(policy.battery.lock_after_seconds, 10 * 60);
    assert_eq!(policy.battery.display_off_after_seconds, 15 * 60);
    assert_eq!(policy.battery.suspend_after_seconds, Some(30 * 60));
    assert_eq!(policy.ac.lock_after_seconds, 15 * 60);
    assert_eq!(policy.ac.display_off_after_seconds, 30 * 60);
    assert_eq!(policy.ac.suspend_after_seconds, Some(2 * 60 * 60));
}

#[test]
fn policy_rejects_a_suspend_stage_that_precedes_display_off() {
    let mut policy = Policy::default();
    policy.battery.suspend_after_seconds = Some(14 * 60);

    assert_eq!(
        policy.validate(),
        Err(ValidationError::StageOrder {
            profile: "battery",
            earlier: "display_off",
            later: "suspend",
        })
    );
}

#[test]
fn policy_requires_standard_idle_inhibitors() {
    let policy = Policy {
        respect_inhibitors: false,
        ..Policy::default()
    };

    assert_eq!(policy.validate(), Err(ValidationError::InhibitorsRequired));
}
