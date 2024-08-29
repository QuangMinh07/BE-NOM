const express = require("express");
const { registerUser } = require("../controllers/usercontrollers");
const { loginUser } = require("../controllers/usercontrollers");
const { verifyEmail } = require("../controllers/usercontrollers");
// const passport = require('passport');

const router = express.Router();

// Route cho đăng ký người dùng
router.post("/register", registerUser);
router.post("/login", loginUser);
router.post('/verify-email', verifyEmail); // Route để xác thực email

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
