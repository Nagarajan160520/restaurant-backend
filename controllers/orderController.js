const Order = require('../models/Order');
const Notification = require('../models/Notification');
const User = require('../models/User');
const smsService = require('../services/smsService');

// @desc    Get all orders (admin sees all, user sees their own)
// @route   GET /api/orders
// @access  Private
const getOrders = async (req, res) => {
  try {
    let query = {};
    
    if (req.user.role !== 'admin') {
      query.user = req.user._id;
    }
    
    const orders = await Order.find(query)
      .populate('user', 'name email phone')
      .populate('items.product')
      .sort({ createdAt: -1 });
    
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single order by ID
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email phone')
      .populate('items.product');
    
    if (order) {
      if (req.user.role === 'admin' || order.user._id.toString() === req.user._id.toString()) {
        res.json(order);
      } else {
        res.status(401).json({ message: 'Not authorized' });
      }
    } else {
      res.status(404).json({ message: 'Order not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a new order
// @route   POST /api/orders
// @access  Private
const createOrder = async (req, res) => {
  try {
    const { 
      items, 
      totalAmount, 
      paymentMethod, 
      deliveryAddress, 
      phone,
      customerName,
      customerEmail,
      subtotal,
      tax,
      deliveryFee,
      discount
    } = req.body;
    
    // Validate phone number
    if (!phone || !/^[0-9]{10}$/.test(phone)) {
      return res.status(400).json({ 
        message: 'Please provide a valid 10-digit phone number for order updates' 
      });
    }
    
    // Create order
    const order = await Order.create({
      user: req.user._id,
      items,
      totalAmount: totalAmount || (subtotal + (deliveryFee || 40) + (tax || 0) - (discount || 0)),
      subtotal: subtotal || items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
      tax: tax || 0,
      deliveryFee: deliveryFee || 40,
      discount: discount || 0,
      paymentMethod: paymentMethod || 'cash',
      deliveryAddress: deliveryAddress || 'Not provided',
      phone: phone,
      status: 'pending'
    });
    
    const populatedOrder = await Order.findById(order._id)
      .populate('user', 'name email phone');
    
    // Create notification for admin
    await Notification.create({
      title: 'New Order Received!',
      message: `New order #${order._id.toString().slice(-6)} from ${req.user.name} (${phone}) for ₹${order.totalAmount}`,
      type: 'order',
      forUsers: false,
      isActive: true,
      orderId: order._id,
      metadata: {
        customerName: req.user.name,
        customerPhone: phone,
        total: order.totalAmount
      }
    });
    
    // Create notification for customer (in-app)
    await Notification.create({
      title: 'Order Placed Successfully!',
      message: `Your order #${order._id.toString().slice(-6)} has been placed successfully. Total: ₹${order.totalAmount}. We'll notify you when it's being prepared.`,
      type: 'order',
      forUsers: true,
      userId: req.user._id,
      isActive: true,
      orderId: order._id
    });
    
    // Send SMS confirmation to customer
    if (phone) {
      await smsService.sendOrderConfirmation(
        phone,
        order._id.toString().slice(-6),
        order.totalAmount,
        items
      );
    }
    
    res.status(201).json(populatedOrder);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update order status
// @route   PUT /api/orders/:id
// @access  Private/Admin
const updateOrderStatus = async (req, res) => {
  try {
    const { status, note } = req.body;
    const order = await Order.findById(req.params.id).populate('user', 'name email phone');
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    const oldStatus = order.status;
    order.status = status || order.status;
    
    if (note) {
      order.notes = order.notes || [];
      order.notes.push({
        message: note,
        date: new Date(),
        by: req.user.name
      });
    }
    
    const updatedOrder = await order.save();
    
    // Create notification based on status change
    let notificationTitle = '';
    let notificationMessage = '';
    let notificationType = 'order';
    let smsMessage = '';
    
    switch(status) {
      case 'processing':
        notificationTitle = 'Order is Being Prepared!';
        notificationMessage = `Your order #${order._id.toString().slice(-6)} is now being prepared. Estimated time: 30-45 minutes.`;
        smsMessage = `👨‍🍳 ${notificationMessage}`;
        break;
      case 'ready':
        notificationTitle = 'Order is Ready!';
        notificationMessage = `Your order #${order._id.toString().slice(-6)} is ready for delivery.`;
        smsMessage = `✅ ${notificationMessage}`;
        break;
      case 'out_for_delivery':
        notificationTitle = 'Order Out for Delivery!';
        notificationMessage = `Your order #${order._id.toString().slice(-6)} is out for delivery. Delivery partner will contact you shortly.`;
        smsMessage = `🚚 ${notificationMessage}`;
        break;
      case 'completed':
        notificationTitle = 'Order Delivered!';
        notificationMessage = `Your order #${order._id.toString().slice(-6)} has been delivered. Thank you for ordering with us!`;
        smsMessage = `🎉 ${notificationMessage} Rate your experience: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders`;
        break;
      case 'cancelled':
        notificationTitle = 'Order Cancelled';
        notificationMessage = `Your order #${order._id.toString().slice(-6)} has been cancelled. Reason: ${note || 'Requested by customer'}`;
        smsMessage = `❌ ${notificationMessage}`;
        break;
      default:
        notificationTitle = `Order Status Updated`;
        notificationMessage = `Your order #${order._id.toString().slice(-6)} status: ${status}`;
        smsMessage = `🔄 ${notificationMessage}`;
    }
    
    // Send in-app notification to customer
    if (order.user) {
      await Notification.create({
        title: notificationTitle,
        message: notificationMessage,
        type: notificationType,
        forUsers: true,
        userId: order.user._id,
        isActive: true,
        orderId: order._id,
        metadata: { oldStatus, newStatus: status }
      });
      
      // Send SMS notification if phone number exists
      if (order.user.phone) {
        await smsService.sendOrderStatusUpdate(
          order.user.phone,
          order._id.toString().slice(-6),
          status,
          {
            total: order.totalAmount,
            phone: order.user.phone,
            reason: note
          }
        );
      } else if (order.phone) {
        // Use order phone if user phone is not available
        await smsService.sendOrderStatusUpdate(
          order.phone,
          order._id.toString().slice(-6),
          status,
          {
            total: order.totalAmount,
            phone: order.phone,
            reason: note
          }
        );
      }
    }
    
    res.json(updatedOrder);
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Cancel order
// @route   PUT /api/orders/:id/cancel
// @access  Private (both user and admin can cancel)
const cancelOrder = async (req, res) => {
  try {
    const { reason } = req.body;
    const order = await Order.findById(req.params.id).populate('user', 'name email phone');
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Check if user is authorized to cancel (either owner or admin)
    if (req.user.role !== 'admin' && order.user._id.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized to cancel this order' });
    }
    
    // Check if order can be cancelled (only pending or processing)
    if (order.status !== 'pending' && order.status !== 'processing') {
      return res.status(400).json({ 
        message: 'Order cannot be cancelled at this stage. It is already ' + order.status 
      });
    }
    
    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.cancelReason = reason || (req.user.role === 'admin' ? 'Cancelled by admin' : 'Cancelled by customer');
    
    const updatedOrder = await order.save();
    
    // Create cancellation notification for customer
    if (order.user) {
      await Notification.create({
        title: 'Order Cancelled',
        message: `Your order #${order._id.toString().slice(-6)} has been cancelled. Reason: ${order.cancelReason}`,
        type: 'order',
        forUsers: true,
        userId: order.user._id,
        isActive: true,
        orderId: order._id
      });
      
      // Send SMS cancellation notification
      if (order.user.phone) {
        await smsService.sendOrderStatusUpdate(
          order.user.phone,
          order._id.toString().slice(-6),
          'cancelled',
          { reason: order.cancelReason }
        );
      }
    }
    
    // Notify admin about cancellation (if cancelled by customer)
    if (req.user.role !== 'admin') {
      await Notification.create({
        title: 'Order Cancelled by Customer',
        message: `Order #${order._id.toString().slice(-6)} has been cancelled by ${order.user.name}. Reason: ${order.cancelReason}`,
        type: 'order',
        forUsers: false,
        isActive: true,
        orderId: order._id
      });
    }
    
    res.json(updatedOrder);
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get order statistics for admin dashboard
// @route   GET /api/orders/stats
// @access  Private/Admin
const getOrderStats = async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ status: 'pending' });
    const processingOrders = await Order.countDocuments({ status: 'processing' });
    const completedOrders = await Order.countDocuments({ status: 'completed' });
    const cancelledOrders = await Order.countDocuments({ status: 'cancelled' });
    
    const totalRevenue = await Order.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    
    res.json({
      total: totalOrders,
      pending: pendingOrders,
      processing: processingOrders,
      completed: completedOrders,
      cancelled: cancelledOrders,
      revenue: totalRevenue[0]?.total || 0
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  cancelOrder,
  getOrderStats
};