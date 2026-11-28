// IndiNext Orbit — Sales Workspace
const SUPABASE_URL="https://icootmtssyergamuxlxb.supabase.co";
const SUPABASE_ANON_KEY="sb_publishable_qgEIXxXXBq2TaNxLMZPkwg_fcwKcdGW";
const $=id=>document.getElementById(id);
async function fetchAllRows(queryFactory,pageSize=500){const rows=[];for(let from=0;;from+=pageSize){const {data,error}=await queryFactory().range(from,from+pageSize-1);if(error)throw error;const page=data||[];rows.push(...page);if(page.length<pageSize)break;}return rows;}
const PAGE_SIZE=50;let groupOffset=0,groupHasMore=false,personalOffset=0,personalHasMore=false,directOffset=0,directHasMore=false;let notifications=[],notificationUnread=0,notificationLoading=false,notificationRefreshPending=false;
function csvCell(v){const value=v&&typeof v==="object"?JSON.stringify(v):String(v??"");return '"'+value.replace(/"/g,'""')+'"'}
function downloadCsv(name,rows){if(!rows.length){status("No records available to export.");return}const keys=[...new Set(rows.flatMap(r=>Object.keys(r)))],csv=[keys.map(csvCell).join(","),...rows.map(r=>keys.map(k=>csvCell(r[k])).join(","))].join("\r\n"),blob=new Blob(["\uFEFF",csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function setTheme(theme){const light=theme==="light";document.body.classList.toggle("theme-light",light);document.documentElement.style.colorScheme=light?"light":"dark";const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=light?"#f7f6fc":"#100d1b";const b=$("themePull");if(b){b.setAttribute("aria-pressed",String(light));b.classList.toggle("is-light",light);b.title=light?"Pull down to switch to dark theme":"Pull down to switch to light theme";b.setAttribute("aria-label",b.title)}try{if(user)localStorage.setItem("ctr_theme_"+user.id,light?"light":"dark");localStorage.setItem("ctr_theme_preference",light?"light":"dark")}catch{}}
async function loadGroupPage(reset=false){if(reset){groupOffset=0;group=[]}const {data,error}=await db.from("ctr_group_notes").select("*").order("created_at",{ascending:false}).order("id",{ascending:false}).range(groupOffset,groupOffset+PAGE_SIZE-1);if(error)throw error;const page=data||[];groupOffset+=page.length;groupHasMore=page.length===PAGE_SIZE;const mapped=page.map(n=>({...n,chat_color:n.chat_color||"#8E7CFF"})).reverse();group=reset?mapped:[...mapped,...group];return page.length}
async function loadPersonalPage(reset=false){if(reset){personalOffset=0;personal=[]}const {data,error}=await db.from("ctr_personal_notes").select("*").order("created_at",{ascending:false}).order("id",{ascending:false}).range(personalOffset,personalOffset+PAGE_SIZE-1);if(error)throw error;const page=data||[];personalOffset+=page.length;personalHasMore=page.length===PAGE_SIZE;personal=reset?page:[...personal,...page];return page.length}

let db,user,group=[],personal=[],direct=[],team=[],channel,presenceChannel,onlineUserIds=new Set(),avatarProfiles=[],avatarGateActive=false,avatarDailyRuleReady=false;
let groupFilter="",dateFilter="",personalFilter="",directFilter="",followupSearchFilter="";
let selectedDirectKey="",selectedDirectRecipient="",directInboxFilter="all",mobileThreadOpen=false;
let adminAuditAgentId="",adminAuditPairKey="",adminAuditSearch="",adminAuditDate="",adminAuditCategory="";
let adminAuditData=null,adminAuditRequest=0,adminAuditSort="newest",adminAuditDatePreset="all",adminAuditFrom="",adminAuditTo="";
let dashboardFrom="",dashboardTo="";
const seenKey=k=>"ctr_seen_"+k+"_"+(user?.id||"");const markSeen=k=>{if(user)localStorage.setItem(seenKey(k),new Date().toISOString());updateUnread()};let unreadSeq=0;function updateUnread(){if(!user||!db)return;const seq=++unreadSeq,gSeen=localStorage.getItem(seenKey("group"))||"1970-01-01T00:00:00.000Z",dSeen=localStorage.getItem(seenKey("direct"))||"1970-01-01T00:00:00.000Z";Promise.all([db.from("ctr_group_notes").select("id",{count:"exact",head:true}).neq("user_id",user.id).gt("created_at",gSeen),db.from("ctr_direct_messages").select("id",{count:"exact",head:true}).eq("recipient_id",user.id).gt("created_at",dSeen)]).then(([g,d])=>{if(seq!==unreadSeq)return;for(const [id,n] of [["groupUnread",g.count||0],["directUnread",d.count||0]]){const e=$(id);if(e){e.textContent=n;e.classList.toggle("hidden",!n)}}}).catch(()=>{})}
const ADMIN_EMAIL="mahesh.s@hrhnext.com";
const isAdmin=()=>String(user?.email||"").toLowerCase()===ADMIN_EMAIL;
const teamNames={
 "hrhca39899_indiframe@hrhnow.in":"Amrutha Shiva Kumar",
 "hrhca39898_indiframe@hrhnow.in":"Nandkishor Kasoju",
 "hrhca39264_indiframe@hrhnow.in":"Mohd Javeed Ali",
 "mahesh.s@hrhnext.com":"Mahesh Sharma"
};
const displayName=email=>teamNames[String(email||"").toLowerCase()]||"CTR Member";
const palette=["#8E7CFF","#36A6D9","#20B58A","#E59A3B","#E16C91","#A1A94B","#D477D1","#6E91C9"];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const initials=s=>(s||"U").trim()[0].toUpperCase();
const time=s=>new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeStyle:"short"}).format(new Date(s));
function status(t,auth=false){$(auth?"authStatus":"connectionBanner").textContent=t}
function formatNoteHtml(body){
 const lines=String(body||"").split(/\r?\n/);
 return lines.map((line,i)=>{
  const safe=esc(line);
  if(i===0&&line.includes("|"))return "<strong>"+safe+"</strong>";
  if(/^Assigned to\s*:/i.test(line))return "<strong>Assigned to</strong>"+safe.replace(/^Assigned to\s*:/i,":");
  return safe||"&nbsp;";
 }).join("<br>");
}
function dayLabel(v){const d=new Date(v),t=new Date(),y=new Date();y.setDate(t.getDate()-1);return d.toDateString()===t.toDateString()?"Today":d.toDateString()===y.toDateString()?"Yesterday":new Intl.DateTimeFormat(undefined,{dateStyle:"full"}).format(d)}
function renderGroup(forceBottom=false){
 const box=$("notes"),near=box.scrollHeight-box.scrollTop-box.clientHeight<110;
 let rows=group.filter(n=>(!groupFilter||[n.body,displayName(n.author_email),n.author_email].join(" ").toLowerCase().includes(groupFilter))&&(!dateFilter||new Date(n.created_at).toISOString().slice(0,10)===dateFilter));
 rows.sort((x,y)=>Number(!!y.is_pinned)-Number(!!x.is_pinned)||new Date(x.created_at)-new Date(y.created_at));const noteCount=$("noteCount");if(noteCount)noteCount.textContent=rows.length;let last="";
 $("notes").innerHTML=rows.length?rows.map(n=>{const day=new Date(n.created_at).toDateString(),sep=day!==last?(last=day,`<div class="date-separator">${esc(dayLabel(n.created_at))}</div>`):"";return sep+`<article class="note ${n.user_id===user.id?"mine":""}" data-note-id="${n.id}"><div class="note-top"><div class="note-avatar" style="background:${esc(n.chat_color)}">${directAvatar(displayName(n.author_email),n.user_id)}</div><span class="note-author">${esc(displayName(n.author_email))}${n.user_id===user.id?" · You":""}</span><span class="note-time">${esc(time(n.created_at))}${n.edited_at?" · edited":""}</span>${n.is_pinned?'<span class="pin-label">Pinned</span>':""}${n.user_id===user.id||isAdmin()?`<button class="message-action" data-edit="${n.id}">Edit</button>`:""}${n.user_id===user.id||isAdmin()?`<button class="delete-note" data-gdelete="${n.id}">${isAdmin()&&n.user_id!==user.id?"Admin · Delete":"Delete"}</button>`:""}${isAdmin()?`<button class="message-action" data-pin="${n.id}">${n.is_pinned?"Unpin":"Pin"}</button>`:""}</div><div class="note-body">${formatNoteHtml(n.body)}</div><div class="reaction-row">${["👍","✅","👀"].map(e=>{const users=(n.reactions||{})[e]||[];return `<button class="reaction-btn ${users.includes(user.id)?"reacted":""}" data-react="${n.id}" data-emoji="${e}" type="button" aria-pressed="${users.includes(user.id)}">${e} ${users.length}</button>`}).join("")}</div></article>`}).join(""):'<div class="empty-state"><h3>No matching updates</h3><p>Try clearing the filters.</p></div>';
 enhanceGroupMessages(rows);if(groupHasMore)box.insertAdjacentHTML("afterbegin",'<button type="button" class="older-page-btn" data-load-older-group>Load older group notes</button>');if(forceBottom||near)requestAnimationFrame(()=>box.scrollTop=box.scrollHeight);updateUnread();
}

function enhanceGroupMessages(rows){
 const seen=new Date(localStorage.getItem(seenKey("group"))||0).getTime();let prior="",unreadDone=false;
 document.querySelectorAll("#notes .note[data-note-id]").forEach(card=>{
  const n=rows.find(x=>x.id===card.dataset.noteId);if(!n)return;
  const groupKey=n.user_id+"|"+new Date(n.created_at).toDateString();
  if(groupKey===prior){card.classList.add("message-group-continued");const av=card.querySelector(".note-avatar"),au=card.querySelector(".note-author");if(av)av.hidden=true;if(au)au.hidden=true}
  else card.classList.add("message-group-start");
  prior=groupKey;
  if(n.user_id!==user.id&&new Date(n.created_at).getTime()>seen&&!unreadDone){const sep=document.createElement("div");sep.className="unread-divider";sep.textContent="New messages";card.before(sep);unreadDone=true}
  const body=n.body||"",m=body.match(/(?:\+?91[\s-]?)?[6-9]\d{9}/);
  const top=card.querySelector(".note-top");
  if(m&&top){const phone=m[0].replace(/\D/g,"");const cp=document.createElement("button");cp.className="message-action";cp.type="button";cp.dataset.copyPhone=phone;cp.textContent="Copy number";top.append(cp)}
  const tools=document.createElement("div");tools.className="note-tools";const reply=document.createElement("button");reply.type="button";reply.className="message-action";reply.dataset.replyNote=n.id;reply.textContent="Reply";const copy=document.createElement("button");copy.type="button";copy.className="message-action";copy.dataset.copyNote=n.id;copy.textContent="Copy note";tools.append(reply,copy);card.append(tools);
 });
}
let followups=[];
function renderFollowups(){
 const box=$("followupList");if(!box)return;
 const pending=followups.filter(x=>x.status!=="completed");
 const q=followupSearchFilter.trim().toLowerCase();
 const rows=(q?followups.filter(f=>[f.customer_name,f.phone,f.details,team.find(t=>t.user_id===f.user_id)?.display_name||displayName(team.find(t=>t.user_id===f.user_id)?.email)].join(" ").toLowerCase().includes(q)):pending).sort((a,b)=>new Date(a.callback_at)-new Date(b.callback_at));
 $("followupCount").textContent=pending.length;const navCount=$("followupNavCount");if(navCount)navCount.textContent=pending.length;
 box.innerHTML=rows.length?rows.map(f=>'<article class="followup-item" data-followup-id="'+f.id+'"><div class="followup-info"><strong>'+esc(f.customer_name)+'</strong><span>'+esc(f.phone)+'</span><time>'+esc(time(f.callback_at))+'</time><p>'+esc(f.details||"")+'</p><small class="followup-status">'+(f.status==="completed"?"Completed":"Pending")+' · '+esc(team.find(t=>t.user_id===f.user_id)?.display_name||displayName(team.find(t=>t.user_id===f.user_id)?.email))+'</small></div><div class="followup-actions"><button class="message-action" data-copy-phone="'+f.phone.replace(/\D/g,"")+'">Copy phone</button>'+(f.status!=="completed"?'<button class="message-action" data-follow-done="'+f.id+'">Complete</button>':'')+'</div></article>').join(""):(q?'<div class="empty-state">No matching follow-ups.</div>':'<div class="empty-state">No pending follow-ups.</div>');
}
async function loadFollowups(){const box=$("followupList");try{followups=await fetchAllRows(()=>db.from("ctr_followups").select("*").order("callback_at",{ascending:true}).order("id",{ascending:true}));renderFollowups();renderAgentDashboard()}catch(e){followups=[];$("followupCount").textContent="!";box.innerHTML=`<div class="empty-state">Follow-ups are unavailable: ${esc(e.message)}.</div>`}}

async function renderAgentDashboard(){
 const box=$("agentDashboard");if(!box||!user)return;
 $("dashboardView")?.classList.toggle("admin-agent-page",isAdmin());
 const auditPanel=$("agentChatAudit"),summaryPanel=$("dashboardSummary");
 if(isAdmin()&&adminAuditAgentId){
  box.classList.add("hidden");
  summaryPanel?.classList.add("hidden");
  auditPanel?.classList.remove("hidden");
  renderAdminChatExplorer();
  return;
 }
 box.classList.remove("hidden");
 summaryPanel?.classList.toggle("hidden",isAdmin());
 $("dashboardView")?.querySelector(".dashboard-filters")?.classList.toggle("hidden",isAdmin());
 $("dashboardView")?.querySelector(".dashboard-export")?.classList.toggle("hidden",isAdmin());
 auditPanel?.classList.add("hidden");
 const agents=(isAdmin()?team.filter(t=>String(t.email||"").toLowerCase()!==ADMIN_EMAIL):team.filter(t=>t.user_id===user.id));
 if(!isAdmin()&&!agents.length)agents.push({user_id:user.id,email:user.email,display_name:displayName(user.email)});
 if(!agents.length){box.innerHTML='<div class="empty-state">No agent activity available yet.</div>';return}
 box.innerHTML='<div class="empty-state">Updating agent activity…</div>';
 const rows=await Promise.all(agents.map(async t=>{
  const from=dashboardFrom?new Date(dashboardFrom+"T00:00:00").toISOString():null,to=dashboardTo?new Date(dashboardTo+"T23:59:59.999").toISOString():null;
  let gq=db.from("ctr_group_notes").select("id",{count:"exact",head:true}).eq("user_id",t.user_id);
  let pq=db.from("ctr_personal_notes").select("id",{count:"exact",head:true}).eq("user_id",t.user_id);
  let fq=db.from("ctr_followups").select("id",{count:"exact",head:true}).eq("user_id",t.user_id);
  let cq=db.from("ctr_followups").select("id",{count:"exact",head:true}).eq("user_id",t.user_id).eq("status","completed");
  if(from){gq=gq.gte("created_at",from);pq=pq.gte("created_at",from);fq=fq.gte("callback_at",from);cq=cq.gte("callback_at",from)}
  if(to){gq=gq.lte("created_at",to);pq=pq.lte("created_at",to);fq=fq.lte("callback_at",to);cq=cq.lte("callback_at",to)}
  let mq=db.from("ctr_direct_messages").select("id",{count:"exact",head:true}).eq("sender_id",t.user_id);
  if(from)mq=mq.gte("created_at",from);if(to)mq=mq.lte("created_at",to);
  const [g,p,pending,completed,messages]=await Promise.all([gq,pq,fq.neq("status","completed"),cq,mq]);
  return {id:t.user_id,name:t.display_name||displayName(t.email),groupCount:g.count||0,personalCount:p.count||0,notes:(g.count||0)+(p.count||0),pending:pending.count||0,completed:completed.count||0,messageCount:messages.count||0,error:g.error||p.error||pending.error||completed.error||messages.error};
 }));
 box.innerHTML=rows.map(r=>{const total=r.groupCount+r.personalCount+r.messageCount+r.pending+r.completed;return `<button type="button" class="agent-card agent-card-select ${adminAuditAgentId===r.id?"selected":""}" data-audit-agent="${esc(r.id)}"><div class="agent-card-head"><span class="agent-profile-avatar">${directAvatar(r.name,r.id)}</span><span class="agent-profile-name"><strong>${esc(r.name)}</strong><small>${total} total activities</small></span><span class="agent-card-label">OPEN ↗</span></div><div class="agent-metrics"><div><strong>${r.error?"—":r.groupCount}</strong><span>Group Chats</span></div><div><strong>${r.error?"—":r.personalCount}</strong><span>Personal Notes</span></div><div><strong>${r.error?"—":r.messageCount}</strong><span>Direct Messages</span></div><div><strong>${r.error?"—":r.pending+r.completed}</strong><span>Follow-ups</span></div></div>${r.error?'<small class="agent-metric-error">Some counts could not be loaded.</small>':""}</button>`}).join("");
 const summary=$("dashboardSummary");
 if(summary){
  const totals=rows.reduce((a,r)=>({group:a.group+r.groupCount,personal:a.personal+r.personalCount,pending:a.pending+r.pending,completed:a.completed+r.completed,messages:a.messages+r.messageCount}),{group:0,personal:0,pending:0,completed:0,messages:0});
  const max=Math.max(1,...rows.map(r=>r.groupCount+r.personalCount+r.messageCount));
  summary.innerHTML='<div class="dashboard-summary-head"><strong>'+(isAdmin()?"Team overview":"Your activity")+'</strong><small>'+(dashboardFrom||dashboardTo?esc(dashboardFrom||"Start")+" – "+esc(dashboardTo||"Today"):"All available records")+'</small></div><div class="dashboard-total-grid"><div><strong>'+totals.group+'</strong><span>Group notes</span></div><div><strong>'+totals.personal+'</strong><span>Personal notes</span></div><div><strong>'+totals.messages+'</strong><span>Direct messages</span></div><div><strong>'+totals.pending+'</strong><span>Pending</span></div><div><strong>'+totals.completed+'</strong><span>Completed</span></div></div><div class="dashboard-chart-title">Activity by agent</div>'+rows.map(r=>'<div class="dashboard-bar-row"><span>'+esc(r.name)+'</span><div class="dashboard-bar-track" role="img" aria-label="'+esc(r.name)+' activity"><i style="width:'+Math.round((r.groupCount+r.personalCount+r.messageCount)/max*100)+'%"></i></div><b>'+(r.groupCount+r.personalCount+r.messageCount)+'</b></div>').join("");
 }
 $("agentChatAudit")?.classList.add("hidden");
}
async function loadAdminAuditData(agentId){
 const request=++adminAuditRequest;
 const [sentRows,receivedRows,groupRows,personalRows,followupRows]=await Promise.all([
  fetchAllRows(()=>db.from("ctr_direct_messages").select("*").eq("sender_id",agentId).order("created_at",{ascending:true}).order("id",{ascending:true})),
  fetchAllRows(()=>db.from("ctr_direct_messages").select("*").eq("recipient_id",agentId).order("created_at",{ascending:true}).order("id",{ascending:true})),
  fetchAllRows(()=>db.from("ctr_group_notes").select("*").eq("user_id",agentId).order("created_at",{ascending:false})),
  fetchAllRows(()=>db.from("ctr_personal_notes").select("*").eq("user_id",agentId).order("created_at",{ascending:false})),
  fetchAllRows(()=>db.from("ctr_followups").select("*").eq("user_id",agentId).order("callback_at",{ascending:false}))
 ]);
 if(request!==adminAuditRequest)return;
 const directRows=[...new Map([...sentRows,...receivedRows].map(m=>[m.id,m])).values()].sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
 adminAuditData={agentId,direct:directRows,group:groupRows,personal:personalRows,followups:followupRows};
}
function renderAdminChatExplorer(){
 const panel=$("agentChatAudit");if(!panel||!isAdmin())return;
 panel.classList.remove("hidden");
 const active=team.find(t=>t.user_id===adminAuditAgentId&&String(t.email||"").toLowerCase()!==ADMIN_EMAIL);
 if(!active){panel.innerHTML='<div class="agent-audit-empty">Select an agent card above to inspect their activity.</div>';return}
 const audit=adminAuditData?.agentId===active.user_id?adminAuditData:null;
 if(!audit){panel.innerHTML='<div class="empty-state">Loading '+esc(active.display_name||displayName(active.email))+' activity…</div>';loadAdminAuditData(active.user_id).then(()=>renderAdminChatExplorer()).catch(e=>{panel.innerHTML='<div class="empty-state">Agent records could not be loaded: '+esc(e.message)+'</div>'});return}
 const agentName=active.display_name||displayName(active.email);
 const category=adminAuditCategory;
 const directSent=audit.direct.filter(m=>m.sender_id===active.user_id);
 const categories=[
  {id:"group",title:"Group Chats",desc:"Messages this agent posted in the shared group",count:audit.group.length,icon:"▤"},
  {id:"personal",title:"Personal Notes",desc:"Private notes created by this agent",count:audit.personal.length,icon:"✎"},
  {id:"direct",title:"Direct Messages",desc:"Messages this agent sent to other agents",count:directSent.length,icon:"↗"},
  {id:"followups",title:"Follow-ups",desc:"Callbacks and follow-ups created by this agent",count:audit.followups.length,icon:"◷"}
 ];
 const rows=category==="group"?audit.group:category==="personal"?audit.personal:category==="direct"?directSent:category==="followups"?audit.followups:[];
 const title=categories.find(x=>x.id===category)?.title||"";
 const q=adminAuditSearch.trim().toLowerCase();const now=new Date(),today=new Date(now.getFullYear(),now.getMonth(),now.getDate()),yesterday=new Date(today);yesterday.setDate(yesterday.getDate()-1);const dateOf=x=>new Date(x.created_at||x.callback_at);const filtered=rows.filter(x=>{const sender=team.find(t=>t.user_id===(x.user_id||x.sender_id))||team.find(t=>String(t.email||"").toLowerCase()===String(x.author_email||"").toLowerCase()),recipient=team.find(t=>t.user_id===x.recipient_id);const fields=category==="followups"?[x.customer_name,x.phone,x.details,x.status,sender?.display_name]:category==="direct"?[x.body,sender?.display_name,recipient?.display_name]:[x.body,sender?.display_name,x.author_email];const d=dateOf(x);let dateOK=true;if(adminAuditDatePreset==="today")dateOK=d>=today;else if(adminAuditDatePreset==="yesterday")dateOK=d>=yesterday&&d<today;else if(adminAuditDatePreset==="7days"){const start=new Date(today);start.setDate(start.getDate()-6);dateOK=d>=start}else if(adminAuditDatePreset==="custom"){if(adminAuditFrom&&d<new Date(adminAuditFrom+"T00:00:00"))dateOK=false;if(adminAuditTo&&d>new Date(adminAuditTo+"T23:59:59.999"))dateOK=false}return (!q||fields.filter(Boolean).join(" ").toLowerCase().includes(q))&&dateOK}).sort((a,b)=>{const n=dateOf(a)-dateOf(b);return adminAuditSort==="oldest"?n:-n});
 const renderRow=x=>{
  const date=x.created_at||x.callback_at;
  if(category==="followups"){const owner=team.find(t=>t.user_id===x.user_id);return '<article class="followup-item" data-followup-id="'+esc(x.id)+'"><div class="followup-info"><strong>'+esc(x.customer_name||"Customer")+'</strong><span>'+esc(x.phone||"") +'</span><time>'+esc(time(x.callback_at||date))+'</time><p>'+esc(x.details||"") +'</p><small class="followup-status">'+(x.status==="completed"?"Completed":"Pending")+' · '+esc(owner?.display_name||displayName(owner?.email)||"Agent") +'</small></div><div class="followup-actions"><button class="message-action" data-copy-phone="'+String(x.phone||"").replace(/\D/g,"") +'">Copy phone</button>'+(x.status!=="completed"?'<button class="message-action" data-follow-done="'+esc(x.id)+'">Complete</button>':"")+'</div></article>'}
  if(category==="direct"){const recipient=team.find(t=>t.user_id===x.recipient_id),sender=team.find(t=>t.user_id===x.sender_id);return '<article class="agent-record-row"><div class="agent-record-meta"><strong>From: '+esc(sender?.display_name||displayName(sender?.email)||"Agent")+' → To: '+esc(recipient?.display_name||displayName(recipient?.email)||"Team member")+'</strong><time>'+esc(time(date))+'</time></div><p>'+esc(x.body||"")+'</p></article>'}
  const owner=team.find(t=>t.user_id===x.user_id)||team.find(t=>String(t.email||"").toLowerCase()===String(x.author_email||"").toLowerCase());const ownerName=owner?.display_name||displayName(x.author_email)||"Agent";return '<article class="agent-record-row"><div class="agent-record-meta"><strong>'+(category==="group"?"Group Chat · ":"Personal Note · ")+esc(ownerName)+'</strong><time>'+esc(time(date))+'</time></div><p>'+esc(x.body||"")+'</p></article>';
 };
 const initials=agentName.trim().split(/\\s+/).slice(0,2).map(x=>x[0]||"").join("").toUpperCase();const totalActivity=audit.group.length+audit.personal.length+directSent.length+audit.followups.length;
 panel.innerHTML='<div class="agent-audit-head"><div class="agent-audit-identity"><span class="agent-profile-avatar agent-profile-avatar-large">'+directAvatar(agentName,active.user_id)+'</span><div><div class="eyebrow">ADMIN ONLY · AGENT MONITORING</div><h3>'+esc(agentName)+'</h3><p>'+totalActivity+' total activities</p></div></div><button type="button" class="message-action" data-audit-back-agents>← All Agents</button></div>'+
 (category?'':'<div class="agent-activity-cards">'+categories.map(c=>'<button type="button" class="agent-activity-card" data-audit-category="'+c.id+'"><span class="agent-activity-icon">'+c.icon+'</span><strong>'+c.title+'</strong><b>'+c.count+'</b><small>'+c.desc+'</small></button>').join("")+'</div>')+
 (category?'<section class="agent-records-panel"><div class="agent-audit-section-title"><div><div class="agent-breadcrumb">Agents › '+esc(agentName)+' › '+title+'</div><h4>'+title+' · '+filtered.length+' records</h4></div><button type="button" class="message-action" data-audit-category-back>← Activity</button></div><div class="agent-audit-controls"><input id="agentChatAuditSearch" type="search" value="'+esc(adminAuditSearch)+'" placeholder="Search '+title.toLowerCase()+'…"><select id="agentAuditDatePreset" aria-label="Date range"><option value="all" '+(adminAuditDatePreset==="all"?"selected":"")+' >All dates</option><option value="today" '+(adminAuditDatePreset==="today"?"selected":"")+' >Today</option><option value="yesterday" '+(adminAuditDatePreset==="yesterday"?"selected":"")+' >Yesterday</option><option value="7days" '+(adminAuditDatePreset==="7days"?"selected":"")+' >Last 7 days</option><option value="custom" '+(adminAuditDatePreset==="custom"?"selected":"")+' >Custom</option></select><select id="agentAuditSort" aria-label="Sort records"><option value="newest" '+(adminAuditSort==="newest"?"selected":"")+' >Newest first</option><option value="oldest" '+(adminAuditSort==="oldest"?"selected":"")+' >Oldest first</option></select></div><div class="agent-audit-custom-range" '+(adminAuditDatePreset==="custom"?"":"hidden")+'><label>From <input id="agentAuditFrom" type="date" value="'+esc(adminAuditFrom)+'"></label><label>To <input id="agentAuditTo" type="date" value="'+esc(adminAuditTo)+'"></label></div><div class="agent-record-list">'+(filtered.map(renderRow).join("")||'<div class="empty-state">No '+title.toLowerCase()+' found for this agent.</div>')+'</div></section>':'');
}
let globalSearchRequest=0;
async function globalSearch(query){
 const panel=$("globalSearchResults");if(!panel)return;
 const q=String(query||"").trim();const request=++globalSearchRequest;
 if(!q){panel.classList.add("hidden");panel.innerHTML="";return}
 if(q.length<2){panel.innerHTML='<div class="global-search-empty">Type at least 2 characters to search all records.</div>';panel.classList.remove("hidden");return}
 panel.innerHTML='<div class="global-search-empty">Searching all accessible records…</div>';panel.classList.remove("hidden");
 const pattern="%"+q.replace(/[%_\\]/g,"\\$&")+"%";
 try{
  const [g,p,d,fc,fp,fd]=await Promise.all([
   db.from("ctr_group_notes").select("*").ilike("body",pattern).order("created_at",{ascending:false}).limit(30),
   db.from("ctr_personal_notes").select("*").ilike("body",pattern).order("created_at",{ascending:false}).limit(30),
   db.from("ctr_direct_messages").select("*").ilike("body",pattern).order("created_at",{ascending:false}).limit(30),
   db.from("ctr_followups").select("*").ilike("customer_name",pattern).order("callback_at",{ascending:false}).limit(30),
   db.from("ctr_followups").select("*").ilike("phone",pattern).order("callback_at",{ascending:false}).limit(30),
   db.from("ctr_followups").select("*").ilike("details",pattern).order("callback_at",{ascending:false}).limit(30)
  ]);
  if(request!==globalSearchRequest)return;
  const failed=[g,p,d,fc,fp,fd].find(x=>x.error);if(failed)throw failed.error;
  const hits=[];
  (g.data||[]).forEach(n=>hits.push({kind:"Group note",view:"group",title:displayName(n.author_email),text:n.body||"",date:n.created_at}));
  (p.data||[]).forEach(n=>hits.push({kind:"Personal note",view:"personal",title:team.find(t=>t.user_id===n.user_id)?.display_name||"Personal note",text:n.body||"",date:n.created_at}));
  (d.data||[]).forEach(n=>hits.push({kind:"Direct message",view:"direct",title:team.find(t=>t.user_id===(n.sender_id===user.id?n.recipient_id:n.sender_id))?.display_name||"Direct message",text:n.body||"",date:n.created_at}));
  const followupRows=new Map();[...(fc.data||[]),...(fp.data||[]),...(fd.data||[])].forEach(n=>followupRows.set(n.id,n));
  [...followupRows.values()].forEach(n=>hits.push({kind:"Follow-up",view:"followups",title:n.customer_name||"Follow-up",text:[n.customer_name,n.phone,n.details].filter(Boolean).join(" · "),date:n.callback_at}));
  hits.sort((x,y)=>new Date(y.date||0)-new Date(x.date||0));
  panel.innerHTML=hits.length?'<div class="global-search-head">'+hits.length+' matching records'+(hits.length===180?' · showing latest matches':'')+'</div>'+hits.slice(0,180).map(r=>'<button type="button" class="global-search-hit" data-search-view="'+r.view+'"><span><b>'+esc(r.title)+'</b><small>'+esc(r.kind)+' · '+esc(time(r.date))+'</small></span><span class="global-hit-snippet">'+esc(r.text.slice(0,150))+'</span></button>').join(""):'<div class="global-search-empty">No matching records found.</div>';
 }catch(e){if(request!==globalSearchRequest)return;panel.innerHTML='<div class="global-search-empty">Search failed: '+esc(e.message||"Database query failed")+'</div>';console.warn("CTR global search failed",e)}
}

function directPairKey(a,b){return [a,b].sort().join("::")}
function avatarFor(userId){return avatarProfiles.find(p=>String(p.user_id)===String(userId))?.avatar||""}
function avatarUsedByOther(avatar){return avatarProfiles.some(p=>p.avatar===avatar&&String(p.user_id)!==String(user?.id))}
function avatarChangedToday(){const row=avatarProfiles.find(p=>String(p.user_id)===String(user?.id));if(!row?.last_changed_on)return false;const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());return row.last_changed_on===today}
const CTR_AVATAR_IMAGES={"⚔️":"01_crossed_swords.png","🛡️":"02_shield_lion.png","🐉":"03_green_snake.png","🐺":"04_wolf.png","🦊":"05_fox.png","🐯":"06_bear.png","🦅":"07_eagle.png","🐼":"08_panda.png","🦁":"09_tiger.png","🐲":"10_dragon.png","🌙":"11_gold_moon.png","🔥":"12_fire.png","🎭":"13_theatre_masks.png","👑":"14_crown.png","🌸":"15_lotus.png","☯️":"16_yin_yang.png"};
function cleanAvatarPng(img){
 if(!img||img.dataset.avatarCleaned||img.dataset.avatarCleaning||!img.naturalWidth)return;
 img.dataset.avatarCleaning="1";
 try{
  const w=img.naturalWidth,h=img.naturalHeight,total=w*h;
  const canvas=document.createElement("canvas"),ctx=canvas.getContext("2d",{willReadFrequently:true});
  canvas.width=w;canvas.height=h;ctx.drawImage(img,0,0);
  const frame=ctx.getImageData(0,0,w,h),px=frame.data,seen=new Uint8Array(total),queue=new Int32Array(total);
  // The uploaded PNGs contain a baked-in grey/white checkerboard. Remove only
  // neutral, bright pixels connected to the image edges, not isolated artwork.
  const isBackdrop=n=>{
   const p=n*4;if(px[p+3]<16)return false;
   const r=px[p],g=px[p+1],b=px[p+2],hi=Math.max(r,g,b),lo=Math.min(r,g,b);
   return hi-lo<=30 && (r+g+b)/3>=118;
  };
  let head=0,tail=0;
  const seed=(x,y)=>{if(x<0||y<0||x>=w||y>=h)return;const n=y*w+x;if(!seen[n]&&isBackdrop(n)){seen[n]=1;queue[tail++]=n}};
  for(let x=0;x<w;x++){seed(x,0);seed(x,h-1)}
  for(let y=1;y<h-1;y++){seed(0,y);seed(w-1,y)}
  while(head<tail){
   const n=queue[head++],x=n%w,y=(n/w)|0,p=n*4;
   px[p+3]=0;
   seed(x-1,y);seed(x+1,y);seed(x,y-1);seed(x,y+1);
  }
  if(tail<total*.025){delete img.dataset.avatarCleaning;img.dataset.avatarCleaned="1";return}
  let minX=w,minY=h,maxX=-1,maxY=-1;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(px[(y*w+x)*4+3]>12){if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y}
  if(maxX<minX||maxY<minY){delete img.dataset.avatarCleaning;img.dataset.avatarCleaned="1";return}
  ctx.putImageData(frame,0,0);
  const bw=maxX-minX+1,bh=maxY-minY+1,pad=Math.max(4,Math.round(Math.max(bw,bh)*.07)),side=Math.max(bw,bh)+pad*2;
  const output=document.createElement("canvas");output.width=side;output.height=side;
  output.getContext("2d").drawImage(canvas,minX,minY,bw,bh,pad+(side-2*pad-bw)/2,pad+(side-2*pad-bh)/2,bw,bh);
  img.dataset.avatarCleaned="1";delete img.dataset.avatarCleaning;img.src=output.toDataURL("image/png");
 }catch(e){delete img.dataset.avatarCleaning;img.dataset.avatarCleaned="1";console.warn("Avatar transparency cleanup skipped",e)}
}
window.cleanAvatarPng=cleanAvatarPng;
function directAvatar(name,userId=""){const chosen=userId?avatarFor(userId):"",src=CTR_AVATAR_IMAGES[chosen];if(src)return '<img class="avatar-art" src="./'+src+'" alt="" aria-hidden="true" loading="lazy" onload="window.cleanAvatarPng(this)">';const parts=String(name||"CTR Member").trim().split(/\s+/);return '<span class="avatar-initials">'+esc((parts[0]?.[0]||"C")+(parts.length>1?parts[parts.length-1][0]:""))+'</span>'}
const CTR_AVATARS=["⚔️","🛡️","🐉","🐺","🦊","🐯","🦅","🐼","🦁","🐲","🌙","🔥","🎭","👑","🌸","☯️"];
async function loadAvatarProfiles(){let result=await db.from("ctr_user_avatars").select("user_id,avatar,selection_count,last_changed_on");if(result.error){const missing=result.error.code==="42703"||/last_changed_on.*(does not exist|schema cache)|column .*last_changed_on/i.test(result.error.message||"");if(!missing)throw result.error;avatarDailyRuleReady=false;result=await db.from("ctr_user_avatars").select("user_id,avatar,selection_count");if(result.error)throw result.error;avatarProfiles=(result.data||[]).map(p=>({...p,last_changed_on:null}));return}avatarDailyRuleReady=true;avatarProfiles=result.data||[]}
function setupAccountSettings(){
 if(!$("accountSettingsBtn")){const b=document.createElement("button");b.id="accountSettingsBtn";b.type="button";b.className="account-settings-btn";b.innerHTML='<span class="account-current-avatar"></span><span>Account settings</span>';b.addEventListener("click",async()=>{$("accountSettingsModal").classList.remove("hidden");try{await loadAvatarProfiles()}catch{}renderAccountAvatars()});$("userEmail").after(b)}
 if(!$("accountSettingsModal")){const modal=document.createElement("div");modal.id="accountSettingsModal";modal.className="account-settings-modal hidden";modal.innerHTML='<section class="account-settings-card" role="dialog" aria-modal="true" aria-labelledby="accountSettingsTitle"><button type="button" class="account-settings-close" aria-label="Close">×</button><div class="eyebrow">YOUR PROFILE</div><h3 id="accountSettingsTitle">Choose your avatar to continue</h3><p id="avatarGateMessage">Each avatar can belong to only one team member. You may change your avatar once per day (India time).</p><div id="accountAvatarStatus" class="account-avatar-status"></div><div id="accountAvatarChoices" class="account-avatar-choices"></div><div class="account-settings-foot">Your avatar and name appear in your private conversations. Your choice is shared with the team.</div></section>';document.body.append(modal);modal.addEventListener("click",async e=>{if((e.target===modal||e.target.closest(".account-settings-close"))&&!avatarGateActive)modal.classList.add("hidden");const pick=e.target.closest("[data-avatar]");if(pick&&user){const avatar=pick.dataset.avatar;if(!avatarDailyRuleReady){status("Daily avatar rule is not active yet. Ask the workspace admin to apply the avatar daily-limit database update.");return}if(avatarUsedByOther(avatar)){status("That avatar is already in use by another team member.");return}if(avatar!==avatarFor(user.id)&&avatarChangedToday()){status("You have already changed your avatar today. You can change it again tomorrow (IST).");return}pick.disabled=true;const {data,error}=await db.rpc("ctr_choose_avatar",{p_avatar:avatar});if(error){status(/already changed today/i.test(error.message||"")?"You have already changed your avatar today. You can change it again tomorrow (IST).":error.message||"Could not save avatar choice.");pick.disabled=false;return}try{await loadAvatarProfiles()}catch{}renderAccountAvatars();renderDirect();status("Avatar saved.");if(avatarFor(user.id)){avatarGateActive=false;modal.classList.add("hidden");$("appView").classList.remove("avatar-gated");}}})}
 renderAccountAvatars()
}
function renderAccountAvatars(){if(!user)return;const selected=avatarFor(user.id),changedToday=avatarChangedToday(),grid=$("accountAvatarChoices");if(grid)grid.innerHTML=CTR_AVATARS.map(a=>{const taken=avatarUsedByOther(a),isSelected=a===selected,disabled=taken||(!isSelected&&changedToday)||(!avatarDailyRuleReady&&!isSelected),src=CTR_AVATAR_IMAGES[a];return '<button type="button" class="account-avatar-choice '+(isSelected?"selected":"")+(taken?" taken":"")+'" data-avatar="'+esc(a)+'" '+(disabled?'disabled':'')+' aria-label="'+(taken?"Already taken":isSelected?"Selected avatar":"Choose avatar")+'" title="'+(taken?"Already selected by another member":isSelected?"Your current avatar":"Available")+'"><img class="avatar-art" src="./'+src+'" alt="" aria-hidden="true" loading="lazy" onload="window.cleanAvatarPng(this)">'+(taken?'<span class="avatar-taken-mark">×</span>':isSelected?'<span class="avatar-selected-mark">✓</span>':"")+'</button>'}).join("");const statusBox=$("accountAvatarStatus");if(statusBox)statusBox.innerHTML=!avatarDailyRuleReady?'<strong>Daily rule setup required.</strong> <span>Workspace admin must apply the avatar daily-limit database update.</span>':selected?(changedToday?'<strong>Avatar changed today.</strong> <span>You can change it again tomorrow (IST).</span>':'<strong>Current avatar:</strong> <span>You can change it once per day (IST).</span>'):'<strong>No avatar selected yet.</strong> <span>Choose one available avatar. After selection, you can change it once per day (IST).</span>';const current=document.querySelector(".account-current-avatar");if(current)current.innerHTML=directAvatar(displayName(user.email),user.id)}
function openDirectConversation(id){
 if(!id||!user)return;
 const person=team.find(p=>String(p.user_id)===String(id));
 if(!person){status("This contact is not available in the team directory. Refresh and try again.");return}
 if(selectedDirectRecipient!==String(person.user_id)&&pendingDmImage){pendingDmImage=null;$("dmImageInput").value="";$("dmImagePreview").classList.add("hidden");$("dmImagePreview").innerHTML=""}
 selectedDirectRecipient=String(person.user_id);
 selectedDirectKey=directPairKey(user.id,person.user_id);
 $("directRecipient").value=selectedDirectRecipient;
 $("directRecipient").value=person.user_id;
 directFilter="";
 directInboxFilter="all";
 $("directSearch").value="";
 document.querySelectorAll("[data-dm-filter]").forEach(x=>x.classList.toggle("active",x.dataset.dmFilter==="all"));
 mobileThreadOpen=window.matchMedia("(max-width:760px)").matches;
 $("directView").querySelector(".dm-inbox").classList.toggle("mobile-thread-open",mobileThreadOpen);
 renderDirect();
 markSeen("direct");
 $("directInput").disabled=false;
 $("dmImageInput").disabled=false;
 $("dmImageButton").classList.remove("disabled");
 $("directForm").querySelector('button[type="submit"]').disabled=false;
 $("dmComposeHint").textContent="Private conversation";
 $("directInput").focus();
 status("Chat opened: "+(person.display_name||"team member"));
}
function openDmImage(src,alt){let modal=$("dmImageLightbox");if(!modal){modal=document.createElement("div");modal.id="dmImageLightbox";modal.className="dm-image-lightbox";modal.innerHTML='<button type="button" aria-label="Close image preview">×</button><img alt="">';document.body.append(modal);modal.onclick=e=>{if(e.target===modal||e.target.closest("button"))modal.classList.remove("open")}}modal.querySelector("img").src=src;modal.querySelector("img").alt=alt||"Shared image";modal.classList.add("open")}
async function hydrateDirectAttachments(container=$("directNotes")){if(!container)return;const imgs=[...container.querySelectorAll("img[data-dm-attachment]")];for(const img of imgs){const path=img.dataset.dmAttachment;if(!path||img.dataset.loading==="1")continue;img.dataset.loading="1";try{const {data,error}=await db.storage.from("orbit-dm-images").createSignedUrl(path,3600);if(error)throw error;if(img.isConnected)img.src=data.signedUrl}catch(err){if(img.isConnected)img.alt="Image unavailable";console.warn("Direct attachment preview failed",err)}}}
function renderDirect(){
 const admin=isAdmin(),people=team.filter(p=>p.user_id!==user.id);
 $("directAdminHint")?.classList.add("hidden");
 const directCount=$("directCount");if(directCount)directCount.textContent=direct.length;
 let allConversations=[];
 {  const pairs=new Map();
  direct.forEach(m=>{
   if(m.sender_id!==user.id&&m.recipient_id!==user.id)return;
   const key=directPairKey(m.sender_id,m.recipient_id);
   if(!pairs.has(key))pairs.set(key,[]);
   pairs.get(key).push(m);
  });
  const byPerson=new Map([...pairs.entries()].map(([key,messages])=>{
   messages.sort((x,y)=>new Date(x.created_at)-new Date(y.created_at));
   const last=messages[messages.length-1];
   const otherId=last.sender_id===user.id?last.recipient_id:last.sender_id;
   const other=team.find(p=>p.user_id===otherId);
   return [otherId,{key,messages,last,otherId,name:other?.display_name||"CTR Member",email:other?.email||"",
    unread:messages.filter(m=>m.recipient_id===user.id&&m.sender_id!==user.id&&new Date(m.created_at)>new Date(localStorage.getItem("ctr_seen_direct_"+user.id)||0)).length}];
  }));
  people.forEach(person=>{
   if(!byPerson.has(person.user_id))byPerson.set(person.user_id,{key:directPairKey(user.id,person.user_id),messages:[],last:null,otherId:person.user_id,name:person.display_name||"CTR Member",email:person.email||"",unread:0});
  });
  allConversations=[...byPerson.values()].sort((x,y)=>(new Date(y.last?.created_at||0)-new Date(x.last?.created_at||0))||x.name.localeCompare(y.name));
 }
 const selectedId=selectedDirectRecipient||$("directRecipient").value||((selectedDirectKey||"").split("::").find(id=>id&&id!==user.id))||"";
 const query=directFilter.trim().toLowerCase();
 const visible=allConversations.filter(c=>{
  if(directInboxFilter==="unread"&&!c.unread)return false;
  if(!query)return true;
  const searchable=[c.name,c.email,c.otherId,...c.messages.map(m=>m.body||"")].join(" ").toLowerCase();
  return searchable.includes(query);
 });
 $("directInboxList").innerHTML=visible.length?visible.map(c=>{
  const preview=c.last?(c.last.sender_id===user.id?"You: ":"")+(c.last.body||""):"Start a conversation";
  return `<button type="button" class="dm-conversation ${selectedId===c.otherId?"selected":""}" data-dm-key="${esc(c.key)}" data-dm-other="${esc(c.otherId)}"><span class="dm-avatar">${directAvatar(c.name,c.otherId)}</span><span class="dm-convo-copy"><strong>${esc(c.name)}</strong><span>${esc(preview)}</span></span><span class="dm-convo-meta">${onlineUserIds.has(c.otherId)?'<span class="dm-online-dot" title="Online"></span>':""}<time>${c.last?esc(time(c.last.created_at)):""}</time>${c.unread?`<b class="dm-unread-count">${c.unread}</b>`:""}</span></button>`;
 }).join(""):'<div class="empty-state"><h3>No matching contacts</h3><p>Try another name or message keyword.</p></div>';
 // Conversation selection is handled by one stable delegated listener below.
 let active=allConversations.find(c=>c.otherId===selectedId);
 if(active){
  selectedDirectKey=active.key;
  $("directRecipient").value=active.otherId;
  $("dmNewRecipient").value="";
  $("dmThreadHeader").innerHTML=`<span class="dm-avatar dm-avatar-large">${directAvatar(active.name,active.otherId)}</span><div><strong>${esc(active.name)}</strong><small><span class="dm-presence-status ${onlineUserIds.has(active.otherId)?"online":"offline"}">${onlineUserIds.has(active.otherId)?"Online":"Offline"}</span> · Private conversation</small></div><div class="dm-thread-actions">${admin?'<span class="dm-admin-tag">ADMIN VIEW</span>':""}</div>`;
  const box=$("directNotes"),near=box.scrollHeight-box.scrollTop-box.clientHeight<120;
  box.innerHTML=active.messages.map(m=>{
   const mine=m.sender_id===user.id,from=team.find(p=>p.user_id===m.sender_id)?.display_name||"CTR Member";
   return `<article class="dm-message ${mine?"mine":""}" data-dm-message="${m.id}"><div class="dm-message-person"><span class="dm-avatar dm-message-avatar">${directAvatar(from,m.sender_id)}</span><strong>${esc(from)}</strong></div><div class="dm-message-body">${esc(m.body||"")}</div>${m.attachment_path?`<div class="dm-image-attachment"><img data-dm-attachment="${esc(m.attachment_path)}" alt="${esc(m.attachment_name||"Shared image")}" loading="lazy"><span>${esc(m.attachment_name||"Image attachment")}</span></div>`:""}<time>${esc(time(m.created_at))}${m.edited_at?" · edited":mine?" · ✓✓":""}</time><div class="dm-message-actions">${mine?`<button type="button" class="message-action" data-dm-edit="${m.id}">Edit</button>`:""}<button type="button" class="message-action" data-dm-reply="${m.id}">Reply</button>${mine||admin?`<button class="delete-note" data-ddelete="${m.id}">Delete</button>`:""}</div></article>`;
  }).join("")||'<div class="dm-empty-thread"><div class="dm-empty-mark">✉</div><strong>Start a private conversation</strong><span>Write a message below to begin chatting.</span></div>';
  hydrateDirectAttachments(box);
  let lastDay="";
  [...box.querySelectorAll(".dm-message")].forEach((card,index)=>{
   const msg=active.messages[index],label=dayLabel(msg.created_at);
   if(label!==lastDay){const divider=document.createElement("div");divider.className="dm-date-separator";divider.textContent=label;card.before(divider);lastDay=label}
   const copy=document.createElement("button");copy.type="button";copy.className="dm-copy-btn";copy.dataset.copyDm=msg.id;copy.textContent="Copy";card.append(copy);
  });
  if(directHasMore)box.insertAdjacentHTML("afterbegin",'<button type="button" class="older-page-btn direct-older-page" data-load-older-direct>Load older messages</button>');
  if(near)requestAnimationFrame(()=>box.scrollTop=box.scrollHeight);
  $("directInput").disabled=false;
  $("dmImageInput").disabled=false;
  $("directForm").querySelector('button[type="submit"]').disabled=false;
  $("dmComposeHint").textContent="Private conversation";
 }else{
  selectedDirectKey="";
  $("directRecipient").value="";
  $("dmThreadHeader").innerHTML='<div class="dm-empty-avatar">✉</div><div><strong>CTR Messages</strong><small>Select a contact to view your conversation</small></div>';
  $("directNotes").innerHTML='<div class="dm-empty-thread"><div class="dm-empty-mark">✉</div><strong>Your conversations</strong><span>Select a team member from the contact list to open the chat.</span></div>';
  $("directInput").disabled=true;
  $("dmImageInput").disabled=true;
  $("directForm").querySelector('button[type="submit"]').disabled=true;
  $("dmComposeHint").textContent="Choose a contact to start messaging.";
 }
 $("directView").querySelector(".dm-inbox")?.classList.toggle("mobile-thread-open",mobileThreadOpen&&!!active);
}
let directLoadSequence=0;
async function loadDirect(){
 const sequence=++directLoadSequence;
 const inbox=$("directInboxList");
 if(!team.length&&inbox)inbox.innerHTML='<div class="empty-state">Loading team contacts…</div>';
 try{
  const {data:people,error:peopleError}=await db.from("ctr_team_directory").select("user_id,email,display_name").order("display_name");
  if(sequence!==directLoadSequence)return;
  if(peopleError)throw new Error("Team contacts: "+peopleError.message);
  team=Array.isArray(people)?people.filter(p=>p&&p.user_id):[];
  await loadAvatarProfiles();
  if(isAdmin()){
   const logs=await fetchAllRows(()=>db.from("ctr_moderation_log").select("*").order("deleted_at",{ascending:false}).order("id",{ascending:false}));
   if(sequence!==directLoadSequence)return;
   $("moderationPanel")?.classList.remove("hidden");
   $("moderationLog").innerHTML=logs.map(x=>`<article class="note"><div class="note-top"><span class="note-author">${esc(x.deleted_by_email||"Admin")} · ${esc(x.table_name)}</span><span class="note-time">${esc(time(x.deleted_at))}</span></div><div class="note-body">${esc(x.original_body||"")}</div></article>`).join("")||'<div class="empty-state">No deletions recorded.</div>';
  }else $("moderationPanel")?.classList.add("hidden");
  const sel=$("directRecipient"),old=selectedDirectRecipient||sel.value,newSel=$("dmNewRecipient"),newOld=newSel.value;
  sel.innerHTML='<option value="">Choose a team member…</option>'+team.filter(p=>p.user_id!==user.id).map(p=>`<option value="${p.user_id}">${esc(p.display_name)}</option>`).join("");
  if(old&&team.some(p=>p.user_id===old)){sel.value=old;selectedDirectRecipient=old}else{selectedDirectRecipient="";sel.value=""}
  newSel.innerHTML='<option value="">＋ New message</option>'+team.filter(p=>p.user_id!==user.id).map(p=>`<option value="${p.user_id}">${esc(p.display_name)}</option>`).join("");
  if(newOld&&team.some(p=>p.user_id===newOld))newSel.value=newOld;
  let query=db.from("ctr_direct_messages").select("*").order("created_at",{ascending:false}).order("id",{ascending:false});
  if(!isAdmin())query=query.or("sender_id.eq."+user.id+",recipient_id.eq."+user.id);
  const first=await query.range(0,PAGE_SIZE-1);if(first.error)throw first.error;direct=(first.data||[]).filter(m=>m&&m.sender_id&&m.recipient_id).reverse();directOffset=first.data?.length||0;directHasMore=directOffset===PAGE_SIZE;
  if(sequence!==directLoadSequence)return;
  renderDirect();renderPersonal();updateUnread();if(isAdmin())renderAgentDashboard();
  if(inbox)inbox.setAttribute("aria-busy","false");
 }catch(error){
  if(sequence!==directLoadSequence)return;
  console.error("CTR Direct Chat load failed",error);
  if(inbox){inbox.setAttribute("aria-busy","false");inbox.innerHTML='<div class="empty-state"><h3>Chats could not be loaded</h3><p>'+esc(error?.message||"Check your connection and refresh.")+'</p><button class="refresh-btn" type="button" data-direct-retry>Retry loading</button></div>';}
  status("Direct Chat error: "+(error?.message||"Please refresh and try again."));
 }
}

async function loadOlderDirect(){if(!directHasMore||!user)return;const box=$("directNotes"),h=box.scrollHeight,t=box.scrollTop;let q=db.from("ctr_direct_messages").select("*").order("created_at",{ascending:false}).order("id",{ascending:false});if(!isAdmin())q=q.or("sender_id.eq."+user.id+",recipient_id.eq."+user.id);const {data,error}=await q.range(directOffset,directOffset+PAGE_SIZE-1);if(error){status("Could not load older messages: "+error.message);return}const page=data||[];directOffset+=page.length;directHasMore=page.length===PAGE_SIZE;direct=[...page.reverse(),...direct];renderDirect();box.scrollTop=box.scrollHeight-h+t}
async function loadOlderGroup(){if(!groupHasMore)return;const box=$("notes"),h=box.scrollHeight,t=box.scrollTop;try{await loadGroupPage(false);renderGroup();box.scrollTop=box.scrollHeight-h+t}catch(e){status("Could not load older group notes: "+e.message)}}
async function loadOlderPersonal(){if(!personalHasMore)return;try{await loadPersonalPage(false);renderPersonal()}catch(e){status("Could not load older personal notes: "+e.message)}}
async function loadAll(){
 await Promise.all([loadGroupPage(true),loadPersonalPage(true),loadFollowups()]);
 renderGroup(true);
 renderPersonal();
}
async function refreshMessages(){
 const btn=$("refreshData");btn.disabled=true;btn.classList.add("is-refreshing");btn.setAttribute("aria-label","Refreshing");
 try{await loadAll();await loadDirect();renderAgentDashboard();status("All records refreshed.")}
 catch(e){status("Refresh failed: "+e.message)}
 finally{btn.disabled=false;btn.classList.remove("is-refreshing");btn.setAttribute("aria-label","Refresh")}
}

function renderPersonal(){
 const rows=personal.filter(n=>!personalFilter||[n.body,team.find(t=>t.user_id===n.user_id)?.display_name||displayName(user.email)].join(" ").toLowerCase().includes(personalFilter));
 $("personalCount").textContent=rows.length;
 $("personalNotes").innerHTML=rows.length?rows.map(n=>{const owner=team.find(t=>t.user_id===n.user_id)?.display_name||(n.user_id===user.id?displayName(user.email):"CTR Member");return `<article class="note personal-note"><div class="note-top"><span class="note-author">${isAdmin()?esc(owner)+" · PERSONAL NOTE":"PRIVATE NOTE"}</span><span class="note-time">${esc(time(n.created_at))}${n.edited_at?" · edited":""}</span><button class="message-action" data-pedit="${n.id}">Edit</button>${n.user_id===user.id||isAdmin()? `<button class="delete-note" data-pdelete="${n.id}">${isAdmin()&&n.user_id!==user.id?"Admin · Delete":"Delete"}</button>`:""}</div><div class="note-body">${esc(n.body)}</div></article>`}).join(""):'<div class="empty-state"><h3>No matching personal notes</h3><p>Try clearing your search.</p></div>';
 if(personalHasMore)$("personalNotes").insertAdjacentHTML("beforeend",'<button type="button" class="older-page-btn" data-load-older-personal>Load older personal notes</button>');
}
$("newFollowupBtn")?.addEventListener("click",()=>{const form=$("followupForm");form.classList.toggle("hidden");if(!form.classList.contains("hidden"))$("followupCustomer").focus();$("newFollowupBtn").textContent=form.classList.contains("hidden")?"＋ Create Follow-up":"− Close form";});
function showView(v){
 $("groupView").classList.toggle("hidden",v!=="group");
 $("personalView").classList.toggle("hidden",v!=="personal");
 $("directView").classList.toggle("hidden",v!=="direct");
 $("followupsView").classList.toggle("hidden",v!=="followups");
 if(v==="followups")loadFollowups();
 $("dashboardView").classList.toggle("hidden",v!=="dashboard");if(v==="dashboard")renderAgentDashboard();
 document.querySelectorAll("[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===v));
 if(v==="direct"){mobileThreadOpen=false;$("directView").querySelector(".dm-inbox").classList.remove("mobile-thread-open");loadDirect();markSeen("direct")}if(v==="group")markSeen("group");
}
function notificationPermission(){return ("Notification" in window)?Notification.permission:"unsupported"}
function updateNotificationButton(){
 const b=$("enableNotifications");if(!b)return;
 const p=notificationPermission();
 const label=p==="granted"?"Alerts on":p==="denied"?"Alerts blocked":p==="unsupported"?"Alerts unavailable":"Alerts";
 b.title=p==="granted"?"Browser notifications are enabled":p==="denied"?"Allow notifications for this site in browser settings":"Enable new-message browser notifications";
 b.setAttribute("aria-label",label);
 b.classList.toggle("notifications-on",p==="granted");
 b.classList.toggle("notifications-blocked",p==="denied");
}
function sendMessageNotification(kind,row){
 if(!row||!user||notificationPermission()!=="granted")return;
 if(kind==="group"&&row.user_id===user.id)return;
 if(kind==="direct"&&row.recipient_id!==user.id)return;
 const activeView=kind==="group"?"groupView":"directView";
 if(!document.hidden&&!$(activeView).classList.contains("hidden"))return;
 const sender=kind==="group"?displayName(row.author_email):(team.find(x=>x.user_id===row.sender_id)?.display_name||"CTR Member");
 const raw=String(row.body||"").replace(/\s+/g," ").trim();
 const body=raw.length>130?raw.slice(0,127)+"…":raw;
 try{
  const note=new Notification(kind==="group"?"CTR · Group Chat":"CTR · Direct Message",{body:sender+": "+body,tag:"ctr-"+kind+"-"+row.id,renotify:false});
  note.onclick=()=>{window.focus();showView(kind==="group"?"group":"direct");note.close()};
 }catch(e){console.warn("CTR notification unavailable",e)}
}
async function enableNotifications(){
 if(!("Notification" in window)){status("This browser does not support notifications.");updateNotificationButton();return}
 if(Notification.permission==="granted"){status("New-message notifications are already enabled.");updateNotificationButton();return}
 if(Notification.permission==="denied"){status("Notifications are blocked. Allow them from this site's browser settings.");updateNotificationButton();return}
 const p=await Notification.requestPermission();updateNotificationButton();
 status(p==="granted"?"New-message notifications enabled.":"Notification permission was not granted.");
}
function renderNotificationCentre(){
 const list=$("notificationList");if(!list)return;
 const badge=$("notificationBadge");if(badge){badge.textContent=notificationUnread>99?"99+":String(notificationUnread);badge.classList.toggle("hidden",!notificationUnread)}
 $("notificationSummary").textContent=notificationUnread?notificationUnread+" unread updates":"You're all caught up";
 list.innerHTML=notifications.length?notifications.map(n=>'<button type="button" class="notification-item '+(!n.read_at?"unread":"")+'" data-notification-id="'+esc(n.id)+'" data-notification-kind="'+esc(n.kind)+'" data-notification-actor="'+esc(n.actor_id||"")+'"><span class="notification-item-dot"></span><span class="notification-item-copy"><strong>'+esc(n.title||"New update")+'</strong><small>'+esc(n.body||"You have a new CTR update.")+'</small><time>'+esc(time(n.created_at))+'</time></span></button>').join(""):'<div class="empty-state">No notifications yet. New group updates and direct messages will appear here.</div>';
}
async function loadNotifications(){
 if(!user)return;if(notificationLoading){notificationRefreshPending=true;return}notificationLoading=true;notificationRefreshPending=false;
 try{const [list,count]=await Promise.all([db.from("ctr_notifications").select("*").order("created_at",{ascending:false}).limit(50),db.from("ctr_notifications").select("id",{count:"exact",head:true}).eq("recipient_id",user.id).is("read_at",null)]);if(list.error)throw list.error;if(count.error)throw count.error;notifications=list.data||[];notificationUnread=count.count||0;renderNotificationCentre()}
 catch(e){const list=$("notificationList");if(list)list.innerHTML='<div class="empty-state">Notifications unavailable. '+esc(e.message)+'</div>';console.warn("CTR notification centre unavailable",e)}
 finally{notificationLoading=false;if(notificationRefreshPending){notificationRefreshPending=false;queueMicrotask(()=>loadNotifications())}}
}
async function markAllNotificationsRead(){
 if(!user||!notificationUnread)return;
 const {error}=await db.from("ctr_notifications").update({read_at:new Date().toISOString()}).eq("recipient_id",user.id).is("read_at",null);
 if(error){status("Could not mark notifications read: "+error.message);return}
 notifications=notifications.map(n=>({...n,read_at:n.read_at||new Date().toISOString()}));notificationUnread=0;renderNotificationCentre();
}
async function openNotification(item){
 if(!item)return;
 if(!item.read_at){const {error}=await db.from("ctr_notifications").update({read_at:new Date().toISOString()}).eq("id",item.id).eq("recipient_id",user.id);if(!error){item.read_at=new Date().toISOString();notificationUnread=Math.max(0,notificationUnread-1);renderNotificationCentre()}}
 $("notificationPanel").classList.add("hidden");$("toggleNotificationPanel").setAttribute("aria-expanded","false");
 if(item.kind==="direct"&&item.actor_id){await loadDirect();openDirectConversation(item.actor_id);showView("direct")}
 else if(item.kind==="followup"){showView("followups")}
 else{showView("group");if(item.reference_id){const card=document.querySelector('[data-note-id="'+CSS.escape(item.reference_id)+'"]');card?.scrollIntoView({behavior:"smooth",block:"center"})}}
}
async function exportAllCrmData(){
 if(!isAdmin()){status("Only CTR Admin can export CRM data.");return}
 const button=$("exportCrmData");button.disabled=true;button.textContent="Preparing export…";
 try{
  const [g,p,d,f]=await Promise.all([
   fetchAllRows(()=>db.from("ctr_group_notes").select("*").order("created_at",{ascending:true})),
   fetchAllRows(()=>db.from("ctr_personal_notes").select("*").order("created_at",{ascending:true})),
   fetchAllRows(()=>db.from("ctr_direct_messages").select("*").order("created_at",{ascending:true})),
   fetchAllRows(()=>db.from("ctr_followups").select("*").order("callback_at",{ascending:true}))
  ]);
  const rows=[...g.map(x=>({record_type:"group_note",...x})),...p.map(x=>({record_type:"personal_note",...x})),...d.map(x=>({record_type:"direct_message",...x})),...f.map(x=>({record_type:"followup",...x}))];
  downloadCsv("CTR-admin-export-"+new Date().toISOString().slice(0,10)+".csv",rows);
  status("Admin export prepared: "+rows.length+" CRM records.");
 }catch(e){status("Export failed. Check Admin database permissions: "+e.message)}
 finally{button.disabled=false;button.textContent="Export CRM data (Admin)"}
}

function realtime(){
 if(channel)db.removeChannel(channel);
 channel=db.channel("ctr-live-"+user.id)
 .on("postgres_changes",{event:"*",schema:"public",table:"ctr_group_notes"},async(payload)=>{if(payload.eventType==="INSERT")sendMessageNotification("group",payload.new);adminAuditData=null;try{await loadGroupPage(true);renderGroup();renderAgentDashboard()}catch(e){status("Group history refresh failed: "+e.message)}})

 .on("postgres_changes",{event:"*",schema:"public",table:"ctr_personal_notes"},async()=>{adminAuditData=null;try{await loadPersonalPage(true);renderPersonal();renderAgentDashboard()}catch(e){status("Personal notes refresh failed: "+e.message)}})
 .on("postgres_changes",{event:"*",schema:"public",table:"ctr_direct_messages"},async(payload)=>{adminAuditData=null;if(payload.eventType==="INSERT")sendMessageNotification("direct",payload.new);await loadDirect()})
 .on("postgres_changes",{event:"*",schema:"public",table:"ctr_user_avatars"},async()=>{try{await loadAvatarProfiles();renderDirect();renderAccountAvatars()}catch{}})
 .on("postgres_changes",{event:"*",schema:"public",table:"ctr_followups"},async()=>{adminAuditData=null;await loadFollowups();if(isAdmin()&&adminAuditAgentId)renderAdminChatExplorer()})
 .on("postgres_changes",{event:"INSERT",schema:"public",table:"ctr_notifications",filter:"recipient_id=eq."+user.id},async(payload)=>{const exists=notifications.some(n=>n.id===payload.new.id);notifications=[payload.new,...notifications.filter(n=>n.id!==payload.new.id)].slice(0,50);if(!exists&&!payload.new.read_at)notificationUnread++;renderNotificationCentre();await loadNotifications()})
 .on("postgres_changes",{event:"UPDATE",schema:"public",table:"ctr_notifications",filter:"recipient_id=eq."+user.id},loadNotifications)
 .subscribe(s=>{if(s==="SUBSCRIBED")status("Live sync connected · group updates appear automatically.");if(s==="CHANNEL_ERROR"||s==="TIMED_OUT")status("Live sync interrupted. Refresh to reconnect.")});
}
function setupPresence(){
 if(presenceChannel)db.removeChannel(presenceChannel);
 onlineUserIds=new Set();
 presenceChannel=db.channel("ctr-presence",{config:{presence:{key:user.id}}})
 .on("presence",{event:"sync"},()=>{const state=presenceChannel.presenceState();onlineUserIds=new Set(Object.keys(state).filter(id=>id!==user.id));renderDirect()})
 .subscribe(async state=>{if(state==="SUBSCRIBED"){await presenceChannel.track({user_id:user.id,display_name:displayName(user.email),online_at:new Date().toISOString()})}});
}
function timeoutTask(promise,ms,label){return Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error(label+" timed out. Check your connection and retry.")),ms))])}
async function enter(u){
 user=u;setupAccountSettings();$("authView").classList.add("hidden");$("appView").classList.remove("hidden");
 setTheme(localStorage.getItem("ctr_theme_"+u.id)||"dark");
 $("exportCrmData")?.classList.toggle("hidden",!isAdmin());
 const name=displayName(u.email);$("userEmail").textContent=name;updateNotificationButton();
 try{await timeoutTask(loadAvatarProfiles(),12000,"Avatar profile");const chosen=avatarFor(u.id);avatarGateActive=!chosen;const modal=$("accountSettingsModal");if(avatarGateActive){modal.classList.remove("hidden");modal.querySelector(".account-settings-close").hidden=true;$("accountSettingsTitle").textContent="Choose your avatar to continue";$("avatarGateMessage").textContent="Avatar selection is mandatory. Each avatar is unique, and you can change it once per day (India time).";renderAccountAvatars();status("Select an avatar before entering the workspace.");}else{modal.classList.add("hidden");modal.querySelector(".account-settings-close").hidden=false;$("accountSettingsTitle").textContent="Your chat avatar";$("avatarGateMessage").textContent="Each avatar can belong to only one team member. You may change your avatar once per day (India time).";}await timeoutTask(loadAll(),18000,"Initial records");realtime();setupPresence();await Promise.all([timeoutTask(loadDirect(),18000,"Chats"),timeoutTask(loadNotifications(),12000,"Notifications")])}catch(e){status("Database load issue: "+(e.message||"Unable to load records.")+" — tap Refresh to retry.")}
}
async function ensureSupabaseLibrary(){
 if(window.supabase?.createClient)return true;
 const esmSources=["https://esm.sh/@supabase/supabase-js@2","https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm"];
 for(const src of esmSources){
  try{
   const mod=await Promise.race([import(src),new Promise((_,reject)=>setTimeout(()=>reject(new Error("Supabase module timed out")),12000))]);
   if(typeof mod.createClient==="function"){window.supabase={createClient:mod.createClient};return true}
  }catch(err){console.warn("Supabase ESM source failed",src,err)}
 }
 const sources=["https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js","https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.js"];
 for(const src of sources){
  try{
   await new Promise((resolve,reject)=>{
    const script=document.createElement("script");script.src=src;script.async=true;
    let settled=false;const finish=(fn,value)=>{if(settled)return;settled=true;clearTimeout(timer);fn(value)};
    const timer=setTimeout(()=>finish(reject,new Error("Supabase library request timed out")),12000);
    script.onload=()=>window.supabase?.createClient?finish(resolve):finish(reject,new Error("Supabase createClient is unavailable"));
    script.onerror=()=>finish(reject,new Error("Could not load "+src));
    document.head.appendChild(script);
   });
   if(window.supabase?.createClient)return true;
  }catch(err){console.warn("Supabase UMD source failed",src,err)}
 }
 return false;
}
let authBootPromise=null;
async function sessionIsActive(){
 try{const {data,error}=await db.rpc("ctr_session_is_active");if(error)throw error;if(data!==true)return false;const {data:member,error:memberError}=await db.from("ctr_team_directory").select("user_id").limit(1);if(memberError)throw memberError;return Array.isArray(member)&&member.length>0}catch(e){console.warn("Session/team validation failed",e);return false}
}
async function boot(){
 status("Connecting to sign-in service…",true);$("authRetry")?.classList.add("hidden");
 if(!await ensureSupabaseLibrary()){status("Could not connect to the sign-in service. Check internet and tap Retry connection.",true);$("authRetry")?.classList.remove("hidden");return}
 if(!db)db=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
 const {data,error}=await db.auth.getSession();if(error){status("Session error: "+error.message,true);$("authRetry")?.classList.remove("hidden");return}
 if(!authListenerReady){
  authListenerReady=true;
  db.auth.onAuthStateChange((_e,s)=>{setTimeout(async()=>{if(s?.user){if(await sessionIsActive()){if(!user||user.id!==s.user.id)await enter(s.user)}else{await db.auth.signOut({scope:"local"});status("Your previous session has expired. Please sign in again.",true)}}else{user=null;enteredUserId="";avatarGateActive=false;$("appView").classList.add("hidden");$("authView").classList.remove("hidden")}},0)});
 }
 if(data.session){if(await sessionIsActive())await enter(data.session.user);else{await db.auth.signOut({scope:"local"});status("Your previous session has expired. Please sign in again.",true)}}
}
let authListenerReady=false,enteredUserId="";
async function connectAuth(){
 if(db&&authListenerReady)return true;
 if(!authBootPromise)authBootPromise=boot().finally(()=>{authBootPromise=null});
 await authBootPromise;
 return !!db;
}
$("authForm").addEventListener("submit",async e=>{
 e.preventDefault();
 if(!db){
  $("authSubmit").disabled=true;status("Connecting to sign-in service…",true);
  try{await connectAuth()}catch(err){console.error("Sign-in connection failed",err)}
  if(!db){$("authSubmit").disabled=false;status("Could not connect to sign-in service. Check internet and tap Retry connection.",true);$("authRetry")?.classList.remove("hidden");return}
 }
 const email=$("email").value.trim().toLowerCase(),password=$("password").value;
 $("authSubmit").disabled=true;status("Signing in…",true);
 try{const r=await db.auth.signInWithPassword({email,password});if(r.error)status("Sign-in failed: "+r.error.message,true);else if(r.data.user)status("Signed in. Loading your workspace…",true)}
 catch(err){status("Sign-in error: "+(err.message||"Please try again."),true)}
 finally{$("authSubmit").disabled=false}
});
$("authRetry")?.addEventListener("click",()=>connectAuth().catch(err=>{console.error("CTR retry failed",err);status("Connection failed: "+(err?.message||"Please try again."),true)}));
$("forgotPassword").onclick=async()=>{if(!db){status("Connecting to sign-in service…",true);try{await connectAuth()}catch(err){status("Could not connect to sign-in service: "+(err?.message||"Please try again."),true);return}}if(!db){status("Could not connect to sign-in service. Please retry.",true);$("authRetry")?.classList.remove("hidden");return}const email=$("email").value.trim().toLowerCase();if(!email){status("Enter your registered email address first.",true);$("email").focus();return}const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:"https://nottybuddy.github.io/Orbit/"});status(error?error.message:"If this email belongs to a CTR account, a password reset link will be sent.",true)};
document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>showView(b.dataset.view));
$("refreshData").onclick=refreshMessages;
$("enableNotifications")?.addEventListener("click",enableNotifications);
$("toggleNotificationPanel")?.addEventListener("click",async()=>{const panel=$("notificationPanel"),opening=panel.classList.contains("hidden");panel.classList.toggle("hidden",!opening);$("toggleNotificationPanel").setAttribute("aria-expanded",String(opening));if(opening)await loadNotifications()});
$("markAllNotifications")?.addEventListener("click",markAllNotificationsRead);
$("notificationList")?.addEventListener("click",e=>{const row=e.target.closest("[data-notification-id]");if(row){const item=notifications.find(n=>n.id===row.dataset.notificationId);openNotification(item)}});

