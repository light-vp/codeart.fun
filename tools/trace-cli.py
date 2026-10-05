"""CLI bridge used by the Node tools: `python3 trace-cli.py trace|test < input.json`."""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "py"))
from tracer import run_tests, trace_program  # noqa: E402

req = json.load(sys.stdin)
if sys.argv[1] == "trace":
    print(trace_program(req["source"], req.get("maxSteps", 1500)))
else:
    print(run_tests(req["source"], json.dumps(req["spec"])))
