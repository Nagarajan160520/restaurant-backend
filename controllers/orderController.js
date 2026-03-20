const Order = require('../models/Order');
const Notification = require('../models/Notification');
const User = require('../models/User');

// Get all orders (admin sees all, user sees their own)
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

// Get single order
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

// Create order with notifications
const createOrder = async (req, res) => {
  try {
    const { items, totalAmount, paymentMethod, deliveryAddress, phone } = req.body;
    
    const order = await Order.create({
      user: req.user._id,
      items,
      totalAmount,
      paymentMethod,
      deliveryAddress: deliveryAddress || 'Not provided',
      phone: phone || req.user.phone || 'Not provided',
      status: 'pending'
    });
    
    const populatedOrder = await Order.findById(order._id)
      .populate('user', 'name email phone');
    
    // Create notification for admin
    await Notification.create({
      title: 'New Order Received!',
      message: `New order #${order._id.toString().slice(-6)} from ${req.user.name} for ₹${totalAmount}`,
      type: 'order',
      forUsers: false, // Admin only
      isActive: true,
      orderId: order._id
    });
    
    // Create notification for customer
    await Notification.create({
      title: 'Order Placed Successfully!',
      message: `Your order #${order._id.toString().slice(-6)} has been placed successfully. Total: ₹${totalAmount}`,
      type: 'order',
      forUsers: true,
      userId: req.user._id,
      isActive: true,
      orderId: order._id
    });
    
    res.status(201).json(populatedOrder);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update order status with notifications
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
    
    switch(status) {
      case 'processing':
        notificationTitle = 'Order is Being Prepared!';
        notificationMessage = `Your order #${order._id.toString().slice(-6)} is now being prepared. Estimated time: 30-45 minutes.`;
        break;
      case 'ready':
        notificationTitle = 'Order is Ready!';
        notificationMessage = `Your order #${order._id.toString().slice(-6)} is ready for delivery.`;
        break;
      case 'out_for_delivery':
        notificationTitle = 'Order Out for Delivery!';
        notificationMessage = `Your order #${order._id.toString().slice(-6)} is out for delivery. Delivery partner will contact you shortly.`;
        break;
      case 'completed':
        notificationTitle = 'Order Delivered!';
        notificationMessage = `Your order #${order._id.toString().slice(-6)} has been delivered. Thank you for ordering with us!`;
        break;
      case 'cancelled':
        notificationTitle = 'Order Cancelled';
        notificationMessage = `Your order #${order._id.toString().slice(-6)} has been cancelled. Reason: ${note || 'Requested by customer'}`;
        break;
      default:
        notificationTitle = `Order Status Updated`;
        notificationMessage = `Your order #${order._id.toString().slice(-6)} status: ${status}`;
    }
    
    // Send notification to customer
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
    }
    
    // Send SMS notification (mock - you can integrate actual SMS service)
    if (order.user && order.user.phone) {
      await sendSMSNotification(order.user.phone, notificationMessage);
    }
    
    res.json(updatedOrder);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Cancel order (customer or admin)
const cancelOrder = async (req, res) => {
  try {
    const { reason } = req.body;
    const order = await Order.findById(req.params.id).populate('user', 'name email phone');
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Check if order can be cancelled (only pending or processing)
    if (order.status !== 'pending' && order.status !== 'processing') {
      return res.status(400).json({ message: 'Order cannot be cancelled at this stage' });
    }
    
    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.cancelReason = reason || 'Cancelled by customer';
    
    const updatedOrder = await order.save();
    
    // Create cancellation notification
    await Notification.create({
      title: 'Order Cancelled',
      message: `Your order #${order._id.toString().slice(-6)} has been cancelled. Reason: ${reason || 'Requested by customer'}`,
      type: 'order',
      forUsers: true,
      userId: order.user._id,
      isActive: true,
      orderId: order._id
    });
    
    // Notify admin about cancellation
    await Notification.create({
      title: 'Order Cancelled',
      message: `Order #${order._id.toString().slice(-6)} has been cancelled by ${order.user.name}. Reason: ${reason || 'Customer request'}`,
      type: 'order',
      forUsers: false,
      isActive: true,
      orderId: order._id
    });
    
    res.json(updatedOrder);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Helper function to send SMS (mock - replace with actual SMS service)
const sendSMSNotification = async (phone, message) => {
  try {
    // This is a mock function
    console.log(`SMS to ${phone}: ${message}`);
    // You can integrate with Twilio, AWS SNS, or any SMS service here
    return true;
  } catch (error) {
    console.error('SMS sending failed:', error);
    return false;
  }
};

module.exports = {
  getOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  cancelOrder
};