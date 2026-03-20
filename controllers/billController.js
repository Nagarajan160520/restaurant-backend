const Bill = require('../models/Bill');
const Product = require('../models/Product');
const Notification = require('../models/Notification');

// Create new bill
const createBill = async (req, res) => {
  try {
    const { items, customer, paymentMethod, billType, discount } = req.body;
    
    // Validate items and calculate totals
    let subtotal = 0;
    const processedItems = [];
    
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(404).json({ message: `Product ${item.name} not found` });
      }
      
      if (product.stock < item.quantity) {
        return res.status(400).json({ 
          message: `Insufficient stock for ${product.name}. Available: ${product.stock}` 
        });
      }
      
      // Update stock
      product.stock -= item.quantity;
      await product.save();
      
      const itemTotal = item.price * item.quantity;
      subtotal += itemTotal;
      
      processedItems.push({
        productId: product._id,
        name: product.name,
        category: product.category,
        subcategory: product.subcategory,
        quantity: item.quantity,
        price: item.price,
        total: itemTotal
      });
    }
    
    const tax = subtotal * 0.05;
    const total = subtotal + tax - (discount || 0);
    
    const bill = await Bill.create({
      items: processedItems,
      customer: {
        name: customer?.name || 'Walk-in Customer',
        phone: customer?.phone,
        email: customer?.email
      },
      subtotal,
      tax,
      discount: discount || 0,
      total,
      paymentMethod: paymentMethod || 'cash',
      billType,
      createdBy: req.user._id
    });
    
    // Send low stock notifications
    for (const item of processedItems) {
      const product = await Product.findById(item.productId);
      if (product.isLowStock()) {
        await Notification.create({
          title: 'Low Stock Alert!',
          message: `${product.name} has only ${product.stock} items left. Please restock.`,
          type: 'warning',
          forUsers: false,
          isActive: true,
          metadata: {
            productId: product._id,
            productName: product.name,
            currentStock: product.stock,
            threshold: product.lowStockThreshold
          }
        });
      }
    }
    
    res.status(201).json(bill);
  } catch (error) {
    console.error('Error creating bill:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get all bills with filters
const getBills = async (req, res) => {
  try {
    const { startDate, endDate, billType, limit = 100 } = req.query;
    let query = {};
    
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    if (billType) query.billType = billType;
    
    const bills = await Bill.find(query)
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    
    // Calculate summary
    const totalRevenue = bills.reduce((sum, bill) => sum + bill.total, 0);
    const totalBills = bills.length;
    const averageBill = totalBills > 0 ? totalRevenue / totalBills : 0;
    
    res.json({
      bills,
      summary: {
        totalRevenue,
        totalBills,
        averageBill
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get daily sales report
const getDailySales = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const bills = await Bill.find({
      createdAt: { $gte: today, $lt: tomorrow },
      paymentStatus: 'paid'
    }).populate('createdBy', 'name');
    
    const total = bills.reduce((sum, bill) => sum + bill.total, 0);
    const count = bills.length;
    
    const byCategory = {
      restaurant: 0,
      bakery: 0,
      ecommerce: 0
    };
    
    bills.forEach(bill => {
      if (byCategory[bill.billType] !== undefined) {
        byCategory[bill.billType] += bill.total;
      }
    });
    
    // Top selling products
    const productSales = {};
    bills.forEach(bill => {
      bill.items.forEach(item => {
        if (!productSales[item.name]) {
          productSales[item.name] = {
            name: item.name,
            quantity: 0,
            revenue: 0
          };
        }
        productSales[item.name].quantity += item.quantity;
        productSales[item.name].revenue += item.total;
      });
    });
    
    const topProducts = Object.values(productSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
    
    res.json({
      date: today,
      total,
      count,
      byCategory,
      bills: bills.slice(0, 20),
      topProducts,
      averageBill: count > 0 ? total / count : 0
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get single bill by ID
const getBillById = async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id)
      .populate('createdBy', 'name email');
    
    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }
    
    res.json(bill);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createBill,
  getBills,
  getDailySales,
  getBillById
};