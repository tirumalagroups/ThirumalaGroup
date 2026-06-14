import re

with open('src/pages/finance/OldDataEntry.tsx', 'r') as f:
    content = f.read()

# Add imports
content = content.replace("import toast from 'react-hot-toast';", "import toast from 'react-hot-toast';\nimport { validateFinanceForm, ValidationField } from '../../utils/financeValidation';")

# Add refs and errors state
state_insertion = """
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const custNameRef = useRef<HTMLInputElement>(null);
  const loanNumberRef = useRef<HTMLInputElement>(null);
  const rateRef = useRef<HTMLInputElement>(null);
  const loanDateRef = useRef<HTMLInputElement>(null);
  const billingPeriodRef = useRef<HTMLInputElement>(null);
  const principalRef = useRef<HTMLInputElement>(null);
"""
# Insert after loading state or similar
content = content.replace("  const [saving, setSaving] = useState(false);", "  const [saving, setSaving] = useState(false);\n" + state_insertion)

# Replace validation logic in handleSubmit
validation_logic = """
    const fields: ValidationField[] = [
      { name: 'loanNumber', label: 'Loan Number', value: loanNumber, required: true, ref: loanNumberRef },
      { name: 'loanDate', label: 'Loan Date', value: loanDate, required: true, ref: loanDateRef },
      { name: 'principal', label: 'Principal', value: principal, required: true, ref: principalRef },
      { name: 'rate', label: 'Rate', value: rate, required: true, ref: rateRef },
      { name: 'billingPeriod', label: 'Billing Period', value: billingPeriod, required: true, ref: billingPeriodRef },
    ];
    if (!selectedCustomerId) {
      fields.push({ name: 'custName', label: 'Customer Name', value: custName, required: true, ref: custNameRef });
    }
    
    const { isValid, errors: newErrors } = validateFinanceForm(fields);
    setErrors(newErrors);
    if (!isValid) return;

    if (parsedPrincipal <= 0) {
      toast.error('Principal must be greater than 0');
      return;
    }
"""
content = re.sub(
    r"    if \(\!loanNumber\.trim\(\)\) \{[\s\S]*?if \(\!selectedCustomerId && \!custName\.trim\(\)\) \{[\s\S]*?return;\n    \}",
    validation_logic,
    content
)

# Replace Input tags with refs and errors
def replace_input_props(text, var_name, ref_name):
    # Match value={var} and onChange={setVar}
    pattern = r'value=\{(' + var_name + r')\}\s+onChange=\{set[a-zA-Z0-9]+\}'
    replacement = r'ref={' + ref_name + r'} error={errors.\1} value={\1} onChange={(val) => { set' + var_name[0].upper() + var_name[1:] + r'(val); setErrors(p => ({...p, \1: false})) }}'
    pattern2 = r'onChange=\{set[a-zA-Z0-9]+\}\s+value=\{(' + var_name + r')\}'
    text = re.sub(pattern, replacement, text)
    text = re.sub(pattern2, replacement, text)
    return text

content = replace_input_props(content, 'custName', 'custNameRef')
content = replace_input_props(content, 'loanNumber', 'loanNumberRef')
content = replace_input_props(content, 'rate', 'rateRef')
content = replace_input_props(content, 'loanDate', 'loanDateRef')
content = replace_input_props(content, 'billingPeriod', 'billingPeriodRef')
content = replace_input_props(content, 'principal', 'principalRef')

with open('src/pages/finance/OldDataEntry.tsx', 'w') as f:
    f.write(content)
