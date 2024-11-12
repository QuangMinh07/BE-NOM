// utils/errorHandler.js

class ErrorResponse extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

// Hàm xử lý lỗi tùy chỉnh
const errorHandler = (statusCode, message) => {
  return new ErrorResponse(statusCode, message);
};

// Middleware xử lý lỗi toàn cục
const globalErrorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Lỗi máy chủ";

  // Kiểm tra lỗi MongoDB liên quan đến unique
  if (err.name === "MongoError" && err.code === 11000) {
    statusCode = 400;
    message = "Dữ liệu đã tồn tại.";
  }

  // Trả về phản hồi lỗi
  res.status(statusCode).json({
    success: false,
    error: message,
  });
};

module.exports = { errorHandler, globalErrorHandler };
