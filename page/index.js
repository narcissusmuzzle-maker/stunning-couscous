/**
 * Таймеры занятий (6 штук, 2×3: 🧬 💀 🩸 / 🏠 🤖 📖) и очередь занятий сверху, розовый экран идущего занятия, зелёная пятиминутная пауза и экран настройки ценности 🩸
 * (версия 1.23.0; баллов 🌸 и магазина больше нет, серого таймера тоже). Подробности логики — в shared/core.js, места на экране — в shared/layout.js.
 * Свайпов в приложении нет: всё управляется нажатиями.
 * Экран сверху вниз (области нажатия):
 *      полоска сверху        невидимая полоса над очередью (до значков): обычное нажатие — автостарт очереди
 *      1 2 3                 очередь занятий (до 12 значков одного размера, 60 px; больше шести — второй ряд): три зоны — слева / по центру / справа (границы по столбцам кнопок, x = 133 и 263)
 *      🧬 💀 🩸              первый ряд кнопок занятий
 *      🏠 🤖 📖              второй ряд кнопок занятий
 *  Все области нажатия — полоска сверху, три зоны очереди и шесть кнопок занятий.
 *  - Полоска сверху: обычное нажатие — автостарт очереди (только когда ничего не идёт). Долгого нажатия нет.
 *  - Кнопки занятий: обычное нажатие — запуск (весь экран розовый, мм:сс до конца круга); запуск другого занятия останавливает прежнее (на телефон уходит пройденное
 *    время). ДОЛГОЕ нажатие — вызвать очередь, сохранённую в ячейке этой кнопки: текущая очередь заменяется шестью эмодзи ячейки; повторное долгое нажатие на ту же
 *    кнопку, пока в очереди ровно эти шесть, удваивает их (12); третье ничего не делает; долгое нажатие на другую кнопку заменяет очередь её ячейкой; пустая ячейка —
 *    ничего. Во время автостарта очередь не меняется.
 *  - Очередь, левая зона: долгое нажатие — режим ВВОДА очереди (кнопки занятий вводят по одному эмодзи; долгое нажатие на кнопку сохраняет введённое в её
 *    ячейку, только если ровно шесть эмодзи; выход — долгое нажатие на левую зону, введённая очередь становится текущей); обычное нажатие — тестовый режим
 *    вкл / выкл (все таймеры и паузы по 20 секунд; только когда ничего не идёт).
 *  - Очередь, центр: долгое нажатие — экран настройки ценности 🩸 (10–90 минут, только когда ничего не идёт). Обычное нажатие ничего не делает.
 *  - Очередь, правая зона: обычное нажатие — журнал теста (нажатие на журнал — следующая страница); долгое — удалить очередь (во время ввода — сбросить
 *    введённое; во время автостарта очередь удалить нельзя).
 *  - Экран настройки ценности 🩸: сетка 3×3 (7 8 9 / 4 5 6 / 1 2 3), номер × 10 минут. Закрыть любой экран — долгое нажатие.
 *  - РОЗОВЫЙ ЭКРАН (идёт занятие). Цифры мм:сс, над ними очередь (или 🔄 и эмодзи занятия), под ними эмодзи занятия. Нажатие на ЦИФРЫ — временная пауза 🩸 (повторное
 *    нажатие возвращает занятие). Нажатие на ВЕРХНЮЮ ЧАСТЬ (там, где очередь или 🔄 и эмодзи) — ПЯТИМИНУТНАЯ ПАУЗА: весь экран зелёный, белые цифры 05:00 -> 00:00.
 *    Нажатие на зелёный экран — вернуться к занятию раньше срока; когда пять минут прошли — вибрация, занятие продолжается само с того же места. Долгое нажатие на
 *    любой цветной экран — остановка совсем.
 *  - Автостарт: запускается занятие, которое стоит в очереди первым; когда оно закончится, — следующее и так до конца очереди (и при
 *    погасшем экране). Остановка занятия автостарт выключает.
 *  - Очередь занятий живёт только на часах (до 12 значков). В конце полного промежутка занятия самое левое такое занятие убирается из очереди.
 *  - Вибрация в режимах: короткая — добавлено занятие / загружена очередь / пауза; длиннее — вход, выход, сохранение, удаление, тест.
 *  - Приложение можно закрыть кнопкой часов (на циферблат): таймеры и автостарт продолжают работать (всё считается по меткам времени, будильники
 *    будят службу и приложение в моменты окончания). Свайпы по-прежнему ничего не делают.
 *  - Системная полоска сверху (название и время, 64 px) скрывается (setStatusBarVisible), прокрутка страницы заблокирована
 *    (setScrollLock): весь экран 432×514 — рабочий, ничего не обрезается и не «тянется». Высоту рабочей области и показ полоски
 *    можно поменять на телефоне (поле v в ответе на sync); сохранённые настройки вида остаются в силе.
 *  - Очередь по центру экрана (по CX). Вибрация — как в версии 10: при погасшем экране вибрирует служба будильника (app-service/alarm.js),
 *    при включённом — страница (одна длинная сцена).
 */
import { BasePage } from '@zeppos/zml/base-page'
import { createWidget, widget, prop, align, text_style, setStatusBarVisible } from '@zos/ui'
import { setScrollLock } from '@zos/page'
import { replace } from '@zos/router'
import { getDeviceInfo } from '@zos/device'
import { Vibrator, VIBRATOR_SCENE_DURATION_LONG } from '@zos/sensor'
import * as sensor from '@zos/sensor'
import { setPageBrightTime, pauseDropWristScreenOff, setWakeUpRelaunch } from '@zos/display'
import { LocalStorage } from '@zos/storage'
import * as inter from '@zos/interaction'
import { set as alarmSet, cancel as alarmCancel } from '@zos/alarm'
import * as core from '../shared/core'
import * as lay from '../shared/layout'
import * as dlog from '../shared/dlog'
import { readFileSync, writeFileSync } from '@zos/fs'

const SEND_GAP = 15000        // как часто повторять отправку неподтверждённого события
const USE_ALARM = true        // будить приложение будильником, когда промежуток заканчивается при погасшем экране
const KEEP_AWAKE = true       // пока что-то идёт, не гасить экран
// Поля экрана (в координатах 432 px по ширине). Высоту рабочей области лучше менять на телефоне (⚙️ -> «Вид на часах»).
const SCREEN_W = 432
const LEFT = 8                // отступ слева
// размеры и места значков очереди (один ряд до 6 штук, два ряда до 12) — в shared/layout.js
const CELL = 120
const GAP = 10
const ZE = lay.zoneEdges(LEFT, CELL, GAP)   // границы левой / средней / правой зоны экрана (x = 133 и 263)
const QFULL = core.QUEUE_MAX  // сколько занятий помещается в очередь (12)
const Q2_SHIFT = 0            // сдвиг очереди из двух рядов по вертикали, px (минус — выше, плюс — ниже); один ряд не двигается
const SLOTS = core.COUNT      // сколько очередей можно сохранить: по одной на каждую из шести кнопок занятий
const SWIPE_EXIT_IDLE = false // true — когда ничего не идёт, свайп вправо выходит из приложения (как у обычных приложений часов)
// Горизонтальный центр видимой области: середина сетки (LEFT + 380/2). Цветные экраны и очередь центруются по нему.
// Если время или сердечки «съезжают» вправо/влево — меняйте это число.
const CX = 198
const OV_W = CX * 2           // ширина части цветного экрана с цифрами (остаток справа — полоса того же цвета)
// Экран настройки ценности 🩸: 🩸 (120 px), под ним 32 px зазора и подпись (90 px) — по центру экрана по высоте
const SET_BLOCK = 242
const SET_LABEL_DY = 152
const WHITE = 0xffffff
const BLACK = 0x000000
const BTN_BLACK = 0x050505
const RED = 0xff4517
const GREEN = 0x3bf76d
const GRAY = 0x8c8c8c
// зелёная пауза на пять минут: весь экран зелёный, цифры белые
// розовый экран идущего занятия и зелёный экран пятиминутной паузы (на весь экран, цифры белые)
const PINK = 0xffbfe1
const OV_FG = { g: WHITE, a: WHITE }
const OV_BG = { g: GREEN, a: PINK }   // g — зелёный (пауза), a — розовый (идёт занятие)
const OV_ICON = 90          // эмодзи занятия под цифрами на розовом экране (в полтора раза крупнее значка очереди, картинки o0..o5)
const OV_DIG_HALF = 40      // половина высоты цифр таймера (текст 110 px): от середины экрана до их нижнего края
const OV_KINDS = ['g', 'a']
const LOOP_IMG = core.COUNT   // номер значка 🔄 среди картинок очереди (q6.png)

