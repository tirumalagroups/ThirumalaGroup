const fs = require('fs');
const path = require('path');

const DIRS_TO_PROCESS = [
  path.join(__dirname, 'src', 'pages', 'finance'),
  path.join(__dirname, 'src', 'components', 'finance'),
  path.join(__dirname, 'src', 'components', 'Layout')
];

function processDirectory(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      processDirectory(fullPath);
    } else if (entry.isFile() && (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts'))) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const originalContent = content;

      // Replace font-black with font-bold
      content = content.replace(/\bfont-black\b/g, 'font-bold');

      // Also replace font-extrabold with font-semibold just in case
      content = content.replace(/\bfont-extrabold\b/g, 'font-semibold');

      if (content !== originalContent) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated: ${fullPath}`);
      }
    }
  }
}

DIRS_TO_PROCESS.forEach(dir => {
  if (fs.existsSync(dir)) {
    processDirectory(dir);
  }
});

console.log('Bulk font weight replacement complete.');
