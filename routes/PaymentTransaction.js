const express = require("express");
const router = express.Router();
const { deletePaymentTransaction, createPaymentTransaction, updatePaymentTransaction } = require("../controllers/PaymentTransactioncontroller"); // Đường dẫn tới hàm addStaff
const { authenticateToken } = require("../middlewares/authMiddleware");
const PaymentTransaction = require("../models/PaymentTransaction");
const Cart = require("../models/cart");
const { createOrderFromCart } = require("../controllers/storeOrderController"); // Import hàm hủy đơn hàng

router.put("/update-payment/:cartId/:storeId", authenticateToken, updatePaymentTransaction);

router.post("/create-payment/:cartId/:storeId", authenticateToken, createPaymentTransaction);
// router.get("/check-status/:orderCode", authenticateToken, checkPaymentStatus);
router.get("/payment-success", async (req, res) => {
  try {
    const { orderCode, status } = req.query;

    // Debug: Kiểm tra thông tin từ query
    console.log("orderCode:", orderCode, "status:", status);

    // Kiểm tra nếu status không hợp lệ
    // if (!["PAID", "SUCCESS"].includes(status)) {
    //   return res.send("Giao dịch không thành công.");
    // }

    if (!["PAID", "SUCCESS"].includes(status)) {
      return res.redirect("exp://192.168.1.60:8081/--/payment-failed");
    }

    // Tìm giao dịch dựa trên orderCode
    const paymentTransaction = await PaymentTransaction.findOne({ orderCode });

    if (!paymentTransaction) {
      return res.status(404).send("Không tìm thấy giao dịch.");
    }

    console.log("PaymentTransaction found:", paymentTransaction);

    const cartId = paymentTransaction.cart?._id;
    if (!cartId) {
      return res.status(400).send("Không tìm thấy giỏ hàng liên kết.");
    }

    // Lấy useLoyaltyPoints từ PaymentTransaction
    const useLoyaltyPoints = paymentTransaction.useLoyaltyPoints;
    console.log("useLoyaltyPoints:", useLoyaltyPoints);

    // Cập nhật trạng thái giao dịch
    paymentTransaction.transactionStatus = "Success";
    await paymentTransaction.save();

    // Gọi hàm createOrderFromCart
    await createOrderFromCart(
      { params: { cartId }, body: { useLoyaltyPoints } }, // Truyền giá trị thực tế
      {
        status: () => ({
          json: (data) => console.log(`Đơn hàng được tạo thành công:`, data),
        }),
      }
    );

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Success</title>
      </head>
      <body style="text-align: center; margin-top: 20%;">
        <h1>Thanh toán thành công! Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi.</h1>
        <button onclick="window.location.href='exp://192.168.1.60:8081/--/payment-success'" style="padding: 10px 20px; font-size: 16px; margin-top: 20px; cursor: pointer; background-color: #E53935; color: #fff; border: none; border-radius: 5px;">Quay về ứng dụng</button>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Lỗi khi xử lý thanh toán thành công:", error);
    res.status(500).send("Đã xảy ra lỗi khi xử lý thanh toán.");
  }
});

// router.get("/payment-success", async (req, res) => {
//   try {
//     const { orderCode, status } = req.query;

//     // Debug: Kiểm tra thông tin từ query
//     console.log("orderCode:", orderCode, "status:", status);

//     // Kiểm tra nếu status không hợp lệ
//     // if (!["PAID", "SUCCESS"].includes(status)) {
//     //   return res.send("Giao dịch không thành công.");
//     // }

//     if (!["PAID", "SUCCESS"].includes(status)) {
//       return res.redirect("nomapp://payment-failed");
//     }

//     // Tìm giao dịch dựa trên orderCode
//     const paymentTransaction = await PaymentTransaction.findOne({ orderCode });

//     if (!paymentTransaction) {
//       return res.status(404).send("Không tìm thấy giao dịch.");
//     }

