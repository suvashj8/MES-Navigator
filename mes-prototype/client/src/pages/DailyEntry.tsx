import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Toast from '../components/Toast';
import DepartmentBanner from '../components/DepartmentBanner';
import DateInput from '../components/DateInput';
import PageShell from '../components/PageShell';
import FormField from '../components/FormField';
import { labels } from '../labels';
import { controlCls, FORM_ROW_CLS, nextWorkflowStep } from '../features/dailyEntry/utils';
import { useDailyEntryScope } from '../features/dailyEntry/hooks/useDailyEntryScope';
import { useDailyEntryEntries } from '../features/dailyEntry/hooks/useDailyEntryEntries';
import { useWorkerPicker } from '../features/dailyEntry/hooks/useWorkerPicker';
import { useProductCascade } from '../features/dailyEntry/hooks/useProductCascade';
import { useGradePreview } from '../features/dailyEntry/hooks/useGradePreview';
import { useOfflineSync } from '../features/dailyEntry/hooks/useOfflineSync';
import { useDailyEntrySave } from '../features/dailyEntry/hooks/useDailyEntrySave';
import DailyEntryHeader from '../features/dailyEntry/components/DailyEntryHeader';
import WorkerPickerField from '../features/dailyEntry/components/WorkerPickerField';
import SelectedWorkerBanner from '../features/dailyEntry/components/SelectedWorkerBanner';
import WorkerQuickActions from '../features/dailyEntry/components/WorkerQuickActions';
import ProductCascadeFields from '../features/dailyEntry/components/ProductCascadeFields';
import QuantitySaveRow from '../features/dailyEntry/components/QuantitySaveRow';
import GradePreviewSection from '../features/dailyEntry/components/GradePreviewSection';
import DailyEntriesSection from '../features/dailyEntry/components/DailyEntriesSection';

