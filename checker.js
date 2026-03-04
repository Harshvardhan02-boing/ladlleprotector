process.env.NTBA_FIX_319 = 1

const TelegramBot = require("node-telegram-bot-api")
const fs = require("fs-extra")
const {checkCoupon} = require("./checker")

const TOKEN = process.env.BOT_TOKEN || "YOUR_TOKEN"
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

bot.setMyCommands([
 {command:"start",description:"Open menu"}
])

function sleep(ms){
 return new Promise(r=>setTimeout(r,ms))
}

async function smoothSend(id,text,opt={}){

 await bot.sendChatAction(id,"typing")

 await sleep(350)

 return bot.sendMessage(id,text,opt)

}

function guard(id){

 const now=Date.now()

 if(cooldown[id] && now-cooldown[id]<1200)
  return true

 cooldown[id]=now
 return false

}

function indiaTime(){

 return new Date().toLocaleTimeString(
  "en-IN",
  {timeZone:"Asia/Kolkata"}
 )

}

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

function saveAtomic(id,data){

 const f=file(id)
 const tmp=f+".tmp"

 fs.writeJsonSync(tmp,data)
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

 if(userId===ADMIN_ID)
  buttons.push([{text:"📢 Announcement",callback_data:"announce"}])

 return{
  reply_markup:{inline_keyboard:buttons}
 }

}

function categoryMenu(){

 return{
  reply_markup:{
   inline_keyboard:[
    [{text:"💵 ₹500",callback_data:"val_500"}],
    [{text:"💵 ₹1000",callback_data:"val_1000"}],
    [{text:"💵 ₹2000",callback_data:"val_2000"}],
    [{text:"💵 ₹4000",callback_data:"val_4000"}],
    [{text:"⬅ Back",callback_data:"menu"}]
   ]
  }
 }

}

bot.onText(/\/start/,async msg=>{

 const id=msg.from.id

 register(id)

 await smoothSend(
  id,
`💳 *Coupon Manager*

Manage and verify your coupons easily.

Choose an option below`,
 {parse_mode:"Markdown",...mainMenu(id)}
 )

})

async function batchCheck(coupons,id){

 const results=[]

 for(const code of coupons){

  await bot.sendChatAction(id,"typing")

  await sleep(120)

  const r = await checkCoupon(code,id)

  results.push({code,result:r})

 }

 return results

}

bot.on("message",async msg=>{

 const id=msg.from.id
 const text=msg.text

 if(!text) return
 if(text.startsWith("/")) return

 const m=mode[id]

 if(m==="check"){

  const raw=text.replace(/,/g,"\n").split("\n")

  const coupons=raw.map(x=>x.trim()).filter(x=>x).slice(0,50)

  await smoothSend(
   id,
`🔍 Checking ${coupons.length} coupon${coupons.length>1?"s":""}...`
  )

  const data = await batchCheck(coupons,id)

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

   out.push(
`${emoji} ${r.code}

Status : ${status}
Time   : ${indiaTime()}

────────────`
   )

  }

  return smoothSend(
   id,
   "📊 *Check Results*\n\n"+out.join("\n"),
   {parse_mode:"Markdown"}
  )

 }

})
