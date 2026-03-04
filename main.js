process.env.NTBA_FIX_319 = 1

const TelegramBot = require("node-telegram-bot-api")
const fs = require("fs-extra")
const axios = require("axios")
const { checkCoupon } = require("./checker")

const TOKEN = process.env.BOT_TOKEN || "8620466387:AAEuJFQSLm8KIvxaeVP8W6A9pA0BDyj7vXU"
const ADMIN_ID = 2090180877

const bot = new TelegramBot(TOKEN, {
  polling: { autoStart: true, interval: 300, params: { timeout: 10 } }
})

fs.ensureDirSync("./vouchers")
fs.ensureDirSync("./cookies")

if (!fs.existsSync("users.json"))
  fs.writeJsonSync("users.json", [])

let mode = {}
let valueMap = {}
let cooldown = {}

bot.setMyCommands([
  { command: "start", description: "Open menu" }
])

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function smoothSend(id, text, opt = {}) {
  await bot.sendChatAction(id, "typing")
  await sleep(300)
  return bot.sendMessage(id, text, opt)
}

function guard(id) {
  const now = Date.now()
  if (cooldown[id] && now - cooldown[id] < 1200)
    return true
  cooldown[id] = now
  return false
}

function indiaTime() {
  return new Date().toLocaleTimeString(
    "en-IN",
    { timeZone: "Asia/Kolkata" }
  )
}

function users() {
  return fs.readJsonSync("users.json")
}

function register(id) {
  let u = users()
  if (!u.includes(id)) {
    u.push(id)
    fs.writeJsonSync("users.json", u)
  }
}

function file(id) {
  const f = `./vouchers/${id}.json`
  if (!fs.existsSync(f)) {
    fs.writeJsonSync(f, {
      "500": [],
      "1000": [],
      "2000": [],
      "4000": []
    })
  }
  return f
}

function load(id) {
  return fs.readJsonSync(file(id))
}

function saveAtomic(id, data) {
  const f = file(id)
  const tmp = f + ".tmp"
  fs.writeJsonSync(tmp, data)
  fs.renameSync(tmp, f)
}

function mainMenu(userId) {

  let buttons = [
    [{ text: "➕ Add Coupon", callback_data: "add" }],
    [{ text: "📤 Retrieve Coupon", callback_data: "retrieve" }],
    [{ text: "📊 My Coupons", callback_data: "stats" }],
    [{ text: "🔎 Check Coupons", callback_data: "check" }],
    [{ text: "🍪 Set Cookies", callback_data: "cookie" }],
    [{ text: "🔍 Cookie Status", callback_data: "status" }]
  ]

  if (userId === ADMIN_ID)
    buttons.push([{ text: "📢 Announcement", callback_data: "announce" }])

  return {
    reply_markup: { inline_keyboard: buttons }
  }
}

function categoryMenu() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "💵 ₹500", callback_data: "val_500" }],
        [{ text: "💵 ₹1000", callback_data: "val_1000" }],
        [{ text: "💵 ₹2000", callback_data: "val_2000" }],
        [{ text: "💵 ₹4000", callback_data: "val_4000" }],
        [{ text: "⬅ Back", callback_data: "menu" }]
      ]
    }
  }
}

bot.onText(/\/start/, async msg => {

  const id = msg.from.id
  register(id)

  await smoothSend(
    id,
`💳 *Coupon Manager*

Store, protect and verify your coupons safely.

Choose an option below ⬇`,
    { parse_mode: "Markdown", ...mainMenu(id) }
  )

})

bot.on("callback_query", async q => {

  const id = q.from.id
  const data = q.data

  if (guard(id))
    return bot.answerCallbackQuery(q.id, { text: "⏳ Slow down" })

  if (data === "menu")
    return smoothSend(id, "Main Menu", mainMenu(id))

  if (data === "add") {
    mode[id] = "add"
    return smoothSend(id, "Select coupon category", categoryMenu())
  }

  if (data === "retrieve") {
    mode[id] = "retrieve"
    return smoothSend(id, "Select coupon category", categoryMenu())
  }

  if (data === "stats") {

    const d = load(id)

    return smoothSend(
      id,
`📊 *Your Coupons*

💵 ₹500  : ${d["500"].length}
💵 ₹1000 : ${d["1000"].length}
💵 ₹2000 : ${d["2000"].length}
💵 ₹4000 : ${d["4000"].length}`,
      { parse_mode: "Markdown" }
    )
  }

  if (data === "check") {
    mode[id] = "check"
    return smoothSend(
      id,
`🔎 *Coupon Checker*

Send coupons to verify.

Example:

ABC123
XYZ999

Maximum: 50 coupons`,
      { parse_mode: "Markdown" }
    )
  }

  if (data === "cookie") {
    mode[id] = "cookie"
    return smoothSend(
      id,
`🍪 *Set Cookies*

Paste your Shein cookie string.`,
      { parse_mode: "Markdown" }
    )
  }

  if (data === "status") {

    const f = `./cookies/${id}.json`

    if (!fs.existsSync(f))
      return smoothSend(id, "❌ No cookies set")

    return smoothSend(id, "✅ Cookies detected")
  }

  if (data === "announce" && id === ADMIN_ID) {
    mode[id] = "announce"
    return smoothSend(id, "📢 Send announcement message")
  }

  if (data.startsWith("val_")) {

    const value = data.split("_")[1]
    valueMap[id] = value

    if (mode[id] === "add")
      return smoothSend(id, "Send coupon code")

    if (mode[id] === "retrieve") {

      const d = load(id)

      if (d[value].length === 0)
        return smoothSend(id, "❌ No coupons available")

      const code = d[value].shift()
      saveAtomic(id, d)

      return smoothSend(
        id,
`🎟 *Coupon Retrieved*

\`${code}\``,
        { parse_mode: "Markdown" }
      )
    }
  }

})

