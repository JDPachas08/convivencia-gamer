// ===============================
// script.js - Convivencia Gamer
// ===============================

// ---------- CONFIGURACIÓN FIREBASE (versión clásica) ----------
const firebaseConfig = {
  apiKey: "AIzaSyAr2Ngp82wyZiiKMe8YCv2CpVbmxIfKPlM",
  authDomain: "juegos-convivencia.firebaseapp.com",
  databaseURL: "https://juegos-convivencia-default-rtdb.firebaseio.com",
  projectId: "juegos-convivencia",
  storageBucket: "juegos-convivencia.firebasestorage.app",
  messagingSenderId: "1043193368759",
  appId: "1:1043193368759:web:34dcf752836b513c66fd32"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ---------- CONSTANTES ----------
const DEFAULT_GAME_TIME = 45; // segundos para trivia, who, react
const HACKBALL_GAME_TIME = 120; // segundos para Hackball
const HACKBALL_GOALS_TO_WIN = 3;
const ACHIEVEMENT_THRESHOLD_SMALL = 300; // was 50 -> now 300
const ACHIEVEMENT_THRESHOLD_CHAMP = 5000; // champion legendary threshold

// ---------- DATOS DE ESTUDIANTES (tus 6) ----------
const students = [
  { name: "Andrea", hobby: "Escuchar música", extra: "hacer peinados exóticos", desc: "Baja, pelo lacio y negro" },
  { name: "Loana", hobby: "Dibujar", extra: "garabatear en cuadernos", desc: "Alta, pelo castaño y rizado" },
  { name: "Emmanuel", hobby: "Tocar el ukelele", extra: "componer canciones", desc: "Usaba lentes, pelo negro lacio" },
  { name: "Nadiencka", hobby: "Jugar Roblox", extra: "hacer bromas", desc: "Tez morena, pelo negro rizado, alta" },
  { name: "Sneijder", hobby: "Jugar Básquet", extra: "organizar cosas", desc: "Tez blanca, pelo negro ondeado" },
  { name: "Lucciana", hobby: "Tocar guitarra", extra: "usar lentes rosaditos", desc: "Baja, pelo negro rizado" }
];

// ---------- SONIDOS (asegúrate de tener los archivos en assets/sounds) ----------
const sounds = {
  start: new Audio('assets/sounds/start.mp3'),
  ding: new Audio('assets/sounds/ding.mp3'),
  pop: new Audio('assets/sounds/pop.mp3'),
  win: new Audio('assets/sounds/win.mp3'),
  cheer: new Audio('assets/sounds/cheer.mp3'),
  error: new Audio('assets/sounds/pop.mp3')
};

// ---------- ESTADO GLOBAL ----------
let playerName = localStorage.getItem('playerName') || '';
let playerRef = null;
let score = 0;
let lives = 3;
let currentGame = null;

// timers
let gameTimers = {}; // keyed by game type

// Reaction game state
let reactBest = localStorage.getItem('reactBest') ? Number(localStorage.getItem('reactBest')) : null;

// UI elements (assume exist in index.html as provided)
const loginScreen = document.getElementById('loginScreen');
const menuScreen = document.getElementById('menuScreen');
const gameArea = document.getElementById('gameArea');
const playerInfo = document.getElementById('playerInfo');
const rankingList = document.getElementById('rankingList');
const medalsPanel = document.getElementById('medalsPanel');
const medalsList = document.getElementById('medalsList');

// ---------- HELPERS ----------
function sanitizeId(name){ return name.replace(/[^a-z0-9]/gi,'_').toLowerCase(); }
function shuffle(arr){ return arr.slice().sort(()=>Math.random()-0.5); }
function pickRandom(arr, n){
  const copy = arr.slice(); const res = [];
  for(let i=0;i<n && copy.length>0;i++){
    res.push(copy.splice(Math.floor(Math.random()*copy.length),1)[0]);
  }
  return res;
}

// ---------- FIREBASE: jugador, ranking, medallas ----------
function initPlayerIfNeeded(nick){
  playerName = nick;
  localStorage.setItem('playerName', playerName);
  playerRef = db.ref('players/' + sanitizeId(playerName));
  playerRef.once('value').then(snap=>{
    if(!snap.exists()){
      playerRef.set({ name: playerName, score: 0, medals: [], achievements: [] });
    }
    showMenu();
  });
}

function saveScoreToDB(gameType, pts){
  if(!playerName) return;
  const id = sanitizeId(playerName);
  db.ref(`scores/${gameType}/${id}`).set({ name: playerName, score: pts, ts: Date.now() });
  // update overall player score
  db.ref(`players/${id}/score`).transaction(old => (old || 0) + pts);
}

function loadGlobalRanking(){
  db.ref('players').orderByChild('score').limitToLast(20).on('value', snap=>{
    const data = snap.val() || {};
    const arr = Object.values(data).sort((a,b)=> (b.score||0) - (a.score||0));
    rankingList.innerHTML = arr.map((p,i)=>`<li>${i+1}. ${p.name} — ${p.score || 0} pts</li>`).join('');
  });
}

function awardMedal(name){
  if(!playerRef) return;
  playerRef.child('medals').transaction(old=>{
    old = old || [];
    if(!old.includes(name)) old.push(name);
    return old;
  });
}

function addAchievement(name){
  if(!playerRef) return;
  playerRef.child('achievements').transaction(old=>{
    old = old || [];
    if(!old.includes(name)) old.push(name);
    return old;
  });
}

function renderMedalsList(){
  if(!playerRef) return;
  playerRef.once('value').then(snap=>{
    const val = snap.val() || {};
    const medals = val.medals || [];
    medalsList.innerHTML = medals.length ? medals.map(m=>`<li>${m}</li>`).join('') : '<li>No tienes medallas aún. ¡A jugar!</li>';
  });
}

// ---------- UI: inicio, login, menú ----------
document.getElementById('enterBtn').addEventListener('click', ()=>{
  const nick = document.getElementById('nickname').value.trim();
  if(!nick) return alert('Ingresa un apodo');
  initPlayerIfNeeded(nick);
});

function showMenu(){
  loginScreen.style.display = 'none';
  menuScreen.style.display = 'block';
  playerInfo.style.display = 'flex';
  document.getElementById('playerNameBadge').textContent = playerName;
  loadGlobalRanking();
  renderMedalsList();
  // listen for updates to medals
  if(!playerRef) playerRef = db.ref('players/' + sanitizeId(playerName));
  playerRef.on('value', snap=>{
    const val = snap.val() || {};
    const medals = val.medals || [];
    document.getElementById('medalsBadge').innerHTML = medals.map(m=>`<span>${m}</span>`).join(' ');
    renderMedalsList();
  });
}

function goHome(){
  // stop timers
  Object.keys(gameTimers).forEach(k => {
    clearInterval(gameTimers[k]);
  });
  gameTimers = {};
  // stop any game-specific activities
  stopHackball();
  stopReact();
  // reset UI
  document.getElementById('scoreDisplay').textContent = 'Puntos: 0';
  document.getElementById('livesDisplay').textContent = '';
  document.getElementById('timeDisplay').textContent = '';
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  menuScreen.style.display = 'block';
  gameArea.style.display = 'none';
  sounds.pop.play();
}

// ---------- START GAME (play start sound, then begin) ----------
function startGame(type){
  if(!playerName) return alert('Ingresa tu apodo primero');
  currentGame = type;
  score = 0; lives = 3;
  document.getElementById('scoreDisplay').textContent = 'Puntos: 0';
  document.getElementById('livesDisplay').textContent = `Vidas: ${lives}`;
  // show area
  menuScreen.style.display = 'none';
  gameArea.style.display = 'block';
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  // play start sound, then begin
  const playPromise = sounds.start.play();
  if(playPromise && typeof playPromise.then === 'function'){
    sounds.start.onended = ()=> { beginGame(type); };
  } else {
    // fallback delay
    setTimeout(()=> beginGame(type), 800);
  }
}

function beginGame(type){
  // set default time display for each game (some override)
  if(type === 'hackball'){
    document.getElementById('timeDisplay').textContent = `⏱ ${HACKBALL_GAME_TIME}s`;
  } else {
    document.getElementById('timeDisplay').textContent = `⏱ ${DEFAULT_GAME_TIME}s`;
  }
  switch(type){
    case 'trivia': initTrivia(); break;
    case 'who': initWho(); break; // "Adivina quién soy" - left unchanged
    case 'hackball': initHackball(); break;
    case 'react': initReact(); break;
    default: console.warn('Juego no reconocido', type);
  }
}

// ---------- GAME TIMER (generic) ----------
function startTimer(gameKey, seconds, onTick, onComplete){
  clearInterval(gameTimers[gameKey]);
  let t = seconds;
  if(onTick) onTick(t);
  gameTimers[gameKey] = setInterval(()=>{
    t--;
    if(onTick) onTick(t);
    if(t <= 0){
      clearInterval(gameTimers[gameKey]);
      delete gameTimers[gameKey];
      if(onComplete) onComplete();
    }
  }, 1000);
}
function stopTimer(gameKey){
  if(gameTimers[gameKey]){ clearInterval(gameTimers[gameKey]); delete gameTimers[gameKey]; }
}

// ---------- TRIVIA (más difícil) ----------
const triviaQuestions = [
  // Harder, ethical / situational questions
  { q:"Un compañero copia tu tarea y la entrega como propia. ¿Qué haces?", opts:["Hablar con el compañero y al docente","Ignorar","Robarle la tarea"], correct:0, lvl:'hard' },
  { q:"Hay un grupo que excluye a un estudiante nuevo en actividades. Mejor respuesta:", opts:["Invitarlo y presentarlo","Seguir con el grupo","Reírte"], correct:0, lvl:'hard' },
  { q:"Si ves evidencia de ciberbullying en redes, lo correcto es:", opts:["Informar a un adulto y apoyar a la víctima","Reenviarlo","Borrarlo sin decir nada"], correct:0, lvl:'hard' },
  { q:"Un compañero se burla de la apariencia de otro: tu intervención sería:", opts:["Hablar con ambos y mediar","Unirte a la burla","Pasar de largo"], correct:0, lvl:'hard' },
  { q:"Si un equipo pide que ignores a alguien del grupo por competir, tú:", opts:["Promueves inclusión y diálogo","Sigues la orden","Haces lo mismo"], correct:0, lvl:'hard' },
  // Medium
  { q:"Cómo resolver un malentendido por un rumor?", opts:["Hablar con la persona involucrada","Difundir el rumor","Ignorar"], correct:0, lvl:'medium' },
  { q:"Si un compañero aporta ideas distintas, qué haces?", opts:["Escuchar y valorar","Criticar sin escuchar","Interrumpir"], correct:0, lvl:'medium' },
  // Easier
  { q:"¿Qué es tolerancia?", opts:["Respetar diferencias","Gritar","Aislar"], correct:0, lvl:'easy' },
  { q:"Si un compañero comparte material, eso es:", opts:["Generosidad","Egoísmo","Indiferencia"], correct:0, lvl:'easy' },
  { q:"¿Qué hacemos si vemos una injusticia?"," opts":["Denunciar y apoyar a la víctima","Hacer nada","Celebrar"], correct:0, lvl:'easy' }
];

let triviaPool = [], triviaIndex = 0;
function initTrivia(){
  document.getElementById('triviaScreen').classList.add('active');
  triviaPool = shuffle(triviaQuestions);
  triviaIndex = 0;
  score = 0; lives = 3;
  showTriviaQuestion();
  startTimer('trivia', DEFAULT_GAME_TIME, (t)=>{ document.getElementById('timeDisplay').textContent = `⏱ ${t}s`; }, ()=> {
    alert('⏰ Tiempo terminado en Trivia');
    endGame('trivia');
  });
}
function showTriviaQuestion(){
  if(triviaIndex >= triviaPool.length){ endGame('trivia'); return; }
  const q = triviaPool[triviaIndex];
  const cont = document.getElementById('triviaContent');
  cont.innerHTML = `<div class="phrase">${q.q}</div>`;
  const optsDiv = document.createElement('div'); optsDiv.className='options';
  q.opts.forEach((o,i)=>{
    const btn = document.createElement('button'); btn.className='option-btn'; btn.textContent = o;
    btn.onclick = ()=>{
      if(i === q.correct){
        const pts = q.lvl==='easy'?10:q.lvl==='medium'?20:40; // hard = bigger reward
        score += pts;
        document.getElementById('scoreDisplay').textContent = `Puntos: ${score}`;
        sounds.ding.play();
        if(q.lvl==='hard'){ awardMedal('🧠 Maestro del Respeto'); addAchievement('Maestro del Respeto'); }
      } else {
        score = Math.max(0, score - 5);
        lives--; document.getElementById('livesDisplay').textContent = `Vidas: ${lives}`;
        sounds.pop.play();
      }
      if(lives <= 0) return endGame('trivia');
      triviaIndex++;
      setTimeout(showTriviaQuestion, 600);
    };
    optsDiv.appendChild(btn);
  });
  cont.appendChild(optsDiv);
}

// ---------- WHO (Adivina quién soy) - NO CAMBIAR según solicitud ----------
/* Mantengo exactamente la lógica existente (sin modificaciones de gameplay) */
const frasesBank = [
  { frase: "Me encanta hacer peinados locos.", autor: "Andrea" },
  { frase: "Nada me relaja más que dibujar.", autor: "Loana" },
  { frase: "Amo tocar el ukelele y componer canciones.", autor: "Emmanuel" },
  { frase: "Roblox todo el día, todos los días.", autor: "Nadiencka" },
  { frase: "Siempre con energía para el básquet.", autor: "Sneijder" },
  { frase: "Mi guitarra y mis lentes rosados son mi estilo.", autor: "Lucciana" }
];

function initWho(){
  document.getElementById('whoScreen').classList.add('active');
  score = 0; lives = 3;
  showWhoQuestion();
  startTimer('who', DEFAULT_GAME_TIME, (t)=>{ document.getElementById('timeDisplay').textContent = `⏱ ${t}s`; }, ()=>{
    alert('⏰ Tiempo terminado en Adivina quién soy');
    endGame('who');
  });
}
function showWhoQuestion(){
  const q = frasesBank[Math.floor(Math.random()*frasesBank.length)];
  document.getElementById('whoPhrase').textContent = q.frase;
  const authors = frasesBank.map(f=>f.autor);
  const wrong = pickRandom(authors.filter(a=>a!==q.autor), 3);
  const options = shuffle([q.autor, ...wrong]);
  const optDiv = document.getElementById('whoOptions'); optDiv.innerHTML = '';
  options.slice(0,4).forEach(name=>{
    const b = document.createElement('button'); b.className='option-btn'; b.textContent = name;
    b.onclick = ()=>{
      if(name === q.autor){
        score += 15;
        document.getElementById('scoreDisplay').textContent = `Puntos: ${score}`;
        sounds.ding.play();
        if(score >= ACHIEVEMENT_THRESHOLD_SMALL){ awardMedal('🎭 Conozco a todos'); addAchievement('Conozco a todos'); }
      } else {
        score = Math.max(0, score - 5);
        sounds.pop.play();
      }
      setTimeout(showWhoQuestion, 500);
    };
    optDiv.appendChild(b);
  });
}

// ---------- HACKBALL (reemplaza al coop) - local 2 jugadores ----------
let hackballState = {
  active: false, animId: null, canvas: null, ctx: null,
  p1: { x: 120, y: 200, w: 16, h: 64, color: '#0b3d91', score: 0 },
  p2: { x: 464, y: 200, w: 16, h: 64, color: '#8b0b0b', score: 0 },
  ball: { x: 300, y: 200, r: 10, vx: 3, vy: 2 },
  keys: {},
  remaining: HACKBALL_GAME_TIME,
  startTs: null
};

function initHackball(){
  document.getElementById('coopScreen').classList.add('active');
  // prepare canvas inside coopScreen
  const coop = document.getElementById('coopScreen');
  coop.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
      <div>Jugador Azul: <span id="hackP1Score">0</span></div>
      <div>Tiempo: <span id="hackTimeDisplay">${HACKBALL_GAME_TIME}</span>s</div>
      <div>Jugador Rojo: <span id="hackP2Score">0</span></div>
    </div>
    <canvas id="hackCanvas" width="600" height="360" style="background:#ffffff;border:1px solid #000;"></canvas>
    <div style="margin-top:6px;font-size:0.9rem;color:#555">Jugador 1: W/A/S/D • Jugador 2: Flechas</div>
  `;
  const canvas = document.getElementById('hackCanvas');
  hackballState.canvas = canvas;
  hackballState.ctx = canvas.getContext('2d');
  // reset players and ball
  hackballState.p1.x = 60; hackballState.p1.y = canvas.height/2;
  hackballState.p1.score = 0;
  hackballState.p2.x = canvas.width - 76; hackballState.p2.y = canvas.height/2;
  hackballState.p2.score = 0;
  hackballState.ball.x = canvas.width/2; hackballState.ball.y = canvas.height/2;
  hackballState.ball.vx = (Math.random()>0.5?1:-1)* (3 + Math.random()*1.5);
  hackballState.ball.vy = (Math.random()>0.5?1:-1)* (2 + Math.random()*1.2);
  hackballState.keys = {};
  hackballState.active = true;
  hackballState.startTs = Date.now();
  hackballState.remaining = HACKBALL_GAME_TIME;
  // input listeners
  window.addEventListener('keydown', hackballKeyDown);
  window.addEventListener('keyup', hackballKeyUp);
  // start timer display
  startTimer('hackball', HACKBALL_GAME_TIME, (t)=> {
    hackballState.remaining = t;
    document.getElementById('hackTimeDisplay').textContent = t;
  }, ()=> {
    endHackball();
  });
  // animation loop
  function loop(){
    if(!hackballState.active) return;
    updateHackballPhysics();
    renderHackball();
    hackballState.animId = requestAnimationFrame(loop);
  }
  loop();
}

function hackballKeyDown(e){
  hackballState.keys[e.key] = true;
}
function hackballKeyUp(e){
  hackballState.keys[e.key] = false;
}

function updateHackballPhysics(){
  const canvas = hackballState.canvas;
  const p1 = hackballState.p1, p2 = hackballState.p2, ball = hackballState.ball;
  // move paddles (limit to canvas)
  const speed = 5;
  if(hackballState.keys['w'] || hackballState.keys['W']) p1.y -= speed;
  if(hackballState.keys['s'] || hackballState.keys['S']) p1.y += speed;
  if(hackballState.keys['ArrowUp']) p2.y -= speed;
  if(hackballState.keys['ArrowDown']) p2.y += speed;
  p1.y = Math.max(p1.h/2, Math.min(canvas.height - p1.h/2, p1.y));
  p2.y = Math.max(p2.h/2, Math.min(canvas.height - p2.h/2, p2.y));
  // ball physics
  ball.x += ball.vx; ball.y += ball.vy;
  // bounce top/bottom
  if(ball.y - ball.r < 0 || ball.y + ball.r > canvas.height) ball.vy *= -1;
  // check collisions with paddles (rectangular)
  // p1 collision
  if(ball.x - ball.r < p1.x + p1.w && ball.x - ball.r > p1.x && Math.abs(ball.y - p1.y) < p1.h/2 + ball.r){
    ball.vx = Math.abs(ball.vx) + 0.2;
    // tweak vy based on where it hit
    ball.vy += (ball.y - p1.y) * 0.02;
  }
  // p2 collision
  if(ball.x + ball.r > p2.x && ball.x + ball.r < p2.x + p2.w && Math.abs(ball.y - p2.y) < p2.h/2 + ball.r){
    ball.vx = -Math.abs(ball.vx) - 0.2;
    ball.vy += (ball.y - p2.y) * 0.02;
  }
  // goals: left and right beyond paddle area -> assign goal
  if(ball.x - ball.r <= 0){
    // goal for player2
    hackballState.p2.score++;
    document.getElementById('hackP2Score').textContent = hackballState.p2.score;
    sounds.ding.play();
    resetHackballAfterGoal();
  } else if(ball.x + ball.r >= canvas.width){
    hackballState.p1.score++;
    document.getElementById('hackP1Score').textContent = hackballState.p1.score;
    sounds.ding.play();
    resetHackballAfterGoal();
  }
  // check win condition
  if(hackballState.p1.score >= HACKBALL_GOALS_TO_WIN || hackballState.p2.score >= HACKBALL_GOALS_TO_WIN){
    endHackball();
  }
}

function renderHackball(){
  const ctx = hackballState.ctx, canvas = hackballState.canvas;
  // minimalistic field: white background, black goals
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // field background (white already)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  // center line
  ctx.strokeStyle = '#000000'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(canvas.width/2,0); ctx.lineTo(canvas.width/2, canvas.height); ctx.stroke();
  // goals as black rectangles on left and right edges
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, canvas.height/2 - 60, 6, 120); // left goal post
  ctx.fillRect(canvas.width - 6, canvas.height/2 - 60, 6, 120); // right goal post
  // paddles
  ctx.fillStyle = hackballState.p1.color;
  ctx.fillRect(hackballState.p1.x - hackballState.p1.w/2, hackballState.p1.y - hackballState.p1.h/2, hackballState.p1.w, hackballState.p1.h);
  ctx.fillStyle = hackballState.p2.color;
  ctx.fillRect(hackballState.p2.x - hackballState.p2.w/2, hackballState.p2.y - hackballState.p2.h/2, hackballState.p2.w, hackballState.p2.h);
  // ball
  ctx.beginPath(); ctx.arc(hackballState.ball.x, hackballState.ball.y, hackballState.ball.r, 0, Math.PI*2);
  ctx.fillStyle = '#222'; ctx.fill();
  // scores (drawn elsewhere in UI)
}

function resetHackballAfterGoal(){
  // reset ball to center with random direction
  hackballState.ball.x = hackballState.canvas.width/2;
  hackballState.ball.y = hackballState.canvas.height/2;
  hackballState.ball.vx = (Math.random()>0.5?1:-1) * (3 + Math.random()*1.5);
  hackballState.ball.vy = (Math.random()>0.5?1:-1) * (2 + Math.random()*1.2);
}

function endHackball(){
  // stop timer
  stopTimer('hackball');
  hackballState.active = false;
  if(hackballState.animId) cancelAnimationFrame(hackballState.animId);
  window.removeEventListener('keydown', hackballKeyDown);
  window.removeEventListener('keyup', hackballKeyUp);
  // decide winner
  const p1 = hackballState.p1.score, p2 = hackballState.p2.score;
  let message = `Resultado final: ${p1} - ${p2}\n`;
  if(p1 > p2) message += "¡Jugador Azul gana!"; else if(p2 > p1) message += "¡Jugador Rojo gana!"; else message += "Empate.";
  alert(message);
  // award DB + local medals: winner gets reward points
  if(playerRef){
    // award the local player depending on being p1 or p2? Since this is local two-player, we only save a small reward to current player
    const localIsP1 = true; // ambiguous in local mode; we'll just award both players generic team medal
    awardMedal('⚽ Equipo Legendario');
    addAchievement('Equipo Legendario');
    // add some points to the current player's overall score as reward
    playerRef.child('score').transaction(old => (old||0) + (p1>p2? 50 : p2>p1 ? 50 : 20));
    saveScoreToDB('hackball', (p1>p2? 50 : p2>p1 ? 50 : 20));
  }
  // return to menu
  goHome();
}

function stopHackball(){
  if(hackballState.active){
    hackballState.active = false;
    if(hackballState.animId) cancelAnimationFrame(hackballState.animId);
    window.removeEventListener('keydown', hackballKeyDown);
    window.removeEventListener('keyup', hackballKeyUp);
    stopTimer('hackball');
  }
}

// ---------- REACTIONS (corregido para mostrarse) ----------
let reactState = { active:false, roundTimeout:null, roundStart:0, best: reactBest };
function initReact(){
  document.getElementById('reactScreen').classList.add('active');
  score = 0; lives = 3;
  document.getElementById('scoreDisplay').textContent = 'Puntos: 0';
  document.getElementById('livesDisplay').textContent = `Vidas: ${lives}`;
  document.getElementById('reactBest').textContent = reactState.best ? `Mejor reacción: ${reactState.best} ms` : 'Aún sin mejor tiempo';
  reactState.active = true;
  reactState.roundStart = 0;
  // timer 45s
  startTimer('react', DEFAULT_GAME_TIME, (t)=>{ document.getElementById('reactTimer').textContent = `⏱ Tiempo restante: ${t}s`; document.getElementById('timeDisplay').textContent = `⏱ ${t}s`; }, ()=> {
    alert('⏰ Se terminó el tiempo en Batalla de Reacciones.');
    endGame('react');
  });
  showReactRound();
}
function showReactRound(){
  if(!reactState.active) return;
  reactState.roundStart = Date.now();
  const grid = document.getElementById('reactGrid');
  grid.innerHTML = '';
  const targets = ["Respeto","Solidaridad","Tolerancia","Escuchar","Compartir","Paz"];
  const correct = targets[Math.floor(Math.random()*targets.length)];
  const pool = shuffle(targets).slice(0,5);
  if(!pool.includes(correct)) pool[0] = correct;
  pool.forEach(t => {
    const btn = document.createElement('button'); btn.className='react-btn'; btn.textContent = t;
    btn.onclick = ()=>{
      if(!reactState.active) return;
      const reactionMs = Date.now() - reactState.roundStart;
      clearTimeout(reactState.roundTimeout);
      if(t === correct){
        const pts = Math.max(5, 30 - (Math.floor((DEFAULT_GAME_TIME - (gameTimers['react'] ? 0 : 0)))));
        score += pts;
        document.getElementById('scoreDisplay').textContent = `Puntos: ${score}`;
        sounds.ding.play();
        if(!reactState.best || reactionMs < reactState.best){
          reactState.best = reactionMs;
          localStorage.setItem('reactBest', reactState.best);
          document.getElementById('reactBest').textContent = `Mejor reacción: ${reactState.best} ms`;
        }
        if(reactionMs <= 300){
          awardMedal('⚡ Reflejos Relámpago'); addAchievement('Reflejos Relámpago');
        }
      } else {
        score = Math.max(0, score - 5);
        lives--; document.getElementById('livesDisplay').textContent = `Vidas: ${lives}`;
        sounds.pop.play();
        if(lives <= 0) return endGame('react');
      }
      // next round
      setTimeout(()=> {
        if(reactState.active) showReactRound();
      }, 300);
    };
    grid.appendChild(btn);
  });
  // auto-fail if not clicked quickly
  reactState.roundTimeout = setTimeout(()=>{
    lives--; document.getElementById('livesDisplay').textContent = `Vidas: ${lives}`;
    if(lives <= 0) return endGame('react');
    showReactRound();
  }, 2000);
}
function stopReact(){
  reactState.active = false;
  if(reactState.roundTimeout) clearTimeout(reactState.roundTimeout);
  stopTimer('react');
}

// ---------- END GAME (common) ----------
function endGame(gameType){
  // stop all timers for the game
  stopTimer(gameType);
  stopHackball();
  stopReact();
  sounds.win.play();
  alert(`Fin de ${gameType.toUpperCase()}! Puntos obtenidos: ${score}`);
  saveScoreToDB(gameType, score);
  // award common medals thresholds updated
  if(playerRef){
    if(score >= ACHIEVEMENT_THRESHOLD_SMALL) awardMedal('🥈 Jugador Constante');
    if(score >= ACHIEVEMENT_THRESHOLD_CHAMP) awardMedal('🥇 Campeón Global');
    // update player's overall score
    playerRef.child('score').transaction(old => (old||0) + score);
  }
  goHome();
}

// ---------- INICIALIZACIÓN ----------
document.addEventListener('DOMContentLoaded', ()=>{
  if(playerName){
    playerRef = db.ref('players/' + sanitizeId(playerName));
    showMenu();
  } else {
    loginScreen.style.display = 'block';
  }
});

