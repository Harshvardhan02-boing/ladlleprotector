const TelegramBot = require('node-telegram-bot-api')
const fs = require('fs-extra')
const path = require('path')

const TOKEN = "YOUR_BOT_TOKEN"
const ADMIN_ID = 2090180877

const bot = new TelegramBot(TOKEN,{polling:true})

fs.ensureDirSync("./vouchers")
fs.ensureDirSync("./cookies")
fs.ensureDirSync("./logs")

if(!fs.existsSync("users.json")) fs.writeJsonSync("users.json",[])

let userMode = {}

function loadUsers(){
 return fs.readJsonSync("users.json")
}

function saveUsers(users){
 fs.writeJsonSync("users.json",users)
}

function registerUser(id){
 let users = loadUsers()
 if(!users.includes(id)){
  users.push(id)
  saveUsers(users)
 }
}

function voucherFile(id){
 const file = `./vouchers/${id}.json`

 if(!fs.existsSync(file)){
  fs.writeJsonSync(file,{
   "500":[],
   "1000":[],
   "2000":[],
   "4000":[]
  })
 }

 return file
}

function loadVouchers(id){
 return fs.readJsonSync(voucherFile(id))
}

function saveVouchers(id,data){
 const file = voucherFile(id)
 const temp = file+".tmp"

 fs.writeJsonSync(temp,data,{spaces:2})
 fs.renameSync(temp,file)
}

function counts(id){
 const d = loadVouchers(id)

 return {
  "500":d["500"].length,
  "1000":d["1000"].length,
  "2000":d["2000"].length,
  "4000":d["4000"].length
 }
}

function menu(){
 return {
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

 const id = msg.from.id
 registerUser(id)

 bot.sendMessage(id,"💳 Coupon Manager\nChoose option below",menu())
})

bot.onText(/➕ Add Coupon/,msg=>{

 const id = msg.from.id
 userMode[id]="add"

 const c = counts(id)

 bot.sendMessage(id,
`Select coupon value

₹500 (${c["500"]})
₹1000 (${c["1000"]})
₹2000 (${c["2000"]})
₹4000 (${c["4000"]})`)
})

bot.onText(/📤 Retrieve/,msg=>{

 const id = msg.from.id
 userMode[id]="retrieve"

 const c = counts(id)

 bot.sendMessage(id,
`Select coupon value

₹500 (${c["500"]})
₹1000 (${c["1000"]})
₹2000 (${c["2000"]})
₹4000 (${c["4000"]})`)
})

bot.onText(/📊 My Coupons/,msg=>{

 const id = msg.from.id
 const c = counts(id)

 bot.sendMessage(id,
`Your Coupons

₹500 : ${c["500"]}
₹1000 : ${c["1000"]}
₹2000 : ${c["2000"]}
₹4000 : ${c["4000"]}`)
})

bot.onText(/🔎 Check/,msg=>{

 const id = msg.from.id
 userMode[id]="check"

 bot.sendMessage(id,
`Send coupons to check

Example:

ABC123
XYZ999

Maximum 50`)
})

bot.onText(/🍪 Set Cookies/,msg=>{

 const id = msg.from.id
 userMode[id]="cookie"

 bot.sendMessage(id,"Paste cookies JSON or header string")
})

bot.onText(/🔍 Cookie Status/,msg=>{

 const id = msg.from.id

 const file = `./cookies/${id}.json`

 if(!fs.existsSync(file))
  return bot.sendMessage(id,"❌ No cookies set")

 bot.sendMessage(id,"✅ Cookie file found")
})

bot.onText(/\/announce (.+)/,(msg,match)=>{

 const id = msg.from.id
 if(id!==ADMIN_ID) return

 const message = match[1]
 const users = loadUsers()

 users.forEach(u=>{
  bot.sendMessage(u,message).catch(()=>{})
 })
})

bot.on("message",msg=>{

 const id = msg.from.id
 const text = msg.text

 if(!text) return
 if(text.startsWith("/")) return

 if(text.includes("₹")){

  const value = text.split("₹")[1].split(" ")[0]
  userMode[id+"_value"]=value

  if(userMode[id]=="add"){
   bot.sendMessage(id,"Send coupon code")
  }

  if(userMode[id]=="retrieve"){

   const data = loadVouchers(id)

   if(data[value].length===0)
    return bot.sendMessage(id,"No coupons")

   const code = data[value].shift()

   saveVouchers(id,data)

   bot.sendMessage(id,"`"+code+"`",{parse_mode:"Markdown"})
  }

  return
}

const mode = userMode[id]

if(mode=="add"){

 const value = userMode[id+"_value"]
 const data = loadVouchers(id)

 const code = text.trim()

 if(data[value].includes(code))
  return bot.sendMessage(id,"⚠ Coupon already exists")

 data[value].push(code)
 saveVouchers(id,data)

 bot.sendMessage(id,"Coupon added")
}

if(mode=="check"){

 const raw = text.replace(/,/g,"\n").split("\n")

 const coupons = raw.map(x=>x.trim()).filter(x=>x).slice(0,50)

 let result=[]

 coupons.forEach(c=>{
  result.push("`"+c+"` : unchecked")
 })

 bot.sendMessage(id,result.join("\n"),{parse_mode:"Markdown"})
}

if(mode=="cookie"){

 const file = `./cookies/${id}.json`
 fs.writeFileSync(file,text)

 bot.sendMessage(id,"Cookies saved")
}

})
