/**
 * Логика таймеров для часов Amazfit (Zepp OS). Чистый JS без обращений к API часов — поэтому проверяется
 * тестами в Node (tests/core.test.mjs).
 *
 * Шесть занятий: 🧬 💀 🩸 / 🏠 🤖 📖 (с 1.23.0 🏠 — обычное занятие, как остальные; серого таймера, магазина и баллов 🌸 больше нет).
 * Таймер занятия работает «равными промежутками»:
 *  - длина промежутка = «ценность 🩸» (10…90 минут; хранится на часах, меняется на экране настройки);
 *  - в конце промежутка часы вибрируют, телефону уходит событие «прошла полная ценность», таймер сразу идёт дальше;
 *  - стоп: таймер обнуляется (снова равен ценности), а телефону уходит то, сколько времени успело пройти (в пересчёте на ценность — см. stopOne);
 *  - одновременно идёт только один таймер: запуск другого останавливает прежний (с отправкой пройденного времени).
 * Очередь занятий живёт на часах (st.queue, до 12 эмодзи) и ФИКСИРОВАННАЯ: занятия закрываются строго одно за другим, с первого, и ТОЛЬКО автостартом.
 * Занятие, запущенное нажатием на кнопку, — «МОНО»: очередь оно не трогает, даже если стоит в ней первым.
 * Минуты занятий (и очередных, и моно) уходят телефону как раньше; кроме них телефону уходят две записи для журнала: очередь (qlog, см. ниже)
 * и моно-занятие (mlog: один запуск занятия от нажатия до остановки; длительность = число полных промежутков × ценность 🩸, меньше MONO_MIN — не уходит).
 * Идущее занятие занимает весь экран розовым цветом ('a'). Поверх него бывают две паузы:
 *  - ВРЕМЕННАЯ ПАУЗА 🩸 (нажатие на цифры, см. tapOverlay): идёт 🩸, занятие заморожено на своём месте круга;
 *  - ПЯТИМИНУТНАЯ ПАУЗА (1.23.0, нажатие на верхнюю часть экрана, см. startPause): весь экран зелёный ('g'), белые цифры 05:00 -> 00:00, занятие заморожено
 *    на своём месте круга, автостарт (если шёл) стоит и очередь не двигается. Пауза не занятие: телефону за неё ничего не уходит. Когда пять минут прошли,
 *    часы вибрируют, и занятие продолжается с того же места круга (само, в том числе при погасшем экране); нажатие на зелёный экран возвращает занятие раньше,
 *    долгое нажатие — остановка совсем (замороженное занятие шлёт пройденное время, как при остановке).
 * Автостарт очереди (st.auto): запускается занятие, которое стоит в очереди первым; когда его полный промежуток заканчивается
 * (телефону уходит полная ценность 🩸, занятие убирается из очереди), сразу запускается следующее по очереди — и так до конца очереди.
 * Остановка занятия (нажатие на него, запуск другого занятия, досрочный выход) автостарт выключает. Всё считается по меткам времени, поэтому работает и при погасшем
 * экране / закрытом приложении (будильники — см. nextDue).
 * Тестовый режим (st.test, переключается нажатием на левую зону очереди): все промежутки и обе паузы длятся 20 секунд, а телефону уходит то, как если бы прошла
 * полная ценность (чтобы проверить всю цепочку по-настоящему).
 * Всё считается по меткам времени: если приложение закрывалось, закончившиеся промежутки всё равно засчитаются.
 */
export const MIN = 60 * 1000
export const VALUES = [10, 20, 30, 40, 50, 60, 70, 80, 90]    // варианты ценности 🩸, минут (область экрана настройки: 1 — 10, 5 — 50, 9 — 90)
export const TEST_LEN = 20 * 1000      // тестовый режим: 20 секунд (не больше трёх границ в минуту — чтобы заодно проверить гипотезу о лимите)
export const PAUSE_LEN = 5 * MIN       // длина зелёной паузы (в тестовом режиме — TEST_LEN)
export const FRESH = 20 * 1000            // событие «свежее», если случилось не раньше 20 секунд назад (тогда подаём сигнал)
export const MIN_STOP = 1000              // стоп раньше чем через секунду телефону не отправляем
export const COUNT = 6                    // шесть занятий, порядок как на экране: слева направо, сверху вниз
export const MAX_OUT = 500                // сколько неподтверждённых событий храним
export const MONO_MIN = 60               // моно-занятие попадает в журнал телефона, только если сумма его полных промежутков не меньше стольких минут
export const QUEUE_MAX = 12               // сколько занятий помещается в очередь
export const SLOT_LEN = 6                 // длина очереди, которую можно сохранить в ячейку (короткая; длинная — две такие подряд)
export const STATE_V = 7                  // версия сохранённого состояния (7 — 🏠 обычное занятие, без 🧭; состояние версии 6 переносится, см. restore)