async function batchCheck(coupons, id) {

  const results = []

  for (const code of coupons) {

    await bot.sendChatAction(id, "typing")
    await sleep(80)

    const r = await checkCoupon(code, id)
    results.push({ code, result: r })

  }

  return results
}

bot.on("message", async msg => {

  const id = msg.from.id
  const text = msg.text

  if (!text) return
  if (text.startsWith("/")) return

  const m = mode[id]

  if (m === "add") {

    const value = valueMap[id]
    const d = load(id)
    const code = text.trim()

    if (d[value].includes(code))
      return smoothSend(id, "⚠ Coupon already exists")

    d[value].push(code)
    saveAtomic(id, d)

    return smoothSend(id, "✅ Coupon added successfully")
  }

  if (m === "check") {

    const raw = text.replace(/,/g, "\n").split("\n")
    const coupons = raw.map(x => x.trim()).filter(x => x).slice(0, 50)

    await smoothSend(
      id,
`🔍 Checking ${coupons.length} coupon${coupons.length > 1 ? "s" : ""}...`
    )

    const data = await batchCheck(coupons, id)

    let out = []

    for (const r of data) {

      let emoji = "🔴"
      let status = "INVALID"

      if (r.result === "VALID") {
        emoji = "🟢"
        status = "VALID"
      }

      if (r.result === "REDEEMED") {
        emoji = "🟡"
        status = "REDEEMED"
      }

      out.push(
`${emoji} ${r.code}

Status : ${status}
Time   : ${indiaTime()}

────────────`
      )
    }

    return smoothSend(
      id,
      "📊 *Check Results*\n\n" + out.join("\n"),
      { parse_mode: "Markdown" }
    )
  }

  if (m === "cookie") {

    fs.writeFileSync(
      `./cookies/${id}.json`,
      JSON.stringify({ cookie: text.trim(), created: Date.now() })
    )

    return smoothSend(id, "🍪 Cookies saved successfully")
  }

  if (m === "announce" && id === ADMIN_ID) {

    const u = users()

    for (const user of u)
      bot.sendMessage(user, "📢 " + text).catch(() => { })

    mode[id] = null
    return smoothSend(id, "Announcement sent")
  }

})

function getCookie(userId) {

  const file = `./cookies/${userId}.json`
  if (!fs.existsSync(file)) return null

  const data = JSON.parse(fs.readFileSync(file))
  return data.cookie
}

function headers(cookie) {

  return {
    "accept": "application/json",
    "content-type": "application/json",
    "origin": "https://www.sheinindia.in",
    "referer": "https://www.sheinindia.in/cart",
    "user-agent": "Mozilla/5.0",
    "x-tenant-id": "SHEIN",
    "cookie": cookie
  }
}

async function protectUserCoupons(userId) {

  const cookie = getCookie(userId)
  if (!cookie) return

  const data = load(userId)

  const coupons = [
    ...data["500"],
    ...data["1000"],
    ...data["2000"],
    ...data["4000"]
  ]

  for (const code of coupons) {

    try {

      await axios.post(
        "https://www.sheinindia.in/api/cart/apply-voucher",
        { voucherId: code, device: { client_type: "web" } },
        { headers: headers(cookie), timeout: 15000 }
      )

      await axios.post(
        "https://www.sheinindia.in/api/cart/reset-voucher",
        { voucherId: code, device: { client_type: "web" } },
        { headers: headers(cookie), timeout: 15000 }
      )

    } catch (e) { }

  }

}

setInterval(async () => {

  const u = users()

  for (const user of u) {
    try {
      await protectUserCoupons(user)
    } catch { }
  }

}, 30000)

console.log("Bot running with protector")
