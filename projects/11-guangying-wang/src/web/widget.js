// Minimal embeddable widget.
// Usage:
//   <div id="llm-detector"></div>
//   <script src="http://127.0.0.1:8000/widget.js"></script>
//   <script>LLMDetector.mount("#llm-detector");</script>

(function () {
  function el(tag, props, children) {
    const n = document.createElement(tag);
    if (props) Object.assign(n, props);
    if (children) children.forEach((c) => n.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
    return n;
  }

  function mount(selector, opts) {
    const root = document.querySelector(selector);
    if (!root) throw new Error("LLMDetector: mount target not found: " + selector);
    const cfg = Object.assign(
      { endpoint: "/api/estimate", model: "gpt-4o", lang: "auto", mock: false, per_claim_questions: 3, max_claims: 8 },
      opts || {}
    );

    root.innerHTML = "";
    root.style.fontFamily =
      "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji'";

    const q = el("textarea", {
      placeholder: "Ask a question...",
      style:
        "width:100%;min-height:80px;box-sizing:border-box;padding:10px;border-radius:10px;border:1px solid #243244;background:#0b1220;color:#e5e7eb;outline:none;resize:vertical;",
    });
    const run = el("button", {
      textContent: "Trust Check",
      style:
        "margin-top:10px;background:#1d4ed8;color:white;border:1px solid #2563eb;padding:10px 12px;border-radius:10px;cursor:pointer;font-weight:600;",
    });
    const out = el("pre", {
      textContent: "—",
      style:
        "margin-top:10px;white-space:pre-wrap;word-break:break-word;background:#0b1220;border:1px solid #243244;border-radius:12px;padding:12px;font-size:12px;line-height:1.45;color:#e5e7eb;",
    });
    const status = el("div", { textContent: "idle", style: "margin-top:8px;color:#94a3b8;font-size:12px" });

    async function runOnce() {
      status.textContent = "running";
      run.disabled = true;
      out.textContent = "…";
      try {
        const payload = {
          question: q.value,
          lang: cfg.lang,
          mock: !!cfg.mock,
          model: cfg.model,
          max_claims: cfg.max_claims,
          per_claim_questions: cfg.per_claim_questions,
        };
        const resp = await fetch(cfg.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await resp.json();
        if (!resp.ok) {
          out.textContent = JSON.stringify({ error: data.detail ?? data }, null, 2);
          status.textContent = "error";
          return;
        }
        out.textContent = JSON.stringify(
          {
            trust_score: data.trust_score,
            decision: data.decision,
            decision_reason: data.diagnostics?.decision_reason,
            core_summary: data.diagnostics?.core_failure_summary,
          },
          null,
          2
        );
        status.textContent = "done";
      } catch (e) {
        out.textContent = String(e);
        status.textContent = "error";
      } finally {
        run.disabled = false;
      }
    }

    run.addEventListener("click", runOnce);
    root.appendChild(q);
    root.appendChild(run);
    root.appendChild(status);
    root.appendChild(out);
  }

  window.LLMDetector = { mount };
})();

