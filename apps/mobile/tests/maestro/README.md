# Native title input regression

`title-input.yaml` checks typing a Project name and immediately creating it, then typing a Version name and immediately saving an existing unsaved Candidate. It stays in the mounted input scene before submission; navigation/cold restoration cannot hide a stale React Compiler value. It checks the visible result of real creator actions, rather than the hook's implementation.

The caller owns the paired Expo Go session and isolated actual Fake API/DB. Supply `WORKBENCH_URL`, `PROJECT_URL`, `CANDIDATE_ID`, `PROJECT_TITLE` and `VERSION_TITLE` with `maestro test -e NAME=value ...`. URLs are the actual Metro deep links ending `/--/workbench` and `/--/workbench/projects/<project UUID>`. The Candidate must belong to that Project and have no saved Version. Use distinct Chinese titles without regular-expression metacharacters. The flow creates a real Project and Version in this test namespace, so retain API readbacks/POST counts alongside the UI result.

Only the resource owner should run this flow. It uses existing authorization, does not reset app data, and does not manage API/Metro/emulator processes. Current native execution and source-hash receipts remain Root-owned; adding the flow does not claim it has run.
