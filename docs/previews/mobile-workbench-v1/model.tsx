import { createContext, use, useEffect, useRef, useState, type ReactNode } from 'react';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { AppState } from 'react-native';

export type Draft = { style: string; lyrics: string; seed: string; maxSeconds: string; revision: number };
export type JobState = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type Job = {
  id: string; intentId: string; projectId: string; createdAt: number; state: JobState;
  input: Draft; fail: boolean; unknown: boolean; stage: number;
  endedAt?: number; cancelRequestedAt?: number; cancelAckAt?: number; cancelUnconfirmed?: boolean;
};
export type Version = { id: string; jobId: string; name: string; savedAt: number; input: Draft };
type SaveIntent = { name: string; status: 'pending' | 'unknown' | 'checking' };
export type Project = { id: string; name: string; description: string; draft: Draft; versions: Version[] };
export type Connection = 'unpaired' | 'connected' | 'disconnected' | 'revoked';
export type CatalogState = 'ready' | 'loading' | 'empty' | 'error';

export const sampleDraft: Draft = {
  style: '独立流行，温暖女声，慢速鼓点，夜晚的城市感',
  lyrics: '[Verse]\n末班车穿过雨后的街\n霓虹在车窗慢慢重叠\n[Chorus]\n让这一刻停在声间\n把没说的话唱成明天',
  seed: '42', maxSeconds: '0', revision: 0,
};
export const blankDraft = (): Draft => ({ style: '', lyrics: '', seed: '42', maxSeconds: '0', revision: 0 });

const initialProjects = (): Project[] => [
  { id: 'night-radio', name: '夜行电台', description: '给回家路上的自己', draft: { ...sampleDraft }, versions: [
    { id: 'version-demo', jobId: 'demo', name: '雨后 · 第一版', savedAt: Date.now() - 86400000, input: { ...sampleDraft } },
  ] },
  { id: 'wild-letter', name: '荒野来信', description: '把一点空旷留在旋律里', draft: blankDraft(), versions: [] },
];

export function validateDraft(draft: Draft): string | undefined {
  if (!draft.style.trim()) return '先写下你想要的音乐风格。';
  if (!draft.lyrics.trim()) return '写几行歌词，再开始生成。';
  if (Array.from(draft.style.trim()).length > 1024) return '音乐风格最多 1024 个字。';
  if (Array.from(draft.lyrics.trim()).length > 10000) return '歌词最多 10000 个字。';
  if (!/^\d+$/.test(draft.seed) || !Number.isSafeInteger(Number(draft.seed))) return 'Seed 请输入非负整数。';
  if (requestedCeiling(draft.maxSeconds) === undefined) return '时长上限留空或填 0 表示自动；手动请输入 5–360 的整数。';
  return undefined;
}

export function requestedCeiling(raw: string): string | undefined {
  const value = raw.trim();
  if (value === '') return '0';
  if (!/^\d+$/.test(value)) return undefined;
  const seconds = Number(value);
  if (seconds === 0) return '0';
  return seconds >= 5 && seconds <= 360 ? String(seconds) : undefined;
}

export function validateName(raw: string, kind: '项目' | '版本'): string | undefined {
  if (!raw.trim()) return `给这个${kind}起一个名字。`;
  if (Array.from(raw.trim()).length > 200) return `${kind}名称最多 200 个字。`;
  return undefined;
}

export function jobPending(job: Job): boolean {
  return job.unknown || !!job.cancelRequestedAt || job.state === 'queued' || job.state === 'running';
}

