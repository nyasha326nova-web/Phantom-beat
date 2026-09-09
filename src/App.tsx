import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import {
  AlertCircle, ChevronRight, CloudUpload, Ghost, Headphones,
  LogOut, MoreHorizontal, Pause, Play, Plus, Repeat, Search, Settings,
  Shuffle, SkipBack, SkipForward, Trash2, UserRound, Users, Music2,
} from 'lucide-react';
import { supabase, type Profile, type Track } from '@/lib/supabase';

type AuthMode = 'signin' | 'signup';
type Notice = { type: 'error' | 'success'; text: string } | null;

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds)) return '0:00';
  return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
};

const friendlyError = (message: string) => {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login')) return 'That email or password is not correct.';
  if (lower.includes('already registered') || lower.includes('already been registered')) return 'An account with that email already exists.';
  if (lower.includes('password')) return 'Passwords must be at least 6 characters.';
  return 'Something went wrong. Please try again.';
};

function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setNotice(null);
    setBusy(true);
    const result = mode === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (result.error) {
      setNotice({ type: 'error', text: friendlyError(result.error.message) });
      return;
    }
    if (mode === 'signup' && !result.data.session) {
      setNotice({ type: 'success', text: 'Account created. You can sign in now.' });
      setMode('signin');
      setPassword('');
    }
  };

  return (
    <main className="auth-shell">
      <div className="auth-glow auth-glow-one" /><div className="auth-glow auth-glow-two" />
      <section className="auth-card">
        <div className="brand-mark"><Ghost size={29} strokeWidth={1.7} /></div>
        <p className="eyebrow">Private listening room</p>
        <h1>Enter the <span>frequency.</span></h1>
        <p className="auth-subtitle">Your music, kept close. Sign in to continue to Phantom Beat.</p>
        <div className="auth-toggle"><button className={mode === 'signin' ? 'active' : ''} onClick={() => { setMode('signin'); setNotice(null); }}>Sign in</button><button className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setNotice(null); }}>Create account</button></div>
        <div className="form-stack">
          <label>Email address<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" /></label>
          <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} /></label>
        </div>
        {notice && <Notice notice={notice} />}
        <button className="primary-button full" onClick={submit} disabled={busy || !email || !password}>{busy ? 'Opening your room...' : mode === 'signin' ? 'Open Phantom Beat' : 'Create your library'}<ChevronRight size={17} /></button>
        <p className="secure-note"><span className="status-dot" /> Your library is private and encrypted in transit.</p>
      </section>
      <p className="auth-footer">PHANTOM BEAT <span>·</span> KEEP THE NIGHT CLOSE</p>
    </main>
  );
}

function Notice({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return <div className={`notice ${notice.type}`}><AlertCircle size={16} />{notice.text}</div>;
}

function DropZone({ onFiles }: { onFiles: (files: FileList) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const drop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setDragging(false); if (event.dataTransfer.files.length) onFiles(event.dataTransfer.files); };
  const pick = (event: ChangeEvent<HTMLInputElement>) => { if (event.target.files?.length) onFiles(event.target.files); event.target.value = ''; };
  return <div className={`drop-zone ${dragging ? 'dragging' : ''}`} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop} onClick={() => inputRef.current?.click()}>
    <input ref={inputRef} type="file" accept="audio/*,.mp3,.wav,.m4a,.flac,.aac,.ogg" multiple onChange={pick} />
    <div className="upload-icon"><CloudUpload size={22} /></div><div><strong>Drop tracks here</strong><span>or browse your device · MP3, WAV, M4A and more</span></div><Plus className="drop-plus" size={20} />
  </div>;
}

