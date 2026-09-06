"""Original 132 BPM tactile hole-game groove. No sampled reference audio.

Run: python scripts/generate-music.py [output_directory]
Requires numpy, scipy, ffmpeg. Writes music.mp3, a PCM master and diagnostics.
"""
import json
import math
import subprocess
import sys
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

ROOT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent
ROOT.mkdir(parents=True, exist_ok=True)
SR = 44100
BPM = 132
BEAT = 60 / BPM
BARS = 16
N = round(BARS * 4 * BEAT * SR)
RNG = np.random.default_rng(260906)
drums = np.zeros((N, 2))
tones = np.zeros((N, 2))
accents = np.zeros((N, 2))


def times(duration):
    return np.arange(round(duration * SR)) / SR


def hz(note):
    return 440 * 2 ** ((note - 69) / 12)


def edge(signal, attack=.0015, release=.009):
    a = min(round(attack * SR), len(signal) // 2)
    r = min(round(release * SR), len(signal) // 2)
    signal[:a] *= np.sin(np.linspace(0, np.pi / 2, a)) ** 2
    signal[-r:] *= np.cos(np.linspace(0, np.pi / 2, r)) ** 2
    return signal


def noise(duration, low, high):
    raw = RNG.normal(0, 1, len(times(duration)))
    return sosfilt(butter(2, [low, high], fs=SR, btype='bandpass', output='sos'), raw)


def add(target, signal, beat, gain=1, pan=0):
    # Place tails across the boundary rather than fading the entire loop.
    idx = (np.arange(len(signal)) + round(beat * BEAT * SR)) % N
    theta = (pan + 1) * np.pi / 4
    target[idx, 0] += signal * gain * np.cos(theta)
    target[idx, 1] += signal * gain * np.sin(theta)


def kick():
    t = times(.225)
    phase = 2 * np.pi * (53 * t + 101 * .019 * (1 - np.exp(-t / .019)))
    body = np.sin(phase) * np.exp(-t * 18)
    body += .18 * np.sin(phase * 2) * np.exp(-t * 38)
    tick = noise(.225, 750, 3400) * np.exp(-t * 185)
    return edge(np.tanh(body * 1.32) * .8 + tick * .09, .0005)


def snap():
    t = times(.105)
    # A compact finger snap / plastic click, no long snare or metallic wash.
    body = .34 * np.sin(2 * np.pi * 680 * t) * np.exp(-t * 65)
    burst = noise(.105, 1000, 7200) * np.exp(-t * 53)
    return edge(body + burst * .8, .0006)


def tick(opened=False):
    duration = .11 if opened else .043
    t = times(duration)
    grain = noise(duration, 4300, 11500) * np.exp(-t * (28 if opened else 96))
    return edge(grain, .0005, .008)


def plop(note=69):
    t = times(.074)
    base = hz(note)
    phase = 2 * np.pi * (base * t + base * .7 * .012 * (1 - np.exp(-t / .012)))
    return edge(np.sin(phase) * np.exp(-t * 58), .0008)


def rubber(note, duration=.17):
    t = times(duration)
    f = hz(note)
    # Fast falling pitch and decaying odd harmonics give an elastic suction pulse.
    phase = 2 * np.pi * (f * t + f * .16 * .014 * (1 - np.exp(-t / .014)))
    timbre = np.sin(phase) + .36 * np.sin(phase * 2) * np.exp(-t * 10)
    timbre += .20 * np.sin(phase * 3) * np.exp(-t * 16)
    timbre += .085 * np.sin(phase * 5) * np.exp(-t * 23)
    envelope = np.exp(-t * 6) * np.minimum(t / .004, 1)
    return edge(np.tanh(timbre * 1.25) * envelope, .001, .022)


def blip(note, duration=.135):
    t = times(duration)
    phase = 2 * np.pi * hz(note) * t
    # Rounded gated synth rather than bell, marimba, piano or jazz chords.
    fm = .9 * np.sin(phase * 2) * np.exp(-t * 18)
    wave = np.sin(phase + fm) + .16 * np.sin(phase * 3)
    return edge(wave * np.exp(-t * 15), .0025, .016)


def suction(duration=.42, octave=0):
    t = times(duration)
    u = t / duration
    f = (180 + 830 * u ** 2) * 2 ** octave
    phase = 2 * np.pi * np.cumsum(f) / SR
    flutter = .7 + .3 * np.sin(2 * np.pi * (12 * t + 32 * t * t))
    air = noise(duration, 500, 5000)
    envelope = np.sin(np.pi * u / 2) ** 2
    result = (.16 * np.sin(phase) + .55 * air) * flutter * envelope
    return edge(result, .04, .018)


# D-minor, deliberately short hook with 16th-note holes for gameplay SFX.
roots = [38, 38, 38, 36, 38, 38, 41, 36, 38, 38, 38, 36, 38, 41, 43, 36]
motifs = [
    [(.5, 74), (1.25, 74), (2.5, 81)],
    [(.75, 77), (2.25, 74), (3.5, 72)],
    [(.5, 74), (1.25, 74), (2.5, 79), (3.25, 77)],
    [(.75, 72), (1.5, 69)],
]
kicks = []
for bar in range(BARS):
    at = 4 * bar
    release_bar = bar % 4 == 0
    fill_bar = bar % 4 == 3
    # Solid pulse with a tiny pickup, not busy festival EDM.
    for beat in [0, 1, 2, 3]:
        gain = .65 if beat in [0, 2] else .54
        add(drums, kick(), at + beat, gain)
        kicks.append(at + beat)
    if bar % 4 == 2:
        add(drums, kick(), at + 3.75, .24)
        kicks.append(at + 3.75)
    for beat in [1, 3]:
        add(drums, snap(), at + beat, .20, .03)
    for step in range(8):
        beat = step * .5 + (.025 if step % 2 else 0)
        add(drums, tick(opened=step == 7 and not fill_bar), at + beat,
            .085 if step % 2 else .037, .28 if step % 2 else -.24)
    for beat, note, gain in [(1.75, 67, .13), (2.75, 74, .10), (3.5, 62, .14)]:
        add(drums, plop(note + (2 if bar % 2 else 0)), at + beat, gain,
            -.3 if beat < 2 else .3)
    for beat, interval, duration in [(.5, 0, .17), (1.25, 0, .15),
            (1.75, 12, .11), (2.5, 0, .17), (3.25, 7, .12)]:
        if fill_bar and beat > 2.5:
            continue
        add(tones, rubber(roots[bar] + interval, duration), at + beat, .43)
    motif = motifs[bar % 4]
    for beat, note in motif:
        # A slight octave answer marks the second eight bars without dense harmony.
        if bar >= 8 and bar % 4 == 2 and beat == 3.25:
            note += 12
        add(tones, blip(note), at + beat, .12, -.15)
        add(tones, blip(note), at + beat + .375, .026, .30)
    if release_bar:
        add(accents, rubber(roots[bar] - 12, .35), at, .16)
        add(accents, blip(86, .16), at + .25, .045, .25)
    if fill_bar:
        # Brief inhale and ascending pixel taps into each 4-bar release.
        add(accents, suction(.43, -.2), at + 3.02, .11, -.12)
        for i, beat in enumerate([3.25, 3.5, 3.75]):
            add(accents, plop(65 + i * 5), at + beat, .09 + i * .015,
                (i - 1) * .3)

# Small rhythm-locked low-end duck leaves the kick dry and readable.
duck = np.ones(N)
for beat in kicks:
    t = times(.145)
    idx = (np.arange(len(t)) + round(beat * BEAT * SR)) % N
    duck[idx] = np.minimum(duck[idx], 1 - .56 * np.exp(-t * 30))
tones *= duck[:, None]
mix = drums + tones + accents
mix += np.roll(accents[:, ::-1], round(BEAT * .75 * SR), axis=0) * .16
mix = np.tanh(mix * 1.12)
mix -= np.mean(mix, axis=0)
mix *= .79 / np.max(np.abs(mix))

master = ROOT / 'hole-groove-master.wav'
wavfile.write(master, SR, np.round(mix * 32767).astype(np.int16))
subprocess.run(['ffmpeg', '-v', 'error', '-nostdin', '-y', '-i', str(master),
                '-c:a', 'libmp3lame', '-b:a', '128k', '-write_xing', '1',
                str(ROOT / 'music.mp3')], check=True)
decoded = ROOT / 'decoded-check.wav'
subprocess.run(['ffmpeg', '-v', 'error', '-nostdin', '-y', '-i', str(ROOT/'music.mp3'),
                '-c:a', 'pcm_f32le', str(decoded)], check=True)
rate, check = wavfile.read(decoded)
assert rate == SR
assert len(check) == N
assert (ROOT / 'music.mp3').stat().st_size < 500_000
assert float(np.max(np.abs(check))) < 1

metrics = {
    'title': 'Pixel Suction Groove', 'composition': 'Original D-minor percussion/bass hook',
    'bpm': BPM, 'bars': BARS, 'durationSeconds': N / SR,
    'sampleRate': SR, 'channels': 2, 'bytes': (ROOT/'music.mp3').stat().st_size,
    'masterPeak': float(np.max(np.abs(mix))),
    'decodedPeak': float(np.max(np.abs(check))),
    'decodedRMS': float(np.sqrt(np.mean(check * check))),
    'masterBoundaryStep': np.abs(mix[0] - mix[-1]).tolist(),
    'decodedBoundaryStep': np.abs(check[0] - check[-1]).tolist(),
    'decodedLargestSampleStep': float(np.max(np.abs(np.diff(check, axis=0)))),
    'decodedSamples': len(check), 'expectedSamples': N,
    'audition': 'No subjective playback or device listening claimed; signal/decoding checks only.',
    'integration': 'Replace only music.mp3. AudioBuffer loop uses entire decoded buffer. Preserve SFX.',
}
(ROOT/'music-metrics.json').write_text(json.dumps(metrics, indent=2)+'\n')
print(json.dumps(metrics, indent=2))
