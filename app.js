const sunIcon='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';
const moonIcon='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';
function initTheme(){
  let dark=false;
  try{const saved=localStorage.getItem('aws_quiz_theme');if(saved)dark=saved==='dark'}catch(e){}
  document.documentElement.classList.toggle('dark',dark);
  document.getElementById('themeBtn').innerHTML=dark?sunIcon:moonIcon;
}
function toggleTheme(){
  const isDark=document.documentElement.classList.toggle('dark');
  try{localStorage.setItem('aws_quiz_theme',isDark?'dark':'light')}catch(e){}
  document.getElementById('themeBtn').innerHTML=isDark?sunIcon:moonIcon;
}
initTheme();


const exams=[
  {id:'clf-c02',code:'CLF-C02',name:'Cloud Practitioner',tier:'foundational',hasQuestions:true},
  {id:'aif-c01',code:'AIF-C01',name:'AI Practitioner',tier:'foundational',hasQuestions:false},
  {id:'saa-c03',code:'SAA-C03',name:'Solutions Architect – Associate',tier:'associate',hasQuestions:true},
  {id:'mla-c01',code:'MLA-C01',name:'Machine Learning Engineer – Associate',tier:'associate',hasQuestions:false},
  {id:'dva-c02',code:'DVA-C02',name:'Developer – Associate',tier:'associate',hasQuestions:false},
  {id:'soa-c02',code:'SOA-C02',name:'SysOps Administrator – Associate',tier:'associate',hasQuestions:false},
  {id:'dea-c01',code:'DEA-C01',name:'Data Engineer – Associate',tier:'associate',hasQuestions:false},
  {id:'sap-c02',code:'SAP-C02',name:'Solutions Architect – Professional',tier:'professional',hasQuestions:false},
  {id:'agd-c01',code:'AGD-C01',name:'Generative AI Developer – Professional',tier:'professional',hasQuestions:false},
  {id:'dop-c02',code:'DOP-C02',name:'DevOps Engineer – Professional',tier:'professional',hasQuestions:false},
  {id:'ans-c01',code:'ANS-C01',name:'Advanced Networking – Specialty',tier:'specialty',hasQuestions:false},
  {id:'scs-c02',code:'SCS-C02',name:'Security – Specialty',tier:'specialty',hasQuestions:false},
  {id:'mls-c01',code:'MLS-C01',name:'Machine Learning – Specialty',tier:'specialty',hasQuestions:false},
];
const tierLabels={foundational:'Foundational',associate:'Associate',professional:'Professional',specialty:'Specialty'};
const questionBanks={};
const questionFiles={'clf-c02':'questions-clf-c02.json','saa-c03':'questions-saa-c03.json'};
async function loadQuestions(examId){
  if(questionBanks[examId]) return questionBanks[examId];
  const file=questionFiles[examId];if(!file) return [];
  try{const resp=await fetch(file);const data=await resp.json();questionBanks[examId]=data;return data}catch(e){console.error('Failed to load',examId,e);return[]}
}
async function preloadAll(){await Promise.all(Object.keys(questionFiles).map(id=>loadQuestions(id)));render()}

let S={screen:'landing',selectedExam:null,category:'全部',currentQ:0,answered:false,selectedOpt:null,selectedOpts:[],correctCount:0,wrongCount:0,skipCount:0,answers:[],filteredQuestions:[],questionCount:30,mode:'normal'};

// Wrong question persistence
function getWrongKey(examId){return 'aws_wrong_'+examId}
function loadWrong(examId){try{return JSON.parse(localStorage.getItem(getWrongKey(examId)))||[]}catch(e){return[]}}
function saveWrong(examId,list){localStorage.setItem(getWrongKey(examId),JSON.stringify(list))}
function addWrong(examId,q){
  const list=loadWrong(examId);
  // Use question text as unique key
  if(!list.find(x=>x.question===q.question)){list.push(q);saveWrong(examId,list)}
}
function removeWrong(examId,q){
  let list=loadWrong(examId);
  list=list.filter(x=>x.question!==q.question);
  saveWrong(examId,list);
}

