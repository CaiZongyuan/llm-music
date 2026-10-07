/* Throwaway interaction preview. Business objects are in memory; no API/WS calls. */
const sample = {
  style: 'English, gentle folk pop, warm clear voice, acoustic guitar and piano, light bass and drums, 96 BPM',
  lyrics: '[Verse]\nMorning gathers on the window\nQuiet streets begin to glow\nI will carry one small promise\nEvery step can help it grow\n\n[Chorus]\nWalk with me into the daylight\nLet the little river flow\nWe can make a brighter moment\nWith the kindness that we show',
  seed: '2026192201',
};
const ABC = 'X:1\nT:Preview melody\nM:4/4\nL:1/4\nQ:1/4=120\nK:C\nC D E F |\n';
const phases = { Generate: ['loading_model', 'planning_score', 'generating_semantic', 'synthesizing', 'decoding_audio', 'saving'], Transcribe: ['loading_model', 'transcribing', 'saving'] };
const phaseNames = { preparing: '准备输入', loading_model: '加载音乐模型', planning_score: '构思乐谱', generating_semantic: '生成音乐结构', synthesizing: '合成音乐', decoding_audio: '解码音频', saving: '整理与保存结果', transcribing: '听取旋律，整理乐谱' };
const statusNames = { queued: '排队中', running: '创作中', completed: '已完成', failed: '失败', cancelled: '已取消' };
const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
let nextId = 0;
const id = kind => `${kind}-${++nextId}`;
const makeProject = (name, description = '') => ({ id: id('project'), name, description, refs: [], scores: [], candidates: [], versions: [], jobs: [], draft: { ...sample }, selectedRef: null, selectedScore: null, selectedCandidate: null });
const state = { projects: [], projectId: null, page: 'workspace', tab: 'generate', runtime: 'ready', ws: true, fault: null, loading: false, loadError: false, generationError: '', uploadError: '', saveTarget: null, saving: false, playback: null, region: { start: 0, end: null, loop: false } };
const originalJobs = new Map();
const blobUrls = new Set();
const project = () => state.projects.find(item => item.id === state.projectId);
const label = operation => operation === 'Generate' ? '生成音乐' : '音频转谱';
const isActive = job => ['queued', 'running'].includes(job.status);
const isReady = () => state.runtime === 'ready';

// Small local state machine: one simulated queue, explicit save, distinct retry ids.
const engine = {
  submit(owner, operation, inputs) {
    const job = { id: id('job'), projectId: owner.id, operation, inputs: structuredClone(inputs), status: 'queued', phase: 'preparing', progress: null, cancel_requested: false, recovery_required: false, born: Date.now(), started: null, failure: state.fault === 'task', cancelRace: state.fault === 'cancel-race', result: null, error: null };
    if (['task', 'cancel-race'].includes(state.fault)) state.fault = null;
    originalJobs.set(job.id, job);
    owner.jobs.push(structuredClone(job));
    return job;
  },
  publish(job) {
    const owner = state.projects.find(item => item.id === job.projectId);
    if (!owner) return;
    const position = owner.jobs.findIndex(item => item.id === job.id);
    const snapshot = structuredClone(job);
    if (position < 0) owner.jobs.push(snapshot); else owner.jobs[position] = snapshot;
  },
  complete(job) {
    const owner = state.projects.find(item => item.id === job.projectId);
    if (!owner || !isActive(job)) return;
    const score = { id: id('score'), jobId: job.id, referenceId: job.operation === 'Transcribe' ? job.inputs.reference_asset_id : null, abc: ABC };
    owner.scores.push(score);
    owner.selectedScore = score.id;
    if (job.operation === 'Generate') {
      const candidate = { id: id('candidate'), projectId: owner.id, jobId: job.id, scoreId: score.id, inputs: structuredClone(job.inputs), audioUrl: 'sample-pr58.mp3', name: `晨光 · 候选 ${owner.candidates.length + 1}` };
      owner.candidates.push(candidate);
      owner.selectedCandidate = candidate.id;
      job.result = { score_id: score.id, candidate_id: candidate.id };
    } else job.result = { score_id: score.id };
    job.status = 'completed'; job.phase = null; job.progress = null; job.cancel_requested = false;
  },
  tick() {
    let changed = false;
    const jobs = [...originalJobs.values()];
    for (const job of jobs.filter(isActive)) {
      if (job.cancelAt && Date.now() - job.cancelAt > 800) {
        if (job.cancelRace) this.complete(job);
        else { job.status = 'cancelled'; job.phase = null; job.cancel_requested = false; }
        changed = true;
      }
    }
    let running = jobs.find(job => job.status === 'running');
    if (!running) {
      const waiting = jobs.find(job => job.status === 'queued' && !job.cancel_requested);
      if (waiting && Date.now() - waiting.born > 1800) { waiting.status = 'running'; waiting.started = Date.now(); running = waiting; changed = true; }
    }
    if (running) {
      const elapsed = Date.now() - running.started;
      const sequence = phases[running.operation];
      const phase = sequence[Math.min(sequence.length - 1, Math.floor(elapsed / (7200 / sequence.length)))];
      if (phase !== running.phase) { running.phase = phase; changed = true; }
      if (running.failure && elapsed >= 3500) { running.status = 'failed'; running.phase = null; running.error = { code: running.operation === 'Generate' ? 'runtime_out_of_memory' : 'transcription_failed', message: running.operation === 'Generate' ? '这次创作没有完成，显存资源暂时不足。' : '这段参考音频暂时没能完成转谱。', recovery: '输入与已有结果已保留。检查运行状态后，明确重试一次。' }; changed = true; }
      else if (elapsed >= 7200) { this.complete(running); changed = true; }
    }
    if (changed && state.ws) { jobs.forEach(job => this.publish(job)); render(); }
  },
  recover() { originalJobs.forEach(job => this.publish(job)); },
  cancel(jobId) {
    const job = originalJobs.get(jobId);
    if (!job || !isActive(job) || job.cancel_requested) return;
    job.cancel_requested = true; job.cancelAt = Date.now(); this.publish(job);
  },
};

