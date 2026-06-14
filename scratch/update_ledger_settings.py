with open('src/pages/finance/LedgerSettings.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    'Rate (% / Month) - Default {DEFAULT_LEDGER_SETTINGS[type.code].rate}</label>',
    'Rate (% / Month) - Default {DEFAULT_LEDGER_SETTINGS[type.code].rate} <span className="text-red-500 ml-0.5">*</span></label>'
)

content = content.replace(
    'Overdue (% / Month) - Default {DEFAULT_LEDGER_SETTINGS[type.code].overdue}</label>',
    'Overdue (% / Month) - Default {DEFAULT_LEDGER_SETTINGS[type.code].overdue} <span className="text-red-500 ml-0.5">*</span></label>'
)

content = content.replace(
    'Method - Default {DEFAULT_LEDGER_SETTINGS[type.code].method}</label>',
    'Method - Default {DEFAULT_LEDGER_SETTINGS[type.code].method} <span className="text-red-500 ml-0.5">*</span></label>'
)

content = content.replace(
    'Days / Year - Default {DEFAULT_LEDGER_SETTINGS[type.code].days_per_year}</label>',
    'Days / Year - Default {DEFAULT_LEDGER_SETTINGS[type.code].days_per_year} <span className="text-red-500 ml-0.5">*</span></label>'
)

content = content.replace(
    'Principal Rolls On Renewal</label>',
    'Principal Rolls On Renewal <span className="text-red-500 ml-0.5">*</span></label>'
)

with open('src/pages/finance/LedgerSettings.tsx', 'w') as f:
    f.write(content)
