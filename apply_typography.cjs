const fs = require('fs');
const path = require('path');

const indexCssPath = path.join(__dirname, 'src/index.css');
let indexCss = fs.readFileSync(indexCssPath, 'utf8');

const typographyClasses = `
  /* Peek Typography System */
  .peek-h1 { @apply text-[20px] font-semibold leading-[1.40] tracking-[0.16px]; }
  .peek-header { @apply text-[16px] font-bold leading-[1.50] tracking-[0.16px]; }
  .peek-h3 { @apply text-[16px] font-semibold leading-[1.50] tracking-[0.16px]; }
  .peek-link { @apply text-[14px] font-bold leading-[1.43] tracking-[0.16px]; }
  .peek-subheading { @apply text-[14px] font-semibold leading-[1.43] tracking-[0.16px]; }
  .peek-button { @apply text-[14px] font-medium leading-[1.43] tracking-[0.16px]; }
  .peek-caption { @apply text-[12px] font-bold leading-[1.33] tracking-[0.16px]; }
  .peek-caption-12 { @apply text-[12px] font-semibold leading-[1.33] tracking-[0.3px]; }
  .peek-label { @apply text-[12px] font-medium leading-[1.33] tracking-[0.16px]; }
  .peek-small { @apply text-[10px] font-bold leading-[1.25] tracking-[0.16px]; }
  .peek-small-10 { @apply text-[10px] font-semibold leading-[1.50] tracking-[0.5px]; }
`;

if (!indexCss.includes('.peek-h1')) {
  indexCss = indexCss.replace('@layer components {', '@layer components {\n' + typographyClasses);
  fs.writeFileSync(indexCssPath, indexCss);
}

const loanEntryPath = path.join(__dirname, 'src/pages/finance/LoanEntry.tsx');
let loanEntry = fs.readFileSync(loanEntryPath, 'utf8');

loanEntry = loanEntry.replace(/finance-h1/g, 'peek-h1');
loanEntry = loanEntry.replace(/finance-header-time uppercase/g, 'peek-h3 uppercase');
loanEntry = loanEntry.replace(/finance-small-label/g, 'peek-small-10');
loanEntry = loanEntry.replace(/finance-button/g, 'peek-button');
loanEntry = loanEntry.replace(/finance-header-time(.*?>\s*<X.*?CLEAR)/gs, 'peek-button uppercase$1');
loanEntry = loanEntry.replace(/finance-caption uppercase/g, 'peek-label uppercase');
loanEntry = loanEntry.replace(/finance-header-time/g, 'peek-caption-12'); 
loanEntry = loanEntry.replace(/finance-input/g, 'peek-button');

fs.writeFileSync(loanEntryPath, loanEntry);
console.log('Typography applied successfully.');
