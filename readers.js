const state={chapters:[],currentChapter:0,toc:[],bookmarks:[],fontSize:18,lightMode:false,ttsChapter:0,ttsQueue:[],ttsPos:0,ttsPlaying:false,ttsPaused:false};
function toast(msg,dur=2200){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),dur);}
function loading(on){document.getElementById('loadingBar').classList.toggle('active',on);}
document.getElementById('fileInput').addEventListener('change',e=>{if(e.target.files[0])loadEpub(e.target.files[0]);});
const readerArea=document.getElementById('readerArea');
readerArea.addEventListener('dragover',e=>{e.preventDefault();});
readerArea.addEventListener('drop',e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f&&f.name.endsWith('.epub'))loadEpub(f);else toast('EPUB FILES ONLY');});
async function loadEpub(file){
  loading(true);toast('LOADING EPUB...');
  try{
    const zip=await JSZip.loadAsync(file);
    const containerXml=await zip.file('META-INF/container.xml').async('text');
    const rootfilePath=containerXml.match(/full-path="([^"]+)"/)?.[1];
    if(!rootfilePath)throw new Error('Cannot find rootfile');
    const opfText=await zip.file(rootfilePath).async('text');
    const opfDir=rootfilePath.includes('/')?rootfilePath.split('/').slice(0,-1).join('/')+'/' :'';
    const parser=new DOMParser();
    const opfDoc=parser.parseFromString(opfText,'application/xml');
    const title=opfDoc.querySelector('title')?.textContent||file.name.replace('.epub','');
    const author=opfDoc.querySelector('creator')?.textContent||'Unknown Author';
    document.getElementById('metaTitle').textContent=title;
    document.getElementById('metaAuthor').textContent=author;
    document.getElementById('bookMeta').style.display='block';
    document.getElementById('topbarInfo').innerHTML='<span>'+title+'</span> &mdash; '+author;
    const items={};
    opfDoc.querySelectorAll('manifest item').forEach(item=>{items[item.getAttribute('id')]={href:opfDir+item.getAttribute('href'),mediaType:item.getAttribute('media-type')};});
    const spineItems=[...opfDoc.querySelectorAll('spine itemref')].map(i=>i.getAttribute('idref'));
    const htmlItems=spineItems.map(id=>items[id]).filter(i=>i&&i.mediaType?.includes('html'));
    const coverId=opfDoc.querySelector('meta[name="cover"]')?.getAttribute('content');
    if(coverId&&items[coverId]){try{const imgData=await zip.file(items[coverId].href)?.async('base64');if(imgData){const mt=items[coverId].mediaType||'image/jpeg';document.getElementById('bookCover').innerHTML='<img src="data:'+mt+';base64,'+imgData+'" alt="Cover">';}}catch(e){}}
    state.chapters=[];state.toc=[];let wordCount=0;
    for(let idx=0;idx<htmlItems.length;idx++){
      const item=htmlItems[idx];
      try{
        let html=await zip.file(item.href)?.async('text');
        if(!html)continue;
        const imgRe=/(?:src|href)="([^"]+\.(png|jpg|jpeg|gif|svg|webp))"/gi;
        for(const m of [...html.matchAll(imgRe)]){const imgPath=resolveRelPath(item.href,m[1]);const imgFile=zip.file(imgPath);if(imgFile){const b64=await imgFile.async('base64');const mt=m[2]==='svg'?'image/svg+xml':'image/'+m[2];html=html.replace(m[0],m[0].replace(m[1],'data:'+mt+';base64,'+b64));}}
        const doc=parser.parseFromString(html,'text/html');
        const body=doc.body;
        body.querySelectorAll('script,style,link').forEach(el=>el.remove());
        const words=(body.textContent||'').split(/\s+/).filter(Boolean).length;
        wordCount+=words;
        const chTitle=doc.querySelector('h1,h2,h3,title')?.textContent?.trim()||'Chapter '+(idx+1);
        state.chapters.push({html:body.innerHTML,title:chTitle});
        state.toc.push({title:chTitle,index:idx});
      }catch(e){}
    }
    state.currentChapter=0;state.bookmarks=[];
    buildTOC();renderChapter(0);
    document.getElementById('statChap').textContent=state.chapters.length;
    document.getElementById('statWpm').textContent=wordCount.toLocaleString();
    loading(false);toast('LOADED — '+state.chapters.length+' CHAPTERS');
  }catch(err){loading(false);toast('ERROR: '+err.message);console.error(err);}
}
function resolveRelPath(base,rel){if(rel.startsWith('data:')||rel.startsWith('http'))return rel;const parts=base.split('/');parts.pop();rel.split('/').forEach(p=>{if(p==='..')parts.pop();else if(p!=='.')parts.push(p);});return parts.join('/');}
function renderChapter(idx){
  if(!state.chapters.length)return;
  idx=Math.max(0,Math.min(idx,state.chapters.length-1));
  state.currentChapter=idx;
  _ttsLastCharIdx=0;
  const area=document.getElementById('readerArea');
  area.innerHTML='<div class="book-content" id="bookContent"><div class="chapter-start"></div>'+state.chapters[idx].html+'</div>';
  area.scrollTop=0;
  document.querySelectorAll('.toc-item').forEach((el,i)=>el.classList.toggle('active',i===idx));
  updateProgress();
  area.addEventListener('scroll',updateProgress,{passive:true});
}
function buildTOC(){const list=document.getElementById('tocList');list.innerHTML='';state.toc.forEach((item,i)=>{const li=document.createElement('li');li.className='toc-item'+(i===0?' active':'');li.textContent=item.title;li.addEventListener('click',()=>{renderChapter(i);closeSidebars();});list.appendChild(li);});}
function updateProgress(){const area=document.getElementById('readerArea');const scrollable=area.scrollHeight-area.clientHeight;const chapPct=scrollable>0?area.scrollTop/scrollable:0;const globalPct=state.chapters.length?((state.currentChapter+chapPct)/state.chapters.length)*100:0;document.getElementById('progressFill').style.width=globalPct+'%';document.getElementById('pageInfo').textContent=Math.round(globalPct)+'%';document.getElementById('statPct').textContent=Math.round(globalPct)+'%';}
function nextChapter(){if(state.currentChapter<state.chapters.length-1){renderChapter(state.currentChapter+1);toast('NEXT CHAPTER');}else toast('END OF BOOK');}
function prevChapter(){if(state.currentChapter>0){renderChapter(state.currentChapter-1);toast('PREV CHAPTER');}else toast('FIRST CHAPTER');}
function seekTo(e){if(!state.chapters.length)return;const line=document.getElementById('progressLine');renderChapter(Math.floor((e.offsetX/line.clientWidth)*state.chapters.length));}
document.addEventListener('keydown',e=>{if(e.target.tagName==='INPUT')return;if(e.key==='ArrowRight'||e.key==='ArrowDown')nextChapter();if(e.key==='ArrowLeft'||e.key==='ArrowUp')prevChapter();});
function changeFontSize(d){state.fontSize=Math.max(12,Math.min(28,state.fontSize+d));document.querySelectorAll('.book-content p,.book-content li').forEach(el=>el.style.fontSize=state.fontSize+'px');toast('FONT: '+state.fontSize+'PX');}
function toggleTheme(){state.lightMode=!state.lightMode;document.body.classList.toggle('light-mode',state.lightMode);document.getElementById('themeBtn').textContent=state.lightMode?'🌑 DARK':'☀ LIGHT';toast(state.lightMode?'LIGHT MODE':'DARK MODE');}
function loadBg(e){
  const file=e.target.files[0];
  if(!file)return;
  const reader=new FileReader();
  reader.onload=function(ev){
    const area=document.getElementById('readerArea');
    area.style.backgroundImage='url('+ev.target.result+')';
    area.style.backgroundSize='cover';
    area.style.backgroundPosition='center';
    area.style.backgroundRepeat='no-repeat';
    updateBgOpacity();
    toast('BACKGROUND SET');
  };
  reader.readAsDataURL(file);
}
function clearBg(){
  const area=document.getElementById('readerArea');
  area.style.backgroundImage='';
  area.style.backgroundSize='';
  area.style.backgroundPosition='';
  area.style.backgroundRepeat='';
  area.style.backgroundColor='';
  document.querySelectorAll('.bg-color-btn').forEach(b=>b.classList.remove('active'));
  toast('BACKGROUND CLEARED');
}
function setBgColor(color){
  const area=document.getElementById('readerArea');
  area.style.backgroundImage='';
  area.style.backgroundSize='';
  area.style.backgroundPosition='';
  area.style.backgroundRepeat='';
  area.style.backgroundColor=color;
  document.querySelectorAll('.bg-color-btn').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.bg-preset-btn').forEach(b=>b.classList.remove('active'));
  event.target.classList.add('active');
  toast('COLOR SET');
}
function setBgPreset(src){
  const area=document.getElementById('readerArea');
  area.style.backgroundColor='';
  area.style.backgroundImage='url('+src+')';
  area.style.backgroundSize='cover';
  area.style.backgroundPosition='center';
  area.style.backgroundRepeat='no-repeat';
  document.querySelectorAll('.bg-color-btn').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.bg-preset-btn').forEach(b=>b.classList.remove('active'));
  event.currentTarget.classList.add('active');
  updateBgOpacity();
  toast('BACKGROUND SET');
}
function updateBgOpacity(){
  const val=document.getElementById('bgOpacity').value;
  document.getElementById('bgOpacityVal').textContent=val+'%';
  const area=document.getElementById('readerArea');
  area.style.opacity=1-val/200;
}
document.getElementById('bgOpacity').addEventListener('input',updateBgOpacity);
document.getElementById('textOpacity').addEventListener('input',function(){
  const val=this.value;
  document.getElementById('textOpacityVal').textContent=val+'%';
  const content=document.querySelector('.book-content');
  if(content)content.style.opacity=val/100;
});
document.getElementById('textBrightness').addEventListener('input',function(){
  const val=this.value;
  document.getElementById('textBrightnessVal').textContent=val+'%';
  const content=document.querySelector('.book-content');
  if(content)content.style.filter='brightness('+val/100+')';
});
function toggleSidebar(side){
  const left=document.querySelector('.sidebar-left');
  const right=document.querySelector('.sidebar-right');
  const overlay=document.getElementById('mobileOverlay');
  if(side==='left'){
    left.classList.toggle('open');
    right.classList.remove('open');
  }else{
    right.classList.toggle('open');
    left.classList.remove('open');
  }
  overlay.classList.toggle('show',left.classList.contains('open')||right.classList.contains('open'));
}
function closeSidebars(){
  document.querySelector('.sidebar-left').classList.remove('open');
  document.querySelector('.sidebar-right').classList.remove('open');
  document.getElementById('mobileOverlay').classList.remove('show');
}
function addBookmark(){if(!state.chapters.length)return toast('NO BOOK LOADED');const area=document.getElementById('readerArea');const scrollable=area.scrollHeight-area.clientHeight;const pct=scrollable>0?Math.round(area.scrollTop/scrollable*100):0;const globalPct=Math.round(((state.currentChapter+pct/100)/state.chapters.length)*100);state.bookmarks.push({chapIdx:state.currentChapter,title:state.chapters[state.currentChapter].title,pct:globalPct});renderBookmarks();toast('BOOKMARK ADDED ★');}
function renderBookmarks(){const list=document.getElementById('bookmarkList');if(!state.bookmarks.length){list.innerHTML='<div style="font-size:0.65rem;color:var(--text-dim)">No bookmarks yet.</div>';return;}list.innerHTML=state.bookmarks.map(bk=>'<div class="bookmark-item" onclick="renderChapter('+bk.chapIdx+')"><div class="bk-title">★ '+bk.title+'</div><div class="bk-pct">'+bk.pct+'% through</div></div>').join('');}
let searchTimeout;
document.getElementById('searchInput').addEventListener('input',e=>{clearTimeout(searchTimeout);searchTimeout=setTimeout(()=>doSearch(e.target.value.trim()),300);});
function doSearch(query){const results=document.getElementById('searchResults');if(!query||query.length<2){results.innerHTML='';return;}if(!state.chapters.length)return;const matches=[];const re=new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi');state.chapters.forEach((chap,idx)=>{const doc=new DOMParser().parseFromString(chap.html,'text/html');const text=doc.body.textContent||'';const m=text.match(re);if(m){const pos=text.search(re);const snippet=text.slice(Math.max(0,pos-30),pos+60).replace(/\n/g,' ');matches.push({idx,title:chap.title,snippet:snippet.replace(re,w=>'<mark>'+w+'</mark>'),count:m.length});}});if(!matches.length){results.innerHTML='<div style="font-size:0.65rem;color:var(--text-dim);padding:6px 0">No results.</div>';return;}results.innerHTML=matches.slice(0,8).map(m=>'<div class="search-result" onclick="renderChapter('+m.idx+')"><div style="color:var(--cyan);font-size:0.6rem;letter-spacing:2px;margin-bottom:2px">'+m.title+' ('+m.count+' hit'+(m.count>1?'s':'')+')</div>...'+m.snippet+'...</div>').join('');}
// ══════════════════════════════════════════
//  VOIDREAD — TTS ENGINE (Microsoft Voices)
// ══════════════════════════════════════════
const tts = {
  synth: window.speechSynthesis,
  voices: [],
  currentUtterance: null,
  autoNext: true,
};

// ── Voice loader ──
function ttsLoadVoices() {
  let all = tts.synth.getVoices();
  if (!all.length) return;
  tts.voices = all;
  const sel = document.getElementById('ttsVoiceSelect');
  sel.innerHTML = '';

  // Separate Microsoft voices first, then others
  const ms = all.filter(v => v.name.toLowerCase().includes('microsoft'));
  const rest = all.filter(v => !v.name.toLowerCase().includes('microsoft'));
  const sorted = [...ms, ...rest];

  sorted.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.name;
    const isMsOnline = v.name.toLowerCase().includes('microsoft') && !v.localService;
    const tag = v.name.toLowerCase().includes('microsoft') ? '🔷 ' : '◽ ';
    opt.textContent = tag + v.name + (v.lang ? ' [' + v.lang + ']' : '') + (isMsOnline ? ' ★' : '');
    opt.selected = ms.length > 0 && v === ms[0]; // auto-select first Microsoft voice
    sel.appendChild(opt);
  });

  ttsSetStatus('READY — ' + ms.length + ' MICROSOFT VOICES');
}

