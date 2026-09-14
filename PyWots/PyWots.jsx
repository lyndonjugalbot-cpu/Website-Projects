import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  STATS, RANKS, PROGRAM_DAYS, ASSESSMENT, BOSS_DAYS, isBossDay,
  startingStats, levelFromXP, xpForLevel, rankFromBosses,
  dayContent, topicFor, TOPIC_MAP,
  ACHIEVEMENTS, earnedAchievements, clearedDungeons,
} from "./curriculum.js";
import { store, onSyncState } from "./src/lib/persistence.js";
import { SAVE_KEY } from "./src/lib/keys.js";
import { isNative } from "./src/lib/platform.js";
import {
  isConfigured, onAuthChange, currentUser, isAnon,
  signInEmail, registerEmail, sendPasswordReset, signInWithProvider,
  completeOAuthFromUrl, signOut, deleteAccount,
} from "./src/lib/auth.js";

/* ================================================================== */
/*  PyWots — a 100-day Solo-Leveling-style ascent from zero Python     */
/*  to competent Python. Single component. Content lives in            */
/*  curriculum.js. Real code is graded in-browser by Pyodide.          */
/*                                                                    */
/*  Persistence is local-first (src/lib/persistence.js): the local     */
/*  copy is the working truth; when Supabase is configured it syncs    */
/*  to an account so progress follows the user to other devices and    */
/*  the iOS app. With no keys set, everything still runs local-only.   */
/* ================================================================== */

/* ----------------------------- dates ------------------------------ */
const dayStr = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};
function daysBetween(a, b) {
  const da = new Date(a + "T00:00:00");
  const db = new Date(b + "T00:00:00");
  return Math.round((db - da) / 86400000);
}

/* --------------------------- Pyodide ------------------------------ */
const PYODIDE_VERSION = "0.26.4";
const PYODIDE_BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

const HARNESS = `
import io, contextlib, json, sys, time, traceback

def _pywots_grade(user_code, tests):
    ns = {}
    out = io.StringIO()
    res = {"stdout": "", "error": None, "results": []}
    deadline = time.time() + 4.0
    def _tr(frame, event, arg):
        if time.time() > deadline:
            raise TimeoutError("Code ran too long \\u2014 check for an infinite loop.")
        return _tr
    try:
        sys.settrace(_tr)
        try:
            with contextlib.redirect_stdout(out):
                exec(user_code, ns)
        finally:
            sys.settrace(None)
    except Exception:
        res["stdout"] = out.getvalue()
        tb = traceback.format_exc().strip().splitlines()
        res["error"] = tb[-1] if tb else "error"
        return json.dumps(res)
    ns["STDOUT"] = out.getvalue()
    try:
        tests = tests.to_py()
    except AttributeError:
        pass
    for t in (tests or []):
        code = t["code"]
        label = t.get("label") or code
        try:
            with contextlib.redirect_stdout(out):
                exec(code, ns)
            res["results"].append({"label": label, "ok": True, "msg": ""})
        except AssertionError as e:
            res["results"].append({"label": label, "ok": False, "msg": str(e) or "wrong answer"})
        except Exception as e:
            res["results"].append({"label": label, "ok": False, "msg": "%s: %s" % (type(e).__name__, e)})
    res["stdout"] = out.getvalue()
    return json.dumps(res)
`;

function usePyodide() {
  const ref = useRef(null);
  const loadingRef = useRef(false);
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error

  const load = useCallback(async () => {
    if (ref.current || loadingRef.current) return;
    loadingRef.current = true;
    setStatus("loading");
    try {
      if (!window.loadPyodide) {
        await new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = PYODIDE_BASE + "pyodide.js";
          s.onload = res;
          s.onerror = () => rej(new Error("Failed to load the Pyodide script."));
          document.head.appendChild(s);
        });
      }
      const py = await window.loadPyodide({ indexURL: PYODIDE_BASE });
      py.runPython(HARNESS);
      ref.current = py;
      setStatus("ready");
    } catch (e) {
      console.error(e);
      setStatus("error");
    } finally {
      loadingRef.current = false;
    }
  }, []);

  const run = useCallback(async (code, tests) => {
    const py = ref.current;
    if (!py) return { stdout: "", error: "Runtime not ready.", results: [] };
    try {
      py.globals.set("PYWOTS_CODE", code || "");
      py.globals.set("PYWOTS_TESTS", py.toPy(tests || []));
      const raw = await py.runPythonAsync("_pywots_grade(PYWOTS_CODE, PYWOTS_TESTS)");
      return JSON.parse(raw);
    } catch (e) {
      return { stdout: "", error: String(e && e.message ? e.message : e), results: [] };
    }
  }, []);

  return { status, load, run };
}

/* ============================ styling ============================ */
const FONT_LINK =
  "https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Rajdhani:wght@500;600;700&display=swap";

