// Shared payroll math for payslip generation (app/api/admin/payslips) and
// the live preview in components/admin/PayslipGenerator.tsx, so the two
// never drift apart.

// Standard full-time work day, used to derive an hourly rate from an
// employee's daily rate. Not currently admin-configurable.
export const STANDARD_HOURS_PER_DAY = 8;

/** Regular pay for hours worked, derived from a daily rate. */
export function computeRegularPayCentavos(dailyRateCentavos: number, hoursWorked: number): number {
  const hourlyRateCentavos = dailyRateCentavos / STANDARD_HOURS_PER_DAY;
  return Math.round(hourlyRateCentavos * hoursWorked);
}

/** Holiday bonus amount for one holiday entry — a percentage of the daily rate. */
export function computeHolidayBonusCentavos(dailyRateCentavos: number, bonusPercent: number): number {
  return Math.round((dailyRateCentavos * bonusPercent) / 100);
}