// эмодзи занятий в порядке картинок i0..i5 / q0..q5 / o0..o5 (🧬 💀 🩸 🏠 🤖 📖); q6 — 🔄; приложение-трекер на телефоне по эмодзи понимает занятие
const EMOJI = core.EMOJI

// Хранилище: если часы его не дают (нет разрешения и т.п.), работаем в памяти и показываем причину на экране
let ls = null
const mem = {}
const store = {
  getItem(k, d) {
    try { if (ls) { const v = ls.getItem(k, d); return v === undefined || v === null ? d : v } } catch (e) { fail('getItem ' + e) }
    return k in mem ? mem[k] : d
  },
  setItem(k, v) {
    mem[k] = v
    try { if (ls) ls.setItem(k, v) } catch (e) { fail('setItem ' + e) }
  }
}

// Ошибки показываем на экране (а не оставляем чёрный экран): без этого на часах их не увидеть
let failed = 0
function fail(msg) {
  failed++
  if (failed > 3) return
  try {
    createWidget(widget.FILL_RECT, { x: 0, y: 0, w: 432, h: 514, color: 0x300000 })
    createWidget(widget.TEXT, {
      x: 12, y: 12 + (failed - 1) * 150, w: 408, h: 140, color: 0xffffff, text_size: 22,
      align_h: align.LEFT, align_v: align.TOP, text_style: text_style.WRAP, text: 'Ошибка ' + failed + ': ' + String(msg).slice(0, 160)
    })
  } catch (e) { /* больше показать нечем */ }
}
function guard(name, f) {
  try { return f() } catch (e) { fail(name + ': ' + e); return undefined }
}

let ST = null          // состояние (хранится): таймеры, очередь занятий, неотправленные события
let view = 'main'      // 'main' — занятия и очередь, 'settings' — ценность 🩸, 'ov' — розовый (занятие) или зелёный (пауза) экран на весь экран, 'log' — журнал вибрации
let vib = null
let inflight = false
let inflightAt = 0
let syncing = false
let syncAt = 0
let timer = null
let ticks = 0
let lastTickAt = 0     // когда был прошлый тик (разрыв больше трёх секунд — страница была «заморожена» при погасшем экране)
let lpAt = 0           // когда сработало долгое нажатие (чтобы отпускание пальца не считалось обычным нажатием)
let shown = []         // для каждого квадрата: показана ли кнопка идущего таймера
let lastLabel = []
let lastOv = ''
let lastQ = ''
let idle = []
let runb = []
let qb = []            // qb[k][e] — значок очереди: место k (до 12), эмодзи e (у каждой пары своя кнопка с готовой картинкой; e = 6 — 🔄)
let qCx = []           // середина каждого стоящего на экране значка по x (нужно, чтобы понять, в какой зоне значок)
let zb = []            // три невидимые (чёрные) кнопки-зоны очереди: левая / центр / правая
let topBtn = null      // невидимая (чёрная) полоска над очередью на главном экране: обычное нажатие — автостарт
let creating = false   // режим ввода очереди (долгое нажатие на левую зону очереди): кнопки занятий добавляют занятие в очередь, а не запускают таймер
let qDraft = []        // очередь, которую собирают (до QFULL эмодзи)
let slots = []         // сохранённые очереди (SLOTS штук, по одной на кнопку занятия); в каждой — ровно шесть эмодзи или пусто
let lpTopAt = 0        // когда сработало долгое нажатие на зону очереди (отпускание пальца не должно считаться обычным нажатием)
let lpTopZone = -1     // в какой зоне очереди оно было (нажатие в другой зоне сразу после него — настоящее, не отпускание)
let lpCell = -1        // на какой кнопке занятия было долгое нажатие и когда (отпускание пальца не должно считаться нажатием)
let lpCellAt = 0
let me = null          // страница (нужна обработчикам жестов)
let sBg = null
let sA = []            // девять невидимых областей нажатия на экране ценности: сетка 3×3 (7 8 9 / 4 5 6 / 1 2 3), номер × 10 минут
let sEmoji = null
let sLabel = null
let lgBg = null        // экран журнала вибрации: чёрный фон и строки текста (по одной кнопке на строку)
let lgRows = []
let lgPage = 0         // страница журнала (0 — самые новые записи)
let lgPages = 1
let lastLg = ''
const LG_ROWS = 14     // строк на экране журнала: сверху итог, ниже записи
const LG_H = 30        // высота строки журнала, px
let ov = { g: null, a: null }     // цветные экраны на весь экран: g — зелёный (пауза), a — розовый (занятие): кнопка с цифрами
let ovS = { g: null, a: null }    // и полоса справа от цифр (чтобы цвет закрывал весь экран)
let ovHi = null        // верхняя часть розового экрана (того же цвета, поверх него): нажатие — зелёная пауза на пять минут
let ovBot = []         // ovBot[e] — эмодзи идущего занятия под цифрами на розовом экране (картинка, нажатия проходят сквозь неё)
let lastOvI = ''
let ovShownKind = ''   // какой цветной экран сейчас показан (при смене розового на зелёный и обратно экран перекладывается)
let launch = ''        // с каким параметром открыта страница ('alarm' — разбудил будильник)
let G = null           // геометрия
let ROW = 171          // высота одной из трёх строк экрана (нужна экрану настройки ценности)
let L = null           // места главного экрана (lay.mainRows): очередь, два ряда кнопок и области нажатия
let LV = { h: 0, hide: 1, vib: 1, y0: 0, y1: 0, y2: 0 }   // вид с телефона: h — высота рабочей области (0 — по размеру экрана), hide — скрыть полоску сверху,
                       // vib — вибрировать при включённом экране, y0/y1/y2 — сдвиг строк (очередь / 🧬💀🩸 / 🏠🤖📖) по вертикали, px
// Положение экрана. Система считает верхние 64 px «полоской» (она скрыта, но страница всё равно начинается ниже), поэтому из 514 px
// на экране видны только 450: нижние 64 обрезаются. Два способа:
//  LIFT = 0  — рабочая высота 450 (всё помещается, верхние 64 px пустые). Проверенный вариант.
//  LIFT = 64 — рабочая высота 514, всё поднято на 64 px вверх (y < 0), чтобы занять и верхние 64 px. Пробный вариант: если часы не рисуют
//              и не принимают нажатия выше начала страницы, верх экрана будет обрезан — тогда вернуть 0.
//
// ===== ВОТ ЭТО ЧИСЛО МЕНЯТЬ, ЧТОБЫ ДВИГАТЬ ВЕСЬ ЭКРАН ПО ВЕРТИКАЛИ =====
// DOWN — на сколько пикселей опустить весь экран от полностью поднятого положения (LIFT = 64).
//   Сверху обрезано — ставьте БОЛЬШЕ (опускает экран вниз). Обрезано снизу — ставьте МЕНЬШЕ (поднимает вверх).
//   0 — как в v16.1-lift64 (поднято на все 64 px), 64 — как обычный архив (LIFT = 0, рабочая высота 450). Допустимо от 0 до 64.
const DOWN = 33
const LIFT = 64 - DOWN
const WORK_H = 450
const DY = -LIFT
let layV = 0           // счётчик перекладок экрана (чтобы очередь перерисовалась на новых местах)

