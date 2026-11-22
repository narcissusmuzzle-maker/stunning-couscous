import assert from 'node:assert'
import * as core from '../shared/core.js'

const T = 1000000   // run=0 означает «не идёт», поэтому время в тестах начинаем не с нуля
const M = 60000
let n = 0
let bad = 0
function t(name, f) { try { f(); n++; console.log('ok  ' + name) } catch (e) { bad++; console.log('FAIL ' + name + '\n   ' + String(e.message).split('\n').slice(0, 6).join(' ') + '\n   ' + String(e.stack).split('\n').find((l) => l.includes('core.test.mjs'))) } }

t('шесть занятий, ценность по умолчанию 60', () => {
  assert.equal(core.COUNT, 6)
  assert.equal(core.newState(false).val, 60)
})

t('ценность по области экрана настройки: сетка 3×3 как 7 8 9 / 4 5 6 / 1 2 3, номер × 10 минут', () => {
  // строка 0 — верхняя, 2 — нижняя; столбец 0 — левый, 2 — правый
  assert.equal(core.areaVal(2, 0), 10)   // левый нижний угол
  assert.equal(core.areaVal(2, 1), 20)
  assert.equal(core.areaVal(2, 2), 30)   // правый нижний угол
  assert.equal(core.areaVal(1, 0), 40)
  assert.equal(core.areaVal(1, 1), 50)   // центр
  assert.equal(core.areaVal(1, 2), 60)
  assert.equal(core.areaVal(0, 0), 70)   // левый верхний угол
  assert.equal(core.areaVal(0, 1), 80)
  assert.equal(core.areaVal(0, 2), 90)   // правый верхний угол
  const all = []
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) all.push(core.areaVal(r, c))
  assert.deepEqual(all.slice().sort((x, y) => x - y), core.VALUES)   // девять областей — девять разных значений
})

t('ценность 90 минут: кнопка показывает минуты вверх до 90, событие и промежуток — 90 минут', () => {
  const st = core.newState(false, core.areaVal(0, 2))
  assert.equal(st.val, 90)
  core.toggle(st, 0, T)
  assert.equal(core.label(st, 90 * M), '90')
  assert.equal(core.label(st, 89 * M + 1), '90')
  assert.equal(core.label(st, 1), '1')
  const r = core.process(st, T + 90 * M)
  assert.equal(r.events.length, 1)
  assert.equal(r.events[0].ms, 90 * M)
  assert.equal(r.events[0].ts, T + 90 * M)
  assert.equal(core.fullMs(st), 90 * M)
  const s10 = core.newState(false, core.areaVal(2, 0))
  core.toggle(s10, 0, T)
  assert.equal(core.process(s10, T + 30 * M).events.length, 3)   // при 10 минутах за 30 минут — три границы
})

t('промежуток = ценность: событие через 30 минут, вибрация, отсчёт идёт дальше', () => {
  const st = core.newState(false, 30)
  core.toggle(st, 0, T)
  assert.equal(core.label(st, core.remaining(st, 0, T)), '30')
  assert.equal(core.process(st, T + 29 * M).events.length, 0)
  const r = core.process(st, T + 30 * M)
  assert.equal(r.events.length, 1)
  assert.equal(r.fresh, true)
  const ev = r.events[0]
  assert.equal(ev.k, 'b'); assert.equal(ev.f, 1); assert.equal(ev.ms, 30 * M)
  assert.equal(ev.id, 'b0-' + (T + 30 * M))
  assert.equal(core.running(st, 0), true)
  assert.equal(core.remaining(st, 0, T + 30 * M), 30 * M)   // сразу пошёл следующий промежуток
})

t('экран был выключен: пропущенные промежутки засчитываются с настоящим временем', () => {
  const st = core.newState(false, 45)
  core.toggle(st, 2, T)
  const r = core.process(st, T + 100 * M)           // прошло 2 промежутка и ещё 10 минут
  assert.equal(r.events.length, 2)
  assert.equal(r.events[1].ts, T + 90 * M)
  assert.equal(r.fresh, false)                      // давно — не вибрируем
  assert.equal(core.remaining(st, 2, T + 100 * M), 35 * M)
})

t('стоп: таймер обнуляется, на телефон уходит пройденное время', () => {
  const st = core.newState(false, 60)
  core.toggle(st, 1, T)
  core.toggle(st, 1, T + 20 * M)                    // нажали ещё раз — стоп
  assert.equal(core.running(st, 1), false)
  assert.equal(st.out.length, 1)
  assert.equal(st.out[0].ms, 20 * M)
  assert.equal(st.out[0].f, 0)
  assert.equal(core.label(st, core.remaining(st, 1, T + 21 * M)), '60')   // снова равен ценности
})

