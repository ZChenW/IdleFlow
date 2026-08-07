use anyhow::Result;
use clap::{Parser, Subcommand};
use idle_control_dbus::Client;

#[derive(Parser)]
#[command(name = "idlectl", about = "Control the IdleFlow user daemon")]
struct Args {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    Status,
    Policy,
    Enable,
    Disable,
    TakeOver,
    Rollback,
    Inhibit,
    Uninhibit,
    Lock,
    Suspend,
}

fn main() -> Result<()> {
    let client = Client::session()?;
    match Args::parse().command {
        Command::Status => println!("{}", serde_json::to_string_pretty(&client.status()?)?),
        Command::Policy => println!("{}", serde_json::to_string_pretty(&client.policy()?)?),
        Command::Enable => {
            println!(
                "{}",
                serde_json::to_string_pretty(&client.set_enabled(true)?)?
            )
        }
        Command::Disable => {
            println!(
                "{}",
                serde_json::to_string_pretty(&client.set_enabled(false)?)?
            )
        }
        Command::TakeOver => println!("{}", serde_json::to_string_pretty(&client.take_over()?)?),
        Command::Rollback => println!("{}", serde_json::to_string_pretty(&client.rollback()?)?),
        Command::Inhibit => {
            println!(
                "{}",
                serde_json::to_string_pretty(&client.set_inhibited(true)?)?
            )
        }
        Command::Uninhibit => {
            println!(
                "{}",
                serde_json::to_string_pretty(&client.set_inhibited(false)?)?
            )
        }
        Command::Lock => println!("{}", client.lock()?),
        Command::Suspend => println!("{}", client.suspend()?),
    }
    Ok(())
}
