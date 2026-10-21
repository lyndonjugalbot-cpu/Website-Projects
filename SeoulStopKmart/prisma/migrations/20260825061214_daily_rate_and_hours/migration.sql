-- AlterTable: Employee.basePayCentavos -> dailyRateCentavos
ALTER TABLE "Employee" RENAME COLUMN "basePayCentavos" TO "dailyRateCentavos";

-- AlterTable: Payslip.basePayCentavos -> dailyRateCentavos, plus hours worked / regular pay
ALTER TABLE "Payslip" RENAME COLUMN "basePayCentavos" TO "dailyRateCentavos";
ALTER TABLE "Payslip" ADD COLUMN     "hoursWorked" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Payslip" ADD COLUMN     "regularPayCentavos" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Payslip" ALTER COLUMN "hoursWorked" DROP DEFAULT;
ALTER TABLE "Payslip" ALTER COLUMN "regularPayCentavos" DROP DEFAULT;
