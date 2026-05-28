use std::path::PathBuf;

use felina_lib::tokens::reconciliation::{
    ReconcileOptions, count_storage_state, reconcile, render_markdown_report,
};

fn main() {
    let mut options = ReconcileOptions {
        include_tokscale: true,
        ..Default::default()
    };
    let mut output_json = false;
    let mut write_report: Option<PathBuf> = None;
    let mut before_after_db: Option<PathBuf> = None;

    let mut args = std::env::args().skip(1);
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--start" => options.date_start = args.next().and_then(|v| parse_time_arg(&v)),
            "--end" => options.date_end = args.next().and_then(|v| parse_time_arg(&v)),
            "--agent" => options.filter_agent = args.next(),
            "--model" => options.filter_model = args.next(),
            "--tokscale-subcommand" => options.tokscale_subcommand = args.next(),
            "--tokscale-group-by" => options.tokscale_group_by = args.next(),
            "--db" => {
                let path = args.next().map(PathBuf::from);
                before_after_db = path.clone();
                options.db_path = path;
            }
            "--tokscale-bin" => options.tokscale_bin = args.next().map(PathBuf::from),
            "--skip-tokscale" => options.include_tokscale = false,
            "--json" => output_json = true,
            "--write-report" => write_report = args.next().map(PathBuf::from),
            "--help" | "-h" => {
                print_help();
                return;
            }
            unknown => {
                eprintln!("unknown argument: {}", unknown);
                print_help();
                std::process::exit(2);
            }
        }
    }

    let before = before_after_db
        .as_ref()
        .and_then(|path| count_storage_state(path).ok());
    let report = reconcile(options);
    let after = before_after_db
        .as_ref()
        .and_then(|path| count_storage_state(path).ok());

    if let (Some(before), Some(after)) = (before, after) {
        if before != after {
            eprintln!(
                "read-only contract violated: before={:?}, after={:?}",
                before, after
            );
            std::process::exit(3);
        }
    }

    if let Some(path) = write_report {
        if let Some(parent) = path.parent() {
            if let Err(e) = std::fs::create_dir_all(parent) {
                eprintln!("cannot create report directory: {}", e);
                std::process::exit(1);
            }
        }
        if let Err(e) = std::fs::write(&path, render_markdown_report(&report)) {
            eprintln!("cannot write report {}: {}", path.display(), e);
            std::process::exit(1);
        }
    }

    if output_json {
        println!(
            "{}",
            serde_json::to_string_pretty(&report).expect("serialize reconciliation report")
        );
    } else {
        println!("{}", render_markdown_report(&report));
    }
}

fn parse_time_arg(value: &str) -> Option<i64> {
    value
        .parse::<i64>()
        .ok()
        .or_else(|| felina_lib::tokens::parse_iso8601_to_epoch(value))
}

fn print_help() {
    eprintln!(
        "Usage: glyphic_token_reconcile [--start EPOCH_OR_ISO] [--end EPOCH_OR_ISO] [--agent AGENT] [--model MODEL] [--db PATH] [--tokscale-bin PATH] [--tokscale-subcommand COMMAND] [--tokscale-group-by KEY] [--skip-tokscale] [--json] [--write-report PATH]"
    );
}
