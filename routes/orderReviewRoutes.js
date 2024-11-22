const express = require("express");
const { rateOrderAndStore, getStoreReviews, checkOrderReview, addReplyToReview } = require("../controllers/orderReviewController");
const { authenticateToken } = require("../middlewares/authMiddleware");
const router = express.Router();

router.post("/rate-order-store", authenticateToken, rateOrderAndStore);
router.get("/check/:orderId", authenticateToken, checkOrderReview);
router.get("/store-reviews/:storeId", authenticateToken, getStoreReviews);
router.post("/reply/:reviewId/", authenticateToken, addReplyToReview);

module.exports = router;
