/**
 * Soundtrack panel: the player loads their own audio/video files or a direct
 * link, organizes them into playlists, and controls playback. Owned by the
 * design pass -- keep the export name and props stable, and keep every
 * control wired.
 */
import { useRef, useState } from 'react';
import { formatTime, useMusicPlayer, type Track } from '@/game/audio/musicPlayer';
import { ScreenLayout } from './ScreenLayout';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Shuffle,
  Repeat,
  Repeat1,
  Upload,
  Trash2,
  AlertCircle,
  Music,
  Plus,
  Link2,
  Wand2,
  X,
  GripVertical,
  Loader2,
} from 'lucide-react';
import { motion, Reorder } from 'framer-motion';

export interface MusicPanelProps {
  onBack: () => void;
}

export function MusicPanel({ onBack }: MusicPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const player = useMusicPlayer();
  const [dragActive, setDragActive] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const [newPlaylistDraft, setNewPlaylistDraft] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const viewedTracks: Track[] = player.activePlaylist
    ? player.activePlaylist.trackIds
        .map((id) => player.tracks.find((t) => t.id === id))
        .filter((t): t is Track => t !== undefined)
    : player.tracks;

  const submitLink = async () => {
    if (!linkValue.trim() || player.linkLoading) return;
    const ok = await player.addFromUrl(linkValue);
    if (ok) {
      setLinkValue('');
      setLinkOpen(false);
    }
  };

  const finishNewPlaylist = () => {
    const name = newPlaylistDraft?.trim();
    if (name) {
      const id = player.createPlaylist(name);
      player.setActivePlaylist(id);
    }
    setNewPlaylistDraft(null);
  };

  const finishRename = (id: string) => {
    if (renameDraft.trim()) player.renamePlaylist(id, renameDraft);
    setRenamingId(null);
  };

  return (
    <ScreenLayout
      title="Soundtrack"
      subtitle="Mixtape"
      onBack={onBack}
    >
      <div
        className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_350px]"
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          if (event.dataTransfer.files.length > 0) player.addFiles(event.dataTransfer.files);
        }}
      >
        {/* Playlist Section */}
        <div className="flex min-w-0 flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <p className="text-sm text-muted-foreground max-w-md">
              Drop MP3, WAV, M4A, FLAC or MP4/MOV/WebM files anywhere here, add a direct link, or extend the 616 mixtape below. Nothing is uploaded.
            </p>
            <div className="flex flex-wrap gap-2 shrink-0">
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
                onClick={() => setLinkOpen((v) => !v)}
                className={`flex items-center gap-2 border px-4 py-2 font-bold uppercase text-xs tracking-widest transition-colors ${
                  linkOpen ? 'border-primary text-primary bg-primary/10' : 'border-border bg-card text-white hover:border-primary'
                }`}
                data-testid="button-toggle-link"
              >
                <Link2 className="w-4 h-4" /> Add Link
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
              accept="audio/*,video/*"
              multiple
              className="hidden"
              data-testid="input-audio-files"
              onChange={(event) => {
                if (event.target.files) player.addFiles(event.target.files);
                event.target.value = '';
              }}
            />
          </div>

          {linkOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex items-center gap-2 mb-4"
            >
              <input
                type="url"
                value={linkValue}
                onChange={(e) => setLinkValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void submitLink();
                }}
                placeholder="https://your-own-file-host/track.mp3"
                autoFocus
                className="min-w-0 flex-1 border border-border bg-black px-3 py-2 text-sm text-white outline-none focus:border-primary"
                data-testid="input-track-link"
              />
              <button
                type="button"
                onClick={() => void submitLink()}
                disabled={player.linkLoading || !linkValue.trim()}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 font-bold uppercase text-xs tracking-widest hover:bg-white transition-colors disabled:opacity-40"
                data-testid="button-submit-link"
              >
                {player.linkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
              </button>
            </motion.div>
          )}

          {/* Playlists */}
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <button
              type="button"
              onClick={() => player.setActivePlaylist(null)}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-widest border transition-colors ${
                player.activePlaylistId === null
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:text-white'
              }`}
              data-testid="button-playlist-all"
            >
              All Tracks
            </button>
            {player.playlists.map((playlist) => (
              <div
                key={playlist.id}
                className={`group flex items-center border transition-colors ${
                  player.activePlaylistId === playlist.id ? 'border-primary bg-primary/10' : 'border-border bg-card'
                }`}
              >
                {renamingId === playlist.id ? (
                  <input
                    autoFocus
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onBlur={() => finishRename(playlist.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') finishRename(playlist.id);
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    className="w-28 bg-black px-2 py-1.5 text-xs font-bold uppercase tracking-widest text-white outline-none"
                    data-testid={`input-rename-playlist-${playlist.id}`}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => player.setActivePlaylist(playlist.id)}
                    onDoubleClick={() => {
                      setRenamingId(playlist.id);
                      setRenameDraft(playlist.name);
                    }}
                    className={`px-3 py-1.5 text-xs font-bold uppercase tracking-widest ${
                      player.activePlaylistId === playlist.id ? 'text-primary' : 'text-muted-foreground hover:text-white'
                    }`}
                    title="Double-click to rename"
                    data-testid={`button-playlist-${playlist.id}`}
                  >
                    {playlist.name} <span className="opacity-60">({playlist.trackIds.length})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Delete playlist "${playlist.name}"? Tracks themselves are not deleted.`)) {
                      player.deletePlaylist(playlist.id);
                    }
                  }}
                  className="pr-2 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:text-destructive"
                  aria-label={`Delete ${playlist.name}`}
                  data-testid={`button-delete-playlist-${playlist.id}`}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            {newPlaylistDraft !== null ? (
              <input
                autoFocus
                value={newPlaylistDraft}
                onChange={(e) => setNewPlaylistDraft(e.target.value)}
                onBlur={finishNewPlaylist}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') finishNewPlaylist();
                  if (e.key === 'Escape') setNewPlaylistDraft(null);
                }}
                placeholder="Playlist name"
                className="w-32 border border-primary bg-black px-2 py-1.5 text-xs font-bold uppercase tracking-widest text-white outline-none"
                data-testid="input-new-playlist"
              />
            ) : (
              <button
                type="button"
                onClick={() => setNewPlaylistDraft('')}
                className="flex items-center gap-1 border border-dashed border-border px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                data-testid="button-new-playlist"
              >
                <Plus className="w-3 h-3" /> New Playlist
              </button>
            )}
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

          {dragActive && (
            <div className="mb-6 flex items-center justify-center border-2 border-dashed border-primary bg-primary/5 p-6 text-center text-sm font-bold uppercase tracking-widest text-primary">
              Drop to add to the soundtrack
            </div>
          )}

          {viewedTracks.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-border/50 text-muted-foreground p-12 text-center min-h-[300px]">
              <Music className="w-12 h-12 mb-4 opacity-20" />
              <p className="font-bold uppercase tracking-widest mb-2 text-white">
                {player.activePlaylist ? 'This playlist is empty' : 'No tracks loaded'}
              </p>
              <p className="text-sm max-w-sm">
                {player.activePlaylist
                  ? 'Switch to "All Tracks" and use the add-to-playlist menu on a track to build it out.'
                  : 'The built-in mixtape is unavailable. Add local MP3, WAV, M4A, FLAC, or MP4/MOV/WebM files to score your runs.'}
              </p>
            </div>
          ) : (
            <Reorder.Group
              as="ul"
              axis="y"
              values={viewedTracks}
              onReorder={(next) => {
                if (player.activePlaylist) {
                  player.reorderPlaylistTracks(player.activePlaylist.id, next.map((t) => t.id));
                }
              }}
              className="max-h-[60vh] min-w-0 space-y-2 overflow-y-auto pr-2 custom-scrollbar"
            >
              {viewedTracks.map((track) => {
                const isCurrent = player.currentTrack?.id === track.id;
                const converting = player.conversion?.trackId === track.id;
                return (
                  <Reorder.Item
                    key={track.id}
                    value={track}
                    drag={player.activePlaylist ? 'y' : false}
                    className={`group flex min-w-0 items-center justify-between border p-1 pr-3 transition-colors ${
                      isCurrent ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/50'
                    }`}
                  >
                    {player.activePlaylist && (
                      <span className="cursor-grab px-1 text-muted-foreground/50 active:cursor-grabbing" aria-hidden>
                        <GripVertical className="w-4 h-4" />
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => player.playTrack(track.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 p-2 text-left"
                      data-testid={`button-track-${track.id}`}
                    >
                      <div className={`w-8 h-8 flex items-center justify-center shrink-0 ${isCurrent ? 'bg-primary text-primary-foreground' : 'bg-black text-muted-foreground group-hover:text-white'}`}>
                        {isCurrent && player.isPlaying ? <Music className="w-4 h-4 animate-pulse" /> : <Play className="w-4 h-4 ml-0.5" />}
                      </div>
                      <div className="min-w-0 flex-1 truncate">
                        <span className={`block font-bold text-sm truncate ${isCurrent ? 'text-primary' : 'text-white'}`}>
                          {track.title}
                        </span>
                        {track.isVideoContainer && (
                          <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">
                            video file — audio only
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-mono text-muted-foreground shrink-0">{formatTime(track.duration)}</span>
                    </button>

                    <div className="flex shrink-0 items-center gap-1">
                      {track.isVideoContainer && track.source === 'local' && (
                        converting ? (
                          <span
                            className="flex items-center gap-1 px-2 text-[10px] font-mono uppercase tracking-widest text-primary"
                            data-testid={`text-converting-${track.id}`}
                          >
                            <Loader2 className="w-3 h-3 animate-spin" />
                            {Math.round((player.conversion?.ratio ?? 0) * 100)}%
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void player.convertTrackToMp3(track.id)}
                            className="p-2 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:text-primary"
                            title="Convert to MP3"
                            aria-label={`Convert ${track.title} to MP3`}
                            data-testid={`button-convert-${track.id}`}
                          >
                            <Wand2 className="w-4 h-4" />
                          </button>
                        )
                      )}

                      {player.playlists.length > 0 && !player.activePlaylist && (
                        <select
                          defaultValue=""
                          onChange={(event) => {
                            const playlistId = event.target.value;
                            if (playlistId) player.addToPlaylist(playlistId, track.id);
                            event.target.value = '';
                          }}
                          className="max-w-[90px] cursor-pointer border border-border bg-black p-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:text-white focus:opacity-100"
                          aria-label={`Add ${track.title} to a playlist`}
                          data-testid={`select-add-to-playlist-${track.id}`}
                        >
                          <option value="" disabled>
                            + Add to playlist
                          </option>
                          {player.playlists.map((playlist) => (
                            <option key={playlist.id} value={playlist.id}>
                              {playlist.name}
                            </option>
                          ))}
                        </select>
                      )}

                      {player.activePlaylist ? (
                        <button
                          type="button"
                          onClick={() => player.removeFromPlaylist(player.activePlaylist!.id, track.id)}
                          className="text-muted-foreground hover:text-destructive p-2 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                          aria-label="Remove from playlist"
                          data-testid={`button-remove-from-playlist-${track.id}`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      ) : track.source === 'local' ? (
                        <button
                          type="button"
                          onClick={() => player.removeTrack(track.id)}
                          className="text-muted-foreground hover:text-destructive p-2 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                          aria-label="Remove track"
                          data-testid={`button-remove-${track.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="px-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60">616 Mixtape</span>
                      )}
                    </div>
                  </Reorder.Item>
                );
              })}
            </Reorder.Group>
          )}
        </div>

        {/* Player Controls Section */}
        <div className="sticky top-6">
          <div className="bg-card border border-border p-6 flex flex-col relative overflow-hidden">
            <div className="absolute inset-0 bg-black/50 z-0 pointer-events-none" />

            <div className="relative z-10 flex flex-col h-full">
              <div className="mb-8 text-center">
                <p className="text-xs text-primary uppercase tracking-widest font-bold mb-2">
                  {player.activePlaylist ? player.activePlaylist.name : 'Now Playing'}
                </p>
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