$("exportCrmData")?.addEventListener("click",()=>{if(isAdmin()&&confirm("Export all CRM records, including personal notes, direct messages and customer contact details, to a CSV file on this device? Keep the file private."))exportAllCrmData()});
$("directRecipient").onchange=()=>{selectedDirectRecipient=$("directRecipient").value||"";selectedDirectKey=selectedDirectRecipient?directPairKey(user.id,selectedDirectRecipient):"";renderDirect()};
$("dmNewRecipient").addEventListener("change",e=>{const id=e.target.value;if(!id)return;openDirectConversation(id);$("directInput").focus()});
$("dmThreadHeader").addEventListener("click",()=>{if(window.matchMedia("(max-width:760px)").matches){mobileThreadOpen=false;$("directView").querySelector(".dm-inbox").classList.remove("mobile-thread-open")}});
document.querySelectorAll("[data-dm-filter]").forEach(b=>b.addEventListener("click",()=>{directInboxFilter=b.dataset.dmFilter;document.querySelectorAll("[data-dm-filter]").forEach(x=>x.classList.toggle("active",x===b));renderDirect()}));
 document.addEventListener("click",e=>{
 const t=e.target instanceof Element?e.target:null;if(!t)return;
 const agent=t.closest("[data-audit-agent]");if(agent){adminAuditAgentId=agent.dataset.auditAgent;adminAuditPairKey="";adminAuditCategory="";adminAuditSearch="";adminAuditDate="";adminAuditData=null;renderAgentDashboard();return}
 if(t.closest("[data-audit-back-agents]")){adminAuditAgentId="";adminAuditPairKey="";adminAuditCategory="";renderAgentDashboard();return}
 const category=t.closest("[data-audit-category]");if(category){adminAuditCategory=category.dataset.auditCategory;adminAuditSearch="";adminAuditDate="";renderAdminChatExplorer();return}
 if(t.closest("[data-audit-category-back]")){adminAuditCategory="";adminAuditSearch="";adminAuditDate="";renderAdminChatExplorer();return}
 if(t.closest("[data-audit-back-list]")){adminAuditPairKey="";renderAdminChatExplorer();return}
 const pair=t.closest("[data-audit-pair]");if(pair){adminAuditPairKey=pair.dataset.auditPair;renderAdminChatExplorer()}
});
document.addEventListener("input",e=>{if(e.target?.id==="agentChatAuditSearch"){adminAuditSearch=e.target.value;const pos=e.target.selectionStart;renderAdminChatExplorer();const input=$("agentChatAuditSearch");input?.focus();input?.setSelectionRange(pos,pos)}});
document.addEventListener("change",e=>{if(e.target?.id==="agentAuditDatePreset"){adminAuditDatePreset=e.target.value;renderAdminChatExplorer()}if(e.target?.id==="agentAuditSort"){adminAuditSort=e.target.value;renderAdminChatExplorer()}if(e.target?.id==="agentAuditFrom"){adminAuditFrom=e.target.value;renderAdminChatExplorer()}if(e.target?.id==="agentAuditTo"){adminAuditTo=e.target.value;renderAdminChatExplorer()}});

