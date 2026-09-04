/* CodeFilm — a ~21s looping film of the worker/ code assembling itself.
   Self-contained: no animation engine, one requestAnimationFrame clock.
   Needs the Vazirmatn + JetBrains Mono webfonts (see README). */

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n.js";
import "./CodeFilm.css";

/* ---- timing helpers ---- */
const Easing = {
  linear: (t) => t,
  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  easeInOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),
  easeOutBack: (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
};

function interpolate(input, output, ease = Easing.linear) {
  return (t) => {
    if (t <= input[0]) return output[0];
    if (t >= input[input.length - 1]) return output[output.length - 1];
    for (let i = 1; i < input.length; i++) {
      if (t <= input[i]) {
        const span = input[i] - input[i - 1] || 1;
        const p = ease((t - input[i - 1]) / span);
        return output[i - 1] + (output[i] - output[i - 1]) * p;
      }
    }
    return output[output.length - 1];
  };
}

function animate({ from = 0, to = 1, start = 0, end = 1, ease = Easing.easeInOutCubic }) {
  return (t) => {
    if (t <= start) return from;
    if (t >= end) return to;
    return from + (to - from) * ease((t - start) / (end - start));
  };
}

/* ---- the film's scene list (name, seconds) ---- */
const SCENES = [["Open", 2.4], ["Router", 4], ["Guard", 3], ["Intake", 4], ["Brief", 4], ["Deliver", 3.5]];
const CUES = {};
let _acc = 0;
for (const [name, dur] of SCENES) { CUES[name] = _acc; _acc += dur; }
const TOTAL = _acc;

function Shot({ T, from, to, children }) {
  return T >= from && T < to ? children : null;
}

const CAPTION_FADE = 0.18;
function Captions({ T, items, style }) {
  const list = (items || []).slice().sort((a, b) => a.at - b.at);
  let active = null, end = Infinity;
  for (let i = 0; i < list.length; i++) {
    if (T < list[i].at) break;
    active = list[i];
    end = typeof active.until === "number" ? active.until : (i + 1 < list.length ? list[i + 1].at : Infinity);
  }
  if (!active || T >= end) return null;
  let o = Math.min(1, (T - active.at) / CAPTION_FADE);
  if (isFinite(end)) o = Math.min(o, (end - T) / CAPTION_FADE);
  return (
    <div style={{
      position: "absolute", left: "8%", right: "8%", bottom: "7%", textAlign: "center",
      opacity: Math.max(0, Math.min(1, o)), pointerEvents: "none", ...style,
    }}>{active.text}</div>
  );
}

const W = 1600, H = 900;
const CX = W / 2, CY = H / 2;

/* The film shows the Worker behind whichever page it is on — and it is the
   same Worker, delivering to the same team chat, so the quoted source is true
   on both sites. Only the two places that name what is being *built* are
   looked up. */
const SUBJECT = {
  telegram: { heading: 'New Telegram bot request', title: ['A Telegram bot,', 'assembled'] },
  instagram: { heading: 'New Instagram bot request', title: ['An Instagram bot,', 'assembled'] },
};

/* ---- palette (Telegram Native: cool blue, dark IDE) ---- */
const C = {
  page: '#080d13',
  chrome: '#101922',
  win: '#0e1620',
  pane: '#0b1219',
  panel: '#17212b',
  line: 'rgba(140,175,205,0.14)',
  dim: '#5b7488',
  text: '#cfe0ec',
  in: '#182533',
  out: '#2b5278',
  ok: '#4fce7d',
  warn: '#ff8a5c',
};
const TOK = { k: '#59a9f5', s: '#6fd3a0', c: '#4d6a7d', f: '#e8c48a', p: '#8fa8ba', t: '#cfe0ec', n: '#f0a68a' };

/* The film is a fixed dark artifact — a screen recording, effectively — so it
   carries its own palette rather than the site's tokens. It still has to say
   which site it belongs to, so there is one per platform, and the sub-
   components read whichever is in play through context rather than a global. */
