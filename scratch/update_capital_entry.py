import re

with open('src/pages/finance/CapitalEntry.tsx', 'r') as f:
    content = f.read()

# Add imports
content = content.replace("import toast from 'react-hot-toast';", "import toast from 'react-hot-toast';\nimport { validateFinanceForm, ValidationField } from '../../utils/financeValidation';")

# Add refs and errors state
state_insertion = """
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const dateRef = React.useRef<HTMLInputElement>(null);
  const partnerIdRef = React.useRef<HTMLSelectElement>(null);
  const particularsRef = React.useRef<HTMLInputElement>(null);
  const creditRef = React.useRef<HTMLInputElement>(null);
  const debitRef = React.useRef<HTMLInputElement>(null);
"""
content = content.replace("  const [saving, setSaving] = useState(false);", "  const [saving, setSaving] = useState(false);\n" + state_insertion)

# Validation logic in handleSubmit
validation_logic_save = """
    const creditAmt = Number(credit) || 0;
    const debitAmt = Number(debit) || 0;

    const fields: ValidationField[] = [
      { name: 'date', label: 'Date', value: date, required: true, ref: dateRef },
      { name: 'partnerId', label: 'Partner', value: partnerId, required: true, ref: partnerIdRef as any },
      { 
        name: 'amount_xor', 
        label: 'Credit or Debit', 
        value: 'checked', 
        required: true, 
        customValidation: () => (creditAmt > 0 || debitAmt > 0) ? null : 'Please enter a valid Credit or Debit amount greater than zero'
      }
    ];

    const { isValid, errors: newErrors } = validateFinanceForm(fields);
    setErrors(newErrors);
    if (!isValid) return;
"""

content = re.sub(
    r"    if \(\!partnerId\) \{[\s\S]*?return;\n    \}",
    validation_logic_save,
    content
)

# Apply ref and error className to inputs
# Date
content = content.replace(
    'onChange={(e) => setDate(e.target.value)}',
    'onChange={(e) => { setDate(e.target.value); setErrors(p => ({...p, date: false})) }}\n                    ref={dateRef}\n                    className={`w-full bg-white border rounded-lg p-2 text-slate-800 focus:outline-none h-9 shadow-sm finance-header-time ${errors.date ? "border-red-500 bg-red-50 focus:ring-1 focus:ring-red-500" : "border-slate-200 focus:ring-1 focus:ring-slate-900"}`}'
)
content = content.replace(
    'className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none h-9 shadow-sm finance-header-time"',
    ''
)

# Partner Select
content = content.replace(
    'onChange={(e) => setPartnerId(e.target.value)}',
    'onChange={(e) => { setPartnerId(e.target.value); setErrors(p => ({...p, partnerId: false})) }}\n                    ref={partnerIdRef as any}\n                    className={`w-full bg-white border rounded-lg p-2 text-slate-800 focus:outline-none h-9 shadow-sm finance-header-time ${errors.partnerId ? "border-red-500 bg-red-50 focus:ring-1 focus:ring-red-500" : "border-slate-200 focus:ring-1 focus:ring-slate-900"}`}'
)
content = content.replace(
    'className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none h-9 shadow-sm finance-header-time"',
    ''
)

# Credit
content = content.replace(
    'onChange={(e) => handleCreditChange(e.target.value)}',
    'onChange={(e) => { handleCreditChange(e.target.value); setErrors(p => ({...p, amount_xor: false})) }}\n                    ref={creditRef}\n                    className={`w-full bg-white border rounded-lg p-2 text-slate-800 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400 shadow-sm finance-header-time ${errors.amount_xor ? "border-red-500 bg-red-50 focus:ring-1 focus:ring-red-500" : "border-slate-200 focus:ring-1 focus:ring-slate-900"}`}'
)
content = content.replace(
    'className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400 shadow-sm finance-header-time"',
    ''
)

# Debit
content = content.replace(
    'onChange={(e) => handleDebitChange(e.target.value)}',
    'onChange={(e) => { handleDebitChange(e.target.value); setErrors(p => ({...p, amount_xor: false})) }}\n                    ref={debitRef}\n                    className={`w-full bg-white border rounded-lg p-2 text-slate-800 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400 shadow-sm finance-header-time ${errors.amount_xor ? "border-red-500 bg-red-50 focus:ring-1 focus:ring-red-500" : "border-slate-200 focus:ring-1 focus:ring-slate-900"}`}'
)
content = content.replace(
    'className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400 shadow-sm finance-header-time"',
    ''
)

with open('src/pages/finance/CapitalEntry.tsx', 'w') as f:
    f.write(content)
