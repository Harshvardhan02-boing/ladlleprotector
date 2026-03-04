const TelegramBot = require("node-telegram-bot-api")
const fs = require("fs-extra")
const {checkCoupon} = require("./checker")

const TOKEN = process.env.BOT_TOKEN || "8620466387:AAEuJFQSLm8KIvxaeVP8W6A9pA0BDyj7vXU"
const ADMIN_ID = 2090180877

const bot = new TelegramBot(TOKEN,{polling:true})

fs.ensureDirSync("./vouchers")
fs.ensureDirSync("./cookies")
fs.ensureDirSync("./logs")

if(!fs.existsSync("users.json"))
 fs.writeJsonSync("users.json",[])

let userMode={}

function users(){
 return fs.readJsonSync("users.json")
}

function saveUsers(u){
 fs.writeJsonSync("users.json",u)
}

function register(id){

 let u=users()

 if(!u.includes(id)){
  u.push(id)
  saveUsers(u)
 }
}

function file(id){

 const f=`./vouchers/${id}.json`

 if(!fs.existsSync(f)){

  fs.writeJsonSync(f,{
   "500":[],
   "1000":[],
   "2000":[],
   "4000":[]
  })

 }

 return f
}

function load(id){
 return fs.readJsonSync(file(id))
}

function save(id,data){

 const f=file(id)
 const temp=f+".tmp"

 fs.writeJsonSync(temp,data,{spaces:2})
 fs.renameSync(temp,f)
}

function count(id){

 const d=load(id)

 return{
  "500":d["500"].length,
  "1000":d["1000"].length,
  "2000":d["2000"].length,
  "4000":d["4000"].length
 }
}

function mainMenu(){

 return{
  parse_mode:"Markdown",
  reply_markup:{
   inline_keyboard:[

    [{text:"➕ Add Coupon",callback_data:"add"}],
    [{text:"📤 Retrieve Coupon",callback_data:"retrieve"}],
    [{text:"📊 My Coupons",callback_data:"stats"}],
    [{text:"🔎 Check Coupons",callback_data:"check"}],
    [{text:"🍪 Set Cookies",callback_data:"setcookie"}],
    [{text:"🔍 Cookie Status",callback_data:"cookiestatus"}]

   ]
  }
 }
}

function sendValueMenu(id){

 const c=count(id)

 bot.sendMessage(
  id,
`🎟 Coupon Categories
━━━━━━━━━━━━━━━━━━

Select a coupon category`,
{
 parse_mode:"Markdown",
 reply_markup:{
  inline_keyboard:[

   [{text:`💰 ₹500   • Stock: ${c["500"]}`,callback_data:"value_500"}],
   [{text:`💰 ₹1000  • Stock: ${c["1000"]}`,callback_data:"value_1000"}],
   [{text:`💰 ₹2000  • Stock: ${c["2000"]}`,callback_data:"value_2000"}],
   [{text:`💰 ₹4000  • Stock: ${c["4000"]}`,callback_data:"value_4000"}],
   [{text:"⬅ Back",callback_data:"menu"}]

  ]
 }
})
}

bot.onText(/\/start/,msg=>{

 const id=msg.from.id

 register(id)

 bot.sendMessage(
  id,
`💳 *Coupon Manager*

Manage your coupons easily.`,
 mainMenu()
 )

})

bot.on("callback_query",async q=>{

 const id=q.from.id
 const data=q.data

 if(data==="menu")
  return bot.sendMessage(id,"Main Menu",mainMenu())

 if(data==="add"){

  userMode[id]="add"

  sendValueMenu(id)

 }

 if(data==="retrieve"){

  userMode[id]="retrieve"

  sendValueMenu(id)

 }

 if(data==="stats"){

  const c=count(id)

  bot.sendMessage(
   id,
`📊 Coupon Inventory
━━━━━━━━━━━━━━━━━━

💰 ₹500   → ${c["500"]} coupons
💰 ₹1000  → ${c["1000"]} coupons
💰 ₹2000  → ${c["2000"]} coupons
💰 ₹4000  → ${c["4000"]} coupons`,
{parse_mode:"Markdown"}
  )

 }

 if(data==="check"){

  userMode[id]="check"

  bot.sendMessage(
   id,
`🔎 Coupon Checker
━━━━━━━━━━━━━━

Send coupons to verify.

Example:

ABC123
XYZ456

⚠ Maximum 50 coupons`,
{parse_mode:"Markdown"}
  )

 }

 if(data==="setcookie"){

  userMode[id]="cookie"

  bot.sendMessage(
   id,
`🍪 Cookie Setup
━━━━━━━━━━━━━━

Paste your *Shein cookies*

Accepted formats:

1️⃣ JSON cookie

{
 "session":"abc"
}

2️⃣ Header cookie

session=abc; token=xyz`,
{parse_mode:"Markdown"}
  )

 }

 if(data==="cookiestatus"){

  const r=await checkCoupon("TESTCODE",id)

  if(r==="nocookie")
   return bot.sendMessage(id,"❌ No cookies saved")

  bot.sendMessage(id,"✅ Cookie file detected")

 }

 if(data.startsWith("value_")){

  const value=data.split("_")[1]

  userMode[id+"_value"]=value

  if(userMode[id]==="add")
   bot.sendMessage(id,"Send coupon code")

  if(userMode[id]==="retrieve"){

   const d=load(id)

   if(d[value].length===0)
    return bot.sendMessage(id,"❌ No coupons available")

   const code=d[value].shift()

   save(id,d)

   bot.sendMessage(id,
`🎟 Coupon Retrieved

\`${code}\``,
{parse_mode:"Markdown"}
   )

  }

 }

})

bot.on("message",async msg=>{

 const id=msg.from.id
 const text=msg.text

 if(!text) return
 if(text.startsWith("/")) return

 const mode=userMode[id]

 if(mode==="add"){

  const value=userMode[id+"_value"]

  const data=load(id)

  const code=text.trim()

  if(data[value].includes(code))
   return bot.sendMessage(id,"⚠ Coupon already exists")

  data[value].push(code)

  save(id,data)

  bot.sendMessage(id,"✅ Coupon stored")

 }

 if(mode==="check"){

  const raw=text.replace(/,/g,"\n").split("\n")

  const coupons=raw.map(x=>x.trim()).filter(x=>x).slice(0,50)

  let results=[]

  for(const c of coupons){

   const r=await checkCoupon(c,id)

   results.push("`"+c+"` : "+r)

  }

  bot.sendMessage(id,results.join("\n"),{parse_mode:"Markdown"})

 }

 if(mode==="cookie"){

  let cookie=text.trim()

  let valid=false

  if(cookie.includes("=") && cookie.includes(";"))
   valid=true

  try{
   JSON.parse(cookie)
   valid=true
  }catch{}

  if(!valid){

   bot.sendMessage(id,"❌ Invalid cookie format")

   return
  }

  fs.writeFileSync(`./cookies/${id}.json`,cookie)

  bot.sendMessage(id,"✅ Cookies saved successfully")

 }

})

bot.onText(/\/announce (.+)/,(msg,match)=>{

 if(msg.from.id!==ADMIN_ID) return

 const message=match[1]

 const u=users()

 u.forEach(x=>bot.sendMessage(x,message).catch(()=>{}))

})