t('стоп раньше секунды ничего не отправляет', () => {
  const st = core.newState(false)
  core.toggle(st, 1, T)
  core.toggle(st, 1, T + 500)
  assert.equal(st.out.length, 0)
})

t('запуск другого занятия останавливает прежнее и отправляет пройденное', () => {
  const st = core.newState(false, 60)
  core.toggle(st, 0, T)
  core.toggle(st, 4, T + 12 * M)
  assert.equal(core.running(st, 0), false)
  assert.equal(core.running(st, 4), true)
  assert.equal(st.out.length, 1)
  assert.equal(st.out[0].i, 0)
  assert.equal(st.out[0].ms, 12 * M)
})

t('стоп сначала учитывает завершившийся промежуток', () => {
  const st = core.newState(false, 30)
  core.toggle(st, 3, T)
  core.toggle(st, 3, T + 40 * M)                    // 30 минут уже прошло, 10 — следующего
  assert.equal(st.out.length, 2)
  assert.equal(st.out[0].f, 1)
  assert.equal(st.out[1].ms, 10 * M)
})

t('тест: промежуток 20 секунд, но телефону уходит полная ценность', () => {
  const st = core.newState(true, 45)
  core.toggle(st, 2, T)
  assert.equal(core.label(st, core.remaining(st, 2, T)), '20')
  assert.equal(core.label(st, core.remaining(st, 2, T + 4200)), '16')
  const r = core.process(st, T + 20000)
  assert.equal(r.events.length, 1)
  assert.equal(r.events[0].ms, 45 * M)
  assert.equal(r.events[0].x, 1)
  // стоп на половине теста — половина ценности
  core.toggle(st, 2, T + 30000)
  assert.equal(st.out[st.out.length - 1].ms, Math.round(22.5 * M))
})

const shopSt0 = (b, p) => { const st = core.newState(false, 60); core.setShopFrom(st, { b: b, p: p || {} }); return st }

t('подтверждение и повторная отправка', () => {
  const st = core.newState(false, 60)
  core.toggle(st, 0, T)
  core.process(st, T + 60 * M)
  assert.equal(core.due(st, T + 60 * M, 15000).length, 1)
  st.out[0].tried = T + 60 * M
  assert.equal(core.due(st, T + 60 * M + 1000, 15000).length, 0)
  assert.equal(core.due(st, T + 60 * M + 16000, 15000).length, 1)
  assert.equal(core.ack(st, st.out[0].id), true)
  assert.equal(st.out.length, 0)
})

t('сохранение и восстановление (в том числе старое сохранение v3)', () => {
  const st = core.newState(false, 45)
  core.toggle(st, 1, T + 100)
  const back = core.restore(JSON.stringify(st), false, 60)
  assert.equal(back.val, 45)
  assert.equal(back.run[1], T + 100)
  const old = core.restore(JSON.stringify({ v: 3, rem: [1, 2, 3, 4, 5, 6, 7, 8, 9], run: [0, 0, T, 0, 0, 0, 0, 0, 0], hold: -1, q: { s: 1, run: T }, out: [{ id: '0-5', i: 0, ts: 5 }] }), false, 60)
  assert.equal(old.run[2], 0)                      // занятия версий до 6 переставлены — идущее не переносится
  assert.equal(old.q.s, 0)                         // цветные экраны из старых версий отбрасываются
  assert.equal(old.out.length, 1)
  const done = core.restore(JSON.stringify({ v: 4, run: [0, 0, 0, 0, 0, 0], q: { k: 'y', s: 2, run: T } }), false, 60)
  assert.equal(core.overlayActive(done), false)    // закончившийся таймер из прошлой версии не возвращается
  assert.equal(core.restore('мусор', false, 30).val, 30)
  assert.equal(core.restore('', true, 60).test, true)
})

t('очередь фиксированная: занятие, запущенное нажатием (моно), очередь не трогает — даже если стоит в ней первым', () => {
  const st = core.newState(false, 30)
  st.queue = ['🩸', '🧬', '🩸']
  core.toggle(st, 2, T)                                   // 🩸 вручную
  core.process(st, T + 90 * M)                            // три полных промежутка
  assert.deepEqual(st.queue, ['🩸', '🧬', '🩸'])
  assert.equal(st.out.filter(e => e.k === 'b').length, 3) // минуты 🩸 телефону уходят как раньше
  assert.equal(st.qs, null)                               // запись очереди не начиналась
})

