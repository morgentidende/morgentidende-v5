import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const enc=new TextEncoder();
const hex=(b:ArrayBuffer|Uint8Array)=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
const sha=async(s:string)=>hex(await crypto.subtle.digest('SHA-256',enc.encode(s)));
const hmac=async(key:Uint8Array,msg:string)=>new Uint8Array(await crypto.subtle.sign('HMAC',await crypto.subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-256'},false,['sign']),enc.encode(msg)));
const esc=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
const safeEq=(a:string,b:string)=>{if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0};
const fmtDate=(iso:string)=>{const d=new Date(iso+'T12:00:00Z');const w=['Søndag','Mandag','Tirsdag','Onsdag','Torsdag','Fredag','Lørdag'];const m=['januar','februar','marts','april','maj','juni','juli','august','september','oktober','november','december'];return `${w[d.getUTCDay()]} d. ${d.getUTCDate()}. ${m[d.getUTCMonth()]} ${d.getUTCFullYear()}`};

async function sendSes(to:string,subject:string,html:string){
 const access=Deno.env.get('AWS_ACCESS_KEY_ID'), secret=Deno.env.get('AWS_SECRET_ACCESS_KEY'), session=Deno.env.get('AWS_SESSION_TOKEN');
 if(!access||!secret) throw new Error('SES_CREDENTIALS_MISSING');
 const region=Deno.env.get('AWS_SES_REGION')||'eu-north-1', from=Deno.env.get('AWS_SES_FROM')||'Morgentidende <nyhedsbrev@morgentidende.dk>';
 const host=`email.${region}.amazonaws.com`, path='/v2/email/outbound-emails';
 const payload=JSON.stringify({FromEmailAddress:from,Destination:{ToAddresses:[to]},Content:{Simple:{Subject:{Data:subject,Charset:'UTF-8'},Body:{Html:{Data:html,Charset:'UTF-8'}}}}});
 const now=new Date().toISOString().replace(/[:-]|\.\d{3}/g,''), day=now.slice(0,8), payloadHash=await sha(payload);
 const extra=session?`x-amz-security-token:${session}\n`:'', signed=session?'content-type;host;x-amz-date;x-amz-security-token':'content-type;host;x-amz-date';
 const headers=`content-type:application/json\nhost:${host}\nx-amz-date:${now}\n${extra}`;
 const canonical=`POST\n${path}\n\n${headers}\n${signed}\n${payloadHash}`, scope=`${day}/${region}/ses/aws4_request`, sts=`AWS4-HMAC-SHA256\n${now}\n${scope}\n${await sha(canonical)}`;
 let k=await hmac(enc.encode('AWS4'+secret),day);k=await hmac(k,region);k=await hmac(k,'ses');k=await hmac(k,'aws4_request');
 const sig=hex(await crypto.subtle.sign('HMAC',await crypto.subtle.importKey('raw',k,{name:'HMAC',hash:'SHA-256'},false,['sign']),enc.encode(sts)));
 const h:Record<string,string>={'content-type':'application/json','x-amz-date':now,authorization:`AWS4-HMAC-SHA256 Credential=${access}/${scope}, SignedHeaders=${signed}, Signature=${sig}`}; if(session)h['x-amz-security-token']=session;
 const r=await fetch(`https://${host}${path}`,{method:'POST',headers:h,body:payload}); const t=await r.text(); if(!r.ok)throw new Error(`SES_${r.status}_${t.slice(0,200)}`);
 try{return JSON.parse(t).MessageId||null}catch{return null}
}

function emailHtml(articles:any[],manageToken:string,date:string,theme:string){
 const dark=theme==='dark', bg=dark?'#0f1926':'#f4efe5', card=dark?'#162331':'#fffaf2', head=dark?'#f7efe1':'#182534', body=dark?'#c3cad2':'#535862', muted=dark?'#aeb7c1':'#6f7178', border=dark?'#344250':'#e6ddcf';
 const items=articles.map((a,i)=>{const u=`https://morgentidende.dk/artikel/${encodeURIComponent(a.slug)}`;return i===0?`<tr><td style="padding:30px 0 32px;border-top:1px solid ${border};border-bottom:1px solid ${border}"><div style="margin:0 0 10px;color:#b17b16;font-size:11px;font-weight:800;letter-spacing:1.8px;text-transform:uppercase">Tophistorie</div><a href="${u}" style="font-family:Georgia,serif;font-size:31px;line-height:1.12;font-weight:700;color:${head};text-decoration:none">${esc(a.headline)}</a>${a.deck?`<p style="margin:12px 0 0;font-size:16px;line-height:1.6;color:${body}">${esc(a.deck)}</p>`:''}<div style="margin-top:16px"><a href="${u}" style="font-size:13px;font-weight:700;color:#b17b16;text-decoration:none">Læs historien →</a></div></td></tr>`:`<tr><td style="padding:24px 0;border-bottom:1px solid ${border}"><a href="${u}" style="font-family:Georgia,serif;font-size:22px;line-height:1.22;font-weight:700;color:${head};text-decoration:none">${esc(a.headline)}</a>${a.deck?`<p style="margin:9px 0 0;font-size:15px;line-height:1.58;color:${body}">${esc(a.deck)}</p>`:''}</td></tr>`}).join('');
 const prefs=`https://morgentidende.dk/nyhedsbrev/indstillinger?token=${encodeURIComponent(manageToken)}`;
 const auto=theme==='system'?`@media (prefers-color-scheme:dark){.email-bg{background:#0f1926!important}.email-card,.content,.footer,.prefs{background:#162331!important}.content h1,.storylink,.prefs-title{color:#f7efe1!important}.copy,.footer,.prefs-copy{color:#c3cad2!important}.rule{border-color:#344250!important}}`:'';
 return `<!doctype html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@media(max-width:620px){.outer{padding:0!important}.content,.masthead,.footer,.prefs{padding-left:24px!important;padding-right:24px!important}}${auto}</style></head><body style="margin:0;background:${bg};font-family:Arial,Helvetica,sans-serif"><table class="email-bg outer" width="100%" role="presentation" cellspacing="0" cellpadding="0" style="background:${bg};padding:26px 12px"><tr><td align="center"><table class="email-card" width="100%" role="presentation" cellspacing="0" cellpadding="0" style="max-width:680px;background:${card};border:1px solid ${border}"><tr><td class="masthead" style="padding:28px 38px;background:#182534;color:#fffaf0;text-align:center;border-top:4px solid #d8a33d"><div style="font-size:42px;line-height:1;color:#e9bf64">☀</div><div style="font-family:Georgia,serif;font-size:34px;font-weight:700">Morgentidende</div><div style="margin-top:10px;color:#e9bf64;font-size:11px;font-weight:800;letter-spacing:1.5px">MORGENOVERBLIK · ${esc(fmtDate(date)).toUpperCase()}</div></td></tr><tr><td class="content" style="padding:34px 40px 16px;background:${card}"><h1 style="margin:0 0 7px;font-family:Georgia,serif;font-size:31px;color:${head}">Døgnets 6 stærkeste historier</h1><p class="copy" style="margin:0 0 18px;color:${muted};font-size:14px;line-height:1.45">Med særligt blik for væsentlige historier, der har fyldt mindre i danske medier.</p><table width="100%" role="presentation" cellspacing="0" cellpadding="0">${items}</table></td></tr><tr><td class="prefs" style="padding:25px 40px;background:${card};border-top:1px solid ${border}"><div class="prefs-title" style="font-family:Georgia,serif;font-size:19px;font-weight:700;color:${head};margin-bottom:7px">Dine nyhedsbreve</div><div class="prefs-copy" style="font-size:13px;line-height:1.6;color:${muted};margin-bottom:13px">Vælg Viden, Liv og Lys, Mørk eller Automatisk visning.</div><a href="${prefs}" style="display:inline-block;padding:10px 14px;background:#d8a33d;color:#17140c;text-decoration:none;font-size:13px;font-weight:800">Vælg indstillinger</a></td></tr><tr><td class="footer" style="padding:20px 40px 28px;background:${card};border-top:1px solid ${border};color:${muted};font-size:12px;line-height:1.65">Du modtager denne mail, fordi du har bekræftet Morgentidendes daglige nyhedsbrev. Du kan afmelde det under dine indstillinger.</td></tr></table></td></tr></table></body></html>`;
}

Deno.serve(async(req)=>{
 if(req.method!=='POST')return Response.json({error:'METHOD_NOT_ALLOWED'},{status:405});
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
 const supplied=req.headers.get('x-v5-newsletter-token')||'', {data:cfg}=await db.from('v5_runtime_config').select('value').eq('key','newsletter_cron_token').maybeSingle();
 if(!cfg?.value||!safeEq(supplied,cfg.value))return Response.json({error:'UNAUTHORIZED'},{status:401});
 const b=await req.json().catch(()=>({})); const date=String(b.local_date||new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Copenhagen'}).format(new Date()));
 const {data:existing}=await db.from('v5_newsletter_dispatches').select('status').eq('local_date',date).maybeSingle(); if(existing?.status==='sent'||existing?.status==='sending')return Response.json({ok:true,duplicate:true});
 let articles:any[]=[]; const {data:picks}=await db.from('v5_newsletter_daily_picks').select('rank,article_id,v5_articles(id,slug,headline,deck,published_at)').eq('local_date',date).order('rank');
 if(picks?.length===6) articles=picks.map((p:any)=>p.v5_articles).filter(Boolean);
 if(articles.length!==6){const since=new Date(Date.now()-24*3600e3).toISOString();const {data}=await db.from('v5_articles').select('id,slug,headline,deck,published_at,frontpage_destination,is_breaking,article_kind').gte('published_at',since).neq('article_kind','magazine').order('is_breaking',{ascending:false}).order('published_at',{ascending:false}).limit(30);articles=(data||[]).sort((a:any,b:any)=>((b.frontpage_destination==='lead'?2:0)-(a.frontpage_destination==='lead'?2:0))||(+new Date(b.published_at)-+new Date(a.published_at))).slice(0,6)}
 if(!articles.length)return Response.json({error:'NO_ARTICLES'},{status:409});
 await db.from('v5_newsletter_dispatches').upsert({local_date:date,status:'sending',article_ids:articles.map(a=>a.id),started_at:new Date().toISOString(),error:null});
 try{
   const {data:subs,error:se}=await db.from('v5_newsletter_subscribers').select('email,manage_token,preferred_theme').eq('status','active').eq('daily_news',true); if(se)throw se;
   const ids:any[]=[]; for(const s of subs||[]){ids.push(await sendSes(s.email,'Morgentidende – døgnets 6 stærkeste historier',emailHtml(articles,s.manage_token,date,s.preferred_theme||'system')))}
   await db.from('v5_newsletter_dispatches').update({status:'sent',recipient_count:(subs||[]).length,ses_message_ids:ids,completed_at:new Date().toISOString()}).eq('local_date',date);
   return Response.json({ok:true,articles:articles.length,recipients:(subs||[]).length});
 }catch(e){await db.from('v5_newsletter_dispatches').update({status:'failed',error:String(e).slice(0,500),completed_at:new Date().toISOString()}).eq('local_date',date);return Response.json({error:'SEND_FAILED'},{status:500})}
});