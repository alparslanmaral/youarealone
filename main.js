// Basit Vampire Survivors benzeri prototip (spawn azaltılmış + soft cap)
// ================================================================

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const hud = {
  hpLabel: document.getElementById('hpLabel'),
  levelLabel: document.getElementById('levelLabel'),
  xpLabel: document.getElementById('xpLabel'),
  attackSpeedLabel: document.getElementById('attackSpeedLabel'),
  moveSpeedLabel: document.getElementById('moveSpeedLabel'),
  projectileLabel: document.getElementById('projectileLabel'),
  regenLabel: document.getElementById('regenLabel'),
};

const levelUpPanel = document.getElementById('levelUpPanel');
const upgradeOptionsDiv = document.getElementById('upgradeOptions');
const joystick = document.getElementById('joystick');
const stick = document.getElementById('stick');

// -------------------------------------------------- Player
const player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  radius: 18,
  color: '#3ad',
  baseMoveSpeed: 100,
  moveSpeedMultiplier: 1,
  maxHP: 10,
  hp: 10,
  regen: 0,
  xp: 0,
  level: 1,
  xpToNext: 50,
  projectilesPerShot: 1,
  baseAttackInterval: 3000,
  attackSpeedMultiplier: 1,
  lastAttackTime: 0,
  trail: [],
};

const TRAIL_MAX_POINTS = 24;
const TRAIL_LIFE = 0.45;
const TRAIL_MIN_SPACING = 3;

const enemies = [];
const projectiles = [];

// -------------------------------------------------- Spawn Kontrol
let enemySpawnTimer = 0;
// Önceki: 1650 -> şimdi biraz daha seyrek
let enemySpawnInterval = 1850;
let gameTime = 0;

// Soft cap ayarları
const SOFT_CAP = 35;          // bu sayıdan fazla düşman varsa spawn ciddi yavaşlasın
const HARD_CAP = 55;          // bu sayıyı aşarsa hiç yeni spawn olmasın
// Ek açıklama:
// - HARD_CAP tamamen keser.
// - SOFT_CAP üstü her ekstra düşman için spawn gecikmesine çarpan eklenir.

// -------------------------------------------------- Input
const keyState = Object.create(null);
const handledCodes = new Set([
  'KeyW','KeyA','KeyS','KeyD',
  'ArrowUp','ArrowLeft','ArrowDown','ArrowRight'
]);

window.addEventListener('keydown', e => {
  if (handledCodes.has(e.code)) {
    keyState[e.code] = true;
    if (e.code.startsWith('Arrow')) e.preventDefault();
  }
});
window.addEventListener('keyup', e => {
  if (handledCodes.has(e.code)) {
    keyState[e.code] = false;
    if (e.code.startsWith('Arrow')) e.preventDefault();
  }
});
window.addEventListener('blur', () => {
  for (const c of handledCodes) keyState[c] = false;
});

function isTouchDevice() {
  return ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
}
const hasTouch = isTouchDevice();
if (hasTouch) joystick.classList.remove('hidden');

let joyActive = false;
let joyCenter = { x: 0, y: 0 };
let joyVector = { x: 0, y: 0 };

function initJoystick() {
  joystick.addEventListener('touchstart', e => {
    e.preventDefault();
    joyActive = true;
    const rect = joystick.getBoundingClientRect();
    joyCenter.x = rect.left + rect.width / 2;
    joyCenter.y = rect.top + rect.height / 2;
  }, { passive: false });

  joystick.addEventListener('touchmove', e => {
    e.preventDefault();
    if (!joyActive) return;
    const touch = e.touches[0];
    const dx = touch.clientX - joyCenter.x;
    const dy = touch.clientY - joyCenter.y;
    const maxDist = joystick.clientWidth / 2 - stick.clientWidth / 2;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const clamped = Math.min(maxDist, dist);
    const angle = Math.atan2(dy, dx);
    const sx = Math.cos(angle) * clamped;
    const sy = Math.sin(angle) * clamped;
    stick.style.transform = `translate(calc(-50% + ${sx}px), calc(-50% + ${sy}px))`;
    joyVector.x = (sx / maxDist);
    joyVector.y = (sy / maxDist);
  }, { passive: false });

  function endJoy(e) {
    e.preventDefault();
    joyActive = false;
    joyVector.x = 0; joyVector.y = 0;
    stick.style.transform = 'translate(-50%,-50%)';
  }
  joystick.addEventListener('touchend', endJoy, { passive: false });
  joystick.addEventListener('touchcancel', endJoy, { passive: false });
}
if (hasTouch) initJoystick();

// -------------------------------------------------- Helpers
function dist(a,b){const dx=a.x-b.x,dy=a.y-b.y;return Math.sqrt(dx*dx+dy*dy);}

function spawnEnemy() {
  const edge = Math.floor(Math.random()*4);
  let x,y;
  if (edge===0){x=-20;y=Math.random()*canvas.height;}
  else if(edge===1){x=canvas.width+20;y=Math.random()*canvas.height;}
  else if(edge===2){x=Math.random()*canvas.width;y=-20;}
  else {x=Math.random()*canvas.width;y=canvas.height+20;}
  enemies.push({
    x,y,
    radius:14,
    color:'#d33',
    speed:60+Math.random()*20,
    hp:3,
    xpValue:10,
  });
}