t('моно-занятие: запись для журнала — число полных промежутков × ценность; меньше 60 минут не уходит; неполный промежуток не считается', () => {
  const mo = (s) => s.out.filter(e => e.k === 'mo')
  const st = core.newState(false, 30)
  core.toggle(st, 4, T)                                   // 🤖
  core.process(st, T + 100 * M)                           // три полных по 30
  core.toggle(st, 4, T + 100 * M)                         // стоп
  assert.equal(mo(st).length, 1)
  assert.equal(mo(st)[0].n, 3); assert.equal(mo(st)[0].v, 30); assert.equal(mo(st)[0].ts, T); assert.equal(core.EMOJI[mo(st)[0].i], '🤖')
  const s2 = core.newState(false, 20)                     // полтора круга при ценности 20 — один круг, 20 < 60
  core.toggle(s2, 0, T)
  core.toggle(s2, 0, T + 30 * M)
  assert.equal(mo(s2).length, 0)
  const s3 = core.newState(false, 10)                     // ценность 10: шесть кругов = 60 — уходит; запуск другого занятия тоже закрывает моно
  core.toggle(s3, 1, T)
  core.process(s3, T + 65 * M)
  core.toggle(s3, 4, T + 65 * M)
  assert.equal(mo(s3).length, 1); assert.equal(mo(s3)[0].n, 6)
  const back = core.newState(false, 30)                   // идущее моно переживает перезапуск приложения
  core.toggle(back, 2, T)
  const again = core.restore(JSON.stringify(back), false, 30)
  assert.equal(again.mono.n, 0); assert.equal(again.mono.i, 2)
})

t('очередь хранится вместе с состоянием, чистится от лишнего и не длиннее 12', () => {
  const st = core.newState(false, 60)
  st.queue = ['🩸', '🏠', '🤖']
  const back = core.restore(JSON.stringify(st), false, 60)
  assert.deepEqual(back.queue, ['🩸', '🏠', '🤖'])
  assert.deepEqual(core.cleanQueue(['🩸', '🍀', '🔍', 'x', 5, '💀']), ['🩸', '💀'])   // 🍀, 🔍 и мусор не попадают
  assert.deepEqual(core.cleanQueue(['🧭', '🏠']), ['🤖', '🏠'])                     // 🧭 из прежних версий — это 🤖
  assert.equal(core.cleanQueue(new Array(30).fill('🩸')).length, 12)
  assert.deepEqual(core.cleanQueue(undefined), [])
  // события «новая очередь» из версии 15 и «подарок» (до 1.14.0) при загрузке выбрасываются, остальные остаются
  const old = core.newState(false, 60)
  old.out = [{ id: 'qs-1', k: 'qs', ts: T, q: ['🩸'], tried: 0 }, { id: 'g-1', k: 'g', ts: T, tried: 0 }, { id: 'b0-1', k: 'b', i: 0, ts: T, ms: M, f: 1, x: 0, tried: 0 }]
  const r = core.restore(JSON.stringify(old), false, 60)
  assert.deepEqual(r.out.map((e) => e.id), ['b0-1'])
})

t('ценность 15 минут: промежуток и минуты для телефона', () => {
  const st = core.newState(false, 15)
  assert.equal(st.val, 15)
  assert.equal(core.valueMs(st), 15 * M)
  core.toggle(st, 0, T)
  const r = core.process(st, T + 15 * M)
  assert.equal(r.events.length, 1)
  assert.equal(r.events[0].ms, 15 * M)
  assert.equal(core.label(st, 15 * M), '15')
  const back = core.restore(JSON.stringify(st), false, 60)
  assert.equal(back.val, 15)
})

t('эмодзи занятий: 🧬 💀 🩸 / 🏠 🤖 📖 (🏠 — обычное занятие, 🧭 / 🍀 / 🔍 нет)', () => {
  assert.deepEqual(core.EMOJI, ['🧬', '💀', '🩸', '🏠', '🤖', '📖'])
  assert.equal(core.EMOJI.length, core.COUNT)
  assert.equal(core.SLOT_LEN, 6)
  // очередь из версии до 6 (другие эмодзи) при загрузке сбрасывается, таймеры и ценность остаются как есть
  const oldSave = JSON.stringify({ v: 5, val: 45, run: [T, 0, 0, 0, 0, 0], q: { k: '', s: 0, run: 0 }, out: [], queue: ['🧬', '📖'] })
  const back = core.restore(oldSave, false, 60)
  assert.deepEqual(back.queue, [])
  assert.equal(back.val, 45)
})