const CSS = `
:root{
  --bg:#05060F; --bg2:#0A0E22; --panel:#0B1024; --panel2:#10173a; --line:#25315c;
  --cyan:#38E1FF; --cyan-d:#0FA9D8; --violet:#9A7BFF; --magenta:#E56BFF;
  --text:#D3DDFB; --dim:#7E8CC0; --gold:#FFC24B; --ok:#3DF0A9; --bad:#FF5C7A;
  --mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
  --sans:"Rajdhani",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
  --read:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  --display:"Orbitron",var(--sans);
  --glow-cyan:0 0 12px rgba(56,225,255,.55),0 0 34px rgba(56,225,255,.25);
  --glow-violet:0 0 12px rgba(154,123,255,.5),0 0 34px rgba(154,123,255,.25);
  --glow-bad:0 0 12px rgba(255,92,122,.55),0 0 34px rgba(255,92,122,.25);
}
*{box-sizing:border-box}
html,body{background:var(--bg);-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{
  color:var(--text);font-family:var(--sans);font-size:16px;
  /* never let the page pan sideways; wide content scrolls inside its own box */
  overflow-x:hidden;
  background:
    radial-gradient(120% 70% at 50% -10%, #16204d 0%, rgba(10,14,34,0) 60%),
    radial-gradient(90% 60% at 50% 120%, #1a1140 0%, rgba(5,6,15,0) 55%),
    linear-gradient(180deg,#070A18,#05060F 60%);
}
img,svg,video{max-width:100%}
/* iOS zooms the page when a focused field is under 16px and doesn't reliably
   zoom back out — keep every text field at 16px. */
input,textarea,select{font-size:16px}

/* ---- layout ---- */
.pw-app{position:relative;z-index:1;min-height:100vh;width:100%;overflow-x:clip}
.pw-wrap{width:100%;max-width:940px;margin:0 auto;padding:22px 16px 120px}
.pw-row{display:flex;align-items:center;gap:10px;min-width:0}
.pw-display{font-family:var(--display);font-weight:900;letter-spacing:.04em}
.pw-read{font-family:var(--read)}
.pw-muted{color:var(--dim)}
a,.pw-link{color:var(--cyan)}

/* ---- backdrop ---- */
.pw-backdrop{position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none}
.pw-backdrop::after{content:"";position:absolute;inset:0;
  background:radial-gradient(120% 90% at 50% 30%, rgba(5,6,15,0) 40%, rgba(5,6,15,.7) 100%)}
.pw-rune{position:absolute;color:rgba(80,150,220,.16);font-family:var(--mono);
  text-shadow:0 0 10px rgba(56,150,220,.25);user-select:none;
  animation:pw-runefloat linear infinite}
.pw-scanline{position:absolute;left:0;right:0;height:120px;top:-120px;
  background:linear-gradient(180deg,rgba(56,225,255,0),rgba(56,225,255,.05),rgba(56,225,255,0));
  mix-blend-mode:screen;animation:pw-scan 9s linear infinite}
.pw-grid{position:absolute;inset:0;opacity:.35;
  background-image:linear-gradient(rgba(56,225,255,.04) 1px,transparent 1px),
                  linear-gradient(90deg,rgba(56,225,255,.04) 1px,transparent 1px);
  background-size:46px 46px;
  mask-image:radial-gradient(80% 60% at 50% 20%, #000 0%, transparent 75%)}
@keyframes pw-runefloat{0%{transform:translateY(14px);opacity:0}
  15%{opacity:.9}85%{opacity:.9}100%{transform:translateY(-26px);opacity:0}}
@keyframes pw-scan{0%{top:-120px}100%{top:100%}}

/* ---- framed panels ---- */
.pw-frame{position:relative;background:
    linear-gradient(180deg,rgba(56,225,255,.05),rgba(56,225,255,0) 42%),
    var(--panel);
  border:1px solid var(--line);border-radius:3px;padding:18px;
  clip-path:polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.04), 0 16px 40px -26px rgba(56,225,255,.35);}
.pw-frame::before,.pw-frame::after{content:"";position:absolute;width:14px;height:14px;
  border:2px solid var(--cyan);box-shadow:var(--glow-cyan);animation:pw-tick 3.4s ease-in-out infinite}
.pw-frame::before{top:3px;left:3px;border-right:0;border-bottom:0}
.pw-frame::after{bottom:3px;right:3px;border-left:0;border-top:0;animation-delay:1.7s}
@keyframes pw-tick{0%,100%{opacity:.4}50%{opacity:1}}
.pw-frame.tone-ok{border-color:rgba(61,240,169,.55)}
.pw-frame.tone-ok::before,.pw-frame.tone-ok::after{border-color:var(--ok);box-shadow:0 0 12px rgba(61,240,169,.5)}
.pw-frame.tone-bad{border-color:rgba(255,92,122,.5)}
.pw-frame.tone-bad::before,.pw-frame.tone-bad::after{border-color:var(--bad);box-shadow:var(--glow-bad)}
.pw-frame.tone-gold{border-color:rgba(255,194,75,.5)}
.pw-frame.tone-gold::before,.pw-frame.tone-gold::after{border-color:var(--gold);box-shadow:0 0 12px rgba(255,194,75,.5)}

/* ---- headings ---- */
.pw-h1{font-family:var(--display);font-size:20px;font-weight:900;letter-spacing:.03em;margin:0;
  text-shadow:0 0 18px rgba(56,225,255,.28)}
.pw-phase{font-family:var(--display);font-size:11px;letter-spacing:.24em;text-transform:uppercase;
  color:var(--violet);margin:18px 0 8px;text-shadow:var(--glow-violet)}
.pw-eyebrow{font-family:var(--display);font-size:10px;letter-spacing:.28em;text-transform:uppercase;color:var(--dim)}

/* ---- buttons ---- */
.pw-btn{font-family:var(--sans);font-weight:700;font-size:15px;letter-spacing:.03em;
  border:1px solid var(--line);background:linear-gradient(180deg,var(--panel2),var(--panel));
  color:var(--text);padding:9px 16px;border-radius:2px;transition:.15s;
  clip-path:polygon(7px 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%,0 7px)}
.pw-btn:hover:not(:disabled){border-color:var(--cyan);color:#fff;box-shadow:var(--glow-cyan)}
.pw-btn:disabled{opacity:.4;cursor:not-allowed}
.pw-btn.primary{background:linear-gradient(180deg,rgba(56,225,255,.22),rgba(154,123,255,.16));
  border-color:var(--cyan);color:#fff;box-shadow:0 0 18px -4px rgba(56,225,255,.5)}
.pw-btn.primary:hover:not(:disabled){box-shadow:0 0 26px -2px rgba(56,225,255,.7)}
.pw-btn.danger:hover:not(:disabled){border-color:var(--bad);color:var(--bad);box-shadow:var(--glow-bad)}

/* ---- chips / bars ---- */
.pw-tag{display:inline-block;font-family:var(--mono);font-size:11px;letter-spacing:.08em;
  text-transform:uppercase;padding:3px 8px;border-radius:2px;border:1px solid var(--line);color:var(--dim)}
.pw-badge{font-family:var(--display);font-weight:900;border:1px solid var(--cyan);color:var(--cyan);
  border-radius:2px;padding:3px 10px;font-size:12px;letter-spacing:.1em;box-shadow:var(--glow-cyan)}
.pw-bar{height:9px;background:#05070F;border:1px solid var(--line);border-radius:99px;overflow:hidden;position:relative}
.pw-bar>i{display:block;height:100%;background:linear-gradient(90deg,var(--cyan),var(--violet));
  box-shadow:0 0 12px rgba(56,225,255,.6);transition:width .5s cubic-bezier(.2,.8,.2,1)}
.pw-bar>i::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,
  transparent,rgba(255,255,255,.5),transparent);transform:translateX(-100%);
  animation:pw-sheen 2.6s ease-in-out infinite}
@keyframes pw-sheen{0%{transform:translateX(-100%)}60%,100%{transform:translateX(320%)}}

/* ---- choices ---- */
.pw-choice{display:block;width:100%;max-width:100%;text-align:left;border:1px solid var(--line);
  background:linear-gradient(180deg,var(--panel2),var(--panel));color:var(--text);
  padding:11px 13px;border-radius:2px;font-size:14px;margin-top:8px;font-family:var(--mono);
  overflow-wrap:anywhere;word-break:break-word;
  transition:.13s;clip-path:polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)}
.pw-choice:hover:not(:disabled){border-color:var(--cyan);box-shadow:0 0 16px -6px rgba(56,225,255,.6)}
.pw-choice.right{border-color:var(--ok);color:#eafff6;background:rgba(61,240,169,.12);box-shadow:0 0 18px -6px rgba(61,240,169,.6)}
.pw-choice.wrong{border-color:var(--bad);color:#ffe9ee;background:rgba(255,92,122,.12)}
.pw-code{font-family:var(--mono);font-size:13px;background:#05070F;border:1px solid var(--line);
  border-radius:2px;padding:11px 13px;white-space:pre-wrap;line-height:1.6;color:#DCE6FF;
  overflow-x:auto;overflow-wrap:anywhere;max-width:100%}

/* ---- system message ---- */
.pw-sysbox{position:relative;overflow:hidden}
.pw-sysbox .pw-eyebrow{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.pw-sysbox .pw-eyebrow b{color:var(--cyan);text-shadow:var(--glow-cyan)}
.pw-sys{font-family:var(--mono);font-size:13.5px;line-height:1.7;color:var(--cyan);
  border-left:2px solid var(--cyan);padding-left:12px;white-space:pre-wrap;
  text-shadow:0 0 14px rgba(56,225,255,.25)}
.pw-sysbox::after{content:"";position:absolute;left:0;right:0;height:40px;top:-40px;
  background:linear-gradient(180deg,transparent,rgba(56,225,255,.10),transparent);
  animation:pw-scan 4.5s linear infinite}

/* ---- editor / output ---- */
.pw-editor{width:100%;min-height:200px;background:#04060E;color:#DCE6FF;border:1px solid var(--line);
  border-radius:2px;padding:12px;font-family:var(--mono);font-size:16px;line-height:1.55;
  resize:vertical;tab-size:4;outline:none;transition:.15s}
.pw-editor:focus{border-color:var(--cyan);box-shadow:0 0 22px -6px rgba(56,225,255,.6)}
.pw-out{background:#04060E;border:1px solid var(--line);border-radius:2px;padding:12px;
  font-family:var(--mono);font-size:12.5px;white-space:pre-wrap;line-height:1.55;max-height:260px;overflow:auto}

/* ---- portal (dungeon) ---- */
.pw-portal{position:relative}
.pw-portal-head{display:flex;align-items:center;gap:12px;margin-bottom:6px}
.pw-portal-ring{width:44px;height:44px;flex:none;position:relative}
.pw-portal-ring svg{position:absolute;inset:0;animation:pw-spin 7s linear infinite}
.pw-portal-title{font-family:var(--display);font-weight:900;letter-spacing:.06em;font-size:15px;
  color:var(--cyan);text-shadow:var(--glow-cyan)}
.pw-portal--boss .pw-portal-title{color:var(--bad);text-shadow:var(--glow-bad)}
.pw-portal--boss .pw-portal-ring svg{animation-duration:3.4s}
.pw-portal--boss{animation:pw-throb 2.4s ease-in-out infinite}
@keyframes pw-spin{to{transform:rotate(360deg)}}
@keyframes pw-throb{0%,100%{box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 0 0 rgba(255,92,122,0)}
  50%{box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 0 44px -10px rgba(255,92,122,.55)}}

/* ---- tower / path ---- */
.pw-daylist{position:relative;display:flex;flex-direction:column;gap:7px;padding-left:26px}
.pw-daylist::before{content:"";position:absolute;left:9px;top:6px;bottom:6px;width:2px;
  background:linear-gradient(180deg,var(--cyan),var(--violet),rgba(154,123,255,.15));
  box-shadow:0 0 12px rgba(56,225,255,.4)}
.pw-dayrow{position:relative;display:flex;align-items:center;gap:12px;border:1px solid var(--line);
  background:linear-gradient(180deg,var(--panel2),var(--panel));border-radius:2px;padding:11px 13px;
  text-align:left;width:100%;color:var(--text);transition:.13s;
  clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)}
.pw-dayrow::before{content:"";position:absolute;left:-21px;top:50%;transform:translateY(-50%);
  width:11px;height:11px;border-radius:50%;background:#0A0E22;border:2px solid var(--dim)}
.pw-dayrow:hover:not(:disabled){border-color:var(--cyan);box-shadow:0 0 18px -8px rgba(56,225,255,.6)}
.pw-dayrow:disabled{opacity:.42;cursor:not-allowed}
.pw-dayrow.done::before{background:var(--ok);border-color:var(--ok);box-shadow:0 0 12px rgba(61,240,169,.7)}
.pw-dayrow.cur::before{background:var(--cyan);border-color:var(--cyan);box-shadow:0 0 14px rgba(56,225,255,.9);animation:pw-tick 1.8s ease-in-out infinite}
.pw-dayrow.boss{border-color:rgba(255,92,122,.5)}
.pw-dayrow.boss::before{border-color:var(--bad);width:13px;height:13px;transform:translateY(-50%) rotate(45deg);border-radius:2px}
.pw-dayrow.boss:not(:disabled)::before{box-shadow:var(--glow-bad);animation:pw-tick 1.6s ease-in-out infinite}
.pw-daynum{font-family:var(--mono);font-size:12px;color:var(--dim);width:46px;flex:none}

/* ---- toasts ---- */
.pw-toast{position:fixed;top:14px;right:12px;z-index:60;display:flex;flex-direction:column;gap:8px;
  width:340px;max-width:calc(100% - 24px)}
.pw-toastcard{position:relative;background:var(--panel);border:1px solid var(--cyan);border-radius:2px;
  padding:11px 13px;font-size:13.5px;box-shadow:0 10px 34px rgba(0,0,0,.55),var(--glow-cyan);
  animation:pw-toastin .3s cubic-bezier(.2,.9,.2,1);
  clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)}
@keyframes pw-toastin{from{opacity:0;transform:translateX(26px)}to{opacity:1;transform:none}}

/* ---- status bar + dock ---- */
.pw-status{position:sticky;top:0;z-index:30;background:rgba(6,8,20,.86);backdrop-filter:blur(10px);
  border-bottom:1px solid var(--line)}
.pw-statusrow{max-width:940px;margin:0 auto;display:flex;align-items:center;gap:12px;padding:9px 16px;
  min-width:0;overflow:hidden}
.pw-statusrow .pw-emblem{flex:none}
.pw-statusrow .pw-word{flex:none;white-space:nowrap}
.pw-statusrow .pw-badge{flex:none;white-space:nowrap}
.pw-status-xp{flex:1 1 auto;min-width:34px;max-width:220px}
.pw-status-streak{flex:none;white-space:nowrap}
.pw-dock{position:fixed;left:0;right:0;bottom:0;z-index:40;display:flex;justify-content:center;
  padding:10px 12px calc(10px + env(safe-area-inset-bottom));
  background:linear-gradient(180deg,rgba(6,8,20,0),rgba(6,8,20,.9) 40%)}
.pw-dockinner{display:flex;gap:10px;background:rgba(9,12,30,.9);border:1px solid var(--line);
  border-radius:4px;padding:7px;box-shadow:0 12px 40px -12px rgba(0,0,0,.7);
  clip-path:polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)}
.pw-dockbtn{display:flex;flex-direction:column;align-items:center;gap:3px;width:78px;padding:8px 4px;
  border:1px solid transparent;background:none;color:var(--dim);border-radius:3px;transition:.15s}
.pw-dockbtn svg{width:22px;height:22px}
.pw-dockbtn span{font-family:var(--display);font-size:9.5px;letter-spacing:.16em;text-transform:uppercase}
.pw-dockbtn:hover{color:var(--text)}
.pw-dockbtn.active{color:#fff;border-color:var(--cyan);
  background:linear-gradient(180deg,rgba(56,225,255,.16),rgba(154,123,255,.08));
  box-shadow:0 0 20px -6px rgba(56,225,255,.6)}
.pw-dockbtn.active svg{filter:drop-shadow(0 0 6px rgba(56,225,255,.8))}

/* ---- emblem ---- */
.pw-emblem svg{display:block;filter:drop-shadow(0 0 18px rgba(56,225,255,.35))}
.pw-emblem .pw-t{stroke-dasharray:5 7;animation:pw-flow 3.5s linear infinite}
@keyframes pw-flow{to{stroke-dashoffset:-48}}
.pw-word{font-family:var(--display);font-weight:900;letter-spacing:.14em;
  background:linear-gradient(180deg,#EAF6FF,#7FD4FF 55%,#9A7BFF);
  -webkit-background-clip:text;background-clip:text;color:transparent;
  filter:drop-shadow(0 0 16px rgba(56,225,255,.4))}

/* ---- boot splash ---- */
.pw-boot{position:fixed;inset:0;z-index:90;display:flex;flex-direction:column;align-items:center;
  justify-content:center;gap:18px;background:radial-gradient(circle at 50% 40%,#0A0E24,#05060F);
  animation:pw-bootout .5s ease 1.5s forwards}
.pw-boot .pw-emblem{animation:pw-bootin .9s cubic-bezier(.2,.9,.2,1)}
@keyframes pw-bootin{from{opacity:0;transform:scale(.82) rotate(-4deg);filter:blur(6px)}
  to{opacity:1;transform:none;filter:blur(0)}}
@keyframes pw-bootout{to{opacity:0;visibility:hidden}}
.pw-bootbar{width:200px;height:4px;background:#0A0E24;border:1px solid var(--line);overflow:hidden}
.pw-bootbar>i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--cyan),var(--violet));
  animation:pw-bootfill 1.4s ease forwards;box-shadow:var(--glow-cyan)}
@keyframes pw-bootfill{to{width:100%}}

/* ---- level-up burst ---- */
.pw-burst{position:fixed;inset:0;z-index:80;display:flex;flex-direction:column;align-items:center;
  justify-content:center;pointer-events:none;background:radial-gradient(circle at 50% 50%,rgba(56,225,255,.14),transparent 60%);
  animation:pw-burstfade 2.2s ease forwards}
.pw-burst b{font-family:var(--display);font-weight:900;font-size:44px;letter-spacing:.12em;color:#fff;
  text-shadow:0 0 30px rgba(56,225,255,.9),0 0 60px rgba(154,123,255,.6);animation:pw-burstpop .6s cubic-bezier(.2,1.4,.3,1)}
.pw-burst span{font-family:var(--display);letter-spacing:.3em;color:var(--cyan);font-size:13px;margin-top:6px}
@keyframes pw-burstpop{from{transform:scale(.5);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes pw-burstfade{0%{opacity:0}12%{opacity:1}70%{opacity:1}100%{opacity:0}}

/* ---- misc ---- */
.pw-ach{border:1px solid var(--line);border-radius:2px;padding:11px;background:var(--panel);transition:.15s;
  clip-path:polygon(7px 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%,0 7px)}
.pw-ach.on{border-color:var(--gold);box-shadow:0 0 20px -8px rgba(255,194,75,.7)}
.pw-ach.on .pw-achname{color:var(--gold)}
.pw-reveal{animation:pw-reveal .45s ease both}
@keyframes pw-reveal{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}

/* ---- account / auth ---- */
.pw-acct{display:flex;align-items:center;gap:6px;border:1px solid var(--line);background:var(--panel2);
  color:var(--text);border-radius:99px;padding:3px 4px 3px 8px;font-size:11px;font-family:var(--display);
  letter-spacing:.06em}
.pw-acct:hover{border-color:var(--cyan)}
.pw-avatar{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:11px;
  background:linear-gradient(180deg,var(--cyan),var(--violet));color:#04060E;font-weight:900}
.pw-syncdot{width:7px;height:7px;border-radius:50%;background:var(--dim);flex:none}
.pw-syncdot.synced{background:var(--ok);box-shadow:0 0 8px rgba(61,240,169,.7)}
.pw-syncdot.syncing{background:var(--cyan);box-shadow:0 0 8px rgba(56,225,255,.8);animation:pw-tick 1s ease-in-out infinite}
.pw-syncdot.error{background:var(--bad);box-shadow:var(--glow-bad)}
.pw-overlay{position:fixed;inset:0;z-index:70;display:grid;place-items:center;padding:18px;
  background:rgba(4,6,15,.72);backdrop-filter:blur(6px);animation:pw-reveal .2s ease both}
.pw-input{width:100%;background:#04060E;color:#DCE6FF;border:1px solid var(--line);border-radius:2px;
  padding:10px 12px;font-family:var(--mono);font-size:16px;margin-top:8px;outline:none;
  clip-path:polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)}
.pw-input:focus{border-color:var(--cyan);box-shadow:0 0 18px -6px rgba(56,225,255,.6)}
.pw-oauth{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:8px}

/* ---- System summons (the "NOTIFICATION — will you accept?" screen) ---- */
.pw-summon{position:fixed;inset:0;z-index:75;display:grid;place-items:center;padding:22px;
  background:radial-gradient(circle at 50% 42%, rgba(10,16,40,.97), rgba(3,5,12,.99));
  animation:pw-reveal .3s ease both}
.pw-summon-card{width:min(460px,100%);text-align:center;position:relative;overflow:hidden;
  box-shadow:0 0 0 1px rgba(56,225,255,.25),0 0 70px -10px rgba(56,225,255,.55),inset 0 1px 0 rgba(255,255,255,.05)}
.pw-summon-card::after{content:"";position:absolute;left:0;right:0;height:56px;top:-56px;
  background:linear-gradient(180deg,transparent,rgba(56,225,255,.14),transparent);animation:pw-scan 3.8s linear infinite}
.pw-summon-bar{height:7px;width:84%;margin:0 auto;border-radius:2px;
  background:linear-gradient(90deg,rgba(56,225,255,0),var(--cyan) 30%,var(--cyan) 70%,rgba(56,225,255,0));
  box-shadow:0 0 22px rgba(56,225,255,.7)}
.pw-summon-head{display:flex;align-items:center;justify-content:center;gap:12px;margin:20px 0 2px}
.pw-summon-i{width:30px;height:30px;flex:none;display:grid;place-items:center;border:2px solid var(--cyan);
  border-radius:50%;color:var(--cyan);font-family:var(--display);font-weight:900;box-shadow:var(--glow-cyan)}
.pw-summon-title{font-family:var(--display);font-weight:900;letter-spacing:.3em;font-size:19px;color:#EAF6FF;
  text-shadow:var(--glow-cyan);border:1px solid var(--line);padding:6px 8px 6px 14px}
.pw-summon-body{font-size:15px;line-height:1.95;color:var(--dim);margin:20px 10px 22px}
.pw-summon-body b{color:var(--cyan);font-style:italic;font-weight:700;text-shadow:var(--glow-cyan)}
.pw-summon-actions{display:flex;gap:10px;justify-content:center;margin-bottom:8px}
@media (prefers-reduced-motion:reduce){ .pw-summon-card::after{display:none} }

@media (max-width:560px){
  .pw-statusrow{gap:8px;padding:8px 12px}
  .pw-dockbtn{width:62px}
  .pw-dockbtn span{font-size:9px;letter-spacing:.1em}
  .pw-burst b{font-size:32px}
  .pw-wrap{padding-left:12px;padding-right:12px}
  .pw-daylist{padding-left:22px}
  .pw-daynum{width:40px;font-size:11px}
}
@media (max-width:480px){
  .pw-statusrow{gap:7px}
  .pw-statusrow .pw-word{display:none}          /* emblem carries the brand */
  .pw-statusrow .pw-badge{font-size:11px;padding:3px 7px;letter-spacing:.06em}
  .pw-status-xp{max-width:none;min-width:28px}
  .pw-acct{font-size:0;gap:0;padding:3px}       /* icon-only on narrow screens */
  .pw-acct .pw-syncdot{margin:0 2px}
  .pw-dockbtn{width:56px}
}
@media (max-width:340px){
  .pw-statusrow .pw-badge{display:none}
}
.pw-frame,.pw-daylist,.pw-dayrow,.pw-out,.pw-editor,.pw-toastcard,.pw-ach{max-width:100%}
@media (prefers-reduced-motion:reduce){
  *{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important}
  .pw-scanline,.pw-rune,.pw-sysbox::after{display:none}
  .pw-boot{animation-delay:.2s}
}
`;