export default function DailyEntryPage({ floorMode = false }: { floorMode?: boolean }) {
  const { can, user } = useAuth();
  const location = useLocation();
  const canDelete = can('daily-grading:delete');
  const canWrite = can('daily-grading:write');

  const scope = useDailyEntryScope(location.search);
  const {
    date,
    setDate,
    department,
    setDepartment,
    departments,
    deptLocked,
    activities,
    staffList,
    prefillStaffId,
  } = scope;

  const entriesState = useDailyEntryEntries(date, department, floorMode);
  const recentKey = useMemo(() => `mes_recent_workers_${user?.username || 'anon'}`, [user?.username]);

  const worker = useWorkerPicker({
    staffList,
    entries: entriesState.entries,
    prefillStaffId,
    recentKey,
  });

  const cascade = useProductCascade();
  const [quantity, setQuantity] = useState('');
  const [remarks, setRemarks] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [beepOnSave, setBeepOnSave] = useState(() => localStorage.getItem('mes_beep_on_save') === '1');
  const [showNepaliSubtitles, setShowNepaliSubtitles] = useState(() => {
    const v = localStorage.getItem('mes_show_nepali_subtitles');
    return v == null ? true : v === '1';
  });

  useEffect(() => {
    localStorage.setItem('mes_show_nepali_subtitles', showNepaliSubtitles ? '1' : '0');
  }, [showNepaliSubtitles]);

  const showNepali = floorMode || showNepaliSubtitles;
  const selectedJobType = cascade.activityId
    ? activities.find((a) => a.id === Number(cascade.activityId))
    : undefined;

  const { standard, preview, missingStandard, quantityInputRef } = useGradePreview({
    date,
    department,
    staffId: worker.staffId,
    activityId: cascade.activityId,
    costCenter: cascade.costCenter,
    prodCode: cascade.prodCode,
    productSearch: cascade.productSearch,
    quantity,
    costCenters: cascade.costCenters,
    selectedWorker: worker.selectedWorker,
    selectedJobType,
  });

  const offline = useOfflineSync(user?.username);

  const save = useDailyEntrySave({
    date,
    staffId: worker.staffId,
    prodCode: cascade.prodCode,
    costCenter: cascade.costCenter,
    quantity,
    remarks,
    preview,
    entries: entriesState.entries,
    staffList,
    beepOnSave,
    quantityInputRef,
    refreshEntries: entriesState.refreshEntries,
    setEntries: entriesState.setEntries,
    setHighlightEntryId: entriesState.setHighlightEntryId,
    enqueueOffline: offline.enqueueOffline,
    onToast: setToastMessage,
  });

  useEffect(() => () => {
    if (save.saveSuccessTimerRef.current) clearTimeout(save.saveSuccessTimerRef.current);
  }, [save.saveSuccessTimerRef]);

  const nextStep = nextWorkflowStep({
    staffId: worker.staffId,
    activityId: cascade.activityId,
    costCenter: cascade.costCenter,
    prodCode: cascade.prodCode,
    quantity,
  });

  const quantityEnabled = Boolean(cascade.prodCode);

  function clearFormAfterSave() {
    setQuantity('');
    setRemarks('');
  }

  async function handleSyncOffline() {
    const { synced, remaining } = await offline.syncOffline(async () => {
      const list = await entriesState.refreshEntries();
      entriesState.setEntries(list);
    });
    if (synced > 0) {
      setToastMessage(remaining === 0 ? 'Synced offline entries' : `Synced ${synced} offline entries`);
    }
  }

  async function handleDelete(id: number) {
    const deleted = await entriesState.deleteEntry(id);
    if (deleted) {
      setToastMessage(`Entry deleted — ${deleted.staff_name || 'Worker'} (${deleted.prod_code})`);
      entriesState.setUndoDelete(deleted);
    } else {
      setToastMessage('Entry deleted');
    }
  }

  return (
    <PageShell className={floorMode ? 'p-4 md:p-4' : undefined}>
      {toastMessage && (
        <Toast
          message={toastMessage}
          onDismiss={() => {
            setToastMessage(null);
            entriesState.setUndoDelete(null);
          }}
          actionLabel={entriesState.undoDelete ? 'Undo' : undefined}
          onAction={
            entriesState.undoDelete
              ? async () => {
                  try {
                    await entriesState.undoDeleteEntry(entriesState.undoDelete!);
                    setToastMessage('Undo complete');
                  } catch (e) {
                    alert(e instanceof Error ? e.message : 'Undo failed');
                  }
                }
              : undefined
          }
          durationMs={entriesState.undoDelete ? 10_000 : undefined}
        />
      )}

      <DailyEntryHeader
        floorMode={floorMode}
        showNepali={showNepali}
        showNepaliSubtitles={showNepaliSubtitles}
        onToggleNepali={setShowNepaliSubtitles}
        nextStep={nextStep}
        activityId={cascade.activityId}
        costCenter={cascade.costCenter}
        prodCode={cascade.prodCode}
        quantity={quantity}
      />

      <DepartmentBanner />

      <div className="space-y-6">
        <form
          onSubmit={(e) => save.handleSave(e, clearFormAfterSave)}
          className={
            floorMode
              ? 'floor-card space-y-3 pb-24 md:pb-4'
              : 'space-y-3 bg-slate-900 border border-slate-800 rounded-xl p-6'
          }
        >
          <div className={FORM_ROW_CLS}>
            <div className="w-full sm:w-[17rem] shrink-0">
              <DateInput
                label={labels.entryDate.en}
                subtitle={labels.entryDate.ne}
                showSubtitle={showNepali}
                reserveSubtitleLine={showNepali}
                value={date}
                onChange={setDate}
                aligned
                floorMode={floorMode}
              />
            </div>

            {!deptLocked && (
              <FormField
                label={labels.departmentFilter.en}
                nepali={labels.departmentFilter.ne}
                showSubtitle={showNepali}
                reserveSubtitleLine={showNepali}
                floorMode={floorMode}
                className="flex-1 min-w-[10rem] max-w-xs"
              >
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className={controlCls(floorMode)}
                  disabled={deptLocked}
                >
                  <option value="">{labels.selectDepartment.en}</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </FormField>
            )}

            <WorkerPickerField
              floorMode={floorMode}
              showNepali={showNepali}
              nextStep={nextStep}
              staffId={worker.staffId}
              staffList={staffList}
              selectedWorker={worker.selectedWorker}
              workerOpen={worker.workerOpen}
              setWorkerOpen={worker.setWorkerOpen}
              workerQuery={worker.workerQuery}
              setWorkerQuery={worker.setWorkerQuery}
              workerPickerRef={worker.workerPickerRef}
              filteredWorkers={worker.filteredWorkers}
              onSelectWorker={(id) => {
                worker.setStaffId(id);
                worker.addRecentWorker(id);
                worker.setWorkerOpen(false);
                worker.setWorkerQuery('');
              }}
            />
          </div>

          {worker.selectedWorker && (
            <SelectedWorkerBanner
              worker={worker.selectedWorker}
              floorMode={floorMode}
              prefillFlash={worker.prefillFlash}
            />
          )}

          {canWrite && (
            <WorkerQuickActions
              floorMode={floorMode}
              staffId={worker.staffId}
              ungradedCount={worker.ungradedWorkers.length}
              onPickNext={worker.pickNextWorker}
              recentWorkerIds={worker.recentWorkerIds}
              staffList={staffList}
              onSelectWorker={worker.setStaffId}
            />
          )}

          <div className={FORM_ROW_CLS}>
            <ProductCascadeFields
              floorMode={floorMode}
              showNepali={showNepali}
              nextStep={nextStep}
              staffId={worker.staffId}
              activityId={cascade.activityId}
              activities={activities}
              costCenters={cascade.costCenters}
              costCenter={cascade.costCenter}
              costCenterEnabled={cascade.costCenterEnabled}
              productEnabled={cascade.productEnabled}
              productSearch={cascade.productSearch}
              onProductSearchChange={(v) => {
                cascade.setProductSearch(v);
                cascade.setProdCode('');
              }}
              products={cascade.products}
              showProductList={cascade.showProductList}
              setShowProductList={cascade.setShowProductList}
              onActivityChange={cascade.onActivityChange}
              onCostCenterChange={cascade.onCostCenterChange}
              onSelectProduct={cascade.selectProduct}
            />
          </div>

          <div className={`${FORM_ROW_CLS} items-end`}>
            <QuantitySaveRow
              floorMode={floorMode}
              showNepali={showNepali}
              nextStep={nextStep}
              prodCode={cascade.prodCode}
              quantity={quantity}
              setQuantity={setQuantity}
              quantityEnabled={quantityEnabled}
              quantityInputRef={quantityInputRef}
              remarks={remarks}
              setRemarks={setRemarks}
              saving={save.saving}
              saveSuccess={save.saveSuccess}
              preview={preview}
              beepOnSave={beepOnSave}
              setBeepOnSave={setBeepOnSave}
              showBeepToggle={canWrite}
            />
          </div>

          <GradePreviewSection
            standard={standard}
            preview={preview}
            missingStandard={missingStandard}
            prodCode={cascade.prodCode}
            selectedJobType={selectedJobType}
            saveSuccess={save.saveSuccess}
            error={save.error}
            floorMode={floorMode}
            canOpenStandards={can('standards:read')}
          />
        </form>

        <div ref={entriesState.entriesSectionRef}>
          <DailyEntriesSection
            date={date}
            floorMode={floorMode}
            entriesView={entriesState.entriesView}
            setEntriesView={entriesState.setEntriesView}
            entries={entriesState.entries}
            entriesSorted={entriesState.entriesSorted}
            last3={entriesState.last3}
            entryRowClass={entriesState.entryRowClass}
            canDelete={canDelete}
            exporting={entriesState.exporting}
            offlineCount={offline.offlineCount}
            onExport={() => entriesState.exportDay(setToastMessage)}
            onSyncOffline={() => handleSyncOffline().catch(() => {})}
            onDelete={handleDelete}
          />
        </div>
      </div>
    </PageShell>
  );
}
