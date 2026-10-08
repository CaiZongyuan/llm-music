const $ = id => document.getElementById(id);
const SAMPLE = 'X:1\nT:\nM:4/4\nL:1/16\nQ:1/4=96\nV: Vocal clef=treble name="Vocal Melody" snm="Vocal"\nV: Ins clef=treble name="Ins Melody" snm="Inst."\nK:C\n% verse\nV: Vocal\n"C"C4E4G4E4|"Am"A4c4B4A4|"F"F4A4c4A4|"G"G4B4d4G4|\nV: Ins\nC,8G,8|A,8E8|F,8C8|G,8D8|\n';
const messages = {
  en: {
    skip:'Skip to workspace', banner:'Isolated interaction preview · Generation and saving are simulated in memory; notation and MIDI come from your ABC.', checkStates:'Explore other states', library:'▦ My projects', jobs:'≋ Jobs', runtime:'◉ Runtime', settings:'⚙ Preferences', project:'CREATIVE PROJECT', projectName:'A walk after rain', savedVersions:'Saved Versions', local:'Local creation, at your pace\nShort excerpts · Listen, then keep', breadcrumb:'My projects / A walk after rain', dark:'Dark', light:'Light', eyebrow:'SCORE WORKSPACE', title:'Let your next creation hear your edits', question:'Change a few notes, listen, then explicitly select the Score for regeneration. Further edits keep submitted inputs and old Versions intact.', scoreTab:'Score', lyricsTab:'Lyrics', versionsTab:'Versions', noScore:'No Score yet', noScoreHelp:'Generate or transcribe to obtain a Score. Open an independent example to explore this preview.', openExample:'Open example Score', draft:'ABC draft', draftHelp:'Change C D E F below and explore the melody. Your text does not rewrite saved Versions.', abcLabel:'ABC Score text', validate:'Update notation', restore:'Restore original into draft', notation:'Notation & audition', playScore:'Audition draft MIDI', export:'Export draft MIDI', select:'Select this Score', synthHelp:'Audition uses a simple tone synthesized from the current MIDI notes to inspect pitch and rhythm.', selected:'Score for the next generation', selectedText:'Inspect selected ABC snapshot', regenerate:'Regenerate from selected Score', regenerateHelp:'Select a valid draft, then try another style for the same melody. This preview simulates the Job and saving flow.', style:'Style', lyrics:'Lyrics', seed:'Seed', length:'Short excerpt baseline', generate:'Generate from selected Score', result:'Listen & keep', lyricsHelp:'Your current creative draft; switching tabs keeps the bottom Player running.', versionsHelp:'Only explicitly saved Candidates appear here. Inspect snapshots for the parent Version and actual submitted ABC.', playerEmpty:'Choose music to audition', playerHelp:'Draft MIDI, Candidates and Versions share this Player', saveTitle:'Keep this creation', versionName:'Version name', save:'Save as new Version', close:'Close', stateTitle:'Isolated state checks', stateHelp:'A simulated failure affects only the next corresponding action. Text, selected snapshots and old Versions remain. Refresh resets this page’s memory.', reset:'Start again', invalidScenario:'Invalid ABC', loadingScenario:'Reload Score', previewFail:'Fail next notation', playbackFail:'Fail next audition', exportFail:'Fail next export', generationFail:'Fail next generation', saveFail:'Fail next save', hold:'Hold Job; continue editing', complete:'Resume and complete Job', cancelRace:'Complete while cancelling', valid:'Valid draft', dirty:'Draft changed', checking:'Checking draft…', invalid:'ABC needs correction', previewFailed:'Notation unavailable', previewError:'Notation could not be rendered. Your text remains; update notation to retry.', noSelected:'No Score selected. Check and audition the draft, then select it.', selectNeeded:'The draft changed. Check it and select again before generating.', ready:'The selected Score matches this valid draft.', selectedToast:'Score selected; its ABC and parent are frozen.', draftSnapshot:'Draft revision', oldNotation:'Showing the last valid notation; it is not the current draft.', currentNotation:'Notation and MIDI match the current draft.', checkFirst:'Check a valid draft first.', playingScore:'Draft MIDI', tone:'Simple MIDI tone · actual edited notes', historical:'Historical PR #58 audio · not a new inference result', actionFail:'This action failed in the simulation. Retry; the draft is preserved.', exportDone:'MIDI download requested from this exact draft.', inputError:'Use a non-empty style and lyrics, and a non-negative safe-integer seed.', queued:'Queued', running:'Synthesizing audio', held:'Job held for editing review', cancelRequested:'Cancellation requested…', completed:'Completed', failed:'Generation failed', cancelled:'Cancelled', cancel:'Cancel Job', retry:'Retry same submitted input', job:'GenerateFromScore Job', input:'Submitted input', parent:'Parent Version', frozen:'Frozen at submission; later edits are not included.', noCandidate:'Your next result will be a Candidate. Listen before deciding to save.', candidate:'Unsaved Candidate', candidateHelp:'Simulated result. Audition reuses historical PR #58 music; this audio does not demonstrate your edited melody or quality.', listen:'Listen', inspect:'Inspect snapshot', saved:'Saved Version', saveFailed:'Saving failed in the simulation. The Candidate and name remain; retry to keep it.', saving:'Saving…', saveDone:'Saved one new Version; its parent and submitted ABC are preserved.', original:'V1 · Original example', originalHelp:'Independent example Score; historical sample audio.', draftPreserved:'Text is preserved. Correct the ABC and update notation.', missingHeaders:'Add X: and K: headers to the ABC.', oneTune:'Use one tune in this preview.', noNotes:'No playable notes found.', limit:'This preview supports MIDI up to 120 seconds and 10,000 notes.', loadingMessage:'Reading the isolated Score…', loaded:'The same Score is available again; draft text is unchanged.', armed:'The next corresponding action will fail once.', noJob:'Start a Job first.', holdArmed:'The next Job will wait so you can edit its draft.', raceArmed:'The next cancellation will finish the Job first.', cancelHelp:'Cancellation produces no new Candidate or Version.', unknown:'Progress unknown · phase only', selectedRev:'Selected revision', unchanged:'Original V1 remains unchanged.', playbackError:'Playback failed. Retry the audition; the Score text is preserved.', copied:'Restored into the draft. Select it before another generation.', play:'Play', pause:'Pause', seek:'Seek audio', playerLabel:'Persistent audio Player', notationLabel:'Score notation', navLabel:'Project navigation', exportRevision:'MIDI revision', nameEmpty:'Enter a Version name.'
  },
  zh: {
    light:'亮色',
    valid:'有效草稿', dirty:'草稿已修改', checking:'正在检查草稿…', invalid:'ABC 需要修正', previewFailed:'谱面暂不可用', previewError:'谱面渲染失败。文本已保留，点击更新谱面重试。', noSelected:'尚未选定 Score。先检查、试听草稿，再选定它。', selectNeeded:'草稿已变化。先检查并重新选定，再生成。', ready:'已选定 Score 与当前有效草稿一致。', selectedToast:'已选定 Score，ABC 与父版本快照已冻结。', draftSnapshot:'草稿修订', oldNotation:'这里保留上一份有效谱面，不代表当前草稿。', currentNotation:'谱面与 MIDI 对应当前草稿。', checkFirst:'请先检查有效草稿。', playingScore:'草稿 MIDI', tone:'简单 MIDI 音色 · 来自实际编辑音符', historical:'历史 PR #58 音乐 · 并非本次新推理结果', actionFail:'模拟此操作失败。可重试，草稿已保留。', exportDone:'已请求下载这份草稿对应的 MIDI。', inputError:'请填写风格与歌词；seed 必须是非负安全整数。', queued:'排队中', running:'正在合成音频', held:'任务暂停，供编辑流程检查', cancelRequested:'正在请求取消…', completed:'已完成', failed:'生成失败', cancelled:'已取消', cancel:'取消任务', retry:'用同一提交快照重试', job:'GenerateFromScore 任务', input:'实际提交输入', parent:'父版本', frozen:'提交时已冻结，后续草稿修改不会进入本次任务。', noCandidate:'下一次结果将成为 Candidate。先试听，再决定是否保存。', candidate:'未保存 Candidate', candidateHelp:'模拟结果。试听复用历史 PR #58 音乐，不能据此判断本次修改的旋律或生成质量。', listen:'试听', inspect:'查看快照', saved:'已保存 Version', saveFailed:'模拟保存失败。Candidate 与名称已保留，重试即可。', saving:'正在保存…', saveDone:'已保存一个新 Version，父版本与实际提交 ABC 已保留。', original:'V1 · 原始示例', originalHelp:'独立示例 Score，搭配历史音乐试听。', draftPreserved:'文本已保留，请修正 ABC 后更新谱面。', missingHeaders:'ABC 需要 X: 与 K: 标头。', oneTune:'此预览请使用一首乐曲。', noNotes:'没有可播放的音符。', limit:'此预览支持 120 秒以内、10,000 个音符以内的 MIDI。', loadingMessage:'正在读取隔离 Score…', loaded:'已重新读取同一 Score，草稿文本未变化。', armed:'对应的下一次操作将失败一次。', noJob:'请先开始任务。', holdArmed:'下一次任务会暂停，便于继续编辑检查。', raceArmed:'下一次取消会演示任务先完成的竞态。', cancelHelp:'取消不会新增 Candidate 或 Version。', unknown:'进度未知 · 只显示阶段', selectedRev:'已选定修订', unchanged:'原始 V1 内容保持不变。', playbackError:'试听失败。可重新试听，Score 文本已保留。', copied:'已恢复到草稿，下次生成前请明确选定。', play:'播放', pause:'暂停', seek:'音频定位', playerLabel:'持续音频播放器', notationLabel:'乐谱谱面', navLabel:'项目导航', exportRevision:'MIDI 修订', nameEmpty:'请输入版本名称。'
  }
};
document.querySelectorAll('[data-t]').forEach(element => { messages.zh[element.dataset.t] ??= element.textContent; });
Object.assign(messages.en, {
  banner:'Isolated interaction preview · Upload reads local files only; transcription, generation and saving are simulated; notation and MIDI come from current ABC.',
  title:'Take a familiar melody into a different style', question:'Transcribe a reference, inspect and edit, then explicitly select a Score for a new interpretation. Explore chord guidance, preserving intermediate Scores after failure, and choosing what to save.',
  coverTab:'Cover & Score', referenceTitle:'1 · Reference audio & Cover mode', referenceHelp:'Listen to a short excerpt, then turn it into Score. Your upload stays in this browser.',uploadLabel:'Choose a local WAV / FLAC / MP3',sampleReference:'Use historical example · V1',listenReference:'Listen to reference', fullDescription:'Notes, rhythm and chord guidance',melodyDescription:'Notes and rhythm, without chord guidance', modeLimit:'Modes choose the scope of Score guidance. Neither guarantees the original recording’s sound, accompaniment or note accuracy. Inspect the transcription first.',transcribe:'Simulate transcription', noScore:'No intermediate Score yet',noScoreHelp:'Choose reference audio and simulate transcription. Its ABC, notation and audition will remain here.',draft:'2 · Inspect & edit ABC',draftHelp:'Check melody, rhythm and any chord guidance in full mode. This independent example does not represent transcription of your reference; try editing a few notes.',restore:'Restore transcription into draft',synthHelp:'Audition synthesizes the current MIDI in a simple tone to check pitch, rhythm and chords. It is not newly generated music.',selected:'Explicitly selected intermediate Score',regenerate:'3 · Try another style',regenerateHelp:'Generation uses the explicitly selected Score. Changing mode keeps your draft; inspect the effective input and select it again.',style:'New style',generate:'Simulate Cover generation',result:'4 · Listen to the Candidate, then decide',stateHeading:'Current creation state',memoryHelp:'Simulated objects live in this page’s memory. Refresh resets them. Editing does not alter selected or submitted snapshots.',guidedTitle:'Try a guided path',happyWalk:'Complete Cover',failureWalk:'Continue after failure',modeWalk:'Switch modes',lyricsHelp:'The bottom Player continues across tabs. Lyrics changes apply only to your next explicit submission.',versionsHelp:'Completion creates a Candidate. Only explicit saving creates a Version. Inspect reference, mode, ABC and parent snapshots.',playerHelp:'Reference, draft MIDI, Candidates and Versions share this Player',saveTitle:'Keep this Cover',save:'Simulate saving a new Version',stateHelp:'Each simulated failure affects the corresponding action; valid intermediate Scores, references and old Versions stay. State lives only in memory.',transcriptionFail:'Fail next transcription',unsupportedScenario:'Selected mode unsupported',modelsScenario:'Required models missing',readyScenario:'Restore ready state',oomScenario:'Next generation runs out of memory',loadingScenario:'Reload intermediate Score',emptyReference:'No reference selected',referenceName:'Reference audio',referenceHistorical:'Historical PR #58 audio · source V1; not a new Cover result',referenceLocal:'Local file · no upload to a server · no parent Version',transcribeJob:'Simulated Transcribe Job',transcribing:'Transcribing',transcriptionFailed:'Transcription failed. The reference and prior intermediate Score remain. Retry transcription.',newReference:'Reference changed. The previous intermediate Score remains; transcribe this reference before another Cover.',modeChanged:'Mode changed. Your draft remains. Inspect effective ABC and explicitly select this mode before generating.',unsupported:'This mode is unsupported in the simulated Runtime. No Job was created and no other mode was substituted.',modelsMissing:'Required models are missing in this simulation. Restore ready state before submitting; your Score stays.',outOfMemory:'Simulated generation ran out of memory. Your reference, inspected Score and submitted input remain. Retry as a new Job.',referenceError:'Choose a playable WAV, FLAC or MP3 file, up to 25 MiB and 40 seconds for this preview.',decodingReference:'Reading reference audio…',mode:'Cover mode',sourceScore:'Intermediate Score',effective:'Effective ABC for this mode',effectiveHelp:'melody omits musical chord symbols and retains both voices. full retains supplied chords as guidance. Voice names stay intact.',modeFullHelp:'full passes both voices and supplied chord symbols as harmony guidance. A chordless Score is valid but supplies no explicit harmony.',modeMelodyHelp:'melody retains both voices’ notes and rhythm and omits chord symbols. New style guides accompaniment. The effective ABC below makes that omission visible.',parentNone:'No parent · uploaded reference',scoreRetained:'Your intermediate Score is preserved; no new Candidate or Version was added.',pendingSelection:'Check the current draft and explicitly select it for this mode.',selectedMode:'Selected mode',source:'Source',viewEffective:'Inspect selected and effective ABC',effectiveDraft:'Effective input preview',transcriptionSource:'Independent simulated transcription fixture',noNotation:'Update a valid draft to see notation.',snapshotMode:'Mode and supplied musical guidance are frozen at submission.',readyState:'Ready (simulated)',modeUnavailable:'Mode unavailable (simulated)',modelsUnavailable:'Models missing (simulated)',candidateHelp:'Simulated Candidate. Audition reuses historical PR #58 music; it does not demonstrate this Cover’s melody, harmony or quality.',happyHelp:'Start with historical V1, transcribe, inspect and select, then generate and explicitly save. Each step performs the actual preview action.',failureHelp:'Start with a valid selected intermediate Score. Simulate a generation failure; the Score survives, then retry the same frozen input as a new Job.',modeWalkHelp:'Start with full mode, inspect the chord symbols, then switch to melody. Select again and inspect the effective ABC: notes and voice names remain, chord labels are omitted.',startWalk:'Start walkthrough',stepReference:'1 · Use V1 reference',stepTranscribe:'2 · Transcribe',stepSelect:'3 · Select inspected Score',stepGenerate:'4 · Generate',stepSave:'5 · Open explicit save',stepFailure:'4 · Arm generation failure',stepRetry:'6 · Retry submitted input',stepMelody:'4 · Switch to melody',stepSnapshot:'6 · Inspect effective snapshot',referenceStatus:'Reference',scoreStatus:'Intermediate Score',selectionStatus:'Selected Score',submissionStatus:'Submitted Job',candidateStatus:'Candidate',versionStatus:'Saved Versions',noJob:'No Job yet',noSelected:'No Score selected. Check and audition the draft, then select it for the current mode.',selectNeeded:'Draft or mode changed. Inspect and select again before generating.',job:'Simulated Cover Job',input:'Frozen submitted input',retry:'Retry same submitted input as a new Job',frozen:'Frozen at submission; later draft, mode or style edits are not included.',originalHelp:'Historical V1 example. Its audio and independent Score are not claimed to match.',unchanged:'Original V1 remains unchanged.',tone:'Simple tone · current MIDI notes and chords',snapshotTitle:'Selected source and effective input',missingNativeVoice:'Keep Vocal and Ins voice definitions for this preview.',chordlessFull:'No detected chord symbols: full carries no explicit harmony guidance.',saveDone:'Saved one simulated derived Version with its reference, mode, ABC and explicit parent.',saveFailed:'Simulated save failed. The Candidate and name remain; retry to keep the same result.',saveParent:'Parent Version'
});
Object.assign(messages.zh, {
  emptyReference:'尚未选择参考音频',referenceName:'参考音频',referenceHistorical:'历史 PR #58 音乐 · 来源 V1；不是本次 Cover 结果',referenceLocal:'本地文件 · 不上传到服务 · 无父版本',transcribeJob:'模拟转谱任务',transcribing:'正在转谱',transcriptionFailed:'模拟转谱失败。参考素材与已有中间乐谱已保留，可重新转谱。',newReference:'参考素材已变化。旧中间乐谱仍保留，请为新参考转谱后再改编。',modeChanged:'模式已改变，草稿保留。请检查有效 ABC 并再次明确选定，再生成。',unsupported:'模拟 Runtime 未支持此模式，没有创建任务，也没有替换成另一模式。',modelsMissing:'模拟缺少所需模型。恢复可用后再提交，中间乐谱仍保留。',outOfMemory:'模拟生成显存不足。参考、已检查乐谱和提交快照仍保留，可用新任务重试。',referenceError:'请选择可播放的 WAV、FLAC 或 MP3。本预览限制 25 MiB、40 秒以内。',decodingReference:'正在读取参考音频…',mode:'Cover 模式',sourceScore:'中间乐谱',effective:'该模式的有效 ABC',effectiveHelp:'melody 只去掉音乐和弦符号，保留两个声部。full 将已有和弦作为提示。声部名称保持完整。',modeFullHelp:'full 传递两个声部及已有和弦，作为和声提示。无和弦的乐谱仍有效，但不提供明确和声依据。',modeMelodyHelp:'melody 保留两个声部的音符、节奏，去掉和弦符号。新风格引导伴奏；下方有效 ABC 会明确显示删去的和弦。',parentNone:'无父版本 · 本地参考',scoreRetained:'中间乐谱保留，未新增 Candidate 或 Version。',pendingSelection:'先检查当前草稿，并为此模式明确选定。',selectedMode:'选定模式',source:'来源',viewEffective:'检查选定与有效 ABC',effectiveDraft:'有效输入预览',transcriptionSource:'独立模拟转谱示例',noNotation:'先更新有效草稿，谱面将在这里显示。',snapshotMode:'模式与音乐提示在提交时冻结。',readyState:'可用（模拟）',modeUnavailable:'模式不可用（模拟）',modelsUnavailable:'缺少模型（模拟）',candidateHelp:'模拟 Candidate。试听复用历史 PR #58 音乐，不能据此判断此次 Cover 的旋律、和声或质量。',happyHelp:'从历史 V1 开始，转谱、检查选定、生成，再明确保存。每一步都执行实际预览操作。',failureHelp:'先建立有效选定的中间乐谱。模拟生成失败后，乐谱仍保留，再用同一冻结输入创建新任务重试。',modeWalkHelp:'从 full 开始，检查和弦符号，再切换 melody。重新选定后检查有效 ABC：音符与声部名称保留，和弦标签去掉。',startWalk:'开始此路径',stepReference:'1 · 使用 V1 参考',stepTranscribe:'2 · 转谱',stepSelect:'3 · 选定检查后的乐谱',stepGenerate:'4 · 生成',stepSave:'5 · 打开明确保存',stepFailure:'4 · 下次生成失败',stepRetry:'6 · 重试提交输入',stepMelody:'4 · 切换 melody',stepSnapshot:'6 · 检查有效快照',referenceStatus:'参考',scoreStatus:'中间乐谱',selectionStatus:'选定乐谱',submissionStatus:'提交任务',candidateStatus:'Candidate',versionStatus:'已保存版本',noJob:'尚无任务',selectNeeded:'草稿或模式已变化。请检查并重新选定，再生成。',job:'模拟 Cover 任务',input:'冻结提交输入',retry:'以原提交输入创建新任务重试',frozen:'提交时冻结；后续草稿、模式或风格修改不进入此次任务。',originalHelp:'历史 V1 示例；独立乐谱与音频不声称音乐内容相同。',tone:'简单音色 · 当前 MIDI 音符与和弦',snapshotTitle:'选定源谱与有效输入',missingNativeVoice:'此预览请保留 Vocal 与 Ins 声部定义。',chordlessFull:'未检测到和弦符号：full 不提供明确和声提示。',saveDone:'已保存一个模拟派生 Version，参考来源、模式、ABC 与明确父版本保留。',saveParent:'父版本',regenerateHelp:'从明确选定的乐谱开始。改变模式保留草稿；检查有效输入后再次选定，再生成。'
});
messages.en.uploadLabel='Choose a local WAV';messages.en.referenceError='Choose a playable WAV, up to 25 MiB and 40 seconds for this preview.';
messages.zh.referenceError='请选择可播放的 WAV。本预览限制 25 MiB、40 秒以内。';
messages.en.playEffective='Audition selected effective MIDI';messages.zh.playEffective='试听选定的有效输入 MIDI';
messages.en.currentLimit='This preview explores the upcoming Cover flow. Released generation from selected Score currently supports full only.';
messages.en.selectNeeded='Draft, source Score, reference or mode changed. Inspect and select again before generating.';messages.zh.selectNeeded='草稿、来源乐谱、参考或模式已变化。请检查并重新选定，再生成。';
messages.en.stepReselect='5 · Select melody input';messages.zh.stepReselect='5 · 选定 melody 输入';messages.en.failureGenerate='5 · Generate';messages.zh.failureGenerate='5 · 生成';
let language = 'zh';
const t = key => messages[language][key] ?? messages.en[key];
const localizedError = text => {
  for (const key of Object.keys(messages.en)) if (text === messages.en[key] || text === messages.zh[key]) return t(key);
  return text;
};
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const freeze = value => { Object.values(value).forEach(item => { if (item && typeof item === 'object') freeze(item); }); return Object.freeze(value); };

