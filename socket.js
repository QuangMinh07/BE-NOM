const { Server } = require("socket.io");

const socket = (server, baseURL) => {
  const io = new Server(server, {
    cors: {
      cors: {
        origin: baseURL,
        methods: ["GET", "POST", "PUT", "DELETE"],
      },
    },
  });

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id); // In ra khi có kết nối từ client

    // Khi có ai đó tham gia phòng chat
    socket.on("joinRoom", ({ roomId }) => {
      socket.join(roomId);
      console.log(`User joined room: ${roomId}`);
    });

    // Chỉ cần phát tin nhắn đến tất cả các client trong phòng khi API gửi thành công
    socket.on("sendMessage", ({ roomId, senderId, receiverId, text }) => {
      console.log("Tin nhắn nhận được từ client:", { roomId, senderId, receiverId, text });

      // Phát tin nhắn đến tất cả người dùng trong phòng chat (gồm cả người gửi)
      io.to(roomId).emit("message", { senderId, receiverId, text, roomId });
    });
  });
};

module.exports = socket;
