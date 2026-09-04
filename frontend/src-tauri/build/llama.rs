use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::ffmpeg::{validate_supported_target, verify_binary_architecture};

pub fn ensure_llama_helper_binary() {
    let target = std::env::var("TARGET").expect("TARGET is not set for the Tauri build script");
    validate_supported_target(&target).unwrap_or_else(|error| panic!("{error}"));

    let profile = std::env::var("PROFILE").expect("PROFILE is not set for the Tauri build script");
    if profile != "debug" && profile != "release" {
        panic!("Unsupported llama-helper build profile {profile}");
    }

    let manifest_dir = PathBuf::from(
        std::env::var_os("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR is not set"),
    );
    let workspace_root = manifest_dir
        .parent()
        .and_then(Path::parent)
        .expect("Could not resolve the Cargo workspace root");
    let suffix = if target == "x86_64-pc-windows-msvc" {
        ".exe"
    } else {
        ""
    };
    let destination = manifest_dir
        .join("binaries")
        .join(format!("llama-helper-{target}{suffix}"));

    println!("cargo:rerun-if-changed=../../llama-helper/Cargo.toml");
    println!("cargo:rerun-if-changed=../../llama-helper/src");
    println!("cargo:rerun-if-changed=../../Cargo.lock");
    println!("cargo:rerun-if-env-changed=PULSETALQ_LLAMA_HELPER_PREPARED");
    println!("cargo:rerun-if-env-changed=PULSETALQ_SIDECAR_TARGET_DIR");

    if std::env::var("PULSETALQ_LLAMA_HELPER_PREPARED").as_deref() == Ok("1") {
        verify_binary_architecture(&destination, &target).unwrap_or_else(|error| {
            panic!(
                "PULSETALQ_LLAMA_HELPER_PREPARED=1 but {} is invalid: {error}",
                destination.display()
            )
        });
        println!(
            "cargo:warning=llama-helper already prepared and verified: {}",
            destination.display()
        );
        return;
    }

    let helper_feature = helper_feature(&target);
    let target_dir = sidecar_target_dir(workspace_root);
    let cargo = std::env::var_os("CARGO").unwrap_or_else(|| "cargo".into());
    let mut command = Command::new(cargo);
    command
        .current_dir(workspace_root)
        .env("CARGO_TARGET_DIR", &target_dir)
        .env_remove("PULSETALQ_LLAMA_HELPER_PREPARED")
        .args([
            "build",
            "--locked",
            "--package",
            "llama-helper",
            "--target",
            &target,
        ]);
    if profile == "release" {
        command.arg("--release");
    }
    if let Some(feature) = helper_feature {
        command.args(["--features", feature]);
    }

    println!(
        "cargo:warning=Building llama-helper for {target}, profile {profile}, feature {}",
        helper_feature.unwrap_or("cpu")
    );
    let status = command
        .status()
        .unwrap_or_else(|error| panic!("Could not start Cargo for llama-helper: {error}"));
    if !status.success() {
        panic!("llama-helper Cargo build failed with status {status}");
    }

    let source = target_dir
        .join(&target)
        .join(&profile)
        .join(format!("llama-helper{suffix}"));
    verify_binary_architecture(&source, &target).unwrap_or_else(|error| {
        panic!(
            "Built llama-helper {} has the wrong architecture: {error}",
            source.display()
        )
    });

    std::fs::create_dir_all(
        destination
            .parent()
            .expect("llama-helper destination has no parent"),
    )
    .expect("Could not create the Tauri binaries directory");
    std::fs::copy(&source, &destination).unwrap_or_else(|error| {
        panic!(
            "Could not copy llama-helper from {} to {}: {error}",
            source.display(),
            destination.display()
        )
    });
    verify_binary_architecture(&destination, &target).unwrap_or_else(|error| {
        panic!(
            "Copied llama-helper {} has the wrong architecture: {error}",
            destination.display()
        )
    });
    println!(
        "cargo:warning=llama-helper prepared and verified: {}",
        destination.display()
    );
}

fn helper_feature(target: &str) -> Option<&'static str> {
    // The macOS whisper dependency enables Metal and CoreML through its target-specific
    // dependency declaration, so those flags do not appear as package features here.
    let metal =
        target.ends_with("-apple-darwin") || cfg!(feature = "metal") || cfg!(feature = "coreml");
    let enabled = [cfg!(feature = "cuda"), cfg!(feature = "vulkan"), metal]
        .into_iter()
        .filter(|enabled| *enabled)
        .count();
    if enabled > 1 {
        panic!("llama-helper accepts only one of cuda, vulkan, or metal");
    }
    if cfg!(feature = "cuda") {
        Some("cuda")
    } else if cfg!(feature = "vulkan") {
        Some("vulkan")
    } else if metal {
        Some("metal")
    } else {
        None
    }
}

fn sidecar_target_dir(workspace_root: &Path) -> PathBuf {
    if let Some(configured) = std::env::var_os("PULSETALQ_SIDECAR_TARGET_DIR") {
        return PathBuf::from(configured);
    }
    let mut hasher = DefaultHasher::new();
    workspace_root.hash(&mut hasher);
    let workspace_hash = format!("{:016x}", hasher.finish());

    // llama.cpp creates deeply nested CMake and MSBuild paths. The short cache
    // name stays below MAX_PATH on Windows and remains writable by the user.
    std::env::temp_dir().join("ptl").join(workspace_hash)
}
