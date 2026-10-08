import WaveSurfer from './wavesurfer.js';
import Regions from './regions.js';
import { mediaFixtures } from './media.js';

const words = {
  skip:['跳到工作区','Skip to workspace'], banner:['隔离预览 · 分支、任务与保存为模拟；音频、波形与播放是真实本地行为。','Isolated preview · Branches, jobs and saves are simulated; audio, waveform and playback are real local behavior.'],
  library:['▦ 我的项目','▦ My projects'],jobs:['≋ 任务','≋ Jobs'],runtime:['◉ 运行状态','◉ Runtime'],settings:['⚙ 使用设置','⚙ Settings'],project:['创作项目','Creative project'],projectName:['雨后的散步 · 模拟项目','After the rain · Simulated project'],local:['本地创作，按你的节奏','Local music, at your pace'],breadcrumb:['我的项目 / 雨后的散步','My projects / After the rain'],dark:['暗色','Dark'],light:['亮色','Light'],
  title:['保留每个方向，听见它们的差别','Keep each direction. Hear the difference.'],question:['检查旧版本，再从它继续创作。明确保存后才出现新分支；选择两份音乐，在同一播放器比较。','Inspect an older version, then continue from it. A branch appears only after an explicit save. Compare two music clips in one player.'],versionsTab:['版本与分支','Versions and branches'],compareTab:['比较','Compare'],scoreTab:['乐谱','Score'],lyricsTab:['歌词与输入','Lyrics and inputs'],history:['已保存版本','Saved versions'],reread:['重新读取','Read again'],graphHelp:['只有明确保存的版本进入关系图。多个起点分别显示，候选留在图外。','Only explicitly saved versions enter the graph. Separate roots stay separate; candidates stay outside.'],inspect:['检查版本与创作起点','Inspect a version and its origin'],replaceDraft:['保留现有草稿，或明确用所选旧版本的输入开始。','Keep your draft, or explicitly begin with the selected older version’s inputs.'],keepDraft:['保留当前草稿','Keep current draft'],useInputs:['使用此版本输入','Use this version’s inputs'],create:['从旧版本探索一个新方向','Explore a new direction from an older version'],simulation:['风格与歌词只驱动模拟任务；试听复用标明来源的历史音乐，不表示刚刚生成了这些输入。','Style and lyrics drive a simulated job. Listening reuses labelled historical music; it does not represent a new generation from these inputs.'],style:['音乐风格','Music style'],lyrics:['歌词','Lyrics'],seed:['随机种子','Random seed'],generate:['模拟生成新候选','Simulate a new candidate'],cancel:['取消模拟任务','Cancel simulated job'],choosePair:['选择两份已保存版本','Choose two saved versions'],applyPair:['使用这对版本','Use this pair'],switchRule:['切换保留绝对秒数，不做拍点对齐。目标较短时停在其末端；更换比较对从 0 秒暂停。','Switching keeps absolute seconds, without beat alignment. A shorter target stops at its end; a new pair starts paused at 0.'],refreshRule:['刷新只恢复仍存在的版本选择，从 0 秒暂停。模拟新分支会重置，播放位置与片段不保留。','Reload restores only version choices that still exist, paused at 0. New simulated branches reset; playback position and region are not retained.'],sampleTitle:['真实音乐与模拟关系分开','Real music and simulated relationships'],sampleHelp:['两份 P4 历史音乐来自同一真实项目的兄弟版本，使用不同风格和 seed，不是受控模式比较。B 是 31 秒裁切试听副本；预览关系图是独立模拟示例。','The two historical P4 clips are sibling versions in one real project, with different styles and seeds. This is not a controlled mode comparison. B uses a 31-second review crop; the preview graph is a separate simulation.'],scoreSnapshot:['所检查版本的乐谱快照','Score snapshot of the inspected version'],scoreHelp:['只读模拟 Score 示例；不声称来自正在听的历史音频。切换标签保持播放器。','Read-only simulated Score example, not a transcription of the historical music. Tabs keep the player running.'],inputSnapshot:['所检查版本的输入快照','Input snapshot of the inspected version'],explore:['试一条路径，或检查其他状态','Try a path, or explore another state'],scenarioHelp:['场景会重置模拟创作并暂停播放器；实际刷新请用浏览器刷新。','Scenarios reset the simulated work and pause the player. Use browser reload to test a real refresh.'],scenario:['场景','Scenario'],normal:['完整示例','Complete example'],empty:['无历史','No history'],one:['只有一个版本','One version only'],missing:['版本无音频','Version without audio'],bad:['真实坏音频','Actual corrupt audio'],invalidParent:['父版本缺失','Missing parent version'],cycle:['异常环关系','Invalid cycle'],readError:['关系读取失败','Graph read failure'],loading:['关系加载中','Loading relationships'],startScenario:['打开场景','Open scenario'],nextFailure:['下一次模拟故障','Next simulated failure'],none:['无','None'],generateFailure:['生成失败','Generation failure'],saveFailure:['保存失败','Save failure'],lateLoad:['模拟下一次 B 载入迟到','Delay the next B load'],storageBlocked:['模拟选择存储不可用','Simulate unavailable choice storage'],walkBranch:['旧版本 → 候选 → 保存分支','Older version → candidate → save branch'],walkCompare:['共同片段与长短边界','Common region and duration boundary'],walkFailure:['坏音频后恢复','Recover after corrupt audio'],state:['查看当前创作状态','Inspect current creative state'],retryAudio:['重新载入音频','Reload audio'],play:['播放','Play'],pause:['暂停','Pause'],seek:['播放位置（秒）','Playback position (seconds)'],region:['共同试听片段','Common listening region'],start:['起点（秒）','Start (seconds)'],end:['终点（秒）','End (seconds)'],setRegion:['设置片段','Set region'],playRegion:['播放片段一次','Play region once'],branch:['从此版本继续创作','Continue from this version'],root:['独立起点','Separate root'],parent:['父版本','Parent version'],result:['结果素材','Result assets'],candidate:['未保存候选','Unsaved candidate'],save:['保存为版本','Save as version'],name:['版本名称','Version name'],listen:['试听候选','Listen to candidate'],saved:['已保存，查看同一版本','Saved: inspect the same version'],origin:['创作起点','Creative origin'],noOrigin:['尚未选择起点','No origin selected'],noHistory:['还没有已保存版本。打开完整示例后，可从旧版本开始。','No saved versions yet. Open the complete example to start from an older version.'],noSelection:['选择一个版本查看输入、结果与父关系。','Choose a version to inspect its inputs, outputs and parent.'],noAudio:['无音频','No audio'],relationError:['关系无法确认：父节点缺失、重复或成环。重新读取或打开完整示例；不会补造关系。','Relationships cannot be confirmed: missing parent, duplicate id or cycle. Read again or open the complete example; no relationship is invented.'],readFailed:['读取失败；这不是空历史。重新读取可恢复同一示例。','Read failed; this is not an empty history. Read again to restore the same example.'],loadGraph:['正在读取版本关系…','Reading version relationships…'],selected:['已选择此旧版本为起点，旧快照保持不变。','This older version is the origin; its saved snapshot stays unchanged.'],jobQueued:['已排队 · 进度未知','Queued · Progress unknown'],jobRunning:['模拟生成中 · 进度未知','Simulated generation · Progress unknown'],jobCompleted:['任务完成，只产生未保存候选。','Job completed; only an unsaved candidate was created.'],jobFailed:['生成失败。保留起点与输入；重试使用同一提交快照。','Generation failed. Origin and inputs remain; retry uses the same submitted snapshot.'],jobCancelled:['任务已取消，没有新增版本。','Job cancelled; no new version was added.'],retryGenerate:['重试同一生成输入','Retry the same generation inputs'],saveFailed:['保存失败。名称与首次保存意图保留；重试只保存一个版本。','Save failed. Name and initial save intent remain; retry saves one version.'],invalidInputs:['先选择有效起点，填写风格与合法非负安全整数 seed。','Select a valid origin, enter a style and a nonnegative safe integer seed.'],invalidName:['请填写版本名称。','Enter a version name.'],pairInvalid:['选择本项目两个不同且有音频的已保存版本；只有一份时仍可试听 A。','Choose two different saved versions with audio in this project. With one version, A can still play.'],pairReady:['比较选择已就绪；播放需明确点击。','Pair selected; press Play to listen.'],pairLost:['刷新前的模拟版本已不存在，请重新选择。未自动播放。','A simulated version from before reload no longer exists. Choose again; playback has not started.'],storageWarning:['选择存储不可用；本次仍可比较，刷新恢复不保证。','Choice storage is unavailable. You can compare now; reload recovery is not guaranteed.'],notListening:['尚未选择可试听音频','No playable audio selected'],loadingAudio:['正在载入','Loading'],ready:['就绪 · 暂停','Ready · Paused'],playing:['正在听','Listening to'],ended:['已到末端 · 暂停','At the end · Paused'],audioFailed:['目标音频无法解码。旧源已停止；重读或换一个有音频的版本。','The target audio cannot be decoded. The old source is stopped; reload or choose another version with audio.'],regionInvalid:['起点须小于终点，且须在两份音频共同区间内。','The start must precede the end and stay within the two clips’ common range.'],regionReset:['新比较对的共同区间不包含旧片段，请重新设置。','The new pair cannot contain the previous region. Set a new one.'],regionReady:['片段播放一次，到终点暂停，不循环。','The region plays once and pauses at its end; it does not loop.'],noPairRegion:['两份音频就绪后可设置共同片段。','Choose two available clips to set a common region.'],submitted:['提交快照','Submitted snapshot'],projectState:['模拟项目','Simulated project'],versionsState:['已保存版本数','Saved version count'],jobState:['任务','Job'],pairState:['比较选择','Compare choice'],copy31:['full · 31 秒裁切试听副本','full · 31-second review crop'],copy35:['melody · 原 35 秒试听副本','melody · Original 35-second listening copy'],previewScore:['模拟 Score 与音频不对应','Simulated Score, separate from the audio'],walkBranchHelp:['依次检查 V1、使用其输入、生成并保存。完成任务不会改变图；保存才增加 V1 的子节点。','Inspect V1, use its inputs, generate, then save. Job completion leaves the graph unchanged; saving adds a child of V1.'],walkCompareHelp:['共同片段为 2–4 秒；33 秒长音频切到 31 秒副本会停在短端。','The common region is 2–4 seconds. Switching a 33-second position to the 31-second copy stops at its end.'],walkFailureHelp:['坏文件真实解码失败；换成完整示例的 B 可恢复，不生成或保存任何结果。','Corrupt bytes cause a real decode failure. Switch to the complete example’s B to recover without generating or saving a result.'],stepInspect:['1 · 检查 V1','1 · Inspect V1'],stepInputs:['2 · 使用 V1 输入','2 · Use V1 inputs'],stepGenerate:['3 · 模拟生成','3 · Simulate generation'],stepSave:['4 · 明确保存','4 · Explicitly save'],stepRegion:['1 · 设置 2–4 秒片段','1 · Set the 2–4 second region'],stepPlayRegion:['2 · 播放片段一次','2 · Play region once'],stepLong:['3 · A 定位到 33 秒','3 · Seek A to 33 seconds'],stepShort:['4 · 切到 B 短端','4 · Switch to shorter B'],stepBad:['1 · 切到坏文件 B','1 · Switch to corrupt B'],stepRecover:['2 · 使用有效 B 恢复','2 · Recover with valid B']
};
let language = 'zh', theme = 'light';
const t = key => words[key]?.[language === 'zh' ? 0 : 1] ?? key;
const $ = id => document.getElementById(id);
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const abc = 'X:1\nT:Simulated Score snapshot\nM:4/4\nL:1/8\nQ:1/4=96\nK:C\nC2 D2 E2 G2 | A2 G2 E2 D2 |';
const inputs = {style:'Warm acoustic folk, clear voice, 96 BPM',lyrics:'[Verse]\nAfter rain, we walk into morning.',seed:2026440001,abc};
const fixture = () => [
  {id:'preview-v1',name:'V1 · Morning',parent:null,audio:'melody',inputs:{...inputs}},
  {id:'preview-v2',name:'V2 · Acoustic direction',parent:'preview-v1',audio:'melody',inputs:{...inputs,style:'Intimate indie folk',seed:2026440001}},
  {id:'preview-v3',name:'V3 · Synth direction · 31s review',parent:'preview-v1',audio:'full',inputs:{...inputs,style:'Dreamy synth pop',seed:2026450001}},
  {id:'preview-root',name:'Separate start · Score only',parent:null,audio:null,inputs:{...inputs,style:'Piano sketch'}}
];
// The forest contains saved records only. Jobs, drafts and candidates never feed it.
function relations(versions) {
  const byId = new Map(versions.map(version=>[version.id,version]));
  if (byId.size !== versions.length) return null;
  for (const version of versions) {
    const seen = new Set(); let current = version;
    while (current) {
      if (seen.has(current.id)) return null;
      seen.add(current.id);
      if (current.parent && !byId.has(current.parent)) return null;
      current = current.parent ? byId.get(current.parent) : null;
    }
  }
  return versions.filter(version=>!version.parent);
}
let model = {versions:fixture(),selected:'preview-v1',origin:null,job:null,candidate:null,read:'ready',serial:0};
let pendingOrigin = null, jobTimer = null, pair = null, pairNotice = '', saveNotice = '', walkthrough = null;
const version = id => model.versions.find(value=>value.id === id);
function listeningChoice(id) {
  const saved = version(id);
  if (saved) return {id:saved.id,name:saved.name,audio:saved.audio};
  const candidate = model.candidate;
  return candidate?.id === id ? {id:candidate.id,name:candidate.name,audio:candidate.audio,candidate:true,saved:candidate.saved} : null;
}
const storageKey = 'llm-music-preview46:preview-project:pair';
function persistPair() {
  try { if ($('storage-blocked').checked) throw new Error('Simulated unavailable storage'); localStorage.setItem(storageKey,JSON.stringify(pair)); }
  catch { pairNotice = 'storageWarning'; }
}
function restorePair() {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    if (raw && ['a','b'].includes(raw.side) && version(raw.a)?.audio && version(raw.b)?.audio && raw.a !== raw.b) pair = {a:raw.a,b:raw.b,side:raw.side};
    else if (raw) pairNotice = 'pairLost';
  } catch { pairNotice = 'storageWarning'; }
  pair ??= {a:'preview-v2',b:'preview-v3',side:'a'};
}
const blobs = new Map(Object.entries(mediaFixtures).map(([key,sample])=>[key,new Blob([Uint8Array.from(atob(sample.base64),character=>character.charCodeAt(0))],{type:sample.mime})]));
const decoded = new Set();
async function decode(key) {
  if (decoded.has(key)) return;
  const context = new AudioContext();
  try {
    await context.decodeAudioData(await blobs.get(key).arrayBuffer());
    decoded.add(key);
  } finally { await context.close(); }
}
// Native metadata promises never resolve for corrupt bytes. Decode first to
// reject them before WaveSurfer waits on metadata; the native element owns time.
function metadataReady() {
  if (audio.readyState >= 4 && Number.isFinite(audio.duration)) return Promise.resolve();
  return new Promise((resolve,reject)=>{
    const timer = setTimeout(()=>finish(new Error('Media metadata unavailable')),5000);
    function finish(error) { clearTimeout(timer); audio.removeEventListener('canplaythrough',loaded);audio.removeEventListener('error',errored);error ? reject(error) : resolve(); }
    function loaded(){finish();} function errored(){finish(new Error('Native media error'));}
    audio.addEventListener('canplaythrough',loaded,{once:true});audio.addEventListener('error',errored,{once:true});
  });
}
const audio = $('audio');
const regions = Regions.create();
const wave = WaveSurfer.create({container:$('waveform'),media:audio,height:42,normalize:true,plugins:[regions],waveColor:'#a69b8b',progressColor:'#365e54',cursorColor:'#365e54'});
let requestNumber = 0, loadingQueue = Promise.resolve(), ready = false, failed = false, requestedId = null, requestedChoice = null;
let pendingTime = 0, pendingPlaying = false, region = null, bounded = false;
function commonDuration() {
  if (!pair?.a || !pair?.b) return 0;
  const a = mediaFixtures[version(pair.a)?.audio], b = mediaFixtures[version(pair.b)?.audio];
  return a?.duration && b?.duration ? Math.min(a.duration,b.duration) : 0;
}
function validRegion(from,to) { return Number.isFinite(from) && Number.isFinite(to) && from >= 0 && from < to && to <= commonDuration(); }
function showRegion() {
  regions.clearRegions();
  if (ready && region) regions.addRegion({id:'listening',start:region.start,end:region.end,drag:true,resize:true,minLength:0.05,color:'rgba(96,145,124,.22)'});
}
function pause() { pendingPlaying = false; bounded = false; audio.pause(); renderPlayer(); }
async function load(id,time = 0,playing = false,keepBound = false) {
  const sequence = ++requestNumber;
  // The playing identity outlives the currently displayed Candidate. Retry also
  // retains it after another successful generation replaces that Candidate.
  const choice = listeningChoice(id) ?? (requestedChoice?.id === id ? requestedChoice : null);
  requestedChoice = choice ? Object.freeze({...choice}) : null;
  audio.pause(); ready = false; failed = false; requestedId = id; pendingTime = time; pendingPlaying = playing; bounded = keepBound;
  renderPlayer();
  const key = choice?.audio;
  if (!key || !blobs.has(key)) { renderPlayer(); return; }
  const delay = pair?.side === 'b' && $('late-load').checked;
  if (delay) $('late-load').checked = false;
  loadingQueue = loadingQueue.then(async ()=>{
    if (delay) await new Promise(resolve=>setTimeout(resolve,1200));
    if (sequence !== requestNumber) return;
    try {
      await decode(key);
      if (sequence !== requestNumber) return;
      await wave.loadBlob(blobs.get(key));
      await metadataReady();
      if (sequence !== requestNumber) { audio.pause(); return; }
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) throw new Error('Unavailable decoded duration');
      ready = true; failed = false;
      const position = Math.min(pendingTime,audio.duration);
      audio.currentTime = position;
      if (position >= audio.duration || bounded && region && position >= region.end) { pendingPlaying = false; bounded = false; }
      showRegion(); renderPlayer();
      if (pendingPlaying) {
        await audio.play();
        if (sequence !== requestNumber) audio.pause();
      }
    } catch {
      if (sequence !== requestNumber) return;
      audio.pause(); ready = false; failed = true; bounded = false; pendingPlaying = false;
    }
    renderPlayer();
  });
  await loadingQueue;
}
function switchSide(side) {
  if (!pair?.[side]) return;
  if (pair.side === side && requestedId === pair[side] && ready) return;
  const comparing = requestedId === pair.a || requestedId === pair.b;
  const position = comparing ? ready ? audio.currentTime : pendingTime : 0;
  const wasPlaying = comparing && (ready ? !audio.paused && !audio.ended : pendingPlaying);
  pair.side = side; persistPair();
  void load(pair[side],position,wasPlaying,bounded);
  renderPair();
}
async function play(regionOnly = false) {
  if (!ready || failed) return;
  if (regionOnly) {
    if (!region || !validRegion(region.start,region.end)) return;
    audio.currentTime = region.start; bounded = true;
  } else { bounded = false; if (audio.ended || audio.currentTime >= audio.duration) audio.currentTime = 0; }
  pendingPlaying = true;
  try { await audio.play(); } catch { failed = true; pendingPlaying = false; bounded = false; }
  renderPlayer();
}
function seek(position) {
  bounded = false; pendingTime = Math.max(0,Math.min(Number(position),ready ? audio.duration : commonDuration()));
  if (ready) audio.currentTime = pendingTime;
  renderPlayer();
}
function setRegion() {
  const from = $('region-start').value.trim(), to = $('region-end').value.trim();
  if (!from || !to || !validRegion(Number(from),Number(to))) { $('region-message').textContent = t('regionInvalid'); return; }
  region = {start:Number(from),end:Number(to)}; bounded = false; showRegion(); $('region-message').textContent = t('regionReady'); renderPlayer();
}
regions.on('region-updated',value=>{
  if (!validRegion(value.start,value.end)) {
    $('region-message').textContent = t('regionInvalid');
    if (region) value.setOptions(region);
    return;
  }
  region = {start:value.start,end:value.end}; bounded = false;
  $('region-start').value = value.start.toFixed(2); $('region-end').value = value.end.toFixed(2);
});
wave.on('interaction',()=>{ bounded = false; });
audio.addEventListener('timeupdate',()=>{
  if (ready && bounded && region && audio.currentTime >= region.end) { bounded = false; pendingPlaying = false; audio.pause(); audio.currentTime = region.end; }
  renderPlayer();
});
for (const name of ['play','pause','ended','seeked']) audio.addEventListener(name,renderPlayer);
audio.addEventListener('error',()=>{audio.pause();ready=false;failed=true;bounded=false;pendingPlaying=false;renderPlayer();});
function clock(seconds) { const value = Math.max(0,Math.floor(seconds || 0)); return `${Math.floor(value/60)}:${String(value%60).padStart(2,'0')}`; }
function renderPlayer() {
  const choice = requestedChoice;
  $('player-label').textContent = choice ? `${choice.candidate ? `${t(choice.saved ? 'saved' : 'candidate')} · ` : ''}${choice.name}` : t('notListening');
  const source = choice?.audio === 'full' ? t('copy31') : choice?.audio === 'melody' ? t('copy35') : '';
  $('player-status').textContent = `${ready ? !audio.paused ? t('playing') : audio.ended || audio.currentTime >= audio.duration ? t('ended') : t('ready') : failed ? t('audioFailed') : choice?.audio ? t('loadingAudio') : t('noAudio')}${source ? ` · ${source}` : ''}${choice?.candidate ? ` · ${choice.saved ?? choice.id}` : ''}`;
  $('player-error').hidden = !failed; $('player-error').textContent = t('audioFailed'); $('retry-audio').hidden = !failed;
  $('play').disabled = !ready || failed; $('play').textContent = t(ready && !audio.paused ? 'pause' : 'play');
  $('seek').disabled = !ready; $('seek').max = ready ? audio.duration : 0; $('seek').value = ready ? audio.currentTime : 0;
  $('seek').setAttribute('aria-label',t('seek')); $('clock').textContent = `${clock(ready ? audio.currentTime : pendingTime)} / ${clock(ready ? audio.duration : 0)}`;
  $('waveform').style.visibility = ready ? 'visible' : 'hidden';
  $('side-a').disabled = !pair?.a || !version(pair.a)?.audio; $('side-b').disabled = !pair?.b || !version(pair.b)?.audio;
  $('side-a').setAttribute('aria-pressed',String(requestedId === pair?.a)); $('side-b').setAttribute('aria-pressed',String(requestedId === pair?.b));
  $('play-region').disabled = !ready || !region || !validRegion(region.start,region.end);
  $('set-region').disabled = !ready || !commonDuration();
}
function facts(value) { return `<dl class="facts">${Object.entries(value).map(([key,item])=>`<dt>${escape(key)}</dt><dd>${escape(item)}</dd>`).join('')}</dl>`; }
function inspectInputs(value) { return facts({[t('style')]:value.style,[t('lyrics')]:value.lyrics,[t('seed')]:value.seed}); }
function renderGraph() {
  if (model.read !== 'ready') { $('graph').innerHTML = `<p role="${model.read === 'failed' ? 'alert' : 'status'}" class="${model.read === 'failed' ? 'error' : 'hint'}">${t(model.read === 'failed' ? 'readFailed' : 'loadGraph')}</p>`; return; }
  const roots = relations(model.versions);
  if (!roots) { $('graph').innerHTML = `<p class="error" role="alert">${t('relationError')}</p>`; return; }
  if (!roots.length) { $('graph').innerHTML = `<p class="empty">${t('noHistory')}</p>`; return; }
  function node(value) {
    const children = model.versions.filter(child=>child.parent === value.id);
    return `<li data-version-id="${escape(value.id)}"><button class="version-node ${value.id === model.selected ? 'active' : ''}" data-inspect="${escape(value.id)}">${escape(value.name)}</button><small>${escape(value.parent ? `${t('parent')}: ${value.parent}` : t('root'))}${value.audio ? '' : ` · ${t('noAudio')}`}</small>${children.length ? `<ul>${children.map(node).join('')}</ul>` : ''}</li>`;
  }
  $('graph').innerHTML = `<ul class="forest">${roots.map(node).join('')}</ul>`;
}
function renderInspection() {
  const choice = version(model.selected), valid = model.read === 'ready' && relations(model.versions);
  $('inspection').innerHTML = choice ? `<h3>${escape(choice.name)}</h3>${facts({ID:choice.id,[t('parent')]:choice.parent ?? t('root'),[t('result')]:choice.audio ? `${choice.id}/audio · ${t(choice.audio === 'full' ? 'copy31' : 'copy35')}` : t('noAudio')})}${inspectInputs(choice.inputs)}<button data-branch="${escape(choice.id)}" ${valid ? '' : 'disabled'}>${t('branch')}</button>` : `<p class="hint">${t('noSelection')}</p>`;
  $('score-snapshot').textContent = choice?.inputs.abc ?? t('noSelection'); $('input-snapshot').innerHTML = choice ? inspectInputs(choice.inputs) : t('noSelection');
  $('origin').textContent = `${t('origin')}: ${version(model.origin)?.name ?? t('noOrigin')}`;
  $('generate').disabled = !valid || Boolean(model.job && ['queued','running'].includes(model.job.status));
  $('cancel').disabled = !model.job || !['queued','running'].includes(model.job.status);
}
function renderJob() {
  const job = model.job;
  $('job').innerHTML = job ? `<div class="job-card" data-job-id="${escape(job.id)}"><h3>${t('jobState')} · ${escape(job.status)}</h3><p role="status">${t({queued:'jobQueued',running:'jobRunning',completed:'jobCompleted',failed:'jobFailed',cancelled:'jobCancelled'}[job.status])}</p>${facts({[t('origin')]:job.parent ?? t('root'),[t('style')]:job.inputs.style,[t('seed')]:job.inputs.seed})}${job.status === 'failed' ? `<button id="retry-generate">${t('retryGenerate')}</button>` : ''}</div>` : '';
  const candidate = model.candidate;
  $('candidate').innerHTML = candidate ? `<div class="candidate-card" data-candidate-id="${escape(candidate.id)}"><h3>${t(candidate.saved ? 'saved' : 'candidate')}</h3>${facts({[t('origin')]:candidate.parent ?? t('root'),[t('style')]:candidate.inputs.style,[t('seed')]:candidate.inputs.seed})}<button id="listen-candidate">${t('listen')}</button>${candidate.saved ? `<button id="inspect-saved">${t('saved')}</button>` : `<label>${t('name')}<input id="save-name" value="${escape(candidate.name)}" ${candidate.intent ? 'readonly' : ''}></label><button id="save-version" class="primary">${t('save')}</button>`}${saveNotice ? `<p class="error" role="alert">${t(saveNotice)}</p>` : ''}</div>` : '';
  $('state-summary').innerHTML = facts({[t('projectState')]:'preview-project',[t('versionsState')]:model.versions.length,[t('origin')]:model.origin ?? t('none'),[t('jobState')]:model.job?.status ?? t('none'),[t('candidate')]:model.candidate?.id ?? t('none'),[t('pairState')]:pair ? `${pair.a} / ${pair.b} · ${pair.side.toUpperCase()}` : t('none')}).replace(/^<dl[^>]*>|<\/dl>$/g,'');
}
function renderPair() {
  const options = `<option value="">—</option>${model.versions.map(choice=>`<option value="${escape(choice.id)}" ${choice.audio ? '' : 'disabled'}>${escape(choice.name)}${choice.audio ? '' : ` · ${t('noAudio')}`}</option>`).join('')}`;
  for (const side of ['a','b']) { $(`choose-${side}`).innerHTML = options; $(`choose-${side}`).value = pair?.[side] ?? ''; }
  $('pair-message').textContent = pairNotice ? t(pairNotice) : pair?.b ? t('pairReady') : t('pairInvalid');
}
function render() {
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en'; document.documentElement.dataset.theme = theme;
  document.title = language === 'zh' ? '声间 · 版本与比较预览' : 'Shengjian · Versions and compare preview';
  document.querySelector('.sidebar nav').setAttribute('aria-label',language === 'zh' ? '项目导航' : 'Project navigation');
  document.querySelectorAll('[data-t]').forEach(element=>{ element.textContent = t(element.dataset.t); });
  $('language').textContent = language === 'zh' ? 'English' : '中文'; $('theme').textContent = t(theme === 'light' ? 'dark' : 'light');
  $('persistent-player').setAttribute('aria-label',language === 'zh' ? '持续播放器' : 'Persistent player');
  renderGraph(); renderInspection(); renderJob(); renderPair(); renderPlayer(); renderWalk();
  $('sample-details').innerHTML = facts({A:t('copy35'),B:t('copy31'),[language === 'zh' ? '真实共同父版本' : 'Actual shared parent']:'cc4298f6-33e2-4e9c-9cdd-66700f83a683',[language === 'zh' ? '模拟关系' : 'Simulated relationships']:'preview-v1 → preview-v2 / preview-v3'});
  wave.setOptions({waveColor:theme === 'dark' ? '#b6b3a5' : '#a69b8b',progressColor:theme === 'dark' ? '#a7cebb' : '#365e54',cursorColor:theme === 'dark' ? '#a7cebb' : '#365e54'});
}
function applyInputs(id) {
  const choice = version(id); if (!choice || model.read !== 'ready' || !relations(model.versions)) return;
  model.origin = id; $('style').value = choice.inputs.style; $('lyrics').value = choice.inputs.lyrics; $('seed').value = choice.inputs.seed;
  pendingOrigin = null; $('branch-choice').hidden = true; $('draft-message').textContent = t('selected'); render();
}
function runJob(snapshot = null) {
  const seed = Number($('seed').value), origin = version(model.origin);
  if (!snapshot && (!origin || !relations(model.versions) || model.read !== 'ready' || !$('style').value.trim() || !$('seed').value.trim() || !Number.isSafeInteger(seed) || seed < 0)) { $('draft-message').textContent = t('invalidInputs'); return; }
  if (model.job && ['queued','running'].includes(model.job.status)) return;
  const submitted = snapshot ?? {parent:origin.id,inputs:{style:$('style').value,lyrics:$('lyrics').value,seed,abc:origin.inputs.abc}};
  const id = `preview-job-${++model.serial}`;
  model.job = {id,status:'queued',...structuredClone(submitted)}; saveNotice = ''; render();
  jobTimer = setTimeout(()=>{
    if (model.job?.id !== id || model.job.status !== 'queued') return;
    model.job.status = 'running'; render();
    jobTimer = setTimeout(()=>{
      if (model.job?.id !== id || model.job.status !== 'running') return;
      if ($('failure').value === 'generate') { $('failure').value = 'none'; model.job.status = 'failed'; }
      else { model.job.status = 'completed'; model.candidate = {id:`preview-candidate-${model.serial}`,parent:model.job.parent,inputs:structuredClone(model.job.inputs),audio:'full',name:'New direction',intent:null,saved:null}; }
      render();
    },350);
  },250);
}
function saveCandidate() {
  const candidate = model.candidate; if (!candidate || candidate.saved) return;
  const name = candidate.intent?.name ?? $('save-name').value.trim();
  if (!name) { saveNotice = 'invalidName'; renderJob(); return; }
  candidate.name = name; candidate.intent ??= {name,parent:candidate.parent};
  if ($('failure').value === 'save') { $('failure').value = 'none'; saveNotice = 'saveFailed'; renderJob(); return; }
  if (!version(candidate.intent.parent)) { saveNotice = 'relationError'; renderJob(); return; }
  const saved = {id:`preview-saved-${candidate.id}`,name:candidate.intent.name,parent:candidate.intent.parent,audio:candidate.audio,inputs:structuredClone(candidate.inputs)};
  model.versions.push(saved); candidate.saved = saved.id; saveNotice = ''; model.selected = saved.id;
  if (requestedChoice?.candidate && requestedChoice.id === candidate.id) {
    requestedChoice = Object.freeze({...requestedChoice,name:saved.name,saved:saved.id});
  }
  render();
}
function setPair(a,b) {
  if (!version(a)?.audio || b && (!version(b)?.audio || a === b)) { pairNotice = 'pairInvalid'; renderPair(); return; }
  pause(); pair = {a,b:b || null,side:'a'}; pairNotice = b ? 'pairReady' : 'pairInvalid';
  if (region && !validRegion(region.start,region.end)) { region = null; $('region-message').textContent = t('regionReset'); }
  persistPair(); void load(a); render();
}
function scenario(kind) {
  clearTimeout(jobTimer); pause(); ++requestNumber; ready = false; failed = false; requestedId = null; requestedChoice = null; region = null; regions.clearRegions();
  model = {versions:fixture(),selected:'preview-v1',origin:null,job:null,candidate:null,read:'ready',serial:model.serial}; pendingOrigin = null; saveNotice = ''; pairNotice = ''; $('branch-choice').hidden = true; $('draft-message').textContent = ''; $('region-message').textContent = t('noPairRegion');
  if (kind === 'empty') model.versions = [];
  if (kind === 'one') model.versions = [model.versions[0]];
  if (kind === 'missing') model.versions[2].audio = null;
  if (kind === 'bad') model.versions.push({id:'preview-bad',name:'Corrupt audio example',parent:'preview-v1',audio:'bad',inputs:{...inputs}});
  if (kind === 'parent') model.versions[2].parent = 'preview-missing-parent';
  if (kind === 'cycle') model.versions[0].parent = 'preview-v2';
  if (kind === 'read' || kind === 'loading') model.read = kind === 'read' ? 'failed' : 'loading';
  model.selected = model.versions[0]?.id ?? null;
  const available = model.versions.filter(choice=>choice.audio);
  pair = available.length ? {a:available[0].id,b:kind === 'bad' ? 'preview-bad' : available[1]?.id ?? null,side:'a'} : null;
  if (kind === 'normal') pair = {a:'preview-v2',b:'preview-v3',side:'a'};
  $('style').value = ''; $('lyrics').value = ''; $('seed').value = '';
  render(); if (pair && model.read === 'ready') void load(pair.a);
}
const walkSteps = {branch:[['stepInspect',()=>{model.selected='preview-v1';render();}],['stepInputs',()=>applyInputs('preview-v1')],['stepGenerate',()=>runJob()],['stepSave',()=>saveCandidate()]],compare:[['stepRegion',()=>{$('region-start').value=2;$('region-end').value=4;setRegion();}],['stepPlayRegion',()=>void play(true)],['stepLong',()=>{switchSide('a'); if(ready)seek(33);else pendingTime=33;}],['stepShort',()=>switchSide('b')]],failure:[['stepBad',()=>switchSide('b')],['stepRecover',()=>setPair('preview-v2','preview-v3')]]};
function renderWalk() {
  $('walk-help').textContent = walkthrough ? t({branch:'walkBranchHelp',compare:'walkCompareHelp',failure:'walkFailureHelp'}[walkthrough]) : '';
  $('walk-steps').innerHTML = walkthrough ? walkSteps[walkthrough].map(([key],index)=>`<button data-step="${index}">${t(key)}</button>`).join('') : '';
}
function tab(name) { document.querySelectorAll('[data-tab]').forEach(button=>{const active=button.dataset.tab===name;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));}); for(const section of ['versions','compare','score','lyrics']) $(`${section}-view`).hidden=section!==name; }
document.addEventListener('click',event=>{
  const button = event.target.closest('button'); if (!button) return;
  if (button.dataset.inspect) { model.selected=button.dataset.inspect; render(); }
  if (button.dataset.branch) { pendingOrigin=button.dataset.branch; $('branch-choice').hidden=false; }
  if (button.dataset.tab) tab(button.dataset.tab);
  if (button.dataset.walk) { walkthrough=button.dataset.walk; scenario(walkthrough === 'failure' ? 'bad' : 'normal'); tab(walkthrough === 'branch' ? 'versions' : 'compare'); }
  if (button.dataset.step != null) walkSteps[walkthrough]?.[Number(button.dataset.step)]?.[1]();
  if (button.id==='language') { language=language==='zh'?'en':'zh';render(); }
  if (button.id==='theme') { theme=theme==='light'?'dark':'light';render(); }
  if (button.id==='use-inputs') applyInputs(pendingOrigin);
  if (button.id==='keep-draft') { pendingOrigin=null;$('branch-choice').hidden=true; }
  if (button.id==='generate') runJob();
  if (button.id==='retry-generate' && model.job) runJob({parent:model.job.parent,inputs:model.job.inputs});
  if (button.id==='cancel' && model.job) { clearTimeout(jobTimer);model.job.status='cancelled';render(); }
  if (button.id==='save-version') saveCandidate();
  if (button.id==='inspect-saved') { model.selected=model.candidate.saved;render(); }
  if (button.id==='listen-candidate' && model.candidate) { pause();void load(model.candidate.id,0,true); }
  if (button.id==='apply-pair') setPair($('choose-a').value,$('choose-b').value);
  if (button.id==='side-a') switchSide('a'); if (button.id==='side-b') switchSide('b');
  if (button.id==='play') { if(audio.paused)void play();else pause(); }
  if (button.id==='retry-audio') void load(requestedId);
  if (button.id==='set-region') setRegion(); if (button.id==='play-region') void play(true);
  if (button.id==='start-scenario') { walkthrough=null;scenario($('scenario').value); }
  if (button.id==='reread') { model.read='loading';renderGraph();setTimeout(()=>{model.read='ready';render();if(pair && !requestedId)void load(pair[pair.side]);},350); }
});
$('seek').addEventListener('input',event=>seek(event.target.value));
document.addEventListener('input',event=>{if(event.target.id === 'save-name' && model.candidate && !model.candidate.intent)model.candidate.name=event.target.value;});
$('storage-blocked').addEventListener('change',()=>{persistPair();renderPair();});
restorePair(); render(); void load(pair[pair.side]);
