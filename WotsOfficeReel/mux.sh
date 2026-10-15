#!/bin/sh
# Joins the rendered frames with the soundtrack into the final Reel, plus a cover image.
#   out/frames.mp4 + out/music.wav -> wots-office-reel.mp4, wots-office-reel-cover.jpg
set -e
cd "$(dirname "$0")"
ffmpeg -y -loglevel error -i out/frames.mp4 -i out/music.wav \
  -map 0:v -map 1:a -c:v copy \
  -af "loudnorm=I=-14:TP=-1.5:LRA=11" -c:a aac -b:a 192k -ar 48000 \
  -shortest -movflags +faststart wots-office-reel.mp4
# Cover: the brand frame with the logo, fully built (t = 8.6 s)
ffmpeg -y -loglevel error -ss 8.6 -i out/frames.mp4 -frames:v 1 -q:v 2 wots-office-reel-cover.jpg
echo "wrote wots-office-reel.mp4 and wots-office-reel-cover.jpg"
