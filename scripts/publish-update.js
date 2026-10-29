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

// Find all .exe files in release directory
const releaseFiles = fs.readdirSync(RELEASE_DIR).filter((f) => f.endsWith('.exe'));
if (releaseFiles.length === 0) {
  console.error(`❌ Error: No .exe files found in ${RELEASE_DIR}. Run 'npm run package' first.`);
  process.exit(1);
}

// Sort by modification time descending to find latest build
releaseFiles.sort((a, b) => {
  const statA = fs.statSync(path.join(RELEASE_DIR, a));
  const statB = fs.statSync(path.join(RELEASE_DIR, b));
  return statB.mtimeMs - statA.mtimeMs;
});

const latestExe = releaseFiles[0];
const sourceExePath = path.join(RELEASE_DIR, latestExe);
const destExePath = path.join(UPDATES_DIR, latestExe);

console.log(`📦 Found latest build: ${latestExe}`);
console.log(`📋 Copying to updates directory...`);
fs.copyFileSync(sourceExePath, destExePath);

const pkg = require(path.join(ROOT_DIR, 'package.json'));
const version = pkg.version || '1.0.1';
const releaseNotes = process.argv.slice(2).join(' ') || 
  `- Version ${version} release.\n- Improved performance, visual OCR dialog enhancements, and bug fixes.`;

const manifest = {
  version: version,
  releaseDate: new Date().toISOString().split('T')[0],
  downloadUrl: latestExe,
  releaseNotes: releaseNotes,
};

const manifestPath = path.join(UPDATES_DIR, 'version.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

console.log(`✅ Update published successfully!`);
console.log(`   Version: ${version}`);
console.log(`   File: ${latestExe} (${(fs.statSync(destExePath).size / 1024 / 1024).toFixed(2)} MB)`);
console.log(`   Manifest written to: ${manifestPath}`);
console.log(`\nTo start serving updates to the LAN, run:`);
console.log(`   node scripts/serve-updates.js`);
