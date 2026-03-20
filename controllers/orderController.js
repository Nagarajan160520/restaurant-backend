const Order = require('../models/Order');
const Notification = require('../models/Notification');
const User = require('../models/User');
const smsService = require('../services/smsService');

// ... (keep existing code)

// Update order status with SMS notifications
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
        smsMessage = `🎉 ${notificationMessage} Rate your experience: ${process.env.FRONTEND_URL}/orders`;
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
      }
    }
    
    res.json(updatedOrder);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create order with SMS confirmation
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
      message: `New order #${order._id.toString().slice(-6)} from ${req.user.name} (${req.user.phone}) for ₹${totalAmount}`,
      type: 'order',
      forUsers: false,
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
    
    // Send SMS confirmation
    if (req.user.phone) {
      await smsService.sendOrderConfirmation(
        req.user.phone,
        order._id.toString().slice(-6),
        totalAmount,
        items
      );
    }
    
    res.status(201).json(populatedOrder);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  cancelOrder
};