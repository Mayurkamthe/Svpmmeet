const bcrypt = require('bcryptjs');
const User = require('../models/User');

const seedAdmin = async () => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@svpmcoe.edu.in';
    const existing = await User.findOne({ email: adminEmail });
    if (existing) return;

    const hashedPassword = await bcrypt.hash(
      process.env.ADMIN_PASSWORD || 'Admin@SVPM2024',
      12
    );

    await User.create({
      name: process.env.ADMIN_NAME || 'SVPM Admin',
      email: adminEmail,
      password: hashedPassword,
      role: 'admin',
      isVerified: true,
      membershipStatus: 'approved',
      alumniId: 'ADMIN-001',
      profile: {
        branch: 'Administration',
        passOutYear: new Date().getFullYear(),
        designation: 'Platform Administrator',
        company: 'SVPM College of Engineering'
      }
    });

    console.log(`✓ Admin seeded: ${adminEmail}`);
  } catch (err) {
    console.error('Seeder error:', err.message);
  }
};

module.exports = { seedAdmin };
