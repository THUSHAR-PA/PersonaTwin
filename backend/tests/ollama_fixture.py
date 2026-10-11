"""Loopback-only, deterministic Ollama substitute for browser tests.

This is NOT an application fallback or a language model. Unknown prompts fail.
Run in a separate process and point only a disposable test backend at port 11555.
"""

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

FIXTURES = {
    "Can I afford a bike for 150000?": ("purchase", {"price": (150000, "150000")}),
    "Monthly running cost 2000": ("purchase", {"running_cost": (2000, "2000")}),
    "What if the cheaper bike costs 80000?": (
        "purchase",
        {"cheaper_price": (80000, "80000")},
    ),
    "Use a loan: down payment 30000, annual interest 10%, tenure 36 months.": (
        "purchase",
        {
            "down_payment": (30000, "30000"),
            "annual_rate": (10, "10%"),
            "loan_months": (36, "36 months"),
        },
    ),
    "Can I reach 300000 in savings within 12 months?": (
        "savings",
        {"target_amount": (300000, "300000"), "months": (12, "12 months")},
    ),
    "Cut monthly spending by 2000": ("savings", {"monthly_reduction": (2000, "2000")}),
    "Should I switch to a job paying 60000 take-home per month?": (
        "job_switch",
        {"target_monthly_income": (60000, "60000")},
    ),
    "The unpaid gap is 2 months": ("job_switch", {"gap_months": (2, "2 months")}),
    "Transition cost 10000": ("job_switch", {"transition_cost": (10000, "10000")}),
}


class Handler(BaseHTTPRequestHandler):
    def reply(self, status, data):
        payload = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        if self.path == "/api/tags":
            self.reply(200, {"models": [{"name": "qwen3:4b"}]})
        else:
            self.reply(404, {"fixture": True})

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        data = json.loads(body["messages"][-1]["content"])
        question = data["latest_message"]
        if question == "Simulate a model outage":
            return self.reply(503, {"error": "Test-only model outage"})
        if question not in FIXTURES:
            return self.reply(400, {"error": "No test fixture for this question"})
        scenario, values = FIXTURES[question]
        intent = {
            "scenario": scenario,
            "new_topic": False,
            "updates": [
                {"field": field, "value": value, "evidence": evidence}
                for field, (value, evidence) in values.items()
            ],
        }
        self.reply(200, {"message": {"content": json.dumps(intent)}})

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", 11555), Handler).serve_forever()
