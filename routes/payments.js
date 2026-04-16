// routes/payments.js
const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const { isAuthenticated } = require('../middleware/auth');
const PDFDocument = require('pdfkit');

router.get('/receipt/:id', isAuthenticated, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id).populate('user', 'name email alumniId profile');
    if (!payment) return res.status(404).send('Receipt not found');

    // Only owner or admin
    if (payment.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).send('Access denied');
    }

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Receipt-${payment.receiptNumber}.pdf`);
    doc.pipe(res);

    // Header
    doc.rect(0, 0, doc.page.width, 120).fill('#1e3a5f');
    doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold')
      .text('SVPM College of Engineering', 50, 30, { align: 'center' });
    doc.fontSize(13).font('Helvetica')
      .text('Alumni Association — Malegaon Bk, Baramati', 50, 58, { align: 'center' });
    doc.fontSize(18).font('Helvetica-Bold')
      .text('PAYMENT RECEIPT', 50, 85, { align: 'center' });

    doc.fillColor('#1e3a5f');
    doc.moveDown(3);

    const y = 150;
    const labelX = 60, valueX = 250;
    const rows = [
      ['Receipt Number', payment.receiptNumber],
      ['Alumni Name', payment.user.name],
      ['Alumni ID', payment.user.alumniId],
      ['Email', payment.user.email],
      ['Branch', payment.user.profile?.branch || 'N/A'],
      ['Amount', `₹${payment.amount.toFixed(2)}`],
      ['Purpose', payment.purpose.replace('_', ' ').toUpperCase()],
      ['Status', payment.status.toUpperCase()],
      ['Transaction ID', payment.razorpayPaymentId || 'N/A'],
      ['Payment Date', payment.paidAt ? new Date(payment.paidAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A']
    ];

    rows.forEach(([label, value], i) => {
      const rowY = y + i * 35;
      if (i % 2 === 0) doc.rect(40, rowY - 5, doc.page.width - 80, 30).fill('#f8fafc');
      doc.fillColor('#6b7280').font('Helvetica').fontSize(11).text(label, labelX, rowY + 5);
      doc.fillColor('#1e3a5f').font('Helvetica-Bold').fontSize(11).text(value || '', valueX, rowY + 5);
    });

    const sigY = y + rows.length * 35 + 40;
    doc.moveTo(40, sigY).lineTo(doc.page.width - 40, sigY).stroke('#e2e8f0');
    doc.moveDown(1);
    doc.fillColor('#374151').font('Helvetica').fontSize(11)
      .text('This is a computer-generated receipt and does not require a signature.', 40, sigY + 15, { align: 'center' });
    doc.fillColor('#6b7280').fontSize(10)
      .text(`Generated on ${new Date().toLocaleDateString('en-IN')} | SVPM Alumni Association`, 40, sigY + 35, { align: 'center' });

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).send('Error generating receipt');
  }
});

module.exports = router;
