# Run from the repository root. Downloads pinned source and dependencies.
uv run --no-project --python 3.12.13 python runtime/comfyui/manage.py prepare
if ($LASTEXITCODE -ne 0) { throw "Runtime preparation failed. Preserve local edits and inspect the command output." }