const IG_C = {
  page: '#0b070d',
  chrome: '#150e1a',
  win: '#120c17',
  pane: '#0e0912',
  panel: '#181020',
  line: 'rgba(220,170,200,0.14)',
  dim: '#8a7285',
  text: '#f0e3ec',
  in: '#241827',
  out: '#7b1f52',
  ok: '#4fce7d',
  warn: '#ff8a5c',
};
const IG_TOK = { k: '#ff7eb0', s: '#8fe0b8', c: '#6b4f60', f: '#f7c66b', p: '#b79bab', t: '#f0e3ec', n: '#f0a68a' };

const PALETTES = {
  telegram: { C, TOK, caret: '#2ea6ff', avatar: 'linear-gradient(160deg,#2ea6ff,#1c6dbf)' },
  instagram: { C: IG_C, TOK: IG_TOK, caret: '#ff4f8b', avatar: 'linear-gradient(135deg,#fcaf45,#e1306c 48%,#833ab4)' },
};

const PaletteContext = createContext(PALETTES.telegram);
const usePalette = () => useContext(PaletteContext);
const MONO = "'JetBrains Mono', 'SFMono-Regular', Menlo, Consolas, monospace";
const UI = "'Vazirmatn', system-ui, -apple-system, 'Segoe UI', sans-serif";

/* ---- the only three motion helpers ---- */
const MOTION = {
  enter: (start, dur = 0.5) => animate({ from: 0, to: 1, start, end: start + dur, ease: Easing.easeOutCubic }),
  draw: (start, dur = 1) => animate({ from: 0, to: 1, start, end: start + dur, ease: Easing.easeInOutQuart }),
  pop: (start, dur = 0.45) => animate({ from: 0, to: 1, start, end: start + dur, ease: Easing.easeOutBack }),
};

/* ---- real code, condensed from worker/ ---- */
const k = (t) => ['k', t], s = (t) => ['s', t], c = (t) => ['c', t];
const f = (t) => ['f', t], p = (t) => ['p', t], tx = (t) => ['t', t];

const BLOCKS = [
  {
    file: 'worker/index.js', cue: 'Router', note: 'the router',
    lines: [
      [c('// one Worker answers every request')],
      [k('const '), tx('POST_ROUTES'), p(' = {')],
      [s('  "/api/chat/stream"'), p(': '), f('handleChatStream'), p(',')],
      [s('  "/api/extract"'), p(': '), f('handleExtract'), p(',')],
      [s('  "/api/requirements"'), p(': '), f('handleRequirements'), p(',')],
      [p('};')],
      [k('export default '), p('{')],
      [p('  async '), f('fetch'), p('(request, env) {')],
      [k('    const '), tx('handler'), p(' = ROUTES['), tx('url.pathname'), p('];')],
      [k('    if '), p('(handler) '), k('return await '), f('handler'), p('(request, env);')],
      [k('    return '), tx('env.ASSETS'), p('.'), f('fetch'), p('(request);')],
      [p('  },')],
      [p('};')],
    ],
  },
  {
    file: 'worker/ratelimit.js', cue: 'Guard', note: 'the limiter',
    lines: [
      [c('// caps abuse — and the AI spend behind it')],
      [k('export async function '), f('overLimit'), p('(limiter, key) {')],
      [k('  const '), p('{ '), tx('success'), p(' } = '), k('await '), tx('limiter'), p('.'), f('limit'), p('({ key });')],
      [k('  return '), p('!'), tx('success'), p(';')],
      [p('}')],
      [k('if '), p('('), k('await '), f('overLimit'), p('(env.CHAT_LIMIT, '), f('clientKey'), p('(request)))')],
      [k('  return '), f('tooManyRequests'), p('();')],
    ],
  },
  {
    file: 'worker/intake.js', cue: 'Intake', note: 'the prompt',
    lines: [
      [k('export function '), f('chatSystemPrompt'), p('(lang) {')],
      [k('  return '), p('[')],
      [s('    "You are the intake assistant for a studio"'), p(',')],
      [s('    "that builds custom Telegram bots."'), p(',')],
      [s('    "Be warm, concrete and brief."'), p(',')],
      [s('    "Never invent prices or delivery dates."'), p(',')],
      [p('  ].'), f('join'), p('('), s('" "'), p(');')],
      [p('}')],
    ],
  },
  {
    file: 'worker/telegram.js', cue: 'Brief', note: 'the brief',
    lines: [
      [k('export function '), f('buildBriefLines'), p('(submission) {')],
      [k('  const '), tx('lines'), p(' = ['), s('`<b>📨 New Telegram bot request</b>`'), p(', '), s('""'), p('];')],
      [k('  for '), p('('), k('const '), p('[icon, name, fields] '), k('of '), tx('SECTIONS'), p(') {')],
      [p('    lines.'), f('push'), p('('), s('`${icon} <b>${name}</b>`'), p(');')],
      [k('    for '), p('('), k('const '), p('[field, value] '), k('of '), f('rendered'), p(')')],
      [p('      lines.'), f('push'), p('('), s('`• <b>${title(field)}:</b> ${value}`'), p(');')],
      [p('  }')],
      [k('  return '), tx('lines'), p(';')],
      [p('}')],
    ],
  },
  {
    file: 'worker/telegram.js', cue: 'Deliver', note: 'delivery',
    lines: [
      [k('await '), f('fetch'), p('(`${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN}')],
      [p('             /sendMessage`, {')],
      [p('  method: '), s('"POST"'), p(',')],
      [p('  body: '), tx('JSON'), p('.'), f('stringify'), p('({')],
      [p('    chat_id: '), tx('env.TELEGRAM_CHAT_ID'), p(', text,')],
      [p('    parse_mode: '), s('"HTML"'), p(', disable_web_page_preview: '), k('true'), p(',')],
      [p('  }),')],
      [p('});')],
    ],
  },
];

