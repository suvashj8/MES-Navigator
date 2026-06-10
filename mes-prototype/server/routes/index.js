import { registerReferenceRoutes } from './reference.js';
import { registerStaffRoutes } from './staff.js';
import { registerProductsRoutes } from './products.js';
import { registerProductMasterRoutes } from './productMaster.js';
import { registerActivityMappingRoutes } from './activityMappings.js';
import { registerGradingStandardsRoutes } from './gradingStandards.js';
import { registerDailyGradingRoutes } from './dailyGrading.js';
import { registerReportsRoutes } from './reports.js';
import { registerDashboardRoutes } from './dashboard.js';
import { registerMissingStandardsRoutes } from './missingStandards.js';
import { registerUsersRoutes } from './users.js';
import { registerDepartmentRoutes } from './departments.js';

export function registerApiRoutes(app) {
  registerReferenceRoutes(app);
  registerDepartmentRoutes(app);
  registerStaffRoutes(app);
  registerProductsRoutes(app);
  registerProductMasterRoutes(app);
  registerActivityMappingRoutes(app);
  registerGradingStandardsRoutes(app);
  registerDailyGradingRoutes(app);
  registerReportsRoutes(app);
  registerDashboardRoutes(app);
  registerMissingStandardsRoutes(app);
  registerUsersRoutes(app);
}
