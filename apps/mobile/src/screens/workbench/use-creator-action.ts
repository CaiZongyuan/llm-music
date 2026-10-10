import { useCallback, useEffect, useRef, useState } from 'react';
import { MobileFailure } from '@/data/session';

const messages: Record<string, string> = {
  project_name_required: '给这个项目起一个名字。', project_name_too_long: '项目名称最多 200 个字。',
  version_name_required: '给这个版本起一个名字。', version_name_too_long: '版本名称最多 200 个字。',
  invalid_generate: '核对风格、歌词、Seed 和时长上限。手动时长为 5–360 秒。',
  retry_unconfirmed: '原任务仍待确认，先重新读取。确认终态后再明确重试。',
  intent_pending: '还有一次请求待确认，先查询原请求。', intent_in_flight: '这次请求正在处理，请稍候。',
  intent_needs_recovery: '先查询这次请求；需要重发时仍使用原输入。',
  jobs_unconfirmed: '原任务状态仍待读取，先查询已经创建的任务。',
  versions_unconfirmed: '保存记录尚未读取，先查询已有版本再保存。',
  storage_unavailable: '手机未能保存编辑内容，写入已暂停。内容仍保留，请重试手机存储。',
  authorization_required: '先恢复电脑连接，或重新授权这台手机。',
  version_already_saved: '这个候选已保存。请查看已有版本的实际名称，不覆盖旧记录。',
  request_timed_out: '等待电脑回复超时，先核对原请求。',
  connection_unavailable: '暂时无法连接电脑。内容已保留，恢复后先查询原请求。',
};

export function creatorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  return messages[code] ?? (error instanceof MobileFailure ? error.detail?.message : undefined) ?? '这一步尚未完成，请保留输入并重新查询。';
}

export function useCreatorAction() {
  const pending = useRef(false), alive = useRef(true);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const run = useCallback(async <T,>(operation: () => Promise<T>): Promise<T | undefined> => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { return await operation(); }
    catch (problem) { if (alive.current) setError(creatorMessage(problem)); return; }
    finally { pending.current = false; if (alive.current) setBusy(false); }
  }, []);
  return { busy, error, run, clearError: () => setError('') };
}
