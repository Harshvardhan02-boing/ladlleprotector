const fs = require("fs")
const axios = require("axios")

function getCookie(userId){

 const file = `./cookies/${userId}.json`

 if(!fs.existsSync(file)) return null

 let raw = fs.readFileSync(file,"utf8").trim()

 try{
  const obj = JSON.parse(raw)
  return Object.entries(obj).map(([k,v])=>`${k}=${v}`).join("; ")
 }catch{
  return raw
 }
}

function headers(cookie){

 return {
  "accept":"application/json",
  "content-type":"application/json",
  "origin":"https://www.sheinindia.in",
  "referer":"https://www.sheinindia.in/cart",
  "user-agent":"Mozilla/5.0",
  "x-tenant-id":"SHEIN",
  "cookie":cookie
 }
}

async function applyVoucher(code,headers){

 try{

  const res = await axios.post(
   "https://www.sheinindia.in/api/cart/apply-voucher",
   {voucherId:code,device:{client_type:"web"}},
   {headers:headers,timeout:30000}
  )

  return res.data

 }catch(e){

  if(e.response) return e.response.data

  return null
 }
}

async function resetVoucher(code,headers){

 try{

  await axios.post(
   "https://www.sheinindia.in/api/cart/reset-voucher",
   {voucherId:code,device:{client_type:"web"}},
   {headers:headers,timeout:15000}
  )

 }catch{}
}

function isValid(response){

 if(!response) return false

 if(response.errorMessage){

  const errors = response.errorMessage.errors || []

  for(const err of errors){

   if(err.message && err.message.toLowerCase().includes("not applicable"))
    return false

  }

 }

 return !response.errorMessage
}

async function checkCoupon(code,userId){

 const cookie = getCookie(userId)

 if(!cookie) return "nocookie"

 const h = headers(cookie)

 const data = await applyVoucher(code,h)

 const valid = isValid(data)

 await resetVoucher(code,h)

 return valid ? "VALID" : "invalid"
}

module.exports = {checkCoupon}