window.speechSynthesis.onvoiceschanged = ttsLoadVoices;
ttsLoadVoices();

// ── Slider listeners ──
document.getElementById('ttsRate').addEventListener('input', function() {
  document.getElementById('ttsRateVal').textContent = parseFloat(this.value).toFixed(1) + '×';
});
document.getElementById('ttsPitch').addEventListener('input', function() {
  document.getElementById('ttsPitchVal').textContent = parseFloat(this.value).toFixed(1);
});

// ── Build a clean text queue from the current chapter ──
function ttsBuildQueue(chapIdx) {
  const chap = state.chapters[chapIdx];
  if (!chap) return [];
  const doc = new DOMParser().parseFromString(chap.html, 'text/html');
  // Remove script/style
  doc.querySelectorAll('script,style').forEach(el => el.remove());

  const segments = [];
  const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const t = node.textContent.replace(/\s+/g, ' ').trim();
    if (t.length > 1) segments.push(t);
  }
  // Join into sentences/chunks ≤200 chars for smooth playback
  const chunks = [];
  let buf = '';
  segments.forEach(seg => {
    const sentences = seg.match(/[^.!?]+[.!?]*/g) || [seg];
    sentences.forEach(s => {
      s = s.trim();
      if (!s) return;
      if ((buf + ' ' + s).length > 220) {
        if (buf) chunks.push(buf.trim());
        buf = s;
      } else {
        buf = buf ? buf + ' ' + s : s;
      }
    });
  });
  if (buf.trim()) chunks.push(buf.trim());
  return chunks;
}

