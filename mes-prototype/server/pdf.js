import PDFDocument from 'pdfkit';
import { formatStaffRegNo } from './lib/staffRegNo.js';

export function streamScorecardsPdf(res, { label, from, to, scorecards }) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="scorecards-${from}-${to}.pdf"`);
  doc.pipe(res);

  doc.fontSize(18).text('Navigator Bead for Life MES — Worker Scorecards', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor('#444').text(`${label}  |  ${from} to ${to}`, { align: 'center' });
  doc.moveDown(1);
  doc.fillColor('#000').fontSize(9);

  if (!scorecards.length) {
    doc.text('No grading entries in this period.');
    doc.end();
    return;
  }

  const cols = ['Reg', 'Name', 'Dept', 'Ent', 'Days', 'Avg', 'Rating', 'C', 'B', 'A', 'AA'];
  const widths = [35, 100, 70, 30, 35, 35, 70, 25, 25, 25, 25];
  let y = doc.y;
  const x0 = 40;

  function row(values, bold = false) {
    if (y > 750) {
      doc.addPage();
      y = 50;
    }
    let x = x0;
    if (bold) doc.font('Helvetica-Bold');
    values.forEach((v, i) => {
      doc.text(String(v ?? ''), x, y, { width: widths[i], lineBreak: false });
      x += widths[i];
    });
    if (bold) doc.font('Helvetica');
    y += 14;
    doc.y = y;
  }

  row(cols, true);
  doc.moveTo(x0, y - 2).lineTo(550, y - 2).stroke();
  for (const c of scorecards) {
    row([
      formatStaffRegNo(c.reg_no),
      c.staff_name?.slice(0, 18),
      c.department?.slice(0, 12),
      c.total_entries,
      c.days_worked,
      c.avg_score?.toFixed(2),
      c.rating,
      c.grade_distribution?.find((g) => g.grade === 'C')?.count ?? 0,
      c.grade_distribution?.find((g) => g.grade === 'B')?.count ?? 0,
      c.grade_distribution?.find((g) => g.grade === 'A')?.count ?? 0,
      c.grade_distribution?.find((g) => g.grade === 'AA')?.count ?? 0,
    ]);
  }
  doc.end();
}

export function streamWorkerPdf(res, detail) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const { staff, summary, entries, from, to } = detail;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="scorecard-${formatStaffRegNo(staff.reg_no)}-${from}.pdf"`);
  doc.pipe(res);

  doc.fontSize(14).text('Navigator Bead for Life MES', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(16).text('Worker Performance Scorecard', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(11).text(`${staff.name}  (${formatStaffRegNo(staff.reg_no)})`);
  doc.text(`Department: ${staff.department}`);
  doc.text(`Period: ${from} to ${to}`);
  doc.moveDown(1);

  if (summary) {
    doc.fontSize(10).text(`Avg Score: ${summary.avg_score}  |  Rating: ${summary.rating}`);
    doc.text(`Entries: ${summary.total_entries}  |  Days: ${summary.days_worked}  |  Total Qty: ${summary.total_quantity}`);
    doc.moveDown(1);
  }

  doc.fontSize(10).text('Daily Entries:', { underline: true });
  doc.moveDown(0.5);
  for (const e of entries) {
    if (doc.y > 720) doc.addPage();
    const updated = e.updated_at ? `  |  Updated ${e.updated_by || ''} ${e.updated_at}` : '';
    doc.text(
      `${e.entry_date}  |  ${e.prod_code}  |  ${e.cost_center_name || e.cost_center_code}  |  Qty ${e.quantity}  |  Grade ${e.grade}  |  ${e.entered_by || ''}  ${e.created_at || ''}${updated}`
    );
  }
  if (!entries.length) doc.text('No entries in period.');
  doc.end();
}

const VAT_LABELS = {
  standard_13: 'Standard (13%)',
  zero_0: 'Zero-rated (0%)',
  exempt: 'Exempt (Schedule-1)',
};

function yn(v) {
  return v ? 'Yes' : 'No';
}

export function streamProductMasterPdf(res, bundle) {
  const { product, accountMapping, exciseMappings } = bundle;
  const safeCode = String(product.code || 'product').replace(/[^a-zA-Z0-9_-]/g, '_');
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="product-${safeCode}.pdf"`);
  doc.pipe(res);

  doc.fontSize(16).text('Navigator Bead for Life MES — Product Master', { align: 'center' });
  doc.moveDown(0.4);
  doc.fontSize(12).text(`${product.code} — ${product.description}`, { align: 'center' });
  doc.moveDown(0.8);
  doc.fontSize(9).fillColor('#000');

  function section(title) {
    if (doc.y > 700) doc.addPage();
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#333').text(title);
    doc.font('Helvetica').fontSize(9).fillColor('#000');
    doc.moveDown(0.35);
  }

  function fieldRow(label, value) {
    if (doc.y > 740) doc.addPage();
    doc.text(`${label}: ${value ?? ''}`);
  }

  section('Basic information');
  fieldRow('Code', product.code);
  fieldRow('Description', product.description);
  fieldRow('UOM', product.base_uom);
  fieldRow('Type', product.type);
  fieldRow('Product type', product.product_type);
  fieldRow('Nature', product.product_nature);
  fieldRow('VAT (Nepal)', VAT_LABELS[product.vat_category] || product.vat_category);
  fieldRow('HS code', product.hs_code);
  fieldRow('Buy price', product.buy_price);
  fieldRow('Buy disc %', product.buy_disc_pct);
  fieldRow('Sales price', product.sales_price);
  fieldRow('Sales disc %', product.sales_disc_pct);
  fieldRow('MRP', product.mrp);
  fieldRow('Warranty rate', product.warranty_rate);
  fieldRow('Product harmonic', product.product_harmonic);

  section('Stock');
  fieldRow('Double qty', yn(product.double_qty));
  fieldRow('Alt UOM', product.alt_uom);
  fieldRow('Fix conversion', yn(product.fix_conversion));
  fieldRow('Base value', product.base_value);
  fieldRow('Alt value', product.alt_value);
  fieldRow('Location', product.location);
  fieldRow('Alternative code', product.alternative_code);
  fieldRow('Max stock', product.max_stock);
  fieldRow('Min stock', product.min_stock);
  fieldRow('Reorder level', product.reorder_level);
  fieldRow('Additional desc change', yn(product.additional_desc_change));
  for (let i = 1; i <= 5; i++) {
    const v = product[`additional_desc${i}`];
    if (v) fieldRow(`Additional desc ${i}`, v);
  }

  section('Account mapping');
  if (!accountMapping.length) {
    doc.text('(no rows)');
  } else {
    for (const [i, row] of accountMapping.entries()) {
      if (doc.y > 720) doc.addPage();
      doc.font('Helvetica-Bold').text(`Row ${i + 1}`);
      doc.font('Helvetica');
      fieldRow('  Group', row.group_name);
      fieldRow('  Subgroup', row.subgroup_name);
      fieldRow('  Sales account', row.sales_account);
      fieldRow('  Sales return', row.sales_return_account);
      fieldRow('  Purchase account', row.purchase_account);
      fieldRow('  Purchase return', row.purchase_return_account);
      fieldRow('  Opening stock', row.opening_stock_account);
      fieldRow('  Closing stock P/L', row.closing_stock_pl_account);
      fieldRow('  Stock in hand', row.stock_in_hand_account);
      doc.moveDown(0.2);
    }
  }

  section('Excise');
  if (!exciseMappings.length) {
    doc.text('(no rows)');
  } else {
    for (const [i, row] of exciseMappings.entries()) {
      if (doc.y > 720) doc.addPage();
      doc.text(`Row ${i + 1}: Code ${row.excise_code || '—'}  |  Rate ${row.rate ?? '—'}  |  Notes ${row.notes || '—'}`);
    }
  }

  doc.moveDown(0.5);
  doc.fontSize(8).fillColor('#666').text(`Exported ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC`);
  doc.end();
}
