// ---------- CONFIGURACIÓN FIREBASE ----------
const firebaseConfig = {
  apiKey: "AIzaSyAr2Ngp82wyZiiKMe8YCv2CpVbmxIfKPlM",
  authDomain: "juegos-convivencia.firebaseapp.com",
  databaseURL: "https://juegos-convivencia-default-rtdb.firebaseio.com",
  projectId: "juegos-convivencia",
  storageBucket: "juegos-convivencia.firebasestorage.app",
  messagingSenderId: "1043193368759",
  appId: "1:1043193368759:web:34dcf752836b513c66fd32"
};
// ---------------------------------------------------------
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ---------- CONSTANTES GLOBALES ----------
const GAME_DURATION = 45; // segundos por juego (solicitado)
const CATCH_SPAWN_INTERVAL = 800; // ms entre objetos que caen (catch game)
const CATCH_FALL_TIME = 2200; // ms que tarda en caer un objeto (visual)
const CATCH_THRESHOLD_TOTAL = 10; // para considerarlo "completado" como equipo (opcional)

// ---------- DATOS DE ESTUDIANTES (sólo las 6 que diste, con más frases) ----------
const students = [
  { name: "Andrea", traits: { hobby: "escuchar música", extra: "hacer peinados exóticos", desc: "baja, pelo lacio y negro" } },
  { name: "Loana", traits: { hobby: "dibujar", extra: "garabatear en cuadernos", desc: "alta, pelo castaño y rizado" } },
  { name: "Emmanuel", traits: { hobby: "tocar el ukelele", extra: "componer canciones", desc: "usa lentes, pelo negro lacio" } },
  { name: "Nadiencka", traits: { hobby: "jugar Roblox", extra: "siempre hace bromas", desc: "alta, tez morena, pelo negro rizado" } },
  { name: "Sneijder", traits: { hobby: "jugar básquet", extra: "organizar cosas", desc: "tez blanca, pelo negro ondeado" } },
  { name: "Lucciana", traits: { hobby: "tocar guitarra", extra: "usar lentes rosaditos", desc: "baja, pelo negro rizado" } }
];

// generar frases variadas para "Quién dijo eso?" a partir de datos
const frasesBank = [];
students.forEach(s => {
  const t = s.traits;
  frasesBank.push({ frase: `Me encanta ${t.hobby} en mis ratos libres.`, autor: s.name });
  frasesBank.push({ frase: `A menudo ${t.extra} cuando estoy en la escuela.`, autor: s.name });
  frasesBank.push({ frase: `Me reconocen por ser ${t.desc}.`, autor: s.name });
  // una frase adicional que mezcla rasgos:
  frasesBank.push({ frase: `Mi pasatiempo: ${t.hobby}; además ${t.extra}.`, autor: s.name });
});

// ---------- SONIDOS ----------
const sounds = {
  start: new Audio('assets/sounds/start.mp3'),
  ding: new Audio('assets/sounds/ding.mp3'),
  pop: new Audio('assets/sounds/pop.mp3'),
  win: new Audio('assets/sounds/win.mp3'),
  cheer: new Audio('assets/sounds/cheer.mp3'),
  victoria: new Audio('assets/sounds/win.mp3'),
  error: new Audio('assets/sounds/pop.mp3')
};

// ---------- ESTADO GLOBAL ----------
let playerName = localStorage.getItem('playerName') || '';
let playerRef = null;
let score = 0;
let lives = 3;
let currentGame = null;

// timer general por juego
let gameTimerInterval = null;
let gameTimeLeft = GAME_DURATION;

// ---------- REACT GAME STATE ----------
let reactTimeTotal = GAME_DURATION;
let reactTimeLeft = reactTimeTotal;
let reactInterval = null;
let roundStart = 0;
let bestReaction = localStorage.getItem('bestReaction') ? Number(localStorage.getItem('bestReaction')) : null;
let reactRound = 0;

// ---------- CATCH (coop online) STATE ----------
const catchRef = db.ref('catch'); // root node for catch game
let catchPlayersRef = db.ref('catch/players');
let localCatchSpawnInterval = null;
let localCatchAnimations = []; // store timeouts/raf ids for cleanup
let playerCatchScore = 0;
let catchActive = false;

