process.env.NTBA_FIX_319 = 1

const TelegramBot = require("node-telegram-bot-api")
const fs = require("fs-extra")
const {checkCoupon} = require("./checker")

const TOKEN = process.env.BOT_TOKEN || "8620466387:AAEuJFQSLm8KIvxaeVP8W6A9pA0BDyj7vXU"
const ADMIN_ID = 2090180877

const bot = new TelegramBot(TOKEN,{polling:true})

fs.ensureDirSync("./vouchers")
fs.ensureDirSync("./cookies")

if(!fs.existsSync("users.json"))
 fs.writeJsonSync("users.json",[])

let mode={}
let valueMap={}

function users(){
 return fs.readJsonSync("users.json")
}

function register(id){

 let u=users()

 if(!u.includes(id)){
  u.push(id)
  fs.writeJsonSync("users.json",u)
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
 fs.writeJsonSync(file(id),data)
}

function cookieExists(id){
 return fs.existsSync(`./cookies/${id}.json`)
}

function indiaTime(){

 return new Date().toLocaleTimeString(
  "en-IN",
  {timeZone:"Asia/Kolkata"}
 )

}

function mainMenu(userId){

 let buttons=[

  [{text:"➕ Add Coupon",callback_data:"add"}],
  [{text:"📤 Retrieve Coupon",callback_data:"retrieve"}],
  [{text:"📊 My Coupons",callback_data:"stats"}],
  [{text:"🔎 Check Coupons",callback_data:"check"}],
  [{text:"🍪 Set Cookies",callback_data:"cookie"}],
  [{text:"🔍 Cookie Status",callback_data:"status"}]

 ]

 if(userId===ADMIN_ID)
  buttons.push([{text:"📢 Announcement",callback_data:"announce"}])

 return {reply_markup:{inline_keyboard:buttons}}

}

function categoryMenu(){

 return {
  reply_markup:{
   inline_keyboard:[
    [{text:"💰 ₹500",callback_data:"val_500"}],
    [{text:"💰 ₹1000",callback_data:"val_1000"}],
    [{text:"💰 ₹2000",callback_data:"val_2000"}],
    [{text:"💰 ₹4000",callback_data:"val_4000"}],
    [{text:"⬅ Back",callback_data:"menu"}]
   ]
  }
 }

}

bot.onText(/\/start/,async msg=>{

 const id=msg.from.id

 register(id)

 bot.sendMessage(
  id,
`💳 *Coupon Manager*

Manage and protect your coupons.

👇 Select an option`,
 {parse_mode:"Markdown",...mainMenu(id)}
 )

})

bot.on("callback_query",async query=>{

 const id=query.from.id
 const data=query.data

 if(data==="menu")
  return bot.sendMessage(id,"Main Menu",mainMenu(id))

 if(data==="cookie"){

  mode[id]="cookie"

  return bot.sendMessage(
   id,
`🍪 *Set Cookies*

Before sending cookies:

🛒 Add *1 or more items* to your Shein cart  
📦 Make sure the product is *in stock*  
🔑 Then extract cookies from your browser

Paste the cookie string here.`,
   {parse_mode:"Markdown"}
  )

 }

 if(data==="add"){

  if(!cookieExists(id))
   return bot.sendMessage(id,"🍪 Please set cookies first.")

  mode[id]="add"

  return bot.sendMessage(id,"Select coupon value",categoryMenu())

 }

 if(data==="retrieve"){

  if(!cookieExists(id))
   return bot.sendMessage(id,"🍪 Please set cookies first.")

  mode[id]="retrieve"

  return bot.sendMessage(id,"Select coupon value",categoryMenu())

 }

 if(data==="check"){

  if(!cookieExists(id))
   return bot.sendMessage(id,"🍪 Cookies required before checking coupons.")

  mode[id]="check"

  return bot.sendMessage(
   id,
`🔎 Send coupons to check

Example

ABC123
XYZ999

Maximum 50 coupons`
  )

 }

 if(data==="status"){

  if(!cookieExists(id))
   return bot.sendMessage(id,"❌ No cookies saved")

  return bot.sendMessage(id,"✅ Cookies detected and active")

 }

 if(data==="stats"){

  const d=load(id)

  return bot.sendMessage(
   id,
`📊 Your Coupons

₹500 : ${d["500"].length}
₹1000 : ${d["1000"].length}
₹2000 : ${d["2000"].length}
₹4000 : ${d["4000"].length}`
  )

 }

 if(data.startsWith("val_")){

  const value=data.split("_")[1]

  valueMap[id]=value

  if(mode[id]==="add")
   return bot.sendMessage(id,"Send coupon code")

  if(mode[id]==="retrieve"){

   const d=load(id)

   if(d[value].length===0)
    return bot.sendMessage(id,"No coupons available")

   const code=d[value].shift()

   save(id,d)

   return bot.sendMessage(id,`🎟 Coupon\n${code}`)
  }

 }

})

bot.on("message",async msg=>{

 const id=msg.from.id
 const text=msg.text

 if(!text) return
 if(text.startsWith("/")) return

 const m=mode[id]

 if(m==="cookie"){

  fs.writeFileSync(
   `./cookies/${id}.json`,
   JSON.stringify({cookie:text.trim()})
  )

  return bot.sendMessage(id,"🍪 Cookies saved successfully")

 }

 if(m==="add"){

  if(!cookieExists(id))
   return bot.sendMessage(id,"🍪 Cookies missing. Cannot store coupon.")

  const value=valueMap[id]
  const d=load(id)

  const code=text.trim()

  if(d[value].includes(code))
   return bot.sendMessage(id,"⚠ Coupon already stored")

  d[value].push(code)

  save(id,d)

  return bot.sendMessage(id,"✅ Coupon added")

 }

 if(m==="check"){

  if(!cookieExists(id))
   return bot.sendMessage(id,"🍪 Cookies required")

  const raw=text.replace(/,/g,"\n").split("\n")

  const coupons=raw.map(x=>x.trim()).filter(x=>x).slice(0,50)

  bot.sendMessage(id,`🔍 Checking ${coupons.length} coupons...`)

  const results=await Promise.all(
   coupons.map(c=>checkCoupon(c,id))
  )

  if(results.includes("nocookie"))
   return bot.sendMessage(id,"🍪 Cookies missing. Please set them again.")

  let out=[]

  for(let i=0;i<coupons.length;i++){

   let emoji="🔴"
   let status="INVALID"

   if(results[i]==="VALID"){
    emoji="🟢"
    status="VALID"
   }

   if(results[i]==="REDEEMED"){
    emoji="🟡"
    status="ALREADY USED"
   }

   out.push(`${emoji} ${coupons[i]}

Status : ${status}
Time : ${indiaTime()}

────────────`)
  }

  bot.sendMessage(
   id,
   "📊 *Check Results*\n\n"+out.join("\n"),
   {parse_mode:"Markdown"}
  )

 }

})

console.log("Bot running")
