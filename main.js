const TelegramBot = require("node-telegram-bot-api")
const fs = require("fs-extra")
const {checkCoupon} = require("./checker")

const TOKEN = "8620466387:AAEuJFQSLm8KIvxaeVP8W6A9pA0BDyj7vXU"
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

function menu(){

 return{
  reply_markup:{
   keyboard:[
    ["➕ Add Coupon","📤 Retrieve"],
    ["📊 My Coupons","🔎 Check"],
    ["🍪 Set Cookies","🔍 Cookie Status"]
   ],
   resize_keyboard:true
  }
 }
}

bot.onText(/\/start/,msg=>{

 const id=msg.from.id

 register(id)

 bot.sendMessage(id,"💳 Coupon Manager",menu())

})

bot.onText(/➕ Add Coupon/,msg=>{

 const id=msg.from.id

 userMode[id]="add"

 const c=count(id)

 bot.sendMessage(id,
`Select value

₹500 (${c["500"]})
₹1000 (${c["1000"]})
₹2000 (${c["2000"]})
₹4000 (${c["4000"]})`)
})

bot.onText(/📤 Retrieve/,msg=>{

 const id=msg.from.id

 userMode[id]="retrieve"

 const c=count(id)

 bot.sendMessage(id,
`Select value

₹500 (${c["500"]})
₹1000 (${c["1000"]})
₹2000 (${c["2000"]})
₹4000 (${c["4000"]})`)
})

bot.onText(/📊 My Coupons/,msg=>{

 const id=msg.from.id

 const c=count(id)

 bot.sendMessage(id,
`Your Coupons

₹500 : ${c["500"]}
₹1000 : ${c["1000"]}
₹2000 : ${c["2000"]}
₹4000 : ${c["4000"]}`)
})

bot.onText(/🔎 Check/,msg=>{

 userMode[msg.from.id]="check"

 bot.sendMessage(msg.from.id,
`Send coupons

Max 50`)
})

bot.onText(/🍪 Set Cookies/,msg=>{

 userMode[msg.from.id]="cookie"

 bot.sendMessage(msg.from.id,"Paste cookies")
})

bot.onText(/🔍 Cookie Status/,async msg=>{

 const id=msg.from.id

 const r=await checkCoupon("TESTCODE",id)

 if(r==="nocookie")
  return bot.sendMessage(id,"❌ No cookies")

 bot.sendMessage(id,"✅ Cookie file found")
})

bot.on("message",async msg=>{

 const id=msg.from.id
 const text=msg.text

 if(!text) return
 if(text.startsWith("/")) return

 if(text.includes("₹")){

  const value=text.split("₹")[1].split(" ")[0]

  userMode[id+"_value"]=value

  if(userMode[id]=="add")
   bot.sendMessage(id,"Send coupon")

  if(userMode[id]=="retrieve"){

   const data=load(id)

   if(data[value].length===0)
    return bot.sendMessage(id,"No coupons")

   const code=data[value].shift()

   save(id,data)

   bot.sendMessage(id,"`"+code+"`",{parse_mode:"Markdown"})
  }

  return
}

const mode=userMode[id]

if(mode==="add"){

 const value=userMode[id+"_value"]
 const data=load(id)

 const code=text.trim()

 if(data[value].includes(code))
  return bot.sendMessage(id,"⚠ Duplicate")

 data[value].push(code)

 save(id,data)

 bot.sendMessage(id,"Coupon added")
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

 fs.writeFileSync(`./cookies/${id}.json`,text)

 bot.sendMessage(id,"Cookies saved")
}

})

bot.onText(/\/announce (.+)/,(msg,match)=>{

 if(msg.from.id!==ADMIN_ID) return

 const message=match[1]

 const u=users()

 u.forEach(x=>bot.sendMessage(x,message).catch(()=>{}))

})