/* ========================= graphics ========================= */
function Emblem({ size = 132, word = true }) {
  return (
    <div className="pw-emblem" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label="PyWots emblem">
        <defs>
          <linearGradient id="pwg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#38E1FF" />
            <stop offset="0.55" stopColor="#7FA8FF" />
            <stop offset="1" stopColor="#9A7BFF" />
          </linearGradient>
          <radialGradient id="pwc" cx="0.5" cy="0.42" r="0.6">
            <stop offset="0" stopColor="#12204a" />
            <stop offset="1" stopColor="#070A18" />
          </radialGradient>
        </defs>
        {/* outer octagon */}
        <path d="M40 6 H80 L114 40 V80 L80 114 H40 L6 80 V40 Z"
          fill="url(#pwc)" stroke="url(#pwg)" strokeWidth="2.5" />
        <path d="M44 16 H76 L104 44 V76 L76 104 H44 L16 76 V44 Z"
          fill="none" stroke="rgba(56,225,255,.35)" strokeWidth="1" />
        {/* circuit traces */}
        <g className="pw-t" stroke="#38E1FF" strokeWidth="1.6" fill="none" opacity="0.85">
          <path d="M20 60 H36 V44" />
          <path d="M100 60 H84 V78" />
          <path d="M60 18 V32" />
          <path d="M60 102 V88" />
        </g>
        <g fill="#38E1FF">
          <circle cx="20" cy="60" r="2.4" /><circle cx="100" cy="60" r="2.4" />
          <circle cx="60" cy="18" r="2.4" /><circle cx="60" cy="102" r="2.4" />
        </g>
        {/* monogram */}
        <text x="60" y="72" textAnchor="middle" fontFamily="Orbitron, sans-serif"
          fontWeight="900" fontSize="42" fill="url(#pwg)"
          style={{ filter: "drop-shadow(0 0 8px rgba(56,225,255,.7))" }}>Py</text>
        {/* flame accent */}
        <path d="M88 40 C95 46 95 55 89 60 C93 51 87 47 86 43 C85 46 82 47 82 51 C82 57 88 58 90 54 C91 62 82 64 79 57 C76 50 82 44 88 40 Z"
          fill="#E56BFF" opacity="0.9" style={{ filter: "drop-shadow(0 0 6px rgba(229,107,255,.8))" }} />
      </svg>
      {word && <div className="pw-word" style={{ fontSize: size * 0.24 }}>PYWOTS</div>}
    </div>
  );
}

function Backdrop() {
  const runes = useMemo(() => {
    const glyphs = "ᚠᚢᚦᚨᚱᚲᚷᚹᚻᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟλ:=()[]#0xdef".split("");
    const rand = (n) => (Math.sin(n * 999.13) * 0.5 + 0.5);
    return Array.from({ length: 30 }, (_, i) => ({
      ch: glyphs[Math.floor(rand(i + 1) * glyphs.length)],
      left: rand(i + 7) * 100,
      top: rand(i + 13) * 100,
      size: 12 + rand(i + 19) * 22,
      dur: 9 + rand(i + 23) * 16,
      delay: -rand(i + 29) * 20,
    }));
  }, []);
  return (
    <div className="pw-backdrop" aria-hidden="true">
      <div className="pw-grid" />
      {runes.map((r, i) => (
        <span key={i} className="pw-rune" style={{
          left: r.left + "%", top: r.top + "%", fontSize: r.size,
          animationDuration: r.dur + "s", animationDelay: r.delay + "s",
        }}>{r.ch}</span>
      ))}
      <div className="pw-scanline" />
    </div>
  );
}

const IconToday = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}>
    <path d="M12 3 L21 8 V16 L12 21 L3 16 V8 Z" /><path d="M8.5 12 l2.5 2.5 L16 9" />
  </svg>
);
const IconTower = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}>
    <path d="M7 20 h10 M8 20 v-4 h8 v4 M9 16 v-4 h6 v4 M10 12 V7 h4 v5 M12 7 V3" />
  </svg>
);
const IconHunter = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}>
    <path d="M4 6 V4 h2 M20 6 V4 h-2 M4 18 v2 h2 M20 18 v2 h-2" />
    <circle cx="12" cy="10" r="3" /><path d="M6.5 18 c1.5-3 9.5-3 11 0" />
  </svg>
);
const PortalRing = ({ color = "var(--cyan)" }) => (
  <svg viewBox="0 0 44 44" width="44" height="44">
    <circle cx="22" cy="22" r="18" fill="none" stroke={color} strokeWidth="2"
      strokeDasharray="6 10" opacity="0.9" />
    <circle cx="22" cy="22" r="13" fill="none" stroke={color} strokeWidth="1" opacity="0.4" />
    <circle cx="22" cy="4" r="2.2" fill={color} />
  </svg>
);

