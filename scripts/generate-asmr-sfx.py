"""Original deterministic ASMR voxel fall textures; no recorded or reference samples.

Run: python scripts/generate-asmr-sfx.py dist/audio
Only replaces gulp-1/2/3.wav and crumble.wav. Requires numpy and scipy.
"""
import argparse
import json
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt, welch

SR = 22050
NAMES = ('gulp-1.wav', 'gulp-2.wav', 'gulp-3.wav', 'crumble.wav')


def band(signal, low, high, order=3):
    return sosfilt(butter(order, (low, high), fs=SR, btype='bandpass', output='sos'), signal)


def taper(t, length, attack=.018, release=.095):
    a = np.sin(np.minimum(t / attack, 1) * np.pi / 2) ** 2
    b = np.sin(np.minimum((length - t) / release, 1) * np.pi / 2) ** 2
    return a * b


def grain(rng, length, timbre):
    t = np.arange(round(length * SR)) / SR
    # Small, overlapping grains use smooth windows instead of impulsive clicks.
    window = np.sin(np.pi * t / length) ** (1.7 + rng.uniform(0, .8))
    rough = band(rng.normal(size=len(t)), 620, 2650)
    smooth = band(rng.normal(size=len(t)), 480, 1550)
    f = rng.uniform(1050, 1830) * timbre
    # Very quiet, short ceramic modes: no low bass body or pitch dives.
    ceramic = (np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28))
               + .32 * np.sin(2 * np.pi * f * 1.47 * t))
    return window * (.64 * rough + .31 * smooth + .045 * ceramic)


def texture(duration, seed, timbre=1, crumble=False):
    rng = np.random.default_rng(seed)
    t = np.arange(round(duration * SR)) / SR
    output = np.zeros(len(t))
    # Soft brushing joins the grains into a continuous fine-sand settling texture.
    brush = band(rng.normal(size=len(t)), 510, 2150)
    envelope = np.interp(t, np.linspace(0, duration, 12), rng.uniform(.25, .65, 12))
    output += .09 * brush * envelope
    count = 64 if crumble else 29
    starts = rng.uniform(-.02, duration - .035, count)
    for start in np.sort(starts):
        length = rng.uniform(.026, .070 if crumble else .057)
        source = grain(rng, length, timbre)
        amplitude = rng.uniform(.11, .23) * (1 - .48 * max(0, start) / duration)
        first = round(start * SR)
        begin = max(first, 0)
        offset = max(-first, 0)
        count = min(len(source) - offset, len(output) - begin)
        output[begin:begin + count] += source[offset:offset + count] * amplitude
    # Steep low-end rejection prevents overlapping sounds from forming a thump.
    output = band(output, 450, 3450, order=5)
    output *= taper(t, duration, .019 if crumble else .017, .17 if crumble else .105)
    output[0] = output[-1] = 0
    return output


def metrics(path):
    rate, pcm = wavfile.read(path)
    audio = pcm.astype(float) / 32768
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    f, psd = welch(audio, rate, nperseg=min(4096, len(audio)))
    total = psd.sum()
    return {
        'sample_rate': rate,
        'seconds': round(len(audio) / rate, 4),
        'peak': round(float(np.max(np.abs(audio))), 5),
        'rms': round(float(np.sqrt(np.mean(audio ** 2))), 5),
        'energy_below_250_hz_percent': round(float(psd[f < 250].sum() / total * 100), 5),
        'energy_450_4500_hz_percent': round(float(psd[(f >= 450) & (f <= 4500)].sum() / total * 100), 3),
        'energy_above_4500_hz_percent': round(float(psd[f > 4500].sum() / total * 100), 5),
        'bytes': path.stat().st_size,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('output', type=Path)
    parser.add_argument('--baseline', type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    report = {'generation': 'Original band-limited granular synthesis, no sampled material',
              'suggested_gains': {'gulp': [.48, .58], 'crumble': [.26, .34]},
              'suggested_interval_seconds': {'gulp': .16, 'crumble': .48},
              'assets': {}}
    baseline = ({name: metrics(args.baseline / name) for name in NAMES}
                if args.baseline else {})
    for i, (name, duration, target, timbre) in enumerate([
        ('gulp-1.wav', .265, .26, .97),
        ('gulp-2.wav', .280, .25, 1.04),
        ('gulp-3.wav', .250, .255, 1.0),
        ('crumble.wav', .540, .23, .95),
    ]):
        audio = texture(duration, 260906 + i * 51, timbre, name == 'crumble.wav')
        audio *= target / np.max(np.abs(audio))
        path = args.output / name
        wavfile.write(path, SR, np.round(audio * 32767).astype(np.int16))
        report['assets'][name] = {'new': metrics(path)}
        if name in baseline:
            report['assets'][name]['baseline'] = baseline[name]
    (args.output / 'asmr-sfx-metrics.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
