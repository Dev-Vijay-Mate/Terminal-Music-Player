# Termusic

> A keyboard-first MP3 player for the terminal, built with Node.js and MPV.

Termusic is a local command-line music player that scans a directory for MP3 files and renders an interactive music library in the terminal. Playback is handled by MPV; Node.js manages the interface, keyboard input, and communication with MPV.

## Features

- Browse MP3 files in a selected music directory
- Play, pause, resume, and switch tracks from the keyboard
- Navigate with arrow keys or familiar `j` / `k` shortcuts
- Move to the next or previous track
- Toggle shuffle and repeat-one modes
- Adjust MPV volume from the terminal
- Display playback state, elapsed time, duration, and a progress bar
- Show track durations before playback when a supported metadata tool is available
- Cleanly stop MPV, restore the cursor, and remove the temporary IPC socket on exit

## Tech stack

- **Node.js** — CLI runtime and terminal interaction
- **MPV** — audio playback engine and IPC server
- **Node.js built-ins** — `child_process`, `fs`, `net`, `os`, and `path`
- **ANSI escape codes** — terminal layout, colour, and cursor handling

There are no runtime npm dependencies.

## Project structure

```text
Terminal-Music-Player/
├── index.js        # CLI application and MPV IPC integration
├── package.json    # npm scripts and the termusic executable definition
├── README.md       # Project documentation
├── LICENSE         # MIT license
├── .gitignore
└── songs/          # Local MP3 files for development/demo use
```

## Requirements

- Node.js **18 or later**
- [MPV](https://mpv.io/) installed and available on your `PATH`
- An interactive terminal/TTY
- A directory containing `.mp3` files

### OS-specific notes

Termusic is intended for **macOS and Linux/other Unix-like systems**. It starts MPV with a Unix-domain IPC socket in the system temporary directory (normally `/tmp`), so it is not designed for Windows as-is.

- **macOS:** `afinfo` is used when available to read durations before a song begins. It is included with macOS.
- **Linux/Unix-like systems:** install `ffprobe` (provided by FFmpeg) to show those pre-playback durations. This is optional—MPV reports the active track's duration after it loads.

Install the required tools on macOS:

```sh
brew install node mpv
```

Optional Linux duration support:

```sh
# Debian/Ubuntu
sudo apt install ffmpeg
```

## Installation and setup

Clone the repository and enter it:

```sh
git clone https://github.com/Dev-Vijay-Mate/Terminal-Music-Player.git
cd Terminal-Music-Player
```

No `npm install` is required. To make the command available from this local checkout, run:

```sh
npm link
```

## Run the project

Start the player with the repository's `songs/` directory:

```sh
npm start
```

Or pass the path to your own music directory:

```sh
node index.js ~/Music
# After npm link:
termusic ~/Music
```

Start with shuffle enabled:

```sh
termusic ~/Music --shuffle
```

## Keyboard controls

| Key | Action |
| --- | --- |
| `↑` / `↓` or `j` / `k` | Select a track |
| `Enter` | Play the selected track |
| `Space` | Pause or resume |
| `n` / `p` | Next / previous track |
| `s` | Toggle shuffle |
| `r` | Toggle repeat-one |
| `+` / `-` | Increase / decrease volume |
| `q` or `Ctrl-C` | Quit cleanly |

## Demo

> **Demo placeholder:** Add a short terminal GIF or screenshot here showing the library view and playback progress.

## What I learned

- Building an interactive CLI with raw terminal input and ANSI escape sequences
- Launching and managing a child process from Node.js
- Communicating with MPV through its JSON IPC interface
- Handling terminal cleanup so raw mode, the cursor, and temporary files are restored on exit
- Designing graceful fallbacks for optional, OS-specific metadata tools

## Future improvements

- Support additional audio formats and recursive library scanning
- Add search and filtering for large music collections
- Add playlist persistence and queue management
- Add album-art or richer metadata display where terminals support it
- Add automated tests for input handling and MPV IPC behaviour
- Add Windows-compatible IPC support

## Author

**Vijay Mate**

## License

This project is licensed under the [MIT License](LICENSE).