// The small in-memory domain model owns snapshots; it has no DOM or media effects.
const model = {
  initial() { return { present:false, draft:'', revision:0, reference:null, source:null, mode:'full', supported:true, models:true, transcribe:null, selected:null, job:null, candidate:null, nextId:1, versions:[freeze({id:'preview-version-1', nameKey:'original', abc:SAMPLE, parent:null, input:null})] }; },
  select(state,effectiveABC) { state.selected = freeze({abc:state.draft,effectiveABC,mode:state.mode, revision:state.revision, sourceScore:state.source.id,reference:{...state.source.reference},parent:state.source.reference.parent}); },
  submit(state, fields, input = null) {
    const payload = input ?? freeze({score:{...state.selected}, style:fields.style, lyrics:fields.lyrics, settings:{seed:fields.seed, maxSeconds:35}});
    state.job = {id:`preview-job-${state.nextId++}`, state:'queued', input:payload};
    return state.job;
  },
  complete(state, job) { if (state.job !== job || !['queued','running','cancelRequested'].includes(job.state)) return; job.state='completed'; state.candidate={id:`preview-candidate-${state.nextId++}`, input:job.input, savedVersion:null}; },
  save(state, candidate, name) { if (candidate.savedVersion) return candidate.savedVersion; const version=freeze({id:`preview-version-${state.nextId++}`, name, abc:candidate.input.score.effectiveABC, parent:candidate.input.score.parent, input:candidate.input}); state.versions.push(version); candidate.savedVersion=version; return version; }
};
let state = model.initial();
let checked = null, checkStatus = 'checking', checkError = '', actionError = '', media = null;
let validationTimer, jobTimer, transcribeTimer, referenceRead=0, saveTarget, saveBusy = false, loading = false;
let walkthrough='happy';
const failures = new Set();
let holdNext = false, cancelRace = false;
const audio = $('audio');
const referenceUrls=new Set();
const consume = name => { const value=failures.has(name); failures.delete(name); return value; };
const isCurrent = () => checked?.abc === state.draft && checkStatus === 'valid';
const active = job => ['queued','running','cancelRequested'].includes(job?.state);
const currentSource = () => state.source?.reference.id === state.reference?.id;
const selectedCurrent = () => isCurrent() && state.selected?.abc === state.draft && state.selected.mode === state.mode && currentSource() && state.selected.sourceScore === state.source.id && state.selected.reference.id === state.reference.id;
const canGenerate = () => selectedCurrent() && state.supported && state.models && !active(state.job) && !active(state.transcribe);
const versionName = version => version.nameKey ? t(version.nameKey) : version.name;
function toast(message) { $('toast').textContent=message; $('toast').classList.add('visible'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>$('toast').classList.remove('visible'),3500); }
function showError(id, text) { $(id).textContent=localizedError(text); $(id).hidden=!text; }
function render() {
  document.documentElement.lang=language==='zh'?'zh-CN':'en';
  document.querySelectorAll('[data-t]').forEach(element=>{ element.textContent=t(element.dataset.t); });
  $('language').textContent=language==='zh'?'English':'中文';
  $('theme').textContent=t(document.documentElement.dataset.theme==='light'?'dark':'light');
  $('abc').setAttribute('aria-label',t('abcLabel'));
  $('seek').setAttribute('aria-label',t('seek'));
  document.querySelector('.player').setAttribute('aria-label',t('playerLabel'));
  document.querySelector('.sidebar nav').setAttribute('aria-label',t('navLabel'));
  $('notation').setAttribute('aria-label',t('notationLabel'));
  $('empty-score').hidden=state.present;
  $('editor-content').hidden=!state.present;
  document.querySelectorAll('[name=mode]').forEach(input=>input.checked=input.value===state.mode);
  $('reference-state').textContent=loading?t('decodingReference'):!state.supported?t('modeUnavailable'):!state.models?t('modelsUnavailable'):t('readyState');
  $('reference-summary').textContent=state.reference?`${state.reference.name} · ${state.reference.historical?t('referenceHistorical'):t('referenceLocal')}`:t('emptyReference');
  $('reference-play').disabled=!state.reference||loading;
  $('transcribe').disabled=!state.reference||loading||!state.supported||!state.models||active(state.transcribe)||active(state.job);
  $('sample-reference').disabled=active(state.transcribe)||active(state.job)||loading;
  $('reference-file').disabled=active(state.transcribe)||active(state.job)||loading;
  $('mode-help').textContent=t(state.mode==='full'?'modeFullHelp':'modeMelodyHelp')+(state.mode==='full'&&state.source&&!/"[A-G][^"\n]*"[A-Ga-gz]/.test(state.draft)?' '+t('chordlessFull'):'');
  const transcription=state.transcribe;
  $('transcribe-job').innerHTML=transcription?`<article class="job-card"><h3>${t('transcribeJob')}</h3><span class="tag">${t(transcription.state==='running'?'transcribing':transcription.state)}</span><p>${escape(transcription.reference.name)} · ${transcription.mode}</p>${active(transcription)?`<div class="progress" aria-label="${t('unknown')}"></div><button data-action="cancel-transcribe">${t('cancel')}</button>`:''}${transcription.state==='failed'?`<p class="error">${t('transcriptionFailed')}</p>`:''}<small>${escape(transcription.id)} · ${t('unknown')}</small></article>`:'';
  $('draft-state').textContent=loading?t('loadingMessage'):t(checkStatus);
  $('notation-state').textContent=checked?`r${checked.revision}`:'—';
  $('notation-caption').textContent=isCurrent()?t('currentNotation'):checked?t('oldNotation'):t('noNotation');
  $('editor-message').textContent=loading?t('loadingMessage'):`${t('draftSnapshot')} r${state.revision} · ${t('unchanged')}`;
  showError('abc-errors',checkError?`${localizedError(checkError)}\n${t('draftPreserved')}`:'');
  showError('score-action-error',actionError);
  ['play-score','export-midi'].forEach(id=>$(id).disabled=!isCurrent()||loading);
  $('select-score').disabled=!isCurrent()||loading||!currentSource();
  $('play-effective').disabled=!selectedCurrent()||loading;
  $('generate').disabled=!canGenerate()||loading;
  $('selected-summary').textContent=state.selected?`${t('selectedRev')} r${state.selected.revision} · ${t('selectedMode')} ${state.selected.mode} · ${t('parent')} ${state.selected.parent??'—'} · ${selectedCurrent()?t('ready'):t('selectNeeded')}`:t('noSelected');
  $('selected-abc').textContent=state.selected?.abc??'—';
  try{$('effective-abc').textContent=state.present?effectiveABC(state.draft,state.mode):'—';}catch{$('effective-abc').textContent=t('checkFirst');}
  $('generate-help').textContent=!state.supported?t('unsupported'):!state.models?t('modelsMissing'):state.source&&!currentSource()?t('newReference'):!selectedCurrent()?t('pendingSelection'):t('ready');
  const job=state.job;
  $('job').innerHTML=job?`<article class="job-card"><h3>${t('job')}</h3><span class="tag">${t(job.state)}${job.held?' · '+t('held'):''}</span>${active(job)?'<div class="progress" aria-label="'+t('unknown')+'"></div>':''}<small>${escape(job.id)} · ${t('unknown')}</small><p>${t('input')}: r${job.input.score.revision} · ${job.input.score.mode} · ${t('parent')} ${escape(job.input.score.parent??'—')}</p><small>${t('frozen')}</small>${job.error?`<p class="error">${t(job.error)}</p>`:''}<button data-action="job-input">${t('inspect')}</button>${['queued','running'].includes(job.state)?` <button data-action="cancel">${t('cancel')}</button>`:''}${['failed','cancelled'].includes(job.state)?`<p>${t('scoreRetained')}</p><button data-action="retry" ${!state.supported||!state.models?'disabled':''}>${t('retry')}</button>`:''}</article>`:'';
  const candidate=state.candidate;
  $('candidate').innerHTML=candidate?`<article class="candidate-card"><h3>${candidate.savedVersion?t('saved'):t('candidate')}</h3><small>${escape(candidate.id)} · ${t('input')} r${candidate.input.score.revision} · ${candidate.input.score.mode} · ${t('parent')} ${escape(candidate.input.score.parent??'—')}</small><p class="hint">${t('candidateHelp')}</p><div class="actions"><button data-action="candidate-play">${t('listen')}</button><button data-action="candidate-input">${t('inspect')}</button><button data-action="candidate-save" class="primary">${candidate.savedVersion?t('inspect'):t('save')}</button></div></article>`:`<p class="hint">${t('noCandidate')}</p>`;
  $('version-nav').innerHTML=state.versions.map(version=>`<button class="version-nav-item" data-version="${version.id}">${escape(versionName(version))}</button>`).join('');
  $('versions-list').innerHTML=state.versions.map(version=>`<article class="surface version-card"><h3>${escape(versionName(version))}</h3><small>${escape(version.id)} · ${t('parent')} ${version.parent??'—'}</small><p>${version.input?`${t('input')} r${version.input.score.revision} · ${t('frozen')}`:t('originalHelp')}</p><div class="actions"><button data-version="${version.id}">${t('inspect')}</button><button data-version-play="${version.id}">${t('listen')}</button></div></article>`).join('');
  $('lyrics-copy').textContent=$('lyrics').value;
  $('state-summary').innerHTML=[['referenceStatus',state.reference?.name??'—'],['scoreStatus',state.source?`${state.source.id} · ${state.source.mode} · ${t('transcriptionSource')}`:'—'],['selectionStatus',state.selected?`${state.selected.sourceScore} · r${state.selected.revision} · ${state.selected.mode}`:'—'],['submissionStatus',job?`${job.id} · ${t(job.state)} · ${job.input.score.mode}`:'—'],['candidateStatus',state.candidate?.id??'—'],['versionStatus',state.versions.map(version=>versionName(version)).join(' / ')]].map(([key,value])=>`<dt>${t(key)}</dt><dd>${escape(value)}</dd>`).join('');
  renderWalkthrough();
  $('play').setAttribute('aria-label',t(audio.paused?'play':'pause'));
  $('save-submit').textContent=t(saveBusy?'saving':'save');
  if (media) { $('track-name').textContent=media.kind==='score'?`${media.effective?t('effective'):t('playingScore')} r${media.revision}${media.mode?' · '+media.mode:''}`:media.name??t('candidate'); $('track-source').textContent=media.kind==='reference'?t(media.historical?'referenceHistorical':'referenceLocal'):t(media.kind==='score'?'tone':'historical'); }
}