// ── Highlight word in reader using boundary events ──
function ttsClearHighlight() {
  document.querySelectorAll('.tts-word-highlight').forEach(el => {
    el.replaceWith(document.createTextNode(el.textContent));
  });
}

// ── Core utterance factory ──
function ttsMakeUtterance(text, onEnd, onBoundary) {
  const u = new SpeechSynthesisUtterance(text);
  const sel = document.getElementById('ttsVoiceSelect');
  const voiceName = sel.value;
  const voice = tts.voices.find(v => v.name === voiceName);
  if (voice) u.voice = voice;
  u.rate  = parseFloat(document.getElementById('ttsRate').value);
  u.pitch = parseFloat(document.getElementById('ttsPitch').value);

  u.onboundary = (e) => {
    if (e.name === 'word' && onBoundary) onBoundary(e.charIndex, e.charLength || 0, text);
  };
  u.onend = () => { if (onEnd) onEnd(); };
  u.onerror = (e) => {
    if (e.error !== 'interrupted') ttsSetStatus('ERROR: ' + e.error);
    if (onEnd) onEnd();
  };
  return u;
}

// ── Speak a queue of chunks, chapter by chapter ──
function ttsPlayQueue(chunks, chapIdx, startChunkIdx) {
  state.ttsChapter = chapIdx;
  state.ttsQueue = chunks;
  state.ttsPos = startChunkIdx || 0;

  if (!chunks.length) {
    if (tts.autoNext && chapIdx < state.chapters.length - 1) {
      const next = chapIdx + 1;
      renderChapter(next);
      ttsSetStatus('CHAPTER ' + (next + 1) + ' — LOADING...');
      setTimeout(() => {
        const nc = ttsBuildQueue(next);
        ttsPlayQueue(nc, next, 0);
      }, 300);
    } else {
      ttsStop();
      ttsSetStatus('FINISHED ✓');
    }
    return;
  }

  ttsSpeakCurrent();
}

