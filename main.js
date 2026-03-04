process.env.NTBA_FIX_319 = 1

const TelegramBot = require("node-telegram-bot-api")
const fs = require("fs-extra")
const {checkCoupon} = require("./checker")

const TOKEN = process.env.BOT_TOKEN || "8620466387:AAEuJFQSLm8KIvxaeVP8W6A9pA0BDyj7vXU"
const ADMIN_ID = 2090180877

const bot = new TelegramBot(TOKEN,{
 polling:{autoStart:true,interval:300,params:{timeout:10}}
})

fs.ensureDirSync("./vouchers")
fs.ensureDirSync("./cookies")

if(!fs.existsSync("users.json"))
 fs.writeJsonSync("users.json",[])

let mode={}
let valueMap={}
let cooldown={}

function guard(id){

 const now = Date.now()

 if(cooldown[id] && now-cooldown[id]<1000)
  return true

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

function mainMenu(userId){

 let buttons=[

  [{text:"➕ Add Coupon",callback_data:"add"}],
  [{text:"📤 Retrieve Coupon",callback_data:"retrieve"}],
  [{text:"📊 My Coupons",callback_data:"stats"}],
  [{text:"🔎 Check Coupons",callback_data:"check"}],
  [{text:"🍪 Set Cookies",callback_data:"cookie"}],
  [{text:"🔍 Cookie Status",callback_data:"status"}]

 ]

 if(userId===ADMIN_ID){
  buttons.push([{text:"📢 Announcement",callback_data:"announce"}])
 }

 return{
  reply_markup:{inline_keyboard:buttons}
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
  "💳 Coupon Manager\n\nChoose an option:",
  mainMenu(id)
 )

})

bot.on("callback_query",async q=>{

 const id=q.from.id
 const data=q.data

 if(guard(id))
  return bot.answerCallbackQuery(q.id,{text:"⏳ Slow down"})

 try{

 if(data==="menu")
  return bot.sendMessage(id,"Main Menu",mainMenu(id))

 if(data==="add"){
  mode[id]="add"
  return bot.sendMessage(id,"Select category",categoryMenu())
 }

 if(data==="retrieve"){
  mode[id]="retrieve"
  return bot.sendMessage(id,"Select category",categoryMenu())
 }

 if(data==="stats"){

  const d=load(id)

  return bot.sendMessage(
   id,
`📊 Your Coupons

500 : ${d["500"].length}
1000 : ${d["1000"].length}
2000 : ${d["2000"].length}
4000 : ${d["4000"].length}`
  )

 }

 if(data==="check"){

  mode[id]="check"

  return bot.sendMessage(
   id,
`🔎 Send coupons to check

Example:
ABC123
XYZ999

Max 50 coupons`
  )

 }

 if(data==="cookie"){

  mode[id]="cookie"

  return bot.sendMessage(
   id,
`🍪 Paste your Shein cookies`
  )

 }

 if(data==="status"){

  const cookieFile=`./cookies/${id}.json`

  if(!fs.existsSync(cookieFile))
   return bot.sendMessage(id,"❌ No cookies set")

  return bot.sendMessage(id,"✅ Cookies detected")

 }

 if(data==="announce" && id===ADMIN_ID){

  mode[id]="announce"

  return bot.sendMessage(
   id,
   "📢 Send announcement message"
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
    return bot.sendMessage(id,"❌ No coupons")

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
  console.log(e)
 }

})

async function batchCheck(coupons,id){

 const results=[]
 const batchSize=5

 for(let i=0;i<coupons.length;i+=batchSize){

  const batch=coupons.slice(i,i+batchSize)

  const res=await Promise.all(

   batch.map(async code=>{

    if(code.length>25)
     return {code,result:"INVALID"}

    const r=await checkCoupon(code,id)

    return {code,result:r}

   })

  )

  results.push(...res)

 }

 return results

}

bot.on("message",async msg=>{

 try{

 const id=msg.from.id
 const text=msg.text

 if(!text) return
 if(text.startsWith("/")) return

 const m=mode[id]

 if(m==="add"){

  const value=valueMap[id]
  const d=load(id)

  const code=text.trim()

  if(d[value].includes(code))
   return bot.sendMessage(id,"Coupon already exists")

  d[value].push(code)

  saveAtomic(id,d)

  return bot.sendMessage(id,"✅ Coupon added")

 }

 if(m==="check"){

  const raw=text.replace(/,/g,"\n").split("\n")

  const coupons=raw.map(x=>x.trim()).filter(x=>x).slice(0,50)

  const data=await batchCheck(coupons,id)

  const time=new Date().toLocaleTimeString()

  let out=[]

  for(const r of data){

   let emoji="🔴"
   let status="INVALID"

   if(r.result==="VALID"){
    emoji="🟢"
    status="VALID"
   }

   if(r.result==="REDEEMED"){
    emoji="🟡"
    status="REDEEMED"
   }

   if(r.result==="COOKIE_EXPIRED")
    return bot.sendMessage(
     id,
     "🍪 Cookies expired. Please set cookies again."
    )

   if(r.result==="NO_COOKIE")
    return bot.sendMessage(
     id,
     "🍪 No cookies found. Please set cookies."
    )

   out.push(
`${emoji} ${r.code}

────────────
Status : ${status}
Time   : ${time}`
   )

  }

  return bot.sendMessage(
   id,
   out.join("\n\n")
  )

 }

 if(m==="cookie"){

  const cookie=text.trim()

  fs.writeFileSync(
   `./cookies/${id}.json`,
   JSON.stringify({cookie:cookie,created:Date.now()})
  )

  return bot.sendMessage(
   id,
   "🍪 Cookies saved successfully"
  )

 }

 if(m==="announce" && id===ADMIN_ID){

  const u=users()

  for(const user of u)
   bot.sendMessage(user,"📢 "+text).catch(()=>{})

  mode[id]=null

  return bot.sendMessage(id,"Announcement sent")

 }

 }catch(e){
  console.log(e)
 }

})

console.log("Bot running")
