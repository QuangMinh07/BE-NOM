require("dotenv").config();
const cors = require("cors");
const express = require("express");
const dbConnect = require("./config/dbConnect");
const cookieParser = require("cookie-parser");
const path = require("path");
const { globalErrorHandler } = require("./utils/errorHandler"); // Import globalErrorHandler từ errorHandler.js
// const passport = require('passport');
// require('./passport'); // Đảm bảo rằng file cấu hình passport đã được import

const userRoute = require("./routes/userroutes");
const userPersonalRoute = require("./routes/userPersonalroutes");
const adminRoute = require("./routes/adminroutes");
const foodRoute = require("./routes/foodroute");
const uploadRoute = require("./routes/uploadroutes");

const app = express();
// app.use(passport.initialize());

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

// Xử lý tất cả các request không khớp với các route khác và trả về file index.html cho client-side routing
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "client", "dist", "index.html"));
});

// Sử dụng middleware xử lý lỗi toàn cục
app.use(globalErrorHandler);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
