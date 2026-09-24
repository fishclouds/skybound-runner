(() => {
"use strict";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: false });
const coinText = document.getElementById("coinText");
const statusText = document.getElementById("statusText");
const messageCard = document.getElementById("messageCard");
const restartButton = document.getElementById("restart");

let W = 1280, H = 720, dpr = 1;
const DESIGN_H = 720;
const TILE = 56;
const WORLD_W = 5400;
const GROUND_Y = 608;

function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  W = rect.width;
  H = rect.height;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener("resize", resize, { passive: true });
resize();

const input = { left:false, right:false, jump:false, jumpPressed:false };

function bindButton(id, key) {
  const el = document.getElementById(id);
  const down = (e) => {
    e.preventDefault();
    if (key === "jump" && !input.jump) input.jumpPressed = true;
    input[key] = true;
    el.classList.add("active");
    try { el.setPointerCapture(e.pointerId); } catch {}
  };
  const up = (e) => {
    e.preventDefault();
    input[key] = false;
    el.classList.remove("active");
  };
  el.addEventListener("pointerdown", down);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
  el.addEventListener("lostpointercapture", up);
}
bindButton("left","left");
bindButton("right","right");
bindButton("jump","jump");

addEventListener("keydown", (e) => {
  if (["ArrowLeft","KeyA"].includes(e.code)) input.left = true;
  if (["ArrowRight","KeyD"].includes(e.code)) input.right = true;
  if (["ArrowUp","Space","KeyW"].includes(e.code)) {
    if (!input.jump) input.jumpPressed = true;
    input.jump = true;
    e.preventDefault();
  }
});
addEventListener("keyup", (e) => {
  if (["ArrowLeft","KeyA"].includes(e.code)) input.left = false;
  if (["ArrowRight","KeyD"].includes(e.code)) input.right = false;
  if (["ArrowUp","Space","KeyW"].includes(e.code)) input.jump = false;
});

document.addEventListener("contextmenu", e => e.preventDefault());
restartButton.addEventListener("click", () => reset(true));

const solids = [];
const coins = [];
const enemies = [];
const particles = [];
const clouds = [
  {x:200,y:110,s:1.0},{x:760,y:175,s:.72},{x:1330,y:95,s:1.15},
  {x:2180,y:150,s:.82},{x:3020,y:100,s:1.05},{x:3880,y:180,s:.8},
  {x:4700,y:105,s:1.1}
];

function addBlock(x,y,w,h,type="ground") { solids.push({x,y,w,h,type,bump:0}); }
function addCoin(x,y) { coins.push({x,y,r:13,taken:false,spin:Math.random()*6.28}); }
function addEnemy(x,y,range=260) {
  enemies.push({x,y,w:43,h:39,vx:-85,alive:true,startX:x,range,phase:Math.random()*6.28});
}

function buildLevel() {
  solids.length = coins.length = enemies.length = particles.length = 0;
  // Ground segments, with gaps
  addBlock(0, GROUND_Y, 1050, 140);
  addBlock(1160, GROUND_Y, 820, 140);
  addBlock(2110, GROUND_Y, 980, 140);
  addBlock(3230, GROUND_Y, 720, 140);
  addBlock(4080, GROUND_Y, 1320, 140);

  // Platforms and blocks
  [
    [520,470,180,28],[805,390,170,28],[1260,480,170,28],[1510,390,170,28],
    [1760,310,170,28],[2250,465,160,28],[2470,380,170,28],[2720,300,190,28],
    [3300,480,180,28],[3560,390,170,28],[3770,300,130,28],[4220,475,180,28],
    [4480,395,160,28],[4700,315,160,28]
  ].forEach(p => addBlock(...p,"platform"));

  // Decorative/interactive crates
  [[360,520],[740,520],[1410,520],[1640,520],[2350,520],[3420,520],[4360,520]]
    .forEach(([x,y]) => addBlock(x,y,56,56,"crate"));

  // Coins
  [
    [555,425],[615,425],[845,345],[905,345],[1285,435],[1345,435],
    [1540,345],[1600,345],[1790,265],[1850,265],[2290,420],[2510,335],
    [2780,255],[2840,255],[3340,435],[3400,435],[3600,345],[3810,255],
    [4260,430],[4320,430],[4520,350],[4740,270],[4800,270],
    [1000,545],[2050,545],[3150,545],[4000,545],[5000,545]
  ].forEach(c => addCoin(...c));

  // Enemies
  addEnemy(820, GROUND_Y-39, 170);
  addEnemy(1300, GROUND_Y-39, 330);
  addEnemy(2190, GROUND_Y-39, 420);
  addEnemy(2860, GROUND_Y-39, 170);
  addEnemy(3330, GROUND_Y-39, 260);
  addEnemy(4140, GROUND_Y-39, 360);
  addEnemy(4860, GROUND_Y-39, 250);
}
buildLevel();