function cur() { return ST }

function save() {
  try {
    store.setItem('st', JSON.stringify(ST))
  } catch (e) { /* без сохранения продолжаем работать */ }
}

/** Команда вибромотору. Возвращает 'ok' или 'E:причина' (причина идёт в журнал). */
function vibrate(mode) {
  try {
    if (!vib) vib = new Vibrator()
    vib.start({ mode: mode })
    return 'ok'
  } catch (e) {
    try { vib.setMode({ mode: mode }); vib.start(); return 'ok2' } catch (e2) { return 'E:' + String(e2).slice(0, 24) }
  }
}

// Журнал вибрации и будильников (см. shared/dlog.js): страница пишет в lg_p.txt, служба — в lg_s.txt; смотреть на экране журнала
// (обычное нажатие на правую зону очереди).
const LOG_P = 'lg_p.txt'
const LOG_S = 'lg_s.txt'
function readLogFile(path) {
  try {
    const s = readFileSync({ path: path, options: { encoding: 'utf8' } })
    return typeof s === 'string' ? s : ''
  } catch (e) { return '' }
}
function plog(text) {
  try { writeFileSync({ path: LOG_P, data: dlog.append(readLogFile(LOG_P), Date.now(), text, dlog.LOG_MAX), options: { encoding: 'utf8' } }) } catch (e) { /* журнал не критичен */ }
}
function clearLogs() {
  try { writeFileSync({ path: LOG_P, data: '', options: { encoding: 'utf8' } }) } catch (e) { /* не критично */ }
  try { writeFileSync({ path: LOG_S, data: '', options: { encoding: 'utf8' } }) } catch (e) { /* не критично */ }
}

/** Начало нового теста: запись «T start» в журнал (сводка считает срабатывания службы после последней такой записи). Только в тестовом режиме
 *  и только если после запуска что-то действительно идёт. */
function markTest(now) {
  if (!ST.test || !core.anyRunning(cur())) return
  plog('T start ' + Math.round(core.fullMs(cur()) / 1000) + 's')
}

/** Вибрация страницы (экран включён): одна длинная сцена, как в версии 10. Если на телефоне выключено — молчим.
 *  При погасшем экране вибрирует служба будильника (app-service/alarm.js) — её этот переключатель не касается. */
function signalHour() {
  if (!LV.vib) { plog('PV off'); return }
  plog('PV ' + vibrate(VIBRATOR_SCENE_DURATION_LONG))
}

/** Короткий отклик в режимах очереди: 'tick' — добавлено занятие / загружена очередь, 'mode' — вход, выход, сохранение, случайная, удаление.
 *  Если нужной вибрации в системе нет или на телефоне выключена вибрация часов — молчим. */
function feedback(kind) {
  if (!LV.vib) return
  const m = kind === 'tick' ? sensor.VIBRATOR_SCENE_SHORT_LIGHT : sensor.VIBRATOR_SCENE_DURATION
  if (m === undefined) return
  vibrate(m)
}

/** Системная полоска сверху и прокрутка: полоска скрыта (если телефон не сказал иначе), прокрутка заблокирована. */
function applyBar() {
  try { setStatusBarVisible(!LV.hide) } catch (e) { /* не квадратный экран — полоски нет */ }
  try { setScrollLock({ lock: true }) } catch (e) { /* не критично */ }
}

function loadView() {
  try {
    const raw = store.getItem('vw', '')
    if (raw) LV = lay.cleanView(JSON.parse(raw))
  } catch (e) { /* вид по умолчанию: весь экран, полоска скрыта */ }
}

function geometry() {
  const base = LIFT ? lay.FULL_H : WORK_H
  let h = base
  try {
    const d = getDeviceInfo()
    if (d && d.height > 0) h = Math.min(d.height, base)
  } catch (e) { /* значения по умолчанию */ }
  if (LV.h > 0) h = LV.h   // высоту задал телефон (⚙️ -> «Вид на часах»)
  // ширина всегда 432 (designWidth приложения): реальная ширина экрана могла быть больше и уводила сетку за край
  ROW = lay.rowH(h)
  L = lay.mainRows(h, LV.y0, LV.y1, LV.y2)
  return { w: SCREEN_W, h: h, cell: CELL, font: Math.round(CELL * 0.5) }
}

/** Куда ставить блок экрана настройки: 🩸 и подпись под ним — по центру по высоте. */
function setTop() { return lay.centerTop(G.h, SET_BLOCK) }
/** Кнопка занятия i: ряд 0 — первый ряд кнопок (🧬 💀 🩸), ряд 1 — второй (🏠 🤖 📖); места — lay.mainRows. */
function cellXY(i) {
  const c = i % 3
  const r = Math.floor(i / 3)
  return { x: LEFT + c * (CELL + GAP), y: r === 0 ? L.b1 : L.b2 }
}

/** Зона очереди (0 — левая, 1 — центр, 2 — правая): от верха очереди до первого ряда кнопок, по столбцам кнопок. */
function zoneRect(c) {
  const a = c === 0 ? 0 : ZE[c - 1]
  const b = c === 2 ? G.w : ZE[c]
  return { x: a, y: L.qArea.y, w: b - a, h: L.qArea.h }
}

/** Граница верхней части розового экрана: нажатие выше неё (очередь или 🔄 и эмодзи занятия) — зелёная пауза на пять минут, ниже (цифры) — пауза 🩸. */
function ovSplitY() { return lay.ovSplit(G.h, L.qTop, OV_DIG_HALF) }

/** Область экрана настройки ценности: строка r (0 — верхняя, 1 — средняя, 2 — нижняя треть экрана) и столбец c (те же три столбца, что у зон очереди). */
function areaRect(r, c) {
  const a = c === 0 ? 0 : ZE[c - 1]
  const b = c === 2 ? G.w : ZE[c]
  const y0 = r * ROW
  const y1 = r === 2 ? G.h : (r + 1) * ROW
  return { x: a, y: y0, w: b - a, h: y1 - y0 }
}

function setBtn(b, x, y, w, h, text, color) {
  try { b.setProperty(prop.MORE, { x: x, y: y + DY, w: w, h: h, text: text, color: color }) } catch (e) { /* не критично */ }
}

function setVisible(b, v) {
  try { if (b) b.setProperty(prop.VISIBLE, v) } catch (e) { /* не критично */ }
}

/** Переставить кнопку (картинку не трогаем: её часы не обновляют). */
function moveBtn(b, x, y, w, h) {
  try { if (b) b.setProperty(prop.MORE, { x: x, y: y + DY, w: w, h: h }) } catch (e) { /* не критично */ }
}

/** Очередь, которую сейчас показываем: собираемая (во время создания) или текущая. */
function shownQueue() {
  if (view === 'ov') return core.ovTop(ST)   // розовый экран: остаток очереди либо 🔄 и эмодзи моно-занятия — на месте очереди (на зелёном — пусто)
  return creating ? qDraft : ST.queue
}

/** Значки очереди (на главном экране и над цифрами на розовом): все одного размера (60 px), до 6 — один ряд, 7–12 — два ряда (места считает shared/layout.js).
 *  Картинку на кнопке менять нельзя (часы её не обновляют — все значки были бы одинаковыми), поэтому у каждого места есть по кнопке на каждое эмодзи,
 *  а показывается одна. */
function renderQueue() {
  const items = shownQueue()
  const key = view + '|' + items.join(',') + '|' + layV
  if (key === lastQ) return
  lastQ = key
  const vis = []
  for (let k = 0; k < items.length && vis.length < QFULL; k++) {
    const idx = items[k] === core.LOOP ? LOOP_IMG : EMOJI.indexOf(items[k])   // LOOP_IMG — значок 🔄 (q6.png)
    if (idx >= 0) vis.push(idx)
  }
  const places = lay.queuePlaces(vis.length, CX, L.qTop)
  qCx = []
  for (let j = 0; j < places.length; j++) qCx.push(places[j].x + places[j].s / 2)
  for (let j = 0; j < QFULL; j++) {
    for (let e = 0; e <= LOOP_IMG; e++) {
      const on = (view === 'main' || view === 'ov') && j < vis.length && e === vis[j]
      const b = qb[j] && qb[j][e]
      if (on) {
        const pl = places[j]
        moveBtn(b, pl.x, pl.y, pl.s, pl.s)
      }
      setVisible(b, on)
    }
  }
}

