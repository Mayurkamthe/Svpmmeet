const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Event title is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Event description is required']
  },
  date: {
    type: Date,
    required: [true, 'Event date is required']
  },
  endDate: Date,
  venue: {
    type: String,
    required: [true, 'Venue is required']
  },
  type: {
    type: String,
    enum: ['seminar', 'reunion', 'workshop', 'cultural', 'sports', 'other'],
    default: 'other'
  },
  image: String,
  isFeatured: { type: Boolean, default: false },
  isFree: { type: Boolean, default: true },
  fee: { type: Number, default: 0 },
  maxAttendees: { type: Number, default: 0 },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

eventSchema.virtual('registrationCount', {
  ref: 'EventRegistration',
  localField: '_id',
  foreignField: 'event',
  count: true
});

eventSchema.set('toJSON', { virtuals: true });
eventSchema.set('toObject', { virtuals: true });

const eventRegistrationSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['registered', 'attended', 'cancelled'],
    default: 'registered'
  },
  payment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment'
  },
  registeredAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

eventRegistrationSchema.index({ event: 1, user: 1 }, { unique: true });

const Event = mongoose.model('Event', eventSchema);
const EventRegistration = mongoose.model('EventRegistration', eventRegistrationSchema);

module.exports = { Event, EventRegistration };
