const assert = require('assert');

function startOfDay(d) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function toLocalISOString(dateObj) {
  const tzoffset = dateObj.getTimezoneOffset() * 60000;
  return new Date(dateObj.getTime() - tzoffset).toISOString().split('T')[0];
}

// CD calculations simulator based on our code logic
function runCDCalculations(params) {
  const {
    principal,
    rate,
    paymentDate,
    currentDueDate,
    paymentAmount,
    interestPaidInCycle = 0,
    penaltyPaidInCycle = 0
  } = params;

  // Overdue calculations
  const todayMs = startOfDay(paymentDate);
  const dueDateMs = startOfDay(currentDueDate);
  const rawDueDays = Math.round((todayMs - dueDateMs) / (1000 * 60 * 60 * 24));
  const dueDays = Math.max(0, rawDueDays);
  
  const grossInterest = dueDays <= 0 ? 0 : Number(((principal * rate * dueDays) / 30 / 100).toFixed(2));
  const grossPenalty  = dueDays <= 0 ? 0 : Number(((principal * 0.75 * dueDays) / 30 / 100).toFixed(2));

  // Outstanding/pending dues
  const outstandingInterest = Math.max(0, Number((grossInterest - interestPaidInCycle).toFixed(2)));
  const outstandingPenalty  = Math.max(0, Number((grossPenalty - penaltyPaidInCycle).toFixed(2)));

  const displayInterest = dueDays <= 0 ? 0 : outstandingInterest;
  const displayPenalty  = dueDays <= 0 ? 0 : outstandingPenalty;
  const totalDue = displayInterest + displayPenalty;

  // Renewal Due (independent of overdue days)
  const renewalDue = Number((principal * rate / 100).toFixed(2));
  
  // Footer Pending Dues
  const pendingDues = Math.max(0, Number((renewalDue - interestPaidInCycle).toFixed(2)));

  // Total close
  const totalClose = Number((principal + displayInterest + displayPenalty).toFixed(2));

  // Payment allocations
  let penaltyPaid = 0;
  let interestPaid = 0;
  let principalPaid = 0;
  let renewedDays = 0;

  const monthlyInterest = Number((principal * rate / 100).toFixed(2));

  if (paymentAmount > 0) {
    // Check if closing
    const isClosing = paymentAmount >= totalClose;
    if (isClosing) {
      penaltyPaid = outstandingPenalty;
      interestPaid = outstandingInterest;
      principalPaid = Number(Math.max(0, paymentAmount - penaltyPaid - interestPaid).toFixed(2));
      renewedDays = 0;
    } else {
      // split logic
      if (outstandingPenalty > 0) {
        penaltyPaid = Number((paymentAmount * 0.20).toFixed(2));
        interestPaid = Number((paymentAmount * 0.80).toFixed(2));
        if (penaltyPaid > outstandingPenalty) {
          penaltyPaid = outstandingPenalty;
          interestPaid = Number((paymentAmount - penaltyPaid).toFixed(2));
        }
      } else {
        penaltyPaid = 0;
        interestPaid = Number(paymentAmount.toFixed(2));
      }

      if (monthlyInterest > 0) {
        renewedDays = Math.max(0, Math.round((interestPaid / monthlyInterest) * 30));
      }
    }
  }

  // Next Due Date
  let nextDueDate = null;
  if (paymentAmount > 0 && renewedDays > 0) {
    const baseDateMs = Math.max(dueDateMs, todayMs);
    nextDueDate = toLocalISOString(new Date(baseDateMs + renewedDays * 24 * 60 * 60 * 1000));
  }

  // Button Rules
  const enableRenewal = paymentAmount > 0;
  const enablePartial = paymentAmount > renewalDue;
  const enableClose = principal <= 0 && totalDue <= 0;

  return {
    dueDays,
    interest: displayInterest,
    penalty: displayPenalty,
    totalDue,
    renewalDue,
    pendingDues,
    totalClose,
    penaltyPaid,
    interestPaid,
    principalPaid,
    renewedDays,
    nextDueDate,
    enableRenewal,
    enablePartial,
    enableClose
  };
}

console.log("=== FINAL CD LEDGER BUSINESS RULES VERIFICATION ===\n");