// эмодзи в порядке картинок i0..i5 / q0..q5 / o0..o5: шесть занятий (как на экране слева направо, сверху вниз: 🧬 💀 🩸 / 🏠 🤖 📖)
export const EMOJI = ['\u{1F9EC}', '\u{1F480}', '\u{1FA78}', '\u{1F3E0}', '\u{1F916}', '\u{1F4D6}']
// порядок прежней версии (1.22.0 и раньше, состояние версии 6): нужен только для переноса сохранённого состояния
const OLD_EMOJI = ['\u{1F9EC}', '\u{1F480}', '\u{1FA78}', '\u{1F916}', '\u{1F9ED}', '\u{1F4D6}', '\u{1F3E0}', '\u{1F340}', '\u{1F50D}']
const COMPASS = '\u{1F9ED}'   // 🧭: удалён (на телефоне с 5.23 это 🤖)

/** Номер в EMOJI для прежнего номера [i] (из состояния версии 6); -1 — такого занятия больше нет. 🧭 стал 🤖 (как на телефоне). */
function migIdx(i) {
  const e = OLD_EMOJI[i]
  return e === undefined ? -1 : EMOJI.indexOf(e === COMPASS ? EMOJI[4] : e)
}

function clamp(x, a, b) { return x < a ? a : (x > b ? b : x) }
function two(n) { return n < 10 ? '0' + n : '' + n }

function cleanVal(v) {
  const n = Math.round(+v)
  return n >= 1 && n <= 600 ? n : 60
}

export function newState(test, val) {
  const run = []
  for (let i = 0; i < COUNT; i++) run.push(0)
  // q.k: '' — нет, 'g' — зелёная пауза (q.s: 0 — нет, 1 — идёт; q.run — когда началась); auto — идёт автостарт очереди
  return { v: STATE_V, test: !!test, auto: false, ta: 0, val: cleanVal(val || 60), run: run, q: { k: '', s: 0, run: 0 }, out: [], queue: [], qs: null, mono: null, hold: null }
}

/** Привести сохранённое состояние к рабочему виду (на случай пустых/старых данных). Состояние версии 6 (1.22.0 и раньше) переносится: занятия переставляются
 *  под новые номера (🏠 стал обычным занятием, 🧭 — это 🤖), серый таймер, если он шёл, продолжается как 🏠; неотправленные события переписываются на новые номера. */
export function restore(text, test, val) {
  const st = newState(!!test, val)
  if (!text) return st
  try {
    const o = JSON.parse(text)
    if (o && o.run && o.run.length >= COUNT) {
      const cur = o.v === STATE_V
      const mig = o.v === 6
      if (o.val) st.val = cleanVal(o.val)
      st.test = !!o.test          // тестовый режим переживает перезапуск приложения
      st.auto = !!o.auto          // если на самом деле ничего не идёт, process() сам выключит автостарт
      st.ta = +o.ta > 0 ? +o.ta : 0   // когда начался тест (мс): от этого момента считаются номера границ в расписании вибрации теста
      if (cur) {
        for (let i = 0; i < COUNT; i++) st.run[i] = +o.run[i] || 0
        if (o.q && o.q.s === 1 && o.q.k === 'g') st.q = { k: 'g', s: 1, run: +o.q.run || 0 }   // зелёная пауза (без замороженного занятия она не бывает — проверка ниже)
      } else if (mig) {
        for (let i = 0; i < o.run.length && i < 6; i++) {
          const n = +o.run[i] > 0 ? migIdx(i) : -1
          if (n >= 0 && !(st.run[n] > 0)) st.run[n] = +o.run[i]
        }
        if (o.q && o.q.s === 1 && o.q.k === 'y' && +o.q.run > 0 && !st.run.some((x) => x > 0)) st.run[3] = +o.q.run   // серый таймер шёл — теперь это 🏠 с того же места круга
      }
      if (o.out && o.out.length !== undefined) {
        const keep = []
        for (let k = 0; k < o.out.length; k++) {
          const ev = o.out[k]
          if (!ev || ev.k === 'qs' || ev.k === 'g' || ev.k === 'p') continue   // события «новая очередь», «подарок» и «покупка» больше не нужны: телефон их не использует
          if (mig && ev.i !== undefined) {
            const n = migIdx(ev.i)
            if (n < 0) continue
            ev.i = n
          }
          keep.push(ev)
        }
        st.out = keep
      }
      st.queue = cur || mig ? cleanQueue(o.queue) : []   // эмодзи занятий поменялись — старая очередь (до версии 6) не годится
      st.qs = cur ? cleanQs(o.qs, st.queue) : null       // начатая, но ещё не законченная очередь (запись для журнала телефона)
      // идущее моно-занятие (запуск нажатием): нужно, чтобы после перезапуска приложения посчитанные круги не потерялись
      let mo = cleanMono(o.mono, mig)
      if (mo && !st.auto && st.run[mo.i] > 0) st.mono = mo
      // пауза (hold): занятие (или автостарт) заморожено на том же месте круга, а идёт либо 🩸 (z = 0), либо зелёный экран (z = 1)
      const h = o.hold
      if (cur && h && !st.auto && Number.isInteger(h.a) && h.a >= 0 && h.a < COUNT) {
        const z = h.z ? 1 : 0
        if (z ? (st.q.s === 1 && st.q.k === 'g') : (st.run[2] > 0 && h.a !== 2)) {
          st.hold = { a: h.a, el: Math.max(0, +h.el || 0), auto: !!h.auto && st.queue.length > 0, mono: cleanMono(h.mono, false), z: z }
        }
      }
      if (st.q.s === 1 && !(st.hold && st.hold.z)) st.q = { k: '', s: 0, run: 0 }   // зелёная пауза без замороженного занятия — мусор
    }
  } catch (e) { /* битые данные — начинаем с чистого состояния */ }
  return st
}

