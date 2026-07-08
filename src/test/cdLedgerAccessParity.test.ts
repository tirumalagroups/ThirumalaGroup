import { describe, it, expect } from 'vitest';
import { vbaRound, simulateAccessRenewEventChain } from '../services/cdLedgerEngine';

describe('VBA Banker\'s Rounding Boundaries', () => {
  it('should round correctly for edge cases', () => {
    expect(vbaRound(5.26, 0)).toBe(5);
    expect(vbaRound(5.49, 0)).toBe(5);
    expect(vbaRound(5.50, 0)).toBe(6);
    expect(vbaRound(5.51, 0)).toBe(6);
    expect(vbaRound(6.49, 0)).toBe(6);
    expect(vbaRound(6.50, 0)).toBe(6);
    expect(vbaRound(7.49, 0)).toBe(7);
    expect(vbaRound(7.50, 0)).toBe(8);
  });
});

describe('CD UI Accrued Calculations at 28.58 days', () => {
  it('should match the live screenshot values', () => {
    const principal = 750000;
    const rate = 3;
    const penaltyRate = 0.75;
    const exactDueDays = 28.58;

    const dailyInterest = (principal * rate / 100) / 30; // 750
    const dailyPenalty = (principal * penaltyRate / 100) / 30; // 187.5

    const accruedInterest = vbaRound(dailyInterest * exactDueDays, 2);
    const penaltyEligible = vbaRound(exactDueDays, 0) > 5;
    const accruedPenalty = penaltyEligible ? vbaRound(dailyPenalty * exactDueDays, 2) : 0;

    expect(accruedInterest).toBe(21435.00);
    expect(accruedPenalty).toBe(5358.75); 
    expect(vbaRound(187.50 * 28.58, 2)).toBe(5358.75);
    expect(accruedInterest + accruedPenalty).toBe(26793.75);
  });
});

describe('VBA Event-Chain Simulation Parity Checkpoints', () => {
  const mockPosition = (exactDueDays: number): any => ({
    principalBalance: 750000,
    exactDueDays,
    dailyInterest: 750,
    dailyPenalty: 187.5,
    accruedInterest: 0,
    accruedPenalty: 0,
    periodDays: 30,
  });

  it('23-Jun-25 grace threshold parity (no penalty)', () => {
    const pos = mockPosition(5.17); // exactDueDays = 5.17
    const sim = simulateAccessRenewEventChain(pos, 22500);

    expect(vbaRound(pos.exactDueDays, 0)).toBe(5);
    expect(sim.persistedInterest).toBe(22500);
    expect(sim.persistedPenalty).toBe(0);
  });

  it('06-Aug-25 26438/3562 split parity', () => {
    const pos = mockPosition(19.17);
    const sim = simulateAccessRenewEventChain(pos, 30000);

    expect(sim.lostFocusPenalty).toBe(3562);
    expect(sim.finalRDays).toBe(35.25);
    expect(sim.persistedInterest).toBe(26438);
    expect(sim.persistedPenalty).toBe(3562);
  });

  it('₹2 residual penalty cases (e.g. 03-Jun-25 / 03-Feb-26)', () => {
    // 03-Jun-25: exactDueDays = -1.50, checkDueDays = -2, cash = 10000
    const pos = mockPosition(-1.50);
    const sim = simulateAccessRenewEventChain(pos, 10000);

    expect(sim.persistedInterest).toBe(9998);
    expect(sim.persistedPenalty).toBe(2);
  });
});
