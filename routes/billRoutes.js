const express = require('express');
const router = express.Router();
const {
  createBill,
  getBills,
  getDailySales,
  getBillById
} = require('../controllers/billController');
const { protect, admin } = require('../middleware/authMiddleware');

// All bill routes require admin authentication
router.use(protect, admin);

// Create new bill
router.post('/', createBill);

// Get all bills with filters
router.get('/', getBills);

// Get daily sales report
router.get('/daily-sales', getDailySales);

// Get single bill by ID
router.get('/:id', getBillById);

module.exports = router;