/**
 * Раскладка экрана (чистые функции, без обращений к API часов — проверяются тестами в Node).
 *
 * Рабочая область — прямоугольник 0..H по высоте. Если системная полоска сверху скрыта (setStatusBarVisible(false)),
 * H = весь экран, 514 px. Если полоска есть, система сжимает страницу до 450 px (514 - 64). Свою высоту можно задать
 * на телефоне: LuvU613 -> ⚙️ -> «Вид на часах» (приходит в ответе на «sync», поле v.h).
 */
export const FULL_H = 514
export const MIN_H = 300
export const MAX_H = 600

/** Высота рабочей области: целое от MIN_H до MAX_H, иначе весь экран. */
export function cleanH(h) {
  const n = Math.round(+h)
  return n >= MIN_H && n <= MAX_H ? n : FULL_H
}

/** Высота одной из трёх равных строк экрана (очередь / верхний ряд / нижний ряд). */
export function rowH(h) { return Math.floor(h / 3) }

/**
 * Значки очереди (с 1.23.0 один размер для любого числа): 60 px, шаг 64. До 6 штук — один ряд, от 7 до 12 — два ряда ТОГО ЖЕ размера
 * (раньше второй ряд делал значки мельче, 44 px). Верхний ряд стоит на одном и том же месте и при одном ряду, и при двух; второй ряд —
 * ровно под ним. Ряды делят очередь поровну (7 — 4 + 3, 12 — 6 + 6), читаются слева направо и сверху вниз.
 * Место для двух рядов (Q_BLOCK) занимает то, что раньше занимала строка баланса 🌸 и верх прежнего блока очереди.
 */
export const Q_SIZE = 60
export const Q_STEP = 64
export const Q_ONE_MAX = 6
export const Q_VGAP = 4
export const Q_BLOCK = 2 * Q_SIZE + Q_VGAP     // 124: высота блока очереди (два ряда значков)
export const OLD_BLOCK = 90                    // высота прежнего блока очереди (до 1.23.0): от неё зависят зазоры, а значит и места кнопок — кнопки стоят там же
export const BTN = 120                         // сторона кнопки занятия
export const MIN_GAP = 6                       // меньше этого зазор между блоками экрана не сжимается

/** Сколько значков в каждом ряду: [n] или [верхний, нижний]. */
export function queueRows(n) {
  if (n <= Q_ONE_MAX) return [n]
  return [Math.ceil(n / 2), Math.floor(n / 2)]
}

/**
 * Места значков очереди по порядку: [{ x, y, s }] (s — размер значка, всегда Q_SIZE). cx — середина экрана по горизонтали,
 * qTop — верх блока очереди высотой Q_BLOCK. Верхний ряд стоит у самого верха блока, второй (если он нужен) — под ним.
 */
export function queuePlaces(n, cx, qTop) {
  const out = []
  if (n <= 0) return out
  const rows = queueRows(n)
  for (let r = 0; r < rows.length; r++) {
    const x0 = queueX0(rows[r], cx, Q_SIZE, Q_STEP)
    for (let j = 0; j < rows[r]; j++) out.push({ x: x0 + j * Q_STEP, y: qTop + r * (Q_SIZE + Q_VGAP), s: Q_SIZE })
  }
  return out
}

/** x левого значка очереди: n значков с шагом step и размером size стоят по центру cx. */
export function queueX0(n, cx, size, step) {
  const k = n > 0 ? n : 1
  return Math.round(cx - ((k - 1) * step + size) / 2)
}

/** Верх блока высотой block, стоящего по вертикали по центру области высотой h (не выше нуля). */
export function centerTop(h, block) { return Math.max(0, Math.round((h - block) / 2)) }

/** Предел сдвига строки по вертикали (пикселей вверх / вниз от обычного положения). */
export const MAX_OFF = 250

/** Сдвиг строки: целое число пикселей от -MAX_OFF до MAX_OFF, мусор — 0 (как раньше). */
export function cleanOff(n) {
  const v = Math.round(+n)
  return isFinite(v) ? Math.max(-MAX_OFF, Math.min(MAX_OFF, v)) : 0
}

/**
 * Верх предмета высотой size в строке r (0, 1, 2 — три равные трети экрана): по центру своей трети плюс сдвиг off.
 * Предмет не выходит за экран: верх не меньше 0, низ не ниже h.
 */
export function itemY(h, r, size, off) {
  const row = rowH(h)
  const y = row * r + Math.round((row - size) / 2) + cleanOff(off)
  return Math.max(0, Math.min(h - size, y))
}

/**
 * Настройки вида с телефона -> проверенные значения:
 *  h — высота рабочей области, hide — скрыть системную полоску (1 / 0), vib — вибрировать при включённом экране (1 / 0),
 *  y0, y1, y2 — сдвиг трёх строк по вертикали в пикселях (0 — как раньше).
 */
