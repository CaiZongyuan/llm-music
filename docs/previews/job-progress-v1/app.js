/* 全部数据只存内存；无网络请求（CSP connect-src 'none'）。 */
const root = document.documentElement;

const T = {
  zh: {
    jobName: { Generate: '音乐生成', GenerateFromScore: '音乐生成', Cover: '乐谱 Cover', Transcribe: '参考转谱' },
    status: {
      queued: '等待创作资源', running: '创作中', completed: '已完成', failed: '失败', cancelled: '已取消',
    },
    phase: {
      preparing: '准备中', loading_model: '加载音乐模型', planning_score: '规划乐谱',
      generating_semantic: '生成音乐结构', synthesizing: '合成音乐', decoding_audio: '解码音频',
      transcribing: '转谱中', saving: '保存结果',
    },
    copy: {
      unknown: '进度未知；展示当前阶段', measured: '实测进度',
      cancel: '已请求取消；等待最终确认。', problem: '未完成原因',
      memoryReason: '创作资源 GPU 显存不足。恢复已验证的显存配置后，明确创建新的重试任务。',
      elapsed: '已用时', total: '总耗时', result: '结果已保存到项目，可从转谱或生成页面继续检查。',
      identity: '任务标识', emptyTitle: '还没有任务', emptyBody: '用左侧控制启动一次模拟生成或转谱。',
      autoNote: '自动推进中；阶段来自已证实的运行时阶段，间隔为演示值。',
      modeReal: '真实模式：阶段步骤条', modeFake: 'fake 模式：数字进度条',
    },
    sequenceHint: { Generate: '生成阶段序列', Transcribe: '转谱阶段序列' },
    themeToggle: { zh: '暗色', en: 'Dark' }, langToggle: { zh: 'EN', en: '中' },
  },
  en: {
    jobName: { Generate: 'Music generation', GenerateFromScore: 'Music generation', Cover: 'Score Cover', Transcribe: 'Reference transcription' },
    status: {
      queued: 'Waiting for creative resources', running: 'Creating', completed: 'Completed', failed: 'Failed', cancelled: 'Cancelled',
    },
    phase: {
      preparing: 'Preparing', loading_model: 'Loading music models', planning_score: 'Planning score',
      generating_semantic: 'Generating musical structure', synthesizing: 'Synthesizing music', decoding_audio: 'Decoding audio',
      transcribing: 'Transcribing', saving: 'Saving results',
    },
    copy: {
      unknown: 'Progress is unknown; showing the current phase', measured: 'Measured progress',
      cancel: 'Cancellation requested; waiting for final confirmation.', problem: 'Why it did not finish',
      memoryReason: 'Creative resources ran out of GPU memory. Restore a verified memory configuration, then explicitly create a new retry job.',
      elapsed: 'Elapsed', total: 'Total time', result: 'Results are saved to the project; inspect them from the score or generation pages.',
      identity: 'Job identity', emptyTitle: 'No jobs yet', emptyBody: 'Start a simulated generation or transcription with the controls.',
      autoNote: 'Auto-advancing; phases come from confirmed runtime phases, intervals are demo values.',
      modeReal: 'Real mode: phase stepper', modeFake: 'Fake mode: numeric bar',
    },
    sequenceHint: { Generate: 'Generation phase sequence', Transcribe: 'Transcription phase sequence' },
    themeToggle: { zh: '暗色', en: 'Dark' }, langToggle: { zh: 'EN', en: '中' },
  },
};

/* 阶段序列与后端 OPERATION_PHASES / CAPTIONS 一致（planning_score 仅 Generate）。 */
const SEQUENCES = {
  Generate: ['preparing', 'loading_model', 'planning_score', 'generating_semantic', 'synthesizing', 'decoding_audio', 'saving'],
  Transcribe: ['preparing', 'loading_model', 'transcribing', 'saving'],
};
/* 演示推进间隔（毫秒）；真实推理各阶段耗时由运行时决定。 */
const DEMO_INTERVALS = { preparing: 1500, loading_model: 2600, planning_score: 1800, generating_semantic: 3200, synthesizing: 2600, decoding_audio: 2000, transcribing: 2800, saving: 1500 };
/* fake 运行时的数字进度仅用于测试对照。 */
const FAKE_PROGRESS = { preparing: 0.05, loading_model: 0.2, planning_score: 0.35, generating_semantic: 0.55, synthesizing: 0.75, decoding_audio: 0.9, transcribing: 0.5, saving: 0.97 };

let lang = 'zh';
let state = null;   // null = 空状态
let timer = null;

const $ = id => document.getElementById(id);

function text(key, kind = 'copy') {
  if (kind === 'copy') return T[lang].copy[key];
  if (kind === 'status') return T[lang].status[key];
  if (kind === 'phase') return T[lang].phase[key];
  if (kind === 'job') return T[lang].jobName[key];
  return key;
}

