const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['restaurant', 'bakery', 'ecommerce']
  },
  subcategory: {
    type: String,
    enum: ['veg', 'nonveg', 'cakes', 'breads', 'pastries', 'electronics', 'clothing', 'other'],
    default: 'other'
  },
  image: {
    type: String,
    default: 'https://via.placeholder.com/300'
  },
  stock: {
    type: Number,
    default: 0,
    min: 0
  },
  lowStockThreshold: {
    type: Number,
    default: 5
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  sku: {
    type: String,
    unique: true,
    sparse: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
productSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to check if stock is low
productSchema.methods.isLowStock = function() {
  return this.stock <= this.lowStockThreshold && this.stock > 0;
};

// Method to check if out of stock
productSchema.methods.isOutOfStock = function() {
  return this.stock <= 0;
};

module.exports = mongoose.model('Product', productSchema);