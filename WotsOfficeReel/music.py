"""Original backing track + sound effects for the Wots Office reel.

Everything is synthesised here with numpy, so the audio is ours to use (no
licensing). 120 BPM: one bar = 2 s, which lines up with the scene cuts in
reel.html (hook 0-4, brand 4-10, work 10-25, steps 25-30, CTA 30-35).

    python3 music.py            -> out/music.wav (stereo, 44.1 kHz, 33 s)
"""
import os
import wave

import numpy as np

SR = 44100
DUR = 35.0
BPM = 120
BEAT = 60 / BPM
BAR = 4 * BEAT
N = int(SR * DUR)
rng = np.random.default_rng(7)

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def t_axis(n):
    return np.arange(n) / SR


def fft_filter(x, lo=None, hi=None, slope=4):
    """Smooth band-pass in the frequency domain (lo/hi in Hz, None = open)."""
    n = len(x)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    g = np.ones_like(f)
    if hi:
        g *= 1 / (1 + (f / hi) ** (2 * slope))
    if lo:
        g *= 1 / (1 + (lo / np.maximum(f, 1e-3)) ** (2 * slope))
    return np.fft.irfft(X * g, n)


def env_adsr(n, a, d, s, r, hold):
    """ADSR envelope of n samples; times in seconds, hold = note length before release."""
    t = t_axis(n)
    e = np.where(t < a, t / max(a, 1e-4), 0.0)
    dec = (t >= a) & (t < a + d)
    e = np.where(dec, 1 - (1 - s) * (t - a) / max(d, 1e-4), e)
    e = np.where((t >= a + d) & (t < hold), s, e)
    rel = t >= hold
    e = np.where(rel, s * np.exp(-(t - hold) / max(r, 1e-4) * 5), e)
    return e


def saw(freq, n, detune=0.0, phase=0.0):
    t = t_axis(n)
    return 2 * ((t * freq * (1 + detune) + phase) % 1.0) - 1


def place(bus, sig, start, gain=1.0):
    i = int(start * SR)
    if i >= len(bus):
        return
    j = min(len(bus), i + len(sig))
    bus[i:j] += sig[: j - i] * gain


def reverb(x, secs=1.6, mix=0.25):
    n = int(secs * SR)
    ir = rng.standard_normal(n) * np.exp(-t_axis(n) / secs * 6)
    ir = fft_filter(ir, lo=200, hi=6000)
    ir /= np.sqrt(np.sum(ir**2))
    L = len(x) + n
    wet = np.fft.irfft(np.fft.rfft(x, L) * np.fft.rfft(ir, L), L)[: len(x)]
    return x * (1 - mix) + wet * mix


# ---------------------------------------------------------------- harmony
# Am - F - C - G (vi-IV-I-V in C), one chord per bar.
PROG = [
    [57, 60, 64, 69],  # Am
    [53, 57, 60, 65],  # F
    [55, 60, 64, 67],  # C (voiced around G3)
    [55, 59, 62, 67],  # G
]
BASS = [45, 41, 48, 43]  # A1 F1 C2 G1
bars = int(np.ceil(DUR / BAR))

pads = np.zeros(N)
bass = np.zeros(N)
pluck = np.zeros(N)
drums = np.zeros(N)
sfx = np.zeros(N)

# ---------------------------------------------------------------- pads
for b in range(bars):
    chord = PROG[b % 4]
    n = int(BAR * SR) + int(1.2 * SR)
    e = env_adsr(n, 0.35 if b == 0 else 0.08, 0.6, 0.75, 0.9, BAR)
    sig = np.zeros(n)
    for m in chord:
        f = mtof(m)
        sig += saw(f, n, -0.004) + saw(f, n, 0.005, 0.3) + 0.5 * saw(f * 2, n, 0.002, 0.6)
    # brighter after the drop
    sig = fft_filter(sig, lo=120, hi=1400 if b < 2 else 2600, slope=2)
    place(pads, sig * e, b * BAR, 0.075)