// === History & Weakness Tracking ===
function getHistKey(examId){return 'aws_hist_'+examId}
function loadHist(examId){try{return JSON.parse(localStorage.getItem(getHistKey(examId)))||{}}catch(e){return{}}}
function saveHist(examId,h){localStorage.setItem(getHistKey(examId),JSON.stringify(h))}
function recordAnswer(examId,category,correct){
  const h=loadHist(examId);
  if(!h[category]) h[category]={total:0,correct:0};
  h[category].total++;
  if(correct) h[category].correct++;
  saveHist(examId,h);
}
function getWeaknesses(examId){
  const h=loadHist(examId);
  const cats=Object.entries(h).map(([cat,d])=>({cat,total:d.total,correct:d.correct,pct:d.total?Math.round(d.correct/d.total*100):0}));
  cats.sort((a,b)=>a.pct-b.pct);
  return cats;
}
function getWeakestCats(examId,n=3){
  const w=getWeaknesses(examId).filter(c=>c.total>=2);
  return w.slice(0,n).map(c=>c.cat);
}

// === AI Question Generation ===
let aiGenerating=false;
const examDescriptions={
  'clf-c02':'AWS Certified Cloud Practitioner (CLF-C02)，涵蓋雲端概念、安全性、技術服務、計費與定價',
  'saa-c03':'AWS Certified Solutions Architect – Associate (SAA-C03)，涵蓋安全性、運算、儲存、網路、資料庫、成本優化、高可用性、應用程式整合、部署與管理'
};

async function generateAIQuestions(examId,weakCats,count=5){
  const desc=examDescriptions[examId]||'AWS 認證考試';
  const prompt=`你是 AWS 認證考試出題專家。請針對弱項類別生成 ${count} 題繁體中文模擬考題。

考試：${desc}
弱項類別：${weakCats.join('、')}

規則：
- 情境題，4 個選項，1 個正確答案
- answer 欄位是正確選項的索引（0-3）
- 解析要簡潔，50字以內
- 選項要簡潔，每個選項30字以內
- 題目100字以內
- 不要在字串中使用換行符號
- 用語規範：執行個體（非實例）、儲存貯體（非儲存桶）、可用區、安全群組、子網、託管服務、容錯、持久性、可擴展、本地（非本地端）、負載均衡

只回傳 JSON 陣列，不要任何其他文字：
[{"category":"類別","question":"題目","options":["A","B","C","D"],"answer":0,"explanation":"解析"}]`;

  const resp=await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      model:"claude-sonnet-4-20250514",
      max_tokens:4000,
      messages:[{role:"user",content:prompt}]
    })
  });
  const data=await resp.json();
  const text=data.content.map(b=>b.text||'').join('');
  // Robust JSON extraction
  let json=text.replace(/```json|```/g,'').trim();
  // Find the JSON array boundaries
  const start=json.indexOf('[');
  const end=json.lastIndexOf(']');
  if(start===-1||end===-1) throw new Error('No JSON array found');
  json=json.slice(start,end+1);
  // Fix common issues: remove trailing commas, fix newlines in strings
  json=json.replace(/\n/g,' ').replace(/,\s*]/g,']').replace(/,\s*}/g,'}');
  let parsed;
  try{ parsed=JSON.parse(json); }catch(e){
    // Try to salvage partial results
    const partial=json.match(/\{[^{}]+\}/g);
    if(partial&&partial.length){
      parsed=partial.map(p=>{try{return JSON.parse(p)}catch(_){return null}}).filter(Boolean);
    }
    if(!parsed||!parsed.length) throw e;
  }
  // Validate structure
  return parsed.filter(q=>q.question&&Array.isArray(q.options)&&q.options.length===4&&typeof q.answer==='number').map(q=>({
    category:q.category||weakCats[0],
    question:q.question,
    options:q.options,
    answer:Math.min(Math.max(q.answer,0),3),
    explanation:q.explanation||'AI 生成題目'
  }));
}

