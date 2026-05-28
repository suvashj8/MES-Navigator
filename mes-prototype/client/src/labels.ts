/**
 * Plain-language labels for floor and shared UI.
 * English is primary; Nepali is optional subtitle (floor mode).
 */
export const labels = {
  entryDate: { en: 'Entry date', ne: 'प्रविष्टि मिति' },
  costCenter: { en: 'Work station', ne: 'कार्य स्थान' },
  activity: { en: 'Job type', ne: 'कामको प्रकार' },
  department: { en: 'Department', ne: 'विभाग' },
  departmentFilter: { en: 'Department', ne: 'विभाग' },
  worker: { en: 'Worker', ne: 'कर्मचारी' },
  product: { en: 'Product', ne: 'उत्पादन' },
  quantity: { en: 'Quantity', ne: 'परिमाण' },
  selectActivity: { en: 'Select job type...', ne: 'कामको प्रकार छान्नुहोस्...' },
  selectWorkStation: { en: 'Select work station...', ne: 'कार्य स्थान छान्नुहोस्...' },
  selectProduct: { en: 'Search product...', ne: 'उत्पादन खोज्नुहोस्...' },
  selectWorker: { en: 'Select worker...', ne: 'कर्मचारी छान्नुहोस्...' },
  selectDepartment: { en: 'All departments', ne: 'सबै विभाग' },
  todayProductionEntry: { en: "Today's production entry", ne: 'आजको उत्पादन प्रविष्टि' },
  floorEntry: { en: 'Floor entry', ne: 'फ्लोर प्रविष्टि' },
  dailyGrading: { en: 'Daily grading', ne: 'दैनिक मूल्याङ्कन' },
  gradingStandards: { en: 'Grading rules', ne: 'मूल्याङ्कन नियम' },
  activityMapping: { en: 'Job ↔ work station', ne: 'काम ↔ कार्य स्थान' },
  entriesToday: { en: 'Entries today', ne: 'आजका प्रविष्टिहरू' },
  calculatedGrade: { en: 'Calculated grade', ne: 'गणना गरिएको ग्रेड' },
  exportCsv: { en: 'Export CSV', ne: 'CSV निर्यात' },
  regNo: { en: 'Reg #', ne: 'दर्ता नं.' },
  remarks: { en: 'Remarks', ne: 'कैफियत' },
  stepActivity: { en: 'Job type', ne: 'कामको प्रकार' },
  stepCostCenter: { en: 'Work station', ne: 'कार्य स्थान' },
  stepProduct: { en: 'Product', ne: 'उत्पादन' },
  stepQuantity: { en: 'Quantity', ne: 'परिमाण' },
  pickActivityFirst: { en: 'Select worker first', ne: 'पहिले कर्मचारी छान्नुहोस्' },
  pickJobTypeFirst: { en: 'Select job type first', ne: 'पहिले कामको प्रकार छान्नुहोस्' },
  pickWorkStationFirst: { en: 'Select work station first', ne: 'पहिले कार्य स्थान छान्नुहोस्' },
  selectProductFirst: { en: 'Select product first', ne: 'पहिले उत्पादन छान्नुहोस्' },
  enterPieces: { en: 'Enter pieces completed', ne: 'पूरा भएका टुक्रा संख्या' },
  noCostCentersForJob: { en: 'No work stations for this job type', ne: 'यो कामको लागि कार्य स्थान छैन' },
  noStandard: { en: 'No grading rule for this product and work station', ne: 'यो उत्पादन र कार्य स्थानको लागि नियम छैन' },
} as const;

export type LabelKey = keyof typeof labels;