/**
 * Split monolithic index.js into route modules.
 * Run: node scripts/split-routes.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const serverDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcPath = path.join(serverDir, 'index.js');
const lines = fs.readFileSync(srcPath, 'utf8').split(/\r?\n/);

function pick(ranges) {
  const out = [];
  for (const [start, end] of ranges) {
    out.push(...lines.slice(start - 1, end));
  }
  return out.join('\n');
}

function writeRoute(relPath, registerFn, body, importBlock) {
  const content = `${importBlock.trim()}\n\nexport function ${registerFn}(app) {\n${body}\n}\n`;
  const out = path.join(serverDir, relPath);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, content, 'utf8');
  console.log('wrote', relPath);
}

writeRoute(
  'routes/auth.js',
  'registerAuthRoutes',
  pick([
    [59, 81],
    [86, 89],
  ]),
  `import bcrypt from 'bcryptjs';
import { run, one } from '../db.js';
import { asyncHandler } from '../asyncHandler.js';
import { login } from '../auth.js';
import { requireAuth } from '../middleware.js';
import { resolveDepartment } from '../scope.js';`
);

writeRoute(
  'routes/reference.js',
  'registerReferenceRoutes',
  pick([
    [91, 96],
    [158, 187],
    [1524, 1532],
  ]),
  `import { all } from '../db.js';
import { asyncHandler } from '../asyncHandler.js';
import { requirePermission } from '../middleware.js';
import { resolveDepartment } from '../scope.js';
import { adToBs, bsToAd, todayPair } from '../nepaliDate.js';`
);

writeRoute(
  'routes/staff.js',
  'registerStaffRoutes',
  pick([[99, 155]]),
  `import { one, all, run } from '../db.js';
import { asyncHandler } from '../asyncHandler.js';
import { can } from '../auth.js';
import { requirePermission } from '../middleware.js';
import { resolveDepartment } from '../scope.js';
import { assertPersonName } from '../validateText.js';`
);

writeRoute(
  'routes/products.js',
  'registerProductsRoutes',
  pick([[228, 428]]),
  `import { one, all, run, transaction } from '../db.js';
import { asyncHandler } from '../asyncHandler.js';
import { requirePermission } from '../middleware.js';
import { resolveDepartment } from '../scope.js';
import { assertNonNegative } from '../validateNumbers.js';
import { getProductMasterByCode } from '../lib/productMasterHelpers.js';`
);

writeRoute(
  'routes/productMaster.js',
  'registerProductMasterRoutes',
  pick([
    [502, 546],
    [634, 959],
  ]),
  `import { one, all, run, transaction } from '../db.js';
import { asyncHandler } from '../asyncHandler.js';
import { requirePermission } from '../middleware.js';
import { streamProductMasterPdf } from '../pdf.js';
import { cascadeProductMasterCodeChange } from '../productMasterLink.js';
import { assertNonNegative } from '../validateNumbers.js';
import {
  normalizeVatCategory,
  asNullableText,
  asNullableNumber,
  asBoolInt,
  splitProductMasterPayload,
  replaceProductAccountMapping,
  replaceProductExciseMapping,
  getProductMasterBundle,
  buildProductMasterCsv,
} from '../lib/productMasterHelpers.js';`
);

writeRoute(
  'routes/activityMappings.js',
  'registerActivityMappingRoutes',
  pick([[961, 1007]]),
  `import { all, run } from '../db.js';
import { asyncHandler } from '../asyncHandler.js';
import { requirePermission } from '../middleware.js';`
);

writeRoute(
  'routes/gradingStandards.js',
  'registerGradingStandardsRoutes',
  pick([
    [1010, 1131],
  ]),
  `import { one, all, run } from '../db.js';
import { asyncHandler } from '../asyncHandler.js';
import { requirePermission } from '../middleware.js';
import { resolveDepartment } from '../scope.js';
import { calculateGrade, findStandard } from '../grading.js';
import { resolveGradingStandardProduct } from '../lib/gradingStandardResolve.js';
import {
  getGradingStandardsLinkSummary,
  linkGradingStandardsToProductMaster,
} from '../productMasterLink.js';`
);

writeRoute(
  'routes/dailyGrading.js',
  'registerDailyGradingRoutes',
  pick([[1134, 1331]]),
  `import { one, all, run } from '../db.js';
import { asyncHandler } from '../asyncHandler.js';
import { requirePermission } from '../middleware.js';
import { resolveDepartment } from '../scope.js';
import { calculateGrade, findStandard } from '../grading.js';
import { pickAuditValues, writeDailyAudit } from '../lib/dailyGradingAudit.js';
import { can } from '../auth.js';`
);

writeRoute(
  'routes/reports.js',
  'registerReportsRoutes',
  pick([
    [1334, 1370],
    [1583, 1637],
  ]),
  `import { asyncHandler } from '../asyncHandler.js';
import { requirePermission } from '../middleware.js';
import { resolveDepartment } from '../scope.js';
import { getScorecards, getPeriodRange, getWorkerDetail } from '../reports.js';
import { streamScorecardsPdf, streamWorkerPdf } from '../pdf.js';`
);

writeRoute(
  'routes/dashboard.js',
  'registerDashboardRoutes',
  pick([[1373, 1455]]),
  `import { one, all } from '../db.js';
import { asyncHandler } from '../asyncHandler.js';
import { requirePermission } from '../middleware.js';
import { resolveDepartment } from '../scope.js';
import { getDashboardTrend } from '../reports.js';`
);

writeRoute(
  'routes/missingStandards.js',
  'registerMissingStandardsRoutes',
  pick([[1458, 1522]]),
  `import { one, all, run } from '../db.js';
import { asyncHandler } from '../asyncHandler.js';
import { requirePermission } from '../middleware.js';
import { resolveDepartment } from '../scope.js';`
);

writeRoute(
  'routes/users.js',
  'registerUsersRoutes',
  pick([[1534, 1580]]),
  `import bcrypt from 'bcryptjs';
import { one, all, run } from '../db.js';
import { asyncHandler } from '../asyncHandler.js';
import { requirePermission } from '../middleware.js';
import { assertPersonName } from '../validateText.js';`
);

console.log('Done. Review routes/*.js then replace index.js with app bootstrap.');
