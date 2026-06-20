import { useEffect, useRef, useState } from 'react';
import { api, type Activity, type GradePreviewResult, type GradingStandard, type Staff } from '../../../api';
import { parseNonNegativeNumber } from '../../../utils/numericInput';

export function useGradePreview(opts: {
  date: string;
  department: string;
  staffId: string;
  activityId: string;
  costCenter: string;
  prodCode: string;
  productSearch: string;
  quantity: string;
  costCenters: { code: string; name: string }[];
  selectedWorker?: Staff;
  selectedJobType?: Activity;
}) {
  const {
    date,
    department,
    staffId,
    activityId,
    costCenter,
    prodCode,
    productSearch,
    quantity,
    costCenters,
    selectedWorker,
    selectedJobType,
  } = opts;

  const [standard, setStandard] = useState<GradingStandard | null>(null);
  const [preview, setPreview] = useState<GradePreviewResult | null>(null);
  const [missingStandard, setMissingStandard] = useState(false);
  const quantityInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!prodCode || !costCenter) {
      setStandard(null);
      setPreview(null);
      setMissingStandard(false);
      return;
    }
    api
      .lookupStandard(prodCode, costCenter, date, department || selectedWorker?.department || undefined)
      .then((s) => {
        setStandard(s);
        setMissingStandard(false);
      })
      .catch(() => {
        setStandard(null);
        setMissingStandard(true);
      });
  }, [prodCode, costCenter, date, department, selectedWorker?.department]);

  useEffect(() => {
    if (!missingStandard || !prodCode || !costCenter) return;
    api
      .logMissingStandard({
        entry_date: date,
        department: department || undefined,
        staff_id: staffId ? Number(staffId) : undefined,
        staff_name: selectedWorker?.name,
        activity_id: activityId ? Number(activityId) : undefined,
        activity_name: selectedJobType?.name,
        cost_center_code: costCenter,
        cost_center_name: costCenters.find((c) => c.code === costCenter)?.name,
        prod_code: prodCode,
        prod_name: productSearch.includes('—')
          ? productSearch.split('—').slice(1).join('—').trim()
          : undefined,
      })
      .catch(() => {});
  }, [
    missingStandard,
    prodCode,
    costCenter,
    date,
    department,
    staffId,
    activityId,
    productSearch,
    selectedWorker,
    selectedJobType,
    costCenters,
  ]);

  useEffect(() => {
    const qty = parseNonNegativeNumber(quantity, NaN);
    if (!standard || !Number.isFinite(qty) || qty < 0) {
      setPreview(null);
      return;
    }
    api
      .previewGrade({
        prod_code: prodCode,
        cost_center_code: costCenter,
        quantity: qty,
        entry_date: date,
        department: department || selectedWorker?.department || undefined,
      })
      .then(setPreview)
      .catch(() => setPreview(null));
  }, [standard, quantity, prodCode, costCenter, date, department, selectedWorker?.department]);

  return { standard, preview, missingStandard, quantityInputRef };
}
