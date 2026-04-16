const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const info = await transporter.sendMail({
      from: process.env.FROM_EMAIL || 'SVPM Alumni <noreply@svpmcoe.edu.in>',
      to,
      subject,
      html,
      text
    });
    console.log(`✓ Email sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('Email error:', err.message);
    return { success: false, error: err.message };
  }
};

// ─── Email Templates ──────────────────────────────────────────────────────────
const emailTemplates = {
  registrationConfirmation: (user) => ({
    subject: 'Welcome to SVPM Alumni Association!',
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc;">
        <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d6a9f 100%); padding: 40px 30px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 26px;">SVPM College of Engineering</h1>
          <p style="color: #a0c4e8; margin: 5px 0 0;">Alumni Association Portal</p>
        </div>
        <div style="padding: 40px 30px; background: #fff;">
          <h2 style="color: #1e3a5f;">Welcome, ${user.name}!</h2>
          <p style="color: #4a5568; line-height: 1.7;">
            Your registration with the SVPM Alumni Association is confirmed. Your Alumni ID is:
          </p>
          <div style="background: #f0f7ff; border-left: 4px solid #2d6a9f; padding: 15px 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
            <strong style="font-size: 20px; color: #1e3a5f;">${user.alumniId}</strong>
          </div>
          <p style="color: #4a5568; line-height: 1.7;">
            Your account is under review. You will receive another email once your profile is approved by the admin.
          </p>
          <a href="${process.env.APP_URL}/alumni/dashboard" 
             style="display: inline-block; background: #2d6a9f; color: #fff; padding: 12px 28px; border-radius: 6px; text-decoration: none; margin-top: 20px; font-weight: 600;">
            Visit Dashboard
          </a>
        </div>
        <div style="padding: 20px 30px; background: #f8fafc; text-align: center; color: #718096; font-size: 13px;">
          <p>SVPM College of Engineering, Malegaon Bk, Baramati, Pune - 413115</p>
          <p>© ${new Date().getFullYear()} SVPM Alumni Association. All rights reserved.</p>
        </div>
      </div>
    `
  }),

  membershipApproved: (user) => ({
    subject: 'Life Membership Approved — SVPM Alumni Association',
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d6a9f 100%); padding: 40px 30px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 26px;">Life Membership Approved!</h1>
        </div>
        <div style="padding: 40px 30px; background: #fff;">
          <h2 style="color: #1e3a5f;">Congratulations, ${user.name}!</h2>
          <p style="color: #4a5568; line-height: 1.7;">
            Your Life Membership application has been <strong style="color: #059669;">approved</strong>. 
            You are now a Life Member of the SVPM Alumni Association.
          </p>
          <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
            <div style="font-size: 40px;">🎓</div>
            <p style="color: #166534; font-weight: 700; font-size: 18px; margin: 10px 0 5px;">Life Member</p>
            <p style="color: #4ade80; margin: 0;">${user.alumniId}</p>
          </div>
          <p style="color: #4a5568; line-height: 1.7;">
            You can now download your membership certificate from your dashboard.
          </p>
          <a href="${process.env.APP_URL}/alumni/certificate" 
             style="display: inline-block; background: #059669; color: #fff; padding: 12px 28px; border-radius: 6px; text-decoration: none; margin-top: 10px; font-weight: 600;">
            Download Certificate
          </a>
        </div>
        <div style="padding: 20px 30px; background: #f8fafc; text-align: center; color: #718096; font-size: 13px;">
          <p>SVPM College of Engineering, Malegaon Bk, Baramati, Pune - 413115</p>
        </div>
      </div>
    `
  }),

  paymentSuccess: (user, payment) => ({
    subject: `Payment Receipt — SVPM Alumni (₹${payment.amount})`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d6a9f 100%); padding: 40px 30px; text-align: center;">
          <h1 style="color: #fff; margin: 0;">Payment Successful</h1>
        </div>
        <div style="padding: 40px 30px; background: #fff;">
          <h2 style="color: #1e3a5f;">Dear ${user.name},</h2>
          <p style="color: #4a5568;">Your payment has been received successfully.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background: #f8fafc;">
              <td style="padding: 12px 16px; border: 1px solid #e2e8f0; font-weight: 600; color: #4a5568;">Transaction ID</td>
              <td style="padding: 12px 16px; border: 1px solid #e2e8f0; color: #1e3a5f; font-family: monospace;">${payment.razorpayPaymentId || payment._id}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; border: 1px solid #e2e8f0; font-weight: 600; color: #4a5568;">Amount</td>
              <td style="padding: 12px 16px; border: 1px solid #e2e8f0; color: #059669; font-weight: 700;">₹${payment.amount}</td>
            </tr>
            <tr style="background: #f8fafc;">
              <td style="padding: 12px 16px; border: 1px solid #e2e8f0; font-weight: 600; color: #4a5568;">Purpose</td>
              <td style="padding: 12px 16px; border: 1px solid #e2e8f0;">${payment.purpose || 'Life Membership'}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; border: 1px solid #e2e8f0; font-weight: 600; color: #4a5568;">Date</td>
              <td style="padding: 12px 16px; border: 1px solid #e2e8f0;">${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
            </tr>
          </table>
          <a href="${process.env.APP_URL}/payments/receipt/${payment._id}" 
             style="display: inline-block; background: #2d6a9f; color: #fff; padding: 12px 28px; border-radius: 6px; text-decoration: none; margin-top: 10px; font-weight: 600;">
            Download Receipt
          </a>
        </div>
        <div style="padding: 20px 30px; background: #f8fafc; text-align: center; color: #718096; font-size: 13px;">
          <p>SVPM College of Engineering, Malegaon Bk, Baramati, Pune - 413115</p>
        </div>
      </div>
    `
  })
};

module.exports = { sendEmail, emailTemplates };
