const $ = id => document.getElementById(id);
const SAMPLE = 'X:1\nT:After the rain\nM:4/4\nL:1/8\nQ:1/4=96\nK:C\nC D E F G2 E2 | F E D C D4 | E F G A G2 E2 | D E F D C4 |';
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
  initial() { return { present:true, draft:SAMPLE, revision:1, selected:null, job:null, candidate:null, nextId:1, versions:[freeze({id:'preview-version-1', nameKey:'original', abc:SAMPLE, parent:null, input:null})] }; },
  select(state) { state.selected = freeze({abc:state.draft, revision:state.revision, sourceScore:'preview-score-1', parent:'preview-version-1'}); },
  submit(state, fields, input = null) {
    const payload = input ?? freeze({score:{...state.selected}, style:fields.style, lyrics:fields.lyrics, settings:{seed:fields.seed, maxSeconds:35}});
    state.job = {id:`preview-job-${state.nextId++}`, state:'queued', input:payload};
    return state.job;
  },
  complete(state, job) { if (state.job !== job || !['queued','running','cancelRequested'].includes(job.state)) return; job.state='completed'; state.candidate={id:`preview-candidate-${state.nextId++}`, input:job.input, savedVersion:null}; },
  save(state, candidate, name) { if (candidate.savedVersion) return candidate.savedVersion; const version=freeze({id:`preview-version-${state.nextId++}`, name, abc:candidate.input.score.abc, parent:candidate.input.score.parent, input:candidate.input}); state.versions.push(version); candidate.savedVersion=version; return version; }
};
let state = model.initial();
let checked = null, checkStatus = 'checking', checkError = '', actionError = '', media = null;
let validationTimer, jobTimer, saveTarget, saveBusy = false, loading = false;
const failures = new Set();
let holdNext = false, cancelRace = false;
const audio = $('audio');
const consume = name => { const value=failures.has(name); failures.delete(name); return value; };
const isCurrent = () => checked?.abc === state.draft && checkStatus === 'valid';
const canGenerate = () => isCurrent() && state.selected?.abc === state.draft && !['queued','running','cancelRequested'].includes(state.job?.state);
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
  $('draft-state').textContent=loading?t('loadingMessage'):t(checkStatus);
  $('notation-state').textContent=checked?`r${checked.revision}`:'—';
  $('notation-caption').textContent=isCurrent()?t('currentNotation'):t('oldNotation');
  $('editor-message').textContent=loading?t('loadingMessage'):`${t('draftSnapshot')} r${state.revision} · ${t('unchanged')}`;
  showError('abc-errors',checkError?`${localizedError(checkError)}\n${t('draftPreserved')}`:'');
  showError('score-action-error',actionError);
  ['play-score','export-midi','select-score'].forEach(id=>$(id).disabled=!isCurrent()||loading);
  $('generate').disabled=!canGenerate()||loading;
  $('selected-summary').textContent=state.selected?`${t('selectedRev')} r${state.selected.revision} · ${t('parent')} V1 · ${state.selected.abc===state.draft?t('ready'):t('selectNeeded')}`:t('noSelected');
  $('selected-abc').textContent=state.selected?.abc??'—';
  $('generate-help').textContent=!state.selected?t('noSelected'):state.selected.abc!==state.draft?t('selectNeeded'):t('ready');
  const job=state.job;
  $('job').innerHTML=job?`<article class="job-card"><h3>${t('job')}</h3><span class="tag">${t(job.state)}${job.held?' · '+t('held'):''}</span>${['queued','running','cancelRequested'].includes(job.state)?'<div class="progress" aria-label="'+t('unknown')+'"></div>':''}<small>${escape(job.id)} · ${t('unknown')}</small><p>${t('input')}: r${job.input.score.revision} · ${t('parent')} V1</p><small>${t('frozen')}</small><button data-action="job-input">${t('inspect')}</button>${['queued','running'].includes(job.state)?` <button data-action="cancel">${t('cancel')}</button>`:''}${['failed','cancelled'].includes(job.state)?`<p>${t('cancelHelp')}</p><button data-action="retry">${t('retry')}</button>`:''}</article>`:'';
  const candidate=state.candidate;
  $('candidate').innerHTML=candidate?`<article class="candidate-card"><h3>${candidate.savedVersion?t('saved'):t('candidate')}</h3><small>${escape(candidate.id)} · ${t('input')} r${candidate.input.score.revision} · ${t('parent')} V1</small><p class="hint">${t('candidateHelp')}</p><div class="actions"><button data-action="candidate-play">${t('listen')}</button><button data-action="candidate-input">${t('inspect')}</button><button data-action="candidate-save" class="primary">${candidate.savedVersion?t('inspect'):t('save')}</button></div></article>`:`<p class="hint">${t('noCandidate')}</p>`;
  $('version-nav').innerHTML=state.versions.map(version=>`<button class="version-nav-item" data-version="${version.id}">${escape(versionName(version))}</button>`).join('');
  $('versions-list').innerHTML=state.versions.map(version=>`<article class="surface version-card"><h3>${escape(versionName(version))}</h3><small>${escape(version.id)} · ${t('parent')} ${version.parent??'—'}</small><p>${version.input?`${t('input')} r${version.input.score.revision} · ${t('frozen')}`:t('originalHelp')}</p><div class="actions"><button data-version="${version.id}">${t('inspect')}</button><button data-version-play="${version.id}">${t('listen')}</button></div></article>`).join('');
  $('lyrics-copy').textContent=$('lyrics').value;
  $('play').setAttribute('aria-label',t(audio.paused?'play':'pause'));
  $('save-submit').textContent=t(saveBusy?'saving':'save');
  if (media) { $('track-name').textContent=media.kind==='score'?`${t('playingScore')} r${media.revision}`:media.name??t('candidate'); $('track-source').textContent=t(media.kind==='score'?'tone':'historical'); }
}

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
function showSnapshot(title,input,abc,parent) { $('snapshot-title').textContent=title;$('snapshot-details').textContent=`${t('parent')}: ${parent??'—'}${input?` · ${t('style')}: ${input.style} · seed ${input.settings.seed} · 35 s`:''}`;$('snapshot-text').textContent=input?`${input.score.abc}\n\n${t('lyrics')}:\n${input.lyrics}`:abc;$('snapshot-dialog').showModal(); }
function finishJob(job) {clearTimeout(jobTimer);if(state.job!==job)return;if(job.fail){job.state='failed';}else model.complete(state,job);render();}
function runJob(job) {
  clearTimeout(jobTimer);job.fail=consume('generation');job.held=holdNext;holdNext=false;render();
  jobTimer=setTimeout(()=>{if(state.job!==job||job.state!=='queued')return;job.state='running';render();if(!job.held)jobTimer=setTimeout(()=>finishJob(job),1500);},800);
}
function generate() {
  if(!canGenerate())return;
  const fields={style:$('style').value.trim(),lyrics:$('lyrics').value.trim(),seed:Number($('seed').value)};
  if(!fields.style||!fields.lyrics||!$('seed').value||!Number.isSafeInteger(fields.seed)||fields.seed<0){showError('submit-error',t('inputError'));return;}
  showError('submit-error','');runJob(model.submit(state,fields));
}
function cancelJob() {const job=state.job;if(!job||!['queued','running'].includes(job.state))return;clearTimeout(jobTimer);job.state='cancelRequested';render();jobTimer=setTimeout(()=>{if(state.job!==job)return;if(cancelRace){cancelRace=false;job.fail=false;model.complete(state,job);}else job.state='cancelled';render();},650);}
function openSave() { const candidate=state.candidate;if(!candidate)return;if(candidate.savedVersion){const version=candidate.savedVersion;showSnapshot(versionName(version),version.input,version.abc,version.parent);return;}saveTarget=candidate;showError('save-error','');$('save-parent').textContent=`${t('parent')} V1 · ${t('input')} r${candidate.input.score.revision}`;$('save-dialog').showModal(); }
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
function reset(empty=false) {
  clearTimeout(jobTimer);clearTimeout(validationTimer);failures.clear();holdNext=false;cancelRace=false;state=model.initial();state.present=!empty;if(empty)state.versions=[];checked=null;checkStatus='checking';checkError='';actionError='';$('abc').value=state.draft;$('notation').replaceChildren();$('scenarios').close();render();if(!empty)validateDraft();
}
function scenario(name) {
  if(name==='reset'||name==='empty'){reset(name==='empty');return;}
  if(name==='invalid'){updateDraft(state.draft+'\nC ? D |');$('scenarios').close();return;}
  if(name==='loading'){loading=true;render();$('scenarios').close();setTimeout(()=>{loading=false;render();toast(t('loaded'));},1300);return;}
  if(name==='hold'){holdNext=true;if(state.job&&['queued','running'].includes(state.job.state)){clearTimeout(jobTimer);state.job.state='running';state.job.held=true;holdNext=false;render();}$('scenario-message').textContent=t('holdArmed');return;}
  if(name==='complete'){if(state.job&&['queued','running'].includes(state.job.state)){finishJob(state.job);$('scenarios').close();}else $('scenario-message').textContent=t('noJob');return;}
  if(name==='cancel-race'){cancelRace=true;$('scenario-message').textContent=t('raceArmed');return;}
  failures.add(name);$('scenario-message').textContent=t('armed');
}
$('abc').addEventListener('input',()=>updateDraft($('abc').value));
$('validate').addEventListener('click',validateDraft);
$('restore').addEventListener('click',()=>{updateDraft(state.versions[0].abc);toast(t('copied'));});
$('play-score').addEventListener('click',playScore);$('export-midi').addEventListener('click',exportMidi);
$('select-score').addEventListener('click',()=>{if(!isCurrent())return;model.select(state);render();toast(t('selectedToast'));});
$('generate').addEventListener('click',generate);$('save-form').addEventListener('submit',saveCandidate);
$('load-sample').addEventListener('click',()=>{state.present=true;state.versions=model.initial().versions;render();validateDraft();});
$('save-close').addEventListener('click',()=>$('save-dialog').close());$('snapshot-close').addEventListener('click',()=>$('snapshot-dialog').close());
$('scenarios-open').addEventListener('click',()=>{$('scenario-message').textContent='';$('scenarios').showModal();});$('scenarios-close').addEventListener('click',()=>$('scenarios').close());
$('language').addEventListener('click',()=>{language=language==='zh'?'en':'zh';$('toast').classList.remove('visible');['submit-error','save-error','player-error'].forEach(id=>{ $(id).textContent=localizedError($(id).textContent); });render();});$('theme').addEventListener('click',()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='light'?'dark':'light';render();});
$('lyrics').addEventListener('input',()=>{$('lyrics-copy').textContent=$('lyrics').value;});
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.tab){document.querySelectorAll('[data-tab]').forEach(item=>{const active=item===button;item.classList.toggle('active',active);item.setAttribute('aria-selected',active);});['score','lyrics','versions'].forEach(tab=>$(tab+'-view').hidden=tab!==button.dataset.tab);render();}
  if(button.dataset.scenario)scenario(button.dataset.scenario);
  if(button.dataset.version){const version=state.versions.find(item=>item.id===button.dataset.version);showSnapshot(versionName(version),version.input,version.abc,version.parent);}
  if(button.dataset.versionPlay){const version=state.versions.find(item=>item.id===button.dataset.versionPlay);setMedia({kind:'historical',name:versionName(version)},'sample.mp3');playMedia();}
  switch(button.dataset.action){
    case 'job-input':showSnapshot(state.job.id,state.job.input,null,state.job.input.score.parent);break;
    case 'cancel':cancelJob();break;
    case 'retry':runJob(model.submit(state,null,state.job.input));break;
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
$('abc').value=state.draft;render();validateDraft();