// ---------- UI ELEMENTS ----------
const loginScreen = document.getElementById('loginScreen');
const menuScreen = document.getElementById('menuScreen');
const gameArea = document.getElementById('gameArea');
const playerInfo = document.getElementById('playerInfo');
const rankingList = document.getElementById('rankingList');
const medalsPanel = document.getElementById('medalsPanel');
const medalsList = document.getElementById('medalsList');

// helpers
function sanitizeId(name){ return name.replace(/[^a-z0-9]/gi,'_').toLowerCase(); }
function shuffle(arr){ return arr.sort(()=>Math.random()-0.5); }
function pickRandom(arr, n){
  const copy = arr.slice();
  const res = [];
  for(let i=0;i<n && copy.length>0;i++){
    const idx = Math.floor(Math.random()*copy.length);
    res.push(copy.splice(idx,1)[0]);
  }
  return res;
}

// ----------------- UI / Session -----------------
document.getElementById('enterBtn').addEventListener('click', () => {
  const nick = document.getElementById('nickname').value.trim();
  if(!nick) return alert('Ingresa un apodo');
  startSession(nick);
});

function startSession(nick){
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

function showMenu(){
  loginScreen.style.display='none';
  menuScreen.style.display='block';
  playerInfo.style.display='flex';
  document.getElementById('playerNameBadge').textContent = playerName;
  loadGlobalRanking();
  listenPlayerUpdates();
  renderMedalsList();
}

function listenPlayerUpdates(){
  if(!playerRef) playerRef = db.ref('players/' + sanitizeId(playerName));
  playerRef.on('value', snap=>{
    const val = snap.val();
    if(!val) return;
    const medals = val.medals || [];
    document.getElementById('medalsBadge').innerHTML = medals.map(m => `<span>${m}</span>`).join(' ');
    renderMedalsList();
  });
}

function renderMedalsList(){
  if(!playerRef) return;
  playerRef.once('value').then(snap=>{
    const val = snap.val() || {};
    const medals = val.medals || [];
    medalsList.innerHTML = medals.length ? medals.map(m => `<li style="font-size:1.1rem">${m}</li>`).join('') : '<li>No tienes medallas aún. ¡A jugar! 🎮</li>';
  });
}

function toggleMedals(){
  const panel = document.getElementById('medalsPanel');
  panel.style.display = (panel.style.display === 'none' || panel.style.display === '') ? 'block' : 'none';
}

function goHome(){
  stopAllGameActivities();
  currentGame = null;
  score = 0;
  lives = 3;
  gameTimeLeft = GAME_DURATION;
  document.getElementById('scoreDisplay').textContent = 'Puntos: 0';
  document.getElementById('livesDisplay').textContent = '';
  document.getElementById('timeDisplay').textContent = '';
  hideAllScreens();
  gameArea.style.display='none';
  menuScreen.style.display='block';
  sounds.pop.play();
}

function hideAllScreens(){
  document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
  document.getElementById('medalsPanel').style.display = 'none';
  // remove dynamic catch area if exists
  const area = document.getElementById('catchArea');
  if(area) area.remove();
}

function stopAllGameActivities(){
  // timers and intervals
  clearInterval(gameTimerInterval);
  clearInterval(reactInterval);
  clearInterval(localCatchSpawnInterval);
  localCatchAnimations.forEach(x => {
    if(x.raf) cancelAnimationFrame(x.raf);
    if(x.to) clearTimeout(x.to);
    if(x.el && x.el.remove) x.el.remove();
  });
  localCatchAnimations = [];
  catchActive = false;
}

// ----------------- START GAME (plays start sound then init) -----------------
function startGame(type){
  if(!playerName) return alert('Ingresa tu apodo primero');
  currentGame = type;
  score = 0; lives = 3;
  gameTimeLeft = GAME_DURATION;
  document.getElementById('scoreDisplay').textContent = 'Puntos: 0';
  document.getElementById('livesDisplay').textContent = 'Vidas: ' + lives;
  document.getElementById('timeDisplay').textContent = `⏱ ${gameTimeLeft}s`;
  menuScreen.style.display='none';
  gameArea.style.display='block';
  hideAllScreens();

  // play start sound and wait until it finishes (or use ended event)
  const p = sounds.start.play();
  if(p && typeof p.then === 'function'){
    // modern browsers return a promise
    sounds.start.onended = () => {
      // small delay to ensure UI readiness
      setTimeout(()=> {
        beginGameAfterStart(type);
      }, 150);
    };
  } else {
    // fallback: set a timeout length approx sound duration (1.2s) then start
    setTimeout(()=> beginGameAfterStart(type), 1200);
  }
}

function beginGameAfterStart(type){
  // start global game timer for GAME_DURATION seconds
  startGameTimer();
  switch(type){
    case 'trivia': initTrivia(); break;
    case 'who': initWho(); break;
    case 'coop': initCatch(); break; // replaced with catch (online cooperativo)
    case 'react': initReact(); break;
    default: console.warn('Juego desconocido: ', type);
  }
}

// ---------- GAME TIMER (common for all games) ----------
function startGameTimer(){
  clearInterval(gameTimerInterval);
  gameTimeLeft = GAME_DURATION;
  document.getElementById('timeDisplay').textContent = `⏱ ${gameTimeLeft}s`;
  gameTimerInterval = setInterval(()=>{
    gameTimeLeft--;
    document.getElementById('timeDisplay').textContent = `⏱ ${gameTimeLeft}s`;
    // visual hint near end (optional: add CSS class)
    if(gameTimeLeft <= 10){
      // could change color via classList (not included here)
    }
    if(gameTimeLeft <= 0){
      clearInterval(gameTimerInterval);
      // end current game
      alert('⏰ ¡Se acabó el tiempo!');
      endGame(currentGame);
    }
  }, 1000);
}

// ---------- RANKING ----------
function saveScoreToDB(gameType, pts){
  const id = sanitizeId(playerName);
  const playerScoreRef = db.ref(`scores/${gameType}/${id}`);
  playerScoreRef.set({ name: playerName, score: pts, ts: Date.now() });
  // Update overall player score
  playerRef.child('score').transaction(old => (old || 0) + pts);
}

function loadGlobalRanking(){
  db.ref('players').orderByChild('score').limitToLast(20).on('value', snap=>{
    const data = snap.val() || {};
    const arr = Object.values(data).sort((a,b)=>b.score - a.score);
    rankingList.innerHTML = arr.map((p,i)=>`<li>${i+1}. ${p.name} — ${p.score || 0} pts</li>`).join('');
  });
}

// ---------- MEDALS ----------
function awardMedalToPlayerId(playerId, name){
  db.ref(`players/${playerId}/medals`).transaction(old=>{
    old = old || [];
    if(!old.includes(name)) old.push(name);
    return old;
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

// ---------- JUEGO 1: TRIVIA ----------
const triviaQuestions = [
  {q:"¿Qué harías si ves a alguien triste en clase?", opts:["Reírte","Preguntar si está bien","Ignorarlo"], correct:1, lvl:'easy'},
  {q:"Si un compañero comparte su merienda, eso muestra:", opts:["Egoísmo","Solidaridad","Indiferencia"], correct:1, lvl:'easy'},
  {q:"Si te equivocas en una tarea y te culpan, lo mejor es:", opts:["Aceptar y disculparse","Culpar a otro","Callarte"], correct:0, lvl:'medium'},
  {q:"Para resolver conflicto entre amigos lo ideal es:", opts:["Ignorar","Hablar y escuchar","Pelear"], correct:1, lvl:'medium'},
  {q:"Si hay bullying en el aula, ¿qué debes hacer?", opts:["Unirte","Informar a un docente y apoyar a la víctima","No meterte"], correct:1, lvl:'hard'}
];
let triviaPool = [], triviaIndex=0;

function initTrivia(){
  document.getElementById('triviaScreen').style.display='block';
  triviaPool = shuffle(triviaQuestions);
  triviaIndex = 0;
  showTriviaQuestion();
}

function showTriviaQuestion(){
  if(triviaIndex >= triviaPool.length){
    endGame('trivia'); return;
  }
  const q = triviaPool[triviaIndex];
  const container = document.getElementById('triviaContent');
  container.innerHTML = `<div class="phrase">${q.q}</div>`;
  const opts = document.createElement('div'); opts.className='options';
  q.opts.forEach((o,i)=>{
    const b = document.createElement('button'); b.className='option-btn'; b.textContent = o;
    b.onclick = ()=> {
      if(i===q.correct){
        let pts = q.lvl==='easy'?10:q.lvl==='medium'?20:30;
        score += pts; document.getElementById('scoreDisplay').textContent = 'Puntos: '+score;
        sounds.ding.play();
        if(q.lvl==='hard'){ awardMedal('🧠 Maestro del Respeto'); addAchievement('Maestro del Respeto'); }
      } else {
        score -= 5; lives--; document.getElementById('livesDisplay').textContent = 'Vidas: '+lives;
        sounds.pop.play();
      }
      if(lives<=0) return endGame('trivia');
      triviaIndex++;
      setTimeout(showTriviaQuestion, 700);
    };
    opts.appendChild(b);
  });
  container.appendChild(opts);
}

// ---------- JUEGO 2: WHO (Quién dijo eso) ----------
function initWho(){
  document.getElementById('whoScreen').style.display='block';
  loadWhoQuestion();
}

function loadWhoQuestion(){
  // pick random phrase from bank (larger pool now)
  const q = frasesBank[Math.floor(Math.random() * frasesBank.length)];
  document.getElementById('whoPhrase').textContent = q.frase;
  const authors = [...new Set(frasesBank.map(f => f.autor))]; // unique authors
  const wrong = pickRandom(authors.filter(a => a !== q.autor), 3);
  const options = shuffle([q.autor, ...wrong]);
  const optDiv = document.getElementById('whoOptions'); optDiv.innerHTML = '';
  options.forEach(name=>{
    const b = document.createElement('button'); b.className='option-btn'; b.textContent = name;
    b.onclick = ()=>{
      if(name === q.autor){
        const delta = Math.max(5, 20 - Math.floor(Math.random()*10));
        score += delta; document.getElementById('scoreDisplay').textContent='Puntos: '+score;
        sounds.ding.play();
        if(score >= 80){ awardMedal('🎭 Conozco a todos'); addAchievement('Conozco a todos'); }
      } else {
        score -= 5; sounds.pop.play();
      }
      setTimeout(loadWhoQuestion, 600);
    };
    optDiv.appendChild(b);
  });
}

// ---------- JUEGO 3: CATCH (Atrapa los útiles escolares) - cooperativo online ----------
/*
  Diseño:
  - Cada jugador, al iniciar el juego, crea/actualiza su nodo en /catch/players/<playerId>
  - Los objetos que caen se manejan localmente (visual), pero cuando atrapas uno, actualizas tu contador en Firebase.
  - Al finalizar el tiempo (GAME_DURATION) leemos todos los jugadores en /catch/players y calculamos resultados; también guardamos el registro en /catch/results.
*/
function initCatch(){
  document.getElementById('coopScreen').style.display='block';
  // ensure root nodes exist
  catchRef.child('players').once('value'); // noop - creates node if needed on writes

  // create a play area inside coopScreen
  const coop = document.getElementById('coopScreen');
  let area = document.getElementById('catchArea');
  if(area) area.remove();
  area = document.createElement('div');
  area.id = 'catchArea';
  area.style.position = 'relative';
  area.style.width = '100%';
  area.style.height = '300px';
  area.style.border = '2px dashed #ccc';
  area.style.marginTop = '12px';
  area.style.overflow = 'hidden';
  coop.appendChild(area);

  // scoreboard & controls
  let scoreBox = document.getElementById('catchScoreBox');
  if(scoreBox) scoreBox.remove();
  scoreBox = document.createElement('div');
  scoreBox.id = 'catchScoreBox';
  scoreBox.innerHTML = `<div style="margin-top:8px">Tu punts: <span id="myCatchScore">0</span></div>
                        <div style="margin-top:6px">Equipo total: <span id="teamCatchTotal">0</span></div>
                        <div style="margin-top:6px"><button id="leftBtn" class="btn ghost">◀</button> <button id="rightBtn" class="btn ghost">▶</button></div>`;
  coop.appendChild(scoreBox);

  // create basket element (player-controlled)
  const basket = document.createElement('div');
  basket.id = 'catchBasket';
  basket.style.position = 'absolute';
  basket.style.bottom = '8px';
  basket.style.left = '50%';
  basket.style.transform = 'translateX(-50%)';
  basket.style.width = '120px';
  basket.style.height = '36px';
  basket.style.background = '#b23b3b';
  basket.style.borderRadius = '8px';
  basket.style.display = 'flex';
  basket.style.alignItems = 'center';
  basket.style.justifyContent = 'center';
  basket.style.color = 'white';
  basket.style.fontWeight = '700';
  basket.textContent = playerName;
  area.appendChild(basket);

  // movement variables
  let basketX = area.clientWidth/2 - 60; // left px
  function updateBasketPosition(){
    basket.style.left = `${basketX}px`;
  }

  // keyboard controls (A/D and arrows)
  function onKey(e){
    if(!catchActive) return;
    const step = 20;
    if(e.key === 'a' || e.key === 'A') basketX = Math.max(0, basketX - step);
    if(e.key === 'd' || e.key === 'D') basketX = Math.min(area.clientWidth - 120, basketX + step);
    if(e.key === 'ArrowLeft') basketX = Math.max(0, basketX - step);
    if(e.key === 'ArrowRight') basketX = Math.min(area.clientWidth - 120, basketX + step);
    updateBasketPosition();
  }
  document.addEventListener('keydown', onKey);

  // on-screen buttons
  document.getElementById('leftBtn').onclick = ()=>{ basketX = Math.max(0, basketX - 40); updateBasketPosition(); };
  document.getElementById('rightBtn').onclick = ()=>{ basketX = Math.min(area.clientWidth - 120, basketX + 40); updateBasketPosition(); };

  // initialize player's score in DB
  const pid = sanitizeId(playerName);
  playerCatchScore = 0;
  catchPlayersRef.child(pid).set({ name: playerName, score: 0, ts: Date.now() });

  // listen team total
  catchPlayersRef.on('value', snap=>{
    const val = snap.val() || {};
    const total = Object.values(val).reduce((s, p) => s + (p.score || 0), 0);
    document.getElementById('teamCatchTotal').textContent = total;
    // if team reaches threshold, award
    if(total >= CATCH_THRESHOLD_TOTAL){
      awardMedal('🤝 Equipo Legendario');
    }
  });

  // spawn loop: create falling items visually, each client spawns its own visuals
  catchActive = true;
  localCatchSpawnInterval = setInterval(()=> spawnCatchItem(area, basket, pid), CATCH_SPAWN_INTERVAL);

  // stop/cleanup will be handled by endGame() which calls stopAllGameActivities()
}

// creates a falling item inside area; checks collision with basket on bottom
function spawnCatchItem(area, basket, pid){
  if(!catchActive) return;
  const item = document.createElement('div');
  item.className = 'catchItem';
  item.style.position = 'absolute';
  const itemSize = 28 + Math.floor(Math.random()*22); // 28-50px
  const maxX = Math.max(0, area.clientWidth - itemSize);
  const startX = Math.floor(Math.random() * maxX);
  item.style.left = `${startX}px`;
  item.style.top = `-40px`;
  item.style.width = `${itemSize}px`;
  item.style.height = `${itemSize}px`;
  item.style.borderRadius = '6px';
  // random school item colors/icons (simple)
  const types = ['📘','✏️','📎','📓','📐','🖍️'];
  const type = types[Math.floor(Math.random()*types.length)];
  item.textContent = type;
  item.style.fontSize = `${Math.max(12, Math.floor(itemSize*0.6))}px`;
  item.style.display = 'flex';
  item.style.alignItems = 'center';
  item.style.justifyContent = 'center';
  area.appendChild(item);

  const startTime = Date.now();
  const duration = CATCH_FALL_TIME + Math.random()*800; // ms to fall
  let rafId = null;
  const animation = { raf: null, el: item, to: null };
  localCatchAnimations.push(animation);

  function animate(){
    const elapsed = Date.now() - startTime;
    const progress = Math.min(1, elapsed / duration);
    const y = progress * (area.clientHeight - 40);
    item.style.top = `${y - 20}px`; // offset
    // collision check when near bottom
    if(progress >= 0.98){
      // compute basket bounds
      const basketRect = basket.getBoundingClientRect();
      const areaRect = area.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      // relative x within area
      const itemCenterX = itemRect.left + itemRect.width/2 - areaRect.left;
      const basketLeft = basket.offsetLeft;
      const basketRight = basketLeft + basket.offsetWidth;
      if(itemCenterX >= basketLeft && itemCenterX <= basketRight){
        // caught
        playerCatchScore++;
        document.getElementById('myCatchScore').textContent = playerCatchScore;
        // update DB
        catchPlayersRef.child(pid).child('score').transaction(old => (old||0)+1);
        // small effect
        sounds.ding.play();
      }
      // remove item
      item.remove();
      // cleanup animation entry
      if(animation.raf) cancelAnimationFrame(animation.raf);
      return;
    }
    animation.raf = requestAnimationFrame(animate);
  }
  animation.raf = requestAnimationFrame(animate);
}

// ---------- JUEGO 4: REACTIONS ----------
let reactTimer = null;
function initReact(){
  document.getElementById('reactScreen').style.display='block';
  reactRound = 0;
  reactTimeLeft = reactTimeTotal = GAME_DURATION;
  document.getElementById('reactBest').textContent = bestReaction ? `Mejor reacción: ${bestReaction} ms` : 'Aún sin mejor tiempo';
  startReactCountdown();
  showReactRound();
}
function startReactCountdown(){
  clearInterval(reactInterval);
  reactInterval = setInterval(()=>{
    reactTimeLeft--;
    document.getElementById('reactTimer').textContent = `⏱ Tiempo restante: ${reactTimeLeft}s`;
    document.getElementById('timeDisplay').textContent = `⏱ ${reactTimeLeft}s`;
    if(reactTimeLeft <= 0){
      clearInterval(reactInterval);
      alert('⏰ Se terminó el tiempo en Batalla de Reacciones.');
      if(bestReaction && bestReaction <= 300) awardMedal('⚡ Reflejos Relámpago');
      endGame('react');
    }
  },1000);
}
function showReactRound(){
  reactRound++;
  const grid = document.getElementById('reactGrid');
  grid.innerHTML = '';
  const correct = reactTargets[Math.floor(Math.random()*reactTargets.length)];
  const pool = shuffle(reactTargets).slice(0,5);
  if(!pool.includes(correct)) pool[0]=correct;
  pool.forEach(text=>{
    const b = document.createElement('button');
    b.className='react-btn';
    b.textContent = text;
    b.onclick = ()=>{
      const reactionMs = Date.now() - roundStart;
      clearTimeout(reactTimer);
      if(text === correct){
        const pts = Math.max(5, 30 - reactRound*2);
        score += pts; document.getElementById('scoreDisplay').textContent='Puntos: '+score;
        sounds.ding.play();
        if(!bestReaction || reactionMs < bestReaction){
          bestReaction = reactionMs;
          localStorage.setItem('bestReaction', bestReaction);
          document.getElementById('reactBest').textContent = `Mejor reacción: ${bestReaction} ms`;
        }
        if(reactionMs <= 300) { awardMedal('⚡ Reflejos Relámpago'); addAchievement('Reflejos Relámpago'); }
      } else {
        score -= 5; lives--; document.getElementById('livesDisplay').textContent = 'Vidas: ' + lives;
        sounds.pop.play();
        if(lives<=0) return endGame('react');
      }
      setTimeout(()=>{ roundStart = Date.now(); showReactRound(); }, 300);
    };
    grid.appendChild(b);
  });
  roundStart = Date.now();
  reactTimer = setTimeout(()=>{
    lives--; document.getElementById('livesDisplay').textContent = 'Vidas: ' + lives;
    if(lives<=0) return endGame('react');
    showReactRound();
  }, 2000);
}

// ---------- END GAME ----------
function endGame(gameType){
  stopAllGameActivities();
  sounds.win.play();
  alert(`Fin de ${gameType.toUpperCase()}! Puntos obtenidos: ${score}`);
  // save individual score
  saveScoreToDB(gameType, score);
  // awards
  if(score >= 100) awardMedal('🥇 Campeón Global');
  if(score >= 30) awardMedal('🥈 Jugador Constante');
  if(playerRef) playerRef.child('score').transaction(old => (old||0) + score);

  // special handling for 'catch': show team results and save record
  if(gameType === 'coop'){
    // read all players in catch and show leaderboard for this session
    catchPlayersRef.once('value').then(snap=>{
      const val = snap.val() || {};
      const arr = Object.values(val).sort((a,b) => (b.score || 0) - (a.score || 0));
      let msg = 'Resultados - Atrapa los útiles (por jugador):\n';
      Object.entries(val).forEach(([pid, p]) => {
        msg += `${p.name}: ${p.score || 0}\n`;
      });
      // push to results log
      db.ref('catch/results').push({ players: val, timestamp: Date.now() });
      alert(msg);
    });
  }

  goHome();
}

// ---------- INIT / BOOT ----------
function initApp(){
  // if playerName present, auto-login
  if(playerName){
    startSession(playerName);
  } else {
    loginScreen.style.display='block';
  }
}

// initial load
document.addEventListener('DOMContentLoaded', initApp);

