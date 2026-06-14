const assert = require('assert');

function startOfDay(dateInput) {
  const d = new Date(dateInput);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function calculateRenewCalculations(paymentDate, dueDateStr, interestRate, penaltyRate, principalBalance) {
  const today = new Date(paymentDate);
  const dueDate = new Date(dueDateStr);

  const rawDueDays = Math.round((startOfDay(today) - startOfDay(dueDate)) / (1000 * 60 * 60 * 24));
  const dueDays = Math.max(0, rawDueDays);
  const daysRemaining = rawDueDays < 0 ? Math.abs(rawDueDays) : 0;

  const grossInterest = dueDays <= 0 ? 0 : Number(((principalBalance * interestRate / 100 / 30) * dueDays).toFixed(2));
  const grossPenalty  = dueDays <= 5 ? 0 : Number(((principalBalance * penaltyRate / 100 / 30) * dueDays).toFixed(2));

  const displayInterest = dueDays <= 0 ? 0 : grossInterest;
  const displayPenalty  = dueDays <= 0 ? 0 : grossPenalty;

  return {
    rawDueDays,
    dueDays,
    daysRemaining,
    interest: displayInterest,
    penalty: displayPenalty,
    totalDue: displayInterest + displayPenalty
  };
}

console.log("=== CD LEDGER NEGATIVE DUE DAYS VALIDATION ===\n");

const result = calculateRenewCalculations('2026-06-10', '2026-06-18', 3, 0.75, 100000);
console.log("Calculated Result for Payment Date = 10-Jun-26, Due Date = 18-Jun-26:");
console.log(result);

assert.strictEqual(result.dueDays, 0, "Due days must be 0");
assert.strictEqual(result.daysRemaining, 8, "Days remaining must be 8");
assert.strictEqual(result.interest, 0, "Interest must be 0");
assert.strictEqual(result.penalty, 0, "Penalty must be 0");
assert.strictEqual(result.totalDue, 0, "Total Due must be 0");

console.log("\n✅ All assertions passed successfully!");
