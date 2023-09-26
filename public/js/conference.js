const conferenceEl = document.querySelector(".conference");
const audioContainer = document.querySelector(".audio-container");
const timer = document.querySelector("#timer");
const form = document.querySelector("form");
const textContainer = document.querySelector(".text-chat-container");
const messageContainer = textContainer.children[1];
const actionEl = document.querySelector(".action");
const statusMessage = document.querySelector(".status-message");

//redirect user to homepage, if username not provided
/*const username = new URLSearchParams(window.location.search).get("username");
if (!username) window.location.href = "/";*/

const socket = io.connect("/"); //make connection with socket server

const state = {
  users: [],
  user: null,
  activeUser: null,
  interval: null,
  timer: null,
  audioTrack: null,
  audioStream: null,
  peers: {}, //store connected users
  rtcConfig: {
    //simple third party server to retrieve network details
    iceServers: [
      {
        urls: "turn:143.110.152.166:5500",
        username: "abdullah",
        credential: "qwerty123",
      },
    ],
  },
  origin: {
    x: 0,
    y: 0,
  },
  isDragging: false,
  disconnected: false,
};

function showMessage({ status, message }) {
  statusMessage.className = `status-message ${status}`;
  statusMessage.children[0].textContent = message;
}

function insertUser(user) {
  state.users[user.index] = user;
}

function updatePosition({ userId, position }) {
  const { x, y } = getPixelPosition(position);
  const circle = conferenceEl.querySelector(`#ID_${userId}`);
  if (!circle) return;
  circle.style.transform = `translate(${x}px,${y}px)`;
  //update user position in state
  try {
    const userIndex = state.users.findIndex((user) => user.userId === userId);
    if (userIndex < 0) return;
    state.users[userIndex]["position"] = position;
  } catch (err) {
    console.log(`Error in update position state of ${userId}`);
    console.log(err.message);
  }
}

function renderCircle() {
  [...conferenceEl.children].forEach((circle, index) => {
    const user = state.users[index];
    if (!user) {
      circle.id = "";
      circle.style.transform = `translate(0px,0px)`;
      circle.style.display = "none";
      circle.innerHTML = "";
      circle.classList.remove(`circle-${index + 1}`);
      return;
    }

    circle.id = `ID_${user.userId}`;
    circle.style.display = "flex";
    circle.innerHTML = `<label>${user.username} ${index + 1}</label>`;

    //attach movement handler
    const isMoved =
      user?.position?.x !== undefined && user?.position?.y !== undefined;
    const moved = !(
      user?.position?.x === undefined && user?.position?.y === undefined
    );
    const isCurrentUser = user.userId === state.user.userId;
    if (isCurrentUser) {
      //change circle position if it is not moved
      if (moved) {
        console.log("Assigned Initial Class!");
        circle.className = state.userCircle?.el?.className;
        initializeOrigin(circle);
        state.userCircle = {
          el: circle,
          index: index,
        };
        initializeMovementEvents();
      } else {
        console.log("Assigned New Class!");
        circle.classList.add(`circle-${index + 1}`);
        circle.style.transform = `translate(0px,0px)`;
        initializeOrigin(circle, { forceUpdate: true });
        state.userCircle = {
          el: circle,
          index: index,
        };
        initializeMovementEvents();
      }
    } else {
      console.log("Assigned New Class To Other User");
      circle.classList.add(`circle-${index + 1}`);
    }

    //update user position
    if (isMoved) {
      const { x, y } = getPixelPosition(user.position);
      circle.style.transform = `translate(${x}px,${y}px)`;
    }
    //reset the circle position moved by previous user if current user not moved
    if (!isCurrentUser && !isMoved) {
      console.log("not moved!");
      circle.style.transform = `translate(0px,0px)`;
    }

    //toggle active user
    if (user.userId === state.activeUser?.userId) {
      toggleActiveUser(user.userId, true);
    } else {
      toggleActiveUser(user.userId);
    }
  });
}

function startTimer() {
  var seconds = 30;
  timer.textContent = seconds;
  return setInterval(() => (timer.textContent = --seconds), 1000);
}

function toggleActiveUser(userId, toggle) {
  const user = conferenceEl.querySelector(`#ID_${userId}`);
  if (!user) return;
  user.classList[toggle ? "add" : "remove"]("active-circle");
}

function chanegMicStatus(message, active) {
  const micEl = document.querySelector(".mic");
  const micClass = active ? "fa-microphone" : "fa-microphone-slash";
  //show message related to micrphone access
  micEl.children[0].textContent = message;
  //change microphone access
  micEl.children[1].innerHTML = `<i class="fas ${micClass}"></i>`;
}

