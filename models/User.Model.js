const mongoose = require("mongoose");

const userSchema = mongoose.Schema({
  username: {
    type: String,
    required: [true, "Please provide username"],
  },
  userId: {
    type: String,
    required: [true, "Please provide socket Id"],
  },
  position: {
    x: Number,
    y: Number,
  },
  active: {
    type: Boolean,
    default: false,
  },
});

module.exports = mongoose.model("user", userSchema);
