const fs = require("fs")
const axios = require("axios")

function getCookie(userId){

 const file = `./cookies/${userId}.json`

 if(!fs.existsSync(file)) return null

 let raw = fs.readFileSync(file,"utf8").trim()

 try{
  const obj = JSON.parse(raw)
  return obj.cookie || null
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
   {
    voucherId:code,
    device:{client_type:"web"}
   },
   {
    headers:headers,
    timeout:20000
   }
  )

  return res.data

 }catch(e){

  if(e.response)
   return e.response.data

  return null

 }

}

async function resetVoucher(code,headers){

 try{

  await axios.post(
   "https://www.sheinindia.in/api/cart/reset-voucher",
   {
    voucherId:code,
    device:{client_type:"web"}
   },
   {
    headers:headers,
    timeout:15000
   }
  )

 }catch{}

}

function analyzeResponse(res){

 if(!res) return "invalid"

 if(res.errorMessage){

  const errors = res.errorMessage.errors || []

  for(const err of errors){

   const msg = (err.message || "").toLowerCase()

   if(msg.includes("already"))
    return "REDEEMED"

   if(msg.includes("not applicable"))
    return "invalid"

   if(msg.includes("invalid"))
    return "invalid"

  }

 }

 if(!res.errorMessage)
  return "VALID"

 return "invalid"

}

async function checkCoupon(code,userId){

 const cookie = getCookie(userId)

 if(!cookie)
  return "nocookie"

 const h = headers(cookie)

 const res = await applyVoucher(code,h)

 const status = analyzeResponse(res)

 await resetVoucher(code,h)

 return status

}

module.exports = {checkCoupon}