function cleanMono(mo, mig) {
  if (!mo || !Number.isInteger(mo.i) || mo.i < 0 || !(+mo.t0 > 0)) return null
  const i = mig ? migIdx(mo.i) : mo.i
  if (i < 0 || i >= COUNT) return null
  return { i: i, t0: +mo.t0, n: Math.max(0, Math.round(+mo.n) || 0), val: cleanVal(mo.val), x: mo.x ? 1 : 0 }
}

/**
 * Ценность 🩸 по области экрана настройки: сетка 3×3, как цифры на цифровой клавиатуре (7 8 9 / 4 5 6 / 1 2 3), номер области × 10 минут.
 * r — строка (0 — верхняя, 1 — средняя, 2 — нижняя), c — столбец (0 — левый, 1 — средний, 2 — правый).
 * Левый нижний угол — 10, центр — 50, правый верхний — 90, левый верхний — 70, правый нижний — 30.
 */
export function areaVal(r, c) {
  const rr = Math.max(0, Math.min(2, Math.floor(+r) || 0))
  const cc = Math.max(0, Math.min(2, Math.floor(+c) || 0))
  return ((2 - rr) * 3 + cc + 1) * 10
}

/** Ценность 🩸 в миллисекундах: столько «набегает» занятию за полный промежуток. */
export function valueMs(st) { return st.val * MIN }

/** Реальная длина промежутка, мс (в тестовом режиме 20 секунд). */
export function fullMs(st) { return st.test ? TEST_LEN : st.val * MIN }

/** Длина зелёной паузы, мс (в тестовом режиме 20 секунд). */
export function ovLen(st) {
  return st.test ? TEST_LEN : PAUSE_LEN
}

export function running(st, i) { return st.run[i] > 0 }

/** Цветной экран на весь экран (зелёная пауза) идёт. */
export function overlayActive(st) { return st.q.s !== 0 }

export const LOOP = '\u{1F504}'   // 🔄: над цифрами у моно-занятия (не очередь)

/** Какой экран на весь экран сейчас нужен: '' — никакого (главный), 'g' — зелёный (пятиминутная пауза), 'a' — розовый (идёт занятие). */
export function overlayKind(st) {
  if (st.q.s !== 0) return st.q.k
  for (let i = 0; i < COUNT; i++) if (st.run[i] > 0) return 'a'
  return ''
}

/** Номер в EMOJI того, что идёт сейчас на розовом экране (занятие); -1 — ничего (в том числе на зелёном экране: там только цифры). */
export function activeIdx(st) {
  for (let i = 0; i < COUNT; i++) if (st.run[i] > 0) return i
  return -1
}

/** Что показывать над цифрами на розовом экране: остаток очереди (идёт автостарт — или он на паузе 🩸) либо 🔄 и эмодзи моно-занятия. На зелёном экране — ничего. */
export function ovTop(st) {
  if (overlayKind(st) !== 'a') return []
  const auto = st.hold ? st.hold.auto : st.auto
  if (auto && st.queue.length) return st.queue.slice()
  const e = activeIdx(st)
  return e < 0 ? [] : [LOOP, EMOJI[e]]
}

/** Сколько осталось до конца круга у того, что идёт на розовом экране, или до конца зелёной паузы, мс. */
export function ovLeftAny(st, now) {
  if (st.q.s === 1) return ovLeft(st, now)
  for (let i = 0; i < COUNT; i++) if (st.run[i] > 0) return clamp(remaining(st, i, now), 0, fullMs(st))
  return 0
}

/** Остаток промежутка занятия, мс (может быть ≤ 0, если срабатывание ещё не обработано). */
export function remaining(st, i, now) {
  return st.run[i] > 0 ? fullMs(st) - (now - st.run[i]) : fullMs(st)
}

export function anyRunning(st) {
  for (let i = 0; i < COUNT; i++) if (st.run[i] > 0) return true
  return st.q.s === 1
}

/** Сколько осталось на цветном таймере, мс. */
export function ovLeft(st, now) {
  if (st.q.s !== 1) return 0
  const len = ovLen(st)
  return clamp(len - (now - st.q.run), 0, len)
}

/** Очередь из чего угодно: только эмодзи шести занятий (🧭 — это 🤖, как на телефоне), не больше QUEUE_MAX. */
export function cleanQueue(a) {
  const out = []
  if (!a || a.length === undefined) return out
  for (let k = 0; k < a.length && out.length < QUEUE_MAX; k++) {
    let e = String(a[k])
    if (e === COMPASS) e = EMOJI[4]
    if (EMOJI.indexOf(e) >= 0) out.push(e)
  }
  return out
}

/**
 * Долгое нажатие на кнопку занятия: вызвать очередь из её ячейки [slot] (ровно SLOT_LEN эмодзи). Возвращает новую очередь или null — «ничего не менять».
 *  - в ячейке не шесть эмодзи (пустая) — null;
 *  - в очереди ровно эти шесть — удваиваются (12): повторное нажатие на ту же кнопку;
 *  - в очереди уже эти шесть дважды — null: третье нажатие ничего не делает;
 *  - иначе (очередь пуста или в ней что-то другое, в том числе очередь другой ячейки) — очередь заменяется шестью эмодзи ячейки.
 */
