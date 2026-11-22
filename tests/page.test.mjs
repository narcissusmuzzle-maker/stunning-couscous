// Прогон настоящего page/index.js на заглушках API часов: главный экран (🧬 💀 🩸 / 🏠 🤖 📖, очередь одного размера в один-два ряда, полоска сверху — автостарт),
// ввод очереди, вызов очереди из ячейки долгим нажатием, зоны очереди, розовый экран занятия, пауза 🩸, зелёная пятиминутная пауза.
// Запуск: node --import ./tests/register.mjs tests/page.test.mjs   (из папки приложения)
import assert from 'node:assert'

let n = 0
async function t(name, f) { await f(); n++; console.log('ok  ' + name) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const alive = () => globalThis.__W.filter((w) => w.alive)
const shown = () => alive().filter((w) => w.visible)
const buttons = () => shown().filter((w) => w.type === 'BUTTON')
const texts = () => shown().filter((w) => w.type === 'TEXT').map((w) => w.props.text)
const imgs = () => shown().filter((w) => w.type === 'IMG').map((w) => w.props.src)
// время страницы можно «перематывать»: Date.now() сдвигается на skew (иначе пять минут не дождаться)
let skew = 0
const realNow = Date.now
Date.now = () => realNow() + skew
const press = (w) => w.props.click_func()
const hold = (w) => w.props.longpress_func()
const byImg = (src) => buttons().find((w) => w.props.normal_src === src)
// полоска над очередью (чёрная кнопка на всю ширину, невысокая): на главном экране; обычное нажатие — автостарт
const topBtn = () => buttons().find((w) => w.props.w === 432 && w.props.h < 200 && w.props.text === '' && w.props.normal_color === 0)
// три зоны очереди (чёрные кнопки без картинки, не 120 и не 432 шириной), слева направо
const zoneBtn = (c) => buttons().filter((w) => w.props.normal_color === 0 && w.props.text === '' && w.props.w < 432 && w.props.w !== 120 && !w.props.normal_src).sort((a, b) => a.props.x - b.props.x)[c]
// значки очереди на экране: номера эмодзи в порядке чтения (сверху вниз, слева направо); 6 — значок 🔄
const queueBtns = () => buttons().filter((w) => /^q\d\.png$/.test(String(w.props.normal_src))).sort((a, b) => a.props.y - b.props.y || a.props.x - b.props.x)
const queueNow = () => queueBtns().map((w) => +String(w.props.normal_src)[1])
const PINK = 0xffbfe1
const GREEN = 0x3bf76d
const runBtn = () => buttons().find((w) => w.props.normal_color === PINK && w.props.w === 396)      // розовый экран с цифрами: идёт занятие
const pinkTop = () => buttons().find((w) => w.props.normal_color === PINK && w.props.w === 432)    // верхняя часть розового экрана (зелёная пауза)
const greenBtn = () => buttons().find((w) => w.props.normal_color === GREEN && w.props.w === 396)  // зелёный экран с цифрами

const phone = { online: true, got: [] }
globalThis.__REQ = (p) => {
  phone.got.push(p)
  if (!phone.online) return Promise.reject(new Error('offline'))
  if (p.t === 'sync') return Promise.resolve({ ok: true, reply: { t: 'sync', f: { b: 0, p: {} }, g: { n: 0, h: 0 } } })
  return Promise.resolve({ ok: true, reply: { t: 'ack', id: p.id, f: { b: 0, p: {} }, g: { n: 0, h: 0 } } })
}
globalThis.Page = (o) => { globalThis.__PAGE = o }
await import('../page/index.js')
const page = globalThis.__PAGE
const sent = (type) => phone.got.filter((p) => p.t === type)

await t('запуск: главный экран построен, магазина, баланса 🌸 и серого экрана нет; розового и зелёного экранов на весь экран нет', async () => {
  page.onInit()
  page.build()
  await sleep(20)
  assert.equal(globalThis.__STATUSBAR, false)
  for (let i = 0; i < 6; i++) assert.equal(byImg('i' + i + '.png') !== undefined, true)   // шесть кнопок на месте
  const all = alive().map((w) => String(w.props.normal_src || w.props.src))
  assert.equal(all.some((s) => /^(sh\d|fl|fs|m\d)\.png$/.test(s)), false)                 // картинок магазина, цветочков и маленьких значков очереди нет
  assert.equal(shown().filter((w) => w.type === 'BUTTON' && [PINK, GREEN, 0x8c8c8c].includes(w.props.normal_color)).length, 0)
  assert.equal(shown().filter((w) => w.type === 'TEXT' && w.props.text !== '').length, 0)   // на главном экране нет ни баланса, ни цифр
})

await t('кнопки: 🧬 💀 🩸 / 🏠 🤖 📖 стоят там же, где стояли (первый ряд 192, второй 337 на странице со сдвигом экрана), размер 120', async () => {
  const y0 = byImg('i0.png').props.y
  assert.equal(byImg('i3.png').props.y - y0, 145)                 // кнопка 120 + зазор 25, как раньше
  assert.equal(byImg('i1.png').props.y, y0)
  assert.equal(byImg('i2.png').props.y, y0)
  assert.equal(byImg('i4.png').props.y, byImg('i3.png').props.y)
  assert.equal(byImg('i5.png').props.y, byImg('i3.png').props.y)
  assert.equal(byImg('i3.png').props.x, 8)                        // 🏠 — слева во втором ряду
  assert.equal(byImg('i4.png').props.x, 138)                      // 🤖 — по центру
  assert.equal(byImg('i5.png').props.x, 268)                      // 📖 — справа
  assert.equal(byImg('i0.png').props.w, 120)
  assert.equal(byImg('i6.png'), undefined)                        // 🧭 и прочих лишних кнопок нет
  const top = topBtn()
  assert.equal(top.props.y + top.props.h <= y0, true)             // полоска сверху над очередью и кнопками
})

await t('полоска сверху при пустой очереди: ничего; долгое нажатие на кнопки при пустых ячейках ничего не делает', async () => {
  press(topBtn())
  await sleep(10)
  assert.equal(runBtn(), undefined)
  for (let i = 0; i < 6; i++) hold(byImg('i' + i + '.png'))
  await sleep(10)
  assert.equal(queueNow().length, 0)
  assert.equal(runBtn(), undefined)
})

await sleep(2100)

await t('ввод очереди (долгое нажатие слева): кнопки вводят по одному эмодзи, долгое нажатие на кнопку сохраняет шесть в её ячейку, долгое справа сбрасывает введённое', async () => {
  hold(zoneBtn(0))
  await sleep(10)
  for (const k of [0, 1, 2, 3, 4, 5]) press(byImg('i' + k + '.png'))
  await sleep(10)
  assert.deepEqual(queueNow(), [0, 1, 2, 3, 4, 5])               // введённое видно на экране
  hold(byImg('i0.png'))                                          // ячейка кнопки 🧬
  await sleep(10)
  hold(zoneBtn(2))                                               // сбросить введённое
  await sleep(10)
  assert.deepEqual(queueNow(), [])
  for (const k of [5, 4, 3, 2, 1]) press(byImg('i' + k + '.png'))
  press(zoneBtn(1))                                              // центр во время ввода ничего не добавляет (🏠 теперь вводится своей кнопкой)
  press(zoneBtn(0))
  press(zoneBtn(2))
  await sleep(10)
  assert.deepEqual(queueNow(), [5, 4, 3, 2, 1])
  press(byImg('i3.png'))                                         // 🏠
  await sleep(10)
  assert.deepEqual(queueNow(), [5, 4, 3, 2, 1, 3])
  hold(byImg('i1.png'))                                          // ячейка кнопки 💀
  await sleep(10)
  hold(zoneBtn(0))                                               // выход: введённая очередь становится текущей
  await sleep(10)
  assert.deepEqual(queueNow(), [5, 4, 3, 2, 1, 3])
})

await t('долгое нажатие на кнопку вызывает очередь её ячейки: пусто / другая — замена шестью; те же шесть — удвоение (12); третий раз — ничего; другая ячейка — замена', async () => {
  const A = [0, 1, 2, 3, 4, 5]
  const B = [5, 4, 3, 2, 1, 3]
  hold(byImg('i1.png'))                                          // в очереди ровно B (ячейка 💀) — удваивается
  await sleep(10)
  assert.deepEqual(queueNow(), B.concat(B))
  hold(byImg('i1.png'))                                          // третье нажатие: ничего
  await sleep(10)
  assert.deepEqual(queueNow(), B.concat(B))
  hold(byImg('i0.png'))                                          // другая ячейка заменяет
  await sleep(10)
  assert.deepEqual(queueNow(), A)
  hold(byImg('i0.png'))
  await sleep(10)
  assert.deepEqual(queueNow(), A.concat(A))
  hold(byImg('i0.png'))
  await sleep(10)
  assert.deepEqual(queueNow(), A.concat(A))
  hold(byImg('i2.png'))                                          // пустая ячейка — очередь не меняется
  await sleep(10)
  assert.deepEqual(queueNow(), A.concat(A))
  hold(byImg('i1.png'))
  await sleep(10)
  assert.deepEqual(queueNow(), B)
})

await t('отпускание пальца после долгого нажатия на кнопку не запускает её таймер', async () => {
  hold(byImg('i0.png'))
  press(byImg('i0.png'))                                         // «отпускание» сразу после долгого нажатия на той же кнопке
  await sleep(10)
  assert.equal(runBtn(), undefined)
})

await t('автостарт — обычное нажатие на полоску над очередью; идёт розовый экран: нажатие — пауза 🩸 и возврат, долгое нажатие — остановка и выключение автостарта', async () => {
  await sleep(2100)
  hold(byImg('i1.png'))                                          // очередь = B, снова по ячейке 💀
  await sleep(10)
  const q = queueNow()
  assert.equal(q.length >= 6, true)
  press(topBtn())
  await sleep(30)
  assert.equal(runBtn() !== undefined, true)                     // занятие из начала очереди пошло
  assert.equal(runBtn().props.text.length, 5)                    // цифры мм:сс
  assert.deepEqual(queueNow().length > 0, true)                  // над цифрами остаток очереди
  assert.equal(imgs().includes('o' + q[0] + '.png'), true)       // под цифрами эмодзи идущего занятия
  const before = queueNow()
  press(runBtn())                                                // нажатие: временная пауза 🩸, очередь та же
  await sleep(30)
  assert.equal(imgs().includes('o2.png'), true)
  assert.deepEqual(queueNow(), before)
  press(runBtn())                                                // повторное нажатие: возврат
  await sleep(30)
  assert.equal(imgs().includes('o' + q[0] + '.png'), true)
  hold(runBtn())                                                 // стоп занятия — долгое нажатие
  await sleep(30)
  assert.equal(runBtn(), undefined)
})

await t('очередь, правая зона: обычное нажатие — журнал теста (14 строк), долгое на журнале закрывает; долгое на зоне — удалить очередь', async () => {
  press(zoneBtn(2))
  await sleep(10)
  assert.equal(buttons().filter((w) => w.props.text_size === 18).length >= 14, true)
  assert.equal(zoneBtn(0), undefined)                            // главный экран спрятан
  hold(buttons().find((w) => w.props.text_size === 18))
  await sleep(10)
  assert.equal(zoneBtn(0) !== undefined, true)
  assert.equal(queueNow().length > 0, true)
  hold(zoneBtn(2))                                               // долгое справа — удалить очередь (после остановки занятия автостарт выключен, иначе очередь не удалилась бы)
  await sleep(10)
  assert.deepEqual(queueNow(), [])
})

await t('очередь, центр: обычное нажатие ничего не делает (серого таймера больше нет), долгое — экран настройки ценности 🩸', async () => {
  press(zoneBtn(1))
  await sleep(30)
  assert.equal(runBtn(), undefined)
  assert.equal(buttons().some((w) => w.props.normal_color === 0x8c8c8c), false)
  assert.equal(zoneBtn(1) !== undefined, true)
  await sleep(900)
  hold(zoneBtn(1))
  await sleep(30)
  assert.equal(texts().includes('60 мин'), true)                 // экран настройки ценности
  const bg = buttons().find((w) => w.props.w === 432 && w.props.h > 400 && w.props.text === '' && w.props.normal_color === 0)
  hold(bg)                                                       // закрыть долгим нажатием
  await sleep(30)
  assert.equal(texts().includes('60 мин'), false)
  assert.equal(zoneBtn(1) !== undefined, true)
})

await t('очередь, левая зона: обычное нажатие — тестовый режим вкл / выкл (на кнопках секунды вместо минут)', async () => {
  await sleep(900)
  press(zoneBtn(0))                                              // тест включён
  await sleep(10)
  press(byImg('i2.png'))
  await sleep(30)
  const sec = runBtn()
  assert.equal(sec !== undefined && (sec.props.text === '00:20' || sec.props.text === '00:19'), true)   // цифры мм:сс
  hold(sec)                                                      // стоп — долгое нажатие
  await sleep(30)
  assert.equal(runBtn(), undefined)
  press(zoneBtn(0))                                              // тест выключен
  await sleep(900)                                               // после долгого нажатия (стоп) нажатие на кнопку считается отпусканием пальца
  press(byImg('i2.png'))
  await sleep(30)
  const min = runBtn()
  assert.equal(min !== undefined && (min.props.text === '60:00' || min.props.text === '59:59'), true)
  hold(min)
  await sleep(30)
  assert.equal(runBtn(), undefined)
})

await t('идёт 🩸 (обычный запуск): нажатие на цифры розового экрана ничего не делает; цифры мм:сс, внизу 🩸, вверху 🔄🩸', async () => {
  await sleep(900)
  press(byImg('i2.png'))                                         // занятие 🩸 идёт
  await sleep(30)
  assert.equal(runBtn() !== undefined, true)
  assert.equal(zoneBtn(0), undefined)                            // главный экран закрыт розовым
  assert.deepEqual(queueNow(), [6, 2])                           // 🔄🩸 над цифрами
  assert.equal(imgs().includes('o2.png'), true)                  // 🩸 под цифрами
  assert.equal(runBtn().props.color, 0xffffff)                   // цифры белые
  press(runBtn())                                                // 🩸 уже идёт — ничего не происходит
  await sleep(30)
  assert.equal(runBtn() !== undefined, true)
  assert.equal(imgs().includes('o2.png'), true)
  hold(runBtn())
  await sleep(30)
  assert.equal(runBtn(), undefined)
})

await t('🏠 — обычное занятие: кнопка запускает розовый экран с 🏠 (🔄🏠 сверху, o3 снизу); нажатие на цифры — пауза 🩸 и возврат; серого экрана нет', async () => {
  await sleep(900)
  press(byImg('i3.png'))
  await sleep(30)
  assert.equal(runBtn() !== undefined, true)
  assert.equal(buttons().some((w) => w.props.normal_color === 0x8c8c8c), false)
  assert.deepEqual(queueNow(), [6, 3])
  assert.equal(imgs().includes('o3.png'), true)
  press(runBtn())                                                // пауза 🩸
  await sleep(30)
  assert.deepEqual(queueNow(), [6, 2])
  assert.equal(imgs().includes('o2.png'), true)
  press(runBtn())                                                // возврат к 🏠
  await sleep(30)
  assert.deepEqual(queueNow(), [6, 3])
  hold(runBtn())
  await sleep(30)
  assert.equal(runBtn(), undefined)
})

await t('зелёная пауза: нажатие на верхнюю часть (над цифрами) — весь экран зелёный, белые цифры 05:00, без значков; нажатие на зелёный — назад к занятию', async () => {
  await sleep(900)
  press(byImg('i4.png'))                                         // 🤖
  await sleep(30)
  assert.equal(runBtn() !== undefined, true)
  assert.equal(pinkTop() !== undefined, true)                    // верхняя часть розового экрана есть
  assert.equal(pinkTop().props.h < 257, true)                    // и заканчивается выше цифр
  press(pinkTop())
  await sleep(30)
  assert.equal(runBtn(), undefined)
  assert.equal(pinkTop(), undefined)
  const g = greenBtn()
  assert.equal(g !== undefined, true)
  assert.equal(g.props.color, 0xffffff)                          // цифры белые
  assert.equal(g.props.text === '05:00' || g.props.text === '04:59', true)
  assert.equal(queueNow().length, 0)                             // значков очереди нет
  assert.equal(imgs().some((s) => /^o\d\.png$/.test(s)), false)   // и эмодзи под цифрами нет
  press(g)                                                       // вернуться раньше срока
  await sleep(30)
  assert.equal(greenBtn(), undefined)
  assert.equal(runBtn() !== undefined, true)
  assert.deepEqual(queueNow(), [6, 4])                           // 🔄🤖
  hold(runBtn())
  await sleep(30)
  assert.equal(runBtn(), undefined)
})

await t('зелёная пауза: значок очереди на розовом экране — тоже верхняя часть; пять минут прошли — вибрация-возврат: розовый экран сам, занятие с того же места; на телефон за паузу ничего не уходит', async () => {
  await sleep(900)
  const before = phone.got.length
  press(byImg('i5.png'))                                         // 📖
  await sleep(30)
  const icon = queueBtns()[0]                                    // значок 🔄 над цифрами
  press(icon)
  await sleep(30)
  assert.equal(greenBtn() !== undefined, true)
  skew += 5 * 60 * 1000 + 1500                                   // пять минут прошли
  await sleep(1300)
  assert.equal(greenBtn(), undefined)
  assert.equal(runBtn() !== undefined, true)                     // розовый экран вернулся сам
  assert.deepEqual(queueNow(), [6, 5])
  assert.equal(phone.got.slice(before).some((p) => p.t === 'blood' || p.t === 'done' || p.t === 'mlog'), false)   // пауза ничего не отправила
  hold(runBtn())                                                 // долгое нажатие — остановка
  await sleep(30)
  assert.equal(runBtn(), undefined)
})

await t('зелёная пауза: долгое нажатие на зелёный экран — остановка совсем, главный экран; верх розового при паузе 🩸 зелёную не включает', async () => {
  await sleep(900)
  press(byImg('i4.png'))
  await sleep(30)
  press(runBtn())                                                // пауза 🩸
  await sleep(30)
  press(pinkTop())                                               // зелёную поверх паузы 🩸 не включить
  await sleep(30)
  assert.equal(greenBtn(), undefined)
  press(runBtn())                                                // возврат
  await sleep(30)
  press(pinkTop())
  await sleep(30)
  hold(greenBtn())
  await sleep(30)
  assert.equal(greenBtn(), undefined)
  assert.equal(runBtn(), undefined)
  assert.equal(zoneBtn(0) !== undefined, true)                   // главный экран
  assert.equal(topBtn() !== undefined, true)
})

await t('очередь: один ряд и два ряда одного размера 60; верхний ряд стоит на одном месте, второй — под ним; 12 значков помещаются', async () => {
  await sleep(900)
  hold(zoneBtn(0))                                               // ввод очереди
  await sleep(10)
  for (let k = 0; k < 3; k++) press(byImg('i' + k + '.png'))
  await sleep(10)
  const one = queueBtns()
  assert.equal(one.length, 3)
  const y1 = one[0].props.y
  assert.equal(one.every((w) => w.props.w === 60 && w.props.h === 60 && w.props.y === y1), true)
  for (let k = 0; k < 9; k++) press(byImg('i' + (k % 6) + '.png'))
  await sleep(10)
  const two = queueBtns()
  assert.equal(two.length, 12)
  assert.equal(two.every((w) => w.props.w === 60 && w.props.h === 60), true)   // размер не уменьшился
  assert.equal(two[0].props.y, y1)                                              // верхний ряд — на том же месте
  assert.equal(two[6].props.y, y1 + 64)                                         // второй — ровно под ним (60 + 4)
  assert.equal(two[0].props.y < byImg('i0.png').props.y - 120, true)            // очередь заметно выше кнопок (место баланса занято очередью)
  hold(zoneBtn(0))                                                              // выход из ввода
  await sleep(10)
  hold(zoneBtn(2))                                                              // удалить очередь
  await sleep(10)
  assert.deepEqual(queueNow(), [])
})

page.onDestroy()
console.log('\nВсе проверки страницы пройдены: ' + n)
process.exit(0)