function ttsSpeakCurrent() {
  if (!state.ttsQueue.length || !state.ttsPlaying) return;
  if (state.ttsPos >= state.ttsQueue.length) {
    if (tts.autoNext && state.ttsChapter < state.chapters.length - 1) {
      const next = state.ttsChapter + 1;
      renderChapter(next);
      ttsSetStatus('CHAPTER ' + (next + 1) + ' — LOADING...');
      setTimeout(() => {
        const nc = ttsBuildQueue(next);
        ttsPlayQueue(nc, next, 0);
      }, 400);
    } else {
      ttsStop();
      ttsSetStatus('FINISHED ✓');
    }
    return;
  }

  const chunk = state.ttsQueue[state.ttsPos];
  ttsSetStatus('SPEAKING — CH.' + (state.ttsChapter + 1) + '  [' + (state.ttsPos + 1) + '/' + state.ttsQueue.length + ']');

  const u = ttsMakeUtterance(
    chunk,
    () => { state.ttsPos++; ttsSpeakCurrent(); },
    (charIdx, charLen, fullText) => {
      ttsHighlightWord(charIdx, charLen, fullText);
    }
  );
  tts.currentUtterance = u;
  tts.synth.speak(u);
}

// ── Highlight word in visible reader ──
let _ttsLastCharIdx = 0;

