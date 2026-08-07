use idle_control_core::{Policy, SleepGuardPlan, SwayidlePlan};

#[test]
fn battery_plan_contains_lock_display_power_resume_and_suspend() {
    let policy = Policy::default();
    let plan = SwayidlePlan::for_profile(&policy.battery, "/usr/bin/idlectl");

    assert_eq!(
        plan.args,
        vec![
            "-w",
            "timeout",
            "600",
            "/usr/bin/idlectl lock",
            "timeout",
            "900",
            "niri msg action power-off-monitors",
            "resume",
            "niri msg action power-on-monitors",
            "timeout",
            "1800",
            "/usr/bin/idlectl suspend",
        ]
    );
}

#[test]
fn sleep_guard_only_contains_a_waited_pre_sleep_lock() {
    assert_eq!(
        SleepGuardPlan::new("/usr/bin/idlectl").args,
        vec!["-w", "before-sleep", "/usr/bin/idlectl lock"]
    );
}