/* ------------------------- small pieces ------------------------- */
function Frame({ children, style, className = "", tone }) {
  const t = tone ? ` tone-${tone}` : "";
  return <div className={`pw-frame${t} ${className}`} style={style}>{children}</div>;
}
function StatChip({ id }) {
  const s = STATS.find((x) => x.id === id);
  return <span className="pw-tag" title={s?.blurb}>{s ? s.label : id}</span>;
}
function Bar({ value }) {
  return <div className="pw-bar"><i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}

/* -------------------------- radar chart ------------------------ */
function Radar({ stats }) {
  const size = 250, cx = size / 2, cy = size / 2, R = 92;
  const ids = STATS.map((s) => s.id);
  const maxV = Math.max(20, ...ids.map((k) => stats[k] || 0));
  const pt = (i, r) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / ids.length;
    return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)];
  };
  const rings = [0.25, 0.5, 0.75, 1].map((f) =>
    ids.map((_, i) => pt(i, R * f).join(",")).join(" "));
  const poly = ids.map((k, i) => pt(i, R * ((stats[k] || 0) / maxV)).join(",")).join(" ");
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: 320, display: "block", margin: "0 auto" }}>
      <defs>
        <radialGradient id="pwradar" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="rgba(56,225,255,.35)" />
          <stop offset="1" stopColor="rgba(154,123,255,.12)" />
        </radialGradient>
      </defs>
      {rings.map((r, i) => (
        <polygon key={i} points={r} fill="none" stroke="var(--line)" strokeWidth="1" />
      ))}
      {ids.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--line)" strokeWidth="1" />;
      })}
      <polygon points={poly} fill="url(#pwradar)" stroke="var(--cyan)" strokeWidth="2"
        style={{ filter: "drop-shadow(0 0 10px rgba(56,225,255,.5))" }} />
      {ids.map((k, i) => {
        const [x, y] = pt(i, R + 16);
        return (
          <text key={k} x={x} y={y} fontSize="11" fill="var(--dim)" textAnchor="middle"
            dominantBaseline="middle" fontFamily="var(--mono)">
            {STATS[i].label} {stats[k] || 0}
          </text>
        );
      })}
    </svg>
  );
}

