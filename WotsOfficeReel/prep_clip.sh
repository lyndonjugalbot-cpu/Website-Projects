#!/bin/sh
# Turns a phone screen recording into a showcase clip for the reel.
#
#   ./prep_clip.sh <recording> <name> <start> [speed] [crop_top] [crop_bottom]
#
#   recording    the phone's screen recording (any format ffmpeg reads)
#   name         short id, e.g. "cafe"; writes assets/work/<name>.mp4
#   start        second in the recording where the good part begins
#   speed        playback speed, e.g. 1.5 to scroll faster (default 1)
#   crop_top     pixels to cut off the top: status bar + browser address bar (default 0)
#   crop_bottom  pixels to cut off the bottom: browser toolbar / home bar (default 0)
#
# The clip is 3.2 s long (enough for the time a site is on screen), 788 px wide
# (2x the phone screen in the reel) and 30 fps. It prints the frame count to put
# in SITES in reel.html: { clip: "<name>", frames: <count>, ... }.
set -e
cd "$(dirname "$0")"
IN="$1"; NAME="$2"; START="$3"; SPEED="${4:-1}"; TOP="${5:-0}"; BOTTOM="${6:-0}"
[ -n "$IN" ] && [ -n "$NAME" ] && [ -n "$START" ] || { sed -n '2,15p' "$0"; exit 1; }
OUT="assets/work/$NAME.mp4"
ffmpeg -y -loglevel error -ss "$START" -i "$IN" -an \
  -vf "crop=iw:ih-$TOP-$BOTTOM:0:$TOP,setpts=PTS/$SPEED,fps=30,scale=788:-2:flags=lanczos" \
  -t 3.2 -c:v libx264 -crf 18 -pix_fmt yuv420p -movflags +faststart "$OUT"
FRAMES=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$OUT")
echo "wrote $OUT ($FRAMES frames) -> SITES: { clip: \"$NAME\", frames: $FRAMES, ... }"
