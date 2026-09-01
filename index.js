#!/usr/bin/env node
"use strict";

const { spawn, execFileSync } = require("child_process");
const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");

const C = { reset: "\x1b[0m", dim: "\x1b[2m", cyan: "\x1b[36m", green: "\x1b[32m", selected: "\x1b[30;46m" };
const args = process.argv.slice(2);
const helpRequested = args.includes("--help") || args.includes("-h");
const shuffleInitially = args.includes("--shuffle") || args.includes("-s");
const directoryArg = args.find((arg) => !arg.startsWith("-"));
const defaultDirectory = fs.existsSync(path.join(__dirname, "songs")) ? path.join(__dirname, "songs") : process.cwd();
const songsDirectory = path.resolve(directoryArg || defaultDirectory);
const socketPath = path.join(os.tmpdir(), `termusic-${process.pid}.sock`);

let songs = [], selectedIndex = 0, activeIndex = -1, playbackState = "Stopped";
let position = 0, duration = 0, volume = 70, shuffle = shuffleInitially, repeat = false;
let mpvProcess, socket, progressTimer, reconnectTimer, exiting = false, pendingCommands = [];
let statusMessage = "Choose a track and press Enter.";

function usage() {
  console.log("\nTermusic — a keyboard-first terminal music player\n\nUsage: termusic [music-directory] [options]\n\nOptions:\n  -s, --shuffle   Start with shuffle enabled\n  -h, --help      Show this help\n\nControls:\n  ↑/↓ or j/k  select    Enter  play    Space  pause\n  n/p          next/previous     s  shuffle     r  repeat\n  +/-          volume             q  quit\n");
}
function fail(message) { process.stderr.write(`termusic: ${message}\n`); process.exit(1); }
function commandExists(command) { try { execFileSync(process.platform === "win32" ? "where" : "which", [command], { stdio: "ignore" }); return true; } catch { return false; } }
function durationFor(file) {
  const fullPath = path.join(songsDirectory, file);
  try {
    if (process.platform === "darwin" && commandExists("afinfo")) {
      const match = execFileSync("afinfo", [fullPath], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).match(/estimated duration:\s*([\d.]+)\s*sec/);
      return match ? Number(match[1]) : 0;
    }
    if (commandExists("ffprobe")) return Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", fullPath], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim()) || 0;
  } catch { /* MPV reports duration after a track loads. */ }
  return 0;
}
function formatTime(seconds) { const total = Math.max(0, Math.floor(seconds || 0)); return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`; }
function titleFor(index) { return index < 0 ? "Nothing playing" : path.basename(songs[index].file, path.extname(songs[index].file)); }
function truncate(text, width) { return text.length > width ? `${text.slice(0, Math.max(1, width - 1))}…` : text; }
function send(command) { if (socket && !socket.destroyed) socket.write(`${JSON.stringify({ command })}\n`); else pendingCommands.push(command); }
function row(text, width) { return `│ ${truncate(text, width - 4).padEnd(width - 4)} │`; }

function render() {
  const columns = Math.max(58, process.stdout.columns || 80), width = Math.min(92, columns - 4), left = " ".repeat(Math.max(0, Math.floor((columns - width) / 2)));
  const border = `┌${"─".repeat(width - 2)}┐`, divider = `├${"─".repeat(width - 2)}┤`, bottom = `└${"─".repeat(width - 2)}┘`;
  const percent = duration ? Math.min(100, Math.round((position / duration) * 100)) : 0, barWidth = Math.max(12, Math.min(34, width - 39)), filled = Math.round(percent / 100 * barWidth);
  const bar = `${"━".repeat(filled)}${"─".repeat(barWidth - filled)}`;
  process.stdout.write("\x1b[2J\x1b[H");
  process.stdout.write(`${left}${C.cyan}TERMUSIC${C.reset}  ${C.dim}${songs.length} tracks · ${path.basename(songsDirectory)}${C.reset}\n\n${left}${border}\n${left}${row("LIBRARY", width)}\n${left}${divider}\n`);
  songs.forEach((song, index) => {
    const marker = index === activeIndex ? (playbackState === "Paused" ? "Ⅱ" : "▶") : " ";
    const prefix = `${index === selectedIndex ? "›" : " "} ${String(index + 1).padStart(2, "0")}  ${marker} `, suffix = `  ${formatTime(index === activeIndex ? duration : song.duration)}`;
    const line = `${prefix}${truncate(titleFor(index), width - prefix.length - suffix.length - 4)}${suffix}`;
    process.stdout.write(`${left}${index === selectedIndex ? `${C.selected}${row(line, width)}${C.reset}` : row(line, width)}\n`);
  });
  const mode = `${shuffle ? "shuffle" : "in order"} · ${repeat ? "repeat" : "no repeat"} · vol ${volume}%`;
  process.stdout.write(`${left}${divider}\n${left}${row(`NOW PLAYING  ${titleFor(activeIndex)}`, width)}\n${left}${row(`${playbackState.toUpperCase()}  ${C.green}${bar}${C.reset} ${String(percent).padStart(3)}%  ${formatTime(position)} / ${formatTime(duration)}`, width)}\n${left}${row(`${statusMessage}  ${mode}`, width)}\n${left}${bottom}\n${left}${C.dim}↑/↓ or j/k select  Enter play  Space pause  n/p next/prev  s shuffle  r repeat  +/- volume  q quit${C.reset}\n`);
}
function chooseNext(direction = 1) {
  if (activeIndex < 0) return selectedIndex;
  if (shuffle && direction > 0 && songs.length > 1) { let next = activeIndex; while (next === activeIndex) next = Math.floor(Math.random() * songs.length); return next; }
  return (activeIndex + direction + songs.length) % songs.length;
}
function play(index) {
  activeIndex = selectedIndex = index; position = 0; duration = songs[index].duration || 0; playbackState = "Playing"; statusMessage = `Playing ${titleFor(index)}.`;
  send(["loadfile", path.join(songsDirectory, songs[index].file), "replace"]); send(["set_property", "pause", false]); render();
}
function updateProperties() { send(["get_property", "time-pos"]); send(["get_property", "duration"]); send(["get_property", "pause"]); }
function cleanup(exitCode = 0) {
  if (exiting) return; exiting = true; clearInterval(progressTimer); clearTimeout(reconnectTimer);
  if (socket && !socket.destroyed) socket.destroy(); if (mpvProcess && !mpvProcess.killed) mpvProcess.kill(); try { fs.unlinkSync(socketPath); } catch {}
  if (process.stdin.isTTY) process.stdin.setRawMode(false); process.stdout.write("\x1b[?25h\n"); process.exit(exitCode);
}
function handleMpvMessage(message) {
  if (message.event === "property-change") {
    if (message.name === "time-pos") position = message.data || 0;
    if (message.name === "duration") { duration = message.data || duration; if (activeIndex >= 0 && duration) songs[activeIndex].duration = duration; }
    if (message.name === "pause") playbackState = message.data ? "Paused" : "Playing";
    render();
  }
  if (message.event === "end-file" && activeIndex >= 0 && message.reason === "eof") repeat ? play(activeIndex) : play(chooseNext());
}
function connectToMpv() {
  if (exiting) return; socket = net.createConnection(socketPath); socket.setEncoding("utf8"); let remainder = "";
  socket.on("data", (chunk) => { remainder += chunk; const lines = remainder.split("\n"); remainder = lines.pop(); lines.filter(Boolean).forEach((line) => { try { handleMpvMessage(JSON.parse(line)); } catch {} }); });
  socket.on("connect", () => { pendingCommands.splice(0).forEach(send); send(["observe_property", 1, "time-pos"]); send(["observe_property", 2, "duration"]); send(["observe_property", 3, "pause"]); progressTimer ||= setInterval(updateProperties, 500); render(); });
  socket.on("error", () => { if (!exiting && !reconnectTimer) reconnectTimer = setTimeout(() => { reconnectTimer = null; connectToMpv(); }, 100); });
}
function start() {
  if (helpRequested) return usage();
  if (!process.stdin.isTTY || !process.stdout.isTTY) fail("an interactive terminal is required.");
  if (!commandExists("mpv")) fail("MPV is required. Install it with: brew install mpv");
  if (!fs.existsSync(songsDirectory)) fail(`music directory not found: ${songsDirectory}`);
  songs = fs.readdirSync(songsDirectory, { withFileTypes: true }).filter((entry) => entry.isFile() && /\.mp3$/i.test(entry.name)).map((entry) => ({ file: entry.name, duration: durationFor(entry.name) })).sort((a, b) => a.file.localeCompare(b.file));
  if (!songs.length) fail(`no MP3 files found in ${songsDirectory}`);
  try { fs.unlinkSync(socketPath); } catch {}
  mpvProcess = spawn("mpv", ["--idle=yes", "--no-video", "--really-quiet", `--input-ipc-server=${socketPath}`], { stdio: ["ignore", "ignore", "ignore"] });
  mpvProcess.on("error", () => fail("could not launch MPV. Ensure it is installed and on PATH.")); mpvProcess.on("exit", (code) => { if (!exiting) fail(`MPV exited unexpectedly${code === null ? "" : ` (code ${code})`}.`); });
  connectToMpv(); process.stdin.setRawMode(true); process.stdin.resume();
  process.stdin.on("data", (input) => {
    const key = input.toString();
    if (key === "q" || key === "Q" || key === "\u0003") cleanup();
    else if (key === "\u001b[A" || key === "k") { selectedIndex = (selectedIndex - 1 + songs.length) % songs.length; render(); }
    else if (key === "\u001b[B" || key === "j") { selectedIndex = (selectedIndex + 1) % songs.length; render(); }
    else if (key === "\r" || key === "\n") play(selectedIndex);
    else if (key === " ") { if (activeIndex >= 0) { send(["cycle", "pause"]); statusMessage = "Toggled playback."; } }
    else if (key === "n") play(chooseNext()); else if (key === "p") play(chooseNext(-1));
    else if (key === "s") { shuffle = !shuffle; statusMessage = `Shuffle ${shuffle ? "on" : "off"}.`; render(); }
    else if (key === "r") { repeat = !repeat; statusMessage = `Repeat ${repeat ? "on" : "off"}.`; render(); }
    else if (key === "+" || key === "=") { volume = Math.min(100, volume + 5); send(["set_property", "volume", volume]); render(); }
    else if (key === "-") { volume = Math.max(0, volume - 5); send(["set_property", "volume", volume]); render(); }
  });
  process.on("SIGINT", () => cleanup()); process.on("SIGTERM", () => cleanup()); process.stdout.write("\x1b[?25l"); render();
}
start();