/* --------------------------- editor --------------------------- */
function CodeEditor({ value, onChange, disabled }) {
  const ref = useRef(null);
  const onKeyDown = (e) => {
    const ta = ref.current;
    if (!ta) return;
    if (e.key === "Tab") {
      e.preventDefault();
      const s = ta.selectionStart, en = ta.selectionEnd;
      const next = value.slice(0, s) + "    " + value.slice(en);
      onChange(next);
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = s + 4; });
    } else if (e.key === "Enter") {
      e.preventDefault();
      const s = ta.selectionStart;
      const lineStart = value.lastIndexOf("\n", s - 1) + 1;
      const cur = value.slice(lineStart, s);
      const indent = (cur.match(/^\s*/) || [""])[0];
      const extra = /:\s*$/.test(cur) ? "    " : "";
      const ins = "\n" + indent + extra;
      const next = value.slice(0, s) + ins + value.slice(ta.selectionEnd);
      onChange(next);
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = s + ins.length; });
    }
  };
  return (
    <textarea
      ref={ref}
      className="pw-editor"
      spellCheck={false}
      autoCapitalize="off"
      autoCorrect="off"
      disabled={disabled}
      value={value}
      onKeyDown={onKeyDown}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/* ------------------------- lesson cards ----------------------- */
function LessonCard({ lesson, done, onDone }) {
  const [picked, setPicked] = useState(null);
  const [seq, setSeq] = useState([]);
  const [checked, setChecked] = useState(false);

  const pool = useMemo(() => {
    if (lesson.kind !== "order") return [];
    const a = lesson.lines.map((t, i) => ({ t, i }));
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor((Math.sin(i * 99 + lesson.lines.length) * 0.5 + 0.5) * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }, [lesson]);

  if (lesson.kind === "order") {
    const target = lesson.lines;
    const remaining = pool.filter((p) => !seq.includes(p.i));
    const correct = checked && seq.length === target.length && seq.every((v, i) => v === i);
    return (
      <Frame className="pw-reveal" tone={done || correct ? "ok" : undefined} style={{ marginTop: 10 }}>
        <div className="pw-eyebrow" style={{ marginBottom: 6 }}>Reorder{done ? " · cleared" : ""}</div>
        <div style={{ marginBottom: 10 }}>{lesson.prompt}</div>
        <div className="pw-code" style={{ minHeight: 20 }}>
          {seq.length === 0 ? <span className="pw-muted">Tap lines below in order…</span>
            : seq.map((i, k) => <div key={k} onClick={() => setSeq(seq.filter((x) => x !== i))} style={{ cursor: "pointer" }}>{target[i]}</div>)}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {remaining.map((p) => (
            <button key={p.i} className="pw-choice" style={{ width: "auto", margin: 0 }}
              onClick={() => setSeq([...seq, p.i])}>{p.t.trim() === "" ? "␣" : p.t}</button>
          ))}
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          <button className="pw-btn" onClick={() => { setSeq([]); setChecked(false); }}>Reset</button>
          <button className="pw-btn primary" disabled={seq.length !== target.length}
            onClick={() => { setChecked(true); if (seq.every((v, i) => v === i)) onDone(); }}>Check</button>
        </div>
        {checked && (
          <div style={{ marginTop: 10, color: correct ? "var(--ok)" : "var(--bad)", fontSize: 13 }}>
            {correct ? "Correct. " : "Not yet — reset and try again. "}
            <span className="pw-muted">{lesson.explain}</span>
          </div>
        )}
      </Frame>
    );
  }

  if (lesson.kind === "blank") {
    const parts = lesson.code.split("▢");
    return (
      <Frame className="pw-reveal" tone={done ? "ok" : undefined} style={{ marginTop: 10 }}>
        <div className="pw-eyebrow" style={{ marginBottom: 6 }}>Fill the blank</div>
        <div style={{ marginBottom: 10 }}>{lesson.prompt}</div>
        <div className="pw-code">
          {parts[0]}
          <span className="pw-badge" style={{ borderColor: picked != null ? "var(--gold)" : "var(--cyan)", color: picked != null ? "var(--gold)" : "var(--cyan)" }}>
            {picked != null ? lesson.choices[picked] : "▢"}
          </span>
          {parts[1]}
        </div>
        <div style={{ marginTop: 8 }}>
          {lesson.choices.map((c, i) => {
            const cls = checked && i === picked ? (i === lesson.answer ? "right" : "wrong")
              : checked && i === lesson.answer ? "right" : "";
            return (
              <button key={i} className={`pw-choice ${cls}`} disabled={done}
                onClick={() => { setPicked(i); setChecked(true); if (i === lesson.answer) onDone(); }}>
                {c}
              </button>
            );
          })}
        </div>
        {checked && (
          <div style={{ marginTop: 10, fontSize: 13, color: picked === lesson.answer ? "var(--ok)" : "var(--bad)" }}>
            {picked === lesson.answer ? "Correct. " : "Try again. "}
            <span className="pw-muted">{lesson.explain}</span>
          </div>
        )}
      </Frame>
    );
  }

  // mcq / predict
  return (
    <Frame className="pw-reveal" tone={done ? "ok" : undefined} style={{ marginTop: 10 }}>
      <div className="pw-eyebrow" style={{ marginBottom: 6 }}>
        {lesson.kind === "predict" ? "Predict the output" : "Question"}
      </div>
      <div style={{ marginBottom: 10 }}>{lesson.prompt}</div>
      {lesson.code && <div className="pw-code" style={{ marginBottom: 8 }}>{lesson.code}</div>}
      {lesson.options.map((o, i) => {
        const cls = checked && i === picked ? (i === lesson.answer ? "right" : "wrong")
          : checked && i === lesson.answer ? "right" : "";
        return (
          <button key={i} className={`pw-choice ${cls}`} disabled={done}
            onClick={() => { setPicked(i); setChecked(true); if (i === lesson.answer) onDone(); }}>
            {String(o).split("\n").map((ln, k) => <div key={k}>{ln}</div>)}
          </button>
        );
      })}
      {checked && (
        <div style={{ marginTop: 10, fontSize: 13, color: picked === lesson.answer ? "var(--ok)" : "var(--bad)" }}>
          {picked === lesson.answer ? "Correct. " : "Not quite. "}
          <span className="pw-muted">{lesson.explain}</span>
        </div>
      )}
    </Frame>
  );
}

/* -------------------------- dungeon --------------------------- */
function Dungeon({ day, draft, setDraft, py, cleared, onClear, onHint, hinted }) {
  const [out, setOut] = useState(null);
  const [busy, setBusy] = useState(false);
  const d = day.dungeon;

  const go = async (submit) => {
    setBusy(true);
    setOut(null);
    if (py.status !== "ready") await py.load();
    const res = await py.run(draft, submit ? d.tests : []);
    setOut(res);
    setBusy(false);
    if (submit && !res.error && res.results.length > 0 && res.results.every((r) => r.ok)) {
      onClear();
    }
  };

  const loadingRuntime = py.status === "loading";
  const runtimeBad = py.status === "error";

  return (
    <Frame
      className={`pw-portal ${day.boss ? "pw-portal--boss" : ""}`}
      tone={cleared ? "ok" : day.boss ? "bad" : undefined}
      style={{ marginTop: 16 }}
    >
      <div className="pw-portal-head">
        <div className="pw-portal-ring">
          <PortalRing color={day.boss ? "var(--bad)" : "var(--cyan)"} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="pw-portal-title">{day.boss ? "◆ GATE BOSS" : "▶ DAILY DUNGEON"}</div>
          <div className="pw-muted" style={{ fontSize: 12 }}>write Python · graded by the System</div>
        </div>
        <div className="pw-row" style={{ gap: 8 }}>
          <StatChip id={d.stat} />
          <span className="pw-tag">+{d.xp} XP</span>
        </div>
      </div>

      <div className="pw-code pw-read" style={{ margin: "10px 0", background: "transparent", border: "1px dashed var(--line)" }}>
        {d.brief}
      </div>
      <CodeEditor value={draft} onChange={setDraft} disabled={busy} />
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <button className="pw-btn" disabled={busy} onClick={() => go(false)}>
          {busy ? "Running…" : "Run"}
        </button>
        <button className="pw-btn primary" disabled={busy} onClick={() => go(true)}>
          {day.boss ? "Challenge the Gate" : "Submit"}
        </button>
        {!cleared && (
          <button className="pw-btn" disabled={busy} onClick={onHint}>
            {hinted ? "Hint shown" : "Reveal a hint"}
          </button>
        )}
        <span className="pw-muted" style={{ alignSelf: "center", fontSize: 12 }}>
          runtime:{" "}
          {py.status === "ready" ? "ready"
            : loadingRuntime ? "summoning… (~6 MB, one time)"
            : runtimeBad ? "failed to load — check your connection"
            : "not summoned"}
        </span>
      </div>

      {hinted && !cleared && (
        <div style={{ marginTop: 10, fontSize: 13 }} className="pw-muted pw-read">
          Hint: work one test at a time — each test's label says exactly what it wants. In tests, the
          variable <code>STDOUT</code> holds everything your code printed. Make functions{" "}
          <b>return</b> values (not print them) unless the brief says to print.
        </div>
      )}

      {out && (
        <div style={{ marginTop: 12 }}>
          {out.error && (
            <div className="pw-out" style={{ borderColor: "var(--bad)", color: "var(--bad)" }}>{out.error}</div>
          )}
          {out.stdout ? (
            <div style={{ marginTop: 8 }}>
              <div className="pw-eyebrow" style={{ marginBottom: 4 }}>Console</div>
              <div className="pw-out">{out.stdout}</div>
            </div>
          ) : null}
          {out.results && out.results.length > 0 && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
              {out.results.map((r, i) => (
                <div key={i} className="pw-row" style={{ fontSize: 13, color: r.ok ? "var(--ok)" : "var(--bad)" }}>
                  <span>{r.ok ? "✓" : "✗"}</span>
                  <span style={{ fontFamily: "var(--mono)" }}>{r.label}</span>
                  {!r.ok && r.msg ? <span className="pw-muted">— {r.msg}</span> : null}
                </div>
              ))}
            </div>
          )}
          {!out.error && !out.stdout && (!out.results || out.results.length === 0) && (
            <div className="pw-muted" style={{ marginTop: 8, fontSize: 13 }}>
              Ran with no output — add a print(...) to see something here.
            </div>
          )}
        </div>
      )}

      {cleared && (
        <div style={{ marginTop: 12, color: "var(--ok)", fontFamily: "var(--mono)", fontSize: 13 }}>
          ⟢ {day.boss ? "GATE CLEARED. Rank licence upgraded." : "DUNGEON CLEARED. Rewards distributed."}
        </div>
      )}
    </Frame>
  );
}

/* ========================= assessment ======================= */
function Assessment({ onDone }) {
  const [i, setI] = useState(0);
  const [ans, setAns] = useState({});
  const q = ASSESSMENT[i];
  const pick = (k) => {
    const next = { ...ans, [q.id]: k };
    setAns(next);
    if (i + 1 < ASSESSMENT.length) setI(i + 1);
    else onDone(next);
  };
  return (
    <div className="pw-wrap" style={{ maxWidth: 640 }}>
      <div style={{ textAlign: "center", marginBottom: 22 }}>
        <Emblem size={128} />
      </div>
      <h1 className="pw-h1" style={{ fontSize: 24, marginBottom: 6, textAlign: "center" }}>The Awakening Test</h1>
      <p className="pw-muted pw-read" style={{ marginTop: 0, textAlign: "center" }}>
        Five questions. The System reads your current level and sets your starting stats.
        Answer honestly — lying just makes Day 1 harder than it needs to be.
      </p>
      <Frame className="pw-reveal" key={i}>
        <div className="pw-eyebrow">
          {i + 1} / {ASSESSMENT.length} · trains{" "}
          <b style={{ color: "var(--cyan)" }}>{STATS.find((s) => s.id === q.stat)?.label}</b>
        </div>
        <div style={{ fontSize: 18, margin: "10px 0 4px" }}>{q.q}</div>
        {q.options.map((o, k) => (
          <button key={k} className="pw-choice" onClick={() => pick(k)}>{o}</button>
        ))}
      </Frame>
    </div>
  );
}

/* =========================== today ========================= */
const PHASES = [
  [1, "Foundations"], [11, "Data"], [21, "Functions"],
  [31, "Craft"], [41, "Objects"], [51, "Mastery"],
  [61, "Applied"], [71, "Algorithms"], [81, "Idioms"], [91, "Shipping"],
];
const phaseFor = (day) => {
  let name = "Foundations";
  for (const [d, n] of PHASES) if (day >= d) name = n;
  return name;
};

function Today({ save, viewDay, setViewDay, py, mutate, toast }) {
  const day = useMemo(() => dayContent(viewDay), [viewDay]);
  const rec = save.completed?.[viewDay] || { lessons: [], dungeon: false, boss: false };
  const [codex, setCodex] = useState(viewDay === (save.day || 1));
  useEffect(() => { setCodex(viewDay === (save.day || 1)); }, [viewDay]); // eslint-disable-line
  const draft = save.drafts?.[viewDay] ?? day.dungeon.starter;
  const setDraft = (v) => mutate((s) => ({ ...s, drafts: { ...(s.drafts || {}), [viewDay]: v } }));
  const hinted = !!save.hintDays?.[viewDay];

  const lessonsDone = (day.lessons || []).every((_, i) => rec.lessons?.[i]);
  const dungeonDone = !!rec.dungeon;
  const dayCleared = lessonsDone && dungeonDone;
  const isCurrent = viewDay === (save.day || 1);
  const isReplay = viewDay < (save.day || 1);

  const markLesson = (idx) => {
    mutate((s) => {
      const c = { ...(s.completed || {}) };
      const r = { ...(c[viewDay] || { lessons: [], dungeon: false, boss: false }) };
      const L = [...(r.lessons || [])];
      if (L[idx]) return s;
      L[idx] = true;
      r.lessons = L;
      c[viewDay] = r;
      const gain = s.penalty && isCurrent ? 4 : 8;
      const stats = { ...s.stats, [day.stat]: (s.stats[day.stat] || 0) + 1 };
      return { ...s, completed: c, xp: (s.xp || 0) + (isReplay ? 0 : gain), stats };
    });
  };

  const clearDungeon = () => {
    mutate((s) => {
      if (s.completed?.[viewDay]?.dungeon) return s;
      const c = { ...(s.completed || {}) };
      const r = { ...(c[viewDay] || { lessons: [], dungeon: false, boss: false }) };
      r.dungeon = true;
      if (day.boss) r.boss = true;
      c[viewDay] = r;

      const stats = { ...s.stats };
      const bump = day.boss ? 3 : 2;
      stats[day.stat] = (stats[day.stat] || 0) + bump;
      if (day.boss) for (const st of STATS) stats[st.id] = (stats[st.id] || 0) + 1;

      const noHint = !s.hintDays?.[viewDay];
      const flawless = (s.flawless || 0) + (noHint && !isReplay ? 1 : 0);

      const today = dayStr();
      let streak = s.streak || 0;
      let bestStreak = s.bestStreak || 0;
      let lastActive = s.lastActive;
      let penalty = s.penalty;
      if (!isReplay && lastActive !== today) {
        const gap = lastActive ? daysBetween(lastActive, today) : 1;
        streak = gap === 1 ? streak + 1 : 1;
        bestStreak = Math.max(bestStreak, streak);
        lastActive = today;
        penalty = false;
      }

      const nextDay = Math.min(PROGRAM_DAYS, Math.max(s.day || 1, viewDay + 1));
      const xp = (s.xp || 0) + (isReplay ? 0 : day.dungeon.xp);

      const draftState = { ...s, completed: c, stats, xp, flawless, streak, bestStreak, lastActive, penalty, day: nextDay };
      const before = new Set(s.achievements || []);
      const now = earnedAchievements(draftState);
      const fresh = now.filter((a) => !before.has(a));
      draftState.achievements = now;
      setTimeout(() => {
        if (day.boss) toast("sys", "⟢ NOTIFICATION", `Gate cleared. Hunter Rank is now ${rankFromBosses(countBosses(draftState))}-class.`);
        else toast("sys", "⟢ NOTIFICATION", "Daily Quest complete. Rewards distributed.");
        for (const id of fresh) {
          const a = ACHIEVEMENTS.find((x) => x.id === id);
          if (a) toast("ach", "★ ACHIEVEMENT", `${a.name} — ${a.note}`);
        }
      }, 0);
      return draftState;
    });
  };

  const revealHint = () => mutate((s) => ({ ...s, hintDays: { ...(s.hintDays || {}), [viewDay]: true } }));

  return (
    <div className="pw-wrap">
      <div className="pw-row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
        <button className="pw-btn" disabled={viewDay <= 1} onClick={() => setViewDay(viewDay - 1)}>‹ Day {viewDay - 1}</button>
        <div style={{ textAlign: "center" }}>
          <div className="pw-eyebrow">{phaseFor(viewDay)} · Day {viewDay} / {PROGRAM_DAYS}</div>
          <div className="pw-h1">{day.title}</div>
        </div>
        <button className="pw-btn" disabled={viewDay >= (save.day || 1)} onClick={() => setViewDay(viewDay + 1)}>Day {viewDay + 1} ›</button>
      </div>

      {/* One keyed wrapper: the whole day-specific subtree remounts atomically
          when viewDay changes, so no per-lesson state (or framed panels) leaks
          across days. */}
      <div key={viewDay}>

      {isReplay && (
        <div className="pw-muted" style={{ fontSize: 12, marginBottom: 8 }}>
          Replaying a cleared day — practice freely, no rewards granted.
        </div>
      )}
      {save.penalty && isCurrent && (
        <Frame tone="bad" style={{ marginBottom: 12 }}>
          <div className="pw-sys" style={{ color: "var(--bad)", borderColor: "var(--bad)" }}>
            ⟢ WARNING — A Daily Quest was missed. PENALTY active: lesson XP is halved until today's Gate is cleared.
          </div>
        </Frame>
      )}

      <Frame className="pw-sysbox pw-reveal">
        <div className="pw-eyebrow"><b>⟢ SYSTEM MESSAGE</b> · Day {viewDay}</div>
        <div className="pw-sys">{day.system}</div>
      </Frame>

      {(day.concepts?.length || 0) > 0 && (
        <Frame style={{ marginTop: 12 }}>
          <button className="pw-row" style={{ background: "none", border: 0, color: "var(--text)", padding: 0, fontWeight: 700, fontFamily: "var(--display)", letterSpacing: ".06em", fontSize: 13 }}
            onClick={() => setCodex(!codex)}>
            <span style={{ color: "var(--cyan)" }}>{codex ? "▾" : "▸"}</span> SKILL CODEX
          </button>
          {codex && (
            <ul className="pw-read" style={{ margin: "12px 0 0", paddingLeft: 18, lineHeight: 1.7, fontSize: 14.5 }}>
              {day.concepts.map((c, i) => <li key={i} style={{ marginBottom: 7 }}>{c}</li>)}
            </ul>
          )}
        </Frame>
      )}

      {(day.lessons || []).length > 0 && (
        <div style={{ marginTop: 6 }}>
          <div className="pw-phase">Training · {(rec.lessons || []).filter(Boolean).length}/{day.lessons.length}</div>
          {day.lessons.map((l, i) => (
            <LessonCard key={i} lesson={l} done={!!rec.lessons?.[i]} onDone={() => markLesson(i)} />
          ))}
        </div>
      )}

      {(day.lessons || []).length > 0 && !lessonsDone && (
        <div className="pw-muted" style={{ fontSize: 12, marginTop: 10 }}>
          Finish the training above to log the day — the Dungeon is open now, but the day only counts when both are done.
        </div>
      )}

      <Dungeon
        day={day} draft={draft} setDraft={setDraft} py={py}
        cleared={dungeonDone} onClear={clearDungeon}
        onHint={revealHint} hinted={hinted}
      />

      {dayCleared && (
        <Frame tone="ok" className="pw-reveal" style={{ marginTop: 16 }}>
          <div className="pw-display" style={{ color: "var(--ok)", marginBottom: 6, fontSize: 16 }}>
            ⟢ DAY {viewDay} LOGGED
          </div>
          <div className="pw-muted pw-read" style={{ fontSize: 13, marginBottom: 10 }}>
            {viewDay < PROGRAM_DAYS
              ? "The next Gate is open."
              : "You have reached the summit of the tower. You are the Python Monarch."}
          </div>
          {viewDay < PROGRAM_DAYS && (
            <button className="pw-btn primary" onClick={() => setViewDay(Math.min(save.day || 1, viewDay + 1))}>
              Enter Day {viewDay + 1} →
            </button>
          )}
        </Frame>
      )}

      </div>{/* /key={viewDay} */}
    </div>
  );
}

/* ============================ path ========================= */
function Path({ save, setViewDay, setTab }) {
  const cur = save.day || 1;
  const rows = [];
  let lastPhase = null;
  for (let d = 1; d <= PROGRAM_DAYS; d++) {
    const ph = phaseFor(d);
    if (ph !== lastPhase) { rows.push({ phase: ph, key: "p" + d }); lastPhase = ph; }
    const meta = d <= 10 ? dayContent(d) : topicFor(d);
    const done = !!save.completed?.[d]?.dungeon;
    const locked = d > cur;
    rows.push({ d, meta, done, locked, cur: d === cur, boss: isBossDay(d), key: "d" + d });
  }
  return (
    <div className="pw-wrap">
      <h1 className="pw-h1" style={{ marginBottom: 4 }}>The Tower · {PROGRAM_DAYS} Gates</h1>
      <p className="pw-muted pw-read" style={{ marginTop: 0, fontSize: 13 }}>
        Days 1–10 are fully built. Days 11–{PROGRAM_DAYS} are scouted — real graded challenges per
        stat, with full lessons landing over time. Diamond nodes are Gate Bosses
        ({Object.keys(BOSS_DAYS).map(Number).sort((a, b) => a - b).join(", ")}).
      </p>
      <div className="pw-daylist">
        {rows.map((r) =>
          r.phase ? (
            <div key={r.key} className="pw-phase" style={{ marginLeft: -26 }}>{r.phase}</div>
          ) : (
            <button key={r.key}
              className={`pw-dayrow ${r.boss ? "boss" : ""} ${r.done ? "done" : ""} ${r.cur ? "cur" : ""}`}
              disabled={r.locked}
              onClick={() => { setViewDay(r.d); setTab("today"); }}>
              <span className="pw-daynum">DAY {r.d}</span>
              <span style={{ flex: 1 }} className="pw-read">
                {r.meta?.title || `Day ${r.d}`}
                {r.locked ? <span className="pw-muted" style={{ fontSize: 11 }}> · locked</span> : null}
              </span>
              {r.meta?.stat && <StatChip id={r.meta.stat} />}
              <span style={{ width: 18, textAlign: "center", color: r.done ? "var(--ok)" : "var(--dim)" }}>
                {r.done ? "✓" : r.locked ? "" : "•"}
              </span>
            </button>
          )
        )}
      </div>
    </div>
  );
}

/* ========================== hunter ======================== */
function countBosses(save) {
  const c = save.completed || {};
  return Object.keys(BOSS_DAYS).filter((d) => c[d] && c[d].boss).length;
}

function Hunter({ save, mutate, toast, resetAll, auth, openAuth }) {
  const { level, into, need } = levelFromXP(save.xp || 0);
  const rank = rankFromBosses(countBosses(save));
  const earned = new Set(save.achievements || []);
  const nextGate = Object.keys(BOSS_DAYS).map(Number).sort((a, b) => a - b).find((d) => !save.completed?.[d]?.boss);

  const rem = save.reminder || { enabled: true, hour: 9, minute: 0 };
  const remTime = `${String(rem.hour ?? 9).padStart(2, "0")}:${String(rem.minute ?? 0).padStart(2, "0")}`;
  const setReminder = (patch) => {
    const next = { enabled: true, hour: 9, minute: 0, ...rem, ...patch };
    mutate((s) => ({ ...s, reminder: next }));
    applyReminderPref(next);
    if (next.enabled) toast("sys", "⟢ SYSTEM", `Daily Quest reminder set for ${
      String(next.hour).padStart(2, "0")}:${String(next.minute).padStart(2, "0")}.`);
  };

  return (
    <div className="pw-wrap">
      <div className="pw-row" style={{ gap: 16, flexWrap: "wrap", alignItems: "stretch" }}>
        <Frame tone="gold" style={{ flex: "1 1 240px", textAlign: "center", position: "relative", overflow: "hidden" }}>
          <div className="pw-portal-ring" style={{ width: 64, height: 64, margin: "2px auto 6px" }}>
            <div style={{ position: "absolute", inset: 0, animation: "pw-spin 9s linear infinite" }}>
              <PortalRing color="var(--gold)" />
            </div>
          </div>
          <div className="pw-eyebrow">Hunter Rank</div>
          <div className="pw-display" style={{ fontSize: 52, color: "var(--cyan)", lineHeight: 1.1, textShadow: "var(--glow-cyan)" }}>{rank}</div>
          <div className="pw-muted" style={{ fontSize: 12 }}>
            {countBosses(save)} / 7 Gates cleared{nextGate ? ` · next at Day ${nextGate}` : " · tower complete"}
          </div>
        </Frame>
        <Frame style={{ flex: "2 1 320px" }}>
          <div className="pw-row" style={{ justifyContent: "space-between" }}>
            <div className="pw-display" style={{ fontSize: 18 }}>Level {level}</div>
            <div className="pw-muted" style={{ fontSize: 12 }}>{into} / {need} XP · {save.xp || 0} total</div>
          </div>
          <div style={{ marginTop: 8 }}><Bar value={(into / need) * 100} /></div>
          <div className="pw-row" style={{ gap: 18, marginTop: 14, fontSize: 13, flexWrap: "wrap" }}>
            <div>🔥 Streak <b>{save.streak || 0}</b> <span className="pw-muted">(best {save.bestStreak || 0})</span></div>
            <div>Dungeons <b>{clearedDungeons(save)}</b></div>
            <div>Flawless <b>{save.flawless || 0}</b></div>
          </div>
        </Frame>
      </div>

      <Frame style={{ marginTop: 14 }}>
        <div className="pw-phase" style={{ marginTop: 0 }}>Stat Sheet</div>
        <Radar stats={save.stats || {}} />
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
          {STATS.map((s) => {
            const v = save.stats?.[s.id] || 0;
            const max = Math.max(20, ...STATS.map((x) => save.stats?.[x.id] || 0));
            return (
              <div key={s.id}>
                <div className="pw-row" style={{ justifyContent: "space-between", fontSize: 13 }}>
                  <b>{s.label}</b><span className="pw-muted">{v}</span>
                </div>
                <Bar value={(v / max) * 100} />
                <div className="pw-muted pw-read" style={{ fontSize: 11, marginTop: 3 }}>{s.blurb}</div>
              </div>
            );
          })}
        </div>
      </Frame>

      <Frame style={{ marginTop: 14 }}>
        <div className="pw-phase" style={{ marginTop: 0 }}>
          Achievements · {earned.size} / {ACHIEVEMENTS.length}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 8 }}>
          {ACHIEVEMENTS.map((a) => (
            <div key={a.id} className={`pw-ach ${earned.has(a.id) ? "on" : ""}`}>
              <div className="pw-achname" style={{ fontWeight: 700, fontSize: 13, fontFamily: "var(--display)", letterSpacing: ".04em" }}>
                {earned.has(a.id) ? "★ " : "☆ "}{a.name}
              </div>
              <div className="pw-muted pw-read" style={{ fontSize: 12 }}>{a.note}</div>
            </div>
          ))}
        </div>
      </Frame>

      <AccountPanel save={save} auth={auth} openAuth={openAuth} toast={toast} />

      {!isNative && (
        <Frame style={{ marginTop: 14 }}>
          <div className="pw-phase" style={{ marginTop: 0 }}>Get the app</div>
          <div className="pw-muted pw-read" style={{ fontSize: 13, marginBottom: 12 }}>
            Install PyWots on your Android phone — the same app, runs offline, with the daily
            System summons.
          </div>
          <a className="pw-btn primary" href="/pywots.apk" download="pywots.apk"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
            <AndroidGlyph /> Download for Android&nbsp;·&nbsp;APK
          </a>
          <div className="pw-muted pw-read" style={{ fontSize: 12, marginTop: 10, lineHeight: 1.7 }}>
            After it downloads, open the file. Android asks once to allow installs from your browser —
            tap <b>Settings → Allow from this source</b>, then <b>Install</b>. Not a Play Store app,
            so you may see a "scan" prompt; that's normal for a sideloaded APK.<br />
            iPhone: build it in Xcode (see <code>CAPACITOR.md</code>) — Apple has no APK equivalent.
          </div>
        </Frame>
      )}

      <Frame style={{ marginTop: 14 }}>
        <div className="pw-phase" style={{ marginTop: 0 }}>Daily Quest Reminder</div>
        <label className="pw-row" style={{ gap: 10, cursor: "pointer" }}>
          <input type="checkbox" checked={rem.enabled !== false}
            onChange={(e) => setReminder({ enabled: e.target.checked })} />
          <span>Summon me every day at</span>
          <input type="time" className="pw-input" style={{ width: 130, margin: 0 }}
            value={remTime}
            onChange={(e) => {
              const [h, m] = e.target.value.split(":").map(Number);
              setReminder({ hour: h || 0, minute: m || 0 });
            }} />
        </label>
        <div className="pw-muted pw-read" style={{ fontSize: 12, marginTop: 10 }}>
          {isNative
            ? "A System notification with an Accept button — iOS shows it as a standard banner; tapping it opens the full-screen summons and drops you into the Gate. (No app can take over the iOS screen on its own.)"
            : "You'll get a browser notification and the full-screen summons at this time while PyWots is open, plus the summons the first time you open it each day. Browsers can't wake a closed tab — install the iOS app for a true daily push."}
        </div>
        <button className="pw-btn" style={{ marginTop: 10 }}
          onClick={() => { mutate((s) => ({ ...s, summonedOn: null })); window.dispatchEvent(new CustomEvent("pywots:summon")); }}>
          Preview the summons
        </button>
      </Frame>

      <Frame style={{ marginTop: 14 }}>
        <div className="pw-phase" style={{ marginTop: 0 }}>Reset</div>
        <div className="pw-muted pw-read" style={{ fontSize: 13, marginBottom: 10 }}>
          Wipe this device's progress and start the 100-day path over.
        </div>
        <button className="pw-btn danger" onClick={resetAll}>Reset all progress</button>
      </Frame>

      {import.meta.env.DEV && (
        <Frame style={{ marginTop: 14 }}>
          <div className="pw-phase" style={{ marginTop: 0, color: "var(--dim)" }}>Dev only (npm run dev)</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="pw-btn" onClick={() => mutate((s) => ({ ...s, day: Math.min(PROGRAM_DAYS, (s.day || 1) + 1) }))}>
              Unlock next day
            </button>
            <button className="pw-btn" onClick={() => mutate((s) => ({ ...s, xp: (s.xp || 0) + 200 }))}>+200 XP</button>
            <button className="pw-btn" onClick={() => { mutate((s) => ({ ...s, lastActive: dayStr(new Date(Date.now() - 3 * 86400000)) })); toast("sys", "⟢ DEBUG", "lastActive set 3 days back — reload to trigger penalty."); }}>
              Age progress 3 days
            </button>
          </div>
        </Frame>
      )}
    </div>
  );
}