t('перенос состояния версии 6 (1.22.0): занятия переставлены, серый таймер — это 🏠, события и очередь переписаны, покупки и подарки выброшены', () => {
  const old = {
    v: 6, test: false, auto: false, ta: 0, val: 30, run: [0, 0, 0, 0, T, 0], q: { k: '', s: 0, run: 0 },
    out: [{ id: 'a', k: 'b', i: 3, ts: T, ms: M, f: 1, tried: 0 }, { id: 'b', k: 'b', i: 6, ts: T, ms: M, f: 1, tried: 0 }, { id: 'c', k: 'p', e: '🌴', c: 1, ts: T, tried: 0 },
      { id: 'd', k: 'b', i: 7, ts: T, ms: M, f: 1, tried: 0 }, { id: 'e', k: 'b', i: 4, ts: T, ms: M, f: 1, tried: 0 }],
    queue: ['🧭', '🏠', '🔍', '🤖'], qs: null, mono: { i: 4, t0: T, n: 1, val: 30, x: 0 }, hold: null, fb: 5, fp: {}, sh: null
  }
  const r = core.restore(JSON.stringify(old), false, 60)
  assert.equal(r.v, core.STATE_V)
  assert.equal(r.run[4], T)                                           // шла 🧭 (теперь 🤖)
  assert.equal(r.mono.i, 4)
  assert.deepEqual(r.out.map((e) => [e.id, core.EMOJI[e.i]]), [['a', '🤖'], ['b', '🏠'], ['e', '🤖']])   // 🤖 было 3, 🏠 было 6, 🧭 -> 🤖; 🍀 / покупка выброшены
  assert.deepEqual(r.queue, ['🤖', '🏠', '🤖'])
  assert.equal(r.sh, undefined)
  assert.equal(r.fb, undefined)
  const gray = core.restore(JSON.stringify({ ...old, run: [0, 0, 0, 0, 0, 0], q: { k: 'y', s: 1, run: T }, mono: { i: 6, t0: T, n: 0, val: 30, x: 0 } }), false, 60)
  assert.equal(gray.run[3], T)                                        // идущий серый таймер продолжается как 🏠 с того же места круга
  assert.equal(gray.mono.i, 3)
  assert.equal(gray.q.s, 0)
})

t('автостарт: занятия идут по очереди, каждое один промежуток, в конце очереди автостарт выключается', () => {
  const st = core.newState(false, 30)
  st.queue = ['🧬', '🩸', '🤖']
  core.startAuto(st, T)
  assert.equal(st.auto, true)
  assert.equal(st.run[0], T)
  assert.equal(core.process(st, T + 29 * M).events.length, 0)
  const r1 = core.process(st, T + 30 * M)
  assert.equal(r1.events.length, 1)
  assert.equal(r1.events[0].i, 0)
  assert.equal(r1.events[0].ms, 30 * M)                     // телефону — полная ценность 🩸
  assert.equal(r1.fresh, true)
  assert.deepEqual(st.queue, ['🩸', '🤖'])
  assert.equal(st.run[0], 0)
  assert.equal(st.run[2], T + 30 * M)                        // следующее началось ровно в момент окончания прежнего
  assert.equal(st.auto, true)
  core.process(st, T + 60 * M)
  assert.equal(st.run[4], T + 60 * M)
  assert.deepEqual(st.queue, ['🤖'])
  const r3 = core.process(st, T + 90 * M)
  assert.equal(r3.events[0].i, 4)
  assert.deepEqual(st.queue, [])
  assert.equal(st.auto, false)
  assert.equal(core.anyRunning(st), false)                   // очередь кончилась — ничего не идёт, по кругу не крутится
  assert.equal(st.out.filter(e => e.k === 'b').length, 3)   // три события занятий (плюс запись очереди «qr», она отдельная)
})

t('автостарт: экран был выключен — пропущенные занятия засчитываются с настоящим временем, лишнего не запускается', () => {
  const st = core.newState(false, 30)
  st.queue = ['🧬', '🩸', '🤖']
  core.startAuto(st, T)
  const r = core.process(st, T + 100 * M)
  assert.deepEqual(r.events.map((e) => e.i), [0, 2, 4])
  assert.deepEqual(r.events.map((e) => e.ts), [T + 30 * M, T + 60 * M, T + 90 * M])
  assert.equal(r.fresh, false)                               // сигнал подаётся только для свежих событий
  assert.equal(st.auto, false)
  assert.equal(core.anyRunning(st), false)
  // середина очереди: два занятия засчитаны, третье идёт
  const s2 = core.newState(false, 30)
  s2.queue = ['🧬', '🩸', '🤖']
  core.startAuto(s2, T)
  core.process(s2, T + 70 * M)
  assert.equal(s2.auto, true)
  assert.equal(s2.run[4], T + 60 * M)
  assert.deepEqual(s2.queue, ['🤖'])
})

