const mongoose = require('mongoose');

// Định nghĩa modal Staff
const staffSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
    trim: true, // Loại bỏ khoảng trắng dư thừa
  },
  isActive: {
    type: Boolean,
    default: false, // Mặc định là true
  }
}, {
  timestamps: true // Thêm createdAt và updatedAt tự động
});

// Tạo model Staff từ schema
const Staff = mongoose.model('Staff', staffSchema);

module.exports = Staff;
