/**
 * Soundtrack panel: the player loads their own audio files off their device
 * and controls playback. Owned by the design pass -- keep the export name
 * and props stable, and keep every control wired.
 */
import { useRef } from 'react';
import { formatTime, useMusicPlayer } from '@/game/audio/musicPlayer';
import { ScreenLayout } from './ScreenLayout';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Shuffle, Repeat, Repeat1, Upload, Trash2, AlertCircle, Music } from 'lucide-react';
import { motion } from 'framer-motion';

export interface MusicPanelProps {
  onBack: () => void;
}

export function MusicPanel({ onBack }: MusicPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const player = useMusicPlayer();

  return (
    <ScreenLayout 
      title="Soundtrack" 
      subtitle="Mixtape"
      onBack={onBack}
    >
      <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_350px]">
        {/* Playlist Section */}
        <div className="flex min-w-0 flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <p className="text-sm text-muted-foreground max-w-md">
               The 616 mixtape is ready below. Add tracks from this device to extend it; nothing is uploaded.
            </p>
            <div className="flex gap-2 shrink-0">
               <button
                type="button" 
                onClick={() => inputRef.current?.click()} 
                className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 font-bold uppercase text-xs tracking-widest hover:bg-white transition-colors" 
                data-testid="button-add-tracks"
              >
                <Upload className="w-4 h-4" /> Add Tracks
              </button>
              <button 
                type="button" 
                onClick={player.clearTracks} 
                className="flex items-center gap-2 border border-border bg-card px-4 py-2 text-white font-bold uppercase text-xs tracking-widest hover:border-destructive hover:text-destructive transition-colors" 
                data-testid="button-clear-tracks"
                 disabled={!player.tracks.some((track) => track.source === 'local')}
              >
                 Clear local
              </button>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="audio/*"
              multiple
              className="hidden"
              data-testid="input-audio-files"
              onChange={(event) => {
                if (event.target.files) player.addFiles(event.target.files);
                event.target.value = '';
              }}
            />
          </div>

          {player.error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3 bg-destructive/10 border border-destructive text-destructive p-4 mb-6"
              role="alert" 
              data-testid="text-music-error"
            >
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="flex-1 text-sm font-bold">{player.error}</div>
              <button type="button" onClick={player.dismissError} className="underline text-xs uppercase tracking-widest">
                Dismiss
              </button>
            </motion.div>
          )}

          {player.tracks.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-border/50 text-muted-foreground p-12 text-center min-h-[300px]">
              <Music className="w-12 h-12 mb-4 opacity-20" />
               <p className="font-bold uppercase tracking-widest mb-2 text-white">No tracks loaded</p>
               <p className="text-sm max-w-sm">The built-in mixtape is unavailable. Add local MP3, WAV, M4A, or FLAC files to score your runs.</p>
            </div>
          ) : (
            <ul className="max-h-[60vh] min-w-0 space-y-2 overflow-y-auto pr-2 custom-scrollbar">
              {player.tracks.map((track, i) => {
                const isPlaying = player.currentTrack?.id === track.id;
                return (
                  <motion.li 
                    key={track.id} 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                     className={`group flex min-w-0 items-center justify-between border p-1 pr-3 transition-colors ${
                      isPlaying 
                        ? 'border-primary bg-primary/10' 
                        : 'border-border bg-card hover:border-primary/50'
                    }`}
                  >
                    <button 
                      type="button" 
                      onClick={() => player.playTrack(track.id)} 
                       className="flex min-w-0 flex-1 items-center gap-3 p-2 text-left"
                      data-testid={`button-track-${track.id}`}
                    >
                      <div className={`w-8 h-8 flex items-center justify-center shrink-0 ${isPlaying ? 'bg-primary text-primary-foreground' : 'bg-black text-muted-foreground group-hover:text-white'}`}>
                        {isPlaying && player.isPlaying ? <Music className="w-4 h-4 animate-pulse" /> : <Play className="w-4 h-4 ml-0.5" />}
                      </div>
                       <div className="min-w-0 flex-1 truncate">
                        <span className={`block font-bold text-sm truncate ${isPlaying ? 'text-primary' : 'text-white'}`}>
                          {track.title}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-muted-foreground shrink-0">{formatTime(track.duration)}</span>
                    </button>
                     {track.source === 'local' ? (
                       <button
                         type="button"
                         onClick={() => player.removeTrack(track.id)}
                         className="text-muted-foreground hover:text-destructive p-2 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                         data-testid={`button-remove-${track.id}`}
                         aria-label="Remove track"
                       >
                         <Trash2 className="w-4 h-4" />
                       </button>
                     ) : (
                       <span className="px-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60">616 Mixtape</span>
                     )}
                  </motion.li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Player Controls Section */}
        <div className="sticky top-6">
          <div className="bg-card border border-border p-6 flex flex-col relative overflow-hidden">
            <div className="absolute inset-0 bg-black/50 z-0 pointer-events-none" />
            
            <div className="relative z-10 flex flex-col h-full">
              <div className="mb-8 text-center">
                <p className="text-xs text-primary uppercase tracking-widest font-bold mb-2">Now Playing</p>
                <p className="text-xl font-black text-white truncate px-2" data-testid="text-now-playing">
                  {player.currentTrack ? player.currentTrack.title : 'Nothing queued'}
                </p>
              </div>

              {/* Progress */}
              <div className="mb-8">
                <div className="flex justify-between text-xs font-mono text-muted-foreground mb-2">
                  <span>{formatTime(player.progressSec)}</span>
                  <span>{formatTime(player.durationSec)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(1, player.durationSec)}
                  value={player.progressSec}
                  onChange={(e) => player.seek(Number(e.target.value))}
                  className="w-full h-2 bg-black appearance-none cursor-pointer accent-primary border border-border/50 focus:outline-none"
                  aria-label="Seek"
                  data-testid="input-seek"
                />
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-4 mb-8">
                <button 
                  type="button" 
                  onClick={player.previous} 
                  className="text-white hover:text-primary transition-colors p-2" 
                  data-testid="button-previous"
                >
                  <SkipBack className="w-6 h-6" />
                </button>
                <button 
                  type="button" 
                  onClick={player.togglePlay} 
                  className="w-16 h-16 flex items-center justify-center bg-primary text-primary-foreground rounded-full hover:bg-white transition-colors hover:scale-105 active:scale-95" 
                  data-testid="button-play-pause"
                >
                  {player.isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
                </button>
                <button 
                  type="button" 
                  onClick={player.next} 
                  className="text-white hover:text-primary transition-colors p-2" 
                  data-testid="button-next"
                >
                  <SkipForward className="w-6 h-6" />
                </button>
              </div>

              {/* Toggles & Volume */}
              <div className="flex items-center justify-between gap-4 pt-6 border-t border-border/50">
                <div className="flex gap-2">
                  <button 
                    type="button" 
                    onClick={player.toggleShuffle} 
                    className={`p-2 transition-colors ${player.shuffle ? 'text-primary' : 'text-muted-foreground hover:text-white'}`} 
                    data-testid="button-shuffle"
                    title="Shuffle"
                  >
                    <Shuffle className="w-4 h-4" />
                  </button>
                  <button 
                    type="button" 
                    onClick={player.cycleRepeat} 
                    className={`p-2 transition-colors ${player.repeat !== 'off' ? 'text-primary' : 'text-muted-foreground hover:text-white'}`} 
                    data-testid="button-repeat"
                    title={`Repeat: ${player.repeat}`}
                  >
                    {player.repeat === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
                  </button>
                </div>
                
                <div className="flex items-center gap-2 flex-1 max-w-[120px]">
                  <button 
                    type="button" 
                    onClick={player.toggleMute} 
                    className="text-muted-foreground hover:text-white transition-colors" 
                    data-testid="button-mute"
                  >
                    {player.muted || player.volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={player.muted ? 0 : player.volume}
                    onChange={(e) => player.setVolume(Number(e.target.value))}
                    className="w-full h-1 bg-black appearance-none cursor-pointer accent-primary focus:outline-none"
                    aria-label="Volume"
                    data-testid="input-volume"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ScreenLayout>
  );
}

export default MusicPanel;