const player = {
  x:120,y:GROUND_Y-52,w:42,h:52,vx:0,vy:0,onGround:false,
  facing:1,coyote:0,jumpBuffer:0,dead:false,won:false,invuln:0
};
let cameraX = 0;
let coinsGot = 0;
let attempts = 1;
let lastTime = performance.now();

function reset(hard=false) {
  buildLevel();
  player.x=120; player.y=GROUND_Y-player.h; player.vx=0; player.vy=0;
  player.dead=false; player.won=false; player.onGround=false; player.coyote=0;
  player.jumpBuffer=0; player.invuln=0; cameraX=0; coinsGot=0;
  input.left=input.right=input.jump=input.jumpPressed=false;
  if (hard) attempts++;
  hideMessage();
}

function showMessage(html) {
  messageCard.innerHTML = html;
  messageCard.classList.add("show");
}
function hideMessage() { messageCard.classList.remove("show"); }

function rectsOverlap(a,b) {
  return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
}

function spawnBurst(x,y,n=10) {
  for (let i=0;i<n;i++) particles.push({
    x,y,vx:(Math.random()-.5)*240,vy:-70-Math.random()*240,
    life:.6+Math.random()*.45,size:4+Math.random()*5
  });
}

function killPlayer() {
  if (player.dead || player.won) return;
  player.dead=true; player.vx=0; player.vy=-430;
  showMessage("掉下去了！<br><small>点右上角“重开”再来一次</small>");
}

function win() {
  if (player.won) return;
  player.won=true; player.vx=0;
  showMessage(`过关！　✦ ${coinsGot}<br><small>点右上角“重开”可以再玩</small>`);
  spawnBurst(player.x+player.w/2, player.y, 32);
}