export function cleanView(v) {
  return {
    h: cleanH(v && v.h),
    hide: !v || v.hide === undefined ? 1 : (v.hide ? 1 : 0),
    vib: !v || v.vib === undefined ? 1 : (v.vib ? 1 : 0),
    y0: cleanOff(v && v.y0),
    y1: cleanOff(v && v.y1),
    y2: cleanOff(v && v.y2)
  }
}

/**
 * Три зоны по горизонтали (левая / центр / правая) — как три столбца кнопок занятий. Границы стоят посередине зазоров между столбцами:
 * left — отступ слева, cell — ширина кнопки, gap — зазор. Возвращает [граница 1, граница 2].
 */
export function zoneEdges(left, cell, gap) {
  const half = Math.floor(gap / 2)
  return [left + cell + half, left + 2 * cell + gap + half]
}

/** В какую зону (0 — левая, 1 — центр, 2 — правая) попадает x. */
export function zoneOf(x, edges) {
  return x < edges[0] ? 0 : (x < edges[1] ? 1 : 2)
}

/**
 * Раскладка главного экрана (с версии 1.23.0), сверху вниз: очередь (блок Q_BLOCK — два ряда значков по 60 px), первый ряд кнопок (🧬 💀 🩸),
 * второй ряд кнопок (🏠 🤖 📖). Строки баланса 🌸 больше нет: её место заняла очередь. Кнопки стоят ТАМ ЖЕ, где стояли в 1.22.0
 * (зазоры считаются по прежнему блоку очереди OLD_BLOCK), низ блока очереди — тоже; блок стал выше, поэтому его верх ушёл вверх.
 * Если места не хватает (низкий экран), зазоры очередь-первый ряд и первый-второй ряд сжимаются, но не меньше MIN_GAP.
 * y0 — сдвиг очереди, y1 / y2 — сдвиг первого / второго ряда кнопок (настройки с телефона, 0 — как есть).
 * Возвращает { qTop, b1, b2, topArea: {y, h}, qArea: {y, h} }: topArea — полоска над очередью (область нажатия «автостарт»),
 * qArea — область нажатия очереди (три зоны слева / по центру / справа делят её по столбцам кнопок).
 */
export function mainRows(h, y0, y1, y2) {
  const t0 = itemY(h, 0, OLD_BLOCK, 0)
  const o1 = itemY(h, 1, BTN, 0)
  const o2 = itemY(h, 2, BTN, 0)
  let gQ = Math.max(0, Math.floor((o1 - (t0 + OLD_BLOCK)) / 2))   // зазор очередь — первый ряд (как в 1.22.0)
  let gR = Math.max(0, Math.floor((o2 - (o1 + BTN)) / 2))         // зазор первый — второй ряд (как в 1.22.0)
  const bottom = Math.min(h, o2 + BTN)
  const place = () => {
    const b2 = bottom - BTN
    const b1 = b2 - gR - BTN
    const qBot = b1 - gQ
    return { b1: b1, b2: b2, qTop: qBot - Q_BLOCK }
  }
  let p = place()
  for (let guard = 0; guard < 400 && p.qTop < MIN_GAP && (gQ > MIN_GAP || gR > MIN_GAP); guard++) {
    if (gQ >= gR && gQ > MIN_GAP) gQ--
    else if (gR > MIN_GAP) gR--
    else gQ--
    p = place()
  }
  const clampTop = (y, size) => Math.max(0, Math.min(h - size, y))
  const qT = clampTop(p.qTop + cleanOff(y0), Q_BLOCK)
  const r1 = clampTop(p.b1 + cleanOff(y1), BTN)
  const r2 = clampTop(p.b2 + cleanOff(y2), BTN)
  const mid2 = Math.round((qT + Q_BLOCK + r1) / 2)      // граница областей нажатия: очередь / первый ряд кнопок
  return { qTop: qT, b1: r1, b2: r2, topArea: { y: 0, h: Math.max(1, qT) }, qArea: { y: qT, h: Math.max(1, mid2 - qT) } }
}

/**
 * Розовый экран занятия: граница между «верхней частью» (очередь или 🔄 и эмодзи занятия) и остальным экраном (цифры). Нажатие выше границы —
 * пятиминутная пауза (зелёный экран), ниже — временная пауза 🩸. Граница стоит посередине между низом блока очереди и верхом цифр
 * (цифры — по центру экрана, digHalf — половина их высоты).
 */
export function ovSplit(h, qTop, digHalf) {
  return Math.round((qTop + Q_BLOCK + (Math.round(h / 2) - digHalf)) / 2)
}
