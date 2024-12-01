const express = require("express");
const { sendOrderNotificationToStore, getReviewByOrderId, getRevenueByMonthAndYear, getRevenueByPaymentMethod, getDeliveredOrdersAndRevenueFoodType, deleteUser, lockStore, unlockStore, registerAdmin, loginAdmin, getAllUser, approveSeller, rejectSeller, getLoginMethodStatistics, getStoreCount, getAllStores, approveShipper, rejectShipper, getDeliveredOrdersAndRevenue, getAllUsers, getAllFoods, getAllOrders } = require("../controllers/admincontroller");
const { authenticateToken } = require("../middlewares/authMiddleware"); // Import the middleware
const router = express.Router();
const StoreOrder = require("../models/storeOrder");

// Route đăng ký Admin
router.post("/register", registerAdmin);
router.post("/login", loginAdmin);

// Protect the getAllUser route with authentication middleware
router.get("/get-all-user", authenticateToken, getAllUser);
router.get("/get-all", authenticateToken, getAllUsers);
router.post("/approve-seller", authenticateToken, approveSeller);
router.post("/reject-seller", authenticateToken, rejectSeller);
router.post("/getStoreCount", authenticateToken, getStoreCount);
router.get("/get-all-store/", authenticateToken, getAllStores);
router.post("/approve-shipper", authenticateToken, approveShipper);
router.post("/reject-shipper", authenticateToken, rejectShipper);
router.get("/revenue", authenticateToken, getDeliveredOrdersAndRevenue);
router.get("/get-all-food", authenticateToken, getAllFoods);
router.get("/get-all-order", authenticateToken, getAllOrders);
router.get("/get-all-user-login", authenticateToken, getLoginMethodStatistics);
router.post("/lock-store", authenticateToken, lockStore);
router.post("/unlock-store", authenticateToken, unlockStore);
router.post("/delete-user", authenticateToken, deleteUser);
router.get("/revenuefoodtype", authenticateToken, getDeliveredOrdersAndRevenueFoodType);
router.get("/revenuepayment", authenticateToken, getRevenueByPaymentMethod);
router.get("/revenue-by-month-year", authenticateToken, getRevenueByMonthAndYear);
router.get("/get-review/:orderId", authenticateToken, getReviewByOrderId);
router.get("/get-review/:orderId", authenticateToken, getReviewByOrderId);
// Route để gửi thông báo đơn hàng đến cửa hàng
router.post("/send-notification", async (req, res) => {
  const { orderIds } = req.body;

  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return res.status(400).json({ message: "Danh sách orderIds không hợp lệ." });
  }

  try {
    for (const orderId of orderIds) {
      // Gửi thông báo
      await sendOrderNotificationToStore(orderId);

      // Cập nhật trạng thái đã gửi thông báo
      await StoreOrder.findByIdAndUpdate(orderId, { isNotificationSent: true });
    }

    res.status(200).json({ message: "Thông báo đã được gửi thành công!" });
  } catch (error) {
    console.error("Lỗi khi gửi thông báo:", error.message);
    res.status(500).json({ message: "Lỗi khi gửi thông báo.", error: error.message });
  }
});

module.exports = router;
