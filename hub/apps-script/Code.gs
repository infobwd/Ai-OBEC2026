// H3 sandbox adapter. Do not deploy anonymously. No production IDs or credentials.
function sandboxActor_(){
  const p=PropertiesService.getScriptProperties();
  return sandboxAuthorize_(p.getProperty("HUB_MODE"),Session.getActiveUser().getEmail(),p.getProperty("HUB_ROLE_MAP"));
}

function sandboxDispatch_(req){
  const actor=sandboxActor_();
  const lock=LockService.getScriptLock();
  const props=PropertiesService.getScriptProperties();
  return sandboxTransaction_({
    tryLock:()=>lock.tryLock(5000),
    release:()=>lock.releaseLock(),
    read:()=>props.getProperty("HUB_SANDBOX_STATE"),
    write:value=>props.setProperty("HUB_SANDBOX_STATE",value),
    core:queueCore,
    now:()=>Date.now(),
    token:()=>Utilities.getUuid(),
    bytes:value=>Utilities.newBlob(value).getBytes().length
  },actor,req);
}

function initializeSandbox(){
  const actor=sandboxActor_();
  if(actor.role!=="ADMIN")throw new Error("DENIED");
  const lock=LockService.getScriptLock();
  lock.waitLock(5000);
  try{
    const p=PropertiesService.getScriptProperties();
    if(p.getProperty("HUB_SANDBOX_STATE"))return {ok:false,code:"ALREADY_INITIALIZED"};
    const seed={schema:1,mode:"SANDBOX_ONLY",jobs:[{id:"TEST-A",track:"ACADEMIC",priority:1,state:"QUEUED"},{id:"TEST-B",track:"ACADEMIC",priority:2,state:"QUEUED"},{id:"TEST-M",track:"MEDIA",priority:1,state:"QUEUED"},{id:"TEST-R",track:"ACADEMIC",priority:0,state:"PENDING_REVIEW"}],events:[]};
    const raw=JSON.stringify(seed);p.setProperty("HUB_SANDBOX_STATE",raw);
    return {ok:p.getProperty("HUB_SANDBOX_STATE")===raw,code:"INITIALIZED"};
  }finally{lock.releaseLock();}
}

function sandboxRequest(req){try{return sandboxDispatch_(req)}catch(e){return {ok:false,code:"DENIED_OR_UNAVAILABLE"}}}

function doGet(){return HtmlService.createHtmlOutput("<!doctype html><html lang='th'><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>AI OBEC Sandbox</title><h1>AI OBEC Sandbox</h1><p>สำหรับทดสอบเท่านั้น ไม่เชื่อมทะเบียนจริง</p><button id='b'>ตรวจสถานะคิวจำลอง</button><pre id='out' aria-live='polite'></pre><script>document.getElementById('b').onclick=function(){var b=this,o=document.getElementById('out');b.disabled=true;o.textContent='กำลังตรวจ';google.script.run.withSuccessHandler(function(r){o.textContent=JSON.stringify(r,null,2);b.disabled=false}).withFailureHandler(function(){o.textContent='ไม่สามารถยืนยันสิทธิ์หรืออ่านข้อมูลได้';b.disabled=false}).sandboxRequest({action:'list'});};</script></html>");}
