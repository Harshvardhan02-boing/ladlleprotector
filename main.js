process.env.NTBA_FIX_319 = 1

const TelegramBot = require("node-telegram-bot-api")
const fs = require("fs-extra")
const { checkCoupon } = require("./checker")

const TOKEN = process.env.BOT_TOKEN || "8620466387:AAEuJFQSLm8KIvxaeVP8W6A9pA0BDyj7vXU"
const ADMIN_ID = 2090180877

const bot = new TelegramBot(TOKEN,{
 polling:{
  autoStart:true,
  interval:300,
  params:{timeout:10}
 }
})

fs.ensureDirSync("./vouchers")
fs.ensureDirSync("./cookies")

if(!fs.existsSync("users.json"))
 fs.writeJsonSync("users.json",[])

let mode={}
let valueMap={}
let cooldown={}

function guard(id){
 const now=Date.now()
 if(cooldown[id] && now-cooldown[id]<1000) return true
 cooldown[id]=now
 return false
}

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

function saveAtomic(id,data){

 const f=file(id)
 const tmp=f+".tmp"

 fs.writeJsonSync(tmp,data,{spaces:2})
 fs.renameSync(tmp,f)

}

function mainMenu(){

 return{
  reply_markup:{
   inline_keyboard:[
    [{text:"➕ Add Coupon",callback_data:"add"}],
    [{text:"📤 Retrieve Coupon",callback_data:"retrieve"}],
    [{text:"📊 My Coupons",callback_data:"stats"}],
    [{text:"🔎 Check Coupons",callback_data:"check"}],
    [{text:"🍪 Set Cookies",callback_data:"cookie"}],
    [{text:"🔍 Cookie Status",callback_data:"status"}]
   ]
  }
 }

}

function categoryMenu(){

 return{
  reply_markup:{
   inline_keyboard:[
    [{text:"500",callback_data:"val_500"}],
    [{text:"1000",callback_data:"val_1000"}],
    [{text:"2000",callback_data:"val_2000"}],
    [{text:"4000",callback_data:"val_4000"}],
    [{text:"⬅ Back",callback_data:"menu"}]
   ]
  }
 }

}

bot.onText(/\/start/,msg=>{

 const id=msg.from.id
 register(id)

 bot.sendMessage(
  id,
  "💳 *Coupon Manager*\n\nChoose an option below",
  {parse_mode:"Markdown",...mainMenu()}
 )

})

bot.on("callback_query",async q=>{

 const id=q.from.id
 const data=q.data

 if(guard(id))
  return bot.answerCallbackQuery(q.id,{text:"⏳ Slow down"})

 try{

 if(data==="menu"){
  return bot.editMessageText(
   "💳 *Coupon Manager*\n\nChoose an option below",
   {
    chat_id:id,
    message_id:q.message.message_id,
    parse_mode:"Markdown",
    ...mainMenu()
   }
  )
 }

 if(data==="add"){

  mode[id]="add"

  return bot.editMessageText(
   "➕ *Add Coupon*\n\nSelect coupon category",
   {
    chat_id:id,
    message_id:q.message.message_id,
    parse_mode:"Markdown",
    ...categoryMenu()
   }
  )

 }

 if(data==="retrieve"){

  mode[id]="retrieve"

  return bot.editMessageText(
   "📤 *Retrieve Coupon*\n\nSelect coupon category",
   {
    chat_id:id,
    message_id:q.message.message_id,
    parse_mode:"Markdown",
    ...categoryMenu()
   }
  )

 }

 if(data==="stats"){

  const d=load(id)

  return bot.editMessageText(
`📊 *Your Coupons*

500  → ${d["500"].length}
1000 → ${d["1000"].length}
2000 → ${d["2000"].length}
4000 → ${d["4000"].length}`,
{
 chat_id:id,
 message_id:q.message.message_id,
 parse_mode:"Markdown",
 ...mainMenu()
}
  )

 }

 if(data==="check"){

  mode[id]="check"

  return bot.editMessageText(
`🔎 *Coupon Checker*

Send coupons like this:

ABC123
XYZ456

Maximum 50 coupons.`,
{
 chat_id:id,
 message_id:q.message.message_id,
 parse_mode:"Markdown"
}
  )

 }

 if(data==="cookie"){

  mode[id]="cookie"

  return bot.editMessageText(
`🍪 *Set Cookies*

Paste your Shein cookies.

Accepted formats:

JSON
or

Header string`,
{
 chat_id:id,
 message_id:q.message.message_id,
 parse_mode:"Markdown"
}
  )

 }

 if(data==="status"){

  const r=await checkCoupon("TEST",id)

  if(r==="nocookie"){
   return bot.sendMessage(
    id,
`🍪 *No Cookies Found*

Please set cookies first.`,
{parse_mode:"Markdown"}
   )
  }

  return bot.sendMessage(
   id,
   "✅ Cookies detected and working"
  )

 }

 if(data.startsWith("val_")){

  const value=data.split("_")[1]
  valueMap[id]=value

  if(mode[id]==="add")
   return bot.sendMessage(id,"Send coupon code")

  if(mode[id]==="retrieve"){

   const d=load(id)

   if(!d[value] || d[value].length===0)
    return bot.sendMessage(id,"❌ No coupons available")

   const code=d[value].shift()

   saveAtomic(id,d)

   return bot.sendMessage(
    id,
    "🎟 Coupon\n`"+code+"`",
    {parse_mode:"Markdown"}
   )

  }

 }

 }catch(e){
  console.log("CALLBACK ERROR",e)
 }

})

bot.on("message",async msg=>{

 try{

 const id=msg.from.id
 const text=msg.text

 if(!text) return
 if(text.startsWith("/")) return

 const m=mode[id]

 if(m==="add"){

  const value=valueMap[id]

  if(!value)
   return bot.sendMessage(id,"Select category first")

  const d=load(id)

  const code=text.trim()

  if(d[value].includes(code))
   return bot.sendMessage(id,"Coupon already exists")

  d[value].push(code)

  saveAtomic(id,d)

  return bot.sendMessage(id,"✅ Coupon stored")

 }

 if(m==="check"){

  const raw=text.replace(/,/g,"\n").split("\n")

  const coupons=raw.map(x=>x.trim()).filter(x=>x).slice(0,50)

  const results=await Promise.all(
   coupons.map(async c=>{
    const r=await checkCoupon(c,id)
    return "`"+c+"` : "+r
   })
  )

  return bot.sendMessage(
   id,
   results.join("\n"),
   {parse_mode:"Markdown"}
  )

 }

 if(m==="cookie"){

  let cookie=text.trim()
  let valid=false

  if(cookie.includes("=") && cookie.includes(";"))
   valid=true

  try{
   JSON.parse(cookie)
   valid=true
  }catch{}

  if(!valid)
   return bot.sendMessage(
    id,
    "❌ Invalid cookie format"
   )

  fs.writeFileSync(`./cookies/${id}.json`,cookie)

  return bot.sendMessage(
   id,
   "🍪 Cookies saved successfully"
  )

 }

 }catch(e){
  console.log("MESSAGE ERROR",e)
 }

})

bot.onText(/\/announce (.+)/,(msg,match)=>{

 if(msg.from.id!==ADMIN_ID) return

 const message=match[1]

 const u=users()

 u.forEach(x=>{
  bot.sendMessage(x,message).catch(()=>{})
 })

})

console.log("Bot running")