async function startAIQuiz(){
  if(aiGenerating)return;
  const examId=S.selectedExam.id;
  let weakCats=getWeakestCats(examId);
  if(!weakCats.length){
    const b=questionBanks[examId]||[];
    const allCats=[...new Set(b.map(q=>q.category))];
    weakCats=shuffle(allCats).slice(0,3);
  }
  aiGenerating=true;
  S.screen='ai-loading';
  S.aiWeakCats=weakCats;
  render();
  try{
    const qs=await generateAIQuestions(examId,weakCats,5);
    if(!Array.isArray(qs)||!qs.length) throw new Error('未能生成有效題目');
    S.filteredQuestions=shuffleOpts(qs);
    S.currentQ=0;S.answered=false;S.selectedOpt=null;S.selectedOpts=[];S.correctCount=0;S.wrongCount=0;S.skipCount=0;S.answers=[];S.mode='ai';S.screen='quiz';
  }catch(err){
    console.error('AI generation failed:',err);
    S.screen='start';
    aiGenerating=false;
    render();
    setTimeout(()=>alert('AI 題目生成失敗：'+err.message+'\n\n請稍後再試。'),100);
    return;
  }
  aiGenerating=false;
  render();
}

function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
async function selectExam(id){const e=exams.find(x=>x.id===id);if(!e||!e.hasQuestions)return;await loadQuestions(id);S.selectedExam=e;S.screen='start';S.category='全部';S.mode='normal';render()}
function getCats(){const b=questionBanks[S.selectedExam.id]||[];return['全部',...new Set(b.map(q=>q.category))]}

function shuffleOpts(questions){
  return questions.map(q=>{
    const indices=[...Array(q.options.length).keys()];
    for(let i=indices.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[indices[i],indices[j]]=[indices[j],indices[i]]}
    const isMulti=Array.isArray(q.answer);
    const newAnswer=isMulti?q.answer.map(a=>indices.indexOf(a)):indices.indexOf(q.answer);
    return {...q, options:indices.map(i=>q.options[i]), answer:newAnswer, _orig:q};
  });
}

function startQuiz(){
  const b=questionBanks[S.selectedExam.id]||[];
  let p=S.category==='全部'?[...b]:b.filter(q=>q.category===S.category);
  p=shuffle(p);
  S.filteredQuestions=shuffleOpts(p.slice(0,Math.min(S.questionCount,p.length)));
  S.currentQ=0;S.answered=false;S.selectedOpt=null;S.selectedOpts=[];S.correctCount=0;S.wrongCount=0;S.skipCount=0;S.answers=[];S.mode='normal';S.screen='quiz';render();
}

function startWrongQuiz(){
  const wl=loadWrong(S.selectedExam.id);
  if(!wl.length)return;
  S.filteredQuestions=shuffleOpts(shuffle([...wl]));
  S.currentQ=0;S.answered=false;S.selectedOpt=null;S.selectedOpts=[];S.correctCount=0;S.wrongCount=0;S.skipCount=0;S.answers=[];S.mode='wrong';S.screen='quiz';render();
}

function isMultiQ(q){return Array.isArray(q.answer)}
function toggleOption(i){
  if(S.answered)return;
  const idx=S.selectedOpts.indexOf(i);
  if(idx>-1)S.selectedOpts.splice(idx,1);else S.selectedOpts.push(i);
  render();
}
function submitMulti(){
  if(S.answered)return;
  const q=S.filteredQuestions[S.currentQ];
  S.answered=true;
  const orig=q._orig||q;
  const sorted1=[...S.selectedOpts].sort();
  const sorted2=[...q.answer].sort();
  const c=JSON.stringify(sorted1)===JSON.stringify(sorted2);
  recordAnswer(S.selectedExam.id,orig.category,c);
  if(c){S.correctCount++;if(S.mode==='wrong')removeWrong(S.selectedExam.id,orig)}
  else{S.wrongCount++;addWrong(S.selectedExam.id,orig)}
  S.answers.push({question:q,selected:S.selectedOpts,correct:c});
  render();
}
function selectOption(i){
  if(S.answered)return;
  const q=S.filteredQuestions[S.currentQ];
  if(isMultiQ(q)){toggleOption(i);return}
  S.answered=true;S.selectedOpt=i;
  const orig=q._orig||q;
  const c=i===q.answer;
  recordAnswer(S.selectedExam.id,orig.category,c);
  if(c){
    S.correctCount++;
    if(S.mode==='wrong') removeWrong(S.selectedExam.id,orig);
  }else{
    S.wrongCount++;
    addWrong(S.selectedExam.id,orig);
  }
  S.answers.push({question:q,selected:i,correct:c});
  render();
}

