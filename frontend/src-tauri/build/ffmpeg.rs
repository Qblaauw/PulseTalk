// ============================================================================
// FFmpeg Binary Bundling
// ============================================================================
// Download and bundle FFmpeg binaries at build-time to eliminate runtime download delays

struct FfmpegAsset {
    url: &'static str,
    archive_sha256: &'static str,
    binary_sha256: &'static str,
}

fn get_ffmpeg_asset(target: &str) -> Result<FfmpegAsset, String> {
    match target {
        "x86_64-pc-windows-msvc" => Ok(FfmpegAsset {
            url: "https://github.com/Zackriya-Solutions/ffmpeg-binaries/releases/download/0.0.1/ffmpeg-8.0.1-essentials_build.zip",
            archive_sha256: "e2aaeaa0fdbc397d4794828086424d4aaa2102cef1fb6874f6ffd29c0b88b673",
            binary_sha256: "5af82a0d4fe2b9eae211b967332ea97edfc51c6b328ca35b827e73eac560dc0d",
        }),
        "x86_64-apple-darwin" => Ok(FfmpegAsset {
            url: "https://github.com/Zackriya-Solutions/ffmpeg-binaries/releases/download/0.0.1/ffmpeg-8.0.1.zip",
            archive_sha256: "470e482f6e290eac92984ac12b2d67bad425b1e5269fd75fb6a3536c16e824e4",
            binary_sha256: "430d60fbf419dab28daee9b679e7929a31ee9bae53f6e42e8ae26b725584290f",
        }),
        "aarch64-apple-darwin" => Ok(FfmpegAsset {
            url: "https://github.com/Zackriya-Solutions/ffmpeg-binaries/releases/download/0.0.1/ffmpeg80arm.zip",
            archive_sha256: "0d4efcaf6a098430a708e0af694a84792938921fa126162787ae98c6151d7a95",
            binary_sha256: "77d2c853f431318d55ec02676d9b2f185ebfddb9f7677a251fbe453affe025a",
        }),
        "x86_64-unknown-linux-gnu" => Ok(FfmpegAsset {
            url: "https://github.com/Zackriya-Solutions/ffmpeg-binaries/releases/download/0.0.1/ffmpeg-release-amd64-static.tar.xz",
            archive_sha256: "abda8d77ce8309141f83ab8edf0596834087c52467f6badf376a6a2a4c87cf67",
            binary_sha256: "e7e7fb30477f717e6f55f9180a70386c62677ef8a4d4d1a5d948f4098aa3eb99",
        }),
        "aarch64-unknown-linux-gnu" => Ok(FfmpegAsset {
            url: "https://github.com/Zackriya-Solutions/ffmpeg-binaries/releases/download/0.0.1/ffmpeg-release-arm64-static.tar.xz",
            archive_sha256: "f4149bb2b0784e30e99bdda85471c9b5930d3402014e934a5098b41d0f7201b1",
            binary_sha256: "6bb182d0d75d23028db82e9e4f723ca69b853d055698486e6984ddb2c06fb8ce",
        }),
        _ => Err(format!("No pinned FFmpeg asset for target {target}")),
    }
}

pub fn validate_supported_target(target: &str) -> Result<(), String> {
    get_ffmpeg_asset(target).map(|_| ())
}

/// Download and bundle FFmpeg binary for current target platform
/// Checks cache first, downloads only if missing or corrupted
pub fn ensure_ffmpeg_binary() {
    let target = std::env::var("TARGET")
        .or_else(|_| std::env::var("HOST"))
        .expect("Neither TARGET nor HOST environment variable set");

    let asset = get_ffmpeg_asset(&target).unwrap_or_else(|error| panic!("{error}"));
    println!(
        "cargo:warning=🎬 Checking FFmpeg binary for target: {}",
        target
    );

    let binary_name = if target == "x86_64-pc-windows-msvc" {
        format!("ffmpeg-{}.exe", target)
    } else {
        format!("ffmpeg-{}", target)
    };

    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR")
        .expect("CARGO_MANIFEST_DIR environment variable not set");
    let binaries_dir = std::path::PathBuf::from(&manifest_dir).join("binaries");
    let binary_path = binaries_dir.join(&binary_name);

    // Cache check: Skip download if binary exists and works
    if binary_path.exists() {
        println!(
            "cargo:warning=🔍 Found cached FFmpeg binary: {}",
            binary_name
        );
        match verify_pinned_binary(&binary_path, &target, &asset) {
            Ok(()) if verify_ffmpeg_binary(&binary_path) => {
                println!(
                    "cargo:warning=✅ FFmpeg binary already cached and verified: {}",
                    binary_name
                );
                return;
            }
            Ok(()) => println!("cargo:warning=⚠️  Cached FFmpeg binary could not execute"),
            Err(error) => println!("cargo:warning=⚠️  Cached FFmpeg rejected: {error}"),
        }
        std::fs::remove_file(&binary_path)
            .unwrap_or_else(|error| panic!("Failed to remove rejected FFmpeg binary: {error}"));
    }

    println!(
        "cargo:warning=📥 FFmpeg binary not found, downloading for {}",
        target
    );

    // Create binaries directory if it doesn't exist
    if !binaries_dir.exists() {
        std::fs::create_dir_all(&binaries_dir).expect("Failed to create binaries directory");
    }

    // Download and extract
    match download_and_extract_ffmpeg(&target, &binary_path, &asset) {
        Ok(()) => {
            println!(
                "cargo:warning=✅ FFmpeg binary downloaded successfully: {}",
                binary_name
            );

            // Execute only after digest and architecture verification succeeds.
            if let Err(error) = verify_pinned_binary(&binary_path, &target, &asset) {
                panic!("Downloaded FFmpeg binary verification failed: {error}");
            }
            if !verify_ffmpeg_binary(&binary_path) {
                panic!("⚠️  Downloaded FFmpeg binary verification failed!");
            }
        }
        Err(e) => {
            panic!("⚠️  Failed to download FFmpeg: {}", e);
        }
    }
}

