import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../i18n.js'
import { BubbleMark, CheckIcon, CommentGlyph, HeartGlyph, PlaneGlyph } from './Icons.jsx'
import './CommentToDmDemo.css'

/* The dictionary holds plain strings, so the few lines with a value in them
   carry a {placeholder} the caller fills. Same helper as BookingDemo. */
const fill = (text, vars) =>
  Object.entries(vars).reduce((out, [key, value]) => out.replaceAll(`{${key}}`, value), text)

const BRANCH_KEYS = ['list', 'ship', 'human']

/* Three real branches. The quick reply the visitor taps decides the bot's next
   line AND what the lead card records as the intent — the pick is not cosmetic,
   which is the difference between a demo and a video of one. */
const branchesFor = (t) => ({
  list: { label: t('igDemoChipList'), reply: t('igDemoReplyList'), intent: t('igDemoIntentList') },
  ship: { label: t('igDemoChipShip'), reply: t('igDemoReplyShip'), intent: t('igDemoIntentShip') },
  human: { label: t('igDemoChipHuman'), reply: t('igDemoReplyHuman'), intent: t('igDemoIntentHuman') },
})

const seedFor = (t) => [
  { id: 's1', who: t('igDemoSeed1Who'), text: t('igDemoSeed1Text'), mark: 'P' },
  { id: 's2', who: t('igDemoSeed2Who'), text: t('igDemoSeed2Text'), mark: 'D' },
]

const BEATS = {
  sheetUp: 1100,
  sheetToComments: 1600,
  chipFlash: 2000,
  chipAuto: 2600,
  threadTyping: 700,
  publicReply: 1900,
  slide: 3000,
  dmArrive: 700,
  chipsIn: 1500,
  branchFlash: 3100,
  branchAuto: 3700,
  dmTypingIn: 320,
  branchReply: 1250,
  leadIn: 2400,
  holdThenLoop: 6200,
}

/* Stages the loop can resume at after being scrolled away from. The two pick
   transitions are excluded on purpose: they schedule the next stage and own no
   branch of their own, so resuming at one would leave a machine with nothing
   to do and a phone frozen mid-funnel. */
const RESUMABLE = new Set(['post', 'comments', 'dm', 'captured'])

const IDLE = {
  surface: 'post',
  sheet: false,
  extra: [],
  threadTyping: false,
  dmMsgs: [],
  dmTyping: false,
  chips: false,
  flash: null,
  lead: null,
  likes: 1204,
}

