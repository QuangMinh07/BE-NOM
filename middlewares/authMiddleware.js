const jwt = require("jsonwebtoken");
const { errorHandler } = require("../utils/errorHandler");

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "Không tìm thấy token xác thực" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return next(errorHandler(403, "Token không hợp lệ hoặc đã hết hạn"));
    }
    req.user = user;
    next();
  });
};

module.exports = { authenticateToken };
