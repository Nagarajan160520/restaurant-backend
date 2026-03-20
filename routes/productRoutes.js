const express = require('express');
const router = express.Router();
const {
  getProducts,
  getLowStockProducts,
  getOutOfStockProducts,
  createProduct,
  updateProduct,
  updateStock,
  deleteProduct
} = require('../controllers/productController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/')
  .get(getProducts)
  .post(protect, admin, createProduct);

router.get('/low-stock', getLowStockProducts);
router.get('/out-of-stock', getOutOfStockProducts);

router.route('/:id')
  .get(getProducts)
  .put(protect, admin, updateProduct)
  .delete(protect, admin, deleteProduct);

router.put('/:id/stock', protect, admin, updateStock);

module.exports = router;