t('автостарт: стоп занятия (нажатие, другое занятие, остановка совсем) выключает автостарт', () => {
  const mk = () => { const s = core.newState(false, 30); s.queue = ['🧬', '🩸', '🤖']; core.startAuto(s, T); return s }
  const a = mk()
  core.toggle(a, 0, T + 10 * M)                              // стоп идущего
  assert.equal(a.auto, false)
  assert.equal(core.anyRunning(a), false)
  assert.deepEqual(a.queue, ['🧬', '🩸', '🤖'])              // очередь не тронута
  assert.equal(a.out.length, 1)                              // пройденное время ушло
  assert.equal(a.out[0].ms, 10 * M)
  const b = mk()
  core.toggle(b, 3, T + 10 * M)                              // другое занятие
  assert.equal(b.auto, false)
  assert.equal(b.run[3], T + 10 * M)
  assert.equal(b.run[0], 0)
})

t('автостарт: включается только когда ничего не идёт и очередь не пуста', () => {
  const a = core.newState(false, 30)
  core.startAuto(a, T)
  assert.equal(a.auto, false)                                // очередь пуста
  const b = core.newState(false, 30)
  b.queue = ['🩸']
  core.toggle(b, 3, T)
  core.startAuto(b, T + M)
  assert.equal(b.auto, false)                                // уже что-то идёт
  assert.equal(b.run[2], 0)
  // «автостарт включён, но ничего не идёт» (битое сохранение) — выключается сам
  const c = core.newState(false, 30)
  c.auto = true
  core.process(c, T)
  assert.equal(c.auto, false)
})

t('автостарт: будильники — первая граница и сколько их ещё впереди', () => {
  const st = core.newState(false, 30)
  st.queue = ['🧬', '🩸', '🤖']
  core.startAuto(st, T)
  const d = core.nextDue(st)
  assert.equal(d.length, 1)
  assert.equal(d[0].t, T + 30 * M)
  assert.equal(d[0].kind, 'hour')
  assert.equal(d[0].n, 2)                                    // границ три: первая — этот будильник, ещё две — цепочкой службы
  core.process(st, T + 30 * M)
  assert.equal(core.nextDue(st)[0].n, 1)
  assert.equal(core.nextDue(st)[0].t, T + 60 * M)
  // обычные занятия — без n (цепочка без ограничения, как раньше)
  const o = core.newState(false, 30)
  core.toggle(o, 0, T)
  assert.equal(core.nextDue(o)[0].n, undefined)
})

t('тестовый режим: включается только когда ничего не идёт; всё по 20 секунд, телефону — полная ценность; переживает перезапуск', () => {
  const st = core.newState(false, 45)
  assert.equal(core.toggleTest(st), true)
  assert.equal(st.test, true)
  assert.equal(core.fullMs(st), 20000)
  core.toggle(st, 3, T)
  assert.equal(core.toggleTest(st), false)                   // идёт занятие — режим не меняется
  assert.equal(st.test, true)
  const r = core.process(st, T + 20000)
  assert.equal(r.events.length, 1)
  assert.equal(r.events[0].ms, 45 * M)                       // как будто прошла вся ценность 🩸
  assert.equal(r.events[0].x, 1)
  assert.equal(core.label(st, 20000), '20')                  // на кнопке секунды
  core.toggle(st, 3, T + 30000)
  const back = core.restore(JSON.stringify(st), false, 60)
  assert.equal(back.test, true)
  assert.equal(core.toggleTest(back), true)
  assert.equal(back.test, false)
  // зелёная пауза в тесте — тоже 20 секунд
  assert.equal(core.ovLen(core.newState(true, 30)), 20000)
  assert.equal(core.ovLen(core.newState(false, 30)), 5 * M)
  // автостарт в тесте: каждое занятие 20 секунд
  const a = core.newState(true, 60)
  a.queue = ['🧬', '🩸']
  core.startAuto(a, T)
  const ra = core.process(a, T + 40000)
  assert.deepEqual(ra.events.map((e) => e.ms), [60 * M, 60 * M])
  assert.equal(a.auto, false)
})

t('вызов очереди из ячейки долгим нажатием: пусто / другая — заменить шестью; ровно эти шесть — удвоить (12); уже удвоено — ничего', () => {
  const A = ['🧬', '💀', '🩸', '🤖', '🤖', '📖']
  const B = ['📖', '🤖', '🤖', '🩸', '💀', '🧬']
  assert.deepEqual(core.slotQueue([], A), A)                               // очередь пуста — шесть из ячейки
  assert.deepEqual(core.slotQueue(A, A), A.concat(A))                      // та же ячейка ещё раз — удвоение до 12
  assert.equal(core.slotQueue(A.concat(A), A), null)                       // третье нажатие ничего не делает
  assert.deepEqual(core.slotQueue(A, B), B)                                // другая ячейка заменяет очередь
  assert.deepEqual(core.slotQueue(A.concat(A), B), B)                      // и удвоенную тоже
  assert.deepEqual(core.slotQueue(['🏠', '🔍'], A), A)                     // любая другая очередь — тоже замена
  assert.deepEqual(core.slotQueue(A.slice(1), A), A)                       // из шести уже убрано занятие (конец промежутка) — не «ровно эти шесть»: замена
  assert.equal(core.slotQueue(A, []), null)                                // пустая ячейка — ничего
  assert.equal(core.slotQueue(A, A.slice(0, 5)), null)                     // в ячейке не шесть — ничего
  assert.equal(core.slotQueue(A.concat(A, A), A), null)                    // очередь длиннее 12 обрезается до 12 — это удвоенная ячейка
  const q = core.slotQueue(A, A)
  assert.equal(q.length, core.QUEUE_MAX)                                    // удвоенная очередь помещается ровно
})

