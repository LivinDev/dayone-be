// The fixed, government-published GST state/UT code list (01–38, plus 97/99
// for special jurisdictions) — used to render "place of supply" on a GST
// invoice as the convention requires (e.g. "29-Karnataka"), for both the
// seller (always Karnataka here) and the buyer (derived from their saved
// address's free-text `state` field). Fixed and tiny — no DB table, same
// "no dynamic taxonomy for something this small" stance already used for
// product categories before they briefly needed to become admin-manageable.
const GST_STATE_CODES: Record<string, string> = {
  'jammu and kashmir': '01',
  'himachal pradesh': '02',
  punjab: '03',
  chandigarh: '04',
  uttarakhand: '05',
  haryana: '06',
  delhi: '07',
  'new delhi': '07',
  rajasthan: '08',
  'uttar pradesh': '09',
  bihar: '10',
  sikkim: '11',
  'arunachal pradesh': '12',
  nagaland: '13',
  manipur: '14',
  mizoram: '15',
  tripura: '16',
  meghalaya: '17',
  assam: '18',
  'west bengal': '19',
  jharkhand: '20',
  odisha: '21',
  orissa: '21',
  chhattisgarh: '22',
  'madhya pradesh': '23',
  gujarat: '24',
  'dadra and nagar haveli and daman and diu': '26',
  maharashtra: '27',
  karnataka: '29',
  goa: '30',
  lakshadweep: '31',
  kerala: '32',
  'tamil nadu': '33',
  puducherry: '34',
  pondicherry: '34',
  'andaman and nicobar islands': '35',
  telangana: '36',
  'andhra pradesh': '37',
  ladakh: '38',
};

function normalize(state: string) {
  return state
    .trim()
    .toLowerCase()
    .replace(/[^a-z ]/g, '');
}

// Returns null rather than a fake code for an unrecognized state — never
// print a fabricated GST code on a real tax document.
export function getGstStateCode(state: string): string | null {
  return GST_STATE_CODES[normalize(state)] ?? null;
}