export function slotQueue(queue, slot) {
  const s = cleanQueue(slot)
  if (s.length !== SLOT_LEN) return null
  const q = cleanQueue(queue)
  const same = (a, b) => a.length === b.length && a.every((e, k) => e === b[k])
  if (same(q, s)) return s.concat(s)
  if (same(q, s.concat(s))) return null
  return s.slice()
}

/**
 * ЗАПИСЬ ОЧЕРЕДИ для второго слоя журнала на телефоне. Пока в очереди что-то есть, часы только копят сведения в st.qs (и ничего не шлют):
 *   { t0 — когда началась очередь (мс: начало первого выполненного занятия), val — ценность 🩸 на тот момент (минут), seq — очередь целиком
 *     как она была, left — какие места seq ещё не выполнены (по порядку, всегда столько же, сколько эмодзи в st.queue), last — когда выполнено
 *     последнее, x — тестовый режим }.
 * Телефону запись уходит ОДИН раз — событием {k:'qr'}: когда в очереди не осталось эмодзи (всё выполнено) или когда очередь убрали / заменили
 * (setQueue). Очередь, в которой ничего не выполнено, записью не становится. Пауза и возобновление ничего не меняют: запись живёт, пока в очереди есть эмодзи.
 */
function cleanQs(o, queue) {
  if (!o || !(+o.t0 > 0) || !o.seq || o.seq.length === undefined || !o.left || o.left.length === undefined) return null
  const seq = cleanQueue(o.seq)
  const left = []
  for (let k = 0; k < o.left.length; k++) {
    const i = Math.round(+o.left[k])
    if (i >= 0 && i < seq.length) left.push(i)
  }
  if (!seq.length || left.length !== queue.length || left.length >= seq.length) return null   // очередь менялась мимо записи или ничего не выполнено — записи нет
  return { t0: +o.t0, val: cleanVal(o.val), seq: seq, left: left, last: +o.last > 0 ? +o.last : +o.t0, x: o.x ? 1 : 0 }
}

/** Закрыть запись очереди: поставить в очередь отправки событие (если что-то было выполнено). Возвращает событие или null. */
function qsFinish(st, endTs) {
  const s = st.qs
  st.qs = null
  if (!s) return null
  const m = []
  let done = 0
  for (let k = 0; k < s.seq.length; k++) {
    const d = s.left.indexOf(k) < 0
    if (d) done++
    m.push(d ? '1' : '0')
  }
  if (!done) return null
  const ev = { id: 'qr' + s.t0, k: 'qr', ts: s.t0, v: s.val, q: s.seq.join(''), m: m.join(''), d: Math.max(0, (s.last > 0 ? s.last : endTs) - s.t0), x: s.x ? 1 : 0, tried: 0 }
  st.out.push(ev)
  if (st.out.length > MAX_OUT) st.out = st.out.slice(st.out.length - MAX_OUT)
  return ev
}

/** Первое занятие очереди выполнено автостартом в момент [at]: записать в st.qs (начав запись, если это первое выполненное). Вызывать ДО удаления из st.queue. */
function qsTrack(st, at) {
  if (!st.qs || st.qs.left.length !== st.queue.length) {
    const left = []
    for (let i = 0; i < st.queue.length; i++) left.push(i)
    st.qs = { t0: at - fullMs(st), val: st.val, seq: st.queue.slice(), left: left, last: at, x: st.test ? 1 : 0 }
  }
  st.qs.left.splice(0, 1)
  st.qs.last = at
}

/**
 * Поставить очередь [q] вручную (ввод, вызов из ячейки, удаление). Начатая очередь, которую заменили или удалили, закрывается:
 * то, что в ней было выполнено, уходит телефону записью. Возвращает событие или null.
 */
export function setQueue(st, q, now) {
  const ev = qsFinish(st, now)
  st.queue = cleanQueue(q)
  return ev
}

/**
 * Закрыть первое занятие очереди (только автостарт: очередь фиксированная, закрывается по порядку). Возвращает убранный эмодзи или null.
 * [at] — когда занятие выполнено (мс): по нему ведётся запись очереди для телефона; когда в очереди не осталось эмодзи, запись закрывается.
 */
export function queueClose(st, at) {
  if (!st.queue.length) return null
  if (at > 0) qsTrack(st, at)
  const gone = st.queue.shift()
  if (at > 0 && !st.queue.length) qsFinish(st, at)
  return gone
}

// ====================== МОНО-ЗАНЯТИЯ ======================

/** Начался запуск занятия [i] нажатием на кнопку (не автостарт): считаем его полные промежутки. */
function monoBegin(st, i, now) {
  st.mono = { i: i, t0: now, n: 0, val: st.val, x: st.test ? 1 : 0 }
}

/** Закончился запуск моно-занятия (стоп, запуск другого занятия): если сумма полных промежутков не меньше MONO_MIN — запись для журнала. */
function monoEnd(st) {
  const m = st.mono
  st.mono = null
  if (m) monoPush(st, m.i, m.t0, m.n, m.val, m.x)
}