function ttsHighlightWord(charIdx, charLen, fullText) {
  if (charLen < 1) return;
  const word = fullText.substr(charIdx, charLen).trim();
  if (!word || word.length < 2) return;

  ttsClearHighlight();
  const area = document.getElementById('readerArea');
  if (!area) return;

  // Get all text content and find all occurrences of the word
  const content = area.textContent || '';
  const wordLower = word.toLowerCase();
  const contentLower = content.toLowerCase();
  
  // Find occurrences after the last position
  let searchFrom = _ttsLastCharIdx;
  let pos = contentLower.indexOf(wordLower, searchFrom);
  
  // If not found after last position, wrap around
  if (pos === -1) {
    pos = contentLower.indexOf(wordLower, 0);
  }
  
  if (pos === -1) return;
  
  _ttsLastCharIdx = pos + word.length;

  // Walk text nodes to find and highlight this position
  const walker = document.createTreeWalker(area, NodeFilter.SHOW_TEXT);
  let charCount = 0;
  let node;
  
  while ((node = walker.nextNode())) {
    const nodeLen = node.textContent.length;
    if (charCount + nodeLen > pos) {
      const offset = pos - charCount;
      const nodeText = node.textContent;
      const matchIdx = nodeText.toLowerCase().indexOf(wordLower, offset > 0 ? offset - 2 : 0);
      
      if (matchIdx !== -1 && (matchIdx === offset || matchIdx === offset - 1 || matchIdx === offset + 1)) {
        const span = document.createElement('span');
        span.className = 'tts-word-highlight';
        span.textContent = nodeText.substr(matchIdx, word.length);
        const after = node.splitText(matchIdx);
        after.splitText(word.length);
        after.parentNode.replaceChild(span, after);
        span.scrollIntoView({behavior:'smooth', block:'nearest'});
        return;
      }
    }
    charCount += nodeLen;
  }
  
  // Fallback: search from beginning
  _ttsLastCharIdx = 0;
  const walker2 = document.createTreeWalker(area, NodeFilter.SHOW_TEXT);
  charCount = 0;
  while ((node = walker2.nextNode())) {
    const nodeLen = node.textContent.length;
    const idx = node.textContent.toLowerCase().indexOf(wordLower);
    if (idx !== -1) {
      const span = document.createElement('span');
      span.className = 'tts-word-highlight';
      span.textContent = node.textContent.substr(idx, word.length);
      const after = node.splitText(idx);
      after.splitText(word.length);
      after.parentNode.replaceChild(span, after);
      span.scrollIntoView({behavior:'smooth', block:'nearest'});
      _ttsLastCharIdx = charCount + idx + word.length;
      break;
    }
    charCount += nodeLen;
  }
}

