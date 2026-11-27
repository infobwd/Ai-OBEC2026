// H3 sandbox adapter. Do not deploy anonymously. No production IDs or credentials.
function sandboxActor_(){
  const props=PropertiesService.getScriptProperties();
  if(props.getProperty("HUB_MODE")!=="SANDBOX_ONLY")throw new Error("DISABLED");
  const email=String(Session.getActiveUser().getEmail()||"").trim().toLowerCase();
  let roles;try{roles=JSON.parse(props.getProperty("HUB_ROLE_MAP")||"{}");}catch(e){throw new Error("DENIED");}
  if(!email||!Object.prototype.hasOwnProperty.call(roles,email)||!["ADMIN","WORKER","VIEWER"].includes(roles[email]))throw new Error("DENIED");
  return {id:email,role:roles[email]};
}

function sandboxDispatch_(req){
  const actor=sandboxActor_();
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(5000))return {ok:false,code:"BUSY"};
  try{
    const props=PropertiesService.getScriptProperties();
    const raw=props.getProperty("HUB_SANDBOX_STATE");
    if(!raw)return {ok:false,code:"NOT_INITIALIZED"};
    let state;try{state=JSON.parse(raw);}catch(e){return {ok:false,code:"BAD_STATE"};}
    const result=queueCore(state,actor,req,Date.now(),Utilities.getUuid());
    const next=JSON.stringify(state);
    if(result.ok&&next!==raw){
      // Fail before committing if the bounded synthetic journal approaches property limits.
      if(Utilities.newBlob(next).getBytes().length>8000)return {ok:false,code:"SANDBOX_CAPACITY_REACHED"};
      props.setProperty("HUB_SANDBOX_STATE",next);
      if(props.getProperty("HUB_SANDBOX_STATE")!==next)return {ok:false,code:"READBACK_UNCERTAIN"};
    }
    return result;
  }finally{lock.releaseLock();}
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
