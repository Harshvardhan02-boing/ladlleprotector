const fs = require("fs")
const axios = require("axios")

function getCookie(userId){

 const file = `./cookies/${userId}.json`

 if(!fs.existsSync(file)) return null

 let raw = fs.readFileSync(file,"utf8").trim()

 try{
  const obj = JSON.parse(raw)

  if(obj.cookie) return obj.cookie

  return Object.entries(obj)
   .map(([k,v])=>`${k}=${v}`)
   .join("; ")

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

  return {networkError:true}

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

function analyzeResponse(response){

 if(!response) return "ERROR"

 if(response.networkError) return "ERROR"

 if(response.errorCode === "RX1") return "COOKIE_EXPIRED"

 if(response.errorMessage){

  const errors = response.errorMessage.errors || []

  for(const err of errors){

   const msg = (err.message || "").toLowerCase()

   if(msg.includes("not applicable"))
    return "INVALID"

   if(msg.includes("already used") || msg.includes("redeemed"))
    return "REDEEMED"

   if(msg.includes("login") || msg.includes("session"))
    return "COOKIE_EXPIRED"

  }

 }

 return "VALID"

}

async function checkCoupon(code,userId){

 const cookie = getCookie(userId)

 if(!cookie) return "NO_COOKIE"

 const h = headers(cookie)

 const response = await applyVoucher(code,h)

 const result = analyzeResponse(response)

 if(result==="VALID")
  await resetVoucher(code,h)

 return result

}

module.exports = {checkCoupon}
