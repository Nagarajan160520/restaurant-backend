const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    name: String,
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    price: Number
  }],
  totalAmount: {
    type: Number,
    required: true
  },
  subtotal: Number,
  tax: Number,
  deliveryFee: Number,
  discount: Number,
  status: {
    type: String,
    enum: ['pending', 'processing', 'ready', 'out_for_delivery', 'completed', 'cancelled'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'online'],
    default: 'cash'
  },
  deliveryAddress: {
    type: String,
    default: 'Not provided'
  },
  phone: {
    type: String,
    default: 'Not provided'
  },
  notes: [{
    message: String,
    date: Date,
    by: String
  }],
  cancelledAt: Date,
  cancelReason: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Order', orderSchema);