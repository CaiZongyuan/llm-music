# Follow creative jobs, cancel and continue

Generation and transcription in “A walk after rain” create persistent creative Jobs. Open the project's “Jobs” to check phases, results and failure reasons. The global “Jobs” view groups the same records by Project. Project names and creative inputs keep their original text.

## Understand progress {#progress}

A Job has five states: waiting for creative resources, creating, completed, failed or cancelled. While creating, the page shows a music phase confirmed by the application, such as transcription, score planning, music synthesis or saving results.

“Progress is unknown; showing the current phase” means there is no reliable whole-Job ratio. The page never guesses percentages from elapsed time or phases. A measured ratio appears when the application supplies one. Losing a phase source can return the phase to unknown; this does not restart the Job.

After completion, choose “Inspect score”. Generation also offers “Listen to generated results”. These entries become available with the formal transcription/generation features and keep inspection in the same workspace. A completed generation first creates a Candidate; only explicit saving creates a Version.

## Cancel work you no longer need {#cancel}

1. Choose “Request cancellation” on the target Job. Other Jobs and existing assets remain.
2. Wait for final confirmation. “Cancellation requested” is an intent; the Job can still be waiting or creating.
3. Only confirmed cancellation displays “Cancelled”. If completion wins the race, the page displays “Completed” and keeps its results.

After a cancellation confirmation failure, choose “Read jobs again” and check whether the original Job is still active. If needed, choose “Confirm cancellation again”. The operation still targets the same Job and never becomes a global interrupt. Recovery does not introduce a sixth Job state.

## Inspect a failure and retry explicitly {#retry}

“Why it did not finish” gives a domain reason and next action. Original inputs and the failed record remain. Restore models, creative resources or application connectivity, then choose “Create a new retry job”. The new Job has a separate identity, retains the original input and links to the original Job without replacing it.

When retry creation is unconfirmed, choose “Read existing retry records” first. The page reads Project Jobs and provides the new record's identity and entry when found; it never automatically submits again. A confirmed prerequisite rejection, such as a missing model, can be explicitly retried after restoring that prerequisite. An uncertain creation intent stays blocked in the current page to prevent blind duplicate work.

## Continue after disconnection or refresh {#recover}

When live updates disconnect, the page continues reading the same Job through the application and reconnects. A failed HTTP read shows an error while keeping records already read. Restore connectivity, then choose “Read jobs again”. Old messages cannot turn saved results or confirmed terminal states back into creating.

Refresh or reopen the same Project to read application-saved Jobs. A single Job's entry is `/projects/<PROJECT_ID>/jobs?jobId=<JOB_ID>`. That address reads the Job without generating or transcribing again. Do not resubmit a form to recover progress while waiting.

The top controls switch 中文/English and light/dark themes. Cancellation, failure and recovery explanations follow that choice; Project names, lyrics and original inputs remain unchanged.

## Local verification scope {#verification}

Start Web and FastAPI using the [workspace launch guide](web-workspace.en.md#launch). Tests use an independent CPU FakeRuntime and SQLite to check page behavior, persistent identities, disconnection recovery and cancellation/retry confirmation. Fixture controls exist only in the browser test server, never the formal application. CPU results do not prove music quality, inference speed or real GPU cancellation. The resource owner runs real Runtime verification serially.

See the [Job page verification record](../verification/web-jobs.md) for maintenance evidence.
