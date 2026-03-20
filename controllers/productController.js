const Product = require('../models/Product');
const StockAlert = require('../models/StockAlert');
const Notification = require('../models/Notification');

// Get all products with filters
const getProducts = async (req, res) => {
  try {
    const { category, subcategory, lowStock, search } = req.query;
    let query = {};
    
    if (category) query.category = category;
    if (subcategory) query.subcategory = subcategory;
    if (lowStock === 'true') {
      query.$expr = { $lte: ['$stock', '$lowStockThreshold'] };
      query.stock = { $gt: 0 };
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    const products = await Product.find(query).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get low stock products
const getLowStockProducts = async (req, res) => {
  try {
    const products = await Product.find({
      $expr: { $lte: ['$stock', '$lowStockThreshold'] },
      stock: { $gt: 0 }
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get out of stock products
const getOutOfStockProducts = async (req, res) => {
  try {
    const products = await Product.find({ stock: 0, isAvailable: true });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create product with stock management
const createProduct = async (req, res) => {
  try {
    const product = await Product.create(req.body);
    
    // Check if stock is low on creation
    if (product.isLowStock()) {
      await StockAlert.create({
        productId: product._id,
        productName: product.name,
        currentStock: product.stock,
        threshold: product.lowStockThreshold,
        message: `Product "${product.name}" has low stock (${product.stock} remaining)`
      });
      
      await Notification.create({
        title: 'Low Stock Alert!',
        message: `${product.name} has only ${product.stock} items left in stock.`,
        type: 'warning',
        forUsers: false,
        isActive: true
      });
    }
    
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update product with stock alert
const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    const oldStock = product.stock;
    const newStock = req.body.stock;
    
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true }
    );
    
    // Check stock alerts
    if (updatedProduct.isLowStock()) {
      await StockAlert.create({
        productId: updatedProduct._id,
        productName: updatedProduct.name,
        currentStock: updatedProduct.stock,
        threshold: updatedProduct.lowStockThreshold,
        message: `Product "${updatedProduct.name}" has low stock (${updatedProduct.stock} remaining)`
      });
      
      await Notification.create({
        title: 'Low Stock Alert!',
        message: `${updatedProduct.name} has only ${updatedProduct.stock} items left. Please restock soon.`,
        type: 'warning',
        forUsers: false,
        isActive: true
      });
    }
    
    // If stock is zero, disable availability
    if (updatedProduct.stock === 0 && updatedProduct.isAvailable) {
      updatedProduct.isAvailable = false;
      await updatedProduct.save();
      
      await Notification.create({
        title: 'Out of Stock!',
        message: `${updatedProduct.name} is now out of stock.`,
        type: 'warning',
        forUsers: true,
        isActive: true
      });
    }
    
    res.json(updatedProduct);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update stock quantity
const updateStock = async (req, res) => {
  try {
    const { quantity, operation } = req.body;
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    let newStock = product.stock;
    
    if (operation === 'add') {
      newStock += quantity;
    } else if (operation === 'remove') {
      if (product.stock < quantity) {
        return res.status(400).json({ message: 'Insufficient stock' });
      }
      newStock -= quantity;
    }
    
    product.stock = newStock;
    product.isAvailable = newStock > 0;
    await product.save();
    
    // Check stock alerts after update
    if (product.isLowStock()) {
      await StockAlert.create({
        productId: product._id,
        productName: product.name,
        currentStock: product.stock,
        threshold: product.lowStockThreshold,
        message: `Product "${product.name}" has low stock (${product.stock} remaining)`
      });
    }
    
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete product
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (product) {
      await product.deleteOne();
      res.json({ message: 'Product removed' });
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getProducts,
  getLowStockProducts,
  getOutOfStockProducts,
  createProduct,
  updateProduct,
  updateStock,
  deleteProduct
};