# ---------------------------------------------------------------- bass (8ths, from the drop)
for b in range(2, bars):
    root = mtof(BASS[b % 4])
    for k in range(8):
        n = int(BEAT / 2 * SR)
        t = t_axis(n)
        sig = 0.7 * np.sign(np.sin(2 * np.pi * root * t)) + 0.6 * np.sin(2 * np.pi * root * t)
        sig += 0.4 * np.sin(2 * np.pi * root * 2 * t)
        e = np.exp(-t * 7) * np.minimum(1, t * 400)
        place(bass, sig * e, b * BAR + k * BEAT / 2)
bass = fft_filter(bass, lo=35, hi=420, slope=3) * 0.17

# ---------------------------------------------------------------- arpeggio plucks
ARP = [0, 1, 2, 3, 2, 1, 3, 2]
for b in range(bars):
    t0 = b * BAR
    chord = PROG[b % 4]
    step = BEAT / 2 if t0 < 10 else BEAT / 4  # 8ths, then 16ths for the showcase
    count = int(BAR / step)
    for k in range(count):
        st = t0 + k * step
        if 29.0 <= st < 30.0:
            continue  # breath before the CTA
        m = chord[ARP[k % 8]] + 12
        n = int(0.32 * SR)
        t = t_axis(n)
        f = mtof(m)
        sig = (2 * ((t * f) % 1) - 1) * 0.6 + np.sin(2 * np.pi * f * t)
        sig *= np.exp(-t * 14) * np.minimum(1, t * 800)
        place(pluck, sig, st, 0.7 if st < 10 else 0.55)
pluck = fft_filter(pluck, lo=250, hi=4200, slope=2)

# ---------------------------------------------------------------- drums
def kick():
    n = int(0.45 * SR)
    t = t_axis(n)
    f = 45 + 95 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t * 7.5)
    s += 0.25 * fft_filter(rng.standard_normal(n), lo=1500, hi=6000) * np.exp(-t * 120)
    return s


def clap():
    n = int(0.3 * SR)
    t = t_axis(n)
    noise = fft_filter(rng.standard_normal(n), lo=900, hi=3500)
    e = np.zeros(n)
    for off in (0.0, 0.011, 0.022):
        e += np.where(t >= off, np.exp(-(t - off) * 60), 0) * 0.6
    e += np.where(t >= 0.03, np.exp(-(t - 0.03) * 14), 0)
    return noise * e


def hat(open_=False):
    n = int((0.22 if open_ else 0.06) * SR)
    t = t_axis(n)
    return fft_filter(rng.standard_normal(n), lo=7000) * np.exp(-t * (18 if open_ else 70))


K, C, H, HO = kick(), clap(), hat(), hat(True)
duck = np.ones(N)  # sidechain envelope for pads/bass/plucks
for b in range(2, bars):
    for q in range(4):
        st = b * BAR + q * BEAT
        if st >= 34.0:
            break
        if 29.0 <= st < 30.0 and q >= 2:
            continue
        place(drums, K, st, 0.45)
        i = int(st * SR)
        n = int(0.3 * SR)
        t = t_axis(n)
        j = min(N, i + n)
        duck[i:j] = np.minimum(duck[i:j], (1 - 0.55 * np.exp(-t * 12))[: j - i])
        place(drums, HO, st + BEAT / 2, 0.16)
        place(drums, H, st + BEAT / 4, 0.07)
        place(drums, H, st + 3 * BEAT / 4, 0.07)
        if st >= 8 and q in (1, 3):
            place(drums, C, st, 0.26)
# snare-ish roll into the CTA
for k in range(8):
    place(drums, C, 29.0 + k * BEAT / 4, 0.12 + 0.05 * k)
# ticking hats in the intro
for k in range(8):
    place(drums, H, k * BEAT, 0.05)