function saveSlots() {
  try { store.setItem('qsl6', JSON.stringify(slots)) } catch (e) { /* не критично */ }
}

function saveDraft() {
  try {
    store.setItem('qc', creating ? '1' : '0')
    store.setItem('qd', JSON.stringify(qDraft))
  } catch (e) { /* не критично */ }
}

/** Переключить экран: показать нужные виджеты, остальные спрятать. */
function enterView(v) {
  view = v
  for (let i = 0; i < core.COUNT; i++) { setVisible(idle[i], false); setVisible(runb[i], false) }
  shown = []
  lastLabel = []
  lastOv = ''
  lastQ = ''
  renderQueue()
  setVisible(topBtn, v === 'main')
  for (let c = 0; c < zb.length; c++) setVisible(zb[c], v === 'main')
  setVisible(sBg, v === 'settings')
  for (let i = 0; i < sA.length; i++) setVisible(sA[i], v === 'settings')
  setVisible(sEmoji, v === 'settings')
  setVisible(sLabel, v === 'settings')
  lastLg = ''
  setVisible(lgBg, v === 'log')
  for (let r = 0; r < lgRows.length; r++) setVisible(lgRows[r], v === 'log')
  const k = v === 'ov' ? core.overlayKind(cur()) : ''
  ovShownKind = k
  lastOvI = ''
  for (const c of OV_KINDS) { setVisible(ov[c], k === c); setVisible(ovS[c], k === c) }
  setVisible(ovHi, k === 'a')
  renderOvIcons()
}

/** Перерисовать то, что поменялось. */
function render(now) {
  const st = cur()
  if (view === 'main') {
    for (let i = 0; i < core.COUNT; i++) {
      const isRun = core.running(st, i)
      const mode = isRun ? 'r' : 'i'
      if (shown[i] !== mode) {
        setVisible(idle[i], mode === 'i')
        setVisible(runb[i], mode === 'r')
        shown[i] = mode
        lastLabel[i] = ''
      }
      if (mode === 'r') {
        const text = core.label(st, core.remaining(st, i, now))
        if (text !== lastLabel[i]) {
          const p = cellXY(i)
          setBtn(runb[i], p.x, p.y, G.cell, G.cell, text, WHITE)
          lastLabel[i] = text
        }
      }
    }
  } else if (view === 'log') {
    renderLog()
  } else if (view === 'ov') {
    const k = core.overlayKind(st)
    const text = core.clock(core.ovLeftAny(st, now))
    if (k + text !== lastOv && ov[k]) {
      setBtn(ov[k], 0, 0, OV_W, G.h, text, OV_FG[k])
      lastOv = k + text
    }
    renderOvIcons()
  }
}

/** Розовый экран: под цифрами — эмодзи того, что идёт сейчас (над цифрами — очередь или 🔄 + эмодзи, это рисует renderQueue). На зелёном экране — только цифры. */
function renderOvIcons() {
  const k = view === 'ov' ? core.overlayKind(ST) : ''
  const e = k === 'a' ? core.activeIdx(ST) : -1
  const key = k + '|' + e + '|' + layV
  if (key === lastOvI) return
  lastOvI = key
  for (let j = 0; j < EMOJI.length; j++) setVisible(ovBot[j], j === e)
  if (e >= 0 && ovBot[e]) {
    // по центру между нижним краем цифр и нижним краем экрана (низ нижнего ряда кнопок)
    const y = Math.round((Math.round(G.h / 2) + OV_DIG_HALF + L.b2 + CELL - OV_ICON) / 2)
    moveBtn(ovBot[e], CX - Math.round(OV_ICON / 2), y, OV_ICON, OV_ICON)
  }
}

/** Экран журнала: сверху итог (сколько раз сработала служба-будильник / ошибок / открытий страницы и номер страницы журнала),
 *  ниже записи службы и страницы вперемешку по времени, новые сверху. Зелёные — служба, белые — страница, красные — ошибки. */
function renderLog() {
  const per = LG_ROWS - 2   // самая верхняя строка на часах не видна (скрыта углом экрана) — под записи она не годится (раньше в ней пропадала самая новая запись)
  const entries = dlog.merge(dlog.parse(readLogFile(LOG_S)), dlog.parse(readLogFile(LOG_P)))
  const last = entries.length ? entries[entries.length - 1].t : 0
  const key = entries.length + '|' + last + '|' + lgPage
  if (key === lastLg) return
  lastLg = key
  const sm = dlog.summary(entries)
  if (lgPage < 0) {
    const sh = dlog.sheet(entries)
    if (!sh.items.length) { lgPage = 0; lastLg = ''; renderLog(); return }   // сводки нет — сразу записи
    renderSheet(sh, sm, per)
    return
  }
  const pg = dlog.pageOf(entries, lgPage, per)
  lgPage = pg.page
  lgPages = pg.pages
  // итог — в самой нижней строке (верхняя строка на часах не видна), записи — выше, новые сверху
  setBtn(lgRows[LG_ROWS - 1], 0, 4 + (LG_ROWS - 1) * LG_H, G.w, LG_H, 'S' + sm.s + ' err' + sm.e + ' P' + sm.p + '  ' + (pg.page + 1) + '/' + pg.pages, 0xffd24a)
  setBtn(lgRows[0], 0, 4, G.w, LG_H, '', BLACK)
  for (let r = 0; r < per; r++) {
    const row = pg.rows[r]
    const color = !row ? BLACK : row.kind === 'err' ? RED : row.kind === 'svc' ? GREEN : WHITE
    setBtn(lgRows[r + 1], 0, 4 + (r + 1) * LG_H, G.w, LG_H, row ? row.text : '', color)
  }
}

/** Страница-сводка последнего теста: номер срабатывания службы + буква (A — вибрация, «.» — тихая граница, c — тихая + проверка часов), по шесть в ряд. Её удобно сверять с
 *  записью «да / нет» по номерам: один снимок вместо нескольких страниц журнала. */
function renderSheet(sh, sm, per) {
  const LEG = ['A вибрация   . тихо   c тихо+часы', 'B C D — запасные способы вибрации', '! ошибка  ? службу прибили при C']
  const rows = dlog.sheetRows(sh.items, 6)
  const room = per - 1 - LEG.length   // первая строка — шапка, внизу — легенда
  setBtn(lgRows[LG_ROWS - 1], 0, 4 + (LG_ROWS - 1) * LG_H, G.w, LG_H, 'S' + sm.s + ' err' + sm.e + ' P' + sm.p + '  сводка', 0xffd24a)
  const head = (sh.since ? 'тест с ' + dlog.stamp(sh.since) + ', ' : '') + 'срабатываний: ' + sh.items.length
  setBtn(lgRows[0], 0, 4, G.w, LG_H, '', BLACK)
  setBtn(lgRows[1], 0, 4 + LG_H, G.w, LG_H, head, WHITE)
  for (let r = 1; r < per; r++) {   // r — строка внутри области записей (0 — шапка)
    let text = ''
    let color = GREEN
    if (r - 1 < rows.length && r - 1 < room) text = rows[r - 1]
    else if (r >= per - LEG.length) { text = LEG[r - (per - LEG.length)]; color = WHITE }
    setBtn(lgRows[r + 1], 0, 4 + (r + 1) * LG_H, G.w, LG_H, text, color)
  }
}

function openLog() {
  lgPage = -1   // первой показывается сводка последнего теста (если её нет — сразу записи)
  enterView('log')
  lastLg = ''
  renderLog()
}

function closeLog() {
  enterView('main')
  render(Date.now())
}

