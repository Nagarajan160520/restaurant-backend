// SMS Service - You can integrate with Twilio, MSG91, etc.
// For now, we'll create a mock service that logs SMS
// Replace with actual SMS provider API

class SMSService {
  constructor() {
    // Initialize SMS provider here
    // Example with Twilio:
    // const twilio = require('twilio');
    // this.client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
  }

  // Send SMS to customer
  async sendOrderStatusUpdate(phone, orderId, status, details = {}) {
    const messages = {
      'pending': `✅ Order #${orderId} has been placed successfully! Total: ₹${details.total}. We'll notify you once it's being prepared.`,
      'processing': `👨‍🍳 Great news! Your order #${orderId} is now being prepared. Estimated time: 30-45 minutes.`,
      'ready': `✅ Your order #${orderId} is ready! It will be delivered shortly.`,
      'out_for_delivery': `🚚 Your order #${orderId} is out for delivery! Delivery partner will contact you at ${details.phone || 'your number'}.`,
      'completed': `🎉 Your order #${orderId} has been delivered! Thank you for ordering with us. Rate your experience: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders`,
      'cancelled': `❌ Your order #${orderId} has been cancelled. Reason: ${details.reason || 'Requested by customer'}`
    };

    const message = messages[status] || `Order #${orderId} status updated to ${status}`;
    
    return await this.sendSMS(phone, message);
  }

  // Send order confirmation
  async sendOrderConfirmation(phone, orderId, total, items) {
    const message = `🍽️ ORDER CONFIRMED!\n\nOrder #${orderId}\nTotal: ₹${total}\nItems: ${items.length}\n\nWe'll notify you when your order is ready.\nThank you for ordering!`;
    
    return await this.sendSMS(phone, message);
  }

  // Send OTP for verification (optional)
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
    
    console.log(`📱 Sending SMS to ${fullPhone}`);
    console.log(`📝 Message: ${message}`);
    
    // Store in database for logging
    await this.logSMS(fullPhone, message, 'sent');
    
    // Actual SMS sending - Choose one provider:
    
    // OPTION 1: Twilio (Recommended for international)
    /*
    try {
      const result = await this.client.messages.create({
        body: message,
        to: fullPhone,
        from: process.env.TWILIO_PHONE_NUMBER
      });
      console.log('SMS sent successfully:', result.sid);
      return { success: true, sid: result.sid };
    } catch (error) {
      console.error('SMS sending failed:', error);
      return { success: false, error: error.message };
    }
    */
    
    // OPTION 2: MSG91 (Popular in India)
    /*
    const axios = require('axios');
    try {
      const response = await axios.post('https://api.msg91.com/api/v5/flow/', {
        sender: 'RSTRNT',
        mobiles: fullPhone,
        message: message,
        authkey: process.env.MSG91_AUTH_KEY
      });
      return { success: true, data: response.data };
    } catch (error) {
      console.error('SMS sending failed:', error);
      return { success: false, error: error.message };
    }
    */
    
    // OPTION 3: Fast2SMS (Free for testing)
    /*
    const axios = require('axios');
    try {
      const response = await axios.get('https://www.fast2sms.com/dev/bulkV2', {
        params: {
          authorization: process.env.FAST2SMS_API_KEY,
          message: message,
          route: 'dlt',
          numbers: cleanPhone
        }
      });
      return { success: true, data: response.data };
    } catch (error) {
      console.error('SMS sending failed:', error);
      return { success: false, error: error.message };
    }
    */
    
    // For now, simulate SMS sending
    await new Promise(resolve => setTimeout(resolve, 500));
    return { success: true, message: 'SMS sent (simulated)' };
  }

  // Log SMS to database
  async logSMS(phone, message, status) {
    try {
      const SMSLog = require('../models/SMSLog');
      await SMSLog.create({
        phone,
        message,
        status,
        sentAt: new Date()
      });
    } catch (error) {
      console.error('Error logging SMS:', error);
    }
  }
}

module.exports = new SMSService();