# ---------------------------------------------------------------- sound effects
def riser(secs):
    n = int(secs * SR)
    t = t_axis(n)
    f = 180 * (1 + 7 * (t / secs) ** 2)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.25
    noise = fft_filter(rng.standard_normal(n), lo=1500)
    return (tone + noise * 0.6) * (t / secs) ** 2.2


def impact():
    n = int(1.6 * SR)
    t = t_axis(n)
    boom = np.sin(2 * np.pi * (40 + 40 * np.exp(-t * 10)).cumsum() / SR) * np.exp(-t * 2.6)
    crash = fft_filter(rng.standard_normal(n), lo=3000) * np.exp(-t * 3.5) * 0.35
    return boom + crash


def whoosh(secs=0.5):
    n = int(secs * SR)
    t = t_axis(n)
    bell = np.sin(np.pi * t / secs) ** 2
    return fft_filter(rng.standard_normal(n), lo=400, hi=3000, slope=2) * bell


def tick():
    n = int(0.04 * SR)
    t = t_axis(n)
    return fft_filter(rng.standard_normal(n), lo=2000, hi=8000) * np.exp(-t * 160)


def pop(f0=700):
    n = int(0.16 * SR)
    t = t_axis(n)
    f = f0 * (1 + 0.6 * np.minimum(1, t / 0.05))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 30) * np.minimum(1, t * 600)


def click():
    n = int(0.05 * SR)
    t = t_axis(n)
    return (fft_filter(rng.standard_normal(n), lo=1200, hi=6000) * np.exp(-t * 200) + np.sin(2 * np.pi * 1800 * t) * np.exp(-t * 120) * 0.5)


place(sfx, riser(1.6), 2.4, 0.22)
place(sfx, impact(), 4.0, 0.32)
place(sfx, riser(1.0), 29.0, 0.2)
place(sfx, impact(), 30.0, 0.3)
for ts in (3.6, 9.6, 24.6):  # scene exits
    place(sfx, whoosh(), ts - 0.05, 0.22)
TYPED = "barber near me"
for k in range(1, len(TYPED) + 1):  # one key click per typed character (reel.html: 1.45 s + 0.8 s)
    place(sfx, tick(), 1.45 + k * 0.8 / len(TYPED) - 0.02, 0.35)
for ts in (0.15, 0.45):
    place(sfx, pop(520), ts, 0.25)
for ts in (6.15, 6.25, 6.35, 6.45, 6.55, 25.6, 26.6, 27.6):  # service cards, then the three steps
    place(sfx, pop(760), ts, 0.22)
for ts in (10.6, 13.45, 16.3, 19.15, 22.0):  # showcase item changes (reel.html SHOW_START / SHOW_EACH)
    place(sfx, whoosh(0.35), ts - 0.05, 0.14)
place(sfx, click(), 33.05, 0.6)
place(sfx, pop(980), 33.1, 0.2)

# ---------------------------------------------------------------- mix
pads = reverb(pads * duck, 2.2, 0.35)
pluck = reverb(pluck * duck, 1.4, 0.3)
bass = bass * duck
music = pads + bass + pluck + drums
# end: let the last chord ring out
t = t_axis(N)
fade = np.where(t > 33.6, np.clip(1 - (t - 33.6) / 1.4, 0, 1) ** 1.5, 1)
music *= fade

L = music + sfx
R = music.copy()
# light stereo: pads/plucks slightly delayed on the right, sfx centred
d = int(0.011 * SR)
R[d:] = (pads + pluck)[:-d] * fade[d:] + (bass + drums)[d:] * fade[d:]
R += sfx

mix = np.stack([L, R], axis=1)
mix = np.tanh(mix * 1.0) / np.tanh(1.0)
mix *= 0.89 / np.max(np.abs(mix))  # about -1 dBFS peak

os.makedirs(OUT, exist_ok=True)
with wave.open(os.path.join(OUT, "music.wav"), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype("<i2").tobytes())
print("wrote out/music.wav", f"{DUR:.1f}s")
