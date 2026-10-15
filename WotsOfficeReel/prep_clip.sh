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
# To stitch several moments together instead, set SEGMENTS to start:end:speed
# parts (start/speed arguments are then ignored), e.g.
#   SEGMENTS="0:1.2:1.2,16.4:18.4:1.6" ./prep_clip.sh rec.mov app 0 1 100 0
#
# The clip is $CLIP_LEN seconds long (default 4, enough for the time a site is on screen), 788 px wide
# (2x the phone screen in the reel) and 30 fps. It prints the frame count to put
# in SITES in reel.html: { clip: "<name>", frames: <count>, ... }.
set -e
cd "$(dirname "$0")"
IN="$1"; NAME="$2"; START="$3"; SPEED="${4:-1}"; TOP="${5:-0}"; BOTTOM="${6:-0}"; LEN="${CLIP_LEN:-4}"
[ -n "$IN" ] && [ -n "$NAME" ] && [ -n "$START" ] || { sed -n '2,19p' "$0"; exit 1; }
OUT="assets/work/$NAME.mp4"
LOOK="crop=iw:ih-$TOP-$BOTTOM:0:$TOP,fps=30,scale=788:-2:flags=lanczos"
if [ -z "$SEGMENTS" ]; then
  ffmpeg -y -loglevel error -ss "$START" -i "$IN" -an \
    -vf "setpts=PTS/$SPEED,$LOOK" \
    -t "$LEN" -c:v libx264 -crf 18 -pix_fmt yuv420p -movflags +faststart "$OUT"
else
  GRAPH=""; LABELS=""; N=0
  for SEG in $(echo "$SEGMENTS" | tr ',' ' '); do
    S=$(echo "$SEG" | cut -d: -f1); E=$(echo "$SEG" | cut -d: -f2); SP=$(echo "$SEG" | cut -d: -f3)
    GRAPH="$GRAPH[0:v]trim=start=$S:end=$E,setpts=(PTS-STARTPTS)/$SP,fps=30[s$N];"
    LABELS="$LABELS[s$N]"; N=$((N + 1))
  done
  ffmpeg -y -loglevel error -i "$IN" -an \
    -filter_complex "${GRAPH}${LABELS}concat=n=$N:v=1:a=0,$LOOK[v]" -map "[v]" \
    -t "$LEN" -c:v libx264 -crf 18 -pix_fmt yuv420p -movflags +faststart "$OUT"
fi
FRAMES=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$OUT")
echo "wrote $OUT ($FRAMES frames) -> SITES: { clip: \"$NAME\", frames: $FRAMES, ... }"