function nextQuestion(){
  if(S.currentQ+1>=S.filteredQuestions.length){S.screen='result';render();return}
  S.currentQ++;
  if(S.answers[S.currentQ]){
    const prev=S.answers[S.currentQ];
    S.answered=true;
    S.selectedOpt=Array.isArray(prev.selected)?null:prev.selected;
    S.selectedOpts=Array.isArray(prev.selected)?prev.selected:[];
  }else{
    S.answered=false;S.selectedOpt=null;S.selectedOpts=[];
  }
  render();
}
function prevQuestion(){if(S.currentQ>0){S.currentQ--;const prev=S.answers[S.currentQ];S.answered=true;S.selectedOpt=Array.isArray(prev.selected)?null:prev.selected;S.selectedOpts=Array.isArray(prev.selected)?prev.selected:[];render()}}
function skipToWrong(){
  if(S.answered)return;
  const q=S.filteredQuestions[S.currentQ];
  const orig=q._orig||q;
  const multi=isMultiQ(q);
  S.answered=true;S.selectedOpt=null;S.selectedOpts=[];
  S.skipCount++;
  addWrong(S.selectedExam.id,orig);
  recordAnswer(S.selectedExam.id,orig.category,false);
  S.answers.push({question:q,selected:multi?[]:-1,correct:false,skipped:true});
  render();
}
function goHome(){S.screen='landing';S.selectedExam=null;render()}
function goConfig(){S.screen='start';render()}
function setCategory(c){S.category=c;const b=questionBanks[S.selectedExam.id]||[];const mx=c==='全部'?b.length:b.filter(q=>q.category===c).length;const opts=[...new Set([10,30,65].map(n=>Math.min(n,mx)))];if(!opts.includes(S.questionCount))S.questionCount=opts[opts.length-1];render()}
function setCount(n){S.questionCount=n;render()}


const I={
  cloud:'<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>',
  book:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>',
  bot:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2M20 14h2M15 13v2M9 13v2"/></svg>',
  info:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
  arrowLeft:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7M19 12H5"/></svg>',
  arrowRight:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>',
  trophy:'<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>',
  flame:'<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>',
  play:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
  sparkles:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4M19 17v4M3 5h4M17 19h4"/></svg>',
  refresh:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>',
};

// === RENDER FUNCTIONS (Origin UI style) ===

function render(){
  const app=document.getElementById('app');
  document.getElementById('themeBtn').style.display=S.screen==='landing'?'flex':'none';
  switch(S.screen){
    case'landing':renderLanding(app);break;
    case'start':renderStart(app);break;
    case'quiz':renderQuiz(app);break;
    case'result':renderResult(app);break;
    case'ai-loading':renderAILoading(app);break;
  }
  window.scrollTo({top:0,behavior:'smooth'});
}

function renderAILoading(app){
  const e=S.selectedExam;
  app.innerHTML=`
    <div class="breadcrumb"><a onclick="goHome()">首頁</a><span class="bc-sep">›</span><a onclick="goConfig()">${e.code}</a><span class="bc-sep">›</span><span>AI 生成中</span></div>
    <div class="card">
      <div class="card-body text-center" style="padding:48px 20px">
        <div class="spinner" style="margin:0 auto 16px"></div>
        <div class="font-semibold mb-2">${I.bot} AI 正在為你量身出題</div>
        <div class="text-sm text-muted">正在分析弱項類別並生成針對性題目...</div>
        <div class="flex justify-center gap-2 mt-3">${(S.aiWeakCats||[]).map(c=>`<span class="badge badge-purple">${c}</span>`).join('')}</div>
      </div>
    </div>`;
}

