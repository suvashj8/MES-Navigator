import FormField from '../../../components/FormField';
import { labels } from '../../../labels';
import type { Activity, StandardProduct } from '../../../api';
import { controlCls } from '../utils';
import type { WorkflowStep } from '../utils';

type Props = {
  floorMode: boolean;
  showNepali: boolean;
  nextStep: WorkflowStep;
  staffId: string;
  activityId: string;
  activities: Activity[];
  costCenters: { code: string; name: string }[];
  costCenter: string;
  costCenterEnabled: boolean;
  productEnabled: boolean;
  productSearch: string;
  onProductSearchChange: (value: string) => void;
  products: StandardProduct[];
  showProductList: boolean;
  setShowProductList: (v: boolean) => void;
  onActivityChange: (id: string) => void;
  onCostCenterChange: (code: string) => void;
  onSelectProduct: (p: StandardProduct) => void;
};

export default function ProductCascadeFields(props: Props) {
  const {
    floorMode,
    showNepali,
    nextStep,
    staffId,
    activityId,
    activities,
    costCenters,
    costCenter,
    costCenterEnabled,
    productEnabled,
    productSearch,
    onProductSearchChange,
    products,
    showProductList,
    setShowProductList,
    onActivityChange,
    onCostCenterChange,
    onSelectProduct,
  } = props;

  return (
    <>
      <FormField
        label={labels.activity.en}
        nepali={labels.activity.ne}
        showSubtitle={showNepali}
        reserveSubtitleLine={showNepali}
        required
        floorMode={floorMode}
        highlight={nextStep === 'activity'}
        hint={
          !staffId
            ? labels.pickActivityFirst.en
            : nextStep === 'activity'
              ? 'Choose job type to continue'
              : undefined
        }
        hintClassName={!staffId ? 'text-slate-500' : 'text-amber-400/90'}
        className="flex-1 min-w-[10rem] max-w-xs"
      >
        <select
          value={activityId}
          onChange={(e) => onActivityChange(e.target.value)}
          className={controlCls(floorMode, !staffId)}
          disabled={!staffId}
        >
          <option value="">{labels.selectActivity.en}</option>
          {activities.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} — {a.name}
            </option>
          ))}
        </select>
      </FormField>

      <FormField
        label={labels.costCenter.en}
        nepali={labels.costCenter.ne}
        showSubtitle={showNepali}
        reserveSubtitleLine={showNepali}
        required
        floorMode={floorMode}
        highlight={nextStep === 'costCenter'}
        className="flex-1 min-w-[12rem] max-w-md"
        hint={
          !activityId
            ? labels.pickJobTypeFirst.en
            : activityId && costCenters.length === 0
              ? labels.noCostCentersForJob.en
              : nextStep === 'costCenter'
                ? labels.selectWorkStation.en
                : undefined
        }
        hintClassName={
          !activityId || (activityId && costCenters.length === 0) ? 'text-orange-400' : 'text-amber-400/90'
        }
      >
        <select
          required
          value={costCenter}
          onChange={(e) => onCostCenterChange(e.target.value)}
          className={controlCls(floorMode, !costCenterEnabled)}
          disabled={!costCenterEnabled || (Boolean(activityId) && costCenters.length === 0)}
        >
          <option value="">{labels.selectWorkStation.en}</option>
          {costCenters.map((cc) => (
            <option key={cc.code} value={cc.code}>
              {cc.code} — {cc.name}
            </option>
          ))}
        </select>
      </FormField>

      <FormField
        label={labels.product.en}
        nepali={labels.product.ne}
        showSubtitle={showNepali}
        reserveSubtitleLine={showNepali}
        required
        floorMode={floorMode}
        highlight={nextStep === 'product'}
        hint={
          !costCenter
            ? labels.pickWorkStationFirst.en
            : nextStep === 'product'
              ? 'Products from Product Master (with a grading rule for this station)'
              : undefined
        }
        hintClassName={!costCenter ? 'text-orange-400' : 'text-amber-400/90'}
        className="flex-[2] min-w-[14rem]"
      >
        <div className="relative w-full">
          <input
            value={productSearch}
            onChange={(e) => {
              onProductSearchChange(e.target.value);
              setShowProductList(true);
            }}
            onFocus={() => productEnabled && setShowProductList(true)}
            placeholder={productEnabled ? labels.selectProduct.en : labels.pickWorkStationFirst.en}
            className={controlCls(floorMode, !productEnabled)}
            disabled={!productEnabled}
          />
          {showProductList && products.length > 0 && (
            <ul className="absolute z-10 w-full top-full mt-1 bg-slate-800 border border-slate-700 rounded-lg max-h-40 overflow-y-auto shadow-xl">
              {products.map((p) => (
                <li key={p.prod_code}>
                  <button
                    type="button"
                    onClick={() => onSelectProduct(p)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-700"
                  >
                    <span className="font-mono text-amber-200/90">{p.prod_code}</span>
                    <span className="text-slate-400 ml-2 truncate">{p.prod_name}</span>
                    {p.base_uom && <span className="text-slate-500 text-xs ml-1">· {p.base_uom}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </FormField>
    </>
  );
}
