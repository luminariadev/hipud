import express from 'express';
// Tambahkan cancelOrder pada baris import di bawah ini
import { createOrder, getOrders, updateOrderStatus, deleteOrder, downloadReceipt, cancelOrder } from '../controllers/orderController.js';
import { verifyToken } from '../middlewares/authMiddleware.js'; // <-- Panggil Satpam

const router = express.Router();

// ==========================================
// PINTU TERBUKA (Publik / Pembeli)
// ==========================================
router.post('/', createOrder);
// Pembatalan oleh pemilik pesanan. Wajib menyertakan cancelToken
// yang hanya diberikan kepada pemesan saat pesanan dibuat.
router.put('/:invoiceNumber/cancel', cancelOrder);

// ==========================================
// PINTU TERGEMBOK (Hanya Admin)
// ==========================================
router.get('/', verifyToken, getOrders);
router.put('/:id/status', verifyToken, updateOrderStatus);
router.delete('/:id', verifyToken, deleteOrder);
router.get('/:id/receipt', verifyToken, downloadReceipt);

export default router;