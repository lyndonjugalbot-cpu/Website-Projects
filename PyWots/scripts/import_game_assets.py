#!/usr/bin/env python3
"""Import the PyWots Game asset pack (the Drive folder: 01_Hero, 02_Mobs, ...)
into public/game/ as WebP + one manifest.json that Game Mode reads at runtime.

    python3 scripts/import_game_assets.py /path/to/drive-folder

Only the 1x art is used (the game draws in 1x world units). Needs `cwebp`
(brew install webp). Re-run it whenever the pack changes; it rewrites
public/game/ from scratch.
"""
import json, os, re, shutil, struct, subprocess, sys

SRC = sys.argv[1] if len(sys.argv) > 1 else sys.exit(__doc__)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "game")
QUALITY = "84"


def png_size(path):
    with open(path, "rb") as f:
        head = f.read(24)
    return struct.unpack(">II", head[16:24])


def webp(src, rel):
    dst = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    subprocess.run(["cwebp", "-quiet", "-q", QUALITY, "-alpha_q", "90", "-m", "6", src, "-o", dst], check=True)
    return "/game/" + rel


def image(src, rel):
    w, h = png_size(src)
    return {"src": webp(src, rel), "w": w, "h": h}


def anim(sheet, atlas, rel):
    """Atlas JSON (TexturePacker-style hash) -> {src, w, h, px, py, f, d[, ta]}."""
    with open(atlas) as fh:
        frames = json.load(fh)["frames"]
    if isinstance(frames, list):  # array flavour (FX): {name, frame, pivot, duration_ms}
        frames = {f["name"] + ".png": {**f, "duration": f.get("duration_ms", 100)} for f in frames}
    keys = sorted(frames, key=lambda k: int(re.search(r"_(\d+)\.png$", k).group(1)))
    first = frames[keys[0]]
    out = {
        "src": webp(sheet, rel),
        "w": first["frame"]["w"], "h": first["frame"]["h"],
        "px": first.get("pivot", {}).get("x", 0.5), "py": first.get("pivot", {}).get("y", 0),
        "f": [[frames[k]["frame"]["x"], frames[k]["frame"]["y"]] for k in keys],
        "d": [frames[k].get("duration", 100) for k in keys],
    }
    if "threadAttach" in first:  # Indent Spider: thread drawn in code
        out["ta"] = [[frames[k]["threadAttach"]["x"], frames[k]["threadAttach"]["y"]] for k in keys]
    return out


def p(*parts):
    return os.path.join(SRC, *parts)


shutil.rmtree(OUT, ignore_errors=True)
os.makedirs(OUT)
M = {"hero": {}, "mobs": {}, "bosses": {}, "bg": {}, "arenas": {}, "tiles": {}, "layers": {}, "props": {}, "items": {}, "fx": {}}

# hero
for a in ["idle", "walk", "run", "attack", "cast", "cast_projectile", "cast_impact", "hurt", "death",
          "jump_takeoff", "jump_rise", "jump_apex", "jump_fall", "jump_land"]:
    M["hero"][a] = anim(p("01_Hero", f"pywots_hero_{a}_sheet.png"), p("01_Hero", f"pywots_hero_{a}_atlas.json"), f"hero/{a}.webp")

# mobs: only the ones with a full move set (idle/attack/special/hurt/death), plus the spawned child
for mob in sorted(os.listdir(p("02_Mobs"))):
    d = p("02_Mobs", mob)
    moves = {}
    for f in sorted(os.listdir(d)):
        m = re.match(rf"pywots_mob_{mob}_([a-z]+)_sheet\.png$", f)
        if m:
            mv = m.group(1)
            moves[mv] = anim(os.path.join(d, f), os.path.join(d, f"pywots_mob_{mob}_{mv}_atlas.json"), f"mobs/{mob}/{mv}.webp")
    if {"idle", "attack", "hurt", "death"} <= moves.keys():
        M["mobs"][mob] = moves
    else:
        shutil.rmtree(os.path.join(OUT, "mobs", mob), ignore_errors=True)

