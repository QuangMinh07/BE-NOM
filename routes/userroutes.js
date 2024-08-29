const express = require("express");
const {
  verifyEmail,
  getProfile,
  loginUser,
  registerUser,
  updateUser
} = require("../controllers/usercontrollers");
// const passport = require('passport');
const authenticateToken = require("../middlewares/authMiddleware");

const router = express.Router();

// Route cho đăng ký người dùng
router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/verify-email", verifyEmail); // Route để xác thực email
// Route để lấy thông tin profile (yêu cầu xác thực token)
router.get("/profile", authenticateToken, getProfile);
router.put("/update", authenticateToken, updateUser); // Route cho cập nhật thông tin người dùng (yêu cầu xác thực token)
// router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
// router.get('/google/callback',
//   passport.authenticate('google', { session: false, failureRedirect: '/login' }),
//   userController.googleCallback
// );

// // Facebook Authentication Routes
// router.get('/facebook', passport.authenticate('facebook', { scope: ['email'] }));
// router.get('/facebook/callback',
//   passport.authenticate('facebook', { session: false, failureRedirect: '/login' }),
//   userController.facebookCallback
// );

module.exports = router;