/// Download FFmpeg from platform-specific URL and extract to target location
fn download_and_extract_ffmpeg(
    target: &str,
    output_path: &std::path::PathBuf,
    asset: &FfmpegAsset,
) -> Result<(), String> {
    use std::io::Write;

    println!(
        "cargo:warning=🌐 Fetching FFmpeg download URL for {}",
        target
    );

    println!("cargo:warning=⬇️  Downloading from: {}", asset.url);

    // Download with timeout (using reqwest from build-dependencies)
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(600)) // 10 min timeout for large downloads
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let response = client
        .get(asset.url)
        .send()
        .map_err(|e| format!("Failed to download: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()));
    }

    let total_size = response.content_length().unwrap_or(0);
    println!(
        "cargo:warning=📦 Download size: {:.1} MB",
        total_size as f64 / 1_048_576.0
    );

    // Download to temp file
    let temp_dir = std::env::temp_dir();
    let archive_filename = asset.url.split('/').last().unwrap_or("ffmpeg-archive");
    let archive_path = temp_dir.join(format!(
        "ffmpeg-build-{}-{}-{}",
        target,
        std::process::id(),
        archive_filename
    ));

    {
        let mut file = std::fs::File::create(&archive_path)
            .map_err(|e| format!("Failed to create temp file: {}", e))?;

        let content = response
            .bytes()
            .map_err(|e| format!("Failed to read response: {}", e))?;

        file.write_all(&content)
            .map_err(|e| format!("Failed to write archive: {}", e))?;
    }

    verify_sha256(&archive_path, asset.archive_sha256)
        .map_err(|error| format!("FFmpeg archive integrity check failed: {error}"))?;
    println!("cargo:warning=✅ FFmpeg archive SHA-256 verified");

    println!("cargo:warning=📦 Downloaded to: {:?}", archive_path);
    println!("cargo:warning=📂 Extracting FFmpeg binary...");

    // Extract binary (platform-specific)
    extract_ffmpeg_from_archive(&archive_path, target, output_path)?;

    // Cleanup archive
    let _ = std::fs::remove_file(&archive_path);

    println!("cargo:warning=✨ Extraction complete");

    Ok(())
}

/// Extract FFmpeg binary from downloaded archive (handles ZIP and TAR.XZ)
fn extract_ffmpeg_from_archive(
    archive_path: &std::path::Path,
    target: &str,
    output_path: &std::path::PathBuf,
) -> Result<(), String> {
    let extract_dir =
        std::env::temp_dir().join(format!("ffmpeg-extract-{}-{}", target, std::process::id()));

    // Clean old extraction directory
    let _ = std::fs::remove_dir_all(&extract_dir);
    std::fs::create_dir_all(&extract_dir)
        .map_err(|e| format!("Failed to create extract dir: {}", e))?;

    // Determine archive format from extension
    let archive_str = archive_path.to_string_lossy();

    if archive_str.ends_with(".zip") {
        extract_zip(archive_path, &extract_dir)?;
    } else if archive_str.ends_with(".tar.xz") || archive_str.ends_with(".txz") {
        extract_tar_xz(archive_path, &extract_dir)?;
    } else {
        return Err(format!("Unsupported archive format: {}", archive_str));
    }

    // Find extracted FFmpeg binary (platform-specific locations)
    let ffmpeg_binary = find_ffmpeg_in_extracted_dir(&extract_dir, target)?;

    println!("cargo:warning=📋 Found FFmpeg at: {:?}", ffmpeg_binary);

    // Copy to target location
    std::fs::copy(&ffmpeg_binary, output_path)
        .map_err(|e| format!("Failed to copy binary to binaries/: {}", e))?;

    // Set executable permissions on Unix systems
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(output_path)
            .map_err(|e| format!("Failed to get metadata: {}", e))?
            .permissions();
        perms.set_mode(0o755); // rwxr-xr-x
        std::fs::set_permissions(output_path, perms)
            .map_err(|e| format!("Failed to set executable permissions: {}", e))?;
        println!("cargo:warning=🔐 Set executable permissions");
    }

    // Cleanup extraction directory
    let _ = std::fs::remove_dir_all(&extract_dir);

    Ok(())
}

