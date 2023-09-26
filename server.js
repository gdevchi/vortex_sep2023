require("dotenv").config({});

const http = require("http");
const express = require("express");
const cookieParser = require("cookie-parser");
const socket = require("socket.io");
const mongoose = require("mongoose");
const app = express();
const server = http.createServer(app);
const io = socket(server);

const userController = require("./controllers/user.controller");

const pageRoutes = require("./routes/page.routes");
const authRoutes = require("./routes/apis/auth.routes");

const state = {
  port: process.env.PORT || 3000,
  mongoURI: process.env.MONGOURI || "mongodb://127.0.0.1:27017/conferencedb",
  conferenceId: "abcd-efg",
};

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set("view engine", 'ejs');
app.use("/public", express.static("public"));

//mount apis
app.use("/", pageRoutes);
app.use("/api/v1/auth", authRoutes);

//Socket: listen for new connection
const activeUserCache = {};
io.on("connection", (socket) => {
  socket.on("user-joined", async (username) => {
    const payload = {
      user: {
        username,
        userId: socket.id,
      },
    };
    //1. Enable user speech, if no users is active
    if (
      !(await userController.getActiveUser()) &&
      !activeUserCache[state.conferenceId]
    ) {
      payload.user.active = true;
      payload.isActiveUser = true;
      activeUserCache[state.conferenceId] = socket.id;
    }
    //1. Insert user in queue
    await userController.insertUser(payload.user);
    //2. Delete active user cache
    delete activeUserCache[state.conferenceId];
    //3. Get Total user in room
    const sockets = await io.in(state.conferenceId).fetchSockets();
    payload.user.index = sockets.length;
    //4. Add user in conference room
    socket.join(state.conferenceId);
    //5. Emit user payload to all users in room
    socket.emit("you", payload);
    socket.to(state.conferenceId).emit("user-joined", payload);
  });

  //1. RECEIVE CALL FROM ROOM MEMBERS
  socket.on("call", async ({ userId, offer }) => {
    const caller = await userController.getUser(socket.id);
    socket.to(userId).emit("call", {
      caller, //caller details
      isActive: caller.active, //caller speech status
      offer, //caller offer
    });
  });

  //2. RECEIVER NEW USER CALL RESPONSE
  socket.on("answer", ({ caller, answer }) => {
    socket.to(caller).emit("answer", {
      responder: socket.id,
      answer,
    });
  });

  //3. EXCHANGE NETWORK DETAILS
  socket.on("ICE-Candidate", ({ receiver, candidate }) => {
    socket.to(receiver).emit("ICE-Candidate", {
      sender: socket.id,
      candidate, //network details of sender
    });
  });

  socket.on("speech-completed", async () => {
    const prevUserIndex = await userController.disableSpeech(socket.id);
    const sockets = await io.in(state.conferenceId).fetchSockets();
    const users = sockets.map((socket) => {
      return { userId: socket.id };
    });
    const newActiveUser = await userController.assignSpeech(
      users,
      prevUserIndex + 1
    );
    io.to(state.conferenceId).emit("new-speech-assigned", newActiveUser);
  });

  socket.on("movement", async (position) => {
    try {
      userController.updatePosition(socket.id, position);
    } catch (err) {
      console.log(`Failed to update ${socket.id} position`);
    }
    socket
      .to(state.conferenceId)
      .emit("movement", { userId: socket.id, position });
  });

  socket.on("message", (message) => {
    socket.to(state.conferenceId).emit("message", message);
  });

  socket.on("disconnect", async () => {
    try {
      //Get Current Active User
      let activeUser = null;
      const user = await userController.removeUser(socket.id);
      //Assign speech to next user, if disconnected user was speaking
      const sockets = await io.in(state.conferenceId).fetchSockets();
      const users = sockets.map((socket) => {
        return { userId: socket.id };
      });

      if (user.active)
        activeUser = await userController.assignSpeech(users, user.index);
      //Inform other user about disconnection and speech assign
      socket.to(state.conferenceId).emit("user-disconnect", {
        userId: user.userId,
        activeUser,
      });
    } catch (err) {
      console.log("Disconnect Error");
      console.log(err.message);
    }
  });
});

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(state.mongoURI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    //Clear the collection after connecting
    //Note:- Remove this code in future
    const db = mongoose.connection.db;
    const data = await db.collection("users").deleteMany({});
    console.log(data);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
};

connectDB().then(() => {
  server.listen(state.port, () => {
    console.log("Server is up and running!");
  });
});
