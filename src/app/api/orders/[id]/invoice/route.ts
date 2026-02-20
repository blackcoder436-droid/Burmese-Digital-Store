import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import { getAuthUser } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import { isValidObjectId } from '@/lib/security';
import { createLogger } from '@/lib/logger';

const log = createLogger({ route: '/api/orders/[id]/invoice' });

/**
 * GET /api/orders/[id]/invoice — Generate invoice PDF for a completed order
 * Only the order owner can download
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;

    if (!isValidObjectId(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid order ID' },
        { status: 400 }
      );
    }

    await connectDB();

    const order = await Order.findOne({
      _id: id,
      user: authUser.userId,
      status: 'completed',
    })
      .populate('product', 'name category price image')
      .populate('user', 'name email phone')
      .lean();

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Completed order not found' },
        { status: 404 }
      );
    }

    const PDFDocument = (await import('pdfkit')).default;

    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: `Invoice ${(order as any).orderNumber}`,
        Author: 'Burmese Digital Store',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    const pdfPromise = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    const o = order as any;
    const user = o.user || {};
    const product = o.product || {};

    // ── Colors ──
    const purple = '#6c5ce7';
    const darkBg = '#1a1a2e';
    const lightText = '#e0e0e0';
    const mutedText = '#a0a0a0';

    // ── Header Background ──
    doc.rect(0, 0, 595.28, 120).fill(darkBg);

    // Store name
    doc.fontSize(24).fill('#ffffff').font('Helvetica-Bold')
      .text('BURMESE DIGITAL STORE', 50, 35, { width: 350 });

    // Invoice label
    doc.fontSize(10).fill(purple).font('Helvetica-Bold')
      .text('INVOICE', 430, 35, { align: 'right', width: 115 });

    doc.fontSize(9).fill(lightText).font('Helvetica')
      .text(`#${o.orderNumber}`, 430, 50, { align: 'right', width: 115 })
      .text(new Date(o.createdAt).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      }), 430, 63, { align: 'right', width: 115 });

    // Status badge
    doc.roundedRect(430, 82, 115, 22, 4).fill(purple);
    doc.fontSize(9).fill('#ffffff').font('Helvetica-Bold')
      .text('COMPLETED', 430, 88, { align: 'center', width: 115 });

    // ── Bill To Section ──
    let y = 140;
    doc.fontSize(9).fill(purple).font('Helvetica-Bold')
      .text('BILL TO', 50, y);
    y += 16;
    doc.fontSize(10).fill('#333333').font('Helvetica-Bold')
      .text(user.name || 'Customer', 50, y);
    y += 14;
    doc.fontSize(9).fill('#666666').font('Helvetica')
      .text(user.email || '', 50, y);
    if (user.phone) {
      y += 12;
      doc.text(user.phone, 50, y);
    }

    // ── From (Store Info) ──
    const fromX = 350;
    doc.fontSize(9).fill(purple).font('Helvetica-Bold')
      .text('FROM', fromX, 140);
    doc.fontSize(10).fill('#333333').font('Helvetica-Bold')
      .text('Burmese Digital Store', fromX, 156);
    doc.fontSize(9).fill('#666666').font('Helvetica')
      .text('Digital Products & VPN Services', fromX, 170)
      .text('Myanmar', fromX, 182);

    // ── Divider ──
    y = 210;
    doc.moveTo(50, y).lineTo(545.28, y).strokeColor('#e0e0e0').lineWidth(0.5).stroke();

    // ── Items Table Header ──
    y += 15;
    const colX = { item: 50, type: 280, qty: 360, price: 420, total: 480 };

    doc.rect(50, y - 5, 495.28, 25).fill('#f8f9fa');
    doc.fontSize(8).fill('#666666').font('Helvetica-Bold')
      .text('ITEM', colX.item, y + 2)
      .text('TYPE', colX.type, y + 2)
      .text('QTY', colX.qty, y + 2, { width: 40, align: 'center' })
      .text('PRICE', colX.price, y + 2, { width: 50, align: 'right' })
      .text('TOTAL', colX.total, y + 2, { width: 65, align: 'right' });

    // ── Item Row ──
    y += 30;
    const itemName = o.orderType === 'vpn'
      ? `VPN Service (${o.vpnPlan?.devices || 1}D / ${o.vpnPlan?.months || 1}M)`
      : product.name || 'Digital Product';
    const categoryLabel = o.orderType === 'vpn' ? 'VPN' : (product.category || 'Digital');
    const unitPrice = o.discountAmount
      ? (o.totalAmount + o.discountAmount) / o.quantity
      : o.totalAmount / o.quantity;

    doc.fontSize(9).fill('#333333').font('Helvetica')
      .text(itemName, colX.item, y, { width: 220 })
      .text(categoryLabel.charAt(0).toUpperCase() + categoryLabel.slice(1), colX.type, y)
      .text(String(o.quantity), colX.qty, y, { width: 40, align: 'center' })
      .text(`${Math.round(unitPrice).toLocaleString()} Ks`, colX.price, y, { width: 50, align: 'right' })
      .text(`${(o.totalAmount + (o.discountAmount || 0)).toLocaleString()} Ks`, colX.total, y, { width: 65, align: 'right' });

    // ── Divider ──
    y += 30;
    doc.moveTo(50, y).lineTo(545.28, y).strokeColor('#e0e0e0').lineWidth(0.5).stroke();

    // ── Totals ──
    y += 15;
    const totalsX = 420;
    const totalsW = 125;

    if (o.discountAmount && o.discountAmount > 0) {
      doc.fontSize(9).fill('#666666').font('Helvetica')
        .text('Subtotal:', totalsX, y, { width: 60 });
      doc.fill('#333333').font('Helvetica')
        .text(`${(o.totalAmount + o.discountAmount).toLocaleString()} Ks`, totalsX + 60, y, { width: totalsW - 60, align: 'right' });
      y += 16;

      doc.fontSize(9).fill('#22c55e').font('Helvetica')
        .text(`Coupon (${o.couponCode}):`, totalsX, y, { width: 60 });
      doc.fill('#22c55e').font('Helvetica')
        .text(`-${o.discountAmount.toLocaleString()} Ks`, totalsX + 60, y, { width: totalsW - 60, align: 'right' });
      y += 16;
    }

    // Total box
    doc.roundedRect(totalsX - 10, y - 5, totalsW + 20, 30, 4).fill(darkBg);
    doc.fontSize(11).fill('#ffffff').font('Helvetica-Bold')
      .text('TOTAL:', totalsX, y + 3, { width: 60 });
    doc.fontSize(11).fill(purple).font('Helvetica-Bold')
      .text(`${o.totalAmount.toLocaleString()} Ks`, totalsX + 60, y + 3, { width: totalsW - 60, align: 'right' });

    // ── Payment Info ──
    y += 50;
    doc.fontSize(9).fill(purple).font('Helvetica-Bold')
      .text('PAYMENT INFORMATION', 50, y);
    y += 16;
    doc.fontSize(9).fill('#666666').font('Helvetica')
      .text(`Method: ${o.paymentMethod.toUpperCase()}`, 50, y);
    y += 13;
    doc.text(`Date: ${new Date(o.createdAt).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })}`, 50, y);
    y += 13;
    doc.text(`Status: Completed`, 50, y);

    // ── VPN Details (if applicable) ──
    if (o.orderType === 'vpn' && o.vpnKey) {
      y += 30;
      doc.fontSize(9).fill(purple).font('Helvetica-Bold')
        .text('VPN SUBSCRIPTION DETAILS', 50, y);
      y += 16;
      doc.fontSize(9).fill('#666666').font('Helvetica')
        .text(`Protocol: ${o.vpnKey.protocol || 'VLESS'}`, 50, y);
      y += 13;
      doc.text(`Expires: ${new Date(o.vpnKey.expiryTime).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      })}`, 50, y);
      if (o.vpnKey.subLink) {
        y += 13;
        doc.text(`Sub Link: ${o.vpnKey.subLink}`, 50, y, { width: 495, lineBreak: true });
      }
    }

    // ── Delivered Keys (if product order) ──
    if (o.orderType === 'product' && o.deliveredKeys?.length > 0) {
      y += 30;
      doc.fontSize(9).fill(purple).font('Helvetica-Bold')
        .text('DELIVERED KEYS', 50, y);
      y += 16;

      for (const key of o.deliveredKeys) {
        if (key.serialKey) {
          doc.fontSize(8).fill('#333333').font('Courier')
            .text(`Serial: ${key.serialKey}`, 60, y, { width: 480 });
          y += 12;
        }
        if (key.loginEmail) {
          doc.fontSize(8).fill('#333333').font('Courier')
            .text(`Email: ${key.loginEmail}`, 60, y);
          y += 12;
        }
        if (key.loginPassword) {
          doc.fontSize(8).fill('#333333').font('Courier')
            .text(`Password: ${key.loginPassword}`, 60, y);
          y += 12;
        }
        if (key.additionalInfo) {
          doc.fontSize(8).fill('#333333').font('Courier')
            .text(`Info: ${key.additionalInfo}`, 60, y, { width: 480 });
          y += 12;
        }
        y += 4;
      }
    }

    // ── Footer ──
    const footerY = 760;
    doc.moveTo(50, footerY).lineTo(545.28, footerY).strokeColor('#e0e0e0').lineWidth(0.5).stroke();
    doc.fontSize(7).fill(mutedText).font('Helvetica')
      .text('This is a computer-generated invoice. No signature is required.', 50, footerY + 10, { align: 'center', width: 495 })
      .text('Thank you for your purchase! — Burmese Digital Store', 50, footerY + 22, { align: 'center', width: 495 });

    doc.end();

    const pdfBuffer = await pdfPromise;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${o.orderNumber}.pdf"`,
        'Content-Length': String(pdfBuffer.length),
        'Cache-Control': 'private, no-cache',
      },
    });
  } catch (error: unknown) {
    log.error('Invoice generation error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: 'Failed to generate invoice' },
      { status: 500 }
    );
  }
}
