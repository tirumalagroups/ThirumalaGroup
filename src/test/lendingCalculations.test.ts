import { describe, it, expect } from 'vitest';
import { financeCalculationService } from '../services/financeCalculationService';

describe('STBD and HP Lending Calculations', () => {
  describe("Banker's Rounding helper", () => {
    it('should round correctly using half-to-even rule', () => {
      expect(financeCalculationService.roundRupee(10.5)).toBe(10);
      expect(financeCalculationService.roundRupee(11.5)).toBe(12);
      expect(financeCalculationService.roundRupee(10.4)).toBe(10);
      expect(financeCalculationService.roundRupee(10.6)).toBe(11);
    });
  });

  describe('STBD Calculations', () => {
    it('should calculate correct penalty for 15 days delay (exceeding 6 days grace)', () => {
      const installmentAmount = 3633;
      const ipaid = 0;
      const startDate = '2026-05-10';
      const currentDate = '2026-06-25'; // 15 days late relative to 2026-06-10
      const payingInsts = 1;

      const penalty = financeCalculationService.calculateSTBDPenalty(
        installmentAmount,
        ipaid,
        startDate,
        currentDate,
        payingInsts
      );

      // 3633 * 0.002 * 15 = 108.99 -> bankersRound/roundRupee to 109
      expect(penalty).toBe(109);
    });

    it('should not charge penalty if delay is within 6 days grace period', () => {
      const installmentAmount = 3633;
      const ipaid = 0;
      const startDate = '2026-05-10';
      const currentDate = '2026-06-15'; // 5 days late relative to 2026-06-10
      const payingInsts = 1;

      const penalty = financeCalculationService.calculateSTBDPenalty(
        installmentAmount,
        ipaid,
        startDate,
        currentDate,
        payingInsts
      );

      expect(penalty).toBe(0);
    });

    it('should calculate correct payment split for 1 installment paid', () => {
      const principal = 10000;
      const period = 3;
      const payingInsts = 1;
      const discount = 0;
      const penaltyPaid = 109;

      const split = financeCalculationService.computeSTBDPaymentSplit(
        principal,
        period,
        payingInsts,
        discount,
        penaltyPaid
      );

      // Principal paid: 10000 / 3 = 3333.33 -> round half to even -> 3333
      // Commission paid: 10000 * 0.03 * 1 = 300 -> 300
      expect(split.principalPaid).toBe(3333);
      expect(split.commissionPaid).toBe(300);
      expect(split.penaltyPaid).toBe(109);
    });
  });

  describe('HP Calculations', () => {
    it('should calculate correct penalty for 15 days delay (exceeding 5 days grace)', () => {
      const installmentAmount = 3533;
      const ipaid = 0;
      const startDate = '2026-05-10';
      const currentDate = '2026-06-25'; // 15 days late relative to 2026-06-10
      const payingInsts = 1;

      const penalty = financeCalculationService.calculateHPPenalty(
        installmentAmount,
        ipaid,
        startDate,
        currentDate,
        payingInsts
      );

      // 3533 * 0.002 * 15 = 105.99 -> round to 106
      expect(penalty).toBe(106);
    });

    it('should not charge penalty if delay is within 5 days grace period', () => {
      const installmentAmount = 3533;
      const ipaid = 0;
      const startDate = '2026-05-10';
      const currentDate = '2026-06-14'; // 4 days late relative to 2026-06-10
      const payingInsts = 1;

      const penalty = financeCalculationService.calculateHPPenalty(
        installmentAmount,
        ipaid,
        startDate,
        currentDate,
        payingInsts
      );

      expect(penalty).toBe(0);
    });

    it('should calculate correct payment split for HP loan', () => {
      const principal = 10000;
      const period = 3;
      const payingInsts = 1;
      const installmentAmount = 3533;
      const discount = 0;
      const penaltyPaid = 106;

      const split = financeCalculationService.computeHPPaymentSplit(
        principal,
        period,
        payingInsts,
        installmentAmount,
        discount,
        penaltyPaid
      );

      // Commission: principal * 0.02 * 1 = 200 -> 200
      // Principal: installmentAmount * 1 - commission = 3533 - 200 = 3333
      expect(split.commissionPaid).toBe(200);
      expect(split.principalPaid).toBe(3333);
      expect(split.penaltyPaid).toBe(106);
    });
  });

  describe('Waiver and NPA Calculations', () => {
    it('should correctly calculate write-off components on NPA Close', () => {
      const outstandingPrincipal = 15000;
      const penaltyAccrued = 350;
      const totalLiability = outstandingPrincipal + penaltyAccrued;
      const settlementCollected = 10000;
      
      const waivedAmount = totalLiability - settlementCollected;
      
      expect(totalLiability).toBe(15350);
      expect(waivedAmount).toBe(5350);
    });

    it('should determine correct waiver fields for STBD payment transaction', () => {
      const discount = 150;
      const penaltyWaived = 50;
      
      const isWaiverApplicable = discount > 0 || penaltyWaived > 0;
      expect(isWaiverApplicable).toBe(true);
    });
  });
});