/** Поставить в очередь отправки запись моно-занятия [i] (номер в EMOJI): n полных промежутков по val минут, начало t0. Меньше MONO_MIN — ничего. */
function monoPush(st, i, t0, n, val, x) {
  if (!(n > 0) || n * val < MONO_MIN) return null
  const ev = { id: 'mo' + t0 + '-' + i, k: 'mo', ts: t0, i: i, v: val, n: n, x: x ? 1 : 0, tried: 0 }
  st.out.push(ev)
  if (st.out.length > MAX_OUT) st.out = st.out.slice(st.out.length - MAX_OUT)
  return ev
}

/**
 * Обработать сработавшее. Возвращает { events, fresh, ovDone, ovFresh, ovKind }.
 * Закончившаяся зелёная пауза закрывается сама, а занятие продолжается с того же места круга (ovDone = true, ovKind = 'g').
 * Новые события добавляются и в st.out (очередь на отправку телефону, пока не придёт подтверждение).
 */
export function process(st, now) {
  const events = []
  let fresh = false
  const full = fullMs(st)
  const pr = processPause(st, now)   // зелёная пауза: конец и возврат занятия
  if (st.auto) {
    const a = processAuto(st, now, events)
    return { events: events, fresh: a.fresh, ovDone: a.ovDone || pr.ovDone, ovFresh: a.ovFresh || pr.ovFresh, ovKind: a.ovKind || pr.ovKind }
  }
  for (let i = 0; i < COUNT; i++) {
    const s = st.run[i]
    if (s <= 0) continue
    if (now - s < full) continue
    let t = s + full
    let count = 0
    while (t <= now && count < 24) {
      const ev = { id: 'b' + i + '-' + t, k: 'b', i: i, ts: t, ms: valueMs(st), f: 1, x: st.test ? 1 : 0, tried: 0 }
      events.push(ev)
      st.out.push(ev)
      if (st.mono && st.mono.i === i) st.mono.n++   // моно-занятие: ещё один полный промежуток (очередь не трогается)
      if (now - t <= FRESH) fresh = true
      t += full
      count++
    }
    st.run[i] = count >= 24 ? now : t - full   // новый промежуток начался в момент последнего срабатывания
  }
  if (st.out.length > MAX_OUT) st.out = st.out.slice(st.out.length - MAX_OUT)
  return { events: events, fresh: fresh, ovDone: pr.ovDone, ovFresh: pr.ovFresh, ovKind: pr.ovKind }
}

/** Что идёт сейчас: { a: номер занятия } / null. Нужно автостарту: одновременно идёт только одно. */
function autoCurrent(st) {
  for (let i = 0; i < COUNT; i++) if (st.run[i] > 0) return { a: i }
  return null
}

/** Запустить с момента [at] то, что стоит в очереди первым. false — очередь пуста. */
function autoStartHead(st, at) {
  if (!st.queue.length) return false
  const idx = EMOJI.indexOf(st.queue[0])
  if (idx < 0) return false
  st.run[idx] = at
  return true
}

/**
 * Автостарт: что закончилось к моменту [now] — засчитывается (событие телефону, занятие убирается из очереди), и сразу с момента
 * окончания запускается следующее из очереди. Закончилась очередь (или ничего не идёт) — автостарт выключается.
 */
function processAuto(st, now, events) {
  const r = { fresh: false, ovDone: false, ovFresh: false, ovKind: '' }
  for (let n = 0; n < 40 && st.auto; n++) {
    const cur = autoCurrent(st)
    if (!cur) { st.auto = false; break }
    const i = cur.a
    const full = fullMs(st)
    if (now - st.run[i] < full) break
    const at = st.run[i] + full
    const ev = { id: 'b' + i + '-' + at, k: 'b', i: i, ts: at, ms: valueMs(st), f: 1, x: st.test ? 1 : 0, tried: 0 }
    events.push(ev)
    st.out.push(ev)
    queueClose(st, at)
    st.run[i] = 0
    if (now - at <= FRESH) r.fresh = true
    if (!autoStartHead(st, at)) st.auto = false
  }
  if (st.out.length > MAX_OUT) st.out = st.out.slice(st.out.length - MAX_OUT)
  return r
}

/** Включить автостарт очереди: запускается то, что стоит в очереди первым. Только когда ничего не идёт и очередь не пуста. */
export function startAuto(st, now) {
  const res = process(st, now)
  if (anyRunning(st) || !st.queue.length) return res
  st.ta = now
  st.auto = true
  autoStartHead(st, now)
  return res
}

/** Включить / выключить тестовый режим (все таймеры и паузы по 20 секунд). Только когда ничего не идёт. Возвращает true, если режим поменялся. */
export function toggleTest(st) {
  if (anyRunning(st)) return false
  st.test = !st.test
  return true
}

/** Остановить занятие [i]: обнулить и поставить в очередь отправки пройденное время (в пересчёте на ценность). */
function stopOne(st, i, now) {
  const s = st.run[i]
  if (s <= 0) return null
  st.run[i] = 0
  if (st.mono && st.mono.i === i) monoEnd(st)   // моно-занятие закончено: запись для журнала, если набралось достаточно
  const el = now - s
  if (el < MIN_STOP) return null
  const ms = Math.round(el / fullMs(st) * valueMs(st))
  const ev = { id: 'b' + i + '-s' + now, k: 'b', i: i, ts: now, ms: ms, f: 0, x: st.test ? 1 : 0, tried: 0 }
  st.out.push(ev)
  return ev
}