function tryLevelUp(){
  if(player.xp>=player.xpToNext){
    player.xp-=player.xpToNext;
    player.level++;
    player.xpToNext = Math.floor(player.level*player.level*50);
    openUpgradePanel();
  }
}

const allUpgrades = [
  { id:'attackSpeed', label:'+10% saldırı hızı', apply:()=>{player.attackSpeedMultiplier*=1.10;} },
  { id:'moveSpeed', label:'+10% hareket hızı', apply:()=>{player.moveSpeedMultiplier*=1.10;} },
  { id:'projectile', label:'+1 projectile', apply:()=>{player.projectilesPerShot+=1;} },
  { id:'hpPlus', label:'+1 kalıcı hp', apply:()=>{player.maxHP+=1;player.hp+=1;} },
  { id:'regenPlus', label:'+2 hp yenileme', apply:()=>{player.regen+=2;} },
];

function openUpgradePanel(){
  const shuffled=[...allUpgrades].sort(()=>Math.random()-0.5);
  const selection=shuffled.slice(0,2);
  upgradeOptionsDiv.innerHTML='';
  selection.forEach(upg=>{
    const btn=document.createElement('button');
    btn.className='upgrade-btn';
    btn.textContent=upg.label;
    btn.onclick=()=>{
      upg.apply();
      levelUpPanel.classList.add('hidden');
      updateHUD();
    };
    upgradeOptionsDiv.appendChild(btn);
  });
  levelUpPanel.classList.remove('hidden');
  updateHUD();
}

function nearestEnemy(){
  if(enemies.length===0) return null;
  let c=enemies[0],m=dist(player,c);
  for(let i=1;i<enemies.length;i++){
    const d=dist(player,enemies[i]);
    if(d<m){m=d;c=enemies[i];}
  }
  return c;
}

function fireProjectiles(){
  const target=nearestEnemy();
  if(!target) return;
  const n=player.projectilesPerShot;
  const baseAngle=Math.atan2(target.y-player.y,target.x-player.x);
  const spread=Math.min(Math.PI/8,0.15*n);
  for(let i=0;i<n;i++){
    const angle=baseAngle+((i-(n-1)/2)*(spread/(n>1?(n-1):1)));
    projectiles.push({
      x:player.x,
      y:player.y,
      vx:Math.cos(angle)*320,
      vy:Math.sin(angle)*320,
      radius:5,
      color:'#ffea00',
      damage:2,
    });
  }
}

function updateHUD(){
  hud.hpLabel.textContent=`HP: ${Math.max(0,Math.floor(player.hp))} / ${player.maxHP}`;
  hud.levelLabel.textContent=`Level: ${player.level}`;
  hud.xpLabel.textContent=`XP: ${player.xp} / ${player.xpToNext}`;
  hud.attackSpeedLabel.textContent=`Atk SPD: ${player.attackSpeedMultiplier.toFixed(2)}x`;
  hud.moveSpeedLabel.textContent=`Move SPD: ${(player.baseMoveSpeed*player.moveSpeedMultiplier).toFixed(0)}`;
  hud.projectileLabel.textContent=`Proj: ${player.projectilesPerShot}`;
  hud.regenLabel.textContent=`Regen: ${player.regen}/s`;
}

// -------------------------------------------------- Trail
function updatePlayerTrail(now,isMoving){
  if(isMoving){
    const last=player.trail[player.trail.length-1];
    if(!last || Math.hypot(player.x-last.x,player.y-last.y)>TRAIL_MIN_SPACING){
      player.trail.push({x:player.x,y:player.y,time:now});
    }
  }
  const cutoff=now-TRAIL_LIFE*1000;
  while(player.trail.length && player.trail[0].time<cutoff) player.trail.shift();
  while(player.trail.length>TRAIL_MAX_POINTS) player.trail.shift();
}

function drawPlayerTrail(now){
  for(const pt of player.trail){
    const age=(now-pt.time)/1000;
    const t=Math.min(1,Math.max(0,age/TRAIL_LIFE));
    const alpha=0.35*(1-t);
    const r=player.radius*(0.4+0.6*(1-t));
    ctx.save();
    ctx.globalAlpha=alpha;
    ctx.fillStyle=player.color;
    ctx.beginPath();
    ctx.arc(pt.x,pt.y,r,0,Math.PI*2);
    ctx.fill();
    ctx.restore();
  }
}

