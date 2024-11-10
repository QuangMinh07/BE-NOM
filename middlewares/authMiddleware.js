const jwt = require("jsonwebtoken");
const { errorHandler } = require("../utils/errorHandler");

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ success: false, message: "Không tìm thấy token xác thực" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return next(errorHandler(403, "Token không hợp lệ hoặc đã hết hạn"));
    }
    req.user = user;
    next();
  });
};

const authorizeStoreAccess = (req, res, next) => {
  const user = req.user;

  console.log("User role:", user.role);

  // Nếu người dùng là 'customer', cho phép truy cập mà không cần kiểm tra thêm
  if (user.role === "customer") {
    return next();
  }

  // Cho phép quyền truy cập nếu người dùng là 'seller' hoặc 'staff'
  if (user.role === "seller" || user.role === "staff") {
    return next();
  }

  // Nếu vai trò không khớp, từ chối truy cập
  return res.status(403).json({ success: false, message: "Không có quyền truy cập" });
};

// Middleware để chặn "staff" truy cập các endpoint hạn chế
const restrictToSeller = (req, res, next) => {
  const user = req.user;
  console.log("User role:", user.role);

  if (user.role === "staff") {
    return res.status(403).json({ success: false, message: "Staff không có quyền truy cập endpoint này" });
  }

  next();
};

module.exports = { authenticateToken, authorizeStoreAccess, restrictToSeller };