function toggleMic(active) {
  try {
    if (active === undefined) active = !state.audioTrack.enabled;
    state.audioTrack.enabled = active;
    //if current user speech is active
    const micClass = active ? "fa-microphone" : "fa-microphone-slash";
    actionEl.children[0].children[1].innerHTML = `<i class="fas ${micClass}"></i>`;
  } catch (err) {
    console.log("Error while disabling mic!");
    console.log(err);
  }
}

function setRemoteAudioTrack(event, userId) {
  const [remoteStream] = event.streams;
  const div = document.createElement("div");
  div.id = `DA_${userId}`;
  const audio = document.createElement("audio");
  audio.id = `A_${userId}`;
  audio.srcObject = remoteStream;
  audio.play();
  div.appendChild(audio);
  audioContainer.appendChild(div);
}

function removeRemoteAudioTrack(userId) {
  const child = document.querySelector(`#DA_${userId}`);
  if (!child) return;
  audioContainer.removeChild(child);
}

function removeTrackFromConnection(userId) {
  const connection = state.peers[userId].peerConnection;
  if (!connection) return;
  const sender = connection.getSenders().find(function (s) {
    return s.track === state.audioTrack;
  });
  if (sender) {
    try {
      connection.removeTrack(sender);
      connection.removeStream(state.audioStream);
    } catch (err) {
      console.log(err);
    }
  }
  connection.close();
  delete state.peers[userId];
}

function toggleChat() {
  textContainer.classList.toggle("text-chat-container-active");
}

function insertMessage(message) {
  const wrapper = document.createElement("div");
  wrapper.classList.add("msg-wrapper");
  if (state?.user?.username === message.username)
    wrapper.classList.add("owner"); //add owner class to align message right side

  const sender = document.createElement("span");
  sender.classList.add("sender");
  sender.innerText = message.username;
  wrapper.appendChild(sender);

  const msg = document.createElement("span");
  msg.classList.add("message");
  msg.innerText = message.text;
  wrapper.appendChild(msg);

  messageContainer.appendChild(wrapper);
  //scroll top to see latest message
  messageContainer.scrollTop = messageContainer.scrollHeight;
}

//Get Microphone Access
function getAudioStreamAccess() {
  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      chanegMicStatus("Mic Access Granted!", true);
      //Get Audio Tracks and Stream
      state.audioTrack = stream.getAudioTracks()[0];
      state.audioStream = new MediaStream([state.audioTrack]);
      //By default disable mic of user
      toggleMic(false);
      //Attach the listener to the audio track
      state.audioTrack.addEventListener("mute", () => toggleMic(false));
      state.audioTrack.addEventListener("unmute", () => toggleMic(true));
      state.audioTrack.addEventListener("ended", () => toggleMic(false));
      socket.emit("user-joined", username);
    })
    .catch((err) => chanegMicStatus(err.message));
}

function disableSpeech(user, timerId) {
  try {
    //disable mic after speech timeout
    toggleMic(false);
    //update circle color
    toggleActiveUser(user?.userId);
    //stop timer
    clearInterval(timerId);
    timer.textContent = 0;
    //stop main timer
    clearInterval(state.interval);
    //hide action button
    actionEl.children[0].classList.remove("action-active");
    //emit complete event to assign next user
    socket.emit("speech-completed");
  } catch (err) {
    console.log("Error Occured while disabling speech!");
    console.log(err);
    console.log("Clearing Intervals");
    //stop timer
    clearInterval(timerId);
    timer.textContent = 0;
    //stop main timer
    clearInterval(state.interval);
    //emit complete event to assign next user
    socket.emit("speech-completed");
    //hide action button
    actionEl.children[0].classList.remove("action-active");
  }
}

function assignSpeech(user) {
  try {
    //while assigning speech to new user, reset current active user circle and audio
    if (state.activeUser) toggleActiveUser(state.activeUser?.userId);
    //update active user state with new user
    state.activeUser = user;

    if (!user) return;
    //if current user get a chance to speak
    if (user.userId === state?.user?.userId) {
      //Enable Mic on getting change to speak
      toggleMic(true);
      //Reset previous timers
      if (state.timer) clearInterval(state.timer);
      if (state.interval) clearInterval(state.interval);
      //Start New Countdown timer
      state.timer = startTimer();
      //Close speech after 30 seconds
      state.interval = setInterval(() => {
        disableSpeech(state.activeUser, state.timer);
      }, 30000);
      actionEl.children[0].classList.add("action-active");
    }
    toggleActiveUser(user?.userId, true);
  } catch (err) {
    console.log("Error occured while enabling speech");
    console.log(err);
  }
}

function passToNextUser() {
  timer.textContent = 0;
  disableSpeech(state.activeUser, state.timer);
}

socket.on("you", ({ user, isActiveUser }) => {
  state.user = user; //store you details
  //old:state.users[user.index] = user; //store you in queue
  //new
  insertUser(user);
  //assign listeners
  renderCircle();
  if (isActiveUser) assignSpeech(user);
});