function Player({ tracks, current, setCurrent }: { tracks: Track[]; current: Track | null; setCurrent: (track: Track | null) => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [src, setSrc] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!current) { setSrc(''); setPlaying(false); return; }
    supabase.storage.from('songs').createSignedUrl(current.file_path, 3600).then(({ data }) => { if (!cancelled && data?.signedUrl) setSrc(data.signedUrl); });
    return () => { cancelled = true; };
  }, [current]);

  useEffect(() => { if (src && audioRef.current) { audioRef.current.load(); audioRef.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false)); } }, [src]);
  const next = useCallback(() => {
    if (!tracks.length) return;
    const index = current ? tracks.findIndex((track) => track.id === current.id) : -1;
    const nextIndex = shuffle ? Math.floor(Math.random() * tracks.length) : (index + 1) % tracks.length;
    setCurrent(tracks[nextIndex]);
  }, [current, setCurrent, shuffle, tracks]);
  const previous = () => { if (!tracks.length) return; const index = current ? tracks.findIndex((track) => track.id === current.id) : 0; setCurrent(tracks[(index - 1 + tracks.length) % tracks.length]); };
  const toggle = () => { if (!audioRef.current) return; if (playing) audioRef.current.pause(); else audioRef.current.play(); setPlaying(!playing); };
  return <footer className="player-bar">
    <audio ref={audioRef} src={src} onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)} onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={(event) => { if (repeat) { event.currentTarget.currentTime = 0; event.currentTarget.play(); } else next(); }} />
    <div className="now-playing">{current ? <><div className="mini-art"><Music2 size={18} /></div><div className="track-meta"><strong>{current.title}</strong><span>{current.artist}</span></div></> : <><div className="mini-art empty"><Headphones size={18} /></div><div className="track-meta"><strong>No track selected</strong><span>Choose something from your library</span></div></>}</div>
    <div className="transport"><div className="progress-row"><span>{formatTime(progress)}</span><input type="range" min="0" max={duration || 1} value={progress} onChange={(e) => { const value = Number(e.target.value); setProgress(value); if (audioRef.current) audioRef.current.currentTime = value; }} /><span>{formatTime(duration)}</span></div><div className="transport-buttons"><button aria-label="Shuffle" className={shuffle ? 'selected' : ''} onClick={() => setShuffle(!shuffle)}><Shuffle size={16} /></button><button aria-label="Previous" onClick={previous}><SkipBack size={18} fill="currentColor" /></button><button className="play-button" aria-label={playing ? 'Pause' : 'Play'} onClick={toggle} disabled={!current}>{playing ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" />}</button><button aria-label="Next" onClick={next}><SkipForward size={18} fill="currentColor" /></button><button aria-label="Repeat" className={repeat ? 'selected' : ''} onClick={() => setRepeat(!repeat)}><Repeat size={16} /></button></div></div>
    <div className="player-end"><button><MoreHorizontal size={20} /></button></div>
  </footer>;
}

function AdminPanel({ profiles, onDelete }: { profiles: Profile[]; onDelete: (id: string) => void }) {
  return <section className="admin-section"><div className="section-heading"><div><p className="eyebrow">Private access</p><h2>Accounts</h2></div><span className="count-badge">{profiles.length} members</span></div><div className="accounts-list">{profiles.map((profile) => <div className="account-row" key={profile.id}><div className="avatar"><UserRound size={16} /></div><div className="account-info"><strong>{profile.email}</strong><span>Joined {new Date(profile.created_at).toLocaleDateString()}</span></div>{profile.is_admin ? <span className="admin-label">Admin</span> : <button className="delete-account" onClick={() => onDelete(profile.id)}><Trash2 size={15} />Delete account</button>}</div>)}</div></section>;
}

