// ==========================
// Player Variables
// ==========================
const container = document.getElementById("playerContainer");
const video = document.getElementById("videoPlayer");
const sidebar = document.getElementById("sidebar");
const channelList = document.getElementById("channelList");
const hint = document.getElementById("hint");
const overlay = document.getElementById("overlay");

let channels = [], currentIndex = 0;
let hls = null, shakaPlayer = null;
let preloaded = {};

video.controls = false;

setTimeout(() => hint.classList.add("fade"), 4000);
setTimeout(() => hint.remove(), 5000);

// ==========================
// Playlist Loader
// ==========================
async function loadPlaylist(url){
  try {
    const res = await fetch(url);
    const text = await res.text();
    const lines = text.split("\n");
    let name = "";
    lines.forEach(line => {
      if(line.startsWith("#EXTINF")) name = line.split(",").pop().trim();
      else if(line && !line.startsWith("#")) channels.push({name:name||`Channel ${channels.length+1}`, url:line.trim()});
    });
    renderChannels();
    playChannel(0);
  } catch(err) {
    console.error("Playlist load error:", err);
    alert("Unable to load playlist.");
  }
}

function renderChannels(){
  channelList.innerHTML = "";
  channels.forEach((ch,i)=>{
    const li=document.createElement("li");
    li.textContent=ch.name;
    if(i===currentIndex) li.classList.add("highlight");
    li.onclick=()=>{ playChannel(i); toggleSidebar(false); };
    channelList.appendChild(li);
  });
}

function highlightChannel(i){
  [...channelList.children].forEach((li,idx)=>li.classList.toggle("highlight", idx===i));
  channelList.children[i].scrollIntoView({block:"center", behavior:"smooth"});
}

// ==========================
// Play Channel (Low Latency)
// ==========================
function playChannel(i){
  currentIndex=i;
  const url=channels[i].url;
  video.muted=false;
  highlightChannel(i);

  if(hls){ hls.destroy(); hls=null; }
  if(shakaPlayer){ shakaPlayer.destroy(); shakaPlayer=null; }

  if(url.endsWith(".m3u8") && Hls.isSupported()){
    hls=new Hls({
      maxBufferLength: 3,
      startLevel: 0,
      autoStartLoad: true,
      liveSyncDuration: 2,
      liveMaxLatencyDuration: 8,
      lowLatencyMode: true
    });
    hls.loadSource(url);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, ()=>video.play().catch(()=>{}));
  } else if(url.endsWith(".mpd")){
    shakaPlayer=new shaka.Player(video);
    shakaPlayer.configure({
      streaming:{bufferingGoal:1.5, rebufferingGoal:1, lowLatencyMode:true},
      abr:{enabled:true, switchInterval:2}
    });
    shakaPlayer.load(url).catch(e=>console.error("Shaka error",e));
  } else {
    video.src=url;
    video.load();
    video.play().catch(()=>{});
  }

  const nextIdx=(i+1)%channels.length;
  preloadChannel(nextIdx);
}

// ==========================
// Preload Next Channel
// ==========================
function preloadChannel(i){
  if(preloaded[i]) return;
  const url=channels[i].url;
  const dummy=document.createElement("video");
  dummy.preload="metadata";
  dummy.src=url;
  preloaded[i]=true;
}

// ==========================
// Sidebar & Fullscreen
// ==========================
function toggleSidebar(force){
  if(force===true){ sidebar.classList.add("open"); overlay.classList.add("active"); }
  else if(force===false){ sidebar.classList.remove("open"); overlay.classList.remove("active"); }
  else{ sidebar.classList.toggle("open"); overlay.classList.toggle("active"); }
  if(sidebar.classList.contains("open")) highlightChannel(currentIndex);
}

overlay.addEventListener("click", ()=>toggleSidebar(false));

function toggleFullscreen(){
  if(!document.fullscreenElement) container.requestFullscreen?.().catch(()=>{});
  else document.exitFullscreen?.().catch(()=>{});
}

// ==========================
// Input Controls
// ==========================
let clickTimer=null;
video.addEventListener("click", ()=>{
  if(clickTimer){ clearTimeout(clickTimer); clickTimer=null; }
  else{ clickTimer=setTimeout(()=>{ toggleSidebar(); clickTimer=null; }, 250); }
});
video.addEventListener("dblclick", ()=>toggleFullscreen());

document.addEventListener("keydown", e=>{
  const now=Date.now();
  if(e.key==="Enter"){
    if(sidebar.classList.contains("open")){ playChannel(currentIndex); toggleSidebar(false); }
    else if(now - (window.lastEnterTime||0) < 400){ toggleFullscreen(); window.lastEnterTime=0; }
    else{ toggleSidebar(true); window.lastEnterTime=now; }
  }
  if(sidebar.classList.contains("open")){
    if(e.key==="ArrowDown"){ currentIndex=(currentIndex+1)%channels.length; highlightChannel(currentIndex); }
    if(e.key==="ArrowUp"){ currentIndex=(currentIndex-1+channels.length)%channels.length; highlightChannel(currentIndex); }
  }
  if(document.fullscreenElement && (e.key===" " || e.key.toLowerCase()==="k")) e.preventDefault();
});

document.addEventListener("mousemove", ()=>{
  document.body.classList.remove("hide-cursor");
  clearTimeout(window.cursorTimeout);
  window.cursorTimeout=setTimeout(()=>document.body.classList.add("hide-cursor"), 2000);
});

video.addEventListener("pause", ()=>{ if(document.fullscreenElement) video.play(); });

// ==========================
// Load Playlist
// ==========================
loadPlaylist("https://raw.githubusercontent.com/juztnobadi24/mychannels/main/juztchannels.m3u");