const LINE_H = 26, HEAD_H = 30, GAP = 26;
const blockChars = (b) => b.lines.reduce((a, l) => a + l.reduce((x, [, t]) => x + t.length, 0) + 1, 0);

/* reveal the first n characters of a token block */
function revealed(lines, n) {
  const out = [];
  let left = n;
  for (let i = 0; i < lines.length; i++) {
    const len = lines[i].reduce((a, [, t]) => a + t.length, 0);
    if (left <= 0) break;
    if (left > len) {
      out.push({ toks: lines[i], cursor: false });
      left -= len + 1;
    } else {
      const toks = [];
      let rem = left;
      for (const [cls, t] of lines[i]) {
        if (rem <= 0) break;
        toks.push([cls, t.slice(0, rem)]);
        rem -= t.length;
      }
      out.push({ toks, cursor: true });
      left = 0;
    }
  }
  return out;
}

function CodeBlock({ block, chars, active, blink }) {
  const { C, TOK, caret } = usePalette();
  const rows = revealed(block.lines, chars);
  return (
    <div style={{ opacity: active ? 1 : 0.26, transition: 'none' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, height: HEAD_H,
        font: `500 15px ${MONO}`, color: active ? '#7fb6e6' : C.dim, letterSpacing: '0.02em',
      }}>
        <span style={{ width: 6, height: 6, borderRadius: 6, background: active ? caret : C.dim }}></span>
        {block.file}
        <span style={{ color: C.dim, fontWeight: 400 }}>· {block.note}</span>
      </div>
      <div style={{ font: `400 17px/${LINE_H}px ${MONO}` }}>
        {block.lines.map((_, i) => {
          const row = rows[i];
          return (
            <div key={i} style={{ display: 'flex', height: row ? LINE_H : 0, overflow: 'hidden', whiteSpace: 'pre' }}>
              <span style={{ width: 34, color: 'rgba(120,155,185,0.35)', textAlign: 'right', paddingRight: 14, opacity: row ? 1 : 0 }}>{i + 1}</span>
              <span>
                {row && row.toks.map(([cls, t], j) => (
                  <span key={j} style={{ color: TOK[cls] }}>{t}</span>
                ))}
                {row && row.cursor && blink ? (
                  <span style={{ display: 'inline-block', width: 9, height: 18, background: caret, verticalAlign: '-3px' }}></span>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---- chat panel pieces ---- */
function Bubble({ side, children, o, y, tint, width }) {
  const { C } = usePalette();
  return (
    <div style={{
      display: 'flex', justifyContent: side === 'out' ? 'flex-end' : 'flex-start',
      opacity: o, transform: `translateY(${y}px)`,
    }}>
      <div style={{
        maxWidth: width || 340, background: tint || (side === 'out' ? C.out : C.in),
        color: '#e8f1f8', font: `400 17px/1.45 ${UI}`, padding: '11px 14px',
        borderRadius: side === 'out' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.35)',
      }}>{children}</div>
    </div>
  );
}

const BRIEF_LINES = [
  { icon: '📨', head: 'New Telegram bot request' },
  { icon: '🤖', head: 'The bot' },
  { label: 'Bot name', value: 'BakeryOrderBot' },
  { label: 'What it should do', value: 'Take pastry orders in chat, confirm pickup time, post each order to the staff group.' },
  { label: 'Category', value: 'Orders & payments' },
  { icon: '📐', head: 'Scope' },
  { label: 'Expected users', value: '1,000–10,000' },
  { label: 'Integrations', value: 'Google Sheets, staff group' },
  { icon: '📇', head: 'Contact' },
  { label: 'Telegram', value: '@example_customer' },
];

function ChatPanel({ T, CUES, subject, platform }) {
  const { C, avatar } = usePalette();
  const bi = MOTION.enter(CUES.Intake + 0.35, 0.5)(T);
  const typing = T > CUES.Intake + 1.15 && T < CUES.Intake + 2.0;
  const bo = MOTION.enter(CUES.Intake + 2.0, 0.5)(T);
  const dot = (i) => 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(T * 9 - i * 1.1));
  const cardO = MOTION.enter(CUES.Brief + 0.2, 0.5)(T);
  const delivered = MOTION.pop(CUES.Deliver + 0.45, 0.5)(T);
  const stampO = MOTION.enter(CUES.Deliver + 0.9, 0.5)(T);

  /* panel scrolls as content grows */
  const scroll = interpolate(
    [CUES.Intake, CUES.Brief - 0.2, CUES.Brief + 1.6, CUES.Deliver + 0.6],
    [0, 0, -110, -190],
    Easing.easeInOutCubic
  )(T);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: C.panel }}>
      <div style={{
        height: 56, display: 'flex', alignItems: 'center', gap: 12, padding: '0 18px',
        borderBottom: `1px solid ${C.line}`, background: 'rgba(12,20,28,0.7)',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: platform === 'instagram' ? 10 : 32, background: avatar,
          display: 'grid', placeItems: 'center', font: `600 15px ${UI}`, color: '#fff',
        }}>
          <svg width="17" height="17" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <path d="M6 4h20a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4H15l-6 5v-5H6a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4Z" fill="#fff" />
            <circle cx="10.5" cy="14" r="1.8" fill="#1c6dbf" />
            <circle cx="16" cy="14" r="1.8" fill="#1c6dbf" />
            <circle cx="21.5" cy="14" r="1.8" fill="#1c6dbf" />
          </svg>
        </div>
        <div>
          <div style={{ font: `600 16px ${UI}`, color: '#e8f1f8' }}>Your team&rsquo;s chat</div>
          <div style={{ font: `400 13px ${UI}`, color: C.dim }}>web intake → team group</div>
        </div>
      </div>

      <div style={{ position: 'absolute', left: 0, right: 0, top: 56, bottom: 0, overflow: 'hidden' }}>
        <div style={{ padding: '18px 18px 0', display: 'flex', flexDirection: 'column', gap: 12, transform: `translateY(${scroll}px)` }}>
          <div style={{ font: `500 13px ${UI}`, color: C.dim, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: bi }}>visitor · web chat</div>
          <Bubble side="in" o={bi} y={(1 - bi) * 14}>
            I need a bot that takes pastry orders and posts them to our staff group.
          </Bubble>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', height: typing ? 22 : 0, opacity: typing ? 1 : 0, paddingLeft: 6 }}>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ width: 8, height: 8, borderRadius: 8, background: '#7fb6e6', opacity: dot(i) }}></span>
            ))}
          </div>
          <Bubble side="out" o={bo} y={(1 - bo) * 14}>
            Order intake with a staff-group feed — noted. A short brief is opening below your reply.
          </Bubble>

          {/* the brief message, assembled line by line */}
          <div style={{ opacity: cardO, transform: `translateY(${(1 - cardO) * 16}px)`, marginTop: 8 }}>
            <div style={{
              background: C.out, borderRadius: '14px 14px 4px 14px', padding: '13px 15px 10px',
              boxShadow: '0 6px 22px rgba(0,0,0,0.4)', border: '1px solid rgba(120,180,240,0.18)',
            }}>
              {BRIEF_LINES.map((row, i) => {
                const at = CUES.Brief + 0.55 + i * 0.2;
                const o = MOTION.enter(at, 0.32)(T);
                const head = row.head ? subject.heading : null;
                if (row.head) {
                  return (
                    <div key={i} style={{
                      font: `700 ${i === 0 ? 17 : 15}px ${UI}`, color: '#fff', opacity: o,
                      marginTop: i === 0 ? 0 : 9, marginBottom: 3, transform: `translateX(${(1 - o) * -8}px)`,
                    }}>{row.icon} {head}</div>
                  );
                }
                return (
                  <div key={i} style={{
                    font: `400 14px/1.4 ${UI}`, color: 'rgba(232,241,248,0.92)', opacity: o,
                    transform: `translateX(${(1 - o) * -8}px)`, marginBottom: 2,
                  }}>
                    <span style={{ fontWeight: 700 }}>• {row.label}:</span> {row.value}
                  </div>
                );
              })}
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <span style={{ font: `500 12px ${MONO}`, color: 'rgba(200,225,245,0.6)', opacity: stampO }}>REQ-4F2A9C</span>
                <span style={{ font: `400 12px ${UI}`, color: 'rgba(200,225,245,0.6)' }}>14:06</span>
                <span style={{ color: C.ok, font: `600 15px ${UI}`, opacity: delivered, transform: `scale(${0.6 + 0.4 * delivered})` }}>✓✓</span>
              </div>
            </div>
          </div>

          <div style={{
            alignSelf: 'center', marginTop: 6, opacity: stampO,
            font: `500 13px ${MONO}`, color: C.ok, background: 'rgba(79,206,125,0.12)',
            border: '1px solid rgba(79,206,125,0.3)', borderRadius: 20, padding: '5px 12px',
          }}>sendMessage · 200 OK · 41 ms</div>
        </div>
      </div>
    </div>
  );
}