t('запись очереди для телефона: уходит один раз — при удалении недоделанной и при полном выполнении', () => {
  const Q = ['📖', '🏠', '📖', '🏠', '📖', '🏠']
  const st = core.newState(false, 30)
  st.queue = Q.slice()
  st.auto = true; st.ta = T
  core.startAuto(st, T)
  core.process(st, T + 3 * 30 * M + 10 * M)          // три занятия готовы, четвёртое на середине
  assert.equal(st.queue.length, 3)
  assert.equal(st.out.filter(e => e.k === 'qr').length, 0)   // в очереди ещё есть эмодзи — телефону ничего
  st.auto = false
  const ev = core.setQueue(st, [], T + 4 * 30 * M)    // очередь удалена
  assert.equal(ev.k, 'qr'); assert.equal(ev.ts, T); assert.equal(ev.v, 30)
  assert.equal(ev.q, Q.join('')); assert.equal(ev.m, '111000')
  assert.equal(st.qs, null)
  const st2 = core.newState(false, 30)
  st2.queue = Q.slice()
  core.startAuto(st2, T)
  core.process(st2, T + 6 * 30 * M)                    // выполнено всё
  const all = st2.out.filter(e => e.k === 'qr')
  assert.equal(all.length, 1); assert.equal(all[0].m, '111111'); assert.equal(all[0].ts, T)
  const st3 = core.newState(false, 30)
  st3.queue = Q.slice()
  assert.equal(core.setQueue(st3, [], T), null)       // ничего не выполнено — записи нет
})

t('нажатие на экран = временная пауза 🩸: занятие замораживается, автостарт ждёт, возврат с того же места; 🩸 — моно и в журнал от часа', () => {
  // моно 🤖 (ценность 30): 10 минут прошло, нажатие -> 🩸 идёт 65 минут, нажатие -> 🤖 продолжает с 10-й минуты
  const st = core.newState(false, 30)
  core.toggle(st, 4, T)
  core.tapOverlay(st, T + 10 * M)
  assert.equal(st.run[4], 0)
  assert.equal(st.run[2], T + 10 * M)
  assert.equal(core.overlayKind(st), 'a')
  core.tapOverlay(st, T + 75 * M)
  assert.equal(st.hold, null)
  assert.equal(st.run[2], 0)
  assert.equal(st.run[4], T + 65 * M)                      // 75 - 10: круг продолжается с той же минуты
  assert.equal(core.remaining(st, 4, T + 75 * M), 20 * M)
  const mo = st.out.filter(e => e.k === 'mo')
  assert.equal(mo.length, 1)                               // два полных круга 🩸 по 30 = 60 >= 60
  assert.equal(core.EMOJI[mo[0].i], '🩸')
  assert.equal(mo[0].n, 2)
  assert.equal(st.mono.i, 4)                               // моно 🤖 продолжается
  // автостарт: 🏠 первым — пауза не закрывает его, возврат включает автостарт
  const sa = core.newState(false, 30)
  sa.queue = ['🏠', '📖']
  core.startAuto(sa, T)
  core.tapOverlay(sa, T + 5 * M)
  assert.equal(sa.auto, false)
  assert.equal(sa.q.s, 0)
  assert.equal(sa.hold.a, 3)                               // 🏠 — обычное занятие, замораживается как все
  core.process(sa, T + 50 * M)                             // 🩸 идёт, очередь не двигается
  assert.deepEqual(sa.queue, ['🏠', '📖'])
  core.tapOverlay(sa, T + 50 * M)
  assert.equal(sa.auto, true)
  assert.equal(sa.run[3], T + 45 * M)
  core.process(sa, T + 75 * M)                             // 🏠 закрылся на 30-й минуте своего круга, пошёл 📖
  assert.deepEqual(sa.queue, ['📖'])
  // 🩸 уже идёт обычным запуском — нажатие ничего не делает; остановить совсем во время паузы отпускает замороженное
  const sb = core.newState(false, 30)
  core.toggle(sb, 2, T)
  assert.equal(core.tapOverlay(sb, T + M).changed, false)
  const sc = core.newState(false, 30)
  core.toggle(sc, 4, T)
  core.tapOverlay(sc, T + 10 * M)
  core.stopAll(sc, T + 20 * M)
  assert.equal(sc.hold, null)
  assert.equal(core.anyRunning(sc), false)
  assert.equal(sc.out.filter(e => e.k === 'b' && e.f === 0).length, 2)   // и 🩸, и замороженное 🤖 отправили пройденное
  // перезапуск приложения в паузе ничего не теряет
  const sd = core.newState(false, 30)
  sd.queue = ['🤖', '📖']
  core.startAuto(sd, T)
  core.tapOverlay(sd, T + 7 * M)
  const sr = core.restore(JSON.stringify(sd), false, 30)
  assert.equal(sr.hold.a, 4)
  assert.equal(sr.hold.auto, true)
  assert.equal(sr.hold.el, 7 * M)
})