function Library() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [current, setCurrent] = useState<Track | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const [{ data: trackData, error: trackError }, { data: profileData }] = await Promise.all([
      supabase.from('tracks').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('id', userData.user?.id ?? '').maybeSingle(),
    ]);
    if (trackError) setNotice({ type: 'error', text: 'Could not load your library.' });
    setTracks(trackData ?? []); setProfile(profileData as Profile | null);
    if (profileData?.is_admin) { const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }); setProfiles((data as Profile[]) ?? []); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const upload = async (files: FileList) => {
    setUploading(true); setNotice(null);
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('audio/') && !/\.(mp3|wav|m4a|flac|aac|ogg)$/i.test(file.name)) { setNotice({ type: 'error', text: `${file.name} is not a supported audio file.` }); continue; }
      if (file.size > 100 * 1024 * 1024) { setNotice({ type: 'error', text: `${file.name} is larger than 100 MB.` }); continue; }
      const cleanName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
      const path = `${profile?.id}/${cleanName}`;
      const { error: storageError } = await supabase.storage.from('songs').upload(path, file, { contentType: file.type || 'audio/mpeg', upsert: false });
      if (storageError) { setNotice({ type: 'error', text: 'Could not upload that track.' }); continue; }
      const title = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      const { error: trackError } = await supabase.from('tracks').insert({ title, artist: 'Unknown Artist', file_path: path });
      if (trackError) { await supabase.storage.from('songs').remove([path]); setNotice({ type: 'error', text: 'Could not add that track to your library.' }); }
    }
    await load(); setUploading(false);
  };
  const remove = async (track: Track) => { setNotice(null); const { error } = await supabase.from('tracks').delete().eq('id', track.id); if (error) { setNotice({ type: 'error', text: 'Could not delete that track.' }); return; } await supabase.storage.from('songs').remove([track.file_path]); if (current?.id === track.id) setCurrent(null); setTracks((items) => items.filter((item) => item.id !== track.id)); };
  const deleteAccount = async (userId: string) => { if (!confirm('Delete this account and all of its music?')) return; const { data: session } = await supabase.auth.getSession(); const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`, { method: 'POST', headers: { Authorization: `Bearer ${session.session?.access_token ?? ''}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) }); if (!response.ok) { setNotice({ type: 'error', text: 'Could not delete the account.' }); return; } setProfiles((items) => items.filter((item) => item.id !== userId)); };
  const visibleTracks = tracks.filter((track) => `${track.title} ${track.artist}`.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="loading-screen"><Ghost size={30} /><span>Waking the room...</span></div>;
  return <div className="app-shell"><aside className="sidebar"><div className="logo"><div className="logo-icon"><Ghost size={20} /></div><span>phantom <b>beat</b></span></div><div className="side-nav"><span className="nav-label">Your space</span><button className="nav-item active"><Music2 size={17} /> Library <span className="nav-count">{tracks.length}</span></button>{profile?.is_admin && <button className="nav-item" onClick={() => document.getElementById('accounts')?.scrollIntoView({ behavior: 'smooth' })}><Users size={17} /> Accounts</button>}</div><div className="sidebar-bottom"><div className="ghost-quote"><span>“</span><p>Music is the<br />silent language<br />of the soul.</p></div><button className="nav-item" onClick={() => supabase.auth.signOut()}><LogOut size={17} /> Sign out</button><div className="user-chip"><div className="avatar small"><UserRound size={14} /></div><span>{profile?.email}</span><Settings size={16} /></div></div></aside>
    <main className="main-content"><header className="topbar"><div className="mobile-logo"><Ghost size={20} /> phantom <b>beat</b></div><div className="breadcrumbs"><span>Library</span><ChevronRight size={14} /><strong>All tracks</strong></div><div className="top-actions"><div className="search-box"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your library" /></div><button className="icon-button"><MoreHorizontal size={20} /></button></div></header><div className="content-wrap"><section className="hero"><div><p className="eyebrow">Your private frequency</p><h1>Good evening<span>.</span></h1><p>Everything you love, in one quiet place.</p></div><div className="hero-orbit"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><Ghost size={46} strokeWidth={1.2} /></div></section><DropZone onFiles={upload} /><div className="library-heading"><div><h2>Your library</h2><span>{tracks.length ? `${tracks.length} ${tracks.length === 1 ? 'track' : 'tracks'}` : 'A blank canvas for your sound'}</span></div><button className="sort-button"><span>Recently added</span><ChevronRight size={15} /></button></div>{notice && <Notice notice={notice} />}{uploading && <div className="uploading"><span className="spinner" /> Uploading your tracks...</div>}{visibleTracks.length ? <div className="track-list">{visibleTracks.map((track, index) => <div className={`track-row ${current?.id === track.id ? 'playing' : ''}`} key={track.id} onClick={() => setCurrent(track)}><span className="track-index">{current?.id === track.id ? <span className="equalizer"><i /><i /><i /></span> : String(index + 1).padStart(2, '0')}</span><div className="track-art"><Music2 size={17} /></div><div className="track-info"><strong>{track.title}</strong><span>{track.artist}</span></div><span className="track-date">{new Date(track.created_at).toLocaleDateString()}</span><button className="track-more" aria-label={`Delete ${track.title}`} onClick={(e) => { e.stopPropagation(); remove(track); }}><Trash2 size={16} /></button></div>)}</div> : <div className="empty-library"><div className="empty-icon"><Headphones size={27} /></div><h3>{search ? 'No tracks found' : 'Your library is waiting'}</h3><p>{search ? 'Try a different search.' : 'Upload your first track above and make this room yours.'}</p></div>}{profile?.is_admin && <div id="accounts"><AdminPanel profiles={profiles} onDelete={deleteAccount} /></div>}</div></main><Player tracks={tracks} current={current} setCurrent={setCurrent} /></div>;
}

function App() {
  const [sessionReady, setSessionReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => { supabase.auth.getSession().then(({ data }) => { setSignedIn(Boolean(data.session)); setSessionReady(true); }); const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { setSignedIn(Boolean(session)); setSessionReady(true); }); return () => listener.subscription.unsubscribe(); }, []);
  if (!sessionReady) return <div className="loading-screen"><Ghost size={30} /><span>Waking the room...</span></div>;
  return signedIn ? <Library /> : <AuthScreen />;
}

export default App;