// ── Public controls ──
function ttsPlay() {
  if (state.ttsPaused && tts.synth.paused) {
    tts.synth.resume();
    state.ttsPlaying = true;
    state.ttsPaused = false;
    document.getElementById('ttsPlayBtn').classList.add('active');
    document.getElementById('ttsPauseBtn').classList.remove('active');
    ttsSetStatus('RESUMED', 'speaking');
    return;
  }
  if (state.ttsPlaying) return;

  if (!state.chapters.length) { ttsSetStatus('LOAD A BOOK FIRST'); return; }

  state.ttsPlaying = true;
  state.ttsPaused = false;
  tts.synth.cancel();

  document.getElementById('ttsPlayBtn').classList.add('active');
  document.getElementById('ttsPauseBtn').classList.remove('active');

  const chapIdx = state.currentChapter;
  const chunks = ttsBuildQueue(chapIdx);
  ttsPlayQueue(chunks, chapIdx, 0);
}

function ttsPause() {
  if (tts.synth.speaking && !tts.synth.paused) {
    tts.synth.pause();
    state.ttsPaused = true;
    state.ttsPlaying = false;
    document.getElementById('ttsPlayBtn').classList.remove('active');
    document.getElementById('ttsPauseBtn').classList.add('active');
    ttsSetStatus('PAUSED', 'paused');
  }
}

function ttsStop() {
  state.ttsPlaying = false;
  state.ttsPaused = false;
  state.ttsQueue = [];
  state.ttsPos = 0;
  tts.synth.cancel();
  ttsClearHighlight();
  document.getElementById('ttsPlayBtn').classList.remove('active');
  document.getElementById('ttsPauseBtn').classList.remove('active');
  ttsSetStatus('STOPPED');
}

function ttsGoToChapter() {
  const input = document.getElementById('ttsChapterInput');
  let idx = parseInt(input.value, 10) - 1;
  if (isNaN(idx)) return;
  idx = Math.max(0, Math.min(idx, state.chapters.length - 1));
  ttsStop();
  renderChapter(idx);
  toast('TTS → CHAPTER ' + (idx + 1));
  setTimeout(() => ttsPlay(), 300);
}

