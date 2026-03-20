const mongoose = require('mongoose');

const smsLogSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['sent', 'failed', 'pending'],
    default: 'sent'
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  error: String,
  sentAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('SMSLog', smsLogSchema);