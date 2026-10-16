# Snapline

Turn a YouTube video into a timeline of frames. Paste a link, choose an interval
(2, 5, 10, or 30 seconds), and download timestamped screenshots as a ZIP.

## Features
- Frame capture at a custom interval, up to 720p
- Live progress and a frame viewer with keyboard navigation
- Download all frames as a ZIP, or a single frame
- Temporary storage: frames are deleted automatically after 20 minutes

## Tech stack
React + Vite, Node.js + Express, yt-dlp, ffmpeg

## Run locally
    cd server && npm install && node index.js
    cd client && npm install && npm run dev

## Note
For personal use. Only use it with videos you own or have permission to use.