function update(dt) {
  dt = Math.min(dt, 1/30);
  if (player.dead) {
    player.vy += 1500*dt; player.y += player.vy*dt;
    updateParticles(dt);
    return;
  }
  if (player.won) { updateParticles(dt); return; }

  if (input.jumpPressed) {
    player.jumpBuffer = .14;
    input.jumpPressed = false;
  } else player.jumpBuffer = Math.max(0, player.jumpBuffer-dt);

  const dir = (input.right?1:0) - (input.left?1:0);
  const accel = player.onGround ? 1850 : 1150;
  const maxSpeed = 305;
  if (dir) {
    player.vx += dir*accel*dt;
    player.vx = Math.max(-maxSpeed, Math.min(maxSpeed, player.vx));
    player.facing = dir;
  } else {
    const drag = player.onGround ? 11 : 2.4;
    player.vx *= Math.exp(-drag*dt);
    if (Math.abs(player.vx)<3) player.vx=0;
  }

  player.coyote = player.onGround ? .105 : Math.max(0, player.coyote-dt);
  if (player.jumpBuffer>0 && player.coyote>0) {
    player.vy = -570; player.onGround=false; player.coyote=0; player.jumpBuffer=0;
    spawnBurst(player.x+player.w/2, player.y+player.h, 5);
  }
  if (!input.jump && player.vy < -190) player.vy += 1550*dt;

  player.vy += 1580*dt;
  player.vy = Math.min(player.vy, 900);

  // X collision
  player.x += player.vx*dt;
  for (const s of solids) {
    if (!rectsOverlap(player,s)) continue;
    if (player.vx>0) player.x=s.x-player.w;
    else if (player.vx<0) player.x=s.x+s.w;
    player.vx=0;
  }

  // Y collision
  player.onGround=false;
  player.y += player.vy*dt;
  for (const s of solids) {
    if (!rectsOverlap(player,s)) continue;
    if (player.vy>0) {
      player.y=s.y-player.h; player.vy=0; player.onGround=true;
    } else if (player.vy<0) {
      player.y=s.y+s.h; player.vy=0;
      if (s.type==="crate") {
        s.bump=.16;
        // reward nearby untaken coin effect
        spawnBurst(player.x+player.w/2, s.y, 7);
      }
    }
  }

  // coins
  for (const c of coins) {
    if (c.taken) continue;
    const box={x:c.x-c.r,y:c.y-c.r,w:c.r*2,h:c.r*2};
    if (rectsOverlap(player,box)) {
      c.taken=true; coinsGot++; spawnBurst(c.x,c.y,9);
    }
    c.spin += dt*6;
  }

  // enemies
  for (const e of enemies) {
    if (!e.alive) continue;
    e.x += e.vx*dt;
    if (e.x < e.startX-e.range/2 || e.x > e.startX+e.range/2) e.vx *= -1;
    if (rectsOverlap(player,e)) {
      const playerBottomPrev = player.y + player.h - player.vy*dt;
      if (player.vy>70 && playerBottomPrev <= e.y+10) {
        e.alive=false; player.vy=-390; spawnBurst(e.x+e.w/2,e.y+10,16);
      } else killPlayer();
    }
  }

  for (const s of solids) s.bump=Math.max(0,s.bump-dt);
  if (player.y > H + 250) killPlayer();
  if (player.x > WORLD_W-260) win();
  player.x=Math.max(0,Math.min(WORLD_W-player.w,player.x));

  const viewWorldW = W * (DESIGN_H/H);
  const target = player.x - viewWorldW*.38;
  cameraX += (Math.max(0,Math.min(WORLD_W-viewWorldW,target))-cameraX) * (1-Math.exp(-6*dt));
  updateParticles(dt);
}

function updateParticles(dt) {
  for (let i=particles.length-1;i>=0;i--) {
    const p=particles[i];
    p.life-=dt; p.vy+=720*dt; p.x+=p.vx*dt; p.y+=p.vy*dt;
    if(p.life<=0) particles.splice(i,1);
  }
}

function rr(x,y,w,h,r) {
  const q=Math.min(r,w/2,h/2);
  ctx.beginPath(); ctx.roundRect(x,y,w,h,q);
}

function drawCloud(x,y,s) {
  ctx.save(); ctx.translate(x,y); ctx.scale(s,s);
  ctx.fillStyle="rgba(255,255,255,.86)";
  ctx.beginPath();
  ctx.arc(0,20,30,0,Math.PI*2); ctx.arc(34,0,40,0,Math.PI*2);
  ctx.arc(78,18,31,0,Math.PI*2); ctx.rect(-4,18,86,34); ctx.fill();
  ctx.restore();
}