/// Extract ZIP archive (Windows, macOS)
fn extract_zip(
    archive_path: &std::path::Path,
    extract_dir: &std::path::Path,
) -> Result<(), String> {
    let file =
        std::fs::File::open(archive_path).map_err(|e| format!("Failed to open ZIP: {}", e))?;

    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Failed to read ZIP archive: {}", e))?;

    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| format!("Failed to read ZIP entry {}: {}", i, e))?;

        // Use enclosed_name() to prevent Zip Slip path traversal attacks
        let outpath = match file.enclosed_name() {
            Some(name) => extract_dir.join(name),
            None => {
                // Skip entries with path traversal sequences (e.g., "../")
                println!(
                    "cargo:warning=⚠️  Skipping suspicious ZIP entry: {}",
                    file.name()
                );
                continue;
            }
        };

        if file.is_dir() {
            // Directory
            std::fs::create_dir_all(&outpath)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        } else {
            // File
            if let Some(parent) = outpath.parent() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create parent directory: {}", e))?;
            }

            let mut outfile = std::fs::File::create(&outpath)
                .map_err(|e| format!("Failed to create output file: {}", e))?;

            std::io::copy(&mut file, &mut outfile)
                .map_err(|e| format!("Failed to extract file: {}", e))?;
        }

        // Set Unix permissions if available
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Some(mode) = file.unix_mode() {
                std::fs::set_permissions(&outpath, std::fs::Permissions::from_mode(mode)).ok();
            }
        }
    }

    Ok(())
}

/// Extract TAR.XZ archive (Linux)
fn extract_tar_xz(
    archive_path: &std::path::Path,
    extract_dir: &std::path::Path,
) -> Result<(), String> {
    let file =
        std::fs::File::open(archive_path).map_err(|e| format!("Failed to open TAR.XZ: {}", e))?;

    // Decompress XZ
    let decompressor = xz2::read::XzDecoder::new(file);

    // Extract TAR
    let mut archive = tar::Archive::new(decompressor);
    archive
        .unpack(extract_dir)
        .map_err(|e| format!("Failed to extract TAR: {}", e))?;

    Ok(())
}

/// Find FFmpeg binary in extracted directory (handles nested structures)
fn find_ffmpeg_in_extracted_dir(
    extract_dir: &std::path::Path,
    target: &str,
) -> Result<std::path::PathBuf, String> {
    let executable_name = if target == "x86_64-pc-windows-msvc" {
        "ffmpeg.exe"
    } else {
        "ffmpeg"
    };

    // Search patterns (in priority order)
    let search_patterns = [
        extract_dir.join(executable_name),             // Flat: ffmpeg
        extract_dir.join("bin").join(executable_name), // Nested: bin/ffmpeg
    ];

    // Try direct paths first
    for pattern in &search_patterns {
        if pattern.exists() && pattern.is_file() {
            return Ok(pattern.clone());
        }
    }

    // Recursive search for nested directories (e.g., ffmpeg-6.0-full_build/bin/ffmpeg.exe)
    for entry in
        std::fs::read_dir(extract_dir).map_err(|e| format!("Failed to read extract dir: {}", e))?
    {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        if path.is_dir() {
            // Check bin/ subdirectory
            let bin_path = path.join("bin").join(executable_name);
            if bin_path.exists() && bin_path.is_file() {
                return Ok(bin_path);
            }

            // Check root of subdirectory
            let root_path = path.join(executable_name);
            if root_path.exists() && root_path.is_file() {
                return Ok(root_path);
            }
        }
    }

    Err(format!(
        "FFmpeg binary '{}' not found in extracted archive",
        executable_name
    ))
}

