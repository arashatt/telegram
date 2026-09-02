import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BubbleMark, CheckIcon, PlaneGlyph } from './Icons'
import './BookingDemo.css'

const SIZES = ['2', '3', '4', '5+']
const TIMES = ['18:30', '19:00', '19:30', '20:15']

const BEATS = {
  greetFirst: 450,
  greetSecond: 1250,
  greetToKeys: 1900,
  sizeFlash: 2100,
  sizeAuto: 2500,
  timeFlash: 2300,
  timeAuto: 2700,
  typingIn: 300,
  sizeReply: 1150,
  sizeToTime: 1600,
  confirmCard: 1250,
  confirmToHold: 1500,
  reminderIn: 1300,
  holdThenLoop: 4600,
}

const GREETING = [
  { id: 'g1', from: 'bot', text: 'Evening. I can hold a table for you tonight.', time: '20:12' },
  { id: 'g2', from: 'bot', text: 'How many of you are coming?', time: '20:12' },
]

/** "Maro & Olive Kitchen" -> "MO". Strips words with no letters or digits so
 *  ampersands and dashes never leak into the booking reference. */
function initialsOf(venue) {
  const letters = String(venue || '')
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean)
  return letters.slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'BK'
}

function guestLabel(size) {
  if (!size) return '4 guests'
  return size === '5+' ? '5 or more' : `${size} guests`
}

const IDLE = { msgs: [], typing: false, keys: null, size: null, time: null, flash: null, reminder: false }

/* The stages the machine can be re-entered at. `sizePicked` and `timePicked`
   are transitions, not states: they schedule the next stage and have no branch
   of their own, so a card that scrolled away mid-pick must come back to a
   clean run of the loop rather than to a machine with nothing to do. */
const RESUMABLE = new Set(['greet', 'askSize', 'askTime', 'confirmed'])

