# Termusic

A fast, keyboard-first MP3 player for the terminal. Termusic uses [MPV](https://mpv.io/) for playback and only Node.js built-ins, so there is no `npm install` step.

## Install

Termusic needs Node.js 18+ and MPV on your `PATH`.

```sh
# macOS
brew install node mpv

# Run from this checkout
npm start

# Or expose the command globally from this checkout
npm link
termusic ~/Music
```

On macOS, `afinfo` shows durations before playback. On Linux and Windows, install `ffprobe` (from FFmpeg) for that optional enhancement. MPV always supplies the duration of the loaded track.

## Usage

```sh
termusic [music-directory] [--shuffle]
```

With no directory, Termusic plays MP3s in the local `songs/` directory when present; otherwise it scans the current directory. It scans that directory only (not subdirectories).

| Key | Action |
| --- | --- |
| `↑` / `↓`, `j` / `k` | Select a track |
| `Enter` | Play selection |
| `Space` | Pause / resume |
| `n` / `p` | Next / previous |
| `s` / `r` | Toggle shuffle / repeat-one |
| `+` / `-` | Adjust volume |
| `q`, `Ctrl-C` | Quit cleanly |

## Deployment notes

This is a local interactive CLI for a real terminal/TTY—not a browser, serverless, or background-service deployment. It starts `mpv` as a child process and communicates through a temporary MPV IPC socket in the OS temp directory (such as `/tmp` on macOS/Linux). No network service or credentials are needed.

For release, choose an available npm package name, then use `npm publish`. The package intentionally excludes music files; supply a music directory when using the published CLI. The `bin` entry already exposes `termusic` when installed.
