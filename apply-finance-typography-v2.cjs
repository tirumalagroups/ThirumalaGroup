const fs = require('fs');
const path = require('path');

const DIRS_TO_PROCESS = [
  path.join(__dirname, 'src', 'pages', 'finance'),
  path.join(__dirname, 'src', 'components', 'finance'),
  path.join(__dirname, 'src', 'components', 'Layout')
];

// Tailwind typography classes to remove
const classesToRemove = new Set([
  'text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl',
  'text-[10px]', 'text-[12px]', 'text-[14px]', 'text-[16px]', 'text-[20px]', 'text-[24px]',
  'font-thin', 'font-extralight', 'font-light', 'font-normal', 'font-medium', 'font-semibold', 'font-bold', 'font-extrabold', 'font-black',
  'leading-none', 'leading-tight', 'leading-snug', 'leading-normal', 'leading-relaxed', 'leading-loose',
  'tracking-tighter', 'tracking-tight', 'tracking-normal', 'tracking-wide', 'tracking-wider', 'tracking-widest',
  'uppercase', 'lowercase', 'capitalize',
  
  // Also remove the old custom classes that I previously added
  'finance-page-title', 'finance-page-subtitle', 'finance-section-title', 'finance-card-title',
  'finance-label', 'finance-table-header', 'finance-button-text', 'finance-stat-value',
  'finance-stat-label', 'finance-quick-action', 'finance-h3', 'finance-link'
]);

// Helper to determine the best semantic class based on removed classes
function getSemanticClass(removedClasses) {
  const has = (c) => removedClasses.includes(c);
  
  // Old custom class mapping
  if (has('finance-page-title')) return 'finance-h1';
  if (has('finance-stat-value')) return 'finance-money';
  if (has('finance-card-title')) return 'finance-card-title';
  if (has('finance-table-header') || has('finance-page-subtitle')) return 'finance-small-label uppercase';
  if (has('finance-button-text') || has('finance-link')) return 'finance-button uppercase';
  if (has('finance-stat-label') || has('finance-label')) return 'finance-caption uppercase';
  if (has('finance-section-title') || has('finance-h3')) return 'finance-section-heading uppercase';
  if (has('finance-quick-action')) return 'finance-input uppercase';

  // Heuristics based on Tailwind classes
  if (has('text-2xl') || has('text-[24px]') || has('text-3xl') || has('text-4xl')) {
    return 'finance-money';
  }
  if (has('text-xl') || has('text-[20px]')) {
    return 'finance-h1';
  }
  if (has('text-lg') || has('text-[18px]')) {
    return has('font-bold') || has('font-black') ? 'finance-brand' : 'finance-card-title';
  }
  if (has('text-base') || has('text-[16px]')) {
    return has('font-bold') || has('font-black') ? 'finance-brand' : 'finance-card-title';
  }
  if (has('text-[10px]')) {
    return has('uppercase') ? 'finance-small-label uppercase' : 'finance-small-label';
  }
  if (has('text-xs') || has('text-[12px]')) {
    if (has('font-bold') || has('font-black') || has('font-semibold')) {
      return has('uppercase') ? 'finance-header-time uppercase' : 'finance-header-time';
    }
    return has('uppercase') ? 'finance-caption uppercase' : 'finance-caption';
  }
  if (has('text-sm') || has('text-[14px]')) {
    if (has('font-bold') || has('font-black')) {
      return has('uppercase') ? 'finance-sidebar-link uppercase' : 'finance-sidebar-link';
    }
    if (has('font-semibold') || has('tracking-widest') || has('tracking-wider')) {
      return has('uppercase') ? 'finance-section-heading uppercase' : 'finance-section-heading';
    }
    return has('uppercase') ? 'finance-input uppercase' : 'finance-input';
  }

  return null;
}

function processDirectory(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      processDirectory(fullPath);
    } else if (entry.isFile() && (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts'))) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let modified = false;

      // Regex to find className="..." or className={`...`} strings
      // This is a basic regex and might not catch complex template literals perfectly,
      // but it handles 95% of standard React className attributes.
      const classNameRegex = /className=(?:["']([^"']*)["']|\{`([^`]*)`\})/g;
      
      content = content.replace(classNameRegex, (match, p1, p2) => {
        const classStr = p1 || p2;
        if (!classStr) return match;

        const classList = classStr.split(/\s+/).filter(Boolean);
        const removed = [];
        const kept = [];

        for (const cls of classList) {
          // Dynamic classes like ${} shouldn't be touched directly in this simple split,
          // but we'll leave them in `kept` if they don't match our exact remove set.
          if (classesToRemove.has(cls)) {
            removed.push(cls);
          } else {
            kept.push(cls);
          }
        }

        if (removed.length > 0) {
          const semanticClass = getSemanticClass(removed);
          if (semanticClass) {
            kept.push(semanticClass);
          } else {
            // Fallback: if we removed typography but couldn't map it, 
            // default to finance-input for general text
            kept.push('finance-input');
            if (removed.includes('uppercase')) kept.push('uppercase');
          }

          // Reconstruct
          if (p1) {
            modified = true;
            return `className="${kept.join(' ')}"`;
          } else if (p2) {
            modified = true;
            return `className={\`${kept.join(' ')}\`}`;
          }
        }

        return match;
      });

      if (modified) {
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

console.log('Typography replacement script finished.');