$("dashboardFrom")?.addEventListener("change",e=>{dashboardFrom=e.target.value||"";if(dashboardTo&&dashboardFrom>dashboardTo){dashboardTo="";$("dashboardTo").value=""}renderAgentDashboard()});
$("dashboardTo")?.addEventListener("change",e=>{dashboardTo=e.target.value||"";if(dashboardFrom&&dashboardTo<dashboardFrom){dashboardFrom="";$("dashboardFrom").value=""}renderAgentDashboard()});
$("dashboardReset")?.addEventListener("click",()=>{dashboardFrom=dashboardTo="";$("dashboardFrom").value="";$("dashboardTo").value="";renderAgentDashboard()});
$("globalSearch")?.addEventListener("input",e=>globalSearch(e.target.value));
$("groupSearch").oninput=e=>{groupFilter=e.target.value.toLowerCase().trim();renderGroup()};$("groupDate").onchange=e=>{dateFilter=e.target.value;renderGroup()};$("personalSearch").oninput=e=>{personalFilter=e.target.value.toLowerCase().trim();renderPersonal()};$("directSearch").oninput=e=>{directFilter=e.target.value||"";renderDirect()};$("clearFilters").onclick=()=>{$("groupSearch").value="";$("groupDate").value="";groupFilter=dateFilter="";renderGroup()};
let pendingDmImageUrl=null;function setPendingDmImage(file){if(!file)return;if(!/^image\/(jpeg|png|webp|gif)$/i.test(file.type)){status("Choose a JPG, PNG, WEBP or GIF image.");return}if(file.size>8*1024*1024){status("Image must be 8 MB or smaller.");return}if(pendingDmImageUrl)URL.revokeObjectURL(pendingDmImageUrl);pendingDmImage=file;pendingDmImageUrl=URL.createObjectURL(file);$("dmImagePreview").innerHTML=`<img src="${pendingDmImageUrl}" alt="Image to send"><span>${esc(file.name||"Pasted image")} · ${(file.size/1024/1024).toFixed(1)} MB</span><button type="button" id="dmImageRemove" aria-label="Remove selected image">×</button>`;$("dmImagePreview").classList.remove("hidden");status("Image ready to send. Press Send to share it.")};
$("dmImageInput").onchange=e=>{setPendingDmImage(e.target.files?.[0]);e.target.value=""};
async function imageFromClipboard(clipboard){
 let file=[...(clipboard?.files||[])].find(f=>/^image\//i.test(f.type));
 if(!file){const item=[...(clipboard?.items||[])].find(i=>i.kind==="file"&&/^image\//i.test(i.type));file=item?.getAsFile()||null}
 if(file)return file;
 try{
  if(navigator.clipboard&&navigator.clipboard.read){
   const entries=await navigator.clipboard.read();
   for(const entry of entries){
    for(const type of entry.types){
     if(/^image\//i.test(type)){
      const blob=await entry.getType(type);
      return new File([blob],"pasted-image-"+Date.now()+"."+(type.split("/")[1]||"png").replace("jpeg","jpg"),{type});
     }
    }
   }
  }
 }catch(error){}
 return null;
}
document.addEventListener("paste",async e=>{
 const input=$("directInput"),view=$("directView"),target=e.target;
 const inDirectChat=view&&!view.classList.contains("hidden")&&!!selectedDirectRecipient;
 const pasteTarget=target===input||target.closest?.("#directNotes")||target.closest?.(".dm-compose-wrap")||target===view||target===document.body||target===document.documentElement;
 if(!inDirectChat||input.disabled||(!pasteTarget&&document.activeElement!==input))return;
 const file=await imageFromClipboard(e.clipboardData);
 if(!file)return;
 e.preventDefault();e.stopPropagation();
 setPendingDmImage(file);
},true);
$("dmImagePreview").onclick=e=>{if(e.target.closest("#dmImageRemove")){pendingDmImage=null;$("dmImageInput").value="";$("dmImagePreview").classList.add("hidden");$("dmImagePreview").innerHTML=""}};
let pendingDmImage=null;
$("directForm").onsubmit=async e=>{
 e.preventDefault();
 const body=$("directInput").value.trim(),image=pendingDmImage;
 const recipient=selectedDirectRecipient||$("directRecipient").value||(team.find(p=>directPairKey(user.id,p.user_id)===selectedDirectKey)?.user_id)||"";
 if(!user||!recipient||recipient===user.id){status("Open a team member chat before sending.");return}
 if(!body&&!image)return;
 const send=$("directForm").querySelector('button[type="submit"]');
 const imageBtn=$("dmImageButton");
 send.disabled=true;if(imageBtn)imageBtn.classList.add("is-uploading");
 let attachmentPath=null;
 try{
  if(image){
   const ext=(image.name.split(".").pop()||"img").toLowerCase().replace(/[^a-z0-9]/g,"")||"img";
   attachmentPath=`${user.id}/${recipient}/${crypto.randomUUID()}.${ext}`;
   const {error:uploadError}=await db.storage.from("orbit-dm-images").upload(attachmentPath,image,{contentType:image.type,upsert:false});
   if(uploadError)throw uploadError;
  }
  const {error}=await db.from("ctr_direct_messages").insert({sender_id:user.id,recipient_id:recipient,sender_email:user.email,body,attachment_path:attachmentPath,attachment_name:image?.name||null,attachment_type:image?.type||null,attachment_size:image?.size||null});
  if(error){if(attachmentPath)await db.storage.from("orbit-dm-images").remove([attachmentPath]);status("Message could not be sent: "+error.message);return}
  $("directInput").value="";pendingDmImage=null;if(pendingDmImageUrl)URL.revokeObjectURL(pendingDmImageUrl);pendingDmImageUrl=null;$("dmImageInput").value="";$("dmImagePreview").classList.add("hidden");$("dmImagePreview").innerHTML="";
  selectedDirectRecipient=String(recipient);
  selectedDirectKey=directPairKey(user.id,recipient);
  $("directRecipient").value=recipient;
  await loadDirect();
  if(selectedDirectRecipient===String(recipient))renderDirect();
  markSeen("direct");
  status("Message sent.");
 }catch(err){status("Message failed: "+(err?.message||"Please try again."))}
 finally{send.disabled=false;if(imageBtn)imageBtn.classList.remove("is-uploading")}
};
let dmImageContextMenuAt=0; $("directNotes").addEventListener("contextmenu",e=>{if(e.target.closest(".dm-image-attachment img"))dmImageContextMenuAt=Date.now()}); $("directNotes").addEventListener("click",e=>{const image=e.target.closest(".dm-image-attachment img");if(image?.src){if(Date.now()-dmImageContextMenuAt<1200)return;openDmImage(image.src,image.alt);return}if(e.target.closest("[data-load-older-direct]")){loadOlderDirect();return}});
$("notes").addEventListener("click",e=>{if(e.target.closest("[data-load-older-group]"))loadOlderGroup()});
$("personalNotes").addEventListener("click",e=>{if(e.target.closest("[data-load-older-personal]"))loadOlderPersonal()});
$("directNotes").addEventListener("click",async e=>{const reply=e.target.closest("[data-dm-reply]");if(reply){const msg=direct.find(m=>String(m.id)===String(reply.dataset.dmReply));if(msg){const sender=team.find(p=>p.user_id===msg.sender_id)?.display_name||"CTR Member";$("directInput").value="↪ "+sender+": "+msg.body+"\n\n";$("directInput").focus()}return}const edit=e.target.closest("[data-dm-edit]");if(edit){const msg=direct.find(m=>String(m.id)===String(edit.dataset.dmEdit));if(!msg||msg.sender_id!==user.id)return;const body=prompt("Edit your message",msg.body||"");if(body===null)return;if(!body.trim()){status("Message cannot be empty.");return}edit.disabled=true;const {error}=await db.from("ctr_direct_messages").update({body:body.trim(),edited_at:new Date().toISOString()}).eq("id",msg.id).eq("sender_id",user.id);edit.disabled=false;if(error){status("Edit failed. Apply the direct-message edit permission migration in Supabase: "+error.message);return}await loadDirect();renderDirect();status("Message updated.");}});
$("directInboxList").addEventListener("click",e=>{
 const target=e.target instanceof Element?e.target:null;if(!target)return;
 if(target.closest("[data-direct-retry]")){loadDirect();return}
 const row=target.closest("button.dm-conversation[data-dm-other]");
 if(!row||!$("directInboxList").contains(row))return;
 e.preventDefault();
 const id=row.dataset.dmOther;
 if(!id)return;
 openDirectConversation(id);
});
document.addEventListener("click",async e=>{
 const replyNote=e.target.closest("[data-reply-note]");if(replyNote){const n=group.find(x=>x.id===replyNote.dataset.replyNote);if(n){$("noteInput").value="↪ "+displayName(n.author_email)+": "+n.body+"\n\n";$("noteInput").focus()}return}
 const cp=e.target.closest("[data-copy-phone]");if(cp){try{await navigator.clipboard.writeText(cp.dataset.copyPhone);status("Phone copied.")}catch{status("Clipboard unavailable.")}return}
 const cn=e.target.closest("[data-copy-note]");if(cn){const n=group.find(x=>x.id===cn.dataset.copyNote);if(n){try{await navigator.clipboard.writeText(n.body);status("CRM note copied.")}catch{status("Clipboard unavailable.")}}return}
 const dmCopy=e.target.closest("[data-copy-dm]");if(dmCopy){const m=direct.find(x=>x.id===dmCopy.dataset.copyDm);if(m){try{await navigator.clipboard.writeText(m.body);status("Message copied.")}catch{status("Clipboard unavailable.")}}return}
 const searchHit=e.target.closest("[data-search-view]");if(searchHit){const view=searchHit.dataset.searchView;showView(view);const q=$("globalSearch").value.trim();if(view==="group"){$("groupSearch").value=q;groupFilter=q;renderGroup()}else if(view==="personal"){$("personalSearch").value=q;personalFilter=q;renderPersonal()}else if(view==="direct"){$("directSearch").value=q;directFilter=q;renderDirect()}else if(view==="followups"){followupSearchFilter=q;renderFollowups();requestAnimationFrame(()=>{const target=$("followupList").querySelector(".followup-item");target?.scrollIntoView({behavior:"smooth",block:"center"})})}$("globalSearchResults").classList.add("hidden");return}
 const done=e.target.closest("[data-follow-done]");if(done){if(!window.confirm("Mark this follow-up as complete? It will be removed from Pending Follow-ups."))return;done.disabled=true;const r=await db.from("ctr_followups").update({status:"completed",completed_at:new Date().toISOString()}).eq("id",done.dataset.followDone).eq("status","pending");done.disabled=false;if(r.error)status("Could not complete follow-up: "+r.error.message);else{await loadFollowups();if(isAdmin()&&adminAuditAgentId){adminAuditData=null;await loadAdminAuditData(adminAuditAgentId);renderAdminChatExplorer()}status("Follow-up completed and removed from pending list.")}return}

});
$("followupForm").onsubmit=async e=>{e.preventDefault();if(!user)return;const customer_name=$("followupCustomer").value.trim(),phone=$("followupPhone").value.trim(),rawAt=$("followupAt").value,callback=new Date(rawAt);if(!customer_name||!phone||!rawAt||Number.isNaN(callback.getTime())){status("Enter customer name, phone and a valid callback date/time.");return}const submit=$("followupForm").querySelector("button[type=submit]");submit.disabled=true;const payload={user_id:user.id,customer_name,phone,callback_at:callback.toISOString(),details:$("followupDetails").value.trim(),status:"pending"};const r=await db.from("ctr_followups").insert(payload).select("id").single();submit.disabled=false;if(r.error){status("Could not schedule follow-up: "+r.error.message);return}$("followupForm").reset();$("followupForm").classList.add("hidden");$("newFollowupBtn").textContent="＋ Create Follow-up";await loadFollowups();status("Callback saved to the shared pending list.");};
$("noteForm").onsubmit=async e=>{
 e.preventDefault();
 const body=$("noteInput").value.trim();
 if(!body||!user||!db)return;
 const send=$("noteForm").querySelector('button[type="submit"]');
 send.disabled=true;
 try{
  const {data,error}=await db.from("ctr_group_notes").insert({user_id:user.id,author_email:user.email,body}).select("*").single();
  if(error)throw error;
  $("noteInput").value="";
  groupFilter="";dateFilter="";
  $("groupSearch").value="";$("groupDate").value="";
  const saved={...data,chat_color:data.chat_color||"#8E7CFF"};
  if(!group.some(n=>String(n.id)===String(saved.id)))group.push(saved);
  group.sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
  renderGroup(true);
  status("Update shared successfully.");
 }catch(err){
  console.error("Group note send failed",err);
  status("Could not send update: "+(err.message||"Please try again."));
 }finally{send.disabled=false}
};
$("personalForm").onsubmit=async e=>{
 e.preventDefault();
 const body=$("personalInput").value.trim();
 if(!body||!user)return;
 const submit=$("personalForm").querySelector('button[type="submit"]');
 submit.disabled=true;
 try{
  const {error}=await db.from("ctr_personal_notes").insert({user_id:user.id,body});
  if(error){status("Could not save personal note: "+error.message);return}
  $("personalInput").value="";
  let refreshFailed=false;
  try{await loadPersonalPage(true)}
  catch(readError){refreshFailed=true;status("Note saved, but refresh failed: "+readError.message)}
  renderPersonal();
  if(!refreshFailed)status("Personal note saved.");
 }catch(err){status("Could not save personal note: "+(err?.message||"Please try again."))}
 finally{submit.disabled=false}
};
document.addEventListener("click",async e=>{const target=e.target.closest("button");if(!target)return;const g=target.dataset.gdelete,p=target.dataset.pdelete,d=target.dataset.ddelete;const edit=target.dataset.edit,pedit=target.dataset.pedit,pin=target.dataset.pin,rid=target.dataset.react,emoji=target.dataset.emoji;
if(edit){const n=group.find(x=>String(x.id)===String(edit));if(n){const body=prompt("Edit group note",n.body);if(body!==null&&body.trim()){target.disabled=true;const {error}=await db.from("ctr_group_notes").update({body:body.trim(),edited_at:new Date().toISOString()}).eq("id",edit).eq("user_id",n.user_id);target.disabled=false;if(error)status("Group note edit failed: "+error.message);else{await loadGroupPage(true);renderGroup();status("Group note updated.")}}}}
if(pedit){const n=personal.find(x=>String(x.id)===String(pedit));if(n){const body=prompt("Edit personal note",n.body);if(body!==null&&body.trim()){target.disabled=true;const {error}=await db.from("ctr_personal_notes").update({body:body.trim(),edited_at:new Date().toISOString()}).eq("id",pedit).eq("user_id",n.user_id);target.disabled=false;if(error)status("Personal note edit failed: "+error.message);else{await loadPersonalPage(true);renderPersonal();status("Personal note updated.")}}}}
if(pin&&isAdmin()){const n=group.find(x=>x.id===pin);if(n){target.disabled=true;const {error}=await db.rpc("ctr_toggle_group_pin",{p_note_id:pin});target.disabled=false;if(error){status("Pin update failed: "+error.message)}else{try{await loadGroupPage(true)}catch(readError){status("Pin saved, refresh failed: "+readError.message);return}renderGroup();status(n.is_pinned?"Message unpinned.":"Message pinned.")}}}
if(rid&&emoji){target.disabled=true;const {error}=await db.rpc("ctr_toggle_group_reaction",{p_note_id:rid,p_emoji:emoji});target.disabled=false;if(error){status("Reaction failed: "+error.message)}else{try{await loadGroupPage(true)}catch(readError){status("Reaction saved, refresh failed: "+readError.message);return}renderGroup();status("Reaction updated.")}}
if(g){const note=group.find(x=>x.id===g);if(!note||(!isAdmin()&&note.user_id!==user.id))return;if(!confirm("Permanently delete this group message?"))return;const {error}=await db.from("ctr_group_notes").delete().eq("id",g);if(error)status("Delete failed: "+error.message);else{await loadGroupPage(true);renderGroup();status("Group message deleted.")}}if(p){const note=personal.find(x=>x.id===p);if(!note||(!isAdmin()&&note.user_id!==user.id))return;if(!confirm("Permanently delete this personal note?"))return;const {error}=await db.from("ctr_personal_notes").delete().eq("id",p);if(error)status("Delete failed: "+error.message);else{await loadPersonalPage(true);renderPersonal();status("Personal note deleted.")}}if(d){const msg=direct.find(x=>String(x.id)===String(d));if(!msg||(!isAdmin()&&msg.sender_id!==user.id))return;if(!confirm("Permanently delete this direct message?"))return;target.disabled=true;const {error}=await db.from("ctr_direct_messages").delete().eq("id",d).eq("sender_id",msg.sender_id);target.disabled=false;if(error)status("Direct message delete failed: "+error.message);else{try{await loadDirect();renderDirect();status("Direct message deleted.")}catch(refreshError){status("Message deleted, but chat refresh failed: "+refreshError.message)}}}});
$("signOut").onclick=async()=>{if(channel)await db.removeChannel(channel);if(presenceChannel)await db.removeChannel(presenceChannel);await db.auth.signOut({scope:"local"})};
connectAuth().catch(err=>{console.error("CTR startup failed",err);status("App startup failed: "+(err?.message||"Please refresh the page."),true)});
function syncVisualViewport(){const height=window.visualViewport?.height||window.innerHeight;document.documentElement.style.setProperty("--app-viewport-height",height+"px")}
syncVisualViewport();window.addEventListener("resize",syncVisualViewport);window.visualViewport?.addEventListener("resize",syncVisualViewport);
["noteInput","personalInput","directInput"].forEach(id=>$(id)?.addEventListener("focus",()=>setTimeout(syncVisualViewport,180)));

document.addEventListener("visibilitychange",()=>{if(!document.hidden&&user){if(!$("groupView").classList.contains("hidden"))markSeen("group");if(!$("directView").classList.contains("hidden"))markSeen("direct")}});
let holdTimer;document.addEventListener("touchstart",e=>{const card=e.target.closest(".note[data-note-id]");if(!card)return;holdTimer=setTimeout(()=>{const n=group.find(x=>x.id===card.dataset.noteId);if(n&&confirm("Quote this message in Group Chat?")){$("noteInput").value="↪ "+displayName(n.author_email)+": "+n.body+"\n\n";$("noteInput").focus()}},650)},{passive:true});document.addEventListener("touchend",()=>clearTimeout(holdTimer),{passive:true});document.addEventListener("touchmove",()=>clearTimeout(holdTimer),{passive:true});
document.addEventListener("touchstart",e=>{const c=e.target.closest(".note[data-note-id]");if(c)c.dataset.startX=e.touches[0].clientX},{passive:true});document.addEventListener("touchend",async e=>{const c=e.target.closest(".note[data-note-id]");if(!c||!c.dataset.startX)return;const dx=e.changedTouches[0].clientX-Number(c.dataset.startX);delete c.dataset.startX;const n=group.find(x=>x.id===c.dataset.noteId);if(!n)return;if(dx>85){$("noteInput").value="↪ "+displayName(n.author_email)+": "+n.body+"\n\n";$("noteInput").focus()}else if(dx< -85){try{await navigator.clipboard.writeText(n.body);status("CRM note copied by swipe.")}catch{status("Clipboard unavailable.")}}},{passive:true});


// Desktop sidebar expand/collapse preference.
(()=>{
 const root=document.querySelector(".app-view");
 const toggle=document.getElementById("sidebarToggle");
 if(!root||!toggle)return;
 const key="ctr_sidebar_collapsed";
 const apply=collapsed=>{
  root.classList.toggle("sidebar-collapsed",collapsed);
  toggle.setAttribute("aria-label",collapsed?"Expand sidebar":"Collapse sidebar");
  toggle.title=collapsed?"Expand sidebar":"Collapse sidebar";
  const label=toggle.querySelector(".toggle-label");
  if(label)label.textContent=collapsed?"Expand":"Collapse";
 };
 apply(localStorage.getItem(key)==="1");
 toggle.addEventListener("click",()=>{
  const collapsed=!root.classList.contains("sidebar-collapsed");
  localStorage.setItem(key,collapsed?"1":"0");
  apply(collapsed);
 });
})();

// Smooth, reliable pull-cord theme switch (mouse, pen and touch).
(()=> {
 const sw=$("themePull");
 if(!sw || sw.dataset.pullReady==="1") return;
 sw.dataset.pullReady="1";
 const cord=sw.querySelector(".pull-cord");
 if(!cord) return;
 let startY=null, pointerId=null, distance=0;
 const reset=()=>{
   startY=null; pointerId=null; distance=0;
   sw.style.setProperty("--pull-distance","0px");
   sw.classList.remove("is-pulling");
 };
 const toggle=()=>{
   setTheme(document.body.classList.contains("theme-light")?"dark":"light");
   sw.classList.add("is-pulled");
   window.setTimeout(()=>sw.classList.remove("is-pulled"),220);
 };
 cord.addEventListener("pointerdown",e=>{
   if(startY!==null) return;
   startY=e.clientY; pointerId=e.pointerId; distance=0;
   sw.classList.add("is-pulling");
   try{sw.setPointerCapture(e.pointerId)}catch{}
   e.preventDefault();
 });
 sw.addEventListener("pointermove",e=>{
   if(startY===null || e.pointerId!==pointerId) return;
   distance=Math.max(0,Math.min(72,e.clientY-startY));
   sw.style.setProperty("--pull-distance",distance+"px");
   e.preventDefault();
 });
 sw.addEventListener("pointerup",e=>{
   if(startY===null || e.pointerId!==pointerId) return;
   const pulled=distance>=18;
   reset();
   if(pulled) toggle();
 });
 sw.addEventListener("pointercancel",reset);
 sw.addEventListener("lostpointercapture",reset);
 sw.addEventListener("keydown",e=>{
   if(e.key==="Enter" || e.key===" "){e.preventDefault();toggle();}
 });
})();
