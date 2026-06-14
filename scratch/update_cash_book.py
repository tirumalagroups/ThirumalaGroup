import re

with open('src/pages/finance/CashBook.tsx', 'r') as f:
    content = f.read()

# Add imports
content = content.replace("import toast from 'react-hot-toast';", "import toast from 'react-hot-toast';\nimport { validateFinanceForm, ValidationField } from '../../utils/financeValidation';")

# Add refs and errors state
state_insertion = """
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const entryDateRef = React.useRef<HTMLInputElement>(null);
  const headOfAccountRef = React.useRef<HTMLSelectElement>(null);
  const particularsRef = React.useRef<HTMLTextAreaElement>(null);
  const creditRef = React.useRef<HTMLInputElement>(null);
  const debitRef = React.useRef<HTMLInputElement>(null);
  const newAccountNameRef = React.useRef<HTMLInputElement>(null);
"""
content = content.replace("  const [saving, setSaving] = useState(false);", "  const [saving, setSaving] = useState(false);\n" + state_insertion)

# Validation logic in handleSaveEntry
validation_logic_save = """
    const creditVal = Number(credit) || 0;
    const debitVal = Number(debit) || 0;

    const fields: ValidationField[] = [
      { name: 'entryDate', label: 'Date', value: entryDate, required: true, ref: entryDateRef },
      { name: 'headOfAccount', label: 'Head of A/C', value: headOfAccount, required: true, ref: headOfAccountRef as any },
      { name: 'particulars', label: 'Particulars', value: particulars, required: true, ref: particularsRef as any },
      { 
        name: 'amount_xor', 
        label: 'Credit or Debit', 
        value: 'checked', 
        required: true, 
        customValidation: () => (creditVal > 0 || debitVal > 0) ? null : 'Please enter either Credit or Debit amount greater than 0'
      }
    ];

    const { isValid, errors: newErrors } = validateFinanceForm(fields);
    setErrors(newErrors);
    if (!isValid) return;
"""

content = re.sub(
    r"    if \(\!entryDate\) \{[\s\S]*?return;\n    \}",
    validation_logic_save,
    content
)

# Validation logic in handleCreateAccountSubmit
validation_logic_create = """
    const fields: ValidationField[] = [
      { name: 'newAccountName', label: 'Account Name', value: newAccountName, required: true, ref: newAccountNameRef }
    ];

    const { isValid, errors: newErrors } = validateFinanceForm(fields);
    setErrors(newErrors);
    if (!isValid) return;
"""

content = re.sub(
    r"    if \(\!newAccountName\.trim\(\)\) \{\n      toast\.error\('Account Name is required'\);\n      return;\n    \}",
    validation_logic_create,
    content
)


# Replace Input components props
def replace_input_props(text, var_name, ref_name, setter_name=None):
    if setter_name is None:
        setter_name = 'set' + var_name[0].upper() + var_name[1:]
    pattern = r'value=\{(' + var_name + r')\}\s+onChange=\{(' + setter_name + r')\}'
    replacement = r'ref={' + ref_name + r'} error={errors.\1} value={\1} onChange={(val) => { \2(val); setErrors(p => ({...p, \1: false})) }}'
    pattern2 = r'onChange=\{(' + setter_name + r')\}\s+value=\{(' + var_name + r')\}'
    text = re.sub(pattern, replacement, text)
    text = re.sub(pattern2, replacement, text)
    return text

content = replace_input_props(content, 'entryDate', 'entryDateRef')
content = replace_input_props(content, 'credit', 'creditRef', 'handleCreditChange')
content = replace_input_props(content, 'debit', 'debitRef', 'handleDebitChange')
content = replace_input_props(content, 'newAccountName', 'newAccountNameRef')

# For select (headOfAccount) and textarea (particulars)
content = content.replace("onChange={(e) => handleAccountChange(e.target.value)}", "onChange={(e) => { handleAccountChange(e.target.value); setErrors(p => ({...p, headOfAccount: false})) }}\n                  ref={headOfAccountRef}\n                  className={`w-full bg-white border rounded-lg p-2 text-slate-850 focus:outline-none h-10 shadow-sm finance-header-time ${errors.headOfAccount ? 'border-red-500 bg-red-50 focus:ring-1 focus:ring-red-500' : 'border-slate-200 focus:ring-1 focus:ring-slate-955'}`}")
# Remove old className
content = content.replace("                  className=\"w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-850 focus:ring-1 focus:ring-slate-955 focus:outline-none h-10 shadow-sm finance-header-time\"", "")

content = content.replace("onChange={(e) => setParticulars(e.target.value)}", "onChange={(e) => { setParticulars(e.target.value); setErrors(p => ({...p, particulars: false})) }}\n                  ref={particularsRef as any}\n                  className={`w-full bg-white border rounded-lg p-2 text-slate-855 focus:outline-none h-24 shadow-sm finance-header-time ${errors.particulars ? 'border-red-500 bg-red-50 focus:ring-1 focus:ring-red-500' : 'border-slate-200 focus:ring-1 focus:ring-slate-950'}`}")
# Remove old className
content = content.replace("                  className=\"w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-855 focus:ring-1 focus:ring-slate-950 focus:outline-none h-24 shadow-sm finance-header-time\"", "")


with open('src/pages/finance/CashBook.tsx', 'w') as f:
    f.write(content)
