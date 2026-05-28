import PDFDocument from 'pdfkit';

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
      c.reg_no,
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
  res.setHeader('Content-Disposition', `attachment; filename="scorecard-${staff.reg_no}-${from}.pdf"`);
  doc.pipe(res);

  doc.fontSize(14).text('Navigator Bead for Life MES', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(16).text('Worker Performance Scorecard', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(11).text(`${staff.name}  (Reg #${staff.reg_no})`);
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