//start a webrtc call with new user
socket.on("user-joined", async ({ user, isActiveUser }) => {
  if (!user) return;
  //create new connection
  const peerConnection = new RTCPeerConnection(state.rtcConfig);
  //store peer connection
  state.peers[user.userId] = { peerConnection };
  //add local track in remote user connection
  peerConnection.addTrack(state.audioTrack, state.audioStream);
  //create offer for new user
  //offer: contains system config like: type of media format being send, ip address and port of caller
  const offer = await peerConnection.createOffer();
  //set offer description in local connection
  peerConnection.setLocalDescription(offer);
  //receive network details from third party server and send details to new user
  peerConnection.addEventListener("icecandidate", function (event) {
    //send network details to new user
    socket.emit("ICE-Candidate", {
      receiver: user.userId,
      candidate: event.candidate,
    });
  });
  //when new user get chance to speak, this listener will trigger and set the remote stream on dom
  peerConnection.addEventListener("track", (event) => {
    if (event.track.kind === "audio") {
      setRemoteAudioTrack(event, user.userId);
      //old:state.users[user.index] = user;
      insertUser(user);
      renderCircle();
      if (isActiveUser) assignSpeech(user);
    }
  });
  //send offer (system config) to new user
  socket.emit("call", { userId: user.userId, offer });
});

//receive answer from new user
socket.on("answer", async ({ responder, answer }) => {
  //get responder connection
  const peerConnection = state.peers[responder].peerConnection;
  //set responder answer (system config) in connection
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

//recieve network details (ICE-Candidate) of user
socket.on("ICE-Candidate", async ({ sender, candidate }) => {
  if (!state.peers[sender]) return;
  //find sender peer connection in list of peers
  const peerConnection = state.peers[sender].peerConnection;
  //store network details in connection
  await peerConnection.addIceCandidate(candidate);
});

//receive call (offer) from users and respond to call by sharing their system details
socket.on("call", async ({ caller, isActive, offer }) => {
  //create new webrtc peer connection
  const peerConnection = new RTCPeerConnection(state.rtcConfig);
  //store caller peer connection
  state.peers[caller.userId] = { peerConnection };
  //add local stream to caller connection
  peerConnection.addTrack(state.audioTrack, state.audioStream);
  //receive network details from third party server and send it to caller
  peerConnection.addEventListener("icecandidate", function (event) {
    //send network details to caller
    socket.emit("ICE-Candidate", {
      receiver: caller.userId,
      candidate: event.candidate,
    });
  });

  peerConnection.addEventListener("track", (event) => {
    if (event.track.kind === "audio") {
      setRemoteAudioTrack(event, caller.userId);
      //old:state.users[caller.index] = caller;
      insertUser(caller);
      renderCircle();
      if (isActive) assignSpeech(caller);
    }
  });

  //set received offer (caller system config) in connection
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  //create your system config as answer
  const answer = await peerConnection.createAnswer();
  //set answer in connection
  await peerConnection.setLocalDescription(answer);
  //send call response (system config) to caller
  socket.emit("answer", { caller: caller.userId, answer });
});

socket.on("new-speech-assigned", assignSpeech);

socket.on("message", insertMessage);

socket.on("movement", updatePosition);

socket.on("connect", () => {
  if (state.disconnected) {
    state.disconnected = false;
    showMessage({ status: "info", message: "Rejoining..." });
    setInterval(() => {
      window.location.reload();
    }, 800);
  }
});

socket.on("disconnect", () => {
  state.disconnected = true;
  showMessage({
    status: "error",
    message:
      "Disconnected from server, check your internet or refresh the page!",
  });
});

socket.on("user-disconnect", ({ userId, activeUser }) => {
  //close and delete user connection from list connected users peer
  if (!state.peers[userId]) return;
  //remove audio track and element
  removeTrackFromConnection(userId);
  removeRemoteAudioTrack(userId);
  //remove user from users array and re render circle
  state.users = state.users.filter((user) => user.userId !== userId);
  //reset current user movement event for reassigning in new circle
  resetMovementEvents();
  renderCircle();
  //activate next active user circle and mic
  if (activeUser) assignSpeech(activeUser);
});

//handle form submission
form.addEventListener("submit", (e) => {
  e.preventDefault(); //prevent page from reloading
  const message = e.target.elements.message.value;
  if (!message) return;
  //send message to other users in room
  const payload = {
    username: state.user.username,
    text: message,
  };
  socket.emit("message", payload);
  //display message in your chat box
  insertMessage(payload);
  //clear form input
  e.target.elements.message.value = "";
  e.target.elements.message.focus();
});

window.addEventListener("DOMContentLoaded", () => getAudioStreamAccess());
