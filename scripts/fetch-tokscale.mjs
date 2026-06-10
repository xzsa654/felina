#!/usr/bin/env node
import { createWriteStream, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { get } from "node:https";
import { createGunzip } from "node:zlib";
import { join, dirname } from "node:path";
import { platform, arch } from "node:os";
import { argv, exit } from "node:process";

const TOKSCALE_VERSION = "3.1.2";

const TRIPLE_TO_NPM = {
  "x86_64-pc-windows-msvc":    "@tokscale/cli-win32-x64-msvc",
  "aarch64-pc-windows-msvc":   "@tokscale/cli-win32-arm64-msvc",
  "x86_64-apple-darwin":       "@tokscale/cli-darwin-x64",
  "aarch64-apple-darwin":      "@tokscale/cli-darwin-arm64",
  "x86_64-unknown-linux-gnu":  "@tokscale/cli-linux-x64-gnu",
  "aarch64-unknown-linux-gnu": "@tokscale/cli-linux-arm64-gnu",
  "x86_64-unknown-linux-musl": "@tokscale/cli-linux-x64-musl",
  "aarch64-unknown-linux-musl":"@tokscale/cli-linux-arm64-musl",
};

function detectTriple() {
  const p = platform();
  const a = arch();
  if (p === "win32"  && a === "x64")   return "x86_64-pc-windows-msvc";
  if (p === "win32"  && a === "arm64") return "aarch64-pc-windows-msvc";
  if (p === "darwin"  && a === "x64")   return "x86_64-apple-darwin";
  if (p === "darwin"  && a === "arm64") return "aarch64-apple-darwin";
  if (p === "linux"   && a === "x64")   return "x86_64-unknown-linux-gnu";
  if (p === "linux"   && a === "arm64") return "aarch64-unknown-linux-gnu";
  return null;
}

function parseArgs() {
  let target = null;
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--target" && argv[i + 1]) {
      target = argv[++i];
    }
  }
  return target || detectTriple();
}

const BINARIES_DIR = join(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "..", "src-tauri", "binaries");
const VERSION_MARKER_FILE = join(BINARIES_DIR, ".tokscale-version");

function binaryName(triple) {
  const ext = triple.includes("windows") ? ".exe" : "";
  return `tokscale-${triple}${ext}`;
}

function isUpToDate(triple) {
  const bin = join(BINARIES_DIR, binaryName(triple));
  if (!existsSync(bin)) return false;
  if (!existsSync(VERSION_MARKER_FILE)) return false;
  try {
    return readFileSync(VERSION_MARKER_FILE, "utf8").trim() === `${TOKSCALE_VERSION}:${triple}`;
  } catch {
    return false;
  }
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpsGet(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        res.resume();
        return;
      }
      resolve(res);
    }).on("error", reject);
  });
}

// Minimal tar parser: find and extract a single file from an uncompressed tar stream.
function extractFromTar(stream, targetPath) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (c) => chunks.push(c));
    stream.on("error", reject);
    stream.on("end", () => {
      const buf = Buffer.concat(chunks);
      let offset = 0;
      const entries = [];
      while (offset + 512 <= buf.length) {
        const header = buf.subarray(offset, offset + 512);
        if (header.every((b) => b === 0)) break;
        const name = header.subarray(0, 100).toString("utf8").replace(/\0+$/, "");
        const sizeOctal = header.subarray(124, 136).toString("utf8").replace(/\0+$/, "").trim();
        const size = parseInt(sizeOctal, 8) || 0;
        entries.push(name);
        offset += 512;
        if (name === targetPath || name === "./" + targetPath) {
          resolve({ data: buf.subarray(offset, offset + size), entries });
          return;
        }
        offset += Math.ceil(size / 512) * 512;
      }
      reject(new Error(`Binary not found at '${targetPath}' in tarball. Contents:\n${entries.join("\n")}`));
    });
  });
}

async function main() {
  const triple = parseArgs();
  if (!triple) {
    console.error("Cannot detect platform triple. Use --target <triple>.");
    exit(1);
  }

  const npmPkg = TRIPLE_TO_NPM[triple];
  if (!npmPkg) {
    console.error(`No npm package mapping for triple '${triple}'.`);
    console.error("Known triples:", Object.keys(TRIPLE_TO_NPM).join(", "));
    exit(1);
  }

  if (isUpToDate(triple)) {
    console.log(`skip: ${binaryName(triple)} already at ${TOKSCALE_VERSION}`);
    exit(0);
  }

  mkdirSync(BINARIES_DIR, { recursive: true });

  const tarballUrl = `https://registry.npmjs.org/${npmPkg}/-/${npmPkg.split("/")[1]}-${TOKSCALE_VERSION}.tgz`;
  console.log(`Downloading ${npmPkg}@${TOKSCALE_VERSION} ...`);

  let res;
  try {
    res = await httpsGet(tarballUrl);
  } catch (e) {
    const dest = join(BINARIES_DIR, binaryName(triple));
    if (existsSync(dest)) {
      console.log(`Registry unreachable but existing binary found — using cached copy.`);
      exit(0);
    }
    console.error(`Failed to fetch ${tarballUrl}: ${e.message}`);
    exit(1);
  }

  const isWindows = triple.includes("windows");
  const tarBinaryPath = `package/bin/tokscale${isWindows ? ".exe" : ""}`;
  const gunzip = createGunzip();
  res.pipe(gunzip);

  let result;
  try {
    result = await extractFromTar(gunzip, tarBinaryPath);
  } catch (e) {
    console.error(e.message);
    exit(1);
  }

  const dest = join(BINARIES_DIR, binaryName(triple));
  writeFileSync(dest, result.data, { mode: 0o755 });
  writeFileSync(VERSION_MARKER_FILE, `${TOKSCALE_VERSION}:${triple}`);
  console.log(`Wrote ${dest} (${(result.data.length / 1024 / 1024).toFixed(1)} MB)`);
}

main();