function clock(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

function startJob(operation) {
  stopTimer();
  state = {
    id: crypto.randomUUID(), operation, sequence: SEQUENCES[operation],
    index: 0, status: 'running', cancelRequested: false,
    startedAt: Date.now(), endedAt: null, error: null,
    auto: true, fakeProgress: false,
  };
  scheduleNext();
  timer = setInterval(tickClock, 1000);
  render();
  $('status-line').textContent = text('autoNote');
}

function scheduleNext() {
  if (!state || !state.auto || state.status !== 'running') return;
  const phase = state.sequence[state.index];
  state.nextAt = Date.now() + (DEMO_INTERVALS[phase] ?? 2000);
}

function tickClock() {
  if (!state || state.status !== 'running') return;
  if (state.auto && state.nextAt && Date.now() >= state.nextAt) {
    if (state.index < state.sequence.length - 1) { state.index += 1; scheduleNext(); }
    else finish('completed');
  }
  render();
}

function jumpTo(phase) {
  if (!state || state.status !== 'running') return;
  const idx = state.sequence.indexOf(phase);
  if (idx < 0) return;
  state.auto = false;
  state.index = idx;
  render();
}

function finish(status, error = null) {
  if (!state || state.status === 'completed' || state.status === 'failed' || state.status === 'cancelled') return;
  stopTimer();
  state.status = status;
  state.endedAt = Date.now();
  state.error = error;
  render();
}

function requestCancel() {
  if (!state || state.status !== 'running') return;
  state.cancelRequested = true;
  render();
}

/* 渲染：结构与生产 JobStatus 相同，新增步骤条与已用时间。 */
function render() {
  const area = $('job-area');
  if (!state) {
    area.innerHTML = `<div class="job-card"><div class="section-heading"><strong>${text('emptyTitle')}</strong></div><p class="muted">${text('emptyBody')}</p></div>`;
    $('jump-phase').innerHTML = '';
    $('jump-phase').disabled = $('fail').disabled = $('cancel').disabled = true;
    return;
  }
  const running = state.status === 'running';
  const fake = $('fake-mode').checked;
  $('jump-phase').disabled = $('fail').disabled = $('cancel').disabled = !running;
  $('jump-phase').innerHTML = state.sequence
    .map(p => `<option value="${p}">${text(p, 'phase')}</option>`).join('');
  $('jump-phase').value = state.sequence[state.index];

  const phaseKey = running ? state.sequence[state.index] : null;
  const phaseLabel = running ? (text(phaseKey, 'phase')) : text(state.status, 'status');
  const elapsed = ((state.endedAt ?? Date.now()) - state.startedAt) / 1000;

  const steps = `<ol class="stepper" aria-label="${T[lang].sequenceHint[state.operation]}">` + state.sequence.map((p, i) => {
    const cls = state.status === 'failed' && i === state.index ? 'failed'
      : i < state.index || state.status === 'completed' ? 'done'
      : i === state.index && running ? 'current' : '';
    const check = cls === 'done' ? '<span class="step-check">✓</span>' : '';
    return `<li class="step ${cls}">${check}<span class="step-label">${text(p, 'phase')}</span></li>`;
  }).join('') + '</ol>';

  const elapsedLine = state.status === 'completed' || state.status === 'failed' || state.status === 'cancelled'
    ? `<span class="elapsed">${text('total')}: <b>${clock(Math.round(elapsed))}</b></span>`
    : `<span class="elapsed">${text('elapsed')}: <b>${clock(Math.round(elapsed))}</b></span>`;

  let body = `<p>${phaseLabel}</p>`;
  if (running) {
    if (fake) {
      body += `<progress max="1" value="${FAKE_PROGRESS[phaseKey]}" aria-label="${text('measured')}"></progress><small>${Math.round(FAKE_PROGRESS[phaseKey] * 100)}%</small>`;
    } else {
      body += steps + `<div class="loading"><span class="pulse"></span><small>${text('unknown')}</small></div>`;
    }
  } else if (state.status === 'completed') {
    body += steps + `<p>${text('result')}</p>`;
  } else {
    body += steps;
  }
  if (state.cancelRequested && running) body += `<p>${text('cancel')}</p>`;
  if (state.error) {
    body += `<div class="job-problem" role="alert"><strong>${text('problem')}</strong><p>${text('memoryReason')}</p><small>code: <code>${state.error}</code></small></div>`;
  }

  area.innerHTML = `<article class="job-card" aria-label="${text(state.operation, 'job')}">
    <div class="section-heading"><strong>${text(state.operation, 'job')}</strong><span class="tag ${state.status}">${text(state.status, 'status')}</span></div>
    ${body}
    <div class="loading elapsed-line">${elapsedLine}</div>
    <small class="record-id">${text('identity')}: ${state.id}（模拟数据）</small>
  </article>`;
}

$('start-generate').addEventListener('click', () => startJob('Generate'));
$('start-transcribe').addEventListener('click', () => startJob('Transcribe'));
$('jump-phase').addEventListener('change', event => jumpTo(event.target.value));
$('fail').addEventListener('click', () => finish('failed', 'runtime_out_of_memory'));
$('cancel').addEventListener('click', () => finish('cancelled'));
$('reset').addEventListener('click', () => { stopTimer(); state = null; $('status-line').textContent = ''; render(); });
$('lang').addEventListener('click', () => {
  lang = lang === 'zh' ? 'en' : 'zh';
  document.documentElement.lang = lang === 'zh' ? 'zh-cn' : 'en';
  $('lang').textContent = T[lang].langToggle[lang];
  $('theme').textContent = T[lang].themeToggle[lang];
  render();
});
$('theme').addEventListener('click', () => {
  const dark = root.dataset.theme === 'dark';
  if (dark) delete root.dataset.theme; else root.dataset.theme = 'dark';
});
$('fake-mode').addEventListener('change', render);

render();
