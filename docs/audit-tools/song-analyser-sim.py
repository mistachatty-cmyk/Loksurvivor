# Models the game's analyser (src/game/audio/analysis.ts) over the bundled songs and reports
# how often the Monroe Strip music-event thresholds (bass >= 0.75, energy >= 0.85) are met.
# This is a re-implementation (1024-point FFT, Blackman window, smoothing 0.8, -100..-30 dB),
# not the browser's own analyser. Needs ffmpeg and numpy.
# Run from the repo root:  python3 -I docs/audit-tools/song-analyser-sim.py [music-dir]
import subprocess, sys, glob, os, numpy as np
SR=44100; N=1024; HOP=SR//60
win=np.blackman(N)
edges=[('sub',80),('bass',250),('lowMid',800),('mid',3000),('high',12000)]
nb=N//2; bph=nb/(SR/2)
bins=[];frm=0
for b,hz in edges:
    to=min(nb,max(frm+1,round(hz*bph)));bins.append((b,frm,to));frm=to
def run(path):
    raw=subprocess.run(['ffmpeg','-v','error','-i',path,'-f','f32le','-ac','1','-ar',str(SR),'-'],capture_output=True).stdout
    x=np.frombuffer(raw,dtype=np.float32);dur=len(x)/SR
    S=np.zeros(nb);bands={b:0.0 for b,_,_ in bins};en=0.0
    bass_hits=[];en_hits=[];bass_t=en_t=-1e9
    bass_frac=en_frac=0;frames=0;maxbass=maxen=0
    for i in range(N,len(x),HOP):
        seg=x[i-N:i]*win
        mag=np.abs(np.fft.rfft(seg))[:nb]/N
        S=0.8*S+0.2*mag
        db=20*np.log10(np.maximum(S,1e-12))
        byte=np.clip(255/(-30+100)*(db+100),0,255)
        tot=0
        for b,f,t in bins:
            s=byte[f:t].sum();m=s/max(1,t-f)
            bands[b]=bands[b]*0.7+min(1,m/180)*0.3;tot+=s
        en=en*0.8+min(1,(tot/nb)/150)*0.2
        t=i/SR;frames+=1
        maxbass=max(maxbass,bands['bass']);maxen=max(maxen,en)
        if bands['bass']>=0.75:
            bass_frac+=1
            if t-bass_t>=20: bass_hits.append(t);bass_t=t
        if en>=0.85:
            en_frac+=1
            if t-en_t>=45: en_hits.append(t);en_t=t
    return dur,bass_frac/frames,en_frac/frames,maxbass,maxen,bass_hits,en_hits
d=(sys.argv[1] if len(sys.argv)>1 else 'artifacts/survivor-616/public/music/lokifed-take-1').rstrip('/')+'/'
for f in sorted(glob.glob(d+'*.m4a')):
    dur,bf,ef,mb,me,bh,eh=run(f)
    pct=lambda L:[round(t/dur*100) for t in L]
    print(f"{os.path.basename(f)[:30].ljust(30)} dur={dur:5.0f}s  bass>=.75: {bf*100:4.0f}% of time (max {mb:.2f}) fires@{pct(bh)}%  | energy>=.85: {ef*100:4.0f}% (max {me:.2f}) fires@{pct(eh)}%")