fn sha256_file(path: &std::path::Path) -> Result<String, String> {
    use sha2::{Digest, Sha256};
    use std::io::Read;

    let mut file = std::fs::File::open(path)
        .map_err(|error| format!("could not open {}: {error}", path.display()))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let count = file
            .read(&mut buffer)
            .map_err(|error| format!("could not read {}: {error}", path.display()))?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn verify_sha256(path: &std::path::Path, expected: &str) -> Result<(), String> {
    let actual = sha256_file(path)?;
    if actual.eq_ignore_ascii_case(expected) {
        Ok(())
    } else {
        Err(format!(
            "SHA-256 mismatch for {}: expected {expected}, got {actual}",
            path.display()
        ))
    }
}

fn read_u16(header: &[u8], offset: usize, little_endian: bool) -> Result<u16, String> {
    let bytes: [u8; 2] = header
        .get(offset..offset + 2)
        .ok_or_else(|| "executable header is truncated".to_string())?
        .try_into()
        .map_err(|_| "executable header is truncated".to_string())?;
    Ok(if little_endian {
        u16::from_le_bytes(bytes)
    } else {
        u16::from_be_bytes(bytes)
    })
}

fn read_u32(header: &[u8], offset: usize, little_endian: bool) -> Result<u32, String> {
    let bytes: [u8; 4] = header
        .get(offset..offset + 4)
        .ok_or_else(|| "executable header is truncated".to_string())?
        .try_into()
        .map_err(|_| "executable header is truncated".to_string())?;
    Ok(if little_endian {
        u32::from_le_bytes(bytes)
    } else {
        u32::from_be_bytes(bytes)
    })
}

pub fn verify_binary_architecture(path: &std::path::Path, target: &str) -> Result<(), String> {
    use std::io::Read;

    validate_supported_target(target)?;
    let mut file = std::fs::File::open(path)
        .map_err(|error| format!("could not open {}: {error}", path.display()))?;
    let mut header = vec![0_u8; 4096];
    let count = file
        .read(&mut header)
        .map_err(|error| format!("could not read {}: {error}", path.display()))?;
    header.truncate(count);

    match target {
        "x86_64-pc-windows-msvc" => {
            if header.get(..2) != Some(b"MZ") {
                return Err("expected a PE executable".to_string());
            }
            let pe_offset = read_u32(&header, 0x3c, true)? as usize;
            if header.get(pe_offset..pe_offset + 4) != Some(b"PE\0\0") {
                return Err("invalid PE signature".to_string());
            }
            let machine = read_u16(&header, pe_offset + 4, true)?;
            if machine != 0x8664 {
                return Err(format!(
                    "expected PE x86_64 machine 0x8664, got 0x{machine:04x}"
                ));
            }
        }
        "x86_64-unknown-linux-gnu" | "aarch64-unknown-linux-gnu" => {
            if header.get(..4) != Some(b"\x7fELF") {
                return Err("expected an ELF executable".to_string());
            }
            let machine = read_u16(&header, 18, header.get(5) == Some(&1))?;
            let expected = if target.starts_with("x86_64") {
                0x3e
            } else {
                0xb7
            };
            if machine != expected {
                return Err(format!(
                    "expected ELF machine 0x{expected:04x}, got 0x{machine:04x}"
                ));
            }
        }
        "x86_64-apple-darwin" | "aarch64-apple-darwin" => {
            let magic = read_u32(&header, 0, false)?;
            let expected = if target.starts_with("x86_64") {
                0x01000007
            } else {
                0x0100000c
            };
            let matches = match magic {
                0xfeedface | 0xfeedfacf => read_u32(&header, 4, false)? == expected,
                0xcefaedfe | 0xcffaedfe => read_u32(&header, 4, true)? == expected,
                0xcafebabe => {
                    let count = read_u32(&header, 4, false)? as usize;
                    (0..count).any(|index| {
                        read_u32(&header, 8 + index * 20, false)
                            .map(|machine| machine == expected)
                            .unwrap_or(false)
                    })
                }
                _ => return Err("expected a Mach-O executable".to_string()),
            };
            if !matches {
                return Err(format!("Mach-O does not contain CPU type 0x{expected:08x}"));
            }
        }
        _ => unreachable!("target was validated above"),
    }

    Ok(())
}

fn verify_pinned_binary(
    path: &std::path::Path,
    target: &str,
    asset: &FfmpegAsset,
) -> Result<(), String> {
    verify_sha256(path, asset.binary_sha256)?;
    verify_binary_architecture(path, target)?;
    Ok(())
}

/// Verify FFmpeg binary is functional (runs -version successfully)
fn verify_ffmpeg_binary(path: &std::path::PathBuf) -> bool {
    match std::process::Command::new(path).arg("-version").output() {
        Ok(output) => {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                if let Some(version_line) = stdout.lines().next() {
                    println!(
                        "cargo:warning=✅ FFmpeg verification passed: {}",
                        version_line
                    );
                }
                true
            } else {
                false
            }
        }
        Err(_) => false,
    }
}
