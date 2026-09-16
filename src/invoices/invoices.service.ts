import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { PrismaService } from '../prisma/prisma.service';
import {
  getSellerConfig,
  assertInvoiceReady,
} from '../common/config/seller-config';
import {
  buildInvoicePdf,
  type ShippingAddressSnapshot,
} from './invoice-pdf.builder';

interface OrderWithInvoiceForPdf {
  totalInPaise: number;
  gstAmountInPaise: number;
  shippingAddress: unknown;
  items: Array<{
    priceInPaise: number;
    size: string;
    color: string | null;
    product: { name: string };
  }>;
  invoice: {
    id: string;
    invoiceNumber: string;
    hsnCode: string;
    pdfUrl: string | null;
    cgstInPaise: number;
    sgstInPaise: number;
    igstInPaise: number;
    createdAt: Date;
  } | null;
}

@Injectable()
export class InvoicesService {
  constructor(private prisma: PrismaService) {}

  // Lazy — same "don't construct at module load" pattern as
  // ProductsService.getS3Client(), so the app still boots without AWS_*
  // env vars set.
  private s3Client: S3Client | null = null;
  private getS3Client() {
    if (!this.s3Client) {
      this.s3Client = new S3Client({ region: process.env.AWS_REGION });
    }
    return this.s3Client;
  }

  // Customer path — 404 (not 403) if the order isn't theirs, same
  // ownership-hiding pattern as Addresses/Reviews/NFC destination edits.
  async getPdfUrlForCustomer(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        items: { include: { product: true, variant: true } },
        invoice: true,
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return this.resolvePdfUrl(order);
  }

  // Staff path — any order, Admin/Manager only (guarded on the controller).
  async getPdfUrlForStaff(orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId },
      include: {
        items: { include: { product: true, variant: true } },
        invoice: true,
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return this.resolvePdfUrl(order);
  }

  private async resolvePdfUrl(order: OrderWithInvoiceForPdf) {
    if (!order.invoice) {
      // Shouldn't happen — every order gets its Invoice row created in the
      // same transaction — but don't crash on a data inconsistency.
      throw new NotFoundException('No invoice exists for this order');
    }

    // Cache hit — every subsequent request after the first is a plain
    // redirect, no regeneration.
    if (order.invoice.pdfUrl) {
      return { pdfUrl: order.invoice.pdfUrl };
    }

    const seller = getSellerConfig();
    try {
      assertInvoiceReady(seller);
    } catch (e) {
      throw new InternalServerErrorException((e as Error).message);
    }

    const bucket = process.env.AWS_S3_BUCKET;
    if (!bucket || !process.env.AWS_REGION) {
      throw new InternalServerErrorException(
        "Invoice storage isn't configured yet — set AWS_REGION/AWS_S3_BUCKET in .env",
      );
    }

    const buyer = order.shippingAddress as ShippingAddressSnapshot;

    const pdfBytes = await buildInvoicePdf({
      invoiceNumber: order.invoice.invoiceNumber,
      issuedAt: order.invoice.createdAt,
      seller,
      buyer,
      items: order.items.map((item) => ({
        description: item.product.name,
        variantDetail: [item.color, item.size].filter(Boolean).join(' · '),
        hsnCode: order.invoice!.hsnCode,
        priceInPaise: item.priceInPaise,
      })),
      totalInPaise: order.totalInPaise,
      gstAmountInPaise: order.gstAmountInPaise,
      cgstInPaise: order.invoice.cgstInPaise,
      sgstInPaise: order.invoice.sgstInPaise,
      igstInPaise: order.invoice.igstInPaise,
    });

    const key = `invoices/${order.invoice.invoiceNumber.replace(/\//g, '-')}.pdf`;
    await this.getS3Client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: pdfBytes,
        ContentType: 'application/pdf',
      }),
    );
    const pdfUrl = `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    await this.prisma.invoice.update({
      where: { id: order.invoice.id },
      data: { pdfUrl },
    });

    return { pdfUrl };
  }
}