// Only music lines are transformed. Quoted voice names and other headers stay intact.
// This preview supports the native fixture's simple two-voice dialect; API validation remains authoritative.
function effectiveABC(text,mode) {
  if(mode==='full')return text;
  let voice=null;
  return text.split('\n').map(line=>{
    if(/^V:/.test(line)){voice=/^V:\s*(Vocal|Ins)\b/.exec(line)?.[1]??null;return line;}
    if(!voice||/^\s*(?:[A-Za-z]:|%|$)/.test(line))return line;
    return line.replace(/"[^"\n]*"/g,'');
  }).join('\n');
}
function validateVoiceGrid(text) {
  if(!/^V:\s*Vocal\b/m.test(text)||!/^V:\s*Ins\b/m.test(text))throw new Error(t('missingNativeVoice'));
  const unit=/^L:\s*1\/(\d+)\s*$/m.exec(text),meter=/^M:\s*(\d+)\/(\d+)\s*$/m.exec(text);
  if(!unit||!meter)throw new Error(t('missingHeaders'));
  let voice=null;const grids={Vocal:[],Ins:[]},notes={Vocal:0,Ins:0};
  for(const line of text.split('\n')){
    if(/^V:/.test(line)){voice=/^V:\s*(Vocal|Ins)\b/.exec(line)?.[1]??null;continue;}
    if(!voice||/^\s*(?:[A-Za-z]:|%|$)/.test(line))continue;
    const chord=/^[A-G](?:bb|##|b|#)?(?:m|dim|aug|7|maj7|m7|dim7|m7b5|sus4|sus2|6|m6|7sus4|m\(maj7\))?(?:\/[A-G](?:bb|##|b|#)?)?$/;
    if([...line.matchAll(/"([^"\n]*)"/g)].some(match=>!chord.test(match[1])))throw new Error(language==='zh'?'请使用有效的音乐和弦符号。':'Use valid musical chord symbols.');
    const music=line.replace(/"[^"\n]*"/g,'').replace(/\[K:[^\]]+\]/g,'');
    if(music.replace(/(?:\^\^|__|\^|_|=)?[A-Ga-gz][,']*\d*-?/g,'').replace(/[|\s]/g,''))throw new Error(t('draftPreserved'));
    for(const bar of music.split('|').filter(item=>item.trim())){
      const tokens=[...bar.matchAll(/(?:\^\^|__|\^|_|=)?([A-Ga-gz])[,']*(\d*)(-?)/g)];
      grids[voice].push(tokens.reduce((sum,item)=>sum+Number(item[2]||1)*4/Number(unit[1]),0));
      notes[voice]+=tokens.filter(item=>item[1]!=='z').length;
    }
  }
  if(!notes.Vocal&&!notes.Ins)throw new Error(t('noNotes'));
  const expected=Number(meter[1])*4/Number(meter[2]);
  if(!grids.Vocal.length||grids.Vocal.length!==grids.Ins.length||Object.values(grids).flat().some(value=>value!==expected))throw new Error(language==='zh'?'两个声部必须保留等长、完整的小节。':'Both voices need equal, complete bars.');
}
function useSample() {
  if(active(state.transcribe)||active(state.job)||loading)return;
  state.reference=freeze({id:'reference-historical-v1',name:'PR #58 · V1',historical:true,parent:'preview-version-1',url:'sample.mp3'});
  showError('reference-error','');render();
}
async function readReference(file) {
  if(!file)return;
  const request=++referenceRead,currentState=state;loading=true;showError('reference-error','');render();
  let context;
  try{
    if(!/\.wav$/i.test(file.name)||file.size>25*1024*1024||file.size<44)throw new Error();
    const bytes=await file.arrayBuffer(),view=new Uint8Array(bytes),magic=offset=>String.fromCharCode(...view.slice(offset,offset+4));
    if(magic(0)!=='RIFF'||magic(8)!=='WAVE')throw new Error();
    context=new AudioContext();const decoded=await context.decodeAudioData(bytes);
    if(!Number.isFinite(decoded.duration)||decoded.duration<=0||decoded.duration>40)throw new Error();
    if(request!==referenceRead||state!==currentState)return;
    const url=URL.createObjectURL(file);referenceUrls.add(url);state.reference=freeze({id:`reference-local-${state.nextId++}`,name:file.name,historical:false,parent:null,url,duration:decoded.duration});
  }catch{if(request===referenceRead&&state===currentState)showError('reference-error',t('referenceError'));}
  finally{await context?.close();if(request===referenceRead&&state===currentState){loading=false;render();}}
}
function changeMode(mode) {state.mode=mode;render();toast(t('modeChanged'));}
function transcribe() {
  if(!state.reference||!state.models||!state.supported||loading||active(state.transcribe)||active(state.job))return;
  const job={id:`preview-transcribe-${state.nextId++}`,state:'queued',reference:state.reference,mode:state.mode,fail:consume('transcription')};state.transcribe=job;render();
  transcribeTimer=setTimeout(()=>{if(state.transcribe!==job||job.state!=='queued')return;job.state='running';render();transcribeTimer=setTimeout(()=>{
    if(state.transcribe!==job||job.state!=='running')return;
    if(job.fail){job.state='failed';render();return;}
    job.state='completed';const abc=effectiveABC(SAMPLE,job.mode);state.source=freeze({id:`preview-score-${state.nextId++}`,abc,mode:job.mode,reference:job.reference});state.present=true;updateDraft(abc);
  },900);},500);
}
function cancelTranscribe() {const job=state.transcribe;if(!active(job))return;clearTimeout(transcribeTimer);job.state='cancelRequested';render();transcribeTimer=setTimeout(()=>{if(state.transcribe!==job)return;job.state='cancelled';render();toast(t('scoreRetained'));},500);}
const walkthroughs={
  happy:{help:'happyHelp',steps:[['stepReference','reference'],['stepTranscribe','transcribe'],['stepSelect','select'],['stepGenerate','generate'],['stepSave','save']]},
  failure:{help:'failureHelp',steps:[['stepReference','reference'],['stepTranscribe','transcribe'],['stepSelect','select'],['stepFailure','failure'],['failureGenerate','generate'],['stepRetry','retry']]},
  mode:{help:'modeWalkHelp',steps:[['stepReference','reference'],['stepTranscribe','transcribe'],['stepSelect','select'],['stepMelody','melody'],['stepReselect','select'],['stepSnapshot','snapshot']]}
};
function renderWalkthrough() {
  document.querySelectorAll('[data-walkthrough]').forEach(button=>{button.classList.toggle('active',button.dataset.walkthrough===walkthrough);button.setAttribute('aria-selected',button.dataset.walkthrough===walkthrough);});
  $('walkthrough-help').textContent=t(walkthroughs[walkthrough].help);
  $('walkthrough-steps').innerHTML=`<button data-step="reset">${t('startWalk')}</button>`+walkthroughs[walkthrough].steps.map(([label,action])=>`<button data-step="${action}" ${action==='select'&&!isCurrent()||action==='generate'&&!canGenerate()||action==='save'&&!state.candidate||action==='retry'&&!['failed','cancelled'].includes(state.job?.state)||action==='snapshot'&&!state.selected||action==='transcribe'&&(!state.reference||active(state.transcribe))?'disabled':''}>${t(label)}</button>`).join('');
}
function selectScore() {if(!isCurrent()||!currentSource())return;model.select(state,effectiveABC(state.draft,state.mode));render();toast(t('selectedToast'));}
function walkStep(action) {switch(action){case'reset':reset();break;case'reference':useSample();break;case'transcribe':transcribe();break;case'select':selectScore();break;case'generate':generate();break;case'save':openSave();break;case'failure':failures.add('generation');toast(t('armed'));break;case'retry':if(['failed','cancelled'].includes(state.job?.state)&&state.supported&&state.models)runJob(model.submit(state,null,state.job.input));break;case'melody':changeMode('melody');break;case'snapshot':showSnapshot(t('snapshotTitle'),{score:state.selected,style:$('style').value,lyrics:$('lyrics').value,settings:{seed:Number($('seed').value)}});break;}}

// Decode the MIDI produced by abcjs, then synthesize a small PCM audition locally.
function midiNotes(bytes) {
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const text=(offset,count)=>String.fromCharCode(...bytes.slice(offset,offset+count));
  if (text(0,4)!=='MThd') throw new Error(t('noNotes'));
  const division=view.getUint16(12), events=[]; let pos=8+view.getUint32(4),track=0;
  if (division&0x8000) throw new Error(t('noNotes'));
  while (pos<bytes.length) {
    if (text(pos,4)!=='MTrk') throw new Error(t('noNotes'));
    const end=pos+8+view.getUint32(pos+4); pos+=8; let tick=0,status=0;
    const variable=()=>{let value=0,count=0,byte; do {if(pos>=end||count++>3) throw new Error(t('noNotes')); byte=bytes[pos++]; value=(value<<7)|(byte&127);} while(byte&128); return value;};
    while(pos<end) {
      tick+=variable(); let code=bytes[pos++]; if(code<128){pos--;code=status;} else if(code<240) status=code;
      if(code===255){const type=bytes[pos++],len=variable();if(type===81&&len===3)events.push({tick,tempo:(bytes[pos]<<16)|(bytes[pos+1]<<8)|bytes[pos+2]});pos+=len;}
      else if(code===240||code===247){const length=variable();pos+=length;}
      else {const a=bytes[pos++],kind=code&240,b=[192,208].includes(kind)?0:bytes[pos++];if(kind===144||kind===128)events.push({tick,track,channel:code&15,pitch:a,on:kind===144&&b>0,velocity:b});}
    }
    pos=end;track++;
  }
  events.sort((a,b)=>a.tick-b.tick); let lastTick=0,time=0,tempo=500000; const active=new Map(),notes=[];
  for(const event of events){time+=(event.tick-lastTick)/division*tempo/1000000;lastTick=event.tick;if(event.tempo){tempo=event.tempo;continue;}const key=`${event.track}:${event.channel}:${event.pitch}`;if(event.on)active.set(key,{pitch:event.pitch,start:time,velocity:event.velocity});else if(active.has(key)){notes.push({...active.get(key),end:time});active.delete(key);}}
  if(!notes.length)throw new Error(t('noNotes'));
  if(time>120||notes.length>10000)throw new Error(t('limit'));
  return {notes,duration:time};
}
function midiWave(midi) {
  const {notes,duration}=midiNotes(midi),rate=16000,length=Math.ceil((duration+.2)*rate),samples=new Float32Array(length);
  for(const note of notes){const start=Math.floor(note.start*rate),end=Math.min(length,Math.ceil(note.end*rate)),frequency=440*2**((note.pitch-69)/12);for(let i=start;i<end;i++){const age=(i-start)/rate,tail=(end-i)/rate,envelope=Math.min(1,age/.012,tail/.04);samples[i]+=.16*(note.velocity/100)*envelope*Math.sin(2*Math.PI*frequency*age);}}
  const buffer=new ArrayBuffer(44+length*2),view=new DataView(buffer),write=(offset,text)=>[...text].forEach((char,index)=>view.setUint8(offset+index,char.charCodeAt(0)));
  write(0,'RIFF');view.setUint32(4,36+length*2,true);write(8,'WAVE');write(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);write(36,'data');view.setUint32(40,length*2,true);
  for(let i=0;i<length;i++)view.setInt16(44+i*2,Math.max(-1,Math.min(1,samples[i]))*32767,true);
  return new Blob([buffer],{type:'audio/wav'});
}
function validateDraft() {
  clearTimeout(validationTimer); const captured={abc:state.draft,revision:state.revision},currentState=state;
  checkStatus='checking';checkError='';actionError='';render();
  validationTimer=setTimeout(()=>{
    if(state!==currentState||captured.revision!==state.revision||!state.present)return;
    const host=document.createElement('div');
    try {
      if(consume('preview'))throw new Error(t('previewError'));
      if(!/^X:\s*\d+/m.test(captured.abc)||!/^K:\s*\S+/m.test(captured.abc))throw new Error(t('missingHeaders'));
      if((captured.abc.match(/^X:/gm)??[]).length!==1)throw new Error(t('oneTune'));
      validateVoiceGrid(captured.abc);
      const [tune]=ABCJS.renderAbc(host,captured.abc,{responsive:'resize',add_classes:true,staffwidth:470,wrap:{minSpacing:1.5,maxSpacing:2.7,preferredMeasuresPerLine:4}});
      if(!tune||!host.querySelector('svg'))throw new Error(t('previewError'));
      if(tune.warnings?.length)throw new Error(tune.warnings.join('\n').replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&'));
      const midi=ABCJS.synth.getMidiFile(tune,{midiOutputType:'binary'});
      midiNotes(midi);
      checked={...captured,tune,midi};checkStatus='valid';$('notation').replaceChildren(host);
    } catch(error){checkStatus='invalid';checkError=error.message;}
    render();
  },400);
}
function updateDraft(text) { state.draft=text;state.revision++;$('abc').value=text;checkStatus='dirty';checkError='';actionError='';render();validateDraft(); }
function setMedia(next,src) {
  audio.pause();if(media?.url)URL.revokeObjectURL(media.url);media=next;audio.src=src;audio.load();$('play').disabled=false;$('seek').disabled=false;$('player-error').textContent='';render();
}
async function playMedia() { try { await audio.play(); } catch { $('player-error').textContent=t('playbackError'); } }
function playScore() {
  if(!isCurrent())return;
  if(consume('playback')){actionError=t('actionFail');render();return;}
  try {const snapshot=checked,url=URL.createObjectURL(midiWave(snapshot.midi));setMedia({kind:'score',revision:snapshot.revision,abc:snapshot.abc,url},url);playMedia();}catch(error){actionError=error.message;render();}
}
function exportMidi() {
  if(!isCurrent())return;
  if(consume('export')){actionError=t('actionFail');render();return;}
  const url=URL.createObjectURL(new Blob([checked.midi],{type:'audio/midi'})),link=document.createElement('a');link.href=url;link.download=`score-draft-r${checked.revision}.mid`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);actionError='';render();toast(t('exportDone'));
}
function showSnapshot(title,input,abc,parent) { $('snapshot-title').textContent=title;$('snapshot-details').textContent=`${t('parent')}: ${parent??input?.score.parent??'—'}${input?` · ${t('mode')}: ${input.score.mode} · ${t('source')}: ${input.score.reference.name} · ${t('style')}: ${input.style} · seed ${input.settings.seed} · 35 s · ${t('snapshotMode')}`:''}`;$('snapshot-text').textContent=input?`${t('selectedText')}:\n${input.score.abc}\n\n${t('effective')}:\n${input.score.effectiveABC}\n\n${t('lyrics')}:\n${input.lyrics}`:abc;$('snapshot-dialog').showModal(); }
function finishJob(job) {clearTimeout(jobTimer);if(state.job!==job)return;if(job.fail){job.state='failed';}else model.complete(state,job);render();}
function runJob(job) {
  clearTimeout(jobTimer);const oom=consume('oom');job.fail=consume('generation')||oom;job.error=oom?'outOfMemory':job.fail?'failed':null;job.held=holdNext;holdNext=false;render();
  jobTimer=setTimeout(()=>{if(state.job!==job||job.state!=='queued')return;job.state='running';render();if(!job.held)jobTimer=setTimeout(()=>finishJob(job),1500);},800);
}
function generate() {
  if(!canGenerate())return;
  const fields={style:$('style').value.trim(),lyrics:$('lyrics').value.trim(),seed:Number($('seed').value)};
  if(!fields.style||!fields.lyrics||!$('seed').value||!Number.isSafeInteger(fields.seed)||fields.seed<0){showError('submit-error',t('inputError'));return;}
  showError('submit-error','');runJob(model.submit(state,fields));
}
function cancelJob() {const job=state.job;if(!job||!['queued','running'].includes(job.state))return;clearTimeout(jobTimer);job.state='cancelRequested';render();jobTimer=setTimeout(()=>{if(state.job!==job)return;if(cancelRace){cancelRace=false;job.fail=false;model.complete(state,job);}else job.state='cancelled';render();},650);}
function openSave() { const candidate=state.candidate;if(!candidate)return;if(candidate.savedVersion){const version=candidate.savedVersion;showSnapshot(versionName(version),version.input,version.abc,version.parent);return;}saveTarget=candidate;showError('save-error','');$('save-parent').textContent=`${t('parent')} ${candidate.input.score.parent??'—'} · ${t('input')} r${candidate.input.score.revision} · ${candidate.input.score.mode}`;$('save-dialog').showModal(); }
async function saveCandidate(event) {
  event.preventDefault();if(saveBusy||!saveTarget)return;
  const candidate=saveTarget,currentState=state,name=$('version-name').value.trim();if(!name){showError('save-error',t('nameEmpty'));return;}
  const fail=consume('save');saveBusy=true;$('save-submit').disabled=true;$('save-close').disabled=true;showError('save-error','');render();
  await new Promise(resolve=>setTimeout(resolve,700));
  saveBusy=false;$('save-submit').disabled=false;$('save-close').disabled=false;
  if(state!==currentState)return;
  if(fail){showError('save-error',t('saveFailed'));render();return;}
  model.save(state,candidate,name);$('save-dialog').close();render();toast(t('saveDone'));
}
function reset() {
  audio.pause();audio.removeAttribute('src');audio.load();if(media?.url)URL.revokeObjectURL(media.url);media=null;referenceUrls.forEach(url=>URL.revokeObjectURL(url));referenceUrls.clear();$('play').disabled=true;$('seek').disabled=true;
  clearTimeout(jobTimer);clearTimeout(validationTimer);clearTimeout(transcribeTimer);referenceRead++;loading=false;failures.clear();holdNext=false;cancelRace=false;state=model.initial();checked=null;checkStatus='dirty';checkError='';actionError='';$('abc').value=state.draft;$('reference-file').value='';$('notation').replaceChildren();$('scenarios').close();render();
}
function playEffective() {
  if(!selectedCurrent())return;
  if(consume('playback')){actionError=t('actionFail');render();return;}
  try{const snapshot=state.selected,host=document.createElement('div'),[tune]=ABCJS.renderAbc(host,snapshot.effectiveABC),midi=ABCJS.synth.getMidiFile(tune,{midiOutputType:'binary'}),url=URL.createObjectURL(midiWave(midi));setMedia({kind:'score',effective:true,mode:snapshot.mode,revision:snapshot.revision,abc:snapshot.effectiveABC,url},url);playMedia();}catch(error){actionError=error.message;render();}
}
function scenario(name) {
  if(name==='reset'){reset();return;}
  if(name==='unsupported'){state.supported=false;render();$('scenarios').close();toast(t('unsupported'));return;}
  if(name==='models'){state.models=false;render();$('scenarios').close();toast(t('modelsMissing'));return;}
  if(name==='ready'){state.supported=true;state.models=true;render();$('scenarios').close();return;}
  if(name==='invalid'){if(!state.present){$('scenario-message').textContent=t('noScore');return;}updateDraft(state.draft+'\nC ? D |');$('scenarios').close();return;}
  if(name==='loading'){loading=true;render();$('scenarios').close();setTimeout(()=>{loading=false;render();toast(t('loaded'));},1300);return;}
  if(name==='hold'){holdNext=true;if(state.job&&['queued','running'].includes(state.job.state)){clearTimeout(jobTimer);state.job.state='running';state.job.held=true;holdNext=false;render();}$('scenario-message').textContent=t('holdArmed');return;}
  if(name==='complete'){if(state.job&&['queued','running'].includes(state.job.state)){finishJob(state.job);$('scenarios').close();}else $('scenario-message').textContent=t('noJob');return;}
  if(name==='cancel-race'){cancelRace=true;$('scenario-message').textContent=t('raceArmed');return;}
  failures.add(name);$('scenario-message').textContent=t('armed');
}
$('abc').addEventListener('input',()=>updateDraft($('abc').value));
$('validate').addEventListener('click',validateDraft);
$('restore').addEventListener('click',()=>{if(state.source)updateDraft(state.source.abc);toast(t('copied'));});
$('play-score').addEventListener('click',playScore);$('export-midi').addEventListener('click',exportMidi);
$('play-effective').addEventListener('click',playEffective);
$('select-score').addEventListener('click',selectScore);
$('generate').addEventListener('click',generate);$('save-form').addEventListener('submit',saveCandidate);
$('sample-reference').addEventListener('click',useSample);$('transcribe').addEventListener('click',transcribe);
$('reference-file').addEventListener('change',()=>readReference($('reference-file').files[0]));
$('reference-play').addEventListener('click',()=>{if(state.reference){setMedia({kind:'reference',name:state.reference.name,historical:state.reference.historical},state.reference.url);playMedia();}});
document.querySelectorAll('[name=mode]').forEach(input=>input.addEventListener('change',()=>changeMode(input.value)));
$('save-close').addEventListener('click',()=>$('save-dialog').close());$('snapshot-close').addEventListener('click',()=>$('snapshot-dialog').close());
$('scenarios-open').addEventListener('click',()=>{$('scenario-message').textContent='';$('scenarios').showModal();});$('scenarios-close').addEventListener('click',()=>$('scenarios').close());
$('language').addEventListener('click',()=>{language=language==='zh'?'en':'zh';$('toast').classList.remove('visible');['submit-error','save-error','player-error'].forEach(id=>{ $(id).textContent=localizedError($(id).textContent); });render();});$('theme').addEventListener('click',()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='light'?'dark':'light';render();});
$('lyrics').addEventListener('input',()=>{$('lyrics-copy').textContent=$('lyrics').value;});
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.tab){document.querySelectorAll('[data-tab]').forEach(item=>{const active=item===button;item.classList.toggle('active',active);item.setAttribute('aria-selected',active);});['score','lyrics','versions'].forEach(tab=>$(tab+'-view').hidden=tab!==button.dataset.tab);render();}
  if(button.dataset.scenario)scenario(button.dataset.scenario);
  if(button.dataset.walkthrough){walkthrough=button.dataset.walkthrough;reset();}
  if(button.dataset.step)walkStep(button.dataset.step);
  if(button.dataset.version){const version=state.versions.find(item=>item.id===button.dataset.version);showSnapshot(versionName(version),version.input,version.abc,version.parent);}
  if(button.dataset.versionPlay){const version=state.versions.find(item=>item.id===button.dataset.versionPlay);setMedia({kind:'historical',name:versionName(version)},'sample.mp3');playMedia();}
  switch(button.dataset.action){
    case 'job-input':showSnapshot(state.job.id,state.job.input,null,state.job.input.score.parent);break;
    case 'cancel':cancelJob();break;
    case 'cancel-transcribe':cancelTranscribe();break;
    case 'retry':if(state.supported&&state.models)runJob(model.submit(state,null,state.job.input));break;
    case 'candidate-input':showSnapshot(state.candidate.id,state.candidate.input,null,state.candidate.input.score.parent);break;
    case 'candidate-play':setMedia({kind:'historical'},'sample.mp3');playMedia();break;
    case 'candidate-save':openSave();break;
  }
});
$('play').addEventListener('click',()=>{if(audio.paused)playMedia();else audio.pause();});
$('seek').addEventListener('input',()=>{if(Number.isFinite(audio.duration))audio.currentTime=Number($('seek').value);});
const formatTime=time=>`${Math.floor(time/60)}:${String(Math.floor(time%60)).padStart(2,'0')}`;
function syncPlayer() {
  $('play').textContent=audio.paused?'▶':'Ⅱ';$('play').setAttribute('aria-label',t(audio.paused?'play':'pause'));
  $('elapsed').textContent=formatTime(audio.currentTime);$('duration').textContent=formatTime(Number.isFinite(audio.duration)?audio.duration:0);$('seek').max=Number.isFinite(audio.duration)?audio.duration:1;$('seek').value=audio.currentTime;
  $('notation').querySelectorAll('.highlight').forEach(element=>element.classList.remove('highlight'));
  if(media?.kind==='score'&&media.abc===checked?.abc){const timings=checked.tune.noteTimings??checked.tune.setTiming(checked.tune.getBpm(checked.tune.metaText.tempo),0);const current=timings.filter(item=>item.type==='event'&&item.milliseconds<=audio.currentTime*1000).at(-1);if(!audio.paused)current?.elements?.flat().forEach(element=>element?.classList.add('highlight'));}
}
['timeupdate','loadedmetadata','play','pause','ended'].forEach(name=>audio.addEventListener(name,syncPlayer));
audio.addEventListener('error',()=>{$('player-error').textContent=t('playbackError');});
$('abc').value=state.draft;render();
