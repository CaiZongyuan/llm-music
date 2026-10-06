"""Run imports and CUDA in a subprocess so Doctor survives broken runtimes."""

import asyncio
import importlib
import json
from pathlib import Path
import sys
import traceback


def probe():
    root = Path(sys.argv[1]).resolve()
    plugin = root / "custom_nodes" / "YuE2-ComfyUI"
    sys.path.insert(0, str(root))
    sys.argv = [sys.argv[0]]  # ComfyUI's argument parser must not read Doctor flags.
    facts = {}

    def emit(stage, complete=False):
        facts.update(probe_stage=stage, probe_complete=complete)
        print("MUSIC_DOCTOR_JSON=" + json.dumps(facts, ensure_ascii=True), flush=True)

    try:
        emit("torch_import")
        import torch

        facts.update(torch=torch.__version__, torch_cuda=torch.version.cuda)
        if not torch.cuda.is_available():
            raise RuntimeError("Torch cannot access a CUDA device")
        index = torch.cuda.current_device()
        properties = torch.cuda.get_device_properties(index)
        facts.update(device_index=index, gpu=properties.name,
                     vram_bytes=properties.total_memory,
                     bf16=torch.cuda.is_bf16_supported())
        if not facts["bf16"]:
            raise RuntimeError("Target GPU does not support BF16")
        emit("cuda_bf16")
        tensor = torch.ones((2, 2), device="cuda", dtype=torch.bfloat16)
        tensor = tensor @ tensor
        torch.cuda.synchronize()
        del tensor
        torch.cuda.empty_cache()
        facts["cuda_probe"] = "BF16 matrix multiplication completed"
        facts["torch_ok"] = True
    except Exception as error:
        facts.update(torch_ok=False, torch_error=str(error))
    try:
        emit("comfyui_import")
        import nodes

        facts["comfyui_ok"] = True
        emit("custom_node_registration")
        loaded = asyncio.run(nodes.load_custom_node(str(plugin)))
        if not loaded:
            raise RuntimeError("ComfyUI refused the YuE2 custom-node registration")
        facts["registered_nodes"] = sorted(nodes.NODE_CLASS_MAPPINGS)
        package = str(plugin).replace(".", "_x_") + ".yue2_comfy"
        # Entry-point import is intentionally light. Exercise the inference imports too.
        for module in ["vendor.yue2.modeling_yue2", "vendor.yue2.modeling_vae",
                       "vendor.yue2.tokenization_yue2", "sheetsage.model"]:
            emit("lazy_import:" + module)
            importlib.import_module(package + "." + module)
        emit("audio_resample")
        import torchaudio
        import tiktoken

        torchaudio.functional.resample(torch.zeros((1, 480)), 48000, 24000)
        facts["plugin_ok"] = True
        facts["torchaudio"] = torchaudio.__version__
    except Exception as error:
        facts.update(plugin_ok=False, failed_stage=facts.get("probe_stage"),
                     import_error=str(error), traceback=traceback.format_exc())
        facts.setdefault("comfyui_ok", False)
    emit("complete", complete=True)


if __name__ == "__main__":
    probe()