# bosses: concept stills (bottom-centre pivot) + the animated Slime King idle
for f in sorted(os.listdir(p("03_Bosses"))):
    m = re.match(r"pywots_boss_([a-z_]+?)_still_v\d\.png$", f)
    if m:
        M["bosses"][m.group(1)] = {"still": image(p("03_Bosses", f), f"bosses/{m.group(1)}.webp")}
M["bosses"]["slime_king"]["idle"] = anim(p("03_Bosses", "pywots_boss_slime_king_idle_sheet.png"),
                                          p("03_Bosses", "pywots_boss_slime_king_idle_atlas.json"), "bosses/slime_king_idle.webp")
with open(p("03_Bosses", "pywots_boss_bone_colossus_still_v2.json")) as fh:
    M["bosses"]["bone_colossus"]["meta"] = json.load(fh)
for v in ["rot", "rot_flipped"]:
    M["bosses"]["bone_colossus"][f"overlay_{v}"] = image(
        p("03_Bosses", "overlays", f"pywots_boss_bone_colossus_overlay_smash_{v}.png"), f"bosses/bone_colossus_overlay_{v}.webp")

# environments
bgdir = p("04_Environments", "Backgrounds")
for f in sorted(os.listdir(bgdir)):
    m = re.match(r"pywots_bg_(env\d\d)_[a-z_]+\.png$", f)
    if m:
        M["bg"][m.group(1)] = image(os.path.join(bgdir, f), f"env/bg_{m.group(1)}.webp")
for boss in ["slime_king", "bone_colossus"]:
    d = p("04_Environments", "Arenas", boss)
    with open(os.path.join(d, f"pywots_arena_{boss}.json")) as fh:
        meta = json.load(fh)
    M["arenas"][boss] = {**image(os.path.join(d, f"pywots_arena_{boss}_bg.png"), f"env/arena_{boss}.webp"),
                         "hero": meta.get("hero_spawn_x_1x", 300), "boss": meta.get("boss_spawn_x_1x", 955)}
for s in ["crypt", "bone"]:
    t = p("04_Environments", "Tiles", s)
    M["tiles"][s] = {
        "top": image(os.path.join(t, f"pywots_tile_{s}_floor_top_strip.png"), f"env/{s}_floor_top.webp"),
        "fill": image(os.path.join(t, f"pywots_tile_{s}_floor_fill_strip.png"), f"env/{s}_floor_fill.webp"),
    }
    lay = p("04_Environments", "Layers", s)
    mid = [f for f in os.listdir(lay) if "_mid_" in f][0]
    fg = [f for f in os.listdir(lay) if "_fg_" in f][0]
    M["layers"][s] = {"mid": image(os.path.join(lay, mid), f"env/{s}_mid.webp"),
                      "fg": image(os.path.join(lay, fg), f"env/{s}_fg.webp")}
    pd = p("04_Environments", "Props", s)
    M["props"][s] = {}
    for f in sorted(os.listdir(pd)):
        m = re.match(rf"pywots_prop_{s}_([a-z_]+)\.png$", f)
        if m and not m.group(1).endswith("_wet"):
            name = m.group(1)
            M["props"][s][name] = {**image(os.path.join(pd, f), f"env/props_{s}_{name}.webp"),
                                   "hang": name in ("moss_curtain", "hanging_cage")}

# items + fx
for it in ["hp_potion", "code_key", "code_scroll"]:
    M["items"][it] = anim(p("06_Items", "Pickups", f"pywots_item_{it}_sheet.png"),
                          p("06_Items", "Pickups", f"pywots_item_{it}_atlas.json"), f"items/{it}.webp")
M["fx"]["rune_glow"] = anim(p("05_FX", "pywots_fx_rune_hello_glow_sheet.png"), p("05_FX", "pywots_fx_rune_hello_glow_atlas.json"), "fx/rune_glow.webp")

with open(os.path.join(OUT, "manifest.json"), "w") as fh:
    json.dump(M, fh, separators=(",", ":"))

total = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(OUT) for f in fs)
print(f"public/game: {total / 1e6:.1f} MB, {len(M['mobs'])} mobs, {len(M['bosses'])} bosses, {len(M['bg'])} backgrounds")
