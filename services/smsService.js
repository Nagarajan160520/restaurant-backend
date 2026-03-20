// SMS Service - Mock implementation for now
// You can integrate with Twilio, MSG91, Fast2SMS, etc.

class SMSService {
  constructor() {
    console.log('SMS Service initialized (Mock mode)');
  }

  // Send order confirmation SMS
  async sendOrderConfirmation(phone, orderId, total, items) {
    const message = `🍽️ ORDER CONFIRMED!\n\nOrder #${orderId}\nTotal: ₹${total}\nItems: ${items.length}\n\nWe'll notify you when your order is ready.\nThank you for ordering!`;
    
    return await this.sendSMS(phone, message);
  }

  // Send order status update SMS
  async sendOrderStatusUpdate(phone, orderId, status, details = {}) {
    const messages = {
      'pending': `✅ Order #${orderId} placed successfully! Total: ₹${details.total}. We'll notify you when it's being prepared.`,
      'processing': `👨‍🍳 Great news! Order #${orderId} is being prepared. Estimated: 30-45 mins.`,
      'ready': `✅ Order #${orderId} is ready! It will be delivered shortly.`,
      'out_for_delivery': `🚚 Order #${orderId} is out for delivery! Delivery partner will contact you at ${details.phone}.`,
      'completed': `🎉 Order #${orderId} delivered! Thank you for ordering. Rate your experience: ${process.env.FRONTEND_URL}/orders`,
      'cancelled': `❌ Order #${orderId} cancelled. Reason: ${details.reason || 'Requested by customer'}`
    };

    const message = messages[status] || `Order #${orderId} status: ${status}`;
    return await this.sendSMS(phone, message);
  }

  // Send OTP for verification
  async sendOTP(phone, otp) {
    const message = `Your verification code is: ${otp}\nValid for 10 minutes. Do not share with anyone.`;
    return await this.sendSMS(phone, message);
  }

  // Generic SMS sender
  async sendSMS(phone, message) {
    // Remove any non-digit characters
    const cleanPhone = phone.replace(/\D/g, '');
    
    if (!cleanPhone || cleanPhone.length !== 10) {
      console.error('Invalid phone number:', phone);
      return { success: false, error: 'Invalid phone number' };
    }

    // Format phone number for India (+91)
    const fullPhone = `+91${cleanPhone}`;
    
    console.log(`\n📱 ========== SMS SENDING ==========`);
    console.log(`📱 To: ${fullPhone}`);
    console.log(`📝 Message: ${message}`);
    console.log(`📱 =================================\n`);
    
    // Store in database for logging (optional)
    try {
      const SMSLog = require('../models/SMSLog');
      await SMSLog.create({
        phone: fullPhone,
        message: message,
        status: 'sent',
        sentAt: new Date()
      });
    } catch (error) {
      console.error('Error logging SMS:', error);
    }
    
    // TODO: Integrate actual SMS provider here
    // Example with Twilio:
    // const twilio = require('twilio');
    // const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
    // await client.messages.create({
    //   body: message,
    //   to: fullPhone,
    //   from: process.env.TWILIO_PHONE_NUMBER
    // });
    
    // For now, just return success (mock)
    return { success: true, message: 'SMS sent (mock)', phone: fullPhone };
  }
}

module.exports = new SMSService();