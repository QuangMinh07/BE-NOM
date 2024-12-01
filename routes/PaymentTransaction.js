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
      return res.redirect("exp://192.168.1.66:8081/--/payment-failed");
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

    const { cartSnapshot } = paymentTransaction;
    if (!cartSnapshot) {
      return res.status(404).send("Không tìm thấy thông tin giỏ hàng.");
    }

    // Tạo nội dung HTML hiển thị thông tin đơn hàng
    const orderDetailsHTML = `
    <div style="max-width: 800px; margin: auto; font-family: Arial, sans-serif; line-height: 1.6; border: 1px solid #ddd; border-radius: 8px; padding: 20px;">
      <h1 style="text-align: center; color: #E53935;">Thanh toán thành công!</h1>
      <h2 style="margin-bottom: 20px;">Thông tin đơn hàng:</h2>
      <p><strong>Tên người đặt:</strong> ${cartSnapshot.receiverName}</p>
      <p><strong>Số điện thoại:</strong> ${cartSnapshot.receiverPhone}</p>
      <p><strong>Địa chỉ giao hàng:</strong> ${cartSnapshot.deliveryAddress}</p>
      
      <h3 style="margin-top: 30px;">Chi tiết món ăn:</h3>
      <ul style="padding: 0; margin: 0;">
        ${cartSnapshot.items
          .map(
            (item) => `
          <li style="list-style-type: none; margin-bottom: 15px; border-bottom: 1px dashed #ddd; padding-bottom: 10px;">
            <p><strong>Tên món:</strong> ${item.foodName}</p>
            <p><strong>Cửa hàng:</strong> ${item.storeName}</p>
            <p><strong>Số lượng:</strong> ${item.quantity}</p>
            <p><strong>Giá:</strong> <span style="float: right;">${item.price.toLocaleString("vi-VN")} VND</span></p>
            ${
              item.combos
                ? `
                <div style="margin-top: 10px; padding-left: 15px;">
                  <p><strong>Combo:</strong></p>
                  <p>- Tổng giá: <span style="float: right;">${item.combos.totalPrice.toLocaleString("vi-VN")} VND</span></p>
                  <p>- Tổng số lượng: ${item.combos.totalQuantity}</p>
                  <ul>
                    ${item.combos.foods.map((combo) => `<li>- ${combo.foodName}: <span style="float: right;">${combo.price.toLocaleString("vi-VN")} VND</span></li>`).join("")}
                  </ul>
                </div>
              `
                : ""
            }
          </li>
        `
          )
          .join("")}
      </ul>

      <p style="font-weight: bold; margin-top: 20px; text-align: right;">Tổng thanh toán: <span style="font-size: 1.2em;">${cartSnapshot.totalPrice.toLocaleString("vi-VN")} VND</span></p>

      <div style="text-align: center; margin-top: 40px;">
        <button onclick="window.location.href='exp://192.168.1.66:8081/--/payment-success'" 
          style="padding: 10px 20px; font-size: 16px; cursor: pointer; background-color: #E53935; color: #fff; border: none; border-radius: 5px;">
          Quay về ứng dụng
        </button>
      </div>
    </div>
  `;

    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Payment Success</title>
    </head>
    <body style="background-color: #f9f9f9; margin: 0; padding: 20px;">
      ${orderDetailsHTML}
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