/* ========================== accounts ====================== */
function useAuth() {
  const [user, setUser] = useState(isConfigured() ? undefined : null); // undefined = resolving
  const [syncState, setSyncState] = useState("off");
  useEffect(() => {
    if (!isConfigured()) return;
    let alive = true;
    currentUser().then((u) => { if (alive) setUser(u || null); });
    const offAuth = onAuthChange((_e, session) => { if (alive) setUser(session?.user || null); });
    const offSync = onSyncState(setSyncState);
    return () => { alive = false; offAuth(); offSync(); };
  }, []);
  const email = user && !isAnon(user) ? (user.email || null) : null;
  return { user, email, isAnon: !user || isAnon(user), syncState, configured: isConfigured() };
}

function GBrand() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C41.4 34.9 44 30 44 24c0-1.3-.1-2.3-.4-3.5z"/></svg>
  );
}
function AndroidGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6 9v8a1.5 1.5 0 0 0 1.5 1.5H8V21a1 1 0 0 0 2 0v-2.5h4V21a1 1 0 0 0 2 0v-2.5h.5A1.5 1.5 0 0 0 18 17V9H6zM4.5 9A1.5 1.5 0 0 0 3 10.5v4a1.5 1.5 0 0 0 3 0v-4A1.5 1.5 0 0 0 4.5 9zm15 0a1.5 1.5 0 0 0-1.5 1.5v4a1.5 1.5 0 0 0 3 0v-4A1.5 1.5 0 0 0 19.5 9zM15.6 3.2l1-1.7a.4.4 0 0 0-.7-.4l-1.1 1.8a6.9 6.9 0 0 0-5.6 0L8.1 1.1a.4.4 0 1 0-.7.4l1 1.7A6 6 0 0 0 6 8h12a6 6 0 0 0-2.4-4.8zM9.5 6.2a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6zm5 0a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6z" />
    </svg>
  );
}
function AppleBrand() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.4 12.6c0-2.5 2-3.7 2.1-3.8-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.6.9-.8 0-1.9-.9-3.1-.8-1.6 0-3 .9-3.9 2.4-1.6 2.9-.4 7.1 1.2 9.4.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7 1.4 0 1.8.7 3 .7 1.3 0 2.1-1.1 2.8-2.3.9-1.3 1.3-2.6 1.3-2.7-.1 0-2.5-1-2.5-3.8zM14 4.8c.6-.8 1.1-1.9 1-3-1 .1-2.1.7-2.8 1.5-.6.7-1.1 1.8-1 2.9 1.1.1 2.2-.6 2.8-1.4z"/></svg>
  );
}

