const express = require('express');
const router = express.Router();
const {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseReport
} = require('../controllers/expenseController');
const { protect, admin } = require('../middleware/authMiddleware');

router.use(protect, admin);

router.route('/')
  .get(getExpenses)
  .post(createExpense);

router.get('/report', getExpenseReport);

router.route('/:id')
  .put(updateExpense)
  .delete(deleteExpense);

module.exports = router;