export default function CommentToDmDemo({
  account,
  keyword,
  commenter,
  /* A real square product shot when there is one. Without it the slot draws an
     abstract tile rather than claiming to be a photograph. */
  image,
  frameStyle = 'realistic',
  autoplay = true,
  loopSpeed = 1,
}) {
  const { t, lang } = useI18n()

  /* The page can change language under the demo. The scripted lines are
     rebuilt when it does — the loop restarts from the post anyway. */
  const branches = useMemo(() => branchesFor(t), [t])
  const seed = useMemo(() => seedFor(t), [t])

  const handle = account || t('igDemoAccount')
  const who = commenter || t('igDemoCommenter')
  const word = String(keyword || t('igDemoKeyword')).toUpperCase()

  const reduced = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  )
  const idle = reduced || !autoplay

  /* Reduced motion, or autoplay off: nothing plays, but both taps still work —
     the visitor drives the funnel instead of watching it. A starting value,
     not a correction, so it is decided here rather than in an effect. */
  const [view, setView] = useState(() => (idle ? { ...IDLE, sheet: true } : { ...IDLE }))

  const phoneRef = useRef(null)
  const timers = useRef([])
  const stage = useRef(idle ? 'comments' : null)
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

  const pushDm = useCallback((from, text) => {
    setView((v) => ({
      ...v,
      dmMsgs: [...v.dmMsgs, { id: `${from}${v.dmMsgs.length}-${Date.now()}`, from, text }],
    }))
  }, [])

  const enter = useCallback(
    (next) => {
      clear()
      stage.current = next
      if (!inView.current) return
      const m = machine.current

      if (next === 'post') {
        setView({ ...IDLE })
        after(BEATS.sheetUp, () => setView((v) => ({ ...v, sheet: true })))
        after(BEATS.sheetToComments, () => m.enter('comments'))
        return
      }

      /* The auto-pick beats are the demo playing itself, so they are skipped
         when idle: the chip is still offered and still answers a tap, but
         nothing chooses for the visitor and nothing restarts behind them. */
      if (next === 'comments') {
        setView((v) => ({ ...v, sheet: true, flash: null }))
        if (idle) return
        after(BEATS.chipFlash, () => setView((v) => ({ ...v, flash: 'keyword' })))
        after(BEATS.chipAuto, () => m.postComment())
        return
      }

      if (next === 'dm') {
        setView((v) => ({ ...v, surface: 'dm' }))
        after(BEATS.dmArrive, () => pushDm('bot', t('igDemoDmGreeting')))
        after(BEATS.chipsIn, () => setView((v) => ({ ...v, chips: true })))
        if (idle) return
        after(BEATS.branchFlash, () => setView((v) => ({ ...v, flash: 'list' })))
        after(BEATS.branchAuto, () => m.pickChip('list'))
        return
      }

      if (next === 'captured') {
        if (!idle) after(BEATS.holdThenLoop, () => m.enter('post'))
      }
    },
    [after, clear, idle, pushDm, t]
  )

  /* The visitor tapping the keyword chip enters the funnel early — the same
     branch the script would have run, just without the wait. */
  const postComment = useCallback(() => {
    clear()
    stage.current = 'commentPosted'
    setView((v) => ({
      ...v,
      flash: null,
      likes: v.likes + 1,
      extra: [{ id: 'me', who, text: word, mark: who.replace(/^@/, '').charAt(0).toUpperCase(), isMine: true }],
    }))
    after(BEATS.threadTyping, () => setView((v) => ({ ...v, threadTyping: true })))
    after(BEATS.publicReply, () => {
      setView((v) => ({
        ...v,
        threadTyping: false,
        extra: [
          ...v.extra,
          {
            id: 'bot',
            who: handle,
            text: t('igDemoPublicReply'),
            mark: handle.replace(/^@/, '').charAt(0).toUpperCase(),
            isBot: true,
          },
        ],
      }))
    })
    after(BEATS.slide, () => machine.current.enter('dm'))
  }, [after, clear, handle, t, who, word])

  const pickChip = useCallback(
    (key) => {
      clear()
      stage.current = 'chipPicked'
      const branch = branches[key]
      setView((v) => ({ ...v, chips: false, flash: null }))
      pushDm('user', branch.label)
      after(BEATS.dmTypingIn, () => setView((v) => ({ ...v, dmTyping: true })))
      after(BEATS.branchReply, () => {
        setView((v) => ({ ...v, dmTyping: false }))
        pushDm('bot', branch.reply)
      })
      after(BEATS.leadIn, () => {
        setView((v) => ({
          ...v,
          lead: branch.intent,
          dmMsgs: [...v.dmMsgs, { id: `lead${Date.now()}`, from: 'bot', lead: true }],
        }))
        machine.current.enter('captured')
      })
    },
    [after, branches, clear, pushDm]
  )

  /* Declared before the observer effect so it is assigned first on mount; no
     dependency array so the observer always reaches the latest callbacks
     without having to resubscribe. */
  useEffect(() => {
    machine.current = { enter, postComment, pickChip }
  })

  useEffect(() => {
    /* The loop starts here, not from the observer's first callback. Gating the
       first run on that callback leaves the demo dead wherever the initial
       entry never reports as intersecting; the observer's job is only to pause
       and resume something already running. If the card really is below the
       fold, the first callback arrives within a frame and clears it long
       before the 1100ms opening beat renders anything. */
    inView.current = true
    if (!idle) machine.current.enter('post')

    const node = phoneRef.current
    if (idle || !node || typeof IntersectionObserver === 'undefined') {
      return () => clear()
    }
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((e) => e.isIntersecting)
        if (visible === inView.current) return
        inView.current = visible
        if (!visible) clear()
        else machine.current.enter(RESUMABLE.has(stage.current) ? stage.current : 'post')
      },
      { threshold: 0.2 }
    )
    io.observe(node)
    return () => {
      io.disconnect()
      clear()
    }
  }, [clear, idle])

  const onPost = view.surface === 'post'
  const comments = [...seed, ...view.extra]
  const bare = handle.replace(/^@/, '')

  return (
    <div className="ctd">
      <div className="ctd__head">
        <span className="ctd__title" dir="auto">{t('demoHeading')}</span>
        <span className="ctd__stages" aria-hidden="true">
          <span className={`ctd__stage${onPost ? ' is-on' : ''}`}>
            <span className="ctd__dot" />
            {t('igDemoStagePost')}
          </span>
          <span className="ctd__arrow">→</span>
          <span className={`ctd__stage${onPost ? '' : ' is-on'}`}>
            <span className="ctd__dot" />
            {t('igDemoStageDm')}
          </span>
        </span>
        <span className="ctd__badge">{t('demoBadge')}</span>
      </div>

      <div className="ctd__body">
        <div className="ctd__phonewrap">
          <div ref={phoneRef} className={`ctd__phone ctd__phone--${frameStyle}`}>
            <div className="ctd__screen">
              {/* Two surfaces on one track. The slide is the story: a public
                  comment becoming a private conversation is the product, and a
                  cut between two screens would not say that. */}
              <div className={`ctd__track${onPost ? '' : ' is-dm'}`}>
                <div className="ctd__panel ctd__panel--post">
                  <div className="ctd__postbar">
                    <span className="ctd__avatar ctd__avatar--brand">
                      <BubbleMark size={14} />
                    </span>
                    <span className="ctd__handle" dir="ltr">{handle}</span>
                    <span className="ctd__more" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </span>
                  </div>

                  {/* A slot, not a drawing. Swap for a real product shot — the
                      README asks for one. */}
                  <div className={`ctd__media${image ? ' ctd__media--photo' : ''}`}>
                    {image ? (
                      <img className="ctd__photo" src={image} alt="" />
                    ) : (
                      /* Abstract on purpose. A stand-in that reads as
                         composition rather than a fake product, so nobody
                         mistakes the demo for a real catalogue. */
                      <span className="ctd__tile" aria-hidden="true">
                        <span className="ctd__tileform" />
                        <span className="ctd__tileform ctd__tileform--b" />
                      </span>
                    )}
                    <span className="ctd__dots" aria-hidden="true">
                      <span className="is-on" />
                      <span />
                      <span />
                    </span>
                  </div>

                  <div className="ctd__actions" aria-hidden="true">
                    <HeartGlyph />
                    <CommentGlyph />
                    <PlaneGlyph size={19} />
                  </div>

                  <div className="ctd__caption">
                    <p className="ctd__likes" dir="auto">
                      {fill(t('igDemoLikes'), { n: view.likes.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US') })}
                    </p>
                    <p className="ctd__captiontext" dir="auto">
                      <span className="ctd__captionwho" dir="ltr">{bare}</span>{' '}
                      {fill(t('igDemoPostCaption'), { keyword: word })
                        .split(word)
                        .flatMap((part, i) =>
                          i === 0
                            ? [part]
                            : [<span className="ctd__keyword" dir="ltr" key={i}>{word}</span>, part]
                        )}
                    </p>
                  </div>

                  {view.sheet && (
                    <div className="ctd__sheet">
                      <div className="ctd__grab" aria-hidden="true">
                        <span />
                      </div>
                      <p className="ctd__sheettitle">{t('igDemoCommentsTitle')}</p>

                      <div className="ctd__comments">
                        {comments.map((c) => (
                          <div
                            key={c.id}
                            className={`ctd__comment${c.isMine || c.isBot ? ' is-live' : ''}`}
                          >
                            <span
                              className={`ctd__avatar${c.isBot ? ' ctd__avatar--brand' : c.isMine ? ' ctd__avatar--mine' : ''}`}
                              dir="ltr"
                            >
                              {c.isBot ? <BubbleMark size={11} /> : c.mark}
                            </span>
                            <span className="ctd__commenttext">
                              <span className="ctd__commentwho" dir="ltr">{c.who}</span>
                              <span className="ctd__commentbody" dir="auto">{c.text}</span>
                              {c.isBot && (
                                <span className="ctd__automated">{t('igDemoAutomated')}</span>
                              )}
                            </span>
                          </div>
                        ))}

                        {view.threadTyping && (
                          <div className="ctd__comment is-live">
                            <span className="ctd__avatar ctd__avatar--brand">
                              <BubbleMark size={11} />
                            </span>
                            <span className="ctd__typing" role="status" aria-label={t('demoTyping')}>
                              <span />
                              <span />
                              <span />
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="ctd__sheetfoot">
                        <button
                          type="button"
                          className={`ctd__chip${view.flash === 'keyword' ? ' is-hot' : ''}`}
                          onClick={postComment}
                        >
                          <span>{t('igDemoKeywordChip')}</span>
                          <span dir="ltr">{word}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="ctd__panel ctd__panel--dm">
                  <div className="ctd__dmhead">
                    <span className="ctd__back" aria-hidden="true">‹</span>
                    <span className="ctd__avatar ctd__avatar--brand ctd__avatar--lg">
                      <BubbleMark size={16} />
                    </span>
                    <span className="ctd__who">
                      <span className="ctd__name" dir="ltr">{bare}</span>
                      <span className="ctd__sub">{t('demoBotLabel')}</span>
                    </span>
                  </div>

                  <div className="ctd__stream">
                    {view.dmMsgs.map((m) =>
                      m.lead ? (
                        <div key={m.id} className="ctd__row ctd__row--in">
                          <div className="ctd__lead">
                            <div className="ctd__leadhead">
                              <span className="ctd__tick">
                                <CheckIcon />
                              </span>
                              <span>{t('igDemoLeadTitle')}</span>
                            </div>
                            <dl className="ctd__facts">
                              <dt>{t('igDemoLeadFrom')}</dt>
                              <dd dir="ltr">{who}</dd>
                              <dt>{t('igDemoLeadKeyword')}</dt>
                              {/* A trigger word, not prose: pinned LTR so it
                                  reads the same on the Persian page. */}
                              <dd dir="ltr">{word}</dd>
                              <dt>{t('igDemoLeadPost')}</dt>
                              <dd dir="auto">{t('igDemoPostTitle')}</dd>
                              <dt>{t('igDemoLeadWants')}</dt>
                              <dd dir="auto">{view.lead || branches.list.intent}</dd>
                            </dl>
                          </div>
                        </div>
                      ) : (
                        <div
                          key={m.id}
                          className={`ctd__row ctd__row--${m.from === 'user' ? 'out' : 'in'}`}
                        >
                          <div className="ctd__bubble" dir="auto">{m.text}</div>
                        </div>
                      )
                    )}

                    {view.dmTyping && (
                      <div className="ctd__row ctd__row--in">
                        <div className="ctd__typing" role="status" aria-label={t('demoTyping')}>
                          <span />
                          <span />
                          <span />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="ctd__foot">
                    {view.chips && (
                      /* A horizontal scroller, not a grid: Instagram has no
                         inline keyboard, and quick replies really do sit in
                         one scrolling row above the composer. */
                      <div className="ctd__quick">
                        {BRANCH_KEYS.map((key) => (
                          <button
                            key={key}
                            type="button"
                            className={`ctd__quickbtn${view.flash === key ? ' is-hot' : ''}`}
                            onClick={() => pickChip(key)}
                          >
                            {branches[key].label}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="ctd__composer" aria-hidden="true">
                      <span className="ctd__field">{t('demoComposer')}</span>
                      <span className="ctd__send">
                        <PlaneGlyph />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <span className="ctd__notch" aria-hidden="true" />
          </div>
        </div>

        <div className="ctd__copy">
          <ul className="ctd__points">
            <li>
              <span className="ctd__point">
                <CheckIcon />
              </span>
              <span dir="auto">{t('demoPoint1')}</span>
            </li>
            <li>
              <span className="ctd__point">
                <CheckIcon />
              </span>
              <span dir="auto">{t('demoPoint2')}</span>
            </li>
            <li>
              <span className="ctd__point">
                <CheckIcon />
              </span>
              <span dir="auto">{t('demoPoint3')}</span>
            </li>
          </ul>
          <div className="ctd__cta">
            {/* The accent pill, not the provider one: --provider-blue is
                Telegram's own blue and belongs to the sign-in control alone. */}
            <a className="pill" href="#brief">
              <PlaneGlyph />
              {t('demoCta')}
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
