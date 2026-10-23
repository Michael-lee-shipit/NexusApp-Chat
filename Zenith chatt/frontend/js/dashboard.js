import { API_URL } from "./api.js";
import { readJsonStorage, writeJsonStorage, activeRoomStorageKey, roomListCacheKey, roomPreviewCacheKey, roomMessagesCacheKey } from "./storage.js";
import { EMOJI_CATEGORIES } from "./emoji.js";

let ws = null;
let currentRoomId = null;
let showArchived = false;
let roomRequestId = 0;
let hasRestoredActiveRoom = false;
let activeEmojiCategory = "Smileys";
const VOICE_NOTE_MIME_TYPES = new Set([
  "audio/aac",
  "audio/mpeg",
  "audio/mp4",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/x-m4a",
]);
const VOICE_NOTE_MAX_BASE64_LENGTH = Math.ceil((8 * 1024 * 1024) / 3) * 4;


export function initDashboard() {
// 3. Main Dashboard (`index.html`)
const appContainer = document.getElementById("app-container");
if (appContainer) {
  const userId = localStorage.getItem("user_id");
  const username = localStorage.getItem("username");

  if (!userId) {
    window.location.href = "login.html";
    return;
  }

  document.getElementById("logout-btn").addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "login.html";
  });

  document
    .getElementById("settings-link-btn")
    .addEventListener("click", () => {
      window.location.href = "settings.html";
    });

  const sidebarMenuButton = document.getElementById("sidebar-menu-btn");
  const sidebarActions = document.getElementById("sidebar-actions");
  const closeSidebarMenu = () => {
    appContainer.classList.remove("drawer-open");
    sidebarMenuButton.setAttribute("aria-expanded", "false");
    sidebarMenuButton.setAttribute("aria-label", "Open menu");
    sidebarMenuButton.title = "Open menu";
  };

  const drawerDisplayName = document.getElementById("drawer-display-name");
  const drawerUsername = document.getElementById("drawer-username");
  const drawerAvatar = document.getElementById("drawer-avatar");
  const avatarSeed = localStorage.getItem("avatar_seed") || username;
  drawerDisplayName.textContent = username;
  drawerUsername.textContent = `@${username}`;
  drawerAvatar.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(avatarSeed)}`;
  drawerAvatar.alt = `${username}'s avatar`;

  const drawerStatusControl = document.getElementById(
    "drawer-status-control",
  );
  const drawerStatusToggle = document.getElementById("drawer-status-toggle");
  const drawerStatusMenu = document.getElementById("drawer-status-menu");

  const setStatusMenuOpen = (open) => {
    drawerStatusToggle.setAttribute("aria-expanded", String(open));
    drawerStatusMenu.setAttribute("aria-hidden", String(!open));
  };
  drawerStatusToggle.addEventListener("click", () => {
    const isOpen =
      drawerStatusToggle.getAttribute("aria-expanded") === "true";
    setStatusMenuOpen(!isOpen);
  });
  document.addEventListener("click", (event) => {
    if (!drawerStatusControl.contains(event.target)) {
      setStatusMenuOpen(false);
    }
  });
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      drawerStatusToggle.getAttribute("aria-expanded") === "true"
    ) {
      setStatusMenuOpen(false);
      drawerStatusToggle.focus();
    }
  });

  sidebarMenuButton.addEventListener("click", () => {
    const isOpen = sidebarMenuButton.getAttribute("aria-expanded") === "true";
    if (isOpen) {
      closeSidebarMenu();
    } else {
      sidebarMenuButton.setAttribute("aria-expanded", "true");
      sidebarMenuButton.setAttribute("aria-label", "Close menu");
      sidebarMenuButton.title = "Close menu";
      appContainer.classList.add("drawer-open");
    }
  });

  document.addEventListener("click", (event) => {
    const isOpen = sidebarMenuButton.getAttribute("aria-expanded") === "true";
    if (
      isOpen &&
      !sidebarActions.contains(event.target) &&
      !sidebarMenuButton.contains(event.target)
    ) {
      closeSidebarMenu();
    }
  });

  sidebarActions.addEventListener("click", (event) => {
    if (
      event.target.closest("button") &&
      !drawerStatusControl.contains(event.target)
    ) {
      closeSidebarMenu();
    }
  });

  document.getElementById("my-profile-btn").addEventListener("click", () => {
    window.location.href = "settings.html";
  });

  const darkModeToggle = document.getElementById("dark-mode-toggle");
  const topbarThemeToggle = document.getElementById("topbar-theme-toggle");
  const isDarkMode = localStorage.getItem("zenith_dark_mode") !== "false";
  const applyTheme = (enabled) => {
    appContainer.classList.toggle("light-mode", !enabled);
    darkModeToggle.checked = enabled;
    topbarThemeToggle.setAttribute("aria-pressed", String(enabled));
    const label = `Switch to ${enabled ? "light" : "dark"} mode`;
    topbarThemeToggle.setAttribute("aria-label", label);
    topbarThemeToggle.title = label;
    topbarThemeToggle.innerHTML = `<i class="fa-solid fa-${enabled ? "moon" : "sun"}" aria-hidden="true"></i>`;
    localStorage.setItem("zenith_dark_mode", String(enabled));
  };

  applyTheme(isDarkMode);
  darkModeToggle.addEventListener("change", () => {
    applyTheme(darkModeToggle.checked);
  });
  topbarThemeToggle.addEventListener("click", () => {
    applyTheme(appContainer.classList.contains("light-mode"));
  });

  const topbarMenuWrap = document.getElementById("topbar-menu-wrap");
  const topbarMoreButton = document.getElementById("topbar-more-btn");
  const topbarMoreMenu = document.getElementById("topbar-more-menu");
  const setTopbarMenuOpen = (open) => {
    topbarMoreButton.setAttribute("aria-expanded", String(open));
    topbarMoreMenu.setAttribute("aria-hidden", String(!open));
  };

  topbarMoreButton.addEventListener("click", () => {
    const isOpen = topbarMoreButton.getAttribute("aria-expanded") === "true";
    setTopbarMenuOpen(!isOpen);
  });
  topbarMoreMenu.addEventListener("click", (event) => {
    const action = event.target.closest("[data-topbar-action]")?.dataset
      .topbarAction;
    if (!action) return;

    setTopbarMenuOpen(false);
    if (action === "new-chat") {
      document.getElementById("new-room-btn").click();
    } else if (action === "settings") {
      document.getElementById("settings-link-btn").click();
    } else if (action === "logout") {
      document.getElementById("logout-btn").click();
    } else {
      const messages = {
        "linked-devices": "Linked devices are not available yet.",
        starred: "Starred chats are not available yet.",
        "read-all": "Marking all chats as read is not available yet.",
      };
      window.alert(messages[action]);
    }
  });
  document.addEventListener("click", (event) => {
    if (!topbarMenuWrap.contains(event.target)) setTopbarMenuOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      topbarMoreButton.getAttribute("aria-expanded") === "true"
    ) {
      setTopbarMenuOpen(false);
      topbarMoreButton.focus();
    }
  });

  document
    .getElementById("chat-search")
    .addEventListener("input", (event) => {
      filterRoomsList(event.target.value);
    });

  document
    .getElementById("back-to-chats-btn")
    .addEventListener("click", () => {
      roomRequestId += 1;
      const previousSocket = ws;
      ws = null;
      if (previousSocket) previousSocket.close();
      currentRoomId = null;
      localStorage.removeItem(activeRoomStorageKey());
      document.getElementById("app-container").classList.remove("chat-open");
      document.getElementById("chat-main").classList.add("empty-state");
      const feed = document.getElementById("chat-messages");
      if (feed) feed.innerHTML = "";
    });

  loadRooms();

  document
    .getElementById("new-room-btn")
    .addEventListener("click", async () => {
      const roomName = prompt("Enter new room name:");
      if (roomName) {
        try {
          const res = await fetch(`${API_URL}/api/rooms`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: roomName }),
          });
          if (res.ok) {
            loadRooms();
          } else {
            const errData = await res.json();
            alert(errData.detail || "Failed to create room");
          }
        } catch (err) {
          console.error(err);
        }
      }
    });

  const toggleArchiveViewBtn = document.getElementById("toggle-archive-view");
  toggleArchiveViewBtn.addEventListener("click", () => {
    showArchived = !showArchived;
    document.getElementById("archive-toggle-text").textContent = showArchived
      ? "View Active Rooms"
      : "View Archived Rooms";
    loadRooms();
  });

  const archiveRoomBtn = document.getElementById("archive-room-btn");
  archiveRoomBtn.addEventListener("click", async () => {
    if (!currentRoomId) return;
    const newArchiveState = !showArchived;
    try {
      const res = await fetch(
        `${API_URL}/api/rooms/${currentRoomId}/archive`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_archived: newArchiveState }),
        },
      );
      if (res.ok) {
        loadRooms();
      }
    } catch (err) {
      console.error(err);
    }
  });

  const messageForm = document.getElementById("message-form");
  const messageInput = document.getElementById("message-input");
  const composerField = document.getElementById("composer-field");
  const resizeMessageInput = () => {
    messageInput.style.height = "auto";
    const maxHeight = Number.parseFloat(
      getComputedStyle(messageInput).maxHeight,
    );
    const nextHeight = Math.min(messageInput.scrollHeight, maxHeight);
    messageInput.style.height = `${nextHeight}px`;
    messageInput.style.overflowY =
      messageInput.scrollHeight > maxHeight ? "auto" : "hidden";
  };
  messageInput.addEventListener("input", resizeMessageInput);
  resizeMessageInput();

  const emojiPickerButton = document.getElementById("emoji-picker-btn");
  const emojiPicker = document.getElementById("emoji-picker");
  const emojiSearch = document.getElementById("emoji-search");
  const emojiCategories = document.getElementById("emoji-picker-categories");
  const emojiGrid = document.getElementById("emoji-picker-grid");
  const emojiEmptyState = document.getElementById("emoji-picker-empty");
  const composerStatus = document.getElementById("composer-status");
  const voiceNoteButton = document.getElementById("voice-note-btn");
  const mobileActionButton = document.getElementById(
    "mobile-composer-action",
  );
  const mobileActionIcon = mobileActionButton.querySelector("i");
  const recordingIndicator = document.getElementById("recording-indicator");
  const recordingTimer = document.getElementById("recording-timer");
  const voiceNotePreview = document.getElementById("voice-note-preview");
  const voiceNoteAudio = document.getElementById("voice-note-audio");
  const discardVoiceNoteButton =
    document.getElementById("discard-voice-note");
  const cameraPickerButton = document.getElementById("camera-picker-btn");
  const cameraPickerInput = document.getElementById("camera-picker-input");
  let mediaRecorder = null;
  let voiceNoteUrl = null;
  let voiceNoteBlob = null;
  let voiceNoteDuration = 0;
  let recordingInterval = null;
  let isStoppingVoiceNote = false;
  let isSendingVoiceNote = false;
  let emojiInsertStart = messageInput.selectionStart;
  let emojiInsertEnd = messageInput.selectionEnd;

  const renderEmojiPicker = () => {
    emojiCategories.replaceChildren();
    Object.keys(EMOJI_CATEGORIES).forEach((category) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = category;
      button.setAttribute("aria-pressed", String(category === activeEmojiCategory));
      button.addEventListener("click", () => {
        activeEmojiCategory = category;
        renderEmojiPicker();
      });
      emojiCategories.appendChild(button);
    });

    const query = emojiSearch.value.trim().toLocaleLowerCase();
    const matchingEmojis = Object.entries(EMOJI_CATEGORIES)
      .filter(([category]) => query || category === activeEmojiCategory)
      .flatMap(([category, emojis]) =>
        emojis
          .filter(
            ([, name, keywords]) =>
              !query ||
              `${category} ${name} ${keywords}`
                .toLocaleLowerCase()
                .includes(query),
          )
          .map(([emoji, name]) => ({ emoji, name })),
      );
    emojiGrid.replaceChildren();
    matchingEmojis.forEach(({ emoji, name }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "emoji-option";
      button.dataset.emoji = emoji;
      button.setAttribute("role", "listitem");
      button.setAttribute("aria-label", name);
      button.title = name;
      button.textContent = emoji;
      emojiGrid.appendChild(button);
    });
    emojiEmptyState.hidden = matchingEmojis.length > 0;
  };
  renderEmojiPicker();

  const updateMobileAction = () => {
    const isRecording =
      mediaRecorder?.state === "recording" || isStoppingVoiceNote;
    const shouldSend = Boolean(messageInput.value.trim() || voiceNoteBlob);
    const icon = isRecording
      ? "fa-stop"
      : shouldSend
        ? "fa-paper-plane"
        : "fa-microphone";
    const label = isRecording
      ? "Stop voice note recording"
      : shouldSend
        ? "Send message"
        : "Record voice note";

    mobileActionIcon.className = `fa-solid ${icon}`;
    mobileActionButton.classList.toggle("is-send", icon === "fa-paper-plane");
    mobileActionButton.setAttribute("aria-label", label);
    mobileActionButton.title = label;
  };

  const formatRecordingTime = (seconds) => {
    const minutes = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const remainder = (seconds % 60).toString().padStart(2, "0");
    return `${minutes}:${remainder}`;
  };

  const stopVoiceRecording = () => {
    if (mediaRecorder?.state === "recording") {
      isStoppingVoiceNote = true;
      mobileActionButton.disabled = true;
      mediaRecorder.stop();
      clearInterval(recordingInterval);
      recordingInterval = null;
      updateMobileAction();
    }
  };

  const clearVoiceNote = () => {
    voiceNoteAudio.pause();
    voiceNoteAudio.removeAttribute("src");
    voiceNotePreview.hidden = true;
    composerField.classList.remove("has-voice-note");
    if (voiceNoteUrl) URL.revokeObjectURL(voiceNoteUrl);
    voiceNoteUrl = null;
    voiceNoteBlob = null;
    voiceNoteDuration = 0;
    updateMobileAction();
  };

  const sendVoiceNote = async () => {
    if (!voiceNoteBlob || isSendingVoiceNote) return;
    const socket = ws;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      composerStatus.textContent =
        "Chat is disconnected. Your voice note is kept here to retry.";
      return;
    }
    if (voiceNoteBlob.size > 8 * 1024 * 1024) {
      composerStatus.textContent =
        "Voice notes must be 8 MB or smaller. Discard this recording and try a shorter one.";
      return;
    }

    const mimeType = (voiceNoteBlob.type || "audio/webm")
      .split(";")[0]
      .toLowerCase();
    const supportedTypes = new Set([
      "audio/aac",
      "audio/mpeg",
      "audio/mp4",
      "audio/ogg",
      "audio/wav",
      "audio/webm",
      "audio/x-m4a",
    ]);
    if (!supportedTypes.has(mimeType)) {
      composerStatus.textContent =
        "This browser's voice note format is not supported.";
      return;
    }

    isSendingVoiceNote = true;
    mobileActionButton.disabled = true;
    composerStatus.textContent = "Sending voice note...";
    try {
      const audioBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener("load", () => {
          resolve(String(reader.result).split(",", 2)[1]);
        });
        reader.addEventListener("error", () => reject(reader.error));
        reader.readAsDataURL(voiceNoteBlob);
      });
      if (ws !== socket || socket.readyState !== WebSocket.OPEN) {
        throw new Error("The chat disconnected before the voice note sent.");
      }
      socket.send(
        JSON.stringify({
          type: "voice_note",
          mime_type: mimeType,
          audio_base64: audioBase64,
          duration_seconds: voiceNoteDuration,
        }),
      );
      clearVoiceNote();
      composerStatus.textContent = "Voice note sent.";
    } catch (error) {
      console.error("Unable to send voice note:", error);
      composerStatus.textContent =
        "Voice note could not be sent. Your recording is kept here to retry.";
    } finally {
      isSendingVoiceNote = false;
      mobileActionButton.disabled = false;
      updateMobileAction();
    }
  };

  const startVoiceRecording = async () => {
    if (voiceNoteBlob) {
      composerStatus.textContent =
        "Discard the attached voice note before recording another.";
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      composerStatus.textContent =
        "Voice recording is not supported by this browser.";
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const chunks = [];
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.addEventListener("dataavailable", (event) => {
        if (event.data.size) chunks.push(event.data);
      });
      const startedAt = Date.now();
      mediaRecorder.addEventListener("stop", async () => {
        stream.getTracks().forEach((track) => track.stop());
        recordingIndicator.hidden = true;
        composerField.classList.remove("is-recording");
        messageInput.disabled = false;
        isStoppingVoiceNote = false;
        mobileActionButton.disabled = false;
        voiceNoteButton.disabled = false;
        voiceNoteButton.setAttribute("aria-pressed", "false");
        voiceNoteButton.setAttribute("aria-label", "Record voice note");
        voiceNoteButton.title = "Record voice note";
        voiceNoteButton.innerHTML =
          '<i class="fa-solid fa-microphone" aria-hidden="true"></i>';

        if (chunks.length) {
          const recordedType =
            mediaRecorder.mimeType || chunks[0].type || "audio/webm";
          voiceNoteBlob = new Blob(chunks, { type: recordedType });
          voiceNoteDuration = Math.max(
            1,
            Math.round((Date.now() - startedAt) / 1000),
          );
          voiceNoteUrl = URL.createObjectURL(voiceNoteBlob);
          voiceNoteAudio.src = voiceNoteUrl;
          voiceNotePreview.hidden = false;
          composerField.classList.add("has-voice-note");
          updateMobileAction();
          await sendVoiceNote();
        } else {
          composerStatus.textContent = "No audio was captured. Try again.";
          updateMobileAction();
        }
      });

      mediaRecorder.start();
      messageInput.disabled = true;
      composerField.classList.add("is-recording");
      recordingIndicator.hidden = false;
      voiceNoteButton.setAttribute("aria-pressed", "true");
      voiceNoteButton.setAttribute("aria-label", "Stop voice note recording");
      voiceNoteButton.title = "Stop recording";
      voiceNoteButton.innerHTML =
        '<i class="fa-solid fa-stop" aria-hidden="true"></i>';
      composerStatus.textContent =
        "Recording voice note. Select stop to finish.";
      recordingTimer.textContent = "00:00";
      recordingInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        recordingTimer.textContent = formatRecordingTime(elapsed);
        if (elapsed >= 300) {
          composerStatus.textContent = "Five-minute recording limit reached.";
          stopVoiceRecording();
        }
      }, 1000);
      updateMobileAction();
    } catch (error) {
      messageInput.disabled = false;
      isStoppingVoiceNote = false;
      mobileActionButton.disabled = false;
      voiceNoteButton.disabled = false;
      console.error("Unable to start voice recording:", error);
      composerStatus.textContent =
        "Microphone access was denied or unavailable.";
    }
  };

  messageInput.addEventListener("input", () => {
    emojiInsertStart = messageInput.selectionStart;
    emojiInsertEnd = messageInput.selectionEnd;
    updateMobileAction();
  });
  messageInput.addEventListener("select", () => {
    emojiInsertStart = messageInput.selectionStart;
    emojiInsertEnd = messageInput.selectionEnd;
  });
  messageInput.addEventListener("keyup", () => {
    emojiInsertStart = messageInput.selectionStart;
    emojiInsertEnd = messageInput.selectionEnd;
  });
  emojiSearch.addEventListener("input", renderEmojiPicker);

  emojiPickerButton.addEventListener("click", () => {
    const isOpen = !emojiPicker.hidden;
    emojiPicker.hidden = isOpen;
    emojiPickerButton.setAttribute("aria-expanded", String(!isOpen));
    if (!isOpen) {
      emojiInsertStart = messageInput.selectionStart;
      emojiInsertEnd = messageInput.selectionEnd;
      emojiSearch.focus();
    }
  });

  emojiPicker.addEventListener("click", (event) => {
    const emojiButton = event.target.closest("[data-emoji]");
    if (!emojiButton) return;

    const emoji = emojiButton.dataset.emoji;
    const start = Math.min(emojiInsertStart, messageInput.value.length);
    const end = Math.min(emojiInsertEnd, messageInput.value.length);
    messageInput.setRangeText(emoji, start, Math.max(start, end), "end");
    emojiInsertStart = messageInput.selectionStart;
    emojiInsertEnd = messageInput.selectionEnd;
    resizeMessageInput();
    updateMobileAction();
    messageInput.focus();
    emojiPicker.hidden = true;
    emojiPickerButton.setAttribute("aria-expanded", "false");
  });

  emojiSearch.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      emojiPicker.hidden = true;
      emojiPickerButton.setAttribute("aria-expanded", "false");
      emojiPickerButton.focus();
    }
  });

  document.addEventListener("click", (event) => {
    if (!messageForm.contains(event.target)) {
      emojiPicker.hidden = true;
      emojiPickerButton.setAttribute("aria-expanded", "false");
    }
  });

  cameraPickerButton.addEventListener("click", () =>
    cameraPickerInput.click(),
  );
  cameraPickerInput.addEventListener("change", () => {
    const photo = cameraPickerInput.files[0];
    if (photo) {
      composerStatus.textContent = `Selected ${photo.name}. Image sending is not supported yet.`;
    }
  });

  voiceNoteButton.addEventListener("click", async () => {
    if (mediaRecorder?.state === "recording") {
      stopVoiceRecording();
      voiceNoteButton.disabled = true;
      return;
    }
    startVoiceRecording();
  });

  mobileActionButton.addEventListener("click", () => {
    if (mediaRecorder?.state === "recording") {
      stopVoiceRecording();
    } else if (isStoppingVoiceNote) {
      return;
    } else if (voiceNoteBlob) {
      sendVoiceNote();
    } else if (messageInput.value.trim()) {
      messageForm.requestSubmit();
    } else if (voiceNoteUrl) {
      composerStatus.textContent =
        "Voice note is attached for preview, but audio sending is not supported yet.";
    } else {
      startVoiceRecording();
    }
  });
  discardVoiceNoteButton.addEventListener("click", clearVoiceNote);

  messageForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();

    if (voiceNoteBlob) {
      sendVoiceNote();
      return;
    }

    if (content && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(content);
      messageInput.value = "";
      emojiInsertStart = 0;
      emojiInsertEnd = 0;
      resizeMessageInput();
      updateMobileAction();
    }
  });
  updateMobileAction();
}


}