/** Нажатие на журнал: следующая страница (более старые записи), после последней — снова самые новые. */
function nextLog() {
  lgPage = lgPage + 1 >= lgPages ? -1 : lgPage + 1   // после последней страницы записей — снова сводка
  lastLg = ''
  renderLog()
}

function updateValLabel() {
  setBtn(sLabel, CX - 170, setTop() + SET_LABEL_DY, 340, 90, ST.val + ' мин', WHITE)
}

/** Поставить на места всё, что зависит от высоты рабочей области (после смены вида на телефоне). */
function applyLayout() {
  G = geometry()
  layV++
  for (let i = 0; i < core.COUNT; i++) { const p = cellXY(i); moveBtn(idle[i], p.x, p.y, G.cell, G.cell) }
  for (let c = 0; c < zb.length; c++) { const z = zoneRect(c); moveBtn(zb[c], z.x, z.y, z.w, z.h) }
  moveBtn(topBtn, 0, L.topArea.y, G.w, L.topArea.h)
  // экран настройки
  moveBtn(sBg, 0, 0, G.w, G.h)
  for (let i = 0; i < sA.length; i++) { const a = areaRect(Math.floor(i / 3), i % 3); moveBtn(sA[i], a.x, a.y, a.w, a.h) }
  moveBtn(sEmoji, CX - 60, setTop(), 120, 120)
  moveBtn(sLabel, CX - 170, setTop() + SET_LABEL_DY, 340, 90)
  // журнал
  moveBtn(lgBg, 0, 0, G.w, G.h)
  for (let r = 0; r < lgRows.length; r++) moveBtn(lgRows[r], 0, 4 + r * LG_H, G.w, LG_H)
  // цветные экраны (у розового сверху — своя часть для зелёной паузы)
  for (const c of OV_KINDS) { moveBtn(ov[c], 0, 0, OV_W, G.h); moveBtn(ovS[c], OV_W, 0, G.w - OV_W, G.h) }
  moveBtn(ovHi, 0, 0, G.w, ovSplitY())
  lastLabel = []
  lastOv = ''
  lastQ = ''
  lastOvI = ''
  if (view === 'settings') updateValLabel()
  renderQueue()
  render(Date.now())
}

/** Перезапуск страницы (после смены «скрывать полоску»: рабочая область меняется, всё кладётся заново). */
function reloadPage() {
  try {
    const o = { url: 'page/index' }
    if (launch) o.param = launch
    replace(o)
  } catch (e) { applyLayout() }
}

/** Вид с телефона: { h, hide, vib, y0, y1, y2 }. Сохраняем и применяем; что не поменялось — не трогаем. */
function setView(v) {
  if (!v) return
  const nv = lay.cleanView(v)
  const barChanged = nv.hide !== LV.hide
  const layoutChanged = nv.h !== LV.h || nv.y0 !== LV.y0 || nv.y1 !== LV.y1 || nv.y2 !== LV.y2
  if (!barChanged && !layoutChanged && nv.vib === LV.vib) return
  LV = nv
  try { store.setItem('vw', JSON.stringify(nv)) } catch (e) { /* не критично */ }
  if (!barChanged && !layoutChanged) return   // поменялась только вибрация — перекладывать нечего
  applyBar()
  if (barChanged) reloadPage()
  else applyLayout()
}

function openSettings() {
  enterView('settings')
  updateValLabel()
}

function closeSettings() {
  save()
  enterView('main')
  render(Date.now())
}

/** Нажатие на область экрана настройки: ценность = номер области (7 8 9 / 4 5 6 / 1 2 3) × 10 минут. */
function setValArea(r, c) {
  ST.val = core.areaVal(r, c)
  save()
  updateValLabel()
}

/** Будильники на моменты окончания: разбудят службу (вибрация) и приложение, если экран погас.
 *  Ставим только то, чего ещё нет, и снимаем то, что больше не нужно (план — core.alarmPlan: служба на несколько ближайших границ вперёд,
 *  страница на самую ближайшую; отказ системы повторяется на секунду позже — core.applyAlarms). Раньше при каждом открытии страницы
 *  все будильники снимались и ставились заново, и новый будильник мог встать на ту же секунду, что и будильник, который ставила сама
 *  служба, — тогда система отказывала, а старый молча выходил по «поколению»: вибрация пропадала. Теперь служба ничего не ставит и никуда
 *  не «выходит», а отмена идёт по номерам будильников. */
function scheduleAlarms(now) {
  if (!USE_ALARM) return
  let old = []
  try { old = JSON.parse(store.getItem('alarms', '[]')) } catch (e) { old = [] }
  const r = core.applyAlarms(cur(), now, old, {
    set: (url, param, delay) => alarmSet({ url: url, param: param, delay: delay }),
    cancel: (id) => alarmCancel(id)
  })
  try { store.setItem('alarms', JSON.stringify(r.next)) } catch (e) { /* не критично */ }
  if (r.plan.length || old.length) {
    // коротко: сколько будильников поставлено заново (+), сколько уже стояло (=), сколько система отказала (X, с причиной первого отказа)
    let add = 0
    let kept = 0
    let bad = 0
    let why = ''
    for (let k = 0; k < r.tok.length; k++) {
      const x = r.tok[k]
      if (x.charAt(x.length - 1) === '=') kept++
      else if (x.indexOf(':X') > 0) { bad++; if (!why) why = ' ' + x.slice(x.indexOf(':X') + 2, x.length - 1) }
      else add++
    }
    plog(r.tok.length ? 'A +' + add + ' =' + kept + ' X' + bad + why : 'A off')
  }
}

function keepAwake() {
  if (!KEEP_AWAKE || !core.anyRunning(cur())) return
  try { setPageBrightTime({ brightTime: 120000 }) } catch (e) { /* не критично */ }
  try { pauseDropWristScreenOff({ duration: 600000 }) } catch (e) { /* не критично */ }
}

/** Свайпы ничего не открывают и не закрывают (всё делается нажатиями), и из приложения свайпом выйти нельзя: свайп гасится всегда
 *  (SWIPE_EXIT_IDLE = true — когда ничего не идёт и открыт главный экран, свайп вправо выходит, как у обычных приложений часов).
 *  Из приложения выходят кнопкой часов (на циферблат): её приложение больше не перехватывает, и таймеры при этом продолжают идти.
 *  true — «система, не обрабатывай». */
function onSwipe(e) {
  if (view !== 'main' || creating || core.anyRunning(cur())) return true
  return !SWIPE_EXIT_IDLE
}

/** Гасим свайпы (true — «система, не обрабатывай»). Кнопки часов не трогаем: можно выйти на циферблат, таймеры продолжат работать. */
function blockExit() {
  try {
    inter.onGesture({
      callback: function (e) {
        const swipe = e === inter.GESTURE_RIGHT || e === inter.GESTURE_LEFT || e === inter.GESTURE_UP || e === inter.GESTURE_DOWN
        if (!swipe) return false
        return guard('жест', () => onSwipe(e))
      }
    })
  } catch (e) { /* без обработки жестов */ }
}

/** Сообщение телефону для события из очереди отправки. */
function payloadFor(ev) {
  if (ev.k === 'q') {
    if (ev.i !== undefined) return { t: 'done', id: ev.id, e: EMOJI[ev.i], ts: ev.ts }   // событие из старых версий: час занятия
    return { t: 'qtap', id: ev.id, ts: ev.ts }                                           // событие из старых версий
  }
  if (ev.k === 'qr') return { t: 'qlog', id: ev.id, ts: ev.ts, v: ev.v, q: ev.q, m: ev.m, d: ev.d, x: ev.x ? 1 : 0 }   // записанная очередь целиком (закончена или удалена): второй слой журнала на телефоне
  if (ev.k === 'mo') return { t: 'mlog', id: ev.id, ts: ev.ts, v: ev.v, e: EMOJI[ev.i], n: ev.n, x: ev.x ? 1 : 0 }   // моно-занятие (запуск нажатием): n полных промежутков по v минут, второй слой журнала на телефоне
  if (ev.k === 'b') return { t: 'blood', id: ev.id, e: EMOJI[ev.i], ts: ev.ts, ms: ev.ms, f: ev.f ? 1 : 0 }   // шесть занятий (и 🏠 тоже): минуты ценности 🩸
  return { t: 'done', id: ev.id, e: EMOJI[ev.i], ts: ev.ts }   // событие старого вида (из прошлых версий)
}

