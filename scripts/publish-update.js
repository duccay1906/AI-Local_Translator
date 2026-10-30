/**
 * Script to publish a new update to the LAN updates directory.
 * 
 * Usage:
 *   node scripts/publish-update.js [releaseNotes]
 * 
 * Example:
 *   node scripts/publish-update.js "Added Screen OCR Visual Translation & LAN Auto-update"
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const RELEASE_DIR = path.join(ROOT_DIR, 'release');
const UPDATES_DIR = path.join(ROOT_DIR, 'updates');

if (!fs.existsSync(RELEASE_DIR)) {
  console.error(`❌ Error: 'release' directory does not exist. Run 'npm run package' first.`);
  process.exit(1);
}

if (!fs.existsSync(UPDATES_DIR)) {
  fs.mkdirSync(UPDATES_DIR, { recursive: true });
}

const pkg = require(path.join(ROOT_DIR, 'package.json'));
const version = pkg.version || '1.0.1';

// Find all .exe files in release directory
const releaseFiles = fs.readdirSync(RELEASE_DIR).filter((f) => f.endsWith('.exe'));
if (releaseFiles.length === 0) {
  console.error(`❌ Error: No .exe files found in ${RELEASE_DIR}. Run 'npm run package' first.`);
  process.exit(1);
}

// Find Installer and Portable builds for THIS specific version (or newest)
const installerExe = releaseFiles.find((f) => /setup/i.test(f) && f.includes(version))
  || releaseFiles.filter((f) => /setup/i.test(f)).sort((a, b) => fs.statSync(path.join(RELEASE_DIR, b)).mtimeMs - fs.statSync(path.join(RELEASE_DIR, a)).mtimeMs)[0];

const portableExe = releaseFiles.find((f) => !/setup/i.test(f) && f.includes(version))
  || releaseFiles.filter((f) => !/setup/i.test(f)).sort((a, b) => fs.statSync(path.join(RELEASE_DIR, b)).mtimeMs - fs.statSync(path.join(RELEASE_DIR, a)).mtimeMs)[0];

let targetInstaller = installerExe;
if (installerExe) {
  const cleanInstaller = installerExe.replace(/\s+/g, '_');
  console.log(`📦 Found Installer build: ${installerExe}`);
  fs.copyFileSync(path.join(RELEASE_DIR, installerExe), path.join(UPDATES_DIR, installerExe));
  if (cleanInstaller !== installerExe) {
    fs.copyFileSync(path.join(RELEASE_DIR, installerExe), path.join(UPDATES_DIR, cleanInstaller));
  }
  targetInstaller = cleanInstaller;
}

let targetPortable = portableExe;
if (portableExe) {
  const cleanPortable = portableExe.replace(/\s+/g, '_');
  console.log(`📦 Found Portable build:  ${portableExe}`);
  fs.copyFileSync(path.join(RELEASE_DIR, portableExe), path.join(UPDATES_DIR, portableExe));
  if (cleanPortable !== portableExe) {
    fs.copyFileSync(path.join(RELEASE_DIR, portableExe), path.join(UPDATES_DIR, cleanPortable));
  }
  targetPortable = cleanPortable;
}

const primaryExe = targetInstaller || targetPortable || releaseFiles[0].replace(/\s+/g, '_');

const releaseNotes = (process.argv.slice(2).join(' ') || 
  `- Version ${version} release.\n- Improved performance, visual OCR dialog enhancements, and bug fixes.`).replace(/\\n/g, '\n');

const manifest = {
  version: version,
  releaseDate: new Date().toISOString().split('T')[0],
  downloadUrl: primaryExe,
  installerUrl: targetInstaller || primaryExe,
  portableUrl: targetPortable || primaryExe,
  releaseNotes: releaseNotes,
};

const manifestPath = path.join(UPDATES_DIR, 'version.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

console.log(`✅ Update published successfully!`);
console.log(`   Version:       ${version}`);
if (installerExe) console.log(`   Installer URL: ${installerExe}`);
if (portableExe)  console.log(`   Portable URL:  ${portableExe}`);
console.log(`   Manifest:      ${manifestPath}`);
console.log(`\nTo start serving updates to the LAN, run:`);
console.log(`   node scripts/serve-updates.js`);