async function loadRooms() {
  const roomsListEl = document.getElementById("rooms-list");
  if (!roomsListEl) {
    throw new Error("Conversation list container #rooms-list was not found");
  }

  const cachedRooms = readJsonStorage(roomListCacheKey(), []);
  const renderRooms = (rooms) => {
    if (!Array.isArray(rooms)) return;
    roomsListEl.innerHTML = "";
    const filteredRooms = rooms.filter((r) => r.is_archived === showArchived);

    filteredRooms.forEach((room) => {
      const li = document.createElement("li");
      li.className = "room-item";
      li.dataset.roomId = room.id;
      li.dataset.roomName = String(room.name || "").toLocaleLowerCase();

      const avatar = document.createElement("span");
      avatar.className = "room-avatar";
      avatar.setAttribute("aria-hidden", "true");
      avatar.textContent =
        String(room.name || "?").trim().charAt(0).toLocaleUpperCase() || "?";

      const copy = document.createElement("span");
      copy.className = "room-item-copy";

      const heading = document.createElement("span");
      heading.className = "room-item-heading";

      const name = document.createElement("span");
      name.className = "room-name";
      name.textContent = room.name;

      const time = document.createElement("time");
      time.className = "room-time";
      time.hidden = true;

      const preview = document.createElement("span");
      preview.className = "room-preview";
      preview.textContent = "No messages yet";

      const cachedPreview = readJsonStorage(roomPreviewCacheKey(room.id));
      if (cachedPreview && typeof cachedPreview.preview === "string") {
        preview.textContent = cachedPreview.preview;
        if (cachedPreview.timestamp) {
          time.hidden = false;
          time.dateTime = cachedPreview.timestamp;
          time.textContent = cachedPreview.label || "";
          time.title = cachedPreview.title || cachedPreview.timestamp;
          li.dataset.previewTimestamp = cachedPreview.timestamp;
        }
      }

      heading.append(name, time);
      copy.append(heading, preview);
      li.append(avatar, copy);
      li.addEventListener("click", () => {
        document
          .querySelectorAll(".room-item")
          .forEach((el) => el.classList.remove("active"));
        li.classList.add("active");
        joinRoom(room.id, room.name);
      });
      roomsListEl.appendChild(li);

      loadRoomPreview(room.id).catch((err) => {
        console.error(`Failed to load preview for room ${room.id}:`, err);
        if (!li.querySelector(".room-preview").textContent.trim()) {
          li.querySelector(".room-preview").textContent =
            "Message preview unavailable";
        }
      });
    });

    if (filteredRooms.length === 0) {
      const emptyMessage = document.createElement("li");
      emptyMessage.className = "room-list-message";
      emptyMessage.textContent = `No ${showArchived ? "archived" : "active"} rooms.`;
      roomsListEl.appendChild(emptyMessage);
    }

    const activeRoom = readJsonStorage(activeRoomStorageKey(), null);
    if (activeRoom?.roomId) {
      const activeItem = Array.from(
        document.querySelectorAll("#rooms-list .room-item"),
      ).find((item) => item.dataset.roomId === String(activeRoom.roomId));
      if (activeItem) {
        document
          .querySelectorAll(".room-item")
          .forEach((el) => el.classList.remove("active"));
        activeItem.classList.add("active");
      }
    }

    filterRoomsList(document.getElementById("chat-search").value);
  };

  try {
    const res = await fetch(`${API_URL}/api/rooms`);
    if (!res.ok) {
      throw new Error(`Rooms request failed with status ${res.status}`);
    }
    const rooms = await res.json();
    if (!Array.isArray(rooms)) {
      throw new Error("Rooms response was not a list");
    }
    writeJsonStorage(roomListCacheKey(), rooms);
    renderRooms(rooms);
    restoreActiveRoomState();
    return;
  } catch (err) {
    console.warn("Failed to refresh rooms list; falling back to cache.", err);
  }

  if (Array.isArray(cachedRooms) && cachedRooms.length > 0) {
    renderRooms(cachedRooms);
    restoreActiveRoomState();
    return;
  }

  const errorMessage = document.createElement("li");
  errorMessage.className = "room-list-message";
  errorMessage.textContent =
    "Unable to load conversations. Check your connection and try again.";
  roomsListEl.replaceChildren(errorMessage);
}

