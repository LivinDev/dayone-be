import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib';
import type { SellerConfig } from '../common/config/seller-config';
import { getGstStateCode } from '../common/utils/gst-state-codes';

// The buyer-address snapshot shape OrdersService.create() writes onto
// Order.shippingAddress at order time — see orders.service.ts.
export interface ShippingAddressSnapshot {
  label?: string | null;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export interface InvoiceLineItem {
  description: string; // product name
  variantDetail: string; // "Charcoal · SZ 2" or just "SZ 2"
  hsnCode: string;
  priceInPaise: number; // tax-inclusive, one physical unit
}

export interface InvoicePdfInput {
  invoiceNumber: string;
  issuedAt: Date;
  seller: SellerConfig;
  buyer: ShippingAddressSnapshot;
  items: InvoiceLineItem[];
  totalInPaise: number;
  gstAmountInPaise: number;
  cgstInPaise: number;
  sgstInPaise: number;
  igstInPaise: number;
}

function rupees(paise: number) {
  return `Rs ${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const PAGE_WIDTH = 595.28; // A4 in points
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;

// Fixed-layout, hand-drawn with pdf-lib rather than an HTML-to-PDF renderer
// — no headless Chromium on the small EC2 box this runs on, and a GST
// invoice's layout doesn't need to change often. See dayone-be/CLAUDE.md's
// "GST invoice PDF generation" note for why this library was chosen.
export async function buildInvoicePdf(
  input: InvoicePdfInput,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const black = rgb(0.1, 0.1, 0.1);
  const gray = rgb(0.45, 0.45, 0.45);
  const line = rgb(0.8, 0.8, 0.8);

  function text(
    page_: PDFPage,
    str: string,
    x: number,
    yPos: number,
    opts?: { size?: number; f?: PDFFont; color?: ReturnType<typeof rgb> },
  ) {
    page_.drawText(str, {
      x,
      y: yPos,
      size: opts?.size ?? 10,
      font: opts?.f ?? font,
      color: opts?.color ?? black,
    });
  }

  function hr(page_: PDFPage, yPos: number) {
    page_.drawLine({
      start: { x: MARGIN, y: yPos },
      end: { x: PAGE_WIDTH - MARGIN, y: yPos },
      thickness: 0.75,
      color: line,
    });
  }

  // Header
  text(page, 'TAX INVOICE', MARGIN, y, { size: 18, f: bold });
  text(page, 'DAY01', PAGE_WIDTH - MARGIN - 100, y, { size: 18, f: bold });
  y -= 28;

  text(page, input.seller.legalName, MARGIN, y, { size: 11, f: bold });
  y -= 14;
  text(page, input.seller.addressLine1, MARGIN, y, { size: 9, color: gray });
  y -= 12;
  if (input.seller.addressLine2) {
    text(page, input.seller.addressLine2, MARGIN, y, { size: 9, color: gray });
    y -= 12;
  }
  text(
    page,
    `${input.seller.city}, ${input.seller.state} ${input.seller.pincode}`,
    MARGIN,
    y,
    { size: 9, color: gray },
  );
  y -= 12;
  text(page, `GSTIN: ${input.seller.gstin ?? 'N/A'}`, MARGIN, y, {
    size: 9,
    color: gray,
  });
  if (input.seller.pan) {
    text(page, `PAN: ${input.seller.pan}`, MARGIN + 160, y, {
      size: 9,
      color: gray,
    });
  }
  y -= 24;

  hr(page, y);
  y -= 20;

  // Invoice meta (left) + Bill To (right)
  const metaTop = y;
  const buyerStateCode = getGstStateCode(input.buyer.state);
  const metaRows: [string, string][] = [
    ['Invoice Number', input.invoiceNumber],
    [
      'Invoice Date',
      input.issuedAt.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
    ],
    [
      'Place of Supply',
      buyerStateCode
        ? `${input.buyer.state} (${buyerStateCode})`
        : input.buyer.state,
    ],
  ];
  let metaY = metaTop;
  for (const [label, value] of metaRows) {
    text(page, label, MARGIN, metaY, { size: 8, color: gray });
    metaY -= 12;
    text(page, value, MARGIN, metaY, { size: 10, f: bold });
    metaY -= 20;
  }
  y = metaY + 8;

  const billToX = PAGE_WIDTH / 2 + 10;
  let billY = metaTop;
  text(page, 'Bill To', billToX, billY, { size: 8, color: gray });
  billY -= 12;
  text(page, input.buyer.fullName, billToX, billY, { size: 10, f: bold });
  billY -= 14;
  text(page, input.buyer.line1, billToX, billY, { size: 9, color: gray });
  billY -= 12;
  if (input.buyer.line2) {
    text(page, input.buyer.line2, billToX, billY, { size: 9, color: gray });
    billY -= 12;
  }
  text(
    page,
    `${input.buyer.city}, ${input.buyer.state} ${input.buyer.pincode}`,
    billToX,
    billY,
    { size: 9, color: gray },
  );
  billY -= 12;
  text(page, input.buyer.phone, billToX, billY, { size: 9, color: gray });

  y = Math.min(y, billY) - 24;
  hr(page, y);
  y -= 20;

  // Line items table
  const col = {
    hsn: MARGIN,
    desc: MARGIN + 60,
    variant: MARGIN + 260,
    rate: MARGIN + 360,
    amount: PAGE_WIDTH - MARGIN - 70,
  };
  text(page, 'HSN', col.hsn, y, { size: 8, color: gray });
  text(page, 'Item', col.desc, y, { size: 8, color: gray });
  text(page, 'Variant', col.variant, y, { size: 8, color: gray });
  text(page, 'Rate (incl. GST)', col.rate, y, { size: 8, color: gray });
  text(page, 'Amount', col.amount, y, { size: 8, color: gray });
  y -= 8;
  hr(page, y);
  y -= 16;

  for (const item of input.items) {
    if (y < MARGIN + 160) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
    text(page, item.hsnCode, col.hsn, y, { size: 9 });
    text(page, item.description, col.desc, y, { size: 9 });
    text(page, item.variantDetail || '—', col.variant, y, {
      size: 9,
      color: gray,
    });
    text(page, rupees(item.priceInPaise), col.rate, y, { size: 9 });
    text(page, rupees(item.priceInPaise), col.amount, y, { size: 9 });
    y -= 18;
  }

  y -= 6;
  hr(page, y);
  y -= 20;

  // Totals block, right-aligned
  const taxableValueInPaise = input.totalInPaise - input.gstAmountInPaise;
  const totalsX = col.rate;
  const rows: [string, string][] = [
    ['Taxable Value', rupees(taxableValueInPaise)],
  ];
  if (input.cgstInPaise > 0)
    rows.push(['CGST (6%)', rupees(input.cgstInPaise)]);
  if (input.sgstInPaise > 0)
    rows.push(['SGST (6%)', rupees(input.sgstInPaise)]);
  if (input.igstInPaise > 0)
    rows.push(['IGST (12%)', rupees(input.igstInPaise)]);
  rows.push(['Total', rupees(input.totalInPaise)]);

  for (const [label, value] of rows) {
    const isTotal = label === 'Total';
    text(page, label, totalsX, y, {
      size: isTotal ? 10 : 9,
      f: isTotal ? bold : font,
      color: isTotal ? black : gray,
    });
    text(page, value, col.amount, y, {
      size: isTotal ? 10 : 9,
      f: isTotal ? bold : font,
    });
    y -= 16;
  }

  y -= 16;
  text(page, 'Reverse Charge: No', MARGIN, y, { size: 8, color: gray });
  y -= 24;
  hr(page, y);
  y -= 16;
  text(
    page,
    'This is a system-generated invoice and does not require a physical signature.',
    MARGIN,
    y,
    { size: 8, color: gray },
  );

  return doc.save();
}
