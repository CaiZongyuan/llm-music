"""Owned CPU branch checks; reuse Cover outputs with bounded GFS faults."""

import sys

sys.dont_write_bytecode = True

from sqlalchemy import event
from sqlalchemy.orm import Session

import run_api
from run_cover_api import ControlledCoverRuntime
from run_generation_api import control, fail_save, lose_acknowledgement


class BranchRuntime(ControlledCoverRuntime):
    def submit(self, request):
        receipt = super().submit(request)
        if receipt.handle and request.operation == "GenerateFromScore":
            self.scenarios[receipt.handle] = control().get("scenario", "complete")
        return receipt


if __name__ == "__main__":
    original_create_app = run_api.create_app
    run_api.create_app = lambda settings: original_create_app(settings, runtime=BranchRuntime())
    event.listen(Session, "before_commit", fail_save)
    event.listen(Session, "after_commit", lose_acknowledgement)
    try:
        run_api.main()
    finally:
        event.remove(Session, "before_commit", fail_save)
        event.remove(Session, "after_commit", lose_acknowledgement)