async function loadRoomPreview(roomId) {
  const cachedPreview = readJsonStorage(roomPreviewCacheKey(roomId), null);
  try {
    const response = await fetch(`${API_URL}/api/rooms/${roomId}/messages`);
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    const messages = await response.json();
    if (!Array.isArray(messages)) {
      throw new Error("Room messages response was not a list");
    }

    const latestMessage = messages[messages.length - 1];
    if (latestMessage) {
      updateRoomPreview(roomId, latestMessage);
      writeJsonStorage(roomMessagesCacheKey(roomId), messages);
    }
    return;
  } catch (err) {
    console.warn(`Preview refresh failed for room ${roomId}; showing cached data.`, err);
  }

  if (cachedPreview) {
    const roomItem = Array.from(
      document.querySelectorAll("#rooms-list .room-item"),
    ).find((item) => item.dataset.roomId === String(roomId));
    if (roomItem && roomItem.querySelector(".room-preview")) {
      roomItem.querySelector(".room-preview").textContent = cachedPreview.preview;
      const time = roomItem.querySelector(".room-time");
      if (cachedPreview.timestamp && time) {
        time.hidden = false;
        time.dateTime = cachedPreview.timestamp;
        time.textContent = cachedPreview.label || "";
        time.title = cachedPreview.title || cachedPreview.timestamp;
        roomItem.dataset.previewTimestamp = cachedPreview.timestamp;
      }
    }
  }
}

