import { spawnSync } from "node:child_process";
import { existsSync, rmSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const desktopDir = join(__dirname, "..");
const bundleDir = join(desktopDir, "src-tauri", "target", "release", "bundle", "macos");
const looseAppPath = join(bundleDir, "OpenWork.app");
const parkedAppPath = join(bundleDir, "OpenWork.build-output");

const tauriArgs = ["exec", "tauri", "build", "--bundles", "app,dmg", "--no-sign", "-v"];
const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

const runBuild = () =>
  spawnSync(command, tauriArgs, {
    cwd: desktopDir,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });

const detachBusyTemporaryDmgs = () => {
  if (process.platform !== "darwin") return false;

  const info = spawnSync("hdiutil", ["info"], {
    cwd: desktopDir,
    encoding: "utf8",
    env: process.env,
  });

  if (info.status !== 0) {
    return false;
  }

  let detachedAny = false;

  for (const block of info.stdout.split("================================================")) {
    if (!block.includes(bundleDir) || !block.includes("rw.") || !block.includes("OpenWork_")) {
      continue;
    }

    const deviceLine = block
      .split(/\r?\n/)
      .find((line) => line.trimStart().startsWith("/dev/disk"));
    const device = deviceLine?.trim().split(/\s+/)[0];

    if (!device) {
      continue;
    }

    const detach = spawnSync("hdiutil", ["detach", device], {
      cwd: desktopDir,
      stdio: "inherit",
      env: process.env,
    });

    if (detach.status === 0) {
      detachedAny = true;
    }
  }

  return detachedAny;
};

let build = runBuild();

if (build.status !== 0 && detachBusyTemporaryDmgs()) {
  console.warn("[openwork] Retrying DMG build after detaching a busy temporary disk image");
  build = runBuild();
}

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

if (!existsSync(looseAppPath)) {
  console.warn(`[openwork] Loose app bundle not found at ${looseAppPath}`);
  process.exit(0);
}

rmSync(parkedAppPath, { recursive: true, force: true });
renameSync(looseAppPath, parkedAppPath);

console.log(`[openwork] Parked loose bundle at ${parkedAppPath}`);