//     console.log("PaymentTransaction found:", paymentTransaction);

//     const cartId = paymentTransaction.cart?._id;
//     if (!cartId) {
//       return res.status(400).send("Không tìm thấy giỏ hàng liên kết.");
//     }

//     // Lấy useLoyaltyPoints từ PaymentTransaction
//     const useLoyaltyPoints = paymentTransaction.useLoyaltyPoints;
//     console.log("useLoyaltyPoints:", useLoyaltyPoints);

//     // Cập nhật trạng thái giao dịch
//     paymentTransaction.transactionStatus = "Success";
//     await paymentTransaction.save();

//     // Gọi hàm createOrderFromCart
//     await createOrderFromCart(
//       { params: { cartId }, body: { useLoyaltyPoints } }, // Truyền giá trị thực tế
//       {
//         status: () => ({
//           json: (data) => console.log(`Đơn hàng được tạo thành công:`, data),
//         }),
//       }
//     );

//     res.send(`
//       <!DOCTYPE html>
//       <html lang="en">
//       <head>
//         <meta charset="UTF-8">
//         <meta name="viewport" content="width=device-width, initial-scale=1.0">
//         <title>Payment Success</title>
//       </head>
//       <body style="text-align: center; margin-top: 20%;">
//         <h1>Thanh toán thành công! Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi.</h1>
//         <button onclick="window.location.href='nomapp://payment-success'" style="padding: 10px 20px; font-size: 16px; margin-top: 20px; cursor: pointer; background-color: #E53935; color: #fff; border: none; border-radius: 5px;">Quay về ứng dụng</button>
//       </body>
//       </html>
//     `);
//   } catch (error) {
//     console.error("Lỗi khi xử lý thanh toán thành công:", error);
//     res.status(500).send("Đã xảy ra lỗi khi xử lý thanh toán.");
//   }
// });

router.post("/webhook/payos", async (req, res) => {
  try {
    const { orderCode, status } = req.body;
    const paymentTransaction = await PaymentTransaction.findOne({ orderCode });

    if (!paymentTransaction) {
      return res.status(404).json({ error: "Không tìm thấy giao dịch." });
    }
    if (status === "PAID" || status === "SUCCESS") {
      paymentTransaction.transactionStatus = "Success";
    } else {
      paymentTransaction.transactionStatus = "Failed";
    }
    await paymentTransaction.save();

    res.status(200).json({ message: "Webhook xử lý thành công." });
  } catch (error) {
    console.error("Lỗi xử lý webhook PayOS:", error);
    res.status(500).json({ error: "Lỗi xử lý webhook." });
  }
});

router.get("/payment-cancel", async (req, res) => {
  try {
    const { orderCode } = req.query;
    const paymentTransaction = await PaymentTransaction.findOne({ orderCode });

    if (!paymentTransaction) {
      return res.status(404).send("Không tìm thấy giao dịch.");
    }
    paymentTransaction.transactionStatus = "Failed";
    await paymentTransaction.save();

    // Xóa phương thức thanh toán
    const deleteResult = await deletePaymentTransaction(orderCode);
    if (!deleteResult.success) {
      console.error(deleteResult.message);
      return res.status(500).send("Đã xảy ra lỗi khi xóa phương thức thanh toán.");
    }

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Failed</title>
      </head>
      <body style="text-align: center; margin-top: 20%;">
        <h1>Bạn đã hủy phương thức thanh toán</h1>
        <button onclick="window.location.href='exp://192.168.1.60:8081/--/payment-cancel'" style="padding: 10px 20px; font-size: 16px; margin-top: 20px; cursor: pointer; background-color: #E53935; color: #fff; border: none; border-radius: 5px;">Quay về ứng dụng</button>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Lỗi khi xử lý hủy thanh toán:", error);
    res.status(500).send("Đã xảy ra lỗi khi xử lý hủy thanh toán.");
  }
});

module.exports = router;
