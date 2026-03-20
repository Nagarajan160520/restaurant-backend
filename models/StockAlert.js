const mongoose = require('mongoose');

const stockAlertSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: String,
  currentStock: Number,
  threshold: Number,
  status: {
    type: String,
    enum: ['pending', 'resolved', 'notified'],
    default: 'pending'
  },
  message: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  resolvedAt: Date
});

module.exports = mongoose.model('StockAlert', stockAlertSchema);