// ===================== ЗЕЛЁНАЯ ПАУЗА НА ПЯТЬ МИНУТ (1.23.0) =====================
t('🏠 — обычное занятие: свой розовый экран, круг по ценности 🩸, событие blood-вида для 🏠, очередь не трогает (моно)', () => {
  const st = core.newState(false, 30)
  st.queue = ['🏠', '🧬']
  core.toggle(st, 3, T)
  assert.equal(core.overlayKind(st), 'a')
  assert.equal(core.EMOJI[core.activeIdx(st)], '🏠')
  const r = core.process(st, T + 30 * M)
  assert.equal(r.events.length, 1)
  assert.equal(core.EMOJI[r.events[0].i], '🏠')
  assert.equal(r.events[0].ms, 30 * M)
  assert.deepEqual(st.queue, ['🏠', '🧬'])
})

t('пауза: идёт занятие — по нажатию на верх весь экран зелёный, занятие заморожено, цифры 05:00, телефону ничего не уходит', () => {
  const st = core.newState(false, 30)
  core.toggle(st, 4, T)
  const r = core.startPause(st, T + 10 * M)
  assert.equal(r.changed, true)
  assert.equal(core.overlayKind(st), 'g')
  assert.equal(st.run[4], 0)
  assert.equal(st.hold.el, 10 * M)
  assert.equal(core.clock(core.ovLeftAny(st, T + 10 * M)), '05:00')
  assert.equal(core.clock(core.ovLeftAny(st, T + 12 * M + 1000)), '02:59')
  assert.deepEqual(core.ovTop(st), [])                                   // на зелёном экране очереди и значков нет
  assert.equal(core.activeIdx(st), -1)
  assert.equal(core.anyRunning(st), true)
  assert.equal(st.out.length, 0)
  assert.equal(core.startPause(st, T + 11 * M).changed, false)            // вторая пауза поверх — ничего
  assert.equal(core.tapOverlay(st, T + 11 * M).changed, false)            // нажатие 🩸 на зелёном — ничего
})

t('пауза кончилась (5 минут): само возвращается розовый экран, занятие продолжается с того же места круга, ovDone / ovFresh для вибрации', () => {
  const st = core.newState(false, 30)
  core.toggle(st, 4, T)
  core.startPause(st, T + 10 * M)
  assert.equal(core.process(st, T + 14 * M + 59000).ovDone, false)
  const r = core.process(st, T + 15 * M + 2000)
  assert.equal(r.ovDone, true); assert.equal(r.ovKind, 'g'); assert.equal(r.ovFresh, true)
  assert.equal(core.overlayKind(st), 'a')
  assert.equal(st.hold, null)
  assert.equal(st.run[4], T + 5 * M)                                      // пауза не засчитана: осталось 20 минут круга, как и было
  assert.equal(core.remaining(st, 4, T + 15 * M), 20 * M)
  assert.equal(st.mono.i, 4)
  assert.equal(st.out.length, 0)
})

t('пауза и закрытое приложение: пауза кончилась давно — занятие вернулось в момент её конца, пропущенные границы засчитаны с настоящим временем', () => {
  const st = core.newState(false, 30)
  core.toggle(st, 4, T)
  core.startPause(st, T + 10 * M)
  const r = core.process(st, T + 100 * M)
  assert.deepEqual(r.events.map((e) => (e.ts - T) / M), [35, 65, 95])   // конец паузы на 15-й минуте, до границы ещё 20 минут
  assert.equal(r.ovDone, true); assert.equal(r.ovFresh, false)
  assert.equal(st.mono.n, 3)
})

