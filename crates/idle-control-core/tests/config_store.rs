use idle_control_core::{ConfigStore, Policy};

#[test]
fn saved_policy_is_read_back_through_the_public_store_interface() {
    let temp = tempfile::tempdir().unwrap();
    let store = ConfigStore::new(temp.path().join("idle-control/config.toml"));
    let mut expected = Policy {
        enabled: true,
        ..Policy::default()
    };
    expected.ac.suspend_after_seconds = None;

    store.save(&expected).unwrap();

    assert_eq!(store.load().unwrap(), expected);
}