/* ---- request lane: packets entering the Worker ---- */
function RequestLane({ T, CUES }) {
  const { C } = usePalette();
  const packets = [
    { at: CUES.Router + 0.5, label: 'POST /api/requirements', kind: 'ok', dur: 1.5 },
    { at: CUES.Guard + 0.15, label: 'POST /api/chat/stream', kind: 'ok', dur: 1.0 },
    { at: CUES.Guard + 0.6, label: 'POST /api/chat/stream', kind: 'ok', dur: 1.0 },
    { at: CUES.Guard + 1.35, label: 'POST /api/chat/stream ×40', kind: 'blocked', dur: 1.3 },
  ];
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, top: 0, height: 38, overflow: 'hidden',
      background: 'rgba(8,14,20,0.94)', borderBottom: '1px solid rgba(140,175,205,0.14)',
    }}>
      {packets.map((pk, i) => {
        const t = MOTION.draw(pk.at, pk.dur)(T);
        if (t <= 0 || t >= 1) return null;
        const stop = pk.kind === 'blocked' ? 0.52 : 1;
        const prog = Math.min(t / stop, 1);
        const blocked = pk.kind === 'blocked' && t > stop;
        return (
          <div key={i} style={{
            position: 'absolute', top: 7, left: `${-24 + prog * 96}%`,
            display: 'flex', alignItems: 'center', gap: 8,
            font: `500 13px ${MONO}`, color: blocked ? C.warn : '#8fd0ff',
            background: blocked ? 'rgba(255,138,92,0.14)' : 'rgba(46,166,255,0.12)',
            border: `1px solid ${blocked ? 'rgba(255,138,92,0.45)' : 'rgba(46,166,255,0.35)'}`,
            borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap',
            opacity: blocked ? 1 : 0.9,
            transform: blocked ? 'translateX(0)' : 'none',
          }}>
            {pk.label}
            {blocked ? <span style={{ color: C.warn, fontWeight: 700 }}>429</span> : null}
          </div>
        );
      })}
    </div>
  );
}

