import nepaliPkg from 'nepali-date-converter';

const NepaliDate = nepaliPkg.default;

const BS_MONTHS = [
  'Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra',
];

export function adToBs(adDate) {
  const [y, m, d] = adDate.split('-').map(Number);
  const nd = new NepaliDate(new Date(y, m - 1, d));
  const bsYear = nd.getYear();
  const bsMonth = nd.getMonth() + 1;
  const bsDay = nd.getDate();
  return {
    ad: adDate,
    bs: `${bsYear}-${String(bsMonth).padStart(2, '0')}-${String(bsDay).padStart(2, '0')}`,
    bs_display: `${BS_MONTHS[bsMonth - 1]} ${bsDay}, ${bsYear} BS`,
    bs_month_name: BS_MONTHS[bsMonth - 1],
  };
}

export function bsToAd(bsDate) {
  const [y, m, d] = bsDate.split('-').map(Number);
  const nd = new NepaliDate(y, m, d);
  const ad = nd.getAD();
  const adStr = `${ad.year}-${String(ad.month).padStart(2, '0')}-${String(ad.date).padStart(2, '0')}`;
  return {
    ad: adStr,
    bs: bsDate,
    bs_display: `${BS_MONTHS[m - 1]} ${d}, ${y} BS`,
    bs_month_name: BS_MONTHS[m - 1],
  };
}

export function todayPair() {
  const ad = new Date().toISOString().slice(0, 10);
  return adToBs(ad);
}