function reset(empty = false) {
  originalJobs.clear(); nextId = 0;
  blobUrls.forEach(url => URL.revokeObjectURL(url)); blobUrls.clear();
  Object.assign(state, { projects: empty ? [] : [makeProject('Morning song', '把窗边的晨光，做成一段温暖的民谣。')], page: 'workspace', tab: 'generate', runtime: 'ready', ws: true, fault: null, loading: false, loadError: false, generationError: '', uploadError: '', saveTarget: null, saving: false, playback: null, region: { start: 0, end: null, loop: false } });
  state.projectId = state.projects[0]?.id ?? null;
  audio.pause(); audio.removeAttribute('src'); audio.load();
  $('#track-name').textContent = '选择一段音乐开始试听'; $('#track-source').textContent = '候选、已存版本与参考音频都在这里播放'; $('#player-error').textContent = '';
  if (empty) state.page = 'library';
  route(state.page === 'workspace' ? `project/${state.projectId}/generate` : 'library');
  updatePlayer();
}
function route(path) {
  const hash = `#${path}`;
  if (location.hash !== hash) location.hash = hash; else readRoute();
  $('.sidebar').classList.remove('open');
}
function readRoute() {
  const parts = location.hash.slice(1).split('/');
  if (parts[0] === 'project') { state.page = 'workspace'; state.projectId = parts[1]; state.tab = ['generate', 'transcribe', 'score', 'lyrics', 'versions'].includes(parts[2]) ? parts[2] : 'generate'; }
  else if (['library', 'jobs', 'runtime', 'settings'].includes(parts[0])) state.page = parts[0];
  else state.page = 'library';
  render();
}
function toast(message) {
  $('#toast').textContent = message; $('#toast').classList.add('visible');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => $('#toast').classList.remove('visible'), 3800);
}
function empty(title, message, action = '') { return `<div class="empty"><span class="empty-symbol" aria-hidden="true">♪</span><h3>${title}</h3><p>${message}</p>${action}</div>`; }
function button(action, text, extra = '') { return `<button type="button" data-action="${action}" ${extra}>${text}</button>`; }
function connection() { return state.ws ? '' : `<div class="connection"><span>实时更新已断开。任务仍可能继续，你可以重新读取同一任务。</span>${button('recover', '重新读取任务')}${button('reconnect', '重新连接')}</div>`; }
function latestJob(owner) { return owner.jobs.at(-1); }
function jobCard(job, withProject = false) {
  const active = isActive(job);
  const owner = state.projects.find(item => item.id === job.projectId);
  return `<article class="job-strip" data-job-id="${job.id}"><div class="job-top"><div><strong>${label(job.operation)}</strong> <span class="tag ${job.status === 'completed' ? 'good' : job.status === 'failed' ? 'bad' : ''}">${statusNames[job.status]}</span>${withProject ? `<small>${escape(owner?.name)} · ${job.id}</small>` : ''}</div><div>${active ? button('cancel', job.cancel_requested ? '等待取消确认' : '取消任务', `data-id="${job.id}" ${job.cancel_requested ? 'disabled' : ''}`) : ['failed', 'cancelled'].includes(job.status) ? button('retry', '重试一次', `data-id="${job.id}" ${!isReady() ? 'disabled' : ''}`) : button('result', '查看结果', `data-id="${job.id}"`)}</div></div><p>${job.cancel_requested ? '已提出取消，正在等待最终确认。' : active ? phaseNames[job.phase] ?? '等待可用的创作资源' : job.status === 'completed' ? '结果已整理完成，可以查看和试听。' : job.status === 'cancelled' ? '这次任务已取消。你的输入与原有素材都还在。' : escape(job.error?.message)}</p>${active ? job.progress === null ? '<div class="indeterminate" aria-label="进度未知，不显示百分比"></div>' : `<progress max="1" value="${job.progress}" aria-label="可测量的任务进度"></progress><small>已测量 ${(job.progress * 100).toFixed(0)}%（预览 fixture）</small>` : ''}${job.error ? `<small>${escape(job.error.recovery)} <span class="muted">${escape(job.error.code)}</span></small>` : ''}${!withProject ? `<small>${job.id} · 此处状态为隔离模拟</small>` : ''}</article>`;
}
function candidateCard(owner, selected = null) {
  const candidate = selected ?? owner.candidates.find(item => item.id === owner.selectedCandidate);
  if (!candidate) return empty('你的下一段音乐，在这里', '写下风格和歌词，再听听灵感变成音乐的样子。值得保留的结果，由你决定。');
  const version = owner.versions.find(item => item.candidateId === candidate.id);
  const bars = Array.from({ length: 55 }, (_, index) => `<i style="--bar:${12 + (index * 37 % 53)}"></i>`).join('');
  return `<div class="candidate-title"><div><h3>${escape(candidate.name)}</h3><small>约 35 秒 · 音频与乐谱</small></div><span class="tag ${version ? 'good' : ''}">${version ? '已保存' : '尚未保存'}</span></div><div class="candidate-art" aria-hidden="true">${bars}</div><p class="hint">先听旋律与人声，再看看乐谱。喜欢这次尝试，就为它留下一个版本。</p><div class="actions">${button('listen-candidate', '▶ 试听这段音乐', `data-id="${candidate.id}" class="primary"`)}${button('candidate-score', '查看乐谱', `data-id="${candidate.id}"`)}${button('save', version ? '查看已存版本' : '保存为版本', `data-id="${candidate.id}"`)}</div><small class="fine-print">预览始终播放 PR #58 的同一份历史真实音乐，输入变化不会生成新音频。乐谱为独立合法示例，未声称与该音乐对应。</small>`;
}
function libraryView() {
  return `<div class="page-heading"><div><div class="eyebrow">YOUR MUSIC, YOUR SPACE</div><h1>给灵感一个去处</h1><p>一个项目，收藏参考素材、创作尝试和想要留下的版本。</p></div>${button('new-project', '＋ 新建项目', 'class="primary"')}</div>${state.projects.length ? `<div class="project-cards">${state.projects.map(owner => `<article class="project-card"><div class="project-cover" aria-hidden="true">♫<small>MUSIC EXPLORATION</small></div><div class="project-card-body"><h3>${escape(owner.name)}</h3><p>${escape(owner.description || '一段新的创作旅程')}</p><small>${owner.versions.length} 个版本 · ${owner.refs.length} 份参考素材</small><div class="actions">${button('open-project', '继续创作 →', `data-id="${owner.id}"`)}</div></div></article>`).join('')}</div>` : `<div class="surface">${empty('还没有音乐项目', '可以从一段歌词开始，也可以带上一段参考音频。', button('new-project', '创建第一个项目', 'class="primary"'))}</div>`}<div class="library-note"><h3>每次尝试，都不必急着保存</h3><p>生成结果会先成为候选。试听、检查乐谱，再把喜欢的那一次保存为版本。下一次实验会继续保留已有版本。</p></div>`;
}
function generateView(owner) {
  return `<div class="workspace-grid"><section class="surface"><h3>让想法变成一段音乐</h3><p class="hint">描述一个清楚的方向，用一小段歌词试试。当前先创作 35 秒。</p><form id="generate-form">${state.generationError ? `<div class="form-error" role="alert">${escape(state.generationError)}</div>` : ''}<label>音乐风格<textarea id="style" name="style" rows="3" maxlength="1024" required>${escape(owner.draft.style)}</textarea><small class="field-help">语言、情绪、乐器与节奏。一次先改变一个方向。</small></label><label>歌词<textarea id="lyrics" name="lyrics" rows="8" maxlength="10000" required>${escape(owner.draft.lyrics)}</textarea><small class="field-help">可以用 [Verse] 和 [Chorus] 组织段落。</small></label><div class="field-row"><label>随机种子<input id="seed" name="seed" inputmode="numeric" value="${escape(owner.draft.seed)}" required><small class="field-help">保留种子，方便记录这次尝试。</small></label><label>片段长度<input value="35 秒" aria-label="固定片段长度" readonly></label></div><div class="form-footer"><small>生成后先试听，由你选择是否保存。</small><button class="primary" type="submit" ${!isReady() ? 'disabled' : ''}>生成一段音乐 →</button></div>${!isReady() ? '<p class="not-ready">暂时无法开始，请先查看并恢复运行状态。</p>' : ''}</form></section><div><section class="surface soft">${candidateCard(owner)}</section>${latestJob(owner) ? jobCard(latestJob(owner)) : `<section class="job-strip"><small>创作任务会在这里显示阶段与结果。未知进度不会显示百分比。</small></section>`}<section class="library-note"><h3>换一种声音，再试一次</h3><p>先保持歌词和种子，只改变风格。保存喜欢的版本后，可以回来继续探索。</p>${button('recipe', '试试更轻的钢琴方向', 'class="inline-text"')}</section></div></div>`;
}
function transcribeView(owner) {
  return `<div class="workspace-grid"><section class="surface"><h3>从参考音乐里，找到旋律</h3><p class="hint">转谱把音乐整理成乐谱与 MIDI，不是歌词识别。</p>${state.uploadError ? `<div class="form-error" role="alert">${escape(state.uploadError)}</div>` : ''}<div class="upload-zone"><strong>带来一段参考音频</strong><p class="hint">先用约 16 秒的清晰 WAV 片段。</p><label>选择本地 WAV<input id="reference-file" type="file" accept=".wav,audio/wav"></label>${button('sample-reference', '使用 16 秒旋律示例')}<small>示例为合成音符，不是真实转谱准确率证明。</small></div>${owner.refs.length ? owner.refs.map(ref => `<div class="reference-item ${ref.id === owner.selectedRef ? 'selected' : ''}"><span aria-hidden="true">♪</span><div class="reference-info"><strong>${escape(ref.name)}</strong><small>${ref.seconds.toFixed(1)} 秒 · ${ref.channels === 1 ? '单声道' : '立体声'} · ${ref.rate / 1000} kHz · PCM${ref.bits}${ref.synthetic ? ' · 合成示例' : ''}</small></div>${button('select-ref', ref.id === owner.selectedRef ? '已选中' : '选择', `data-id="${ref.id}"`)}${button('listen-ref', '试听', `data-id="${ref.id}"`)}</div>`).join('') : '<small>这里还没有参考素材。</small>'}<div class="actions">${button('transcribe', '开始转谱 →', `class="primary" ${!owner.selectedRef || !isReady() ? 'disabled' : ''}`)}</div><small class="fine-print">已验证范围：16 秒 PCM16，单声道 24 kHz 或双声道 48 kHz。上传预算不表示更长音频已可稳定转谱。</small></section><div><section class="surface soft">${owner.scores.some(score => score.referenceId) ? `<h3>参考音频的乐谱已就绪</h3><p class="hint">查看示例谱面、ABC，与源音频对照；MIDI 可下载到其他音乐工具。</p>${button('score', '查看乐谱与下载 MIDI', 'class="primary"')}` : empty('听见音乐，也看见它', '转谱完成后，乐谱、ABC 与 MIDI 会出现在这个项目中。')}</section>${latestJob(owner) ? jobCard(latestJob(owner)) : ''}</div></div>`;
}
function scoreView(owner) {
  const score = owner.scores.find(item => item.id === owner.selectedScore) ?? owner.scores.at(-1);
  if (!score) return `<div class="surface">${empty('还没有可以查看的乐谱', '生成音乐或完成一次转谱，就能来到这里检查结果。', button('transcribe-tab', '从参考音频转谱'))}</div>`;
  const reference = owner.refs.find(item => item.id === score.referenceId);
  const lines = [35, 45, 55, 65, 75].map(y => `<line x1="15" x2="460" y1="${y}" y2="${y}" stroke="#ada396" stroke-width="1"/>`).join('');
  const notes = [[110, 85], [185, 80], [260, 75], [335, 70]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="7" ry="5" transform="rotate(-20 ${x} ${y})" fill="#55483a"/><line x1="${x + 6}" x2="${x + 6}" y1="${y}" y2="${y - 31}" stroke="#55483a" stroke-width="1.5"/>`).join('');
  return `<div class="select-list">${owner.scores.map((item, index) => button('select-score', `乐谱 ${index + 1} · ${item.referenceId ? '参考转谱' : '生成候选'}`, `data-id="${item.id}" class="${item.id === score.id ? 'active' : ''}"`)).join('')}</div><div class="workspace-grid"><section class="surface"><div class="candidate-title"><h3>先看旋律，再听一遍</h3><span class="tag">只读乐谱</span></div><div class="notation"><svg viewBox="0 0 475 110" role="img" aria-label="四个四分音符 C、D、E、F 的示例乐谱">${lines}<text x="25" y="77" font-size="58" fill="#776552">𝄞</text>${notes}<line x1="430" x2="430" y1="35" y2="75" stroke="#55483a"/></svg><small>合法 ABC/MIDI 的四音符示例，谱面为预览示意；正式产品将用 abcjs 渲染。</small></div><p class="hint">检查音符与节奏是否接近你听到的方向。转谱结果需要听辨，不能假定准确。</p><div class="actions">${button('download-midi', '↓ 下载 MIDI', `data-id="${score.id}" class="primary"`)}${button('download-abc', '下载 ABC', `data-id="${score.id}"`)}${reference ? button('listen-ref', '试听原参考', `data-id="${reference.id}"`) : button('listen-score-audio', '试听候选音乐', `data-id="${score.id}"`)}</div><small class="fine-print">本预览 MIDI/ABC 是独立模拟产物，未声称来自你选择的音频。编辑乐谱与重新生成属于后续阶段。</small></section><section class="surface soft"><h3>ABC 音乐表示</h3><pre class="score-code">${escape(score.abc)}</pre><div class="metric"><span>来源</span><strong>${reference ? escape(reference.name) : '音乐生成候选（无参考音频）'}</strong></div><div class="metric"><span>关联任务</span><strong>${score.jobId}</strong></div>${reference ? `<small>参考素材 ${reference.id} 已保留，可回到参考音频标签再次试听。</small>` : '<small>生成候选的乐谱没有 Reference Audio，避免混淆来源。</small>'}</section></div>`;
}
function lyricsView(owner) { return `<div class="workspace-grid"><section class="surface"><h3>这一次创作的歌词</h3><p class="hint">切换到这里时，底部音乐仍然继续播放。</p><div class="note-pad">${escape(owner.draft.lyrics)}</div><div class="actions">${button('generate-tab', '回到生成，调整歌词')}</div></section><section class="surface soft"><h3>音乐方向</h3><p>${escape(owner.draft.style)}</p><div class="metric"><span>种子</span><strong>${escape(owner.draft.seed)}</strong></div><small>候选与保存版本另有实际提交时的输入快照。这里显示当前草稿，不会改写已保存结果。</small></section></div>`; }
function versionsView(owner) { return `<div class="surface"><h3>留下你喜欢的那一次</h3><p class="hint">版本来自明确保存。未保存候选继续在生成标签中，可随时试听。</p>${owner.versions.length ? owner.versions.map((version, index) => `<article class="version-row" data-version-id="${version.id}"><span class="album-mark" aria-hidden="true">${index + 1}</span><div class="version-info"><h3>${escape(version.name)}</h3><small>来自 ${version.candidateId} · 35 秒 · ${version.id}</small><small>风格：${escape(version.inputs.style)} · 种子 ${version.inputs.seed}</small></div><div class="actions">${button('listen-version', '▶ 试听', `data-id="${version.id}"`)}${button('version-score', '查看乐谱', `data-id="${version.id}"`)}</div></article>`).join('') : empty('还没有保存的版本', '先生成并试听一个候选，再点击“保存为版本”。完成任务不会自动增加版本。', button('generate-tab', '回到音乐生成'))}</div>`; }
function jobsView() {
  const owner = project();
  const jobs = state.projects.flatMap(item => item.jobs).sort((a, b) => b.born - a.born);
  return `<div class="page-heading"><div><div class="eyebrow">CREATION IN PROGRESS</div><h1>每一次创作都有迹可循</h1><p>查看阶段，取消不需要的任务，或者带着原输入重新尝试。</p></div>${button('recover', '重新读取')}</div>${connection()}${jobs.length ? `<div class="job-list">${jobs.map(job => jobCard(job, true)).join('')}</div>` : `<div class="surface">${empty('还没有创作任务', '选择一个项目，开始生成音乐或从参考音频转谱。', owner ? button('open-project', '开始创作', `data-id="${owner.id}"`) : button('new-project', '新建项目'))}</div>`}`;
}
function runtimeView() {
  const readiness = { ready: ['可以开始创作', '模型与运行服务已就绪。'], missing: ['需要准备音乐模型', '必需模型缺失，恢复后才能提交创作。'], unavailable: ['暂时联系不到运行服务', '项目与已保存结果仍可查看。恢复连接后，重新检查。'], stale: ['需要重新检查就绪状态', '上次观测已经过期，旧的绿色状态不能代表当前可用。'] }[state.runtime];
  return `<div class="page-heading"><div><div class="eyebrow">READY WHEN YOU ARE</div><h1>开始之前，看一眼</h1><p>服务、模型与队列各有自己的状态。</p></div>${button('refresh-runtime', '重新检查')}</div><div class="runtime-grid"><section class="surface"><h3>${readiness[0]}</h3><p>${readiness[1]}</p><div class="metric"><span>应用服务</span><strong>可访问（模拟）</strong></div><div class="metric"><span>推理服务</span><strong>${state.runtime === 'unavailable' ? '失联' : state.runtime === 'stale' ? '状态过期' : '可访问'}</strong></div><div class="metric"><span>生成与转谱</span><strong>${isReady() ? '可开始' : '等待恢复'}</strong></div><small>此页为隔离展示，未读取真实 GPU 或服务。</small>${!isReady() ? `<div class="actions">${button('ready', '模拟恢复后再次检查', 'class="primary"')}</div>` : ''}</section><section class="surface soft"><h3>音乐模型</h3>${['YuE2', 'YuE2 VAE', 'SheetSage2'].map(name => `<div class="metric"><span>${name}</span><strong>${state.runtime === 'missing' ? '缺失' : state.runtime === 'stale' ? '上次已就绪 · 已过期' : state.runtime === 'unavailable' ? '当前状态未知' : '已就绪（模拟）'}</strong></div>`).join('')}<small>缺失/未知不会当成可用。版本、hash 与详细说明将在正式状态页按事实展示。</small></section><section class="surface"><h3>应用任务队列</h3><div class="metric"><span>已记录排队</span><strong>${state.projects.flatMap(item => item.jobs).filter(job => job.status === 'queued').length}</strong></div><div class="metric"><span>已记录运行</span><strong>${state.projects.flatMap(item => item.jobs).filter(job => job.status === 'running').length}</strong></div><p>应用记录的活跃任务摘要，不代表底层 GPU 的全部占用。</p>${button('jobs', '查看任务', 'class="inline-text"')}</section><section class="surface soft"><h3>设备观测</h3><div class="metric"><span>GPU / 显存</span><strong>未读取</strong></div><div class="metric"><span>已加载模型</span><strong>暂无观测</strong></div><small>没有真实读数时显示未知；不会填入 0 或估计数值。过期信息和失联会分别标明。</small></section></div>`;
}
function settingsView() { return `<div class="page-heading"><div><div class="eyebrow">A SIMPLE START</div><h1>专注音乐，其他按需查看</h1><p>这里先解释当前创作范围与环境设置。配置展示为只读。</p></div></div><div class="workspace-grid"><section class="surface"><h3>当前创作范围</h3><dl class="settings-list"><dt>音乐生成</dt><dd>风格与歌词 → 35 秒候选 → 试听与乐谱 → 明确保存版本</dd><dt>参考音频</dt><dd>已验证 16 秒 PCM16 WAV；单声道 24 kHz / 立体声 48 kHz</dd><dt>输入与随机种子</dt><dd>风格最多 1,024 字，歌词最多 10,000 字。网页整数种子在 JavaScript 安全范围内。</dd><dt>结果保留</dt><dd>正式产品通过应用服务保存项目、素材、任务与版本。这个隔离预览刷新后重置。</dd></dl></section><section class="surface soft"><h3>准备与排障</h3><p>正式产品会读取应用配置的元数据。运行端口、数据路径和模型准备由启动环境控制；这里不提供没有接口支持的“保存服务器配置”。</p><dl class="settings-list"><dt>暂时无法开始</dt><dd>先看运行状态，区分缺模型、失联与过期信息。</dd><dt>下一步玩法</dt><dd>先只换风格、只改一句歌词或只换种子。编辑、Cover 与 A/B 将在后续阶段加入。</dd></dl>${button('runtime', '查看运行状态', 'class="inline-text"')}</section></div>`; }
function render() {
  const active = document.activeElement;
  const focus = active?.id && ['INPUT', 'TEXTAREA'].includes(active.tagName) ? { id: active.id, start: active.selectionStart, end: active.selectionEnd } : null;
  const owner = project();
  $('#project-nav').innerHTML = state.projects.map(item => `<button class="project-link ${state.page === 'workspace' && owner?.id === item.id ? 'active' : ''}" data-action="open-project" data-id="${item.id}"><span aria-hidden="true">♪</span>${escape(item.name)}</button>`).join('') || '<small>从第一个项目开始</small>';
  document.querySelectorAll('[data-page]').forEach(link => link.classList.toggle('active', link.dataset.page === state.page));
  $('#breadcrumb').innerHTML = state.page === 'workspace' ? `我的项目 / <strong>${escape(owner?.name ?? '找不到项目')}</strong>` : `<strong>${{ library: '我的项目', jobs: '任务', runtime: '运行状态', settings: '使用设置' }[state.page]}</strong>`;
  $('#readiness').innerHTML = `<span class="status-dot ${state.runtime === 'missing' || state.runtime === 'stale' ? 'warning' : state.runtime === 'unavailable' ? 'error' : ''}"></span>${{ ready: '创作已就绪', missing: '需要模型', unavailable: '运行服务失联', stale: '状态需更新' }[state.runtime]}`;
  let content;
  if (state.loading) content = `<div class="blank-loading"><h2>正在找回你的项目</h2><div class="indeterminate" aria-label="正在加载"></div><p>隔离加载场景，可点击继续。</p>${button('finish-loading', '完成模拟加载')}</div>`;
  else if (state.loadError) content = `<div class="error-box"><h3>暂时没有读到项目</h3><p>已保存的数据没有被删除。重新读取后可继续。</p>${button('recover-load', '重新读取项目')}</div>`;
  else if (state.page === 'workspace' && !owner) content = `<div class="surface">${empty('找不到这个项目', '这个项目地址不存在。返回项目列表重新选择。', button('library', '返回我的项目'))}</div>`;
  else if (state.page === 'workspace') {
    const tabs = [['generate', '音乐生成'], ['transcribe', '参考音频'], ['score', '乐谱'], ['lyrics', '歌词与输入'], ['versions', `版本 ${owner.versions.length || ''}`]];
    const views = { generate: generateView, transcribe: transcribeView, score: scoreView, lyrics: lyricsView, versions: versionsView };
    content = `<div class="page-heading"><div><div class="eyebrow">A PLACE FOR YOUR NEXT IDEA</div><h1>${escape(owner.name)}</h1><p>${escape(owner.description || '从一点灵感，走到一段喜欢的音乐。')}</p></div>${button('jobs', '查看任务', 'class="subtle"')}</div><nav class="tabs" aria-label="项目工作区">${tabs.map(([tab, text]) => button('tab', text, `data-tab="${tab}" class="${tab === state.tab ? 'active' : ''}" aria-current="${tab === state.tab ? 'page' : 'false'}"`)).join('')}</nav>${connection()}${views[state.tab](owner)}`;
  } else content = ({ library: libraryView, jobs: jobsView, runtime: runtimeView, settings: settingsView })[state.page]();
  $('#view').innerHTML = content;
  if (focus) { const field = document.getElementById(focus.id); field?.focus({ preventScroll: true }); if (field && focus.start !== null) field.setSelectionRange(focus.start, focus.end); }
}

const audio = $('#audio');
function listen(url, name, source, autoplay = true) {
  state.playback = { url, name, source };
  $('#track-name').textContent = name; $('#track-source').textContent = source; $('#player-error').textContent = '';
  if (state.fault === 'play') { state.fault = null; audio.pause(); $('#player-error').textContent = '播放暂时失败。重新点击试听即可恢复。'; updatePlayer(); return; }
  if (audio.getAttribute('src') !== url) { audio.src = url; state.region = { start: 0, end: null, loop: false }; }
  if (autoplay) audio.play().catch(() => { $('#player-error').textContent = '音频暂时不能播放，请点击播放按钮重试。'; updatePlayer(); });
  updatePlayer();
}
function formatTime(seconds) { const value = Math.max(0, Math.floor(seconds || 0)); return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`; }
function updatePlayer() {
  const hasAudio = Boolean(audio.getAttribute('src'));
  $('#play').disabled = !hasAudio; $('#play').textContent = audio.paused ? '▶' : 'Ⅱ'; $('#play').setAttribute('aria-label', audio.paused ? '播放' : '暂停');
  const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
  $('#seek').disabled = !duration; $('#seek').max = duration || 1; $('#seek').value = audio.currentTime || 0;
  $('#elapsed').textContent = formatTime(audio.currentTime); $('#duration').textContent = formatTime(duration);
  ['#mark-start', '#mark-end', '#region-loop'].forEach(selector => $(selector).disabled = !duration);
  $('#region-loop').setAttribute('aria-pressed', String(state.region.loop));
  $('#region-label').textContent = state.region.end === null ? '选择一个片段反复听' : `${formatTime(state.region.start)}—${formatTime(state.region.end)}`;
}
audio.addEventListener('timeupdate', () => { if (state.region.loop && state.region.end !== null && audio.currentTime >= state.region.end) audio.currentTime = state.region.start; updatePlayer(); });
['loadedmetadata', 'play', 'pause', 'ended'].forEach(event => audio.addEventListener(event, updatePlayer));
audio.addEventListener('error', () => { $('#player-error').textContent = '音频读取失败。请重新选择音频或重试试听。'; updatePlayer(); });
$('#play').addEventListener('click', () => { if (audio.paused) { $('#player-error').textContent = ''; audio.play().catch(() => $('#player-error').textContent = '暂时无法播放，请重试。'); } else audio.pause(); });
$('#seek').addEventListener('input', event => { audio.currentTime = Number(event.target.value); updatePlayer(); });
$('#mark-start').addEventListener('click', () => { state.region.start = audio.currentTime; if (state.region.end === null || state.region.end <= state.region.start) state.region.end = Math.min(audio.duration, state.region.start + 8); updatePlayer(); });
$('#mark-end').addEventListener('click', () => { if (audio.currentTime <= state.region.start) { toast('请先把播放位置移到起点之后，再设终点。'); return; } state.region.end = audio.currentTime; updatePlayer(); });
$('#region-loop').addEventListener('click', () => { if (state.region.end === null) { state.region.start = 0; state.region.end = Math.min(8, audio.duration); } state.region.loop = !state.region.loop; if (state.region.loop && (audio.currentTime < state.region.start || audio.currentTime >= state.region.end)) audio.currentTime = state.region.start; updatePlayer(); });

async function uploadFile(file) {
  const owner = project();
  if (!file || !owner) return;
  state.uploadError = '';
  try {
    if (file.size > 64 * 1024 * 1024) throw new Error('请使用 64 MiB 以内的 WAV 文件。');
    const bytes = await file.arrayBuffer(); const data = new DataView(bytes);
    const four = offset => String.fromCharCode(...new Uint8Array(bytes, offset, 4));
    if (bytes.byteLength < 44 || four(0) !== 'RIFF' || four(8) !== 'WAVE') throw new Error('没有读到有效 WAV，请重新选择 PCM16 音频。');
    let fmt = null, size = null;
    for (let offset = 12; offset + 8 <= bytes.byteLength;) {
      const length = data.getUint32(offset + 4, true);
      if (offset + 8 + length > bytes.byteLength) throw new Error('WAV 数据不完整，请重新导出后选择。');
      if (four(offset) === 'fmt ' && length >= 16) fmt = { code: data.getUint16(offset + 8, true), channels: data.getUint16(offset + 10, true), rate: data.getUint32(offset + 12, true), bytesPerSecond: data.getUint32(offset + 16, true), bits: data.getUint16(offset + 22, true) };
      if (four(offset) === 'data') size = length;
      offset += 8 + length + (length % 2);
    }
    if (!fmt || size === null || fmt.code !== 1 || fmt.bits !== 16 || ![1, 2].includes(fmt.channels) || !fmt.bytesPerSecond || !size) throw new Error('请选择有效的 PCM16 单声道或立体声 WAV。');
    const seconds = size / fmt.bytesPerSecond;
    if (Math.abs(seconds - 16) > .05 || !((fmt.channels === 1 && fmt.rate === 24000) || (fmt.channels === 2 && fmt.rate === 48000))) throw new Error('先用已验证的 16 秒片段：PCM16 单声道 24 kHz 或立体声 48 kHz。');
    const url = URL.createObjectURL(file); blobUrls.add(url);
    const ref = { id: id('asset'), name: file.name, url, seconds, channels: fmt.channels, rate: fmt.rate, bits: fmt.bits, synthetic: false };
    owner.refs.push(ref); owner.selectedRef = ref.id; toast('参考音频已加入此预览项目。');
  } catch (error) { state.uploadError = error.message; }
  render();
}
async function download(name) {
  if (state.fault === 'download') { state.fault = null; toast('示例下载暂时失败。结果仍保留，请再次点击下载。'); return; }
  try {
    const response = await fetch(name); if (!response.ok) throw new Error('download');
    // Use the static file URL for the actual download, so the browser keeps its
    // ordinary download behavior and the server owns filename/content type.
    const anchor = document.createElement('a'); anchor.href = name; anchor.download = name; document.body.append(anchor); anchor.click(); anchor.remove();
    toast('示例文件已交给浏览器下载。');
  } catch { toast('文件读取失败。结果仍保留，可以重新下载。'); }
}
function startJob(operation, inputs, owner = project()) {
  if (!owner || !isReady()) { toast('请先恢复运行状态。'); return; }
  engine.submit(owner, operation, inputs); render(); toast(`${label(operation)}已加入隔离队列。`);
}
function showSave(candidateId) {
  const owner = project(); const candidate = owner?.candidates.find(item => item.id === candidateId);
  if (!candidate) return;
  const saved = owner.versions.find(item => item.candidateId === candidateId);
  if (saved) { route(`project/${owner.id}/versions`); toast(`已找到同一版本：${saved.name}`); return; }
  state.saveTarget = { projectId: owner.id, candidateId }; $('#save-message').textContent = ''; $('#save-submit').disabled = false; $('#save-submit').textContent = '保存为版本'; $('#version-name').value = `${owner.name} · 第 ${owner.versions.length + 1} 次尝试`; $('#save-dialog').showModal();
}
function act(action, target) {
  const owner = project(); const itemId = target?.dataset.id;
  if (action === 'new-project') { $('#project-dialog').showModal(); return; }
  if (action === 'open-project') { route(`project/${itemId}/generate`); return; }
  if (['library', 'jobs', 'runtime', 'settings'].includes(action)) { route(action); return; }
  if (action === 'tab') { route(`project/${state.projectId}/${target.dataset.tab}`); return; }
  if (['score', 'transcribe-tab', 'generate-tab'].includes(action)) { route(`project/${state.projectId}/${{ score: 'score', 'transcribe-tab': 'transcribe', 'generate-tab': 'generate' }[action]}`); return; }
  if (action === 'recover') { engine.recover(); render(); toast('已重新读取同一批任务，没有重新提交。'); return; }
  if (action === 'reconnect') { state.ws = true; engine.recover(); render(); toast('实时更新已恢复。'); return; }
  if (action === 'finish-loading') { state.loading = false; render(); return; }
  if (action === 'recover-load') { state.loadError = false; render(); toast('已重新读取原项目。'); return; }
  if (action === 'ready') { state.runtime = 'ready'; render(); return; }
  if (action === 'refresh-runtime') { render(); toast(state.runtime === 'ready' ? '模拟观测已更新，可以创作。' : '当前问题仍存在；按页面恢复操作继续。'); return; }
  if (action === 'cancel') { engine.cancel(itemId); render(); return; }
  if (action === 'retry') { const old = originalJobs.get(itemId); const parent = state.projects.find(item => item.id === old?.projectId); if (old && !isActive(old) && ['failed', 'cancelled'].includes(old.status)) startJob(old.operation, old.inputs, parent); return; }
  if (action === 'result') { const job = originalJobs.get(itemId); const parent = state.projects.find(item => item.id === job?.projectId); if (parent && job.result) { parent.selectedScore = job.result.score_id; if (job.result.candidate_id) parent.selectedCandidate = job.result.candidate_id; route(`project/${parent.id}/${job.operation === 'Generate' ? 'generate' : 'score'}`); } return; }
  if (!owner) return;
  if (action === 'recipe') { owner.draft.style = 'English, soft piano pop, intimate warm voice, gentle piano, sparse percussion, 80 BPM'; render(); toast('只改变了风格。下一次音频仍为同一历史预览样本。'); return; }
  if (action === 'sample-reference') { const ref = { id: id('asset'), name: '16 秒旋律示例.wav', url: 'reference-16s.wav', seconds: 16, channels: 1, rate: 24000, bits: 16, synthetic: true }; owner.refs.push(ref); owner.selectedRef = ref.id; state.uploadError = ''; render(); toast('合成参考示例已加入项目。'); return; }
  if (action === 'select-ref') { owner.selectedRef = itemId; render(); return; }
  if (action === 'listen-ref') { const ref = owner.refs.find(item => item.id === itemId); if (ref) listen(ref.url, ref.name, ref.synthetic ? '合成旋律示例 · 16 秒' : '你选择的本地参考音频 · 仅在内存中'); return; }
  if (action === 'transcribe') { if (owner.selectedRef) startJob('Transcribe', { reference_asset_id: owner.selectedRef }); return; }
  if (action === 'listen-candidate') { const candidate = owner.candidates.find(item => item.id === itemId); if (candidate) listen(candidate.audioUrl, candidate.name, 'PR #58 历史真实音乐 · 不代表本次输入的生成结果'); return; }
  if (action === 'candidate-score') { const candidate = owner.candidates.find(item => item.id === itemId); if (candidate) { owner.selectedScore = candidate.scoreId; route(`project/${owner.id}/score`); } return; }
  if (action === 'save') { showSave(itemId); return; }
  if (action === 'select-score') { owner.selectedScore = itemId; render(); return; }
  if (action === 'download-midi') { download('preview-score.mid'); return; }
  if (action === 'download-abc') { download('preview-score.abc'); return; }
  if (action === 'listen-score-audio') { const candidate = owner.candidates.find(item => item.scoreId === itemId); if (candidate) listen(candidate.audioUrl, candidate.name, 'PR #58 历史真实音乐 · 与示例乐谱未作对应声明'); return; }
  if (action === 'listen-version') { const version = owner.versions.find(item => item.id === itemId); if (version) listen(version.audioUrl, version.name, '模拟保存版本 · PR #58 历史真实音乐'); return; }
  if (action === 'version-score') { const version = owner.versions.find(item => item.id === itemId); if (version) { owner.selectedScore = version.scoreId; route(`project/${owner.id}/score`); } }
}
function scenario(name) {
  $('#scenarios').close();
  if (name === 'reset' || name === 'empty') { reset(name === 'empty'); render(); return; }
  if (name === 'loading') { state.loading = true; state.page = 'library'; route('library'); render(); return; }
  if (name === 'load-error') { state.loadError = true; render(); return; }
  if (name === 'failure') { state.fault = 'task'; toast('下一次提交的任务会失败；原输入将保留。'); }
  if (name === 'save-error') { state.fault = 'save'; toast('下一次明确保存将失败，可再次保存恢复。'); }
  if (name === 'play-error') { state.fault = 'play'; toast('下一次试听会失败，重新选择音乐可恢复。'); }
  if (name === 'download-error') { state.fault = 'download'; toast('下一次下载会失败，再点一次可恢复。'); }
  if (name === 'cancel-race') { state.fault = 'cancel-race'; toast('下一次任务取消时会刚好完成，以最终结果为准。'); }
  if (name === 'disconnect') state.ws = false;
  if (name === 'reconnect') { state.ws = true; engine.recover(); }
  if (['missing', 'unavailable', 'stale', 'ready'].includes(name)) state.runtime = name;
  if (name === 'bad-route') { route('project/not-found/generate'); return; }
  if (name === 'queue') { let owner = project() ?? state.projects[0]; if (!owner) { owner = makeProject('排队体验'); state.projects.push(owner); state.projectId = owner.id; } state.runtime = 'ready'; engine.submit(owner, 'Generate', { ...sample, seed: Number(sample.seed), max_seconds: 35 }); engine.submit(owner, 'Generate', { ...sample, seed: Number(sample.seed) + 1, max_seconds: 35 }); route('jobs'); }
  if (name === 'known-progress') { const active = [...originalJobs.values()].find(isActive); if (active) { active.progress = .35; engine.publish(active); } else toast('先创建任务，再体验可测量进度。'); }
  render();
}
document.addEventListener('click', event => {
  const close = event.target.closest('[data-close]'); if (close) { document.getElementById(close.dataset.close).close(); return; }
  const scene = event.target.closest('[data-scenario]'); if (scene) { scenario(scene.dataset.scenario); return; }
  const target = event.target.closest('[data-action]'); if (target) act(target.dataset.action, target);
});
document.addEventListener('input', event => { const owner = project(); if (owner && ['style', 'lyrics', 'seed'].includes(event.target.id)) owner.draft[event.target.id] = event.target.value; });
document.addEventListener('change', event => { if (event.target.id === 'reference-file') uploadFile(event.target.files[0]); });
document.addEventListener('submit', event => {
  if (event.target.id !== 'generate-form') return;
  event.preventDefault(); const owner = project(); if (!owner) return;
  const input = { style: owner.draft.style.trim(), lyrics: owner.draft.lyrics.trim(), seed: Number(owner.draft.seed), max_seconds: 35 };
  state.generationError = !input.style || !input.lyrics ? '请保留至少一个风格描述和一段歌词。' : !/^\d+$/.test(owner.draft.seed) || !Number.isSafeInteger(input.seed) || input.seed < 0 ? '请使用 0–9,007,199,254,740,991 之间的整数种子，避免网页舍入。' : '';
  if (state.generationError) { render(); return; } startJob('Generate', input);
});
$('#project-form').addEventListener('submit', event => { event.preventDefault(); const form = new FormData(event.target); const name = String(form.get('name')).trim(); if (!name) return; const owner = makeProject(name, String(form.get('description')).trim()); state.projects.push(owner); state.projectId = owner.id; $('#project-dialog').close(); event.target.reset(); route(`project/${owner.id}/generate`); toast('新项目已创建在隔离预览中。'); });
$('#save-form').addEventListener('submit', event => {
  event.preventDefault(); if (state.saving || !state.saveTarget) return;
  const target = { ...state.saveTarget }; const name = $('#version-name').value.trim(); if (!name) { $('#save-message').textContent = '请为版本填写名称。'; return; }
  state.saving = true; $('#save-submit').disabled = true; $('#save-submit').textContent = '正在保存…'; $('#save-message').textContent = '';
  setTimeout(() => {
    state.saving = false; $('#save-submit').disabled = false; $('#save-submit').textContent = '保存为版本';
    if (state.fault === 'save') { state.fault = null; $('#save-message').textContent = '保存暂时失败，候选和名称都已保留。再次点击保存即可重试。'; return; }
    const owner = state.projects.find(item => item.id === target.projectId); const candidate = owner?.candidates.find(item => item.id === target.candidateId);
    if (!candidate) { $('#save-message').textContent = '找不到原候选，请返回项目重新选择。'; return; }
    let version = owner.versions.find(item => item.candidateId === candidate.id);
    if (!version) { version = { ...structuredClone(candidate), id: id('version'), candidateId: candidate.id, name }; owner.versions.push(version); }
    $('#save-dialog').close(); state.saveTarget = null; route(`project/${owner.id}/versions`); toast(`已保留同一版本：${version.name}`);
  }, 650);
});
$('#scenarios-open').addEventListener('click', () => $('#scenarios').showModal());
$('#mobile-nav').addEventListener('click', () => $('.sidebar').classList.toggle('open'));
window.addEventListener('hashchange', readRoute);
setInterval(() => engine.tick(), 400);
reset();
// Read-only observability for browser verification; does not expose mutation hooks.
window.previewSnapshot = () => ({ projectId: state.projectId, page: state.page, tab: state.tab, ws: state.ws, runtime: state.runtime, projects: state.projects.map(owner => ({ id: owner.id, name: owner.name, referenceIds: owner.refs.map(ref => ref.id), scoreIds: owner.scores.map(score => score.id), candidateIds: owner.candidates.map(candidate => candidate.id), versions: owner.versions.map(version => ({ id: version.id, candidateId: version.candidateId, name: version.name, inputs: version.inputs })), jobs: owner.jobs.map(job => ({ id: job.id, projectId: job.projectId, status: job.status, operation: job.operation, phase: job.phase, progress: job.progress, cancel_requested: job.cancel_requested, result: job.result })) })), originalIds: [...originalJobs.keys()], playback: state.playback, currentTime: audio.currentTime, audioPaused: audio.paused, region: { ...state.region } });