function updateRoomPreview(roomId, message) {
  const roomItem = Array.from(
    document.querySelectorAll("#rooms-list .room-item"),
  ).find((item) => item.dataset.roomId === String(roomId));
  if (!roomItem) return;

  const preview = roomItem.querySelector(".room-preview");
  const time = roomItem.querySelector(".room-time");
  const date = new Date(message.timestamp);
  const previousDate = new Date(roomItem.dataset.previewTimestamp);
  if (
    !Number.isNaN(date.getTime()) &&
    !Number.isNaN(previousDate.getTime()) &&
    date < previousDate
  ) {
    return;
  }

  const sender = message.username ? `${message.username}: ` : "";
  const previewText = parseVoiceNoteContent(message.content)
    ? "Voice note"
    : message.content || "";
  const previewValue = `${sender}${previewText}`;
  preview.textContent = previewValue;
  writeJsonStorage(roomPreviewCacheKey(roomId), {
    preview: previewValue,
    timestamp: message.timestamp,
    label: Number.isNaN(date.getTime())
      ? ""
      : date.toDateString() === new Date().toDateString()
        ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : date.toLocaleDateString([], { month: "short", day: "numeric" }),
    title: Number.isNaN(date.getTime()) ? "" : date.toLocaleString(),
  });

  if (!Number.isNaN(date.getTime())) {
    roomItem.dataset.previewTimestamp = date.toISOString();
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    time.dateTime = date.toISOString();
    time.textContent = isToday
      ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : date.toLocaleDateString([], { month: "short", day: "numeric" });
    time.title = date.toLocaleString();
    time.hidden = false;
  }
}

