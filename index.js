const { execFileSync, spawn } = require("child_process");
const fs = require("fs");
const net = require("net");
const path = require("path");

const songsDirectory = path.resolve(__dirname, "songs");
const socketPath = path.join("/tmp", `music-player-${process.pid}.sock`);
const songs = fs.readdirSync(songsDirectory).filter((file) => file.endsWith(".mp3")).sort();
const durations = songs.map(getDuration);

let mpvProcess = null;
let socket = null;
let progressTimer = null;
let selectedIndex = 0;
let activeIndex = -1;
let playbackState = "Stopped";
let position = 0;
let duration = 0;
let exiting = false;
let pendingCommands = [];
let reconnectTimer = null;
let firstSongStarted = false;

function getDuration(file) {
  try {
    const output = execFileSync("afinfo", [path.join(songsDirectory, file)], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const match = output.match(/estimated duration:\s*([\d.]+)\s*sec/);
    return match ? Number(match[1]) : 0;
  } catch {
    return 0;
  }
}

function formatTime(seconds) {
  const totalSeconds = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

function fitText(text, width) {
  return text.length > width ? `${text.slice(0, Math.max(0, width - 3))}...` : text;
}

function sendCommand(command) {
  if (socket && !socket.destroyed) {
    socket.write(`${JSON.stringify({ command })}\n`);
  } else {
    pendingCommands.push(command);
  }
}

function render() {
  const terminalWidth = Math.max(52, process.stdout.columns || 80);
  const contentWidth = Math.min(88, terminalWidth - 4);
  const innerWidth = contentWidth - 2;
  const percent = duration ? Math.min(100, Math.floor((position / duration) * 100)) : 0;
  const barWidth = Math.max(20, Math.min(42, innerWidth - 26));
  const filled = Math.round((percent / 100) * barWidth);
  const bar = `${"=".repeat(filled)}${"-".repeat(barWidth - filled)}`;
  const title = activeIndex >= 0 ? songs[activeIndex].replace(/\.mp3$/, "") : "Nothing playing";
  const line = `+${"-".repeat(innerWidth)}+`;
  const pad = (text) => `|${` ${text}`.padEnd(innerWidth - 1)}|`;

  process.stdout.write("\x1b[2J\x1b[H\x1b[36m");
  process.stdout.write(`${" ".repeat(Math.max(0, Math.floor((terminalWidth - contentWidth) / 2)))}MUSIC PLAYER\x1b[0m\n\n`);
  process.stdout.write(`${line}\n`);
  process.stdout.write(`${pad("YOUR LIBRARY")}\n`);
  process.stdout.write(`${line}\n`);
  songs.forEach((song, index) => {
    const marker = index === selectedIndex ? ">" : " ";
    const playing = index === activeIndex && playbackState !== "Stopped" ? " *" : "";
    const name = fitText(song.replace(/\.mp3$/, ""), innerWidth - 13);
    const row = `${marker} ${String(index + 1).padStart(2, "0")}  ${name}`.padEnd(innerWidth - playing.length);
    const color = index === selectedIndex ? "\x1b[30;46m" : "\x1b[37m";
    process.stdout.write(`${color}| ${row}${playing} |\x1b[0m\n`);
  });
  process.stdout.write(`${line}\n`);
  process.stdout.write(`${pad(`NOW PLAYING  ${fitText(title, innerWidth - 13)}`)}\n`);
  if (firstSongStarted) process.stdout.write(`${pad("Welcome! Enjoy your music.")}\n`);
  process.stdout.write(`${pad(`${playbackState.toUpperCase()}  [\x1b[32m${bar}\x1b[0m] ${String(percent).padStart(3, " ")}%  ${formatTime(position)} / ${formatTime(duration)}`)}\n`);
  process.stdout.write(`${line}\n`);
  process.stdout.write("\x1b[90m  UP/DOWN  navigate    ENTER  play    SPACE  pause/resume    Q  quit\x1b[0m\n");
}

function updatePosition() {
  sendCommand(["get_property", "time-pos"]);
  sendCommand(["get_property", "duration"]);
  sendCommand(["get_property", "pause"]);
}

function startSelected() {
  activeIndex = selectedIndex;
  position = 0;
  duration = durations[activeIndex];
  playbackState = "Playing";
  firstSongStarted = true;
  sendCommand(["loadfile", path.join(songsDirectory, songs[activeIndex]), "replace"]);
  sendCommand(["set", "pause", false]);
  render();
}

function togglePause() {
  if (activeIndex < 0) return;
  sendCommand(["cycle", "pause"]);
  updatePosition();
}

function cleanup() {
  if (exiting) return;
  exiting = true;
  if (progressTimer) clearInterval(progressTimer);
  sendCommand(["quit"]);
  if (socket && !socket.destroyed) socket.destroy();
  if (mpvProcess) mpvProcess.kill();
  try {
    if (fs.existsSync(socketPath)) fs.unlinkSync(socketPath);
  } catch {}
  if (process.stdin.isTTY) process.stdin.setRawMode(false);
  process.stdout.write("\x1b[?25h\n");
}

function handleMpvMessage(message) {
  if (message.event === "property-change") {
    if (message.name === "time-pos") position = message.data || 0;
    if (message.name === "duration") duration = message.data || duration;
    if (message.name === "pause") playbackState = message.data ? "Paused" : "Playing";
    render();
  }
  if (message.event === "end-file" && activeIndex >= 0) {
    playbackState = "Finished";
    position = duration;
    render();
  }
}

if (songs.length === 0) {
  console.error("No MP3 files found in songs/");
  process.exit(1);
}

mpvProcess = spawn("mpv", ["--idle=yes", "--no-video", "--really-quiet", `--input-ipc-server=${socketPath}`]);
mpvProcess.on("error", (error) => {
  if (error.code === "ENOENT") console.error("mpv is required. Install it with: brew install mpv");
  cleanup();
  process.exit(1);
});

const connectToMpv = () => {
  socket = net.createConnection(socketPath);
  socket.on("data", (data) => {
    data.toString().split("\n").filter(Boolean).forEach((line) => {
      try {
        handleMpvMessage(JSON.parse(line));
      } catch {}
    });
  });
  socket.on("error", () => {
    if (!exiting && !reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectToMpv();
      }, 100);
    }
  });
  socket.on("connect", () => {
    pendingCommands.splice(0).forEach((command) => sendCommand(command));
    sendCommand(["observe_property", 1, "time-pos"]);
    sendCommand(["observe_property", 2, "duration"]);
    sendCommand(["observe_property", 3, "pause"]);
    if (!progressTimer) progressTimer = setInterval(updatePosition, 250);
    render();
  });
};

connectToMpv();
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.on("data", (input) => {
  const key = input.toString();
  if (key === "q" || key === "Q" || key === "\u0003") {
    cleanup();
    process.exit(0);
  } else if (key === "\u001b[A") {
    selectedIndex = (selectedIndex - 1 + songs.length) % songs.length;
    render();
  } else if (key === "\u001b[B") {
    selectedIndex = (selectedIndex + 1) % songs.length;
    render();
  } else if (key === "\r" || key === "\n") {
    startSelected();
  } else if (key === " ") {
    togglePause();
  }
});

process.on("SIGINT", () => {
  cleanup();
  process.exit(0);
});

process.stdout.write("\x1b[?25l");
render();
