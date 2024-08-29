const mongoose = require("mongoose");

const dbConnect = async () => {
  try {
    const database = await mongoose.connect(process.env.MONGOOB_URI);
    if (database.connection.readyState === 1)
      console.log("Db connection is successfully");
    else console.log("Db connecting");
  } catch (error) {
    console.log("Db connection is failed");
    console.log("error", error);
  }
};
module.exports = dbConnect