function filterRoomsList(searchTerm) {
  const normalizedTerm = searchTerm.trim().toLocaleLowerCase();
  document.querySelectorAll("#rooms-list .room-item").forEach((room) => {
    room.hidden = !room.dataset.roomName.includes(normalizedTerm);
  });
}

function persistActiveRoom(roomId, roomName) {
  writeJsonStorage(activeRoomStorageKey(), { roomId, roomName });
}

function restoreActiveRoomState() {
  const activeRoom = readJsonStorage(activeRoomStorageKey(), null);
  if (!activeRoom?.roomId || currentRoomId) return;

  const roomItem = Array.from(
    document.querySelectorAll("#rooms-list .room-item"),
  ).find((item) => item.dataset.roomId === String(activeRoom.roomId));
  if (!roomItem) return;

  roomItem.classList.add("active");
  joinRoom(activeRoom.roomId, activeRoom.roomName || roomItem.querySelector(".room-name")?.textContent || "Conversation");
}

async function joinRoom(roomId, roomName) {
  currentRoomId = roomId;
  persistActiveRoom(roomId, roomName);
  document.getElementById("app-container").classList.add("chat-open");
  document.getElementById("chat-main").classList.remove("empty-state");
  document.getElementById("active-room-name").textContent = roomName;
  const connectionStatus = document.getElementById("active-room-status");
  const connectionStatusText = document.getElementById(
    "active-room-status-text",
  );
  const setConnectionStatus = (state, text) => {
    connectionStatus.dataset.state = state;
    connectionStatusText.textContent = text;
  };
  setConnectionStatus("connecting", "Connecting");

  const feed = document.getElementById("chat-messages");
  const cachedMessages = readJsonStorage(roomMessagesCacheKey(roomId), []);
  if (Array.isArray(cachedMessages) && cachedMessages.length > 0) {
    feed.innerHTML = "";
    cachedMessages.forEach((msg) => appendMessage(msg));
  } else {
    feed.innerHTML = "";
  }

  if (ws) ws.close();

  try {
    const res = await fetch(`${API_URL}/api/rooms/${roomId}/messages`);
    if (!res.ok) {
      throw new Error(`History request failed with status ${res.status}`);
    }
    const messages = await res.json();
    if (!Array.isArray(messages)) {
      throw new Error("Room messages response was not a list");
    }
    writeJsonStorage(roomMessagesCacheKey(roomId), messages);
    feed.innerHTML = "";
    messages.forEach((msg) => appendMessage(msg));
  } catch (err) {
    console.warn("Failed to load room history; using cached history.", err);
    if (Array.isArray(cachedMessages) && cachedMessages.length > 0) {
      feed.innerHTML = "";
      cachedMessages.forEach((msg) => appendMessage(msg));
    }
  }

  const userId = localStorage.getItem("user_id");
  if (!userId) {
    window.location.href = "login.html";
    return;
  }

  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const apiAddress = new URL(API_URL);
  ws = new WebSocket(
    `${wsProtocol}//${apiAddress.host}/ws/chat/${roomId}/${userId}`,
  );
  const roomSocket = ws;

  roomSocket.onopen = () => {
    if (ws === roomSocket) setConnectionStatus("connected", "Connected");
  };

  roomSocket.onclose = () => {
    if (ws === roomSocket) setConnectionStatus("disconnected", "Disconnected");
  };

  roomSocket.onerror = () => {
    if (ws === roomSocket)
      setConnectionStatus("disconnected", "Connection error");
  };

  roomSocket.onmessage = (event) => {
    const messageData = JSON.parse(event.data);
    if (messageData.type === "error") {
      const composerStatus = document.getElementById("composer-status");
      if (composerStatus) {
        composerStatus.textContent =
          messageData.detail || "Message was rejected.";
      }
      return;
    }
    appendMessage(messageData);
    updateRoomPreview(roomId, messageData);
    if (messageData.room_id) {
      writeJsonStorage(roomMessagesCacheKey(roomId), [
        ...readJsonStorage(roomMessagesCacheKey(roomId), []),
        messageData,
      ]);
    }
  };
}

