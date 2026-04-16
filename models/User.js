const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  alumniId: {
    type: String,
    unique: true,
    sparse: true
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  phone: {
    type: String,
    trim: true
  },
  role: {
    type: String,
    enum: ['alumni', 'admin'],
    default: 'alumni'
  },
  firebaseUid: {
    type: String,
    sparse: true
  },
  authProvider: {
    type: String,
    enum: ['local', 'google', 'phone'],
    default: 'local'
  },
  avatar: {
    type: String,
    default: null
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  membershipStatus: {
    type: String,
    enum: ['none', 'pending', 'approved', 'rejected'],
    default: 'none'
  },
  membershipAppliedAt: Date,
  membershipApprovedAt: Date,
  membershipRejectedAt: Date,
  membershipRejectionReason: String,

  profile: {
    branch: {
      type: String,
      enum: ['Computer Engineering', 'Mechanical Engineering', 'Civil Engineering',
        'Electronics & Telecommunication', 'Electrical Engineering',
        'Information Technology', 'Administration', 'Other'],
      default: 'Computer Engineering'
    },
    passOutYear: {
      type: Number,
      min: 1990,
      max: new Date().getFullYear() + 1
    },
    designation: String,
    company: String,
    location: String,
    linkedin: String,
    bio: String
  },

  resetPasswordToken: String,
  resetPasswordExpire: Date,

  lastLogin: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Generate Alumni ID before save
userSchema.pre('save', async function (next) {
  // Generate alumniId
  if (!this.alumniId && this.role === 'alumni') {
    const year = this.profile?.passOutYear || new Date().getFullYear();
    const count = await mongoose.model('User').countDocuments({ role: 'alumni' });
    this.alumniId = `SVPM-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  // Hash password
  if (!this.isModified('password') || !this.password) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.toPublicJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpire;
  delete obj.firebaseUid;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