const TREE = [
  { name: 'index.js', cue: 'Router' },
  { name: 'ratelimit.js', cue: 'Guard' },
  { name: 'intake.js', cue: 'Intake' },
  { name: 'telegram.js', cue: 'Brief' },
  { name: 'auth.js' },
  { name: 'oidc.js' },
  { name: 'session.js' },
];

function Piece({ T, accent, captions, subject, platform }) {
  const { C } = usePalette();
  const total = TOTAL;

  const cueOf = (name) => CUES[name];
  const activeIndex = BLOCKS.reduce((best, b, i) => (T >= cueOf(b.cue) - 0.2 ? i : best), -1);

  /* the code column behaves like a real editor: blocks grow as they type and
     the view only scrolls as far as it must to keep the active block in frame */
  const charsOf = (b) => Math.round(MOTION.draw(cueOf(b.cue) + 0.25, b.cue === 'Router' ? 2.9 : b.cue === 'Deliver' ? 1.8 : 2.2)(T) * blockChars(b));
  const heights = BLOCKS.map((b) => HEAD_H + revealed(b.lines, charsOf(b)).length * LINE_H + GAP);
  const tops = [];
  let acc = 0;
  for (const h of heights) { tops.push(acc); acc += h; }
  const PANE_H = 676;
  const bottomActive = activeIndex < 0 ? 0 : tops[activeIndex] + heights[activeIndex];
  const columnY = Math.min(44, PANE_H - 78 - bottomActive);

  /* camera: [scale, focus x, focus y] keyed to cues */
  const keys = [0, 1.2, CUES.Router + 0.2, CUES.Guard + 0.3, CUES.Intake + 0.3, CUES.Brief + 0.3, CUES.Deliver + 0.3, total - 0.5];
  const scale = interpolate(keys, [1.02, 1.05, 1.22, 1.26, 1.02, 1.12, 1.1, 1.0], Easing.easeInOutCubic)(T);
  const fx = interpolate(keys, [CX, CX, 660, 660, CX, 1060, 1080, CX], Easing.easeInOutCubic)(T);
  const fy = interpolate(keys, [CY, CY, 380, 440, CY, 430, 470, CY], Easing.easeInOutCubic)(T);
  const drift = Math.sin(T * 0.42) * 5;

  const laneShift = 44 * Math.min(MOTION.enter(CUES.Router - 0.5, 0.4)(T), 1 - MOTION.enter(CUES.Intake - 0.4, 0.4)(T));
  const contentO = Math.min(MOTION.enter(0.15, 0.6)(T), 1 - MOTION.enter(total - 0.6, 0.55)(T));
  const titleO = Math.max(1 - MOTION.enter(0.55, 0.5)(T), MOTION.enter(total - 0.7, 0.6)(T));
  const blink = Math.floor(T * 2.2) % 2 === 0;

  return (
    <div style={{ position: 'absolute', inset: 0, background: C.page, overflow: 'hidden', fontFamily: UI }}>
      <div style={{
        position: 'absolute', inset: '-10%',
        background: `radial-gradient(58% 48% at 50% 34%, rgba(46,166,255,0.13), transparent 70%)`,
      }}></div>

      {/* camera rig */}
      <div style={{
        position: 'absolute', inset: 0, transformOrigin: `${CX}px ${CY}px`, opacity: contentO,
        transform: `translate(${(CX - fx) * scale + drift}px, ${(CY - fy) * scale}px) scale(${scale})`,
      }}>
        {/* app window */}
        <div style={{
          position: 'absolute', left: 100, top: 90, width: 1400, height: 720,
          background: C.win, borderRadius: 16, overflow: 'hidden',
          border: `1px solid ${C.line}`, boxShadow: '0 40px 120px rgba(0,0,0,0.6)',
        }}>
          <div style={{
            height: 44, display: 'flex', alignItems: 'center', gap: 14, padding: '0 16px',
            background: C.chrome, borderBottom: `1px solid ${C.line}`,
          }}>
            <div style={{ display: 'flex', gap: 7 }}>
              {['#3d4b58', '#3d4b58', '#3d4b58'].map((col, i) => (
                <span key={i} style={{ width: 11, height: 11, borderRadius: 11, background: col }}></span>
              ))}
            </div>
            <div style={{ font: `500 14px ${MONO}`, color: C.dim }}>arashatt/telegram — worker · Cloudflare Worker</div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, font: `500 13px ${MONO}`, color: accent }}>
              <span style={{ width: 7, height: 7, borderRadius: 7, background: accent }}></span>
              wrangler deploy
            </div>
          </div>

          <div style={{ position: 'absolute', left: 0, right: 0, top: 44, bottom: 0, display: 'flex' }}>
            {/* file tree */}
            <div style={{ width: 200, borderRight: `1px solid ${C.line}`, padding: '16px 0', background: C.pane }}>
              <div style={{ font: `600 12px ${MONO}`, color: C.dim, letterSpacing: '0.1em', padding: '0 16px 10px' }}>WORKER/</div>
              {TREE.map((item, i) => {
                const born = item.cue ? MOTION.enter(cueOf(item.cue) - 0.35, 0.4)(T) : MOTION.enter(0.7 + i * 0.08, 0.4)(T);
                const isActive = item.cue && activeIndex >= 0 && BLOCKS[activeIndex].cue === item.cue;
                return (
                  <div key={item.name} style={{
                    display: 'flex', alignItems: 'center', gap: 9, padding: '6px 16px',
                    font: `400 15px ${MONO}`, opacity: item.cue ? 0.35 + 0.65 * born : 0.3 * born,
                    color: isActive ? '#e8f1f8' : C.dim,
                    background: isActive ? 'rgba(46,166,255,0.12)' : 'transparent',
                    borderLeft: `2px solid ${isActive ? accent : 'transparent'}`,
                  }}>
                    <span style={{ color: isActive ? accent : 'rgba(120,155,185,0.4)' }}>JS</span>
                    {item.name}
                  </div>
                );
              })}
            </div>

            {/* code pane */}
            <div style={{ width: 700, position: 'relative', overflow: 'hidden', background: C.pane }}>
              <div style={{ position: 'absolute', inset: 0, paddingLeft: 22 }}>
                <div style={{ transform: `translateY(${columnY + laneShift}px)` }}>
                  {BLOCKS.map((b, i) => (
                    <div key={i} style={{ marginBottom: GAP }}>
                      <CodeBlock
                        block={b}
                        chars={charsOf(b)}
                        active={i === activeIndex}
                        blink={blink && i === activeIndex}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div style={{
                position: 'absolute', left: 0, right: 0, top: 0, height: 90,
                background: `linear-gradient(${C.pane}, transparent)`, pointerEvents: 'none',
              }}></div>
              <div style={{
                position: 'absolute', left: 0, right: 0, bottom: 0, height: 120,
                background: `linear-gradient(transparent, ${C.pane})`, pointerEvents: 'none',
              }}></div>
              <Shot T={T} from={CUES.Router - 0.2} to={CUES.Intake}>
                <RequestLane T={T} CUES={CUES} />
              </Shot>
            </div>

            {/* chat panel */}
            <div style={{ flex: 1, position: 'relative', borderLeft: `1px solid ${C.line}` }}>
              <ChatPanel T={T} CUES={CUES} subject={subject} platform={platform} />
            </div>
          </div>
        </div>
      </div>

      {/* opening / closing title — also the loop seam */}
      <div style={{
        position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
        opacity: titleO, pointerEvents: 'none',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ font: `500 20px ${MONO}`, color: accent, letterSpacing: '0.24em', marginBottom: 18 }}>WORKER/</div>
          <div style={{ font: `600 62px/1.1 ${UI}`, color: '#eaf3fa', letterSpacing: '-0.02em' }}>
            {subject.title[0]}<br />{subject.title[1]}
          </div>
          <div style={{ font: `400 22px ${UI}`, color: C.dim, marginTop: 18 }}>seven files · one request · one brief</div>
        </div>
      </div>

      {captions ? (
        <Captions
          T={T}
          style={{ font: `500 27px ${UI}`, color: '#eaf3fa', bottom: '5.5%' }}
          items={[
            { at: 1.05, until: 2.2, text: 'One file at a time — this is how the bot gets built.' },
            { at: CUES.Router + 0.45, until: CUES.Guard - 0.2, text: 'Every request enters through one router.' },
            { at: CUES.Guard + 0.4, until: CUES.Intake - 0.2, text: 'A per-IP limiter caps the abuse — and the AI bill.' },
            { at: CUES.Intake + 0.4, until: CUES.Brief - 0.2, text: 'The model reads the visitor’s ask in their own words.' },
            { at: CUES.Brief + 0.4, until: CUES.Deliver - 0.2, text: 'Their answers become a formatted brief.' },
            { at: CUES.Deliver + 0.4, until: total - 0.8, text: 'sendMessage — and it lands in your team chat.' },
          ]}
        />
      ) : null}
    </div>
  );
}


/* ---- the component you mount ---- */
/* Reduced motion holds one finished frame rather than animating. Decided at
   mount because it is a starting value, not something to react to. */
const prefersStill = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function CodeFilm({
  // Follows the site accent rather than carrying a third blue of its own.
  accent = "var(--tg-blue)",
  captions = true,
  className = "",
  paused = false,
  pauseOffscreen = false,
}) {
  const { platform } = useI18n();
  const subject = SUBJECT[platform] ?? SUBJECT.telegram;
  const palette = PALETTES[platform] ?? PALETTES.telegram;
  const [stillFrame] = useState(prefersStill);
  const [T, setT] = useState(() => (prefersStill() ? CUES.Deliver + 1.7 : 0));
  const [scale, setScale] = useState(1);
  const box = useRef(null);
  const visible = useRef(true);

  /* scale the 1600x900 stage to whatever width it is given */
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setScale(el.clientWidth / W);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* pause while the tab is in the background; optionally also when scrolled away.
     (IntersectionObserver is opt-in: inside some embedded/hidden iframes it
     reports "not intersecting" for a perfectly visible element, which would
     freeze the film.) */
  useEffect(() => {
    const onVis = () => { visible.current = document.visibilityState === "visible"; };
    document.addEventListener("visibilitychange", onVis);
    onVis();
    if (!pauseOffscreen || !box.current) return () => document.removeEventListener("visibilitychange", onVis);
    const io = new IntersectionObserver(([e]) => { visible.current = e.isIntersecting; }, { threshold: 0.1 });
    io.observe(box.current);
    return () => { io.disconnect(); document.removeEventListener("visibilitychange", onVis); };
  }, [pauseOffscreen]);

  useEffect(() => {
    if (paused || stillFrame) return;
    let raf = 0, last = performance.now(), t = 0;
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (visible.current) { t = (t + dt) % TOTAL; setT(t); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused, stillFrame]);

  return (
    <div ref={box} className={"code-film " + className}>
      <div className="code-film__stage" style={{ width: W, height: H, transform: "scale(" + scale + ")" }}>
        <PaletteContext.Provider value={palette}>
          <Piece T={T} accent={accent} captions={captions} subject={subject} platform={platform} />
        </PaletteContext.Provider>
      </div>
    </div>
  );
}