function parseVoiceNoteContent(content) {
  if (
    typeof content !== "string" ||
    content.length > VOICE_NOTE_MAX_BASE64_LENGTH + 256
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(content);
    if (
      payload?.type !== "voice_note" ||
      !VOICE_NOTE_MIME_TYPES.has(payload.mime_type) ||
      typeof payload.audio_base64 !== "string" ||
      !payload.audio_base64 ||
      payload.audio_base64.length > VOICE_NOTE_MAX_BASE64_LENGTH ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(payload.audio_base64)
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function appendMessage(msg) {
  const feed = document.getElementById("chat-messages");
  const currentUserId = localStorage.getItem("user_id");
  const isSelf = String(msg.user_id) === String(currentUserId);

  const messageDiv = document.createElement("div");
  messageDiv.className = `message-bubble ${isSelf ? "self" : "other"}`;

  const avatarSeed = localStorage.getItem("avatar_seed") || msg.username;
  const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${isSelf ? avatarSeed : msg.username}`;

  messageDiv.innerHTML = `
        <img class="msg-avatar" src="${avatarUrl}" alt="Avatar">
        <div class="msg-content-wrapper">
            <div class="msg-header">
                <span class="msg-username">${msg.username}</span>
                <span class="msg-time">${new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            <p class="msg-text"></p>
        </div>
    `;
  const messageContent = messageDiv.querySelector(".msg-text");
  const voiceNote = parseVoiceNoteContent(msg.content);
  if (voiceNote) {
    messageContent.classList.add("msg-audio");
    const audioPlayer = document.createElement("audio");
    audioPlayer.controls = true;
    audioPlayer.preload = "metadata";
    audioPlayer.setAttribute("aria-label", "Voice message");
    audioPlayer.src = `data:${voiceNote.mime_type};base64,${voiceNote.audio_base64}`;
    messageContent.appendChild(audioPlayer);
  } else {
    messageContent.textContent =
      typeof msg.content === "string" ? msg.content : "";
  }
  feed.appendChild(messageDiv);
  feed.scrollTop = feed.scrollHeight;
}

function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