// Case 1: Principal = 100,000, Rate = 3%
console.log("Running Case 1: Principal = 100000, Rate = 3%");
const case1 = runCDCalculations({
  principal: 100000,
  rate: 3,
  paymentDate: '2026-06-18',
  currentDueDate: '2026-06-18',
  paymentAmount: 0
});
console.log(case1);
assert.strictEqual(case1.renewalDue, 3000, "Case 1: Renewal Due must be 3000");

// Case 2: Payment = 1000
console.log("\nRunning Case 2: Payment = 1000, Principal = 100000, Rate = 3%");
const case2 = runCDCalculations({
  principal: 100000,
  rate: 3,
  paymentDate: '2026-06-18',
  currentDueDate: '2026-06-18',
  paymentAmount: 1000,
  interestPaidInCycle: 0,
  penaltyPaidInCycle: 0
});
console.log(case2);
assert.strictEqual(case2.renewedDays, 10, "Case 2: Renewed days must be 10");

const case2After = runCDCalculations({
  principal: 100000,
  rate: 3,
  paymentDate: '2026-06-18',
  currentDueDate: '2026-06-18',
  paymentAmount: 1000,
  interestPaidInCycle: 1000, // interest paid is now 1000
  penaltyPaidInCycle: 0
});
console.log("Case 2 Dues After Payment:", case2After.pendingDues);
assert.strictEqual(case2After.pendingDues, 2000, "Case 2: Pending dues after payment must be 2000");

// Case 3: Payment = 3000
console.log("\nRunning Case 3: Payment = 3000, Principal = 100000, Rate = 3%, Payment Date = 10-Jun-26, Due Date = 18-Jun-26");
const case3 = runCDCalculations({
  principal: 100000,
  rate: 3,
  paymentDate: '2026-06-10',
  currentDueDate: '2026-06-18',
  paymentAmount: 3000
});
console.log(case3);
assert.strictEqual(case3.renewedDays, 30, "Case 3: Renewed days must be 30");
assert.strictEqual(case3.nextDueDate, '2026-07-18', "Case 3: Next Due Date must be 18-Jul-26");

// Case 4: Payment Date before Due Date
console.log("\nRunning Case 4: Payment Date = 10-Jun-26, Due Date = 18-Jun-26");
const case4 = runCDCalculations({
  principal: 100000,
  rate: 3,
  paymentDate: '2026-06-10',
  currentDueDate: '2026-06-18',
  paymentAmount: 0
});
console.log(case4);
assert.strictEqual(case4.dueDays, 0, "Case 4: dueDays must be 0");
assert.strictEqual(case4.interest, 0, "Case 4: interest must be 0");
assert.strictEqual(case4.penalty, 0, "Case 4: penalty must be 0");
assert.strictEqual(case4.totalDue, 0, "Case 4: totalDue must be 0");

// Case 5: Payment Date after Due Date (e.g. 10 days late)
console.log("\nRunning Case 5: Payment Date = 28-Jun-26, Due Date = 18-Jun-26");
const case5 = runCDCalculations({
  principal: 100000,
  rate: 3,
  paymentDate: '2026-06-28',
  currentDueDate: '2026-06-18',
  paymentAmount: 0
});
console.log(case5);
assert.strictEqual(case5.dueDays, 10, "Case 5: dueDays must be 10");
assert.strictEqual(case5.interest, 1000, "Case 5: interest must be 1000");
assert.strictEqual(case5.penalty, 250, "Case 5: penalty must be 250");
assert.strictEqual(case5.totalDue, 1250, "Case 5: totalDue must be 1250");
assert.strictEqual(case5.totalClose, 101250, "Case 5: totalClose must be 101250");

// Button Rules Verification
console.log("\nVerifying Button Rules:");
const btnActive = runCDCalculations({
  principal: 100000,
  rate: 3,
  paymentDate: '2026-06-18',
  currentDueDate: '2026-06-18',
  paymentAmount: 4000 // > renewal due of 3000
});
assert.strictEqual(btnActive.enableRenewal, true, "Renewal should be enabled");
assert.strictEqual(btnActive.enablePartial, true, "Partial payment should be enabled cux pay > 3000");
assert.strictEqual(btnActive.enableClose, false, "Close should be disabled");

const btnDuesPaid = runCDCalculations({
  principal: 0,
  rate: 3,
  paymentDate: '2026-06-18',
  currentDueDate: '2026-06-18',
  paymentAmount: 0
});
assert.strictEqual(btnDuesPaid.enableClose, true, "Close should be enabled when principal <= 0 and dues <= 0");

console.log("\n✅ All final CD Ledger business rules validated successfully!");
