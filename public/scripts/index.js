let isAlreadyCalling = false;
let getCalled = false;
const existingCalls = [];

const { role, RTCPeerConnection, RTCSessionDescription } = window;

if (!role) {
    alert("no role");
} else {
    console.log(`i am a ${role}`);
}

const peerConnection = new RTCPeerConnection();
const socket = io.connect("localhost:5000");

socket.on("connect", (_) => {
    socket.emit('role', {
        role,
        socketId: socket.id,
    });    
});

function unselectUsersFromList() {
    const alreadySelectedUser = document.querySelectorAll(
        ".active-user.active-user--selected"
    );

    alreadySelectedUser.forEach(el => {
        el.setAttribute("class", "active-user");
    });
}

function createUserItemContainer(user) {
    const userContainerEl = document.createElement("div");
    const usernameEl = document.createElement("p");

    userContainerEl.setAttribute("class", "active-user");
    userContainerEl.setAttribute("id", user.socketId);
    usernameEl.setAttribute("class", "username");
    usernameEl.innerHTML = `${user.role} (${user.socketId})`;

    userContainerEl.appendChild(usernameEl);

    userContainerEl.addEventListener("click", () => {
        unselectUsersFromList();
        userContainerEl.setAttribute("class", "active-user active-user--selected");
        
        const talkingWithInfo = document.getElementById("talking-with-info");
        talkingWithInfo.innerHTML = `Talking with: "Socket: ${user.role}"`;

        callUser(user.socketId);
    });

    return userContainerEl;
}

async function callUser(socketId) {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(new RTCSessionDescription(offer));

    socket.emit("call-user", {
        offer,
        to: socketId
    });
}

function updateUserList(users) {
    const activeUserContainer = document.getElementById("active-user-container");

    users.filter((u) => u.role !== role).forEach((user) => { // only list roles who arent me
        const userContainerEl = createUserItemContainer(user);
        const alreadyExistingUser = document.getElementById(user.socketId);
        if (alreadyExistingUser) {
            alreadyExistingUser.remove();
        }
         
        activeUserContainer.appendChild(userContainerEl);
    });
}

socket.on("update-user-list", ({ users }) => {
    updateUserList(users);
});

socket.on("remove-user", ({ socketId }) => {
    const elToRemove = document.getElementById(socketId);

    if (elToRemove) {
        elToRemove.remove();
    }
});

socket.on("call-made", async data => {
    if (getCalled) {
        const confirmed = confirm(
            `User "Socket: ${data.socket}" wants to call you. Do accept this call?`
        );

        if (!confirmed) {
            socket.emit("reject-call", {
                from: data.socket
            });
            return;
        }
    }

    await peerConnection.setRemoteDescription(
        new RTCSessionDescription(data.offer)
    );

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(new RTCSessionDescription(answer));

    socket.emit("make-answer", {
        answer,
        to: data.socket
    });
    
    getCalled = true;
});

socket.on("answer-made", async data => {
    await peerConnection.setRemoteDescription(
        new RTCSessionDescription(data.answer)
    );

    if (!isAlreadyCalling) {
        callUser(data.socket);
        isAlreadyCalling = true;
    }
});

socket.on("call-rejected", data => {
    alert(`User: "Socket: ${data.socket}" rejected your call.`);
    unselectUsersFromList();
});

peerConnection.ontrack = function({ streams: [stream] }) {
    const remoteVideo = document.getElementById("remote-video");
    if (remoteVideo) {
        remoteVideo.srcObject = stream;
    }
};

navigator.getUserMedia(
    {
        video: { facingMode: "user" },
        audio: true,
        
    },
    stream => {
        const localVideo = document.getElementById("local-video");
        if (localVideo) {
            localVideo.srcObject = stream;
        }

        stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));
    },
    error => {
        alert(`Error: ${error.message}`);
        console.warn(error.message);
    }
);