/** Нажатие на кнопку занятия: запуск / стоп. Запуск останавливает любой другой идущий таймер. */
export function toggle(st, i, now) {
  const res = process(st, now)
  const idle = !anyRunning(st)
  dropHold(st, now)
  if (st.run[i] > 0) {
    stopOne(st, i, now)
  } else {
    if (idle) st.ta = now   // начало теста: от этой точки считаются номера границ
    for (let k = 0; k < COUNT; k++) if (k !== i) stopOne(st, k, now)
    st.q = { k: '', s: 0, run: 0 }
    st.run[i] = now
    monoBegin(st, i, now)   // запуск нажатием — моно-занятие: очередь оно не закрывает
  }
  st.auto = false   // остановка занятия (или запуск другого) выключает автостарт
  return res
}

/** Временная пауза (🩸 или зелёная) закончилась не возвратом (остановили совсем и т.п.): замороженное занятие отпускается — пройденное им время и моно-запись уходят телефону. */
function dropHold(st, now) {
  const h = st.hold
  if (!h) return
  st.hold = null
  if (h.mono) monoPush(st, h.mono.i, h.mono.t0, h.mono.n, h.mono.val, h.mono.x)
  if (h.el >= MIN_STOP) {
    const ms = Math.round(h.el / fullMs(st) * valueMs(st))
    st.out.push({ id: 'b' + h.a + '-h' + now, k: 'b', i: h.a, ts: now, ms: ms, f: 0, x: st.test ? 1 : 0, tried: 0 })
  }
}

// ====================== ЗЕЛЁНАЯ ПАУЗА НА ПЯТЬ МИНУТ ======================

/** Вернуть замороженное занятие в момент [at]: оно идёт с того же места круга, автостарт (если шёл) включается снова, моно-запись продолжается. */
function resumePause(st, at) {
  const h = st.hold
  st.q = { k: '', s: 0, run: 0 }
  st.hold = null
  if (!h) return
  st.run[h.a] = at - h.el
  st.auto = h.auto
  st.mono = h.mono
}

/** Зелёная пауза к моменту [now]: если пять минут прошли, занятие возвращается с момента её конца (дальше process досчитывает его круги). */
function processPause(st, now) {
  const r = { ovDone: false, ovFresh: false, ovKind: '' }
  if (st.q.s !== 1) return r
  if (st.q.k !== 'g' || !st.hold) { st.q = { k: '', s: 0, run: 0 }; return r }   // пауза без замороженного занятия — мусор
  const len = ovLen(st)
  if (now - st.q.run < len) return r
  const at = st.q.run + len
  resumePause(st, at)
  r.ovDone = true
  r.ovKind = 'g'
  r.ovFresh = now - at <= FRESH
  return r
}

/**
 * Пятиминутная пауза (нажатие на верхнюю часть розового экрана): идущее занятие замораживается на своём месте круга, весь экран становится зелёным (st.q = { k: 'g' }),
 * идёт обратный отсчёт PAUSE_LEN. Автостарт, если он шёл, ставится на паузу вместе с занятием (очередь не двигается). Телефону за паузу ничего не уходит.
 * Не работает, если ничего не идёт, пауза уже идёт или занятие уже стоит на временной паузе 🩸. Возвращает { res, changed }.
 */
export function startPause(st, now) {
  const res = process(st, now)
  if (st.hold || st.q.s !== 0) return { res: res, changed: false }
  const cur = autoCurrent(st)
  if (!cur) return { res: res, changed: false }
  const a = cur.a
  const el = now - st.run[a]
  st.run[a] = 0
  st.hold = { a: a, el: clamp(el, 0, fullMs(st)), auto: !!st.auto, mono: st.mono, z: 1 }
  st.mono = null
  st.auto = false
  st.q = { k: 'g', s: 1, run: now }
  return { res: res, changed: true }
}

/** Нажатие на зелёный экран: пауза кончается раньше срока, занятие продолжается с того же места. Возвращает { res, changed }. */
export function endPause(st, now) {
  const res = process(st, now)
  if (!(st.q.s === 1 && st.q.k === 'g' && st.hold)) return { res: res, changed: false }
  resumePause(st, now)
  return { res: res, changed: true }
}

/**
 * Обычное нажатие на цифры розового экрана = ВРЕМЕННАЯ ПАУЗА 🩸. Идёт занятие — оно замораживается на своём месте круга, а идёт 🩸 (как моно-запуск: полные круги,
 * порог MONO_MIN). Повторное нажатие: 🩸 останавливается (пройденное время уходит телефону), занятие продолжается с того же места, а автостарт — если он шёл —
 * снова включается. Если уже идёт 🩸 (не временная) — ничего не происходит. Возвращает { res, changed }.
 */
