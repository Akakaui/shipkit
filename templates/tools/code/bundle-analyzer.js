const fs = require('fs');
const path = require('path');

function analyzeBundle(projectRoot, options = {}) {
  const { threshold = 500 * 1024, outputDir = 'dist' } = options;

  const distPath = path.join(projectRoot, outputDir);
  if (!fs.existsSync(distPath)) {
    console.error(`Build output not found: ${distPath}`);
    console.log('Run build first');
    return false;
  }

  let totalSize = 0;
  const files = [];

  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.css') || entry.name.endsWith('.html'))) {
        const stats = fs.statSync(fullPath);
        const size = stats.size;
        totalSize += size;
        files.push({ path: path.relative(distPath, fullPath), size });
      }
    }
  }

  scanDir(distPath);

  console.log('\n=== Bundle Analysis ===');
  console.log(`Total size: ${formatBytes(totalSize)}`);
  console.log(`Threshold: ${formatBytes(threshold)}`);
  console.log(`Status: ${totalSize <= threshold ? 'PASS' : 'FAIL'}\n`);

  files
    .sort((a, b) => b.size - a.size)
    .slice(0, 20)
    .forEach(f => {
      console.log(`${formatBytes(f.size).padStart(10)}  ${f.path}`);
    });

  if (totalSize > threshold) {
    console.log('\n⚠ Bundle size exceeds threshold!');
    console.log('Consider: code splitting, tree shaking, removing unused deps');
    return false;
  }

  return true;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

function checkPerformance(projectRoot) {
  const lighthousePath = path.join(projectRoot, 'lighthouse-report.json');
  if (!fs.existsSync(lighthousePath)) {
    console.log('No Lighthouse report found. Run: npx lighthouse <url> --output=json --output-path=lighthouse-report.json');
    return false;
  }

  const report = JSON.parse(fs.readFileSync(lighthousePath, 'utf8'));
  const categories = report.categories;

  console.log('\n=== Lighthouse Scores ===');
  let allPass = true;
  for (const [key, value] of Object.entries(categories)) {
    const score = Math.round(value.score * 100);
    const pass = score >= 90;
    allPass = allPass && pass;
    console.log(`${key.padEnd(20)}: ${score}/100 ${pass ? '✓' : '✗'}`);
  }
  console.log(`Overall: ${allPass ? 'PASS' : 'FAIL'}`);

  return allPass;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const projectRoot = args[0] || process.cwd();
  const command = args[1] || 'bundle';

  switch (command) {
    case 'bundle':
      analyzeBundle(projectRoot);
      break;
    case 'performance':
      checkPerformance(projectRoot);
      break;
    case 'all':
      analyzeBundle(projectRoot);
      checkPerformance(projectRoot);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

module.exports = { analyzeBundle, checkPerformance };