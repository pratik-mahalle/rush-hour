"use client";
import { useEffect, useRef, useState } from "react";
import {
  AudioLines,
  ArrowUpRight,
  Play,
  Mic,
  Send,
  RotateCcw,
  Settings2,
  FlaskConical,
  Radio,
  Workflow,
  Coffee,
  ChevronRight,
  Check,
  Volume2,
  VolumeX,
  Zap,
  Undo2,
  Download,
  Square,
  AlertCircle,
  Loader2,
  CheckCircle2,
  XCircle,
  Upload,
  KeyRound,
  ShieldCheck,
  ArrowRight,
  StopCircle,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useRushHour, download } from "@/lib/use-rush-hour";
import { MENU, total } from "@/lib/domain";
import { scenarios } from "@/lib/scenarios";

const ms = (n: number) =>
  n < 1
    ? "<1 ms"
    : n < 1000
      ? `${Math.round(n)} ms`
      : `${(n / 1000).toFixed(2)} s`;
export default function Home() {
  const r = useRushHour();
  const [tab, setTab] = useState("floor");
  const [settings, setSettings] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [draftKey, setDraftKey] = useState("");
  const [input, setInput] = useState("");
  const [traceFilter, setTraceFilter] = useState("all");
  const [connectedNotice, setConnectedNotice] = useState("");
  const conversation = useRef<HTMLDivElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const active = r.state.orders.filter((o) => o.status !== "Completed");
  const completed = r.state.orders.filter((o) => o.status === "Completed");
  const corrections = r.events.filter(
    (e) =>
      e.outcome === "applied" &&
      e.actions.some((a) => ["remove", "note", "transfer"].includes(a.type)),
  ).length;
  const passed = r.results.filter((x) => x.pass).length;
  useEffect(() => {
    conversation.current?.scrollTo({
      top: conversation.current.scrollHeight,
      behavior: "instant",
    });
  }, [r.messages, r.busy]);
  function openSettings() {
    setDraftKey(r.key);
    setConnectedNotice("");
    setSettings(true);
  }
  async function send(text: string) {
    if (!text.trim() || r.locked) return;
    setInput("");
    await r.submit(text);
  }
  const visibleEvents = r.events.filter(
    (e) => traceFilter === "all" || e.outcome === traceFilter,
  );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to counter
      </a>
      <header className="topbar">
        <a href="/" className="brand" aria-label="Rush Hour home">
          <span className="brand-mark">
            <AudioLines size={23} />
          </span>
          <span>
            rush<span className="brand-light">hour</span>
            <small>VOICE OPERATIONS LAB</small>
          </span>
        </a>
        <div className="top-right">
          <span className="engine-tag">
            BUILT WITH <b>sarvam</b>
          </span>
          <button
            className="btn subtle"
            onClick={openSettings}
            disabled={r.locked}
          >
            <Settings2 size={16} />
            {r.key ? "Sarvam settings" : "Connect Sarvam"}
          </button>
        </div>
      </header>
      <main id="main">
        <div className="page-heading">
          <div>
            <div className="eyebrow">
              <span className="live-dot" /> THE COUNTER IS OPEN
            </div>
            <h1>Small shop. Big rush.</h1>
            <p>Speak naturally. Change your mind. Keep the orders straight.</p>
          </div>
          {r.running ? (
            <button className="btn primary" onClick={r.stopReplay}>
              <Square size={16} /> Stop the rush
            </button>
          ) : (
            <button
              className="btn primary"
              disabled={r.locked}
              onClick={() => {
                setTab("floor");
                void r.replay();
              }}
            >
              <Play size={16} fill="currentColor" /> Run the rush{" "}
              <ArrowUpRight size={16} />
            </button>
          )}
        </div>
        <div className="announcements">
          <div role="alert">
            {r.error && (
              <div className="alert error">
                <AlertCircle size={17} />
                <span>{r.error}</span>
                <button
                  onClick={() => r.setError("")}
                  aria-label="Dismiss error"
                >
                  ×
                </button>
              </div>
            )}
          </div>
          <div role="status" aria-live="polite">
            {r.notice && (
              <div className="alert notice">
                <Check size={16} />
                <span>{r.notice}</span>
              </div>
            )}
          </div>
        </div>
        <Tabs value={tab} onValueChange={setTab} className="workspace-tabs">
          <div className="workspace-nav">
            <TabsList variant="line" className="main-tabs">
              <TabsTrigger value="floor">
                <Radio /> Live floor
              </TabsTrigger>
              <TabsTrigger value="lab">
                <FlaskConical /> Break my agent
              </TabsTrigger>
              <TabsTrigger value="trace">
                <Workflow /> Event trace{" "}
                {r.events.length > 0 && (
                  <span className="tab-count">{r.events.length}</span>
                )}
              </TabsTrigger>
            </TabsList>
            <span className="mode-pill">
              {r.live ? "SARVAM MODE" : "DEMO RULES"}
              <span>•</span>
              {r.live ? "API key configured" : "No API calls"}
            </span>
          </div>
          <TabsContent value="floor">
            <div className="floor-grid">
              <section className="orders-area">
                <div className="section-top">
                  <div>
                    <h2>
                      Order board <span className="count">{active.length}</span>
                    </h2>
                    <p>Every correction has a paper trail.</p>
                  </div>
                  <div className="button-group">
                    <button
                      className="icon-btn"
                      aria-label="Undo last change"
                      title="Undo last change"
                      onClick={r.undo}
                      disabled={!r.undoCount || r.locked}
                    >
                      <Undo2 size={17} />
                    </button>
                    <button
                      className="icon-btn"
                      aria-label="Reset shift"
                      title="Reset shift"
                      onClick={() => setResetOpen(true)}
                      disabled={r.locked}
                    >
                      <RotateCcw size={17} />
                    </button>
                  </div>
                </div>
                <div className="metrics">
                  <div>
                    <span>Active orders</span>
                    <strong>
                      {String(active.length).padStart(2, "0")}{" "}
                      <small>on the floor</small>
                    </strong>
                  </div>
                  <div>
                    <span>Shift value</span>
                    <strong>
                      ₹{r.state.orders.reduce((n, o) => n + total(o), 0)}{" "}
                      <small>all orders</small>
                    </strong>
                  </div>
                  <div>
                    <span>Corrections</span>
                    <strong>
                      {String(corrections).padStart(2, "0")}{" "}
                      <small>applied events</small>
                    </strong>
                  </div>
                </div>
                <div className="kanban">
                  {(["New", "Preparing", "Ready"] as const).map((status, i) => (
                    <div className="lane" key={status}>
                      <h3>
                        <span className={"lane-dot dot-" + i} />
                        {status}
                        <span>
                          {active.filter((o) => o.status === status).length}
                        </span>
                      </h3>
                      {active
                        .filter((o) => o.status === status)
                        .map((o) => (
                          <article className={"ticket ticket-" + i} key={o.id}>
                            <div className="ticket-head">
                              <span>#{o.id}</span>
                              <span>{o.payment.toUpperCase()}</span>
                            </div>
                            <h4>{o.customer}</h4>
                            <div className="ticket-lines">
                              {o.items.map((item, j) => (
                                <div key={j}>
                                  <span>
                                    {item.qty} × {MENU[item.sku].name}
                                  </span>
                                  {item.note && (
                                    <span className="item-note">
                                      {item.note}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                            <div className="ticket-total">
                              <button
                                className="payment-button"
                                disabled={r.locked}
                                title={
                                  o.payment === "Paid"
                                    ? "Reopen payment"
                                    : "Mark payment received"
                                }
                                onClick={() =>
                                  r.manual(
                                    [
                                      {
                                        type: "payment",
                                        customer: o.customer,
                                        payment:
                                          o.payment === "Paid"
                                            ? "Unpaid"
                                            : "Paid",
                                      },
                                    ],
                                    `${o.customer}: ${o.payment === "Paid" ? "payment reopened" : "marked paid"}`,
                                  )
                                }
                              >
                                {o.payment === "Paid" ? (
                                  <Check size={13} />
                                ) : null}
                                {o.payment === "Paid"
                                  ? "Paid"
                                  : o.payment === "Credit"
                                    ? "On credit"
                                    : "Mark paid"}
                              </button>
                              <strong>₹{total(o)}</strong>
                            </div>
                            <button
                              className="ticket-action"
                              disabled={r.locked}
                              onClick={() =>
                                r.manual(
                                  [
                                    {
                                      type: "status",
                                      customer: o.customer,
                                      status:
                                        i === 0
                                          ? "Preparing"
                                          : i === 1
                                            ? "Ready"
                                            : "Completed",
                                    },
                                  ],
                                  `${o.customer}: ${i === 0 ? "preparing" : i === 1 ? "ready" : "completed"}`,
                                )
                              }
                            >
                              {i === 0
                                ? "Start preparing"
                                : i === 1
                                  ? "Mark ready"
                                  : "Complete order"}
                              <ChevronRight size={16} />
                            </button>
                          </article>
                        ))}
                      {!active.some((o) => o.status === status) && (
                        <div className="empty-lane">
                          <span>
                            {i === 0
                              ? "Taking orders"
                              : i === 1
                                ? "Kitchen is clear"
                                : "Nothing waiting"}
                          </span>
                          <small>
                            {i === 0
                              ? "Speak or type to add one."
                              : i === 1
                                ? "Start an order to move it here."
                                : "Ready orders appear here."}
                          </small>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {completed.length > 0 && (
                  <details className="completed-orders">
                    <summary>
                      {completed.length} completed{" "}
                      {completed.length === 1 ? "order" : "orders"} · ₹
                      {completed.reduce((n, o) => n + total(o), 0)}
                    </summary>
                    {completed.map((o) => (
                      <div key={o.id}>
                        <span>
                          #{o.id} · {o.customer}
                        </span>
                        <span>
                          {o.payment} · ₹{total(o)}
                        </span>
                      </div>
                    ))}
                  </details>
                )}
                <div className="menu-strip">
                  <Coffee size={18} />
                  <span>ON THE MENU</span>
                  <p>
                    Chai ₹20 <i>·</i> Samosa ₹20 <i>·</i> Vada pav ₹30 <i>·</i>{" "}
                    Coffee ₹35 <i>·</i> Bun maska ₹35
                  </p>
                </div>
                <div className="challenge-banner">
                  <div className="challenge-icon">
                    <Zap size={21} />
                  </div>
                  <div>
                    <h3>Good agents survive bad instructions.</h3>
                    <p>
                      Throw in a correction. Switch languages. Try to confuse
                      it.
                    </p>
                  </div>
                  <button className="text-btn" onClick={() => setTab("lab")}>
                    Enter the lab <ArrowUpRight size={17} />
                  </button>
                </div>
                <p className="session-note">
                  Session-only playground. Orders and events clear on refresh.{" "}
                  <button
                    onClick={() =>
                      download("rush-hour-session.json", {
                        exportedAt: new Date().toISOString(),
                        state: r.state,
                        events: r.events,
                      })
                    }
                  >
                    Export shift
                  </button>
                </p>
              </section>
              <aside className="voice-panel">
                <div className="panel-header">
                  <h2>
                    <AudioLines size={18} /> At the counter
                  </h2>
                  <span className="tiny-badge">HINDI + ENGLISH</span>
                </div>
                <div
                  className={
                    "voice-visual " + (r.recording ? "is-recording" : "")
                  }
                >
                  <div className="signal-bars" aria-hidden="true">
                    {Array.from({ length: 37 }, (_, i) => (
                      <span
                        key={i}
                        style={{
                          height: Math.round(
                            8 +
                              Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.36)) *
                                49,
                          ),
                          animationDelay: `${(i * 0.03).toFixed(2)}s`,
                        }}
                      />
                    ))}
                  </div>
                  <h3>
                    {r.recording
                      ? `Listening… ${secondsLabel(r.seconds)}`
                      : r.busy
                        ? "One moment…"
                        : r.speaking
                          ? "Speaking. You can interrupt."
                          : "Ready when you are."}
                  </h3>
                  <p>
                    {r.recording
                      ? "Tap stop when your order is complete."
                      : r.live
                        ? "Your next order starts with your voice."
                        : "Try a typed instruction or run the demo."}
                  </p>
                  <button
                    className={"mic-button " + (r.recording ? "recording" : "")}
                    disabled={r.locked && !r.recording}
                    onClick={() =>
                      r.recording
                        ? r.stopRecording()
                        : !r.live
                          ? openSettings()
                          : void r.startRecording()
                    }
                  >
                    {r.recording ? (
                      <Square size={19} />
                    ) : r.busy ? (
                      <Loader2 size={19} className="spin" />
                    ) : (
                      <Mic size={21} />
                    )}{" "}
                    {r.recording
                      ? "Stop & send"
                      : r.speaking
                        ? "Interrupt & speak"
                        : "Tap to speak"}
                  </button>
                  <small>
                    {r.live
                      ? "Saaras → order engine → Bulbul · 20s max"
                      : "Connect Sarvam to enable the microphone"}
                  </small>
                  {r.speaking && (
                    <button className="stop-speech" onClick={r.interrupt}>
                      <StopCircle size={14} /> Stop reply
                    </button>
                  )}
                </div>
                <div className="conversation" ref={conversation}>
                  <div className="conversation-label">
                    CONVERSATION <span>{r.live ? "LIVE" : "LOCAL DEMO"}</span>
                  </div>
                  {r.messages.map((m, i) => (
                    <div
                      className={
                        m.role === "assistant"
                          ? "agent-message"
                          : "user-message"
                      }
                      key={i}
                    >
                      {m.role === "assistant" && (
                        <span className="agent-avatar">
                          <AudioLines size={17} />
                        </span>
                      )}
                      <div>
                        <b>{m.role === "assistant" ? "Rush Hour" : "You"}</b>
                        <p>{m.content}</p>
                      </div>
                    </div>
                  ))}
                  {r.busy && (
                    <p className="thinking">
                      <Loader2 className="spin" size={14} /> Processing
                      instruction…
                    </p>
                  )}
                  {r.messages.length < 3 && (
                    <div className="suggestions">
                      {[
                        "Ravi ke liye do chai",
                        "Sharma ji ka payment ho gaya",
                      ].map((s) => (
                        <button
                          key={s}
                          className="suggestion"
                          disabled={r.locked}
                          onClick={() => void send(s)}
                        >
                          “{s}” <ArrowUpRight size={14} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <form
                  className="command-box"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void send(input);
                  }}
                >
                  <label className="sr-only" htmlFor="command">
                    Type an order
                  </label>
                  <input
                    id="command"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    maxLength={2000}
                    disabled={r.locked}
                    placeholder="Or type an instruction…"
                    autoComplete="off"
                  />
                  <button aria-label="Send instruction" disabled={r.locked}>
                    <Send size={17} />
                  </button>
                </form>
                <div className="panel-foot">
                  <span>
                    <Check size={13} /> Changes are reversible
                  </span>
                  <button
                    className="quiet-icon"
                    aria-label={
                      r.voice ? "Mute spoken replies" : "Enable spoken replies"
                    }
                    aria-pressed={r.voice}
                    onClick={() => {
                      r.setVoice(!r.voice);
                      if (r.voice) r.interrupt();
                    }}
                  >
                    {r.voice ? <Volume2 size={17} /> : <VolumeX size={17} />}
                  </button>
                </div>
              </aside>
            </div>
          </TabsContent>
          <TabsContent value="lab">
            <section className="lab">
              <div className="lab-heading">
                <div>
                  <div className="eyebrow">CONTROLLED CHAOS</div>
                  <h2>Put the agent under pressure.</h2>
                  <p>
                    Replay a tricky conversation. Inspect the outcome. Keep the
                    failures.
                  </p>
                </div>
                {r.evaluating ? (
                  <button className="btn primary" onClick={r.stopEval}>
                    <Square size={16} /> Stop evaluation
                  </button>
                ) : (
                  <button
                    className="btn primary"
                    onClick={() => void r.runEval()}
                    disabled={r.locked}
                  >
                    <Play size={16} /> Run all {scenarios.length} tests
                  </button>
                )}
              </div>
              <div className="lab-summary">
                <div>
                  <span>Test engine</span>
                  <strong>
                    {r.live ? "Sarvam agent" : "Local demo rules"}
                  </strong>
                </div>
                <div>
                  <span>Passed / completed</span>
                  <strong>
                    {r.results.length
                      ? `${passed} / ${r.results.length}`
                      : "Not run yet"}
                  </strong>
                </div>
                <div>
                  <span>Mean scenario time</span>
                  <strong>
                    {r.results.length
                      ? ms(
                          r.results.reduce((n, x) => n + x.latency, 0) /
                            r.results.length,
                        )
                      : "—"}
                  </strong>
                </div>
                <button
                  className="btn subtle"
                  disabled={!r.results.length}
                  onClick={() =>
                    download("rush-hour-evaluation.json", {
                      runAt: new Date().toISOString(),
                      engine: r.evalEngine,
                      scope:
                        "Hand-authored text scenarios. Not an ASR benchmark.",
                      results: r.results,
                    })
                  }
                >
                  <Download size={16} /> Export results
                </button>
              </div>
              <p className="lab-disclaimer">
                These are hand-authored text tests, not speech-recognition
                benchmarks. Results and timings are measured when you run them.{" "}
                {r.live
                  ? "Live tests use your Sarvam credits."
                  : "Connect Sarvam to test the model instead of the local parser."}
              </p>
              <div className="scenario-grid">
                {scenarios.map((s, i) => {
                  const result = r.results.find((x) => x.id === s.id);
                  return (
                    <article className="scenario-card" key={s.id}>
                      <div className="scenario-top">
                        <span>
                          {String(i + 1).padStart(2, "0")} / {s.category}
                        </span>
                        {result ? (
                          <span
                            className={
                              result.pass ? "result-pass" : "result-fail"
                            }
                          >
                            {result.pass ? (
                              <CheckCircle2 size={14} />
                            ) : (
                              <XCircle size={14} />
                            )}{" "}
                            {result.pass ? "PASS" : "FAIL"}
                          </span>
                        ) : (
                          <FlaskConical size={16} />
                        )}
                      </div>
                      <h3>{s.title}</h3>
                      <p>{s.description}</p>
                      <blockquote>“{s.turns[s.turns.length - 1]}”</blockquote>
                      <div className="expected">
                        <span>EXPECTED</span>
                        {s.expected}
                      </div>
                      <div className="scenario-actions">
                        <button
                          className="text-btn"
                          disabled={r.locked}
                          onClick={() => void r.runEval(s)}
                        >
                          Run test <Play size={13} />
                        </button>
                        <button
                          className="text-btn secondary-text"
                          disabled={r.locked}
                          onClick={() => {
                            setTab("floor");
                            void r.replay(s);
                          }}
                        >
                          Replay demo <ArrowRight size={14} />
                        </button>
                      </div>
                      {result && (
                        <details className="result-detail">
                          <summary>
                            Inspect {result.pass ? "result" : "failure"} ·{" "}
                            {ms(result.latency)}
                          </summary>
                          {result.error && (
                            <p className="error-text">{result.error}</p>
                          )}
                          {result.turns.map((t, j) => (
                            <div key={j}>
                              <b>{t.input}</b>
                              <p>{t.reply}</p>
                              <span>
                                {t.clarification
                                  ? "Asked for clarification"
                                  : `${t.actions.length} validated action(s)`}
                              </span>
                            </div>
                          ))}
                          <pre>{JSON.stringify(result.actual, null, 2)}</pre>
                        </details>
                      )}
                    </article>
                  );
                })}
              </div>
              <div className="audio-lab">
                <div>
                  <h3>
                    <Mic size={20} /> Test your own audio
                  </h3>
                  <p>
                    Record a real instruction on the live floor, or upload a
                    clip under 25 seconds / 8 MB. The transcript is applied to
                    your current order board.
                  </p>
                  <label className="switch-row" htmlFor="noise">
                    <Switch
                      id="noise"
                      checked={r.noise}
                      onCheckedChange={r.setNoise}
                      disabled={r.locked}
                    />
                    <span>
                      Mix synthetic background noise into microphone recordings
                    </span>
                  </label>
                  <small>
                    Noise is mixed into the submitted recording. It is not a
                    simulated score. Uploaded files are used as-is.
                  </small>
                </div>
                <div className="audio-actions">
                  <button
                    className="btn"
                    disabled={r.locked}
                    onClick={() =>
                      r.live ? uploadRef.current?.click() : openSettings()
                    }
                  >
                    <Upload size={16} /> Upload audio
                  </button>
                  <button className="text-btn" onClick={() => setTab("floor")}>
                    Go to microphone <ArrowUpRight size={16} />
                  </button>
                  <input
                    className="sr-only"
                    aria-label="Upload audio file"
                    ref={uploadRef}
                    type="file"
                    accept="audio/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setTab("floor");
                        void r.upload(f);
                      }
                      e.target.value = "";
                    }}
                  />
                </div>
              </div>
            </section>
          </TabsContent>
          <TabsContent value="trace">
            <section className="trace-surface">
              <div className="lab-heading">
                <div>
                  <div className="eyebrow">NOTHING BEHIND THE CURTAIN</div>
                  <h2>Every instruction leaves a trace.</h2>
                  <p>
                    See what was heard, what was proposed, and what actually
                    changed.
                  </p>
                </div>
                <button
                  className="btn subtle"
                  disabled={!r.events.length}
                  onClick={() =>
                    download("rush-hour-trace.json", {
                      exportedAt: new Date().toISOString(),
                      events: r.events,
                    })
                  }
                >
                  <Download size={16} /> Export trace
                </button>
              </div>
              <Tabs value={traceFilter} onValueChange={setTraceFilter}>
                <TabsList className="filter-tabs">
                  <TabsTrigger value="all">All events</TabsTrigger>
                  <TabsTrigger value="applied">Applied</TabsTrigger>
                  <TabsTrigger value="clarification">
                    Clarifications
                  </TabsTrigger>
                  <TabsTrigger value="error">Errors</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="event-list">
                {!visibleEvents.length ? (
                  <div className="empty-surface">
                    <Workflow size={32} />
                    <h3>
                      No {traceFilter === "all" ? "events" : traceFilter} yet.
                    </h3>
                    <p>
                      Try an instruction on the live floor to see its trace.
                    </p>
                    <button className="btn" onClick={() => setTab("floor")}>
                      Back to the counter
                    </button>
                  </div>
                ) : (
                  visibleEvents.map((e, i) => (
                    <details
                      className={"event event-" + e.outcome}
                      key={e.id}
                      open={i === 0 ? true : undefined}
                    >
                      <summary>
                        <span className="event-symbol">
                          {e.outcome === "clarification" ? (
                            <AlertCircle size={17} />
                          ) : e.outcome === "error" ? (
                            <XCircle size={17} />
                          ) : e.outcome === "undo" ? (
                            <Undo2 size={17} />
                          ) : (
                            <Check size={17} />
                          )}
                        </span>
                        <div>
                          <span className="event-input">{e.input}</span>
                          <small>
                            {e.source} ·{" "}
                            {new Date(e.at).toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </small>
                        </div>
                        <span className="event-outcome">{e.outcome}</span>
                        <ChevronRight size={16} />
                      </summary>
                      <div className="event-body">
                        <div className="event-stages">
                          <div>
                            <span>01 / HEARD</span>
                            <p>{e.input}</p>
                            <small>
                              {e.stt !== undefined
                                ? `Saaras · ${ms(e.stt)}`
                                : "Text / counter input"}
                            </small>
                          </div>
                          <div>
                            <span>02 / INTERPRETED</span>
                            <p>
                              {e.actions.length} action
                              {e.actions.length !== 1 ? "s" : ""} proposed
                            </p>
                            <small>
                              {e.source} · {ms(e.latency)}
                            </small>
                          </div>
                          <div>
                            <span>03 / COMMITTED</span>
                            <p>
                              {e.outcome === "clarification"
                                ? "Held for clarification"
                                : e.outcome === "error"
                                  ? "Blocked safely"
                                  : e.outcome === "undo"
                                    ? "Previous state restored"
                                    : e.outcome === "reset"
                                      ? "Shift reset"
                                      : "Validated & applied"}
                            </p>
                            <small>
                              {e.tts !== undefined
                                ? `Bulbul synthesis · ${ms(e.tts)}`
                                : "No speech timing recorded"}
                            </small>
                          </div>
                        </div>
                        <p className="event-reply">{e.reply}</p>
                        <div className="trace-json">
                          <div>
                            <h4>Proposed actions</h4>
                            <pre>{JSON.stringify(e.actions, null, 2)}</pre>
                          </div>
                          <div>
                            <h4>Before → after</h4>
                            <pre>
                              {JSON.stringify(
                                { before: e.before, after: e.after },
                                null,
                                2,
                              )}
                            </pre>
                          </div>
                        </div>
                      </div>
                    </details>
                  ))
                )}
              </div>
            </section>
          </TabsContent>
        </Tabs>
        <footer className="footer">
          <span>A little chaos. A lot of chai.</span>
          <span>RUSH HOUR / EXPERIMENT 001</span>
        </footer>
      </main>
      <Dialog open={settings} onOpenChange={setSettings}>
        <DialogContent className="settings-dialog">
          <DialogHeader>
            <DialogTitle>
              <KeyRound size={21} /> Connect Sarvam
            </DialogTitle>
            <DialogDescription>
              Use your own key for live speech and order understanding. Demo
              mode works without one.
            </DialogDescription>
          </DialogHeader>
          <label className="field-label" htmlFor="sarvam-key">
            Sarvam API key
          </label>
          <input
            id="sarvam-key"
            className="settings-input"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={draftKey}
            placeholder="Paste your Sarvam API key"
            onChange={(e) => setDraftKey(e.target.value)}
          />
          <p className="privacy-note">
            <ShieldCheck size={17} /> Held in memory for this tab only. Sent
            through this app’s server to Sarvam. Never included in exports.
          </p>
          <div className="model-stack">
            <div>
              <span>Listen</span>
              <b>Saaras v4</b>
            </div>
            <div>
              <span>Understand</span>
              <b>Sarvam 105B Conversations</b>
            </div>
            <div>
              <span>Speak</span>
              <b>Bulbul v3</b>
            </div>
          </div>
          <label className="switch-row" htmlFor="live">
            <Switch
              id="live"
              checked={r.live}
              disabled={!r.key || r.locked}
              onCheckedChange={(v) => {
                r.interrupt();
                r.setLive(v);
              }}
            />
            <span>Use live Sarvam mode</span>
          </label>
          <p className="settings-help">
            Live requests consume your Sarvam API credits. Saving a key does not
            verify it; the first request will report any access error.{" "}
            <a
              href="https://dashboard.sarvam.ai/"
              target="_blank"
              rel="noreferrer"
            >
              Get an API key <ArrowUpRight size={12} />
            </a>
          </p>
          {connectedNotice && <p role="status">{connectedNotice}</p>}
          <DialogFooter>
            {r.key && (
              <button
                className="btn subtle"
                onClick={() => {
                  r.interrupt();
                  r.setKey("");
                  setDraftKey("");
                  r.setLive(false);
                  setConnectedNotice("Key removed. Demo mode is active.");
                }}
              >
                Remove key
              </button>
            )}
            <button
              className="btn primary"
              disabled={!draftKey.trim() || r.locked}
              onClick={() => {
                if (draftKey.trim().length < 10) {
                  setConnectedNotice(
                    "This key looks incomplete. Please check it.",
                  );
                  return;
                }
                r.setKey(draftKey.trim());
                r.setLive(true);
                setSettings(false);
              }}
            >
              Save & enable live mode
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start a fresh shift</DialogTitle>
            <DialogDescription>
              Your current board can be restored with Undo. The event trace is
              kept for comparison.
            </DialogDescription>
          </DialogHeader>
          <div className="reset-options">
            <button
              className="btn"
              onClick={() => {
                r.reset(true);
                setResetOpen(false);
              }}
            >
              Load sample orders
            </button>
            <button
              className="btn primary"
              onClick={() => {
                r.reset(false);
                setResetOpen(false);
              }}
            >
              Start empty
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function secondsLabel(n: number) {
  return `00:${String(n).padStart(2, "0")}`;
}
