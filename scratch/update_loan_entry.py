import re

with open('src/pages/finance/LoanEntry.tsx', 'r') as f:
    content = f.read()

# 1. Add imports
content = content.replace("import toast from 'react-hot-toast';", "import toast from 'react-hot-toast';\nimport { validateFinanceForm, ValidationField } from '../../utils/financeValidation';")

# 2. Add refs and errors state
state_insertion = """
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const dateRef = useRef<HTMLInputElement>(null);
  const loanIdRef = useRef<HTMLInputElement>(null);
  const custNameRef = useRef<HTMLInputElement>(null);
  const custPhoneRef = useRef<HTMLInputElement>(null);
  const g1NameRef = useRef<HTMLInputElement>(null);
  const g1PhoneRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const interestRateRef = useRef<HTMLInputElement>(null);
  const durationMonthsRef = useRef<HTMLInputElement>(null);
  const particularsRef = useRef<HTMLInputElement>(null);
  const locAddressRef = useRef<HTMLInputElement>(null);
"""
content = content.replace("  const [loading, setLoading] = useState(true);", state_insertion + "\n  const [loading, setLoading] = useState(true);")

# 3. Add validation logic
validation_logic = """
    const fields: ValidationField[] = [
      { name: 'date', label: 'Date', value: date, required: true, ref: dateRef },
      { name: 'loanId', label: 'Loan Number', value: loanId, required: true, ref: loanIdRef },
      { name: 'custName', label: 'Customer Name', value: custName, required: true, ref: custNameRef },
      { name: 'custPhone', label: 'Customer Phone', value: custPhone, required: true, ref: custPhoneRef },
      { name: 'amount', label: 'Loan Amount', value: amount, required: true, ref: amountRef },
      { name: 'interestRate', label: 'Rate of Interest', value: interestRate, required: true, ref: interestRateRef },
      { name: 'durationMonths', label: 'Period', value: durationMonths, required: true, ref: durationMonthsRef },
      { name: 'particulars', label: 'Particulars', value: particulars, required: true, ref: particularsRef },
    ];

    if (g1Name || g1SelectedId) {
      fields.push({ name: 'g1Name', label: 'Guarantor Name', value: g1Name, required: true, ref: g1NameRef });
      fields.push({ name: 'g1Phone', label: 'Guarantor Phone', value: g1Phone, required: true, ref: g1PhoneRef });
    }
    
    if (locVillage || locMandal || locDistrict || locState || locPincode || locLandmark || locLatitude || locLongitude || collateralImage) {
      fields.push({ name: 'locAddress', label: 'Collateral Address / Location', value: locAddress, required: true, ref: locAddressRef });
    }
    
    const { isValid, errors: newErrors } = validateFinanceForm(fields);
    setErrors(newErrors);
    if (!isValid) return;
"""
content = content.replace("    if (!loanId.trim()) {\n      toast.error('Loan Number is required');\n      return;\n    }\n    if (!custName.trim()) {\n      toast.error('Customer name is required');\n      return;\n    }", validation_logic)

# 4. Modify inputs to add ref and error
# We will do regex replacements for specific value props
replacements = {
    'value={date}': 'ref={dateRef} error={errors.date} onChange={(val) => { setDate(val); setErrors(p => ({...p, date: false})) }} value={date}',
    'value={loanId}': 'ref={loanIdRef} error={errors.loanId} onChange={(val) => { setLoanId(val); setErrors(p => ({...p, loanId: false})) }} value={loanId}',
    'value={custName}': 'ref={custNameRef} error={errors.custName} onChange={(val) => { setCustName(val); setErrors(p => ({...p, custName: false})) }} value={custName}',
    'value={custPhone}': 'ref={custPhoneRef} error={errors.custPhone} onChange={(val) => { setCustPhone(val); setErrors(p => ({...p, custPhone: false})) }} value={custPhone}',
    'value={g1Name}': 'ref={g1NameRef} error={errors.g1Name} onChange={(val) => { setG1Name(val); setErrors(p => ({...p, g1Name: false})) }} value={g1Name}',
    'value={g1Phone}': 'ref={g1PhoneRef} error={errors.g1Phone} onChange={(val) => { setG1Phone(val); setErrors(p => ({...p, g1Phone: false})) }} value={g1Phone}',
    'value={amount}': 'ref={amountRef} error={errors.amount} onChange={(val) => { setAmount(val); setErrors(p => ({...p, amount: false})) }} value={amount}',
    'value={interestRate}': 'ref={interestRateRef} error={errors.interestRate} onChange={(val) => { setInterestRate(val); setErrors(p => ({...p, interestRate: false})) }} value={interestRate}',
    'value={durationMonths}': 'ref={durationMonthsRef} error={errors.durationMonths} onChange={(val) => { setDurationMonths(val); setErrors(p => ({...p, durationMonths: false})) }} value={durationMonths}',
    'value={particulars}': 'ref={particularsRef} error={errors.particulars} onChange={(val) => { setParticulars(val); setErrors(p => ({...p, particulars: false})) }} value={particulars}',
}

for old, new_val in replacements.items():
    # Only replace if it's inside an <Input tag
    # It's easier to just replace `value={...} onChange={...}` with the new one
    # But since onChange might be multiline or single line, let's replace `value={X}` and remove the existing `onChange={setX}`
    pass
    
# Actually, since it's hard to remove the old onChange reliably with regex (it might be on a different line), 
# I will use a regex that matches value and onChange in any order.
def replace_input_props(text, var_name, ref_name):
    # Match value={var} and onChange={setVar} across lines
    pattern = r'value=\{(' + var_name + r')\}\s+onChange=\{set[a-zA-Z0-9]+\}'
    replacement = r'ref={' + ref_name + r'} error={errors.\1} value={\1} onChange={(val) => { set' + var_name[0].upper() + var_name[1:] + r'(val); setErrors(p => ({...p, \1: false})) }}'
    # Also handle the reversed order
    pattern2 = r'onChange=\{set[a-zA-Z0-9]+\}\s+value=\{(' + var_name + r')\}'
    text = re.sub(pattern, replacement, text)
    text = re.sub(pattern2, replacement, text)
    return text

content = replace_input_props(content, 'date', 'dateRef')
content = replace_input_props(content, 'loanId', 'loanIdRef')
content = replace_input_props(content, 'custName', 'custNameRef')
content = replace_input_props(content, 'custPhone', 'custPhoneRef')
content = replace_input_props(content, 'g1Name', 'g1NameRef')
content = replace_input_props(content, 'g1Phone', 'g1PhoneRef')
content = replace_input_props(content, 'amount', 'amountRef')
content = replace_input_props(content, 'interestRate', 'interestRateRef')
content = replace_input_props(content, 'durationMonths', 'durationMonthsRef')
content = replace_input_props(content, 'particulars', 'particularsRef')
content = replace_input_props(content, 'locAddress', 'locAddressRef')

with open('src/pages/finance/LoanEntry.tsx', 'w') as f:
    f.write(content)

