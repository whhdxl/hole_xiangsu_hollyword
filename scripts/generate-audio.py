"""Original, deterministic soundtrack for Los Angeles Voxel Escape.

No reference audio is sampled. Requires numpy, scipy and ffmpeg.
Run: python scripts/generate-audio.py [output_directory]
Then run scripts/generate-music.py and scripts/generate-asmr-sfx.py with the same directory for the current music and falling textures.
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
BPM = 120
BEAT = 60 / BPM
LOOP_SECONDS = 32
N = round(LOOP_SECONDS * SR)
RNG = np.random.default_rng(260905)
mix = np.zeros((N, 2), dtype=np.float64)


def hz(note):
    return 440 * 2 ** ((note - 69) / 12)


def times(seconds):
    return np.arange(round(seconds * SR)) / SR


def edge(signal, seconds=.004):
    n = min(round(seconds * SR), len(signal) // 2)
    signal[:n] *= np.linspace(0, 1, n) ** 2
    signal[-n:] *= np.linspace(1, 0, n) ** 2
    return signal


def pluck(note, seconds=.65, color=1):
    t = times(seconds)
    f = hz(note)
    # Rounded wooden fundamental, brief inharmonic tine, gentle upper partial.
    signal = np.sin(2 * np.pi * f * t) * np.exp(-t * 7.5)
    signal += .30 * np.sin(2 * np.pi * f * 3.98 * t) * np.exp(-t * 29)
    signal += .07 * color * np.sin(2 * np.pi * f * 7.03 * t) * np.exp(-t * 48)
    return edge(signal, .003)


def bell(note, seconds=1.0):
    t = times(seconds)
    f = hz(note)
    signal = np.sin(2 * np.pi * f * t) * np.exp(-t * 4.8)
    signal += .22 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 9)
    signal += .10 * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t * 13)
    return edge(signal, .004)


def keys(notes, seconds=.62):
    t = times(seconds)
    signal = np.zeros(len(t))
    for note in notes:
        f = hz(note)
        signal += (np.sin(2 * np.pi * f * t + .6 * np.sin(2 * np.pi * f * 2 * t)
                          * np.exp(-t * 9)) + .10 * np.sin(2 * np.pi * f * 3 * t))
    return edge(signal / len(notes) * np.exp(-t * 5.4), .007)


def bass(note, seconds=.39):
    t = times(seconds)
    f = hz(note)
    signal = (np.sin(2 * np.pi * f * t) + .26 * np.sin(2 * np.pi * 2 * f * t)
              + .07 * np.sin(2 * np.pi * 3 * f * t))
    return edge(signal * np.exp(-t * 5.6), .010)


def noise(seconds, low=400, high=6000):
    signal = RNG.normal(0, 1, round(seconds * SR))
    return sosfilt(butter(2, [low, high], fs=SR, btype='bandpass', output='sos'), signal)


def kick():
    t = times(.21)
    phase = 2 * np.pi * (48 * t + 72 * .026 * (1 - np.exp(-t / .026)))
    return edge(np.sin(phase) * np.exp(-t * 23), .002)


def rim():
    t = times(.11)
    signal = (.5 * np.sin(2 * np.pi * 1100 * t) + .20 * np.sin(2 * np.pi * 1760 * t))
    signal += .32 * noise(.11, 700, 6000)
    return edge(signal * np.exp(-t * 66), .001)


def shaker():
    t = times(.055)
    return edge(noise(.055, 3300, 9000) * np.exp(-t * 58), .002)


def add(signal, start, gain=1, pan=0):
    # Circular event placement includes tails from the preceding loop.
    idx = (np.arange(len(signal)) + round(start * SR)) % N
    a = (pan + 1) * np.pi / 4
    mix[idx, 0] += signal * gain * np.cos(a)
    mix[idx, 1] += signal * gain * np.sin(a)


chords = [
    [60,64,67,71], [59,62,67,69], [57,60,64,67], [57,60,64,65],
    [60,64,67,71], [59,62,64,67], [57,60,62,65], [59,62,65,67],
    [60,64,67,71], [59,62,67,69], [57,60,64,67], [57,60,64,65],
    [57,60,62,65], [59,62,65,67], [57,60,64,67], [59,62,65,67],
]
roots = [36,43,33,41,36,40,38,43,36,43,33,41,38,43,36,43]
melodies = [
    [(0,76),(.75,79),(1.5,81),(2.5,79),(3.25,76)],
    [(.5,74),(1.25,71),(2.5,74),(3.5,79)],
    [(0,76),(.75,79),(1.5,81),(2.75,84)],
    [(.25,81),(1,79),(2,76),(3,72)],
    [(0,76),(.75,79),(1.5,83),(2.5,81),(3.25,79)],
    [(.5,78),(1.25,76),(2.5,74)],
    [(0,77),(.75,76),(1.5,74),(2.75,72)],
    [(.5,74),(1.5,71),(2.75,74),(3.5,79)],
    [(0,76),(.75,79),(1.5,84),(2.5,83),(3.25,79)],
    [(.5,81),(1.25,79),(2.5,74),(3.5,71)],
    [(0,72),(.75,76),(1.5,79),(2.75,81)],
    [(.25,84),(1,81),(2,79),(3,76)],
    [(0,77),(.75,81),(1.5,84),(2.75,81)],
    [(.25,79),(1,77),(2,74),(3,71)],
    [(0,72),(.75,76),(1.5,79),(2.75,76)],
    [(.5,74),(1.5,71),(2.75,74),(3.5,71)],
]

for bar in range(16):
    start = bar * 4 * BEAT
    for beat, note in melodies[bar]:
        add(pluck(note), start + beat * BEAT, .29, -.12 if bar % 2 == 0 else .12)
    for beat, gain in [(.5,.12),(1.75,.09),(2.5,.13),(3.5,.08)]:
        add(keys(chords[bar]), start + beat * BEAT, gain, -.28)
    for beat, note in [(0,roots[bar]),(1.5,roots[bar]+7),(2,roots[bar]),(3.25,roots[bar]+12)]:
        add(bass(note), start + beat * BEAT, .23)
    for beat in [0,2]:
        add(kick(), start + beat * BEAT, .24)
    if bar % 4 == 3:
        add(kick(), start + 2.75 * BEAT, .10)
    for beat in [1,3]:
        add(rim(), start + beat * BEAT, .14, .06)
    for subdivision in range(8):
        add(shaker(), start + (subdivision*.5 + (.035 if subdivision%2 else 0))*BEAT,
            .075 if subdivision % 2 else .045, .35 if subdivision % 2 else -.35)
    if bar in [3,7,11,15]:
        add(bell(chords[bar][2] + 24), start + 3.5 * BEAT, .07, .28)

# A short stereo room, circular so there is no fade-to-silence at the seam.
dry = mix.copy()
for seconds, gain, swap in [(.093,.12,False),(.149,.085,True),(.237,.055,True),(.361,.035,False)]:
    mix += np.roll(dry[:, ::-1] if swap else dry, round(seconds * SR), axis=0) * gain
mix = np.tanh(mix * 1.10)
mix *= .73 / np.max(np.abs(mix))


def save_wav(name, signal, rate=SR, peak=.78):
    signal = np.asarray(signal)
    if rate != SR:
        from scipy.signal import resample_poly
        signal = resample_poly(signal, rate, SR, axis=0)
    signal = signal - np.mean(signal, axis=0)
    if name != 'city-loop-master.wav':
        edge(signal, .003)
    signal *= peak / max(1e-12, float(np.max(np.abs(signal))))
    wavfile.write(ROOT / name, rate, np.round(signal * 32767).astype(np.int16))


save_wav('city-loop-master.wav', mix, peak=.73)
subprocess.run(['ffmpeg','-v','error','-nostdin','-y','-i',str(ROOT/'city-loop-master.wav'),
                '-c:a','libmp3lame','-b:a','96k','-write_xing','1',
                str(ROOT/'music.mp3')], check=True)
assert (ROOT/'music.mp3').stat().st_size > 10000


def soundmix(seconds):
    return np.zeros(round(seconds * SR))


def put(target, signal, at, gain=1):
    start = round(at * SR)
    n = min(len(signal), len(target)-start)
    target[start:start+n] += signal[:n] * gain


for variant, scale in enumerate([1,.89,1.14], 1):
    t = times(.24)
    # A friendly hollow plop with a descending suction pitch, no harsh impact.
    frequency = (95 + 420*np.exp(-t*27)) * scale
    phase = 2*np.pi*np.cumsum(frequency)/SR
    signal = np.sin(phase)*np.exp(-t*19)*(1-np.exp(-t*550))
    signal += .10*np.sin(phase*2)*np.exp(-t*36)
    signal += .15*noise(.24,350,2100)*np.exp(-t*24)
    save_wav(f'gulp-{variant}.wav', edge(signal), 22050, .75)

signal = soundmix(.36)
for at, f, gain in [(0,860,.55),(.033,1350,.43),(.078,610,.34),(.125,1100,.23),(.19,730,.14)]:
    t = times(.095)
    grain = (noise(.095,600,5800)*.7+np.sin(2*np.pi*f*t)*.25)*np.exp(-t*57)
    put(signal,edge(grain,.001),at,gain)
save_wav('crumble.wav',edge(signal),22050,.70)

signal = soundmix(1.16)
for i,note in enumerate([72,76,79,84]):
    put(signal,bell(note,.88),i*.085,.54+i*.055)
put(signal,keys([72,76,79,84],.75),.26,.35)
t=times(.24)
rise=np.sin(2*np.pi*(340*t+1100*t*t))*np.sin(np.pi*t/.24)**2
put(signal,rise,0,.085)
save_wav('upgrade.wav',edge(signal,.03),22050,.81)

signal=soundmix(2.10)
for at,note in [(0,76),(.13,79),(.26,84),(.50,88),(.72,86),(.96,84)]:
    put(signal,bell(note,1.08),at,.49)
put(signal,keys([60,64,67,72],1.1),.96,.49)
put(signal,bass(36,.8),.96,.35)
save_wav('complete.wav',edge(signal,.035),22050,.80)

t=times(.075)
signal=(np.sin(2*np.pi*680*t)+.23*np.sin(2*np.pi*1360*t))*np.exp(-t*80)
save_wav('click.wav',edge(signal,.001),22050,.55)

manifest={'bpm':BPM,'loopSeconds':LOOP_SECONDS,'composition':'Original C-major 16-bar loop',
          'suggestedGains':{'music':.30,'gulp':.42,'crumble':.18,'upgrade':.52,'complete':.56,'click':.28},
          'notes':['Start/resume AudioContext only after a user gesture.',
                   'Use decoded AudioBuffer looping at 0–32 s for music.',
                   'Limit gulp triggers to 1 per 65–85 ms; randomly vary the three files.',
                   'Limit crumble to 1 per 140 ms and prioritize upgrade/completion.',
                   'Briefly duck music to 60 percent during upgrade/completion.'],
          'assets':{}}
for name in ['city-loop-master.wav','gulp-1.wav','gulp-2.wav','gulp-3.wav',
             'crumble.wav','upgrade.wav','complete.wav','click.wav']:
    path = ROOT / name
    rate,data=wavfile.read(path)
    f=data.astype(float)/32768
    manifest['assets'][path.name]={'duration':len(data)/rate,'sampleRate':rate,
        'channels':1 if data.ndim==1 else data.shape[1], 'bytes':path.stat().st_size,
        'peak':round(float(np.max(abs(f))),5),'rms':round(float(np.sqrt(np.mean(f*f))),5)}
manifest['assets']['music.mp3']={'bytes':(ROOT/'music.mp3').stat().st_size,
                                    'loopStart':0,'loopEnd':32}
manifest['loopSeam']={'sampleJump':np.round(np.abs(mix[0]-mix[-1]),7).tolist(),
                     'typicalMaxSampleStep':float(np.max(abs(np.diff(mix,axis=0))))}
(ROOT/'audio-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(manifest,indent=2))