export function tapOverlay(st, now) {
  const res = process(st, now)
  if (st.q.s !== 0) return { res: res, changed: false }   // зелёный экран отвечает за себя (endPause)
  if (st.hold) {
    const h = st.hold
    stopOne(st, 2, now)
    st.hold = null
    st.run[h.a] = now - h.el
    st.auto = h.auto
    st.mono = h.mono
    return { res: res, changed: true }
  }
  const cur = autoCurrent(st)
  if (!cur || cur.a === 2) return { res: res, changed: false }
  const a = cur.a
  const el = now - st.run[a]
  st.run[a] = 0
  st.hold = { a: a, el: clamp(el, 0, fullMs(st)), auto: !!st.auto, mono: st.mono, z: 0 }
  st.mono = null
  st.auto = false
  st.run[2] = now
  monoBegin(st, 2, now)
  return { res: res, changed: true }
}

/** Остановить совсем (долгое нажатие на розовый или зелёный экран): идущее занятие — с отправкой пройденного времени, замороженное занятие тоже, пауза и автостарт выключаются. */
export function stopAll(st, now) {
  const res = process(st, now)
  for (let i = 0; i < COUNT; i++) stopOne(st, i, now)
  st.q = { k: '', s: 0, run: 0 }
  dropHold(st, now)
  st.auto = false
  return { res: res }
}

/** Подтверждение от телефона: событие больше не нужно отправлять. */
export function ack(st, id) {
  const n = []
  let removed = false
  for (let k = 0; k < st.out.length; k++) {
    if (st.out[k].id === id) removed = true
    else n.push(st.out[k])
  }
  st.out = n
  return removed
}

/** События, которые пора (пере)отправить: прошло не меньше [gap] мс с прошлой попытки. */
export function due(st, now, gap) {
  const r = []
  for (let k = 0; k < st.out.length; k++) {
    if (now - (st.out[k].tried || 0) >= gap) r.push(st.out[k])
  }
  return r
}

/** Метка на кнопке занятия: минуты вверх (до ценности), в тестовом режиме — секунды. */
export function label(st, ms) {
  if (st.test) return '' + clamp(Math.ceil(ms / 1000), 1, Math.round(TEST_LEN / 1000))
  return '' + clamp(Math.ceil(ms / MIN), 1, st.val)
}

/** «мм:сс» (секунды вверх, как у обычного таймера: 15:00 -> 14:59 -> ... -> 00:01 -> 00:00). */
export function clock(ms) {
  const s = Math.ceil(clamp(ms, 0, 90 * MIN) / 1000)
  return two(Math.floor(s / 60)) + ':' + two(s % 60)
}

/** Сколько ближайших границ занятия заранее ставится службе-будильнику (вибрация). Страница при погасшем экране не оживает (будильник страницы её не будит), поэтому вибрации хватит ровно на столько границ, пока экран не включат. */
export const ALARM_AHEAD = 12
/** В тестовом режиме границы идут через 20 секунд, и окно длиннее — 24 границы (8 минут): чтобы тест не обрывался на середине. */
export const ALARM_AHEAD_TEST = 24
export function aheadFor(st) { return st.test ? ALARM_AHEAD_TEST : ALARM_AHEAD }

/**
 * РАСПИСАНИЕ ВИБРАЦИИ В ТЕСТЕ (диагностика, см. app-service/alarm.js). Служба-будильник срабатывает на КАЖДОЙ границе (как и раньше),
 * а вибрирует ли она на этой границе и как — написано здесь, по одной букве на границу (1-я буква — 1-я граница после начала теста):
 *   A — вибрировать «как было» (start({ mode: STRONG_REMINDER }), серия коротких); B, C, D — прежние запасные способы (см. alarm.js);
 *   . — ТИХО: служба просто срабатывает и пишет строку в журнал, вибромотор не трогает;
 *   c — тихо + проверка часов службы (короткий цикл, в журнал идёт число оборотов и сколько мс он занял).
 * Расписание: 4 вибрации подряд через 20 с (границы 1-4), потом три раза через 60 с (7, 10, 13), потом через 120 с (19) и снова четыре подряд
 * через 20 с (19-22: «после долгого покоя»); границы 5 и 16 — тихие с проверкой часов службы, остальные пропуски — просто тихие. Способ везде один (A), чтобы буква не путалась с временем: в 1.12.0 буквы шли по кругу A B C D,
 * то есть каждый способ приходился на свою фазу 80-секундного круга, и «способ» нельзя было отделить от «момента».
 * Номер границы считается от начала теста (st.ta — момент запуска из состояния «ничего не идёт»), поэтому у одной и той же границы буква
 * всегда одна и та же, как бы ни пересчитывался план. За концом расписания (и если начало теста неизвестно) — A.
 */
export const TEST_PLAN = 'AAAAc.A..A..A..c..AAAA..'
export const METHODS = ['A', 'B', 'C', 'D', '.', 'c']
export function methodFor(st, boundarySec, everySec) {
  if (!st.test || !(everySec > 0) || !(st.ta > 0)) return 'A'
  const k = Math.round((boundarySec * 1000 - st.ta) / (everySec * 1000))   // 1 — первая граница после начала теста
  if (k < 1 || k > TEST_PLAN.length) return 'A'
  return TEST_PLAN.charAt(k - 1)
}

