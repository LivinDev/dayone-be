// Day01's own registered-seller details — needed on every GST invoice PDF
// (Rule 46: supplier name/GSTIN/address are mandatory fields) and, for the
// state, already needed by OrdersService's CGST+SGST-vs-IGST split.
//
// Deliberately a function, not a module-level `const ... = process.env...`.
// This codebase has hit that exact bug twice already (JwtModule's secret,
// TapRedirectController's FRONTEND_ORIGIN) — imports are hoisted ahead of
// main.ts's own `process.loadEnvFile('.env')` call, so a top-level const
// silently reads `undefined` on every boot. Read fresh, inside a method
// body, same as those two fixes.
//
// One seller, one GST registration, today — env vars, not a settings table
// or schema field, same call already made for SELLER_STATE.
export interface SellerConfig {
  legalName: string;
  gstin: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
  pan: string | null;
}

export function getSellerConfig(): SellerConfig {
  return {
    legalName: process.env.SELLER_LEGAL_NAME || 'Day01',
    gstin: process.env.SELLER_GSTIN || null,
    addressLine1: process.env.SELLER_ADDRESS_LINE1 || '',
    addressLine2: process.env.SELLER_ADDRESS_LINE2 || null,
    city: process.env.SELLER_CITY || '',
    // Karnataka is a real, fixed fact about this business (see
    // OrdersService's own SELLER_STATE comment) — safe to default, unlike
    // GSTIN/address/PAN below, which get no fallback and must be set before
    // a real invoice PDF can generate.
    state: process.env.SELLER_STATE || 'Karnataka',
    stateCode: process.env.SELLER_STATE_CODE || '29',
    pincode: process.env.SELLER_PINCODE || '',
    pan: process.env.SELLER_PAN || null,
  };
}

// Fields a real invoice PDF can't legally omit. GSTIN specifically — no
// fabricated placeholder ever gets printed on a tax document.
export function assertInvoiceReady(config: SellerConfig): void {
  const missing: string[] = [];
  if (!config.gstin) missing.push('SELLER_GSTIN');
  if (!config.addressLine1) missing.push('SELLER_ADDRESS_LINE1');
  if (!config.city) missing.push('SELLER_CITY');
  if (!config.pincode) missing.push('SELLER_PINCODE');
  if (missing.length > 0) {
    throw new Error(
      `Invoice PDFs aren't configured yet — set ${missing.join(', ')} in .env`,
    );
  }
}
