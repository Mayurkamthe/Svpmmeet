const User = require('../models/User');

const seedAdmin = async () => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@svpmcoe.edu.in';
    const existing = await User.findOne({ email: adminEmail });
    if (existing) {
      console.log(`✓ Admin already exists: ${adminEmail}`);
      return;
    }

    // Do NOT pre-hash — the User model pre('save') hook hashes automatically.
    // Passing an already-hashed password causes double-hashing and login failure.
    await User.create({
      name: process.env.ADMIN_NAME || 'SVPM Admin',
      email: adminEmail,
      password: process.env.ADMIN_PASSWORD || 'Admin@SVPM2024',
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

    console.log(`✓ Admin seeded: ${adminEmail} / ${process.env.ADMIN_PASSWORD || 'Admin@SVPM2024'}`);
  } catch (err) {
    console.error('Seeder error:', err.message);
  }
};

module.exports = { seedAdmin };