// -------------------------------------------------- Loop
let lastTime=performance.now();
function gameLoop(now){
  const dt=(now-lastTime)/1000;
  lastTime=now;
  gameTime+=dt;

  // Yeni spawn formülü:
  // Taban: 1850ms
  // Azalım: gameTime * 5
  // Minimum: 900ms
  // Düşman sayısı arttıkça çarpan: (1 + (enemies.length / 50)) -> yavaş yavaş artar
  // Soft cap üstünde ekstra gecikme
  const baseDynamic = Math.max(900, 1850 - gameTime * 5);
  const populationFactor = 1 + (enemies.length / 50); // 50 düşmanda +100% interval
  let effectiveInterval = baseDynamic * populationFactor;

  if (enemies.length > SOFT_CAP) {
    // Her fazla düşman için ekstra %3 gecikme
    const excess = enemies.length - SOFT_CAP;
    effectiveInterval *= (1 + excess * 0.03);
  }
  if (enemies.length >= HARD_CAP) {
    // Hard cap: hiç spawn olmasın ama timer sıfırlanmasın (durgunlaşır)
    effectiveInterval = Infinity;
  }

  enemySpawnInterval = effectiveInterval;
  enemySpawnTimer += dt*1000;
  if (enemySpawnTimer >= enemySpawnInterval) {
    enemySpawnTimer = 0;
    spawnEnemy();
  }

  // Girdi
  let inputX=0,inputY=0;
  if(keyState['KeyA']||keyState['ArrowLeft']) inputX-=1;
  if(keyState['KeyD']||keyState['ArrowRight']) inputX+=1;
  if(keyState['KeyW']||keyState['ArrowUp']) inputY-=1;
  if(keyState['KeyS']||keyState['ArrowDown']) inputY+=1;
  inputX += joyVector.x;
  inputY += joyVector.y;
  const len=Math.hypot(inputX,inputY);
  if(len>0){inputX/=len;inputY/=len;}

  const prevX=player.x, prevY=player.y;
  const moveSpeed=player.baseMoveSpeed*player.moveSpeedMultiplier;
  player.x+=inputX*moveSpeed*dt;
  player.y+=inputY*moveSpeed*dt;
  player.x=Math.max(player.radius,Math.min(canvas.width-player.radius,player.x));
  player.y=Math.max(player.radius,Math.min(canvas.height-player.radius,player.y));
  const moved=Math.hypot(player.x-prevX,player.y-prevY)>0.1;
  updatePlayerTrail(now,moved);

  // Regen
  if(player.regen>0 && player.hp<player.maxHP){
    player.hp+=player.regen*dt;
    if(player.hp>player.maxHP) player.hp=player.maxHP;
  }

  // Saldırı
  const attackInterval=player.baseAttackInterval/player.attackSpeedMultiplier;
  if(now-player.lastAttackTime>=attackInterval){
    player.lastAttackTime=now;
    fireProjectiles();
  }

  // Düşman hareketi + temas hasarı
  enemies.forEach(enemy=>{
    const dx=player.x-enemy.x;
    const dy=player.y-enemy.y;
    const d=Math.hypot(dx,dy);
    if(d>0){
      enemy.x+=(dx/d)*enemy.speed*dt;
      enemy.y+=(dy/d)*enemy.speed*dt;
    }
    if(d<player.radius+enemy.radius){
      player.hp -= 1 * dt * 5;
      enemy.x-=(dx/d)*10*dt;
      enemy.y-=(dy/d)*10*dt;
    }
  });

  // Mermiler
  for(let i=projectiles.length-1;i>=0;i--){
    const p=projectiles[i];
    p.x+=p.vx*dt;
    p.y+=p.vy*dt;
    if(p.x<-50||p.x>canvas.width+50||p.y<-50||p.y>canvas.height+50){
      projectiles.splice(i,1);
      continue;
    }
    for(let j=enemies.length-1;j>=0;j--){
      const e=enemies[j];
      const dx=e.x-p.x;
      const dy=e.y-p.y;
      const dd=Math.hypot(dx,dy);
      if(dd<e.radius+p.radius){
        e.hp-=p.damage;
        projectiles.splice(i,1);
        if(e.hp<=0){
          player.xp+=e.xpValue;
          enemies.splice(j,1);
          tryLevelUp();
          updateHUD();
        }
        break;
      }
    }
  }

  // Ölüm
  if(player.hp<=0){
    ctx.fillStyle='rgba(0,0,0,0.6)';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='#f33';
    ctx.font='48px sans-serif';
    ctx.textAlign='center';
    ctx.fillText('Öldün! Yenilemek için F5.',canvas.width/2,canvas.height/2);
    return;
  }

  // Çizim
  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawPlayerTrail(now);

  ctx.fillStyle=player.color;
  ctx.beginPath();
  ctx.arc(player.x,player.y,player.radius,0,Math.PI*2);
  ctx.fill();
  ctx.lineWidth=2;
  ctx.strokeStyle='rgba(255,255,255,0.2)';
  ctx.stroke();

  enemies.forEach(e=>{
    ctx.fillStyle=e.color;
    ctx.beginPath();
    ctx.arc(e.x,e.y,e.radius,0,Math.PI*2);
    ctx.fill();
  });

  projectiles.forEach(p=>{
    ctx.fillStyle=p.color;
    ctx.beginPath();
    ctx.arc(p.x,p.y,p.radius,0,Math.PI*2);
    ctx.fill();
  });

  updateHUD();
  requestAnimationFrame(gameLoop);
}

updateHUD();
requestAnimationFrame(gameLoop);