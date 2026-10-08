# Vendored native Score parser

`abc_tools.py` is an unchanged copy of
`yue2_comfy/vendor/yue2_music/abc_tools.py` from YuE2-ComfyUI revision
`fc78df9dfb214f396aa281f5b03519cefff5b00a`.
The plugin's [NOTICE](https://github.com/pytraveler/YuE2-ComfyUI/blob/fc78df9dfb214f396aa281f5b03519cefff5b00a/NOTICE.md)
identifies it as an unchanged copy of the YuE project's `skills/yue2-music/scripts/abc_tools.py`,
under Apache-2.0. The license accompanies this file.

The application reuses this standard-library-only parser to fail closed for the
pinned native two-voice dialect. It loads no Runtime, model, Torch or CUDA dependency.
`abc_tools.pyi` describes the consumed public parser boundary without modifying
the upstream implementation. Upgrade the parser and Runtime mapping together.
