// Import các module cần thiết
require("dotenv").config();
const cors = require("cors");
const express = require("express");
const http = require("http"); // Thêm module http để tạo server HTTP
const socketIO = require("socket.io"); // Import Socket.io
const dbConnect = require("./config/dbConnect");
const cookieParser = require("cookie-parser");
const path = require("path");
const bodyParser = require("body-parser");
const { globalErrorHandler } = require("./utils/errorHandler");

// Khai báo các route
const userRoute = require("./routes/userroutes");
const userPersonalRoute = require("./routes/userPersonalroutes");
const adminRoute = require("./routes/adminroutes");
const foodRoute = require("./routes/foodroute");
const uploadRoute = require("./routes/uploadroutes");
const storeRoute = require("./routes/storeroutes");
const staffRoute = require("./routes/staffroutes");
const foodgroupRoute = require("./routes/foodgrouproutes");
const cartRoute = require("./routes/cartroutes");
const PaymentTransactionRoute = require("./routes/PaymentTransaction");
const storeOrderRoute = require("./routes/storeOrderRoutes");
const OrderCancellationRoute = require("./routes/OrderCancellationRoutes");
const shipperRoute = require("./routes/shipperroutes");

const app = express();
const server = http.createServer(app); // Tạo HTTP server
const io = socketIO(server, {
  cors: {
    origin: "*", // Cho phép mọi nguồn kết nối, có thể cấu hình cụ thể hơn nếu cần
  },
});

const port = process.env.PORT || 8888;

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Kết nối cơ sở dữ liệu
dbConnect();

// Đăng ký các route
app.use("/v1/user", userRoute);
app.use("/v1/userPersonal", userPersonalRoute);
app.use("/v1/admin", adminRoute);
app.use("/v1/food", foodRoute);
app.use("/v1/upload", uploadRoute);
app.use("/v1/store", storeRoute);
app.use("/v1/staff", staffRoute);
app.use("/v1/foodgroup", foodgroupRoute);
app.use("/v1/cart", cartRoute);
app.use("/v1/PaymentTransaction", PaymentTransactionRoute);
app.use("/v1/storeOrder", storeOrderRoute);
app.use("/v1/OrderCancellation", OrderCancellationRoute);
app.use("/v1/shipper", shipperRoute);

// Xử lý các route không khớp
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "client", "dist", "index.html"));
});

// Xử lý lỗi toàn cục
app.use(globalErrorHandler);

// Socket.io - Lắng nghe sự kiện khi người dùng kết nối
io.on("connection", (socket) => {
  console.log("Người dùng kết nối: " + socket.id);

  // Lắng nghe tin nhắn từ client
  socket.on("sendMessage", (message) => {
    console.log("Tin nhắn nhận được: ", message);

    // Phát tin nhắn đến tất cả các client khác
    io.emit("chatMessage", message);
  });

  // Khi người dùng ngắt kết nối
  socket.on("disconnect", () => {
    console.log("Người dùng ngắt kết nối: " + socket.id);
  });
});

// Khởi động server
server.listen(port, () => {
  console.log(`Server đang chạy trên cổng ${port}`);
});