function ttsSetStatus(msg, cls) {
  const el = document.getElementById('ttsStatus');
  el.textContent = msg;
  el.className = 'tts-status' + (cls ? ' ' + cls : '');
}

// Keyboard shortcut: Space = play/pause TTS
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (e.code === 'Space') {
    e.preventDefault();
    if (state.ttsPlaying) ttsPause();
    else ttsPlay();
  }
  if (e.code === 'KeyS' && !e.ctrlKey) ttsStop();
});

// Stop TTS when chapter changes via TOC/nav
const _origRenderChapter = renderChapter;
// patch renderChapter to stop TTS on manual navigation
// (ttsGoToChapter handles its own stop)

const colors=['#ff0033','#ffe600','#00f5ff','#39ff14','#ff6a00'];
const ss=document.createElement('style');ss.textContent='@keyframes spark{from{transform:translate(0,0) scale(1);opacity:1}to{transform:translate(var(--dx),var(--dy)) scale(0);opacity:0}}';document.head.appendChild(ss);
document.addEventListener('click',e=>{if(e.target.tagName==='INPUT'||e.target.tagName==='BUTTON')return;for(let i=0;i<5;i++){const s=document.createElement('div');const angle=(i/5)*Math.PI*2;const dist=20+Math.random()*30;s.style.cssText='position:fixed;left:'+e.clientX+'px;top:'+e.clientY+'px;width:3px;height:3px;background:'+colors[i%5]+';pointer-events:none;z-index:10000;border-radius:50%;--dx:'+Math.cos(angle)*dist+'px;--dy:'+Math.sin(angle)*dist+'px;animation:spark 0.4s ease-out forwards;';document.body.appendChild(s);setTimeout(()=>s.remove(),400);}});

// ══════════════════════════════════════════
//  FLOATING STICKER REACTOR
// ══════════════════════════════════════════
const stickerFiles=[
  'cat/Cat Blush Sticker by Capoo.gif',
  'cat/Cat Kitten Sticker.gif',
  'cat/Cat Shining Sticker by Capoo.gif',
  'cat/Cat Sleeping Sticker.gif',
  'cat/Cat Smh Sticker by ACHTUNG.gif',
  'cat/cat Sticker by Capoo.gif',
  'cat/Gesturing Excuse Me Sticker by Justin (1).gif',
  'cat/Hello Kitty Cat Sticker.gif',
  'cat/In Love Kiss Sticker by MYAOWL.gif'
];

function spawnSticker(){
  const reader=document.getElementById('readerArea');
  if(!reader||!state.chapters.length)return;
  const el=document.createElement('div');
  el.className='cat-slide-sticker';
  const img=document.createElement('img');
  img.src=stickerFiles[Math.floor(Math.random()*stickerFiles.length)];
  el.appendChild(img);
  const rect=reader.getBoundingClientRect();
  const x=Math.random()*(rect.width-80)+rect.left+40;
  const y=rect.bottom-80;
  el.style.left=x+'px';
  el.style.top=y+'px';
  el.style.animationDuration=(5+Math.random()*1)+'s';
  document.body.appendChild(el);
  setTimeout(()=>el.remove(),6500);
}

function spawnStickerPair(){
  spawnSticker();
  setTimeout(spawnSticker,300+Math.random()*400);
}

setInterval(spawnStickerPair,60000);
setTimeout(spawnStickerPair,3000);

// ══════════════════════════════════════════
//  READING COMPANION STICKER PACK
// ══════════════════════════════════════════
const defaultStickers=[
  'stick/Book Reading Sticker.gif',
  'stick/Hacking Cyber Attack Sticker by Cyberpunk Edgerunners.gif',
  'stick/Mood Weekday Sticker.gif',
  'stick/Netflix Breathe Sticker by Cyberpunk Edgerunners.gif',
  'stick/sleeping sleepy STICKER by imoji.gif',
  'stick/Sleepy Good Night Sticker.gif',
  'stick/Test Read Sticker by yomoyeah.gif',
  'stick/Working Digital Art Sticker.gif'
];

let customStickers=JSON.parse(localStorage.getItem('customStickers')||'[]');