function drawBackground(sx) {
  const sky=ctx.createLinearGradient(0,0,0,H);
  sky.addColorStop(0,"#6aaef7"); sky.addColorStop(1,"#c9eaff");
  ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);

  const scale=H/DESIGN_H;
  ctx.save(); ctx.scale(scale,scale);
  const vw=W/scale;
  // far hills
  ctx.fillStyle="#8fd39a";
  for(let i=-1;i<12;i++){
    const x=i*560 - (sx*.14)%560;
    ctx.beginPath(); ctx.moveTo(x,608); ctx.quadraticCurveTo(x+170,340,x+330,608);
    ctx.quadraticCurveTo(x+430,440,x+560,608); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle="#67bd7a";
  for(let i=-1;i<14;i++){
    const x=i*420 - (sx*.24)%420;
    ctx.beginPath(); ctx.moveTo(x,608); ctx.quadraticCurveTo(x+140,420,x+280,608);
    ctx.quadraticCurveTo(x+350,500,x+420,608); ctx.closePath(); ctx.fill();
  }
  for(const c of clouds) drawCloud(c.x-sx*.08,c.y,c.s);
  ctx.restore();
}

function drawWorld() {
  const scale=H/DESIGN_H;
  const vw=W/scale;
  drawBackground(cameraX);
  ctx.save(); ctx.scale(scale,scale); ctx.translate(-cameraX,0);

  // Goal tower
  ctx.fillStyle="#2c4768"; ctx.fillRect(WORLD_W-180,286,18,322);
  ctx.fillStyle="#fff"; ctx.beginPath(); ctx.moveTo(WORLD_W-162,300); ctx.lineTo(WORLD_W-92,328); ctx.lineTo(WORLD_W-162,356); ctx.closePath(); ctx.fill();
  ctx.fillStyle="#ffcc45"; ctx.beginPath(); ctx.arc(WORLD_W-171,280,16,0,Math.PI*2); ctx.fill();

  // solids
  for(const s of solids){
    const y=s.y-(s.bump>0?Math.sin((s.bump/.16)*Math.PI)*8:0);
    if(s.type==="ground"){
      ctx.fillStyle="#835733"; ctx.fillRect(s.x,y,s.w,s.h);
      ctx.fillStyle="#65b84f"; ctx.fillRect(s.x,y,s.w,15);
      ctx.fillStyle="#4a8d3c"; ctx.fillRect(s.x,y+15,s.w,6);
      for(let x=s.x+18;x<s.x+s.w;x+=70){
        ctx.fillStyle="rgba(255,255,255,.08)"; ctx.fillRect(x,y+42,18,10);
      }
    }else if(s.type==="platform"){
      ctx.fillStyle="#d8a257"; rr(s.x,y,s.w,s.h,10); ctx.fill();
      ctx.fillStyle="#f1c277"; ctx.fillRect(s.x+8,y+6,s.w-16,6);
      ctx.strokeStyle="rgba(80,47,24,.28)"; ctx.lineWidth=3;
      for(let x=s.x+36;x<s.x+s.w;x+=56){ctx.beginPath();ctx.moveTo(x,y+3);ctx.lineTo(x-12,y+s.h-3);ctx.stroke();}
    }else{
      ctx.fillStyle="#c47a31"; rr(s.x,y,s.w,s.h,8); ctx.fill();
      ctx.strokeStyle="#7b451d"; ctx.lineWidth=4; ctx.stroke();
      ctx.strokeStyle="rgba(255,225,160,.5)"; ctx.lineWidth=3;
      ctx.beginPath();ctx.moveTo(s.x+12,y+12);ctx.lineTo(s.x+s.w-12,y+s.h-12);
      ctx.moveTo(s.x+s.w-12,y+12);ctx.lineTo(s.x+12,y+s.h-12);ctx.stroke();
    }
  }

  // coins
  for(const c of coins){
    if(c.taken) continue;
    const squash=.28+.72*Math.abs(Math.cos(c.spin));
    ctx.save(); ctx.translate(c.x,c.y); ctx.scale(squash,1);
    ctx.fillStyle="#ffd84a"; ctx.beginPath();ctx.ellipse(0,0,13,18,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle="#c88d14";ctx.lineWidth=4;ctx.stroke();
    ctx.fillStyle="#fff3a5";ctx.fillRect(-2,-10,4,14);
    ctx.restore();
  }

  // enemies
  for(const e of enemies){
    if(!e.alive) continue;
    const bob=Math.sin(performance.now()/170+e.phase)*2;
    ctx.save(); ctx.translate(e.x,e.y+bob);
    ctx.fillStyle="#6f4c36"; rr(0,8,e.w,e.h-8,14); ctx.fill();
    ctx.fillStyle="#8f674a"; rr(5,0,e.w-10,23,12); ctx.fill();
    ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(14,13,5,0,6.28);ctx.arc(29,13,5,0,6.28);ctx.fill();
    ctx.fillStyle="#1e2330";ctx.beginPath();ctx.arc(15,14,2.4,0,6.28);ctx.arc(28,14,2.4,0,6.28);ctx.fill();
    ctx.fillStyle="#332317";ctx.fillRect(5,e.h-4,12,5);ctx.fillRect(e.w-17,e.h-4,12,5);
    ctx.restore();
  }

  // player: original blue sky courier
  const p=player;
  ctx.save();ctx.translate(p.x+p.w/2,p.y+p.h/2);
  if(p.facing<0)ctx.scale(-1,1);
  const run=Math.min(1,Math.abs(p.vx)/220);
  const t=performance.now()/95;
  const leg=Math.sin(t)*7*run;
  // shadow/legs
  ctx.strokeStyle="#263149";ctx.lineWidth=8;ctx.lineCap="round";
  ctx.beginPath();ctx.moveTo(-8,14);ctx.lineTo(-10+leg,27);ctx.moveTo(8,14);ctx.lineTo(10-leg,27);ctx.stroke();
  ctx.fillStyle="#ecf5ff";
  ctx.beginPath();ctx.ellipse(-10+leg,28,9,5,0,0,6.28);ctx.ellipse(10-leg,28,9,5,0,0,6.28);ctx.fill();
  // body
  ctx.fillStyle="#2378d8"; rr(-19,-18,38,38,13);ctx.fill();
  ctx.fillStyle="#5daeff";rr(-14,-13,28,23,10);ctx.fill();
  // scarf
  ctx.fillStyle="#ffcf45";ctx.fillRect(7,-13,21,7);
  ctx.beginPath();ctx.moveTo(20,-10);ctx.lineTo(34,-4);ctx.lineTo(22,1);ctx.fill();
  // helmet/head
  ctx.fillStyle="#eaf6ff";ctx.beginPath();ctx.arc(0,-20,17,0,6.28);ctx.fill();
  ctx.fillStyle="#2367b7";ctx.beginPath();ctx.arc(-2,-24,17,3.35,6.1);ctx.lineTo(15,-17);ctx.closePath();ctx.fill();
  ctx.fillStyle="#14243b";ctx.beginPath();ctx.arc(6,-20,3,0,6.28);ctx.fill();
  // arm
  ctx.strokeStyle="#d7efff";ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(14,-4);ctx.lineTo(21,8+Math.sin(t)*3*run);ctx.stroke();
  ctx.restore();

  // particles
  for(const p of particles){
    ctx.globalAlpha=Math.max(0,Math.min(1,p.life*1.6));
    ctx.fillStyle="#ffe15d";ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,6.28);ctx.fill();
  }
  ctx.globalAlpha=1;

  ctx.restore();

  // vignette
  const g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,"rgba(0,0,0,.05)");g.addColorStop(.65,"rgba(0,0,0,0)");g.addColorStop(1,"rgba(0,0,0,.08)");
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
}

function frame(now){
  const dt=(now-lastTime)/1000; lastTime=now;
  if (innerWidth>innerHeight) update(dt);
  drawWorld();
  coinText.textContent=`✦ ${coinsGot}`;
  statusText.textContent=`SKY 1-1　尝试 ${attempts}`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// register service worker
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(()=>{}));
}
})();