function usePreviewModel() {
  const [projects, setProjects] = useState(initialProjects);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [connection, setConnectionState] = useState<Connection>('unpaired');
  const [address, setAddress] = useState('http://192.168.31.209:8000');
  const [pairCode, setPairCode] = useState('');
  const [pairStatus, setPairStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [pairError, setPairError] = useState('');
  const [catalogState, setCatalogState] = useState<CatalogState>('ready');
  const [nextFailure, setNextFailure] = useState(false);
  const [nextUnknown, setNextUnknown] = useState(false);
  const [nextSaveFailure, setNextSaveFailure] = useState(false);
  const [nextSaveUnknown, setNextSaveUnknown] = useState(false);
  const [nextCancelUnconfirmed, setNextCancelUnconfirmed] = useState(false);
  const [nextPairFailure, setNextPairFailure] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [candidateNames, setCandidateNames] = useState<Record<string, string>>({});
  const [saveIntents, setSaveIntents] = useState<Record<string, SaveIntent>>({});
  const [recovering, setRecovering] = useState(false);
  const [playbackKey, setPlaybackKey] = useState('');
  const [audioError, setAudioError] = useState('');
  const player = useAudioPlayer(require('./assets/morning-song.mp3'), { updateInterval: 250 });
  const audioStatus = useAudioPlayerStatus(player);
  const [clock, setClock] = useState(Date.now());
  const sequence = useRef(1);
  const submitting = useRef(new Set<string>());
  const saving = useRef(new Set<string>());
  // Isolated demo-computer records whose successful save response has not reached the phone.
  const unconfirmedVersions = useRef(new Map<string, { projectId: string; version: Version }>());
  const connectionRef = useRef(connection);
  const active = useRef(true);

  function setConnection(next: Connection) {
    if (next === 'disconnected' && (connectionRef.current === 'unpaired' || connectionRef.current === 'revoked')) return;
    connectionRef.current = next;
    setConnectionState(next);
    if (next !== 'connected') player.pause();
  }

  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false, interruptionMode: 'doNotMix' })
      .catch(() => setAudioError('无法准备试听。请重新打开预览后再试。'));
    const subscription = AppState.addEventListener('change', next => {
      if (next !== 'active') player.pause();
    });
    return () => subscription.remove();
  }, [player]);

  useEffect(() => {
    active.current = true;
    const timer = setInterval(() => {
      const now = Date.now();
      setClock(now);
      // This clock represents the isolated demo computer; it keeps working during a simulated disconnect.
      setJobs(current => current.map(job => {
        if (job.state !== 'queued' && job.state !== 'running') return job;
        if (job.cancelRequestedAt && job.cancelAckAt) {
          if (now < job.cancelAckAt) return job;
          const unconfirmed = job.cancelUnconfirmed || connectionRef.current !== 'connected';
          return { ...job, state: 'cancelled', endedAt: job.cancelAckAt,
            cancelUnconfirmed: unconfirmed, cancelRequestedAt: unconfirmed ? job.cancelRequestedAt : undefined };
        }
        const elapsed = (now - job.createdAt) / 1000;
        if (elapsed >= 9) return { ...job, state: job.fail ? 'failed' : 'completed', stage: 3, endedAt: now };
        return { ...job, state: elapsed < 2 ? 'queued' : 'running', stage: elapsed < 4 ? 0 : elapsed < 7 ? 1 : 2 };
      }));
    }, 700);
    return () => { active.current = false; clearInterval(timer); };
  }, []);

  async function pair(): Promise<boolean> {
    if (pairStatus === 'loading') return false;
    if (!/^https?:\/\/[^\s/]+(?::\d+)?\/?$/.test(address.trim())) {
      setPairStatus('error'); setPairError('请输入电脑显示的完整地址，例如 http://192.168.31.209:8000。'); return false;
    }
    if (pairCode.trim() !== '246810') {
      setPairStatus('error'); setPairError('配对码不正确或已过期。请使用演示码 246810。'); return false;
    }
    setPairStatus('loading'); setPairError('');
    await new Promise(resolve => setTimeout(resolve, 900));
    if (!active.current) return false;
    if (nextPairFailure) {
      setNextPairFailure(false); setPairStatus('error');
      setPairError('暂时连接不到电脑。输入已保留，请确认电脑仍在运行后重试。'); return false;
    }
    setConnection('connected'); setPairStatus('idle'); setCatalogState('ready'); return true;
  }

  function addProject(): string | undefined {
    const name = newProjectName.trim();
    if (validateName(name, '项目') || connection !== 'connected') return undefined;
    const id = `project-${sequence.current++}`;
    setProjects(current => [{ id, name, description: '新的音乐想法', draft: blankDraft(), versions: [] }, ...current]);
    setNewProjectName(''); setCatalogState('ready'); return id;
  }

  function updateDraft(projectId: string, patch: Partial<Draft>) {
    setProjects(current => current.map(project => project.id === projectId ? { ...project, draft: { ...project.draft, ...patch } } : project));
  }

  function submit(projectId: string, previousInput?: Draft): string | undefined {
    const project = projects.find(item => item.id === projectId);
    const input = previousInput ?? project?.draft;
    if (connection !== 'connected' || !project || !input || validateDraft(input) || submitting.current.has(projectId)) return undefined;
    if (jobs.some(job => job.projectId === projectId && jobPending(job))) return undefined;
    submitting.current.add(projectId);
    const id = `job-${sequence.current++}`;
    const intentId = `intent-${id}`;
    setJobs(current => [{ id, intentId, projectId, createdAt: Date.now(), state: 'queued', stage: 0,
      input: { ...input, style: input.style.trim(), lyrics: input.lyrics.trim(), maxSeconds: requestedCeiling(input.maxSeconds)! },
      fail: nextFailure, unknown: nextUnknown }, ...current]);
    if (nextUnknown) setConnection('disconnected');
    setNextFailure(false); setNextUnknown(false);
    // Keep the synchronous guard until the new job has rendered.
    setTimeout(() => submitting.current.delete(projectId), 400);
    return id;
  }

  function cancel(jobId: string) {
    if (connection !== 'connected') return;
    const requestedAt = Date.now();
    setJobs(current => current.map(job => job.id === jobId && !job.cancelRequestedAt && (job.state === 'queued' || job.state === 'running')
      ? { ...job, cancelRequestedAt: requestedAt, cancelAckAt: requestedAt + 1800, cancelUnconfirmed: nextCancelUnconfirmed } : job));
    if (nextCancelUnconfirmed) setConnection('disconnected');
    setNextCancelUnconfirmed(false);
  }

  async function recover() {
    const hasPairing = () => connectionRef.current === 'connected' || connectionRef.current === 'disconnected';
    if (recovering || !hasPairing()) return;
    setRecovering(true);
    setCatalogState('loading');
    await new Promise(resolve => setTimeout(resolve, 600));
    if (!active.current) return;
    if (!hasPairing()) {
      setRecovering(false); setCatalogState('ready'); return;
    }
    setConnection('connected'); setCatalogState('ready'); setRecovering(false);
    // Each intent maps to its already accepted job; no input matching and no new submission.
    setJobs(current => current.map(job => ({ ...job, unknown: false,
      cancelUnconfirmed: false, cancelRequestedAt: job.endedAt ? undefined : job.cancelRequestedAt })));
  }

  function setCandidateName(jobId: string, name: string) {
    if (saveIntents[jobId] || saving.current.has(jobId)) return;
    setCandidateNames(current => ({ ...current, [jobId]: name }));
  }

  async function seekSample(key: string, seconds: number) {
    if (connectionRef.current !== 'connected') return;
    try {
      if (key !== playbackKey) { player.pause(); setPlaybackKey(key); }
      await player.seekTo(Math.max(0, Math.min(audioStatus.duration, seconds)));
      setAudioError('');
    } catch { setAudioError('暂时无法跳转播放位置。可以重新开始试听。'); }
  }

  async function toggleSample(key: string) {
    if (connectionRef.current !== 'connected') return;
    try {
      if (key === playbackKey && audioStatus.playing) { player.pause(); return; }
      if (key !== playbackKey || audioStatus.didJustFinish || audioStatus.currentTime >= audioStatus.duration) {
        player.pause(); await player.seekTo(0); setPlaybackKey(key);
      }
      if (connectionRef.current !== 'connected') return;
      player.play(); setAudioError('');
    } catch { setAudioError('试听暂时无法播放。请重试。'); }
  }

  async function saveVersion(job: Job, name: string): Promise<string | undefined> {
    const problem = validateName(name, '版本');
    if (problem) return problem;
    if (connection !== 'connected') return '恢复电脑连接后再保存。名称和候选结果已保留。';
    if (saving.current.has(job.id) || saveIntents[job.id]) return '请先核对这次保存的结果，再继续操作。';
    if (projects.some(project => project.versions.some(version => version.jobId === job.id))) return '这个候选结果已经保存。';
    if (job.state !== 'completed') return '等待候选结果完成后再保存。';
    const frozenName = name.trim();
    const willFail = nextSaveFailure;
    const willBeUnknown = nextSaveUnknown;
    setNextSaveFailure(false); setNextSaveUnknown(false);
    saving.current.add(job.id);
    setSaveIntents(current => ({ ...current, [job.id]: { name: frozenName, status: 'pending' } }));
    await new Promise(resolve => setTimeout(resolve, 700));
    saving.current.delete(job.id);
    if (!active.current) return undefined;
    if (willFail) {
      clearSaveIntent(job.id);
      return '保存暂时失败，尚未建立版本。候选结果和名称已保留，可以再次保存。';
    }
    const version: Version = { id: `version-${sequence.current++}`, jobId: job.id, name: frozenName, savedAt: Date.now(), input: { ...job.input } };
    if (willBeUnknown || connectionRef.current !== 'connected') {
      unconfirmedVersions.current.set(job.id, { projectId: job.projectId, version });
      setSaveIntents(current => ({ ...current, [job.id]: { name: frozenName, status: 'unknown' } }));
      return undefined;
    }
    revealVersion(job.projectId, version);
    return undefined;
  }

  function clearSaveIntent(jobId: string) {
    setSaveIntents(current => {
      const next = { ...current }; delete next[jobId]; return next;
    });
  }

  function revealVersion(projectId: string, version: Version) {
    setProjects(current => current.map(project => project.id === projectId ? {
      ...project, versions: project.versions.some(item => item.jobId === version.jobId) ? project.versions : [version, ...project.versions],
    } : project));
    unconfirmedVersions.current.delete(version.jobId);
    clearSaveIntent(version.jobId);
  }

  async function checkSavedVersion(jobId: string): Promise<string | undefined> {
    const intent = saveIntents[jobId];
    if (connectionRef.current !== 'connected') return '先恢复电脑连接，再核对原候选结果的保存记录。';
    if (!intent || intent.status !== 'unknown') return undefined;
    setSaveIntents(current => ({ ...current, [jobId]: { ...intent, status: 'checking' } }));
    await new Promise(resolve => setTimeout(resolve, 600));
    if (!active.current) return undefined;
    if (connectionRef.current !== 'connected') {
      setSaveIntents(current => ({ ...current, [jobId]: { ...intent, status: 'unknown' } }));
      return '核对时连接已中断。保存意图仍保留，不会重复写入。';
    }
    const record = unconfirmedVersions.current.get(jobId);
    if (record) { revealVersion(record.projectId, record.version); return undefined; }
    clearSaveIntent(jobId);
    return '没有查到这个候选结果的已保存版本。可以检查名称后再次保存。';
  }

  return {
    projects, jobs, connection, setConnection, address, setAddress, pairCode, setPairCode,
    pairStatus, pairError, pair, catalogState, setCatalogState, recover, recovering,
    newProjectName, setNewProjectName, addProject, updateDraft, submit, cancel, saveVersion, checkSavedVersion, clock,
    nextFailure, setNextFailure, nextUnknown, setNextUnknown, nextSaveFailure, setNextSaveFailure,
    nextPairFailure, setNextPairFailure, nextCancelUnconfirmed, setNextCancelUnconfirmed, nextSaveUnknown, setNextSaveUnknown,
    candidateNames, setCandidateName, saveIntents, audioStatus, audioError, playbackKey, toggleSample, seekSample,
  };
}

const PreviewContext = createContext<ReturnType<typeof usePreviewModel> | null>(null);
export function PreviewProvider({ children }: { children: ReactNode }) {
  const model = usePreviewModel();
  return <PreviewContext value={model}>{children}</PreviewContext>;
}
export function usePreview() {
  const context = use(PreviewContext);
  if (!context) throw new Error('PreviewProvider is missing');
  return context;
}