function initStickerSelector(){
  const selector=document.getElementById('stickerSelector');
  if(!selector)return;
  selector.innerHTML='';
  const allStickers=[...defaultStickers,...customStickers.map(s=>s.data)];
  allStickers.forEach(src=>{
    const item=document.createElement('div');
    item.className='sticker-select-item';
    item.innerHTML='<img src="'+src+'">';
    item.onclick=function(){sendCompanionSticker(src);};
    selector.appendChild(item);
  });
}

function sendCompanionSticker(src){
  const el=document.createElement('div');
  el.className='floating-sticker';
  const img=document.createElement('img');
  img.src=src;
  el.appendChild(img);
  const closeBtn=document.createElement('button');
  closeBtn.className='sticker-close';
  closeBtn.textContent='✕';
  closeBtn.onclick=function(e){e.stopPropagation();el.remove();};
  el.appendChild(closeBtn);
  const x=Math.random()*(window.innerWidth-120)+20;
  const y=Math.random()*(window.innerHeight-200)+100;
  el.style.left=x+'px';
  el.style.top=y+'px';
  makeDraggable(el);
  document.body.appendChild(el);
}

function makeDraggable(el){
  let isDragging=false,startX,startY,origX,origY;
  el.addEventListener('mousedown',function(e){
    if(e.target.classList.contains('sticker-close'))return;
    isDragging=true;
    startX=e.clientX;
    startY=e.clientY;
    origX=el.offsetLeft;
    origY=el.offsetTop;
    el.style.zIndex='10001';
    e.preventDefault();
  });
  document.addEventListener('mousemove',function(e){
    if(!isDragging)return;
    el.style.left=(origX+e.clientX-startX)+'px';
    el.style.top=(origY+e.clientY-startY)+'px';
  });
  document.addEventListener('mouseup',function(){
    isDragging=false;
    el.style.zIndex='9000';
  });
  el.addEventListener('touchstart',function(e){
    if(e.target.classList.contains('sticker-close'))return;
    isDragging=true;
    startX=e.touches[0].clientX;
    startY=e.touches[0].clientY;
    origX=el.offsetLeft;
    origY=el.offsetTop;
    el.style.zIndex='10001';
  },{passive:true});
  document.addEventListener('touchmove',function(e){
    if(!isDragging)return;
    el.style.left=(origX+e.touches[0].clientX-startX)+'px';
    el.style.top=(origY+e.touches[0].clientY-startY)+'px';
  },{passive:true});
  document.addEventListener('touchend',function(){
    isDragging=false;
    el.style.zIndex='9000';
  });
}

function addCustomSticker(e){
  const files=e.target.files;
  for(const file of files){
    const reader=new FileReader();
    reader.onload=function(ev){
      const sticker={name:file.name,data:ev.target.result};
      customStickers.push(sticker);
      localStorage.setItem('customStickers',JSON.stringify(customStickers));
      renderCustomStickers();
      initStickerSelector();
      toast('STICKER ADDED');
    };
    reader.readAsDataURL(file);
  }
}

function renderCustomStickers(){
  const list=document.getElementById('customStickersList');
  list.innerHTML='';
  customStickers.forEach((sticker,i)=>{
    const div=document.createElement('div');
    div.className='custom-sticker-item';
    div.innerHTML='<img src="'+sticker.data+'"><button class="remove-sticker" onclick="removeCustomSticker('+i+',event)">✕</button>';
    div.onclick=function(e){if(!e.target.classList.contains('remove-sticker'))sendCompanionSticker(sticker.data);};
    list.appendChild(div);
  });
}

function removeCustomSticker(idx,e){
  e.stopPropagation();
  customStickers.splice(idx,1);
  localStorage.setItem('customStickers',JSON.stringify(customStickers));
  renderCustomStickers();
  initStickerSelector();
  toast('STICKER REMOVED');
}

function clearCustomStickers(){
  customStickers=[];
  localStorage.removeItem('customStickers');
  renderCustomStickers();
  initStickerSelector();
  toast('CUSTOM STICKERS CLEARED');
}

renderCustomStickers();
initStickerSelector();