t('пауза: нажатие на зелёный экран возвращает занятие раньше срока; долгое — остановка совсем (пройденное шлётся, моно-запись тоже)', () => {
  const st = core.newState(false, 30)
  core.toggle(st, 0, T)
  core.startPause(st, T + 10 * M)
  const e = core.endPause(st, T + 12 * M)
  assert.equal(e.changed, true)
  assert.equal(core.overlayKind(st), 'a')
  assert.equal(st.run[0], T + 2 * M)                                      // осталось 20 минут
  assert.equal(core.endPause(st, T + 13 * M).changed, false)              // пауза уже кончилась
  const s2 = core.newState(false, 30)
  core.toggle(s2, 0, T)
  core.startPause(s2, T + 40 * M)                                         // один полный круг и 10 минут
  core.stopAll(s2, T + 42 * M)
  assert.equal(core.overlayKind(s2), '')
  assert.equal(s2.hold, null); assert.equal(s2.q.s, 0)
  assert.deepEqual(s2.out.filter((x) => x.k === 'b').map((x) => [x.f, x.ms / M]), [[1, 30], [0, 10]])
  assert.equal(s2.out.filter((x) => x.k === 'mo').length, 0)              // 30 минут < 60 — в журнал не идёт
})

t('пауза и автостарт: очередь стоит, автостарт возвращается после паузы и идёт по очереди; пауза не закрывает занятие', () => {
  const st = core.newState(false, 30)
  st.queue = ['🏠', '🤖', '📖']
  core.startAuto(st, T)
  core.startPause(st, T + 10 * M)
  assert.equal(st.auto, false); assert.equal(st.hold.auto, true)
  assert.deepEqual(st.queue, ['🏠', '🤖', '📖'])
  core.process(st, T + 14 * M)
  assert.deepEqual(core.ovTop(st), [])
  core.process(st, T + 16 * M)
  assert.equal(st.auto, true)
  assert.equal(st.run[3], T + 5 * M)
  assert.deepEqual(core.ovTop(st), ['🏠', '🤖', '📖'])                    // розовый: снова остаток очереди
  core.process(st, T + 36 * M)                                            // 🏠 закрылся на 35-й минуте, пошёл 🤖
  assert.deepEqual(st.queue, ['🤖', '📖'])
  assert.equal(st.run[4], T + 35 * M)
})

t('пауза и 🩸-пауза не мешают друг другу: во время 🩸-паузы зелёную не включить; зелёную можно включить на 🩸, идущем обычным запуском', () => {
  const st = core.newState(false, 30)
  core.toggle(st, 4, T)
  core.tapOverlay(st, T + 5 * M)                                          // 🩸 вместо 🤖
  assert.equal(core.startPause(st, T + 6 * M).changed, false)
  const s2 = core.newState(false, 30)
  core.toggle(s2, 2, T)
  assert.equal(core.startPause(s2, T + 6 * M).changed, true)
  core.process(s2, T + 12 * M)
  assert.equal(s2.run[2], T + 5 * M)                                       // пауза 6-я — 11-я минуты, круг продолжается с 6-й
  assert.equal(core.startPause(core.newState(false, 30), T).changed, false)   // ничего не идёт — паузы нет
})

t('пауза: тестовый режим — 20 секунд; сохранение и восстановление; будильники — конец паузы и конец круга после неё', () => {
  const st = core.newState(true, 30)
  core.toggle(st, 4, T)
  core.startPause(st, T + 5000)
  assert.equal(core.process(st, T + 24000).ovDone, false)
  assert.equal(core.process(st, T + 25000).ovDone, true)
  const s = core.newState(false, 30)
  core.toggle(s, 4, T)
  core.startPause(s, T + 10 * M)
  const back = core.restore(JSON.stringify(s), false, 60)
  assert.equal(core.overlayKind(back), 'g')
  assert.equal(back.hold.el, 10 * M); assert.equal(back.hold.z, 1)
  assert.equal(back.mono, null)                                              // моно хранится в паузе, а не в состоянии
  assert.equal(back.hold.mono.i, 4)
  const plan = core.alarmPlan(s, 3)
  const kinds = plan.filter((p) => p.url === 'app-service/alarm').map((p) => p.param.split('|')[0] + '@' + Math.round((+p.param.split('|')[1] * 1000 - T) / M))
  assert.deepEqual(kinds.slice(0, 2), ['quick@15', 'hour@35'])
  const bad = JSON.parse(JSON.stringify(s)); bad.hold = null                  // зелёный экран без замороженного занятия — мусор
  assert.equal(core.overlayKind(core.restore(JSON.stringify(bad), false, 60)), '')
})

if (bad) { console.log('\nПровалено: ' + bad); process.exit(1) }
console.log('\nВсе проверки ядра пройдены: ' + n)