/**
 * План будильников: что должно стоять в системе прямо сейчас. Для каждой ближайшей границы — будильник службы (вибрация, через секунду
 * после границы) и, для самой первой, будильник страницы (через 4 секунды: приложение откроется, посчитает и отправит минуты на телефон).
 * Занятие, которое идёт по кругу, получает службу на [ahead] границ вперёд; автостарт — только на оставшиеся границы очереди;
 * зелёная пауза — её конец и конец круга занятия после возврата. У каждого будильника свой ключ (вид + граница + сколько границ ещё впереди): страница сравнивает план с уже
 * поставленным и трогает только разницу (так два будильника не встают на одну секунду и не мешают друг другу).
 * Элемент: { key, url, param, at } — at в секундах (UTC).
 */
export function alarmPlan(st, ahead) {
  const out = []
  const every = Math.round(fullMs(st) / 1000)
  const due = nextDue(st)
  for (let k = 0; k < due.length; k++) {
    const d = due[k]
    const sec = Math.round(d.t / 1000)
    let steps = 1
    if (d.kind === 'hour' && every > 0) steps = d.n === undefined ? ahead : Math.min(ahead, d.n + 1)
    for (let j = 0; j < steps; j++) {
      const bs = sec + j * every
      const left = d.n === undefined ? -1 : d.n - j
      out.push({ key: 's' + d.kind + bs + ':' + left, url: 'app-service/alarm', param: d.kind + '|' + bs + '|' + left + '|' + methodFor(st, bs, every), at: bs + 1 })
      if (j === 0) out.push({ key: 'p' + bs, url: 'page/index', param: 'alarm', at: bs + 4 })
    }
  }
  return out
}

/**
 * Сравнить уже поставленные будильники [{ k: ключ, i: номер }] с планом: kept — что оставить, cancel — номера того, что снять (лишнее и
 * старый формат), add — что нужно поставить, keep — ключи оставленного.
 */
export function alarmDiff(old, plan) {
  const want = {}
  for (let k = 0; k < plan.length; k++) want[plan[k].key] = true
  const keep = {}
  const kept = []
  const cancel = []
  const list = Array.isArray(old) ? old : []
  for (let k = 0; k < list.length; k++) {
    const o = list[k]
    if (o && typeof o === 'object' && want[o.k] && !keep[o.k]) { keep[o.k] = true; kept.push(o) }
    else cancel.push(o && typeof o === 'object' ? o.i : o)
  }
  const add = []
  for (let k = 0; k < plan.length; k++) if (!keep[plan[k].key]) add.push(plan[k])
  return { kept: kept, cancel: cancel, add: add, keep: keep }
}

/**
 * Привести будильники в системе к плану: лишние снять, недостающие поставить. api = { set(url, param, delay) -> номер или 0 / исключение,
 * cancel(номер) }. Если система отказала, пробуем на секунду позже (до трёх раз): раньше отказ молча глотался, и вибрация пропадала.
 * Возвращает { next — что теперь стоит [{ k, i }] (его надо сохранить), tok — короткие записи для журнала, plan }.
 */
export function applyAlarms(st, nowMs, old, api) {
  const plan = alarmPlan(st, aheadFor(st))
  const diff = alarmDiff(old, plan)
  for (let k = 0; k < diff.cancel.length; k++) { try { api.cancel(diff.cancel[k]) } catch (e) { /* уже сработал */ } }
  const next = diff.kept.slice()
  const tok = []
  for (let k = 0; k < plan.length; k++) {
    const w = plan[k]
    const tag = w.url === 'page/index' ? 'p' : 's'
    const delay = Math.max(1, Math.ceil(w.at - nowMs / 1000))
    if (diff.keep[w.key]) { tok.push(tag + delay + '='); continue }
    let id = 0
    let tries = 0
    let err = ''
    for (; tries < 4; tries++) {
      try {
        id = api.set(w.url, w.param, delay + tries)
        if (id) break
        err = 'id' + id
      } catch (e) { err = String(e).slice(0, 12) }
    }
    if (id) { next.push({ k: w.key, i: id }); tok.push(tag + (delay + tries) + ':' + id) }
    else tok.push(tag + delay + ':X(' + err + ')')
  }
  return { next: next, tok: tok, plan: plan }
}

/** Моменты, когда что-то закончится (для будильников): [{ t, kind }]. */
export function nextDue(st) {
  const r = []
  const full = fullMs(st)
  if (st.auto) {
    // автостарт: границы стоят через равные промежутки (по одной на каждое занятие в очереди); n — сколько границ после первой
    const cur = autoCurrent(st)
    if (cur) r.push({ t: st.run[cur.a] + full, kind: 'hour', n: Math.max(0, st.queue.length - 1) })
    return r
  }
  for (let i = 0; i < COUNT; i++) if (st.run[i] > 0) r.push({ t: st.run[i] + full, kind: 'hour' })
  if (st.q.s === 1) {
    // зелёная пауза: её конец (вибрация, и страница откроется, вернёт занятие и поставит будильники дальше) и конец круга занятия после возврата
    const end = st.q.run + ovLen(st)
    r.push({ t: end, kind: 'quick' })
    const h = st.hold
    if (h) r.push(h.auto ? { t: end + full - h.el, kind: 'hour', n: Math.max(0, st.queue.length - 1) } : { t: end + full - h.el, kind: 'hour' })
  }
  return r
}