function AuthSheet({ onClose, toast }) {
  const [mode, setMode] = useState("register"); // register | signin
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");

  const submit = async () => {
    setErr(""); setNote(""); setBusy(true);
    try {
      if (mode === "register") {
        const u = await registerEmail(email.trim(), pw);
        if (u && !u.email_confirmed_at && u.confirmation_sent_at) {
          setNote("Check your inbox to confirm the address. Your progress is already saved.");
          toast("sys", "⟢ SYSTEM", "Confirmation email sent.");
          return;
        }
        toast("sys", "⟢ SYSTEM", "Account created. Progress will sync from now on.");
      } else {
        await signInEmail(email.trim(), pw);
        toast("sys", "⟢ SYSTEM", "Signed in. Progress synced.");
      }
      onClose();
    } catch (e) {
      setErr(e?.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const oauth = async (provider) => {
    setErr(""); setBusy(true);
    try { await signInWithProvider(provider); /* web navigates away */ }
    catch (e) { setErr(e?.message || `Could not continue with ${provider}.`); setBusy(false); }
  };

  const forgot = async () => {
    setErr(""); setNote("");
    try { await sendPasswordReset(email.trim()); setNote("Password reset email sent."); }
    catch (e) { setErr(e?.message || "Could not send reset email."); }
  };

  return (
    <div className="pw-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <Frame style={{ width: "min(420px, 100%)" }}>
        <div className="pw-row" style={{ justifyContent: "space-between" }}>
          <div className="pw-display" style={{ fontSize: 16 }}>
            {mode === "register" ? "Save your progress" : "Welcome back"}
          </div>
          <button className="pw-btn" style={{ padding: "4px 10px" }} onClick={onClose}>✕</button>
        </div>
        <div className="pw-muted pw-read" style={{ fontSize: 12.5, marginTop: 6 }}>
          {mode === "register"
            ? "Your progress stays on this device and is yours. An account just lets it follow you to other devices and the iOS app."
            : "Sign in to pull your progress onto this device."}
        </div>

        <input className="pw-input" type="email" inputMode="email" autoComplete="email"
          placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="pw-input" type="password"
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          placeholder="password" value={pw} onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />

        {err && <div style={{ color: "var(--bad)", fontSize: 12.5, marginTop: 8 }}>{err}</div>}
        {note && <div style={{ color: "var(--ok)", fontSize: 12.5, marginTop: 8 }}>{note}</div>}

        <button className="pw-btn primary" style={{ width: "100%", marginTop: 12 }} disabled={busy || !email || !pw}
          onClick={submit}>
          {busy ? "…" : mode === "register" ? "Create account" : "Sign in"}
        </button>

        <div className="pw-row" style={{ gap: 8, margin: "12px 0 4px" }}>
          <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
          <span className="pw-eyebrow">or</span>
          <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
        </div>
        <button className="pw-btn pw-oauth" disabled={busy} onClick={() => oauth("google")}>
          <GBrand /> Continue with Google
        </button>
        <button className="pw-btn pw-oauth" disabled={busy} onClick={() => oauth("apple")}>
          <AppleBrand /> Continue with Apple
        </button>

        <div className="pw-row" style={{ justifyContent: "space-between", marginTop: 12, fontSize: 12.5 }}>
          <button className="pw-link" style={{ background: "none", border: 0, padding: 0 }}
            onClick={() => { setMode(mode === "register" ? "signin" : "register"); setErr(""); setNote(""); }}>
            {mode === "register" ? "I already have an account" : "Create an account"}
          </button>
          {mode === "signin" && (
            <button className="pw-link" style={{ background: "none", border: 0, padding: 0 }} onClick={forgot}>
              Forgot password?
            </button>
          )}
        </div>
      </Frame>
    </div>
  );
}

function AccountPanel({ save, auth, openAuth, toast }) {
  const [busy, setBusy] = useState(false);

  if (!auth.configured) {
    return (
      <Frame style={{ marginTop: 14 }}>
        <div className="pw-phase" style={{ marginTop: 0 }}>Account</div>
        <div className="pw-muted pw-read" style={{ fontSize: 13 }}>
          Cloud sync isn't set up for this build — progress is saved on this device only.
          See <code>supabase/README.md</code> to enable accounts.
        </div>
      </Frame>
    );
  }

  const exportData = async () => {
    try {
      const blob = await store.exportBlob(SAVE_KEY);
      const text = JSON.stringify(blob ?? save ?? {}, null, 2);
      const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url; a.download = "pywots-progress.json"; a.click();
      URL.revokeObjectURL(url);
    } catch {
      try { await navigator.clipboard.writeText(JSON.stringify(save)); toast("sys", "⟢ SYSTEM", "Progress copied to clipboard."); }
      catch { toast("sys", "⟢ SYSTEM", "Could not export."); }
    }
  };

  const doSignOut = async () => {
    if (!window.confirm("Sign out? Local progress on this device is cleared (it stays in your account).")) return;
    setBusy(true);
    await signOut();
    window.location.reload();
  };

  const doDelete = async () => {
    if (!window.confirm("Delete your account and all its data? This cannot be undone.")) return;
    setBusy(true);
    try { await deleteAccount(); window.location.reload(); }
    catch (e) { toast("sys", "⟢ SYSTEM", e?.message || "Delete failed."); setBusy(false); }
  };

  const syncLabel = { synced: "Synced", syncing: "Syncing…", error: "Sync error — will retry", off: "Local only" }[auth.syncState] || "";

  return (
    <Frame style={{ marginTop: 14 }} tone={auth.email ? undefined : "gold"}>
      <div className="pw-phase" style={{ marginTop: 0 }}>Account</div>

      {auth.isAnon ? (
        <>
          <div className="pw-read" style={{ fontSize: 13 }}>
            You're playing as a <b>guest</b>. Progress is saved on this device and is yours —
            create an account to sync it to other devices and the iOS app.
          </div>
          <button className="pw-btn primary" style={{ marginTop: 10 }} onClick={openAuth}>
            Create account / Sign in
          </button>
        </>
      ) : (
        <>
          <div className="pw-row" style={{ gap: 8 }}>
            <span className="pw-avatar">{(auth.email || "?")[0].toUpperCase()}</span>
            <div>
              <div style={{ fontSize: 13 }}>{auth.email}</div>
              <div className="pw-row" style={{ gap: 6, fontSize: 11 }} >
                <span className={`pw-syncdot ${auth.syncState}`} /> <span className="pw-muted">{syncLabel}</span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <button className="pw-btn" disabled={busy} onClick={() => store.resync(SAVE_KEY).then(() => toast("sys", "⟢ SYSTEM", "Synced."))}>Sync now</button>
            <button className="pw-btn" disabled={busy} onClick={exportData}>Export data</button>
            <button className="pw-btn" disabled={busy} onClick={doSignOut}>Sign out</button>
            <button className="pw-btn danger" disabled={busy} onClick={doDelete}>Delete account</button>
          </div>
        </>
      )}
    </Frame>
  );
}

/* ---------------------- the System summons ------------------ */
/* The full-screen "NOTIFICATION — will you accept?" screen. Shown when the
   app is opened from the 9am reminder, or on the first open of a new day
   with today's Gate still uncleared. */
function SystemSummons({ day, onAccept, onDismiss }) {
  return (
    <div className="pw-summon" role="dialog" aria-modal="true">
      <Frame className="pw-summon-card">
        <div className="pw-summon-bar" />
        <div className="pw-summon-head">
          <span className="pw-summon-i">!</span>
          <span className="pw-summon-title">NOTIFICATION</span>
        </div>
        <div className="pw-summon-body pw-read">
          The Daily Quest has appeared.<br />
          You have acquired the qualifications to enter <b>Gate {day}</b>.<br />
          Will you accept?
        </div>
        <div className="pw-summon-actions">
          <button className="pw-btn primary" onClick={onAccept}>Accept</button>
          <button className="pw-btn" onClick={onDismiss}>Not now</button>
        </div>
        <div className="pw-summon-bar" style={{ marginTop: 14 }} />
      </Frame>
    </div>
  );
}

/* Fire-and-forget: apply the daily reminder pref.
   - Native: (re)schedule a real repeating local notification.
   - Web: ask for the Notifications permission so the in-tab reminder timer
     (in the shell) can post a browser notification while PyWots is open. */
function applyReminderPref(pref) {
  if (isNative) {
    import("./src/lib/reminders.js")
      .then((m) => m.applyReminder(pref, { requestIfNeeded: true }))
      .catch(() => {});
    return;
  }
  if (pref?.enabled !== false && typeof window !== "undefined"
      && "Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}

/* =========================== shell ======================== */
export default function PyWots() {
  const [save, setSave] = useState(undefined); // undefined = loading
  const [tab, setTab] = useState("today");
  const [viewDay, setViewDay] = useState(1);
  const [toasts, setToasts] = useState([]);
  const [booting, setBooting] = useState(true);
  const [burst, setBurst] = useState(null); // {title, sub}
  const [authOpen, setAuthOpen] = useState(false);
  const [summon, setSummon] = useState(false);
  const py = usePyodide();
  const auth = useAuth();
  const prevLevel = useRef(null);
  const prevRank = useRef(null);

  const toast = useCallback((kind, title, body) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, kind, title, body }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5200);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setBooting(false), 2050);
    return () => clearTimeout(t);
  }, []);

  // finish an OAuth redirect / deep-link return, if any
  useEffect(() => { completeOAuthFromUrl(); }, []);

  // when the user signs in as a real (non-guest) identity, pull that
  // account's save and adopt it if it carries progress.
  const prevUid = useRef(null);
  useEffect(() => {
    if (!auth.configured || auth.user === undefined) return;
    const uid = auth.user?.id || null;
    const changed = uid !== prevUid.current;
    const becameReal = Boolean(auth.user) && !auth.isAnon;
    prevUid.current = uid;
    if (!changed || !becameReal) return;
    let alive = true;
    store.resync(SAVE_KEY).then((s) => {
      if (!alive || !s || !s.answers) return;
      setSave((cur) => (cur && JSON.stringify(cur) === JSON.stringify(s) ? cur : s));
      setViewDay(s.day || 1);
    });
    return () => { alive = false; };
  }, [auth.user, auth.isAnon, auth.configured]);

  // load
  useEffect(() => {
    (async () => {
      const s = await store.get(SAVE_KEY);
      if (s && s.answers) {
        const today = dayStr();
        if (s.lastActive && s.lastActive !== today) {
          const gap = daysBetween(s.lastActive, today);
          if (gap >= 2) { s.streak = 0; s.penalty = true; }
        }
        setSave(s);
        setViewDay(s.day || 1);
        if (s.penalty) setTimeout(() => toast("sys", "⟢ WARNING", "You missed a Daily Quest. Penalty applied — clear today's Gate to lift it."), 400);
      } else {
        setSave(null);
      }
    })();
  }, [toast]);

  // persist
  useEffect(() => {
    if (save && save.answers) store.set(SAVE_KEY, save);
  }, [save]);

  // level-up / rank-up detection
  useEffect(() => {
    if (!save || !save.answers) return;
    const lvl = levelFromXP(save.xp || 0).level;
    const rnk = rankFromBosses(countBosses(save));
    if (prevLevel.current != null && lvl > prevLevel.current) {
      setBurst({ title: "LEVEL UP", sub: `You are now Level ${lvl}` });
      setTimeout(() => setBurst(null), 2200);
    } else if (prevRank.current != null && rnk !== prevRank.current && RANKS.indexOf(rnk) > RANKS.indexOf(prevRank.current)) {
      setBurst({ title: "RANK UP", sub: `${rnk}-Class Hunter` });
      setTimeout(() => setBurst(null), 2200);
    }
    prevLevel.current = lvl;
    prevRank.current = rnk;
  }, [save]);

  const mutate = useCallback((fn) => setSave((s) => fn(s)), []);

  // the System summons — shown when opened from the reminder, or on the
  // first open of a new day with today's Gate still uncleared.
  useEffect(() => {
    if (!save || !save.answers || booting) return;
    if (typeof window !== "undefined" && window.__pywotsSummon) {
      window.__pywotsSummon = false;
      setSummon(true);
      return;
    }
    const today = dayStr();
    const cur = save.day || 1;
    const doneToday = !!save.completed?.[cur]?.dungeon;
    const remindOn = save.reminder?.enabled !== false;
    if (remindOn && save.summonedOn !== today && !doneToday) setSummon(true);
  }, [save, booting]);

  useEffect(() => {
    const h = () => setSummon(true);
    window.addEventListener("pywots:summon", h);
    return () => window.removeEventListener("pywots:summon", h);
  }, []);

  // web: while the PyWots tab is open, fire the reminder at the set time —
  // a browser notification (if allowed) plus the in-app summons. Browsers
  // can't wake a closed tab; the iOS app does that.
  const webFiredRef = useRef(null);
  useEffect(() => {
    if (isNative || !save || !save.answers) return;
    const r = save.reminder || {};
    if (r.enabled === false) return;
    const hour = r.hour ?? 9;
    const minute = r.minute ?? 0;
    const tick = () => {
      const now = new Date();
      const today = dayStr();
      if (now.getHours() === hour && now.getMinutes() === minute && webFiredRef.current !== today) {
        webFiredRef.current = today;
        try {
          if ("Notification" in window && Notification.permission === "granted") {
            const n = new Notification("⟢ NOTIFICATION", {
              body: "The Daily Quest has appeared — will you accept?",
              icon: "/icon-192.png",
              tag: "pywots-daily",
            });
            n.onclick = () => { window.focus(); window.dispatchEvent(new CustomEvent("pywots:summon")); n.close(); };
          }
        } catch { /* Notification blocked */ }
        window.dispatchEvent(new CustomEvent("pywots:summon"));
      }
    };
    const iv = setInterval(tick, 30000);
    tick();
    return () => clearInterval(iv);
  }, [save?.reminder, save?.answers]);

  const closeSummon = (accepted) => {
    setSummon(false);
    mutate((s) => ({ ...s, summonedOn: dayStr() }));
    if (accepted) { setTab("today"); setViewDay((save && save.day) || 1); }
  };

  // soft, one-time nudge to create an account — only after there's progress
  // worth protecting (Day 3 cleared) and only for guests.
  useEffect(() => {
    if (!save || !save.answers || !auth.configured || !auth.isAnon) return;
    if (save.promptedLink || !save.completed?.[3]?.dungeon) return;
    toast("sys", "⟢ SYSTEM", "Your progress lives only on this device. Open Hunter ▸ Account to save it to an account.");
    mutate((s) => ({ ...s, promptedLink: true }));
  }, [save, auth.configured, auth.isAnon, toast, mutate]);

  const finishAssessment = (answers) => {
    const fresh = {
      createdAt: new Date().toISOString(),
      answers,
      stats: startingStats(answers),
      xp: 0,
      day: 1,
      completed: {},
      drafts: {},
      hintDays: {},
      streak: 0,
      bestStreak: 0,
      lastActive: null,
      flawless: 0,
      achievements: [],
      penalty: false,
      reminder: { enabled: true, hour: 9, minute: 0 },
      summonedOn: dayStr(),
    };
    setSave(fresh);
    setViewDay(1);
    setTab("today");
    applyReminderPref(fresh.reminder); // prompts for notification permission on native
    setTimeout(() => toast("sys", "⟢ SYSTEM", "You have awakened as an E-Rank Hunter. The first Gate awaits."), 300);
  };

  const resetAll = () => {
    if (!window.confirm("Wipe all PyWots progress on this device? This cannot be undone.")) return;
    store.set(SAVE_KEY, null);
    setSave(null);
    setTab("today");
  };

  const chrome = (
    <>
      <style>{CSS}</style>
      <link rel="stylesheet" href={FONT_LINK} />
      <Backdrop />
      {booting && (
        <div className="pw-boot">
          <Emblem size={150} />
          <div className="pw-eyebrow" style={{ letterSpacing: ".34em" }}>System calibrating</div>
          <div className="pw-bootbar"><i /></div>
        </div>
      )}
      {burst && (
        <div className="pw-burst">
          <b>{burst.title}</b>
          <span>{burst.sub}</span>
        </div>
      )}
    </>
  );

  if (save === undefined) {
    return <div className="pw-app">{chrome}
      <div className="pw-wrap" style={{ paddingTop: 100, textAlign: "center", color: "var(--dim)" }}>Loading the System…</div>
    </div>;
  }
  if (save === null) {
    return <div className="pw-app">{chrome}<Assessment onDone={finishAssessment} /></div>;
  }

  const { level, into, need } = levelFromXP(save.xp || 0);
  const rank = rankFromBosses(countBosses(save));

  const TABS = [
    { id: "today", label: "Today", Icon: IconToday },
    { id: "path", label: "Tower", Icon: IconTower },
    { id: "hunter", label: "Hunter", Icon: IconHunter },
  ];

  return (
    <div className="pw-app">
      {chrome}

      <div className="pw-toast">
        {toasts.map((t) => (
          <div key={t.id} className="pw-toastcard"
            style={{ borderColor: t.kind === "ach" ? "var(--gold)" : "var(--cyan)" }}>
            <div className="pw-eyebrow" style={{
              color: t.kind === "ach" ? "var(--gold)" : "var(--cyan)" }}>{t.title}</div>
            <div className="pw-read" style={{ marginTop: 3 }}>{t.body}</div>
          </div>
        ))}
      </div>

      <div className="pw-status">
        <div className="pw-statusrow">
          <Emblem size={30} word={false} />
          <span className="pw-word" style={{ fontSize: 17 }}>PYWOTS</span>
          <span className="pw-badge">{rank}-RANK</span>
          <div className="pw-status-xp">
            <div className="pw-row" style={{ justifyContent: "space-between", fontSize: 10.5 }} >
              <span className="pw-eyebrow">Lv {level}</span>
              <span className="pw-muted">{into}/{need}</span>
            </div>
            <div style={{ marginTop: 3 }}><Bar value={(into / need) * 100} /></div>
          </div>
          <span className="pw-row pw-status-streak" style={{ gap: 4, fontFamily: "var(--display)", fontSize: 13 }}>
            🔥 {save.streak || 0}
          </span>
          {auth.configured && (
            auth.isAnon ? (
              <button className="pw-acct" style={{ flex: "none" }} onClick={() => setAuthOpen(true)} title="Save your progress">
                <span className="pw-syncdot" /> Guest
              </button>
            ) : (
              <button className="pw-acct" style={{ flex: "none" }} onClick={() => setTab("hunter")} title={auth.email || "Account"}>
                <span className={`pw-syncdot ${auth.syncState}`} />
                <span className="pw-avatar">{(auth.email || "?")[0].toUpperCase()}</span>
              </button>
            )
          )}
        </div>
      </div>

      {tab === "today" && (
        <Today save={save} viewDay={viewDay} setViewDay={setViewDay} py={py} mutate={mutate} toast={toast} />
      )}
      {tab === "path" && <Path save={save} setViewDay={setViewDay} setTab={setTab} />}
      {tab === "hunter" && <Hunter save={save} mutate={mutate} toast={toast} resetAll={resetAll} auth={auth} openAuth={() => setAuthOpen(true)} />}

      {authOpen && <AuthSheet onClose={() => setAuthOpen(false)} toast={toast} />}

      {!booting && summon && (
        <SystemSummons
          day={save.day || 1}
          onAccept={() => closeSummon(true)}
          onDismiss={() => closeSummon(false)}
        />
      )}

      <div className="pw-dock">
        <div className="pw-dockinner">
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} className={`pw-dockbtn ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>
              <Icon /><span>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