Page(
  BasePage({
    onInit(p) {
      try { if (!ls) ls = new LocalStorage() } catch (e) { /* ошибка покажется в build */ }
      launch = typeof p === 'string' ? p : ''
      loadView()
      applyBar()   // полоска скрывается до построения экрана, чтобы страница сразу получила весь экран
    },

    build() {
      me = this
      guard('старт', () => { ls = new LocalStorage() })
      loadView()
      applyBar()
      G = guard('экран', geometry)
      guard('открытие', () => setWakeUpRelaunch({ relaunch: true }))   // при включении экрана открывается это приложение
      ST = guard('состояние', () => core.restore(store.getItem('st', ''), false, 60)) || core.newState(false, 60)
      // один раз: очередь, которая раньше приходила с телефона (и хранилась отдельно), становится очередью часов
      if (store.getItem('qmig', '') !== '1') {
        try { if (!ST.queue.length) ST.queue = core.cleanQueue(JSON.parse(store.getItem('qq', '[]'))) } catch (e) { /* пусто */ }
        try { store.setItem('qmig', '1') } catch (e) { /* не критично */ }
      }
      // ячейки очередей: по одной на кнопку занятия; ключ 'qsl6' — новый (эмодзи занятий поменялись, старые ячейки не годятся)
      slots = []
      for (let k = 0; k < SLOTS; k++) slots.push([])
      try {
        const sv = JSON.parse(store.getItem('qsl6', '[]'))
        for (let k = 0; k < SLOTS; k++) {
          const q = core.cleanQueue(sv[k])
          slots[k] = q.length === core.SLOT_LEN ? q : []
        }
      } catch (e) { /* пустые ячейки */ }
      // очередь, которую собирали, когда приложение закрылось (экран гаснет — приложение откроется заново): продолжаем с того же места
      creating = store.getItem('qc', '0') === '1'
      qDraft = []
      try {
        const d = JSON.parse(store.getItem('qd', '[]'))
        for (let k = 0; k < d.length && qDraft.length < QFULL; k++) qDraft.push(String(d[k]))
      } catch (e) { qDraft = [] }
      blockExit()
      plog('P open ' + (launch || '-'))
      shown = []
      lastLabel = []
      idle = []
      runb = []
      qb = []
      zb = []
      sA = []

      // полоска над очередью (невидимая чёрная кнопка на всю ширину): обычное нажатие — автостарт очереди
      guard('полоска сверху', () => {
        topBtn = createWidget(widget.BUTTON, {
          x: 0, y: L.topArea.y + DY, w: G.w, h: L.topArea.h, text: '', normal_color: BLACK, press_color: BLACK, radius: 0,
          click_func: () => { guard('автостарт', () => this.topTap()) }
        })
        setVisible(topBtn, false)
      })

      // розовый и зелёный экраны на весь экран. Розовый: тап по цифрам — пауза 🩸 и возврат, тап по верхней части — зелёная пауза; зелёный: тап — вернуться к занятию;
      // долгое нажатие на любом — остановка совсем. Создаются ДО значков очереди: значки очереди должны стоять поверх них.
      // Цифры стоят по центру CX (чуть левее середины экрана), справа полоса того же цвета.
      const makeOv = (kind) => {
        guard('таймер ' + kind, () => {
          const exit = () => { guard('выход', () => this.ovExit()) }
          const tap = () => { guard('пауза', () => this.ovTap()) }   // розовый: пауза 🩸 / возврат; зелёный: вернуться к занятию
          const b = createWidget(widget.BUTTON, {
            x: 0, y: 0, w: OV_W, h: G.h, text: '', text_size: 110, color: OV_FG[kind],
            normal_color: OV_BG[kind], press_color: OV_BG[kind], radius: 0,
            click_func: tap,
            longpress_func: exit
          })
          const strip = createWidget(widget.BUTTON, {
            x: OV_W, y: 0, w: G.w - OV_W, h: G.h, text: '',
            normal_color: OV_BG[kind], press_color: OV_BG[kind], radius: 0,
            click_func: tap,
            longpress_func: exit
          })
          setVisible(b, false)
          setVisible(strip, false)
          ov[kind] = b
          ovS[kind] = strip
        })
      }
      makeOv('g')
      makeOv('a')
      // верхняя часть розового экрана: того же цвета, лежит поверх него (глазом шва нет); обычное нажатие — зелёная пауза, долгое — остановка
      guard('верх розового', () => {
        ovHi = createWidget(widget.BUTTON, {
          x: 0, y: 0, w: G.w, h: ovSplitY(), text: '', normal_color: PINK, press_color: PINK, radius: 0,
          click_func: () => { guard('пауза', () => this.ovTopTap()) },
          longpress_func: () => { guard('выход', () => this.ovExit()) }
        })
        setVisible(ovHi, false)
      })

      // очередь — три зоны (чёрные кнопки под значками): слева — долгое: ввод очереди (повторно — выход), обычное: тестовый режим;
      // по центру — долгое: настройка ценности 🩸; справа — обычное: журнал теста, долгое: удалить очередь.
      for (let c = 0; c < 3; c++) {
        const cc = c
        guard('зона ' + c, () => {
          const z = zoneRect(c)
          const b = createWidget(widget.BUTTON, {
            x: z.x, y: z.y, w: z.w, h: z.h, text: '', normal_color: BLACK, press_color: BLACK, radius: 0,
            click_func: () => { guard('очередь', () => this.queueTap(cc)) },
            longpress_func: () => { guard('очередь', () => this.queueLong(cc)) }
          })
          setVisible(b, false)
          zb.push(b)
        })
      }

      // значки очереди: значки-кнопки стоят поверх зон, нажатие и долгое нажатие на значок работают как на его зоне (на розовом экране — как на его верхней части).
      // На каждое место по кнопке на каждое эмодзи (картинка на кнопке не меняется), показывается нужная. Все значки одного размера (q0..q5; q6 — 🔄).
      qb = []
      const mk = (k, e) => {
        guard('очередь ' + k + '/' + e, () => {
          const b = createWidget(widget.BUTTON, {
            x: LEFT, y: 0, w: lay.Q_SIZE, h: lay.Q_SIZE, text: '', normal_src: 'q' + e + '.png', press_src: 'q' + e + '.png',
            click_func: () => { guard('очередь', () => this.queueIconTap(k)) },
            longpress_func: () => { guard('очередь', () => this.queueIconLong(k)) }
          })
          setVisible(b, false)
          qb[k][e] = b
        })
      }
      for (let k = 0; k < QFULL; k++) {
        qb.push([])
        for (let e = 0; e < EMOJI.length; e++) mk(k, e)
      }
      mk(0, LOOP_IMG)   // 🔄 (q6.png): первое место очереди из двух значков на экране моно-занятия
      // эмодзи идущего занятия под цифрами на розовом экране (поверх экрана, но нажатия проходят сквозь него)
      ovBot = []
      for (let e = 0; e < EMOJI.length; e++) {
        guard('значок ' + e, () => {
          const im = createWidget(widget.IMG, { x: CX - Math.round(OV_ICON / 2), y: 0, w: OV_ICON, h: OV_ICON, src: 'o' + e + '.png', enable: false })
          setVisible(im, false)
          ovBot.push(im)
        })
      }

      for (let i = 0; i < core.COUNT; i++) {
        const k = i
        guard('кнопка ' + i, () => {
          const p = cellXY(i)
          idle.push(createWidget(widget.BUTTON, {
            x: p.x, y: p.y, w: G.cell, h: G.cell, text: '', normal_src: 'i' + i + '.png', press_src: 'i' + i + '.png',
            click_func: () => { guard('нажатие', () => this.cellTap(k)) },
            longpress_func: () => { guard('долгое', () => this.cellLong(k)) }
          }))
          // идущий таймер: только цифры на чёрном, эмодзи полностью скрыто
          const rb = createWidget(widget.BUTTON, {
            x: p.x, y: p.y, w: G.cell, h: G.cell, text: '60', text_size: G.font, color: WHITE,
            normal_color: BTN_BLACK, press_color: 0x1c1c1c, radius: 0,
            click_func: () => { guard('нажатие', () => this.cellTap(k)) },
            longpress_func: () => { guard('долгое', () => this.cellLong(k)) }
          })
          setVisible(rb, false)
          runb.push(rb)
        })
      }

      // экран настройки ценности 🩸: чёрный фон, 🩸 по центру, снизу ценность. Экран разделён на сетку 3×3 (7 8 9 / 4 5 6 / 1 2 3):
      // нажатие на область ставит ценность «номер × 10 минут» (1 — 10, 5 — 50, 9 — 90), долгое нажатие закрывает экран.
      // 🩸 и подпись — только картинка и текст (enable: false), нажатия проходят сквозь них на области под ними.
      guard('настройка', () => {
        const close = () => { guard('закрыть', () => { lpAt = Date.now(); closeSettings() }) }
        sBg = createWidget(widget.BUTTON, {
          x: 0, y: 0, w: G.w, h: G.h, text: '', normal_color: BLACK, press_color: BLACK, radius: 0,
          click_func: () => {}, longpress_func: close
        })
        sA = []
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            const rr = r
            const cc = c
            const a = areaRect(r, c)
            const ab = createWidget(widget.BUTTON, {
              x: a.x, y: a.y, w: a.w, h: a.h, text: '', normal_color: BLACK, press_color: BLACK, radius: 0,
              click_func: () => { guard('ценность', () => setValArea(rr, cc)) }, longpress_func: close
            })
            setVisible(ab, false)
            sA.push(ab)
          }
        }
        sEmoji = createWidget(widget.IMG, { x: CX - 60, y: setTop(), w: 120, h: 120, src: 'i2.png', enable: false })
        sLabel = createWidget(widget.TEXT, {
          x: CX - 170, y: setTop() + SET_LABEL_DY, w: 340, h: 90, text: '60 мин', text_size: 56, color: WHITE,
          align_h: align.CENTER_H, align_v: align.CENTER_V, enable: false
        })
        setVisible(sBg, false)
        setVisible(sEmoji, false)
        setVisible(sLabel, false)
      })

      // экран журнала вибрации: чёрный фон и LG_ROWS строк (каждая — отдельная кнопка с одной строкой текста); нажатие — следующая страница,
      // долгое нажатие — закрыть
      guard('журнал', () => {
        const next = () => { guard('журнал', nextLog) }
        const close = () => { guard('закрыть', () => { lpAt = Date.now(); closeLog() }) }
        lgBg = createWidget(widget.BUTTON, {
          x: 0, y: 0, w: G.w, h: G.h, text: '', normal_color: BLACK, press_color: BLACK, radius: 0,
          click_func: next, longpress_func: close
        })
        setVisible(lgBg, false)
        lgRows = []
        for (let r = 0; r < LG_ROWS; r++) {
          const b = createWidget(widget.BUTTON, {
            x: 0, y: 4 + r * LG_H, w: G.w, h: LG_H, text: '', text_size: 18, color: WHITE,
            normal_color: BLACK, press_color: BLACK, radius: 0, click_func: next, longpress_func: close
          })
          setVisible(b, false)
          lgRows.push(b)
        }
      })


      guard('экран старта', () => enterView(core.overlayKind(cur()) ? 'ov' : 'main'))
      if (DY) guard('сдвиг вверх', applyLayout)   // всё, что создано по обычным местам, поднимается на LIFT
      applyBar()   // ещё раз после построения: прокрутка заблокирована при любом размере содержимого
      const now = Date.now()
      guard('запуск', () => this.settle(core.process(cur(), now), now))   // то, что закончилось, пока приложение было закрыто
      if (launch === 'alarm') { try { setPageBrightTime({ brightTime: 20000 }) } catch (e) { /* не критично */ } }
      guard('телефон', () => this.syncPhone())   // при каждом включении экрана приложение открывается заново — это и есть обновление данных
      timer = setInterval(() => { guard('секунда', () => this.tick()) }, 1000)
    },

    onDestroy() {
      if (timer) { clearInterval(timer); timer = null }
      save()
    },

    /** Всё, что нужно сделать после любого изменения состояния. */
    settle(res, now) {
      if (res.events.length || res.ovDone) plog('E ' + res.events.length + (res.fresh || res.ovFresh ? ' fresh' : ' old'))
      if (res.fresh) signalHour()
      if (res.ovDone && res.ovFresh) signalHour()          // конец зелёной паузы — та же вибрация, что в конце занятия
      // экран следует за состоянием: закончившаяся зелёная пауза возвращает розовый экран занятия (приложение остаётся)
      const ok = core.overlayKind(cur())
      if (view === 'ov' && !ok) enterView('main')
      else if (view === 'main' && ok) enterView('ov')
      else if (view === 'ov' && ok !== ovShownKind) enterView('ov')   // розовый <-> зелёный (пятиминутная пауза и возврат)
      save()
      scheduleAlarms(now)
      keepAwake()
      renderQueue()   // в конце промежутка занятие убирается из очереди
      render(now)
      this.sendDue(now)
    },

    tick() {
      const now = Date.now()
      if (lastTickAt && now - lastTickAt > 3000) plog('W gap ' + Math.round((now - lastTickAt) / 1000) + 's')
      lastTickAt = now
      ticks++
      if (ticks % 2 === 0) { try { store.setItem('hb', String(now)) } catch (e) { /* метка нужна только журналу */ } }   // служба по ней видит, как давно «спят» часы
      const res = core.process(cur(), now)
      if (res.events.length || res.ovDone) {
        this.settle(res, now)
      } else {
        render(now)
        this.sendDue(now)
        if (ticks % 60 === 0) keepAwake()   // постоянного опроса телефона нет (см. build)
      }
    },

    /** Обычное нажатие на кнопку занятия. Режим ввода очереди: добавляет её эмодзи в очередь; иначе запуск / стоп таймера. */
    cellTap(i) {
      const now = Date.now()
      if (now - lpAt < 800 || view !== 'main') return
      if (i === lpCell && now - lpCellAt < 2000) return   // отпускание пальца после долгого нажатия на этой же кнопке
      if (creating) { this.addToQueue(EMOJI[i]); return }   // при вводе очереди кнопки занятий добавляют занятие в очередь
      const wasIdle = !core.anyRunning(cur())
      this.settle(core.toggle(cur(), i, now), now)
      if (wasIdle) markTest(now)
    },

    /** Долгое нажатие на кнопку занятия [i]. Обычный режим: вызвать очередь из ячейки этой кнопки (см. loadSlot). Режим ввода очереди: сохранить введённую
     *  очередь в ячейку этой кнопки (только если в ней ровно шесть эмодзи). Экран при этом не меняется, поэтому другие нажатия не теряются. */
    cellLong(i) {
      const now = Date.now()
      lpCell = i
      lpCellAt = now
      if (view !== 'main') return
      if (creating) { this.saveSlot(i); return }
      this.loadSlot(i)
    },

    /** Нажатие / долгое нажатие на значок очереди: то же, что на зону, в которой он стоит (на розовом экране — на его верхней части). */
    queueIconTap(k) {
      if (view === 'ov') { this.ovTopTap(); return }   // значки очереди на розовом экране — верхняя часть экрана: зелёная пауза
      const cx = qCx[k]
      if (cx === undefined) return
      this.queueTap(lay.zoneOf(cx, ZE))
    },

    queueIconLong(k) {
      if (view === 'ov') { this.ovExit(); return }
      const cx = qCx[k]
      if (cx === undefined) return
      this.queueLong(lay.zoneOf(cx, ZE))
    },

    /** Обычное нажатие на полоску над очередью: автостарт очереди (только когда ничего не идёт; не во время ввода очереди). */
    topTap() {
      const now = Date.now()
      if (view !== 'main' || creating || now - lpAt < 800) return   // отпускание пальца после долгого нажатия не считается нажатием
      if (core.anyRunning(cur())) return
      this.autoStart()
    },

    /** Обычное нажатие на зону очереди: слева (0) — тестовый режим вкл / выкл, по центру (1) — ничего (серого таймера больше нет), справа (2) — журнал теста.
     *  Режим ВВОДА очереди: все зоны молчат (🏠 теперь вводится своей кнопкой). */
    queueTap(c) {
      const now = Date.now()
      if (view !== 'main' || (c === lpTopZone && now - lpTopAt < 2000)) return   // отпускание пальца после долгого нажатия на этой же зоне не считается нажатием
      if (creating) return
      if (c === 0) { this.toggleTest(); return }
      if (c === 2) openLog()
    },

    /** Долгое нажатие на зону очереди: слева (0) — войти в режим ввода очереди / выйти из него, по центру (1) — настройка ценности 🩸 (только когда ничего
     *  не идёт), справа (2) — удалить очередь (во время ввода — сбросить введённое). */
    queueLong(c) {
      if (view !== 'main') return
      lpTopAt = Date.now()
      lpTopZone = c
      if (c === 0) { if (creating) this.finishQueue(); else this.beginQueue(); return }
      if (creating) {
        if (c === 2) { qDraft = []; saveDraft(); renderQueue(); feedback('mode') }
        return
      }
      if (c === 1) { if (!core.anyRunning(cur())) openSettings(); return }
      this.deleteQueue()
    },

    /** Войти в режим ввода очереди (только когда ничего не идёт). Текущая очередь остаётся, пока вводят новую. */
    beginQueue() {
      if (core.anyRunning(cur())) return
      creating = true
      qDraft = []
      saveDraft()
      renderQueue()
      render(Date.now())
      feedback('mode')
    },

    addToQueue(e) {
      if (!creating || qDraft.length >= QFULL) return
      qDraft.push(e)
      saveDraft()
      renderQueue()
      feedback('tick')
    },

    /** Выйти из режима ввода: введённая очередь остаётся на экране как текущая (и сохраняется на часах). Если ничего не введено — текущая
     *  очередь не меняется. */
    finishQueue() {
      creating = false
      const q = core.cleanQueue(qDraft)
      if (q.length) { core.setQueue(ST, q, Date.now()); save(); this.sendDue(Date.now()) }
      qDraft = []
      saveDraft()
      renderQueue()
      feedback('mode')
    },

    /** Режим ввода, долгое нажатие на кнопку занятия [i]: введённая очередь сохраняется в её ячейку — только если эмодзи ровно шесть
     *  (пять или семь — ничего не сохраняется и вибрации нет). Введённое остаётся на экране — можно сохранить и в другую ячейку. */
    saveSlot(i) {
      if (!creating || qDraft.length !== core.SLOT_LEN) return
      slots[i] = core.cleanQueue(qDraft)
      if (slots[i].length !== core.SLOT_LEN) { slots[i] = []; return }
      saveSlots()
      feedback('mode')
    },

    /** Долгое нажатие на кнопку занятия [i] в обычном режиме: вызвать очередь, сохранённую в её ячейке (core.slotQueue). Очередь пуста или стоит другая —
     *  она заменяется шестью эмодзи ячейки; в очереди ровно эти шесть — удваиваются (12); уже удвоено — ничего. Пустая ячейка — ничего (и без вибрации).
     *  Во время автостарта очередь не меняется: он идёт по ней. */
    loadSlot(i) {
      if (ST.auto) return
      const q = core.slotQueue(ST.queue, slots[i])
      if (!q) return
      core.setQueue(ST, q, Date.now())
      save()
      this.sendDue(Date.now())
      renderQueue()
      feedback('tick')
    },

    /** Удалить текущую очередь (не во время автостарта: он идёт по этой очереди). */
    deleteQueue() {
      if (ST.auto) return
      core.setQueue(ST, [], Date.now())   // начатая очередь закрывается: что выполнено, уходит телефону записью
      save()
      this.sendDue(Date.now())
      renderQueue()
      feedback('mode')
    },

    /** Автостарт очереди: запускается занятие, которое стоит в очереди первым; дальше — по порядку, до конца очереди. */
    autoStart() {
      const now = Date.now()
      if (!ST.queue.length) return
      const wasIdle = !core.anyRunning(cur())
      this.settle(core.startAuto(cur(), now), now)
      if (wasIdle) markTest(now)
    },

    /** Тестовый режим: все таймеры по 20 секунд (на кнопках — секунды), телефону уходит полная ценность 🩸. Только когда ничего не идёт. */
    toggleTest() {
      if (!core.toggleTest(cur())) return
      lastLabel = []
      if (ST.test) clearLogs()   // новый тест — журнал с чистого листа
      save()
      feedback('mode')
    },

    /** Нажатие на розовый или зелёный экран. Розовый (на цифры): временная пауза 🩸 и возврат (core.tapOverlay). Зелёный: пауза кончается раньше срока, занятие
     *  продолжается с того же места (core.endPause). */
    ovTap() {
      const now = Date.now()
      if (view !== 'ov' || now - lpAt < 800) return
      const k = core.overlayKind(cur())
      if (k === 'g') {
        const r = core.endPause(cur(), now)
        this.settle(r.res, now)
        if (r.changed) feedback('tick')
        return
      }
      if (k !== 'a') return
      const r = core.tapOverlay(cur(), now)
      this.settle(r.res, now)
      if (r.changed) feedback('tick')
    },

    /** Нажатие на верхнюю часть розового экрана (очередь или 🔄 и эмодзи занятия): зелёная пауза на пять минут (core.startPause). */
    ovTopTap() {
      const now = Date.now()
      if (view !== 'ov' || now - lpAt < 800 || core.overlayKind(cur()) !== 'a') return
      const r = core.startPause(cur(), now)
      this.settle(r.res, now)
      if (r.changed) feedback('tick')
    },

    /** Долгое нажатие на розовый или зелёный экран: остановка совсем. */
    ovExit() {
      const now = Date.now()
      lpAt = now
      const r = core.stopAll(cur(), now)   // занятие шлёт пройденное время (и замороженное при паузе тоже)
      enterView('main')
      this.settle(r.res, now)
    },

    /** Спросить у телефона вид экрана (поле v в ответе, если телефон его присылает). Очередь занятий с телефоном не сверяется, баланса и цен больше нет. */
    syncPhone(force) {
      const now = Date.now()
      if (!force && syncing && now - syncAt < 30000) return
      syncing = true
      syncAt = now
      this.request({ method: 'u613.send', params: { t: 'sync' } })
        .then((res) => {
          syncing = false
          const r = res && res.ok ? res.reply : null
          if (r && r.v) guard('вид', () => setView(r.v))
        })
        .catch(() => { syncing = false })
    },

    /** Отправить телефону одно неподтверждённое событие (по одному за раз). */
    sendDue(now) {
      if (inflight && now - inflightAt < 30000) return
      const owner = ST
      const d = core.due(owner, now, SEND_GAP)
      if (!d.length) return
      const target = d[0]
      target.tried = now
      inflight = true
      inflightAt = now
      const id = target.id
      this.request({ method: 'u613.send', params: payloadFor(target) })
        .then((res) => {
          inflight = false
          const r = res && res.ok ? res.reply : null
          if (r && r.t === 'ack' && r.id === id) { core.ack(owner, id); save() }
          if (r && r.v) guard('вид', () => setView(r.v))
          if (r && r.t === 'ack' && r.id === id) this.sendDue(Date.now())
        })
        .catch(() => { inflight = false })
    }
  })
)