export default function BookingDemo({
  venue = 'Anar Kitchen',
  frameStyle = 'realistic',
  autoplay = true,
  loopSpeed = 1,
  showReminder = true,
}) {
  const reduced = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  )
  const idle = reduced || !autoplay

  /* Reduced motion, or autoplay off: no loop, but the keyboard still works —
     the visitor drives the flow instead of watching it. That is a starting
     value, not a correction, so it is decided here rather than in an effect. */
  const [view, setView] = useState(() =>
    idle
      ? { ...IDLE, ref: 'AK-1930', msgs: GREETING, keys: 'size' }
      : { ...IDLE, ref: 'AK-1930' }
  )

  const phoneRef = useRef(null)
  const timers = useRef([])
  const stage = useRef(idle ? 'askSize' : null)
  const inView = useRef(false)
  const machine = useRef(null)

  const clear = useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }, [])

  const after = useCallback(
    (ms, fn) => {
      const speed = Number(loopSpeed) || 1
      timers.current.push(setTimeout(fn, ms / speed))
    },
    [loopSpeed]
  )

  const push = useCallback((from, text, time) => {
    setView((v) => ({
      ...v,
      msgs: [...v.msgs, { id: `${from}${v.msgs.length}-${Date.now()}`, from, text, time }],
    }))
  }, [])

  /* A state machine rather than a flat beat list: a visitor tapping a button
     enters the next stage early, so their pick runs the real branch instead of
     being overwritten by the script still playing underneath. */
  const enter = useCallback(
    (next) => {
      clear()
      stage.current = next
      if (!inView.current) return
      const m = machine.current

      if (next === 'greet') {
        setView((v) => ({ ...v, ...IDLE }))
        after(BEATS.greetFirst, () => push('bot', GREETING[0].text, GREETING[0].time))
        after(BEATS.greetSecond, () => push('bot', GREETING[1].text, GREETING[1].time))
        after(BEATS.greetToKeys, () => m.enter('askSize'))
        return
      }

      /* The auto-pick beats are the demo playing itself, so they are skipped
         when idle: the keyboard is still offered and still answers a tap, but
         nothing chooses for the visitor and nothing restarts behind them. */
      if (next === 'askSize') {
        setView((v) => ({ ...v, keys: 'size', flash: null }))
        if (idle) return
        after(BEATS.sizeFlash, () => setView((v) => ({ ...v, flash: '4' })))
        after(BEATS.sizeAuto, () => m.pickSize('4'))
        return
      }

      if (next === 'askTime') {
        setView((v) => ({ ...v, keys: 'time', flash: null }))
        if (idle) return
        after(BEATS.timeFlash, () => setView((v) => ({ ...v, flash: '19:30' })))
        after(BEATS.timeAuto, () => m.pickTime('19:30'))
        return
      }

      if (next === 'confirmed') {
        after(BEATS.reminderIn, () => setView((v) => ({ ...v, reminder: true })))
        if (!idle) after(BEATS.holdThenLoop, () => m.enter('greet'))
      }
    },
    [after, clear, idle, push]
  )

  const pickSize = useCallback(
    (value) => {
      clear()
      stage.current = 'sizePicked'
      setView((v) => ({ ...v, keys: null, flash: null, size: value }))
      push('user', value === '5+' ? '5 or more' : value, '20:13')
      after(BEATS.typingIn, () => setView((v) => ({ ...v, typing: true })))
      after(BEATS.sizeReply, () => {
        setView((v) => ({ ...v, typing: false }))
        const who = value === '5+' ? 'a larger group' : `${value} guests`
        push('bot', `Tonight, for ${who}. These times are still free:`, '20:13')
      })
      after(BEATS.sizeToTime, () => machine.current.enter('askTime'))
    },
    [after, clear, push]
  )

  const pickTime = useCallback(
    (value) => {
      clear()
      stage.current = 'timePicked'
      setView((v) => ({ ...v, keys: null, flash: null, time: value, ref: `${initialsOf(venue)}-${value.replace(':', '')}` }))
      push('user', value, '20:14')
      after(BEATS.typingIn, () => setView((v) => ({ ...v, typing: true })))
      after(BEATS.confirmCard, () => {
        setView((v) => ({
          ...v,
          typing: false,
          msgs: [...v.msgs, { id: `c${Date.now()}`, from: 'bot', confirm: true }],
        }))
      })
      after(BEATS.confirmToHold, () => machine.current.enter('confirmed'))
    },
    [after, clear, push, venue]
  )

  /* Declared before the observer effect so it is assigned first on mount; no
     dependency array so the observer always reaches the latest callbacks
     without having to resubscribe. */
  useEffect(() => {
    machine.current = { enter, pickSize, pickTime }
  })

  useEffect(() => {
    const node = phoneRef.current
    if (idle || !node || typeof IntersectionObserver === 'undefined') {
      inView.current = true
      if (!idle) machine.current.enter('greet')
      return () => clear()
    }
    // The loop starts from the first observer callback, never from mount, so a
    // card below the fold is not a half-played sequence by the time it is seen.
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((e) => e.isIntersecting)
        if (visible === inView.current) return
        inView.current = visible
        if (!visible) clear()
        else if (!idle)
          machine.current.enter(RESUMABLE.has(stage.current) ? stage.current : 'greet')
      },
      { threshold: 0.2 }
    )
    io.observe(node)
    return () => {
      io.disconnect()
      clear()
    }
  }, [clear, idle])

  const labels = view.keys === 'size' ? SIZES : view.keys === 'time' ? TIMES : []
  const guests = guestLabel(view.size)
  const when = view.time || '19:30'

  return (
    <div className="bkd">
      <div className="bkd__head">
        <span className="bkd__title" dir="auto">Table booking, in chat</span>
        <span className="bkd__badge">live demo</span>
      </div>

      <div className="bkd__body">
        <div className="bkd__phonewrap">
          <div ref={phoneRef} className={`bkd__phone bkd__phone--${frameStyle}`}>
            <div className="bkd__screen">
              <div className="bkd__chathead">
                <span className="bkd__avatar">
                  <BubbleMark />
                </span>
                <span className="bkd__who">
                  <span className="bkd__name" dir="auto">{venue}</span>
                  <span className="bkd__sub">bot</span>
                </span>
              </div>

              {showReminder && view.reminder && (
                <div className="bkd__toast">
                  <span className="bkd__toasticon">
                    <CheckIcon />
                  </span>
                  <span className="bkd__toasttext">
                    <span className="bkd__toasttitle">Reminder set</span>
                    <span className="bkd__toastline" dir="auto">{`${venue} · ${when} · ${guests}`}</span>
                  </span>
                </div>
              )}

              <div className="bkd__stream">
                {view.msgs.map((m) =>
                  m.confirm ? (
                    <div key={m.id} className="bkd__row bkd__row--in">
                      <div className="bkd__confirm">
                        <div className="bkd__confirmhead">
                          <span className="bkd__tick">
                            <CheckIcon />
                          </span>
                          <span>Table confirmed</span>
                        </div>
                        <dl className="bkd__facts">
                          <dt>Where</dt>
                          <dd dir="auto">{venue}</dd>
                          <dt>When</dt>
                          <dd dir="auto">{`Tonight, ${when}`}</dd>
                          <dt>Guests</dt>
                          <dd dir="auto">{guests}</dd>
                          <dt>Code</dt>
                          <dd className="bkd__code" dir="auto">{view.ref}</dd>
                        </dl>
                      </div>
                    </div>
                  ) : (
                    <div key={m.id} className={`bkd__row bkd__row--${m.from === 'user' ? 'out' : 'in'}`}>
                      <div className="bkd__bubble" dir="auto">
                        <span>{m.text}</span>
                        <span className="bkd__time">{m.time}</span>
                      </div>
                    </div>
                  )
                )}

                {view.typing && (
                  <div className="bkd__row bkd__row--in">
                    <div className="bkd__typing" role="status" aria-label="Bot is typing">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                )}
              </div>

              <div className="bkd__foot">
                {labels.length > 0 ? (
                  <div className={`bkd__keys bkd__keys--${view.keys}`}>
                    {labels.map((label) => (
                      <button
                        key={label}
                        type="button"
                        className={`bkd__key${view.flash === label ? ' is-hot' : ''}`}
                        onClick={() => (view.keys === 'size' ? pickSize(label) : pickTime(label))}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="bkd__composer" aria-hidden="true">
                    <span className="bkd__field">Message</span>
                    <span className="bkd__send">
                      <PlaneGlyph />
                    </span>
                  </div>
                )}
              </div>
            </div>
            <span className="bkd__notch" aria-hidden="true" />
          </div>
        </div>

        <div className="bkd__copy">
          <ul className="bkd__points">
            <li>
              <span className="bkd__point">
                <CheckIcon />
              </span>
              <span dir="auto">
                Party size and time come from tapped buttons — nothing to mistype, nothing to parse.
              </span>
            </li>
            <li>
              <span className="bkd__point">
                <CheckIcon />
              </span>
              <span dir="auto">
                The keyboard is built from your live table availability, so a double booking cannot be
                offered.
              </span>
            </li>
            <li>
              <span className="bkd__point">
                <CheckIcon />
              </span>
              <span dir="auto">
                The guest keeps a confirmation with a reference code, and a reminder before the table is
                held.
              </span>
            </li>
          </ul>
          <div className="bkd__cta">
            <button type="button" className="pill pill--provider">
              <PlaneGlyph />
              Brief this bot
            </button>
            <button type="button" className="bkd__dismiss">
              Not what I meant
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