function renderLanding(app){
  const tiers=['foundational','associate','professional','specialty'];
  app.innerHTML=`
    <div class="text-center" style="padding:32px 0 24px">
      <div style="font-size:2rem;margin-bottom:8px">${I.cloud}</div>
      <h1 style="font-size:1.35rem;font-weight:700;letter-spacing:-.02em">AWS 認證模擬考</h1>
      <p class="text-sm text-muted mt-2">選擇考試，開始練習</p>
    </div>
    ${tiers.map(t=>{
      const te=exams.filter(e=>e.tier===t);
      return`
        <div class="mb-4">
          <div class="flex items-center gap-2 mb-3">
            <span class="badge badge-${t}">${tierLabels[t]}</span>
            <div style="flex:1;height:1px;background:var(--border)"></div>
          </div>
          <div class="grid grid-2 gap-3">
            ${te.map(e=>{
              const qc=(questionBanks[e.id]||[]).length;
              return`<div class="exam-card ${e.hasQuestions?'':'exam-disabled'}" onclick="selectExam('${e.id}')" style="display:flex;align-items:center;justify-content:space-between;gap:12px">
                <div style="min-width:0">
                  <div class="text-xs font-semibold text-muted" style="letter-spacing:.06em">${e.code}</div>
                  <div class="font-medium text-sm mt-1" style="line-height:1.4">${e.name}</div>
                </div>
                <div style="flex-shrink:0;text-align:right">
                  ${e.hasQuestions?`<span class="badge badge-primary">${qc} 題</span>`
                  :`<span class="badge badge-muted">即將推出</span>`}
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>`;
    }).join('')}`;
}

function renderStart(app){
  const e=S.selectedExam,cats=getCats(),b=questionBanks[e.id]||[];
  const mx=S.category==='全部'?b.length:b.filter(q=>q.category===S.category).length;
  const wl=loadWrong(e.id);
  const weaknesses=getWeaknesses(e.id);
  const hasHistory=weaknesses.length>0;
  const weakCats=getWeakestCats(e.id);

  app.innerHTML=`
    <div class="breadcrumb"><a onclick="goHome()">首頁</a><span class="bc-sep">›</span><span>${e.code}</span></div>
    <div class="card mb-4">
      <div class="card-header">
        <div>
          <div class="text-xs font-semibold text-muted" style="letter-spacing:.06em">${e.code}</div>
          <div class="font-semibold mt-1">${e.name}</div>
        </div>
      </div>
      <div class="card-body flex-col gap-4" style="display:flex">
        <div>
          <div class="text-xs font-medium text-dim mb-2" style="letter-spacing:.06em;text-transform:uppercase">類別</div>
          <div class="chip-group">${cats.map(c=>`<div class="chip ${S.category===c?'active':''}" onclick="setCategory('${c}')">${c}${c!=='全部'?` <span class="text-dim">${b.filter(q=>q.category===c).length}</span>`:''}</div>`).join('')}</div>
        </div>
        <div>
          <div class="text-xs font-medium text-dim mb-2" style="letter-spacing:.06em;text-transform:uppercase">題數</div>
          <div class="chip-group">${[...new Set([10,30,65].map(n=>Math.min(n,mx)))].map(v=>`<div class="chip ${S.questionCount===v?'active':''}" onclick="setCount(${v})">${v}</div>`).join('')}</div>
          <div class="flex mt-3" style="justify-content:flex-end">
            <button class="btn btn-primary btn-sm" onclick="startQuiz()">${I.play} 開始測驗</button>
          </div>
        </div>
      </div>
    </div>

    ${wl.length?`<div class="card mb-4">
      <div class="card-body flex items-center justify-between flex-wrap gap-3">
        <div class="flex items-center gap-3">
          <span style="font-size:1.3rem">${I.book}</span>
          <div>
            <div class="font-medium text-sm">錯題本 · ${wl.length} 題</div>
            <div class="text-xs text-muted">答對會自動移除</div>
          </div>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-primary btn-sm" onclick="startWrongQuiz()">${I.play} 練習錯題</button>
        </div>
      </div>
      ${hasHistory?`<div class="card-footer flex items-center gap-3" style="font-size:.75rem">
        <span class="text-dim">累計作答</span>
        <span style="color:var(--success-fg)">✓ ${weaknesses.reduce((s,w)=>s+w.correct,0)}</span>
        <span style="color:var(--danger-fg)">✗ ${weaknesses.reduce((s,w)=>s+w.total-w.correct,0)}</span>
        <span class="text-dim">${(()=>{const t=weaknesses.reduce((s,w)=>s+w.total,0),c=weaknesses.reduce((s,w)=>s+w.correct,0);return t?Math.round(c/t*100):0})()}%</span>
      </div>`:''}
    </div>`:''}
    <div class="card"><div class="card-body flex items-center justify-between flex-wrap gap-3"><div class="flex items-center gap-3"><span style="font-size:1.3rem">${I.bot}</span><div><div class="font-medium text-sm">AI 弱點補強</div><div class="text-xs text-muted">根據作答記錄生成針對性題目</div></div></div><span class="badge badge-muted">即將推出</span></div></div>`;
}

function renderQuiz(app){
  const q=S.filteredQuestions[S.currentQ],tot=S.filteredQuestions.length;
  const prog=((S.currentQ+(S.answered?1:0))/tot*100).toFixed(1);
  const L=['A','B','C','D','E','F'],e=S.selectedExam;
  const multi=isMultiQ(q);
  const reqCount=multi?q.answer.length:1;
  const modeLabel=S.mode==='wrong'?'錯題':S.mode==='ai'?'AI':'測驗';

  app.innerHTML=`
    <div class="breadcrumb"><a onclick="goHome()">首頁</a><span class="bc-sep">›</span><a onclick="goConfig()">${e.code}</a><span class="bc-sep">›</span><span>${modeLabel}</span></div>

    <div class="flex items-center gap-2 mb-2">
      <span class="text-xs text-dim">${S.currentQ+1} / ${tot}</span>
      <div style="flex:1"></div>
      <span class="text-xs" style="color:var(--success-fg)">✓ ${S.correctCount}</span>
      <span class="text-xs" style="color:var(--danger-fg)">✗ ${S.wrongCount}</span>
      <span class="text-xs" style="color:#f59e0b;display:inline-flex;align-items:center;gap:2px">⚠ ${S.skipCount}</span>
    </div>
    <div class="progress mb-3"><div class="progress-bar" style="width:${prog}%"></div></div>

    <div class="card mb-3">
      <div class="card-header flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-xs text-dim font-semibold">Q${S.currentQ+1}</span>
          <span class="badge badge-muted">${q.category}</span>
          ${S.mode==='ai'?'<span class="badge badge-purple">AI</span>':''}
        </div>
        <div class="flex items-center gap-2">
          ${!S.answered?`<button class="btn btn-sm btn-skip" onclick="skipToWrong()">⚠ 跳過</button>`:''}
        </div>
      </div>
      <div class="card-body">
        <div class="text-sm mb-4" style="line-height:1.7">${q.question}</div>
        <div class="flex-col gap-2" style="display:flex">
          ${q.options.map((o,i)=>{
            let cls='opt'+(multi&&!S.answered?'':' opt-radio');
            if(multi&&!S.answered&&S.selectedOpts.includes(i)) cls+=' opt-selected';
            if(S.answered){
              cls+=' opt-disabled';
              if(multi){
                if(q.answer.includes(i)) cls+=' opt-correct';
                else if(S.selectedOpts.includes(i)&&!q.answer.includes(i)) cls+=' opt-wrong';
              }else{
                if(i===q.answer) cls+=' opt-correct';
                else if(i===S.selectedOpt&&i!==q.answer) cls+=' opt-wrong';
              }
            }
            let indicator='';
            if(S.answered){
              if((multi&&q.answer.includes(i))||(!multi&&i===q.answer)) indicator='✓';
              else if((multi&&S.selectedOpts.includes(i))||(!multi&&i===S.selectedOpt)) indicator='✗';
            }else if(multi&&S.selectedOpts.includes(i)){
              indicator='✓';
            }
            return`<div class="${cls}" onclick="selectOption(${i})">
              <div class="opt-indicator">${indicator}</div>
              <div class="opt-label"><span class="opt-letter">${L[i]}.</span>${o}</div>
            </div>`;
          }).join('')}
        </div>
        ${multi&&!S.answered?`<button class="btn btn-primary w-full mt-3" onclick="submitMulti()" ${S.selectedOpts.length!==reqCount?'disabled':''}>確認答案（${S.selectedOpts.length}/${reqCount}）</button>`:''}
        ${S.answered?`<div class="explanation"><h4>${I.info} 解析</h4><p>${q.explanation}</p></div>`:''}
        <div class="flex items-center mt-4" style="padding-top:12px;border-top:1px solid var(--border)">
          ${S.currentQ>0?`<button class="btn btn-ghost btn-sm" onclick="prevQuestion()">${I.arrowLeft} 上一題</button>`:''}
          <div style="flex:1"></div>
          ${S.answered?`<button class="btn btn-ghost btn-sm" onclick="nextQuestion()">${S.currentQ+1>=tot?'查看結果':'下一題 '+I.arrowRight}</button>`:''}
        </div>
      </div>
    </div>`;
}

function renderResult(app){
  const tot=S.filteredQuestions.length,pct=Math.round(S.correctCount/tot*100),pass=pct>=70,e=S.selectedExam;
  const wl=loadWrong(e.id);
  const isWrongMode=S.mode==='wrong';
  const wrongStillLeft=wl.length;

  app.innerHTML=`
    <div class="breadcrumb"><a onclick="goHome()">首頁</a><span class="bc-sep">›</span><span>${e.code} · 結果</span></div>
    <div class="card mb-4">
      <div class="card-body text-center" style="padding:32px 20px">
        <div class="score-ring ${pass?'pass':'fail'}"><div class="pct">${pct}%</div><div class="sub">${S.correctCount} / ${tot}</div></div>
        <div class="font-semibold text-lg">${pass?I.trophy+' 恭喜通過！':I.flame+' 繼續加油！'}</div>
        <p class="text-sm text-muted mt-2">${isWrongMode
          ?(wrongStillLeft>0?`錯題本還剩 ${wrongStillLeft} 題待加強`:'所有錯題都答對了！')
          :S.mode==='ai'
          ?(pass?'AI 出題表現優異！':'建議再練一輪加強弱項')
          :(pass?'已達 70% 通過門檻':'通過門檻為 70%，再多練習')}</p>
        <div class="flex gap-2 justify-center mt-4 flex-wrap">
          ${isWrongMode&&wrongStillLeft>0?`<button class="btn btn-primary btn-sm" onclick="startWrongQuiz()">再練錯題</button>`:''}
          
          <button class="btn btn-primary btn-sm" onclick="startQuiz()">${I.refresh} 全新測驗</button>
          <button class="btn btn-outline btn-sm" onclick="goConfig()">設定</button>
          <button class="btn btn-ghost btn-sm" onclick="goHome()">首頁</button>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><span class="font-medium text-sm">答題回顧</span></div>
      <div class="review">
        ${S.answers.map((a,i)=>{
          const qq=a.question;const ml=Array.isArray(qq.answer);
          const correctAns=ml?qq.answer.map(x=>qq.options[x]).join('、'):qq.options[qq.answer];
          const skipped=a.skipped;
          const userAns=skipped?'跳過':ml?(Array.isArray(a.selected)?a.selected.map(x=>qq.options[x]).join('、'):''):qq.options[a.selected];
          const badgeCls=a.correct?'badge-success':skipped?'badge-muted':'badge-danger';
          const badgeText=a.correct?'✓ 正確':skipped?'跳過':'✗ 錯誤';
          return`<div class="review-item">
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs text-dim">Q${i+1} · ${qq.category}</span>
              <span class="badge ${badgeCls}">${badgeText}</span>
            </div>
            <div class="text-sm mb-1" style="line-height:1.5">${qq.question.length>80?qq.question.slice(0,80)+'...':qq.question}</div>
            <div class="text-xs text-muted">${!a.correct?`<span style="color:var(--danger-fg)">你：${userAns}</span> · `:''}正確：${correctAns}</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

render();
preloadAll();