const express = require('express');
const router = express.Router();
const smsService = require('../services/smsService');
const { protect, admin } = require('../middleware/authMiddleware');

// Test SMS sending (Admin only)
router.post('/test-sms', protect, admin, async (req, res) => {
  try {
    const { phone, message } = req.body;
    
    if (!phone || !message) {
      return res.status(400).json({ message: 'Phone and message are required' });
    }
    
    const result = await smsService.sendSMS(phone, message);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get SMS logs (Admin only)
router.get('/sms-logs', protect, admin, async (req, res) => {
  try {
    const SMSLog = require('../models/SMSLog');
    const logs = await SMSLog.find().sort({ sentAt: -1 }).limit(100);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;