-- Удалена свободная строка специализаций; витрина опирается на categories / servicesLine / bookableServices.
ALTER TABLE "Specialist" DROP COLUMN IF EXISTS "specialtiesLine";
