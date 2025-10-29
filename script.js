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
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ---------- DATOS DE ESTUDIANTES ----------
const students = [
  { name: "Andrea", phrase: "Me gusta escuchar música y hacer peinados exóticos." },
  { name: "Loana", phrase: "Siempre estoy dibujando; mi pelo es rizado." },
  { name: "Emmanuel", phrase: "Toco el ukelele y compongo canciones." },
  { name: "Nadiencka", phrase: "Me gusta jugar Roblox y soy bien juguetona." },
  { name: "Sneijder", phrase: "Juego básquet y me encanta el orden." },
  { name: "Lucciana", phrase: "Toco guitarra y uso lentes rosaditos." }
];

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

// Temporizador global (por defecto 30, se puede pasar otro valor)
let globalTime = 30;
let globalTimerInterval = null;

// Reaction game state
let reactTimeLeft = 30;
let reactInterval = null;
let reactRound = 0;
const reactTargets = ["⚡","💥","🔥","🌟","🎯","🎮","🏆","⚽"];

// ---------- UI ELEMENTS ----------
const loginScreen = document.getElementById('loginScreen');
const menuScreen = document.getElementById('menuScreen');
const gameArea = document.getElementById('gameArea');
const playerInfo = document.getElementById('playerInfo');
const rankingList = document.getElementById('rankingList');
const medalsPanel = document.getElementById('medalsPanel');
const medalsList = document.getElementById('medalsList');

// ensure triviaContent exists
let triviaContent = document.getElementById('triviaContent');
if(!triviaContent){
  triviaContent = document.createElement('div');
  triviaContent.id = 'triviaContent';
  const triviaScreen = document.getElementById('triviaScreen');
  if(triviaScreen) triviaScreen.appendChild(triviaContent);
}

// helper to hide screens
function hideAllScreens(){
  document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
  medalsPanel.style.display = 'none';
}

// ---------- LOGIN ----------
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
    if(!snap.exists()) {
      playerRef.set({ name: playerName, score: 0, medals: [], achievements: [] });
    }
    showMenu();
  });
}

function sanitizeId(name){ return name.replace(/[^a-z0-9]/gi,'_').toLowerCase(); }

// ---------- MENU ----------
function showMenu(){
  loginScreen.style.display='none';
  menuScreen.style.display='block';
  playerInfo.style.display='flex';
  document.getElementById('playerNameBadge').textContent = playerName;
  loadGlobalRanking();
  listenPlayerUpdates();
  renderMedalsList();
}

// Listen player updates
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

// render medallas
function renderMedalsList(){
  if(!playerRef) return;
  playerRef.once('value').then(snap=>{
    const val = snap.val() || {};
    const medals = val.medals || [];
    if(medals.length === 0){
      medalsList.innerHTML = '<li>No tienes medallas aún. ¡A jugar! 🎮</li>';
    } else {
      medalsList.innerHTML = medals.map(m => `<li style="font-size:1.1rem">${m}</li>`).join('');
    }
  });
}

function toggleMedals(){
  medalsPanel.style.display = (medalsPanel.style.display === 'none' || medalsPanel.style.display === '') ? 'block' : 'none';
}

function goHome(){
  currentGame = null;
  score = 0;
  lives = 3;
  reactTimeLeft = 30;
  clearInterval(reactInterval);
  clearInterval(globalTimerInterval);
  document.getElementById('scoreDisplay').textContent = 'Puntos: 0';
  document.getElementById('livesDisplay').textContent = '';
  document.getElementById('timeDisplay').textContent = '';
  hideAllScreens();
  gameArea.style.display='none';
  menuScreen.style.display='block';
  sounds.pop.play();
}

// ---------- START GAME ----------
function startGame(type){
  if(!playerName) return alert('Ingresa tu apodo primero');
  currentGame = type;
  score = 0; lives = 3;
  document.getElementById('scoreDisplay').textContent = 'Puntos: 0';
  document.getElementById('livesDisplay').textContent = 'Vidas: ' + lives;
  menuScreen.style.display='none';
  gameArea.style.display='block';
  hideAllScreens();
  sounds.start.play();

  // start timer (coop uses 60s, others 30s)
  if(type === 'coop') startGlobalTimer(60);
  else startGlobalTimer(30);

  if(type==='trivia'){ initTrivia(); }
  if(type==='who'){ initWho(); }
  if(type==='coop'){ initCoop(); }
  if(type==='react'){ initReact(); }
}

// ---------- GLOBAL TIMER ----------
function startGlobalTimer(duration = 30){
  clearInterval(globalTimerInterval);
  globalTime = duration;
  document.getElementById('timeDisplay').textContent = `⏱ ${globalTime}s`;
  globalTimerInterval = setInterval(()=>{
    globalTime--;
    document.getElementById('timeDisplay').textContent = `⏱ ${globalTime}s`;
    if(globalTime <= 0){
      clearInterval(globalTimerInterval);
      alert('⏰ Se terminó el tiempo!');
      endGame(currentGame);
    }
  },1000);
}

// ---------- RANKING ----------
function saveScoreToDB(gameType, pts){
  const id = sanitizeId(playerName);
  const playerScoreRef = db.ref(`scores/${gameType}/${id}`);
  playerScoreRef.set({ name: playerName, score: pts, ts: Date.now() });
  if(playerRef) playerRef.child('score').transaction(old => (old || 0) + pts);
}

function loadGlobalRanking(){
  db.ref('players').orderByChild('score').limitToLast(20).on('value', snap=>{
    const data = snap.val() || {};
    const arr = Object.values(data).sort((a,b)=>b.score - a.score);
    rankingList.innerHTML = arr.map((p,i)=>`<li>${i+1}. ${p.name} — ${p.score || 0} pts</li>`).join('');
  });
}

// ---------- ACHIEVEMENTS / MEDALS ----------
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
  triviaIndex=0;
  showTriviaQuestion();
}
function showTriviaQuestion(){
  if(triviaIndex >= triviaPool.length){
    endGame('trivia');
    return;
  }
  const q = triviaPool[triviaIndex];
  triviaContent.innerHTML = `<div class="phrase">${q.q}</div>`;
  const opts = document.createElement('div'); opts.className='options';
  q.opts.forEach((o,i)=>{
    const b = document.createElement('button');
    b.className='option-btn';
    b.textContent = o;
    b.onclick = ()=>{
      if(i===q.correct){
        let pts = q.lvl==='easy'?10:q.lvl==='medium'?20:30;
        score += pts;
        document.getElementById('scoreDisplay').textContent = 'Puntos: '+score;
        sounds.ding.play();
        if(q.lvl==='hard'){ awardMedal('🧠 Maestro del Respeto'); addAchievement('Maestro del Respeto'); }
      } else {
        score -= 5; lives--; document.getElementById('livesDisplay').textContent = 'Vidas: '+lives;
        sounds.pop.play();
        if(lives<=0) return endGame('trivia');
      }
      triviaIndex++;
      setTimeout(showTriviaQuestion, 700);
    };
    opts.appendChild(b);
  });
  triviaContent.appendChild(opts);
}

// ---------- JUEGO 2: WHO ----------
const frasesBank = [
  { frase: "Me encanta hacer peinados locos.", autor: "Andrea" },
  { frase: "Nada me relaja más que dibujar.", autor: "Loana" },
  { frase: "Amo tocar el ukelele y componer canciones.", autor: "Emmanuel" },
  { frase: "Roblox todo el día, todos los días.", autor: "Nadiencka" },
  { frase: "Siempre con energía para el básquet.", autor: "Sneijder" },
  { frase: "Mi guitarra y mis lentes rosados son mi estilo.", autor: "Lucciana" }
];

function initWho(){
  document.getElementById('whoScreen').style.display='block';
  loadWhoQuestion();
}

function loadWhoQuestion(){
  const q = frasesBank[Math.floor(Math.random() * frasesBank.length)];
  document.getElementById('whoPhrase').textContent = q.frase;
  const authors = frasesBank.map(f => f.autor);
  const wrong = pickRandom(authors.filter(a => a !== q.autor), 3);
  const options = shuffle([q.autor, ...wrong]);
  const optDiv = document.getElementById('whoOptions');
  optDiv.innerHTML = '';
  options.forEach(name=>{
    const b = document.createElement('button');
    b.className='option-btn';
    b.textContent = name;
    b.onclick = ()=>{
      if(name === q.autor){
        const delta = Math.max(5, 20 - Math.floor(Math.random()*10));
        score += delta; sounds.ding.play();
      } else {
        score -= 5; lives--; document.getElementById('livesDisplay').textContent = 'Vidas: ' + lives;
        sounds.pop.play();
        if(lives<=0) return endGame('who');
      }
      document.getElementById('scoreDisplay').textContent='Puntos: '+score;
      setTimeout(loadWhoQuestion, 600);
    };
    optDiv.appendChild(b);
  });
}

// ---------- JUEGO 3: CAZA OBJETOS (LOCAL, 30s) ----------
/*
  Reglas:
  - Aparecen objetos (emojis) en la pantalla.
  - Solo debes hacer clic en los objetos correctos según la categoría indicada.
  - Cada acierto suma puntos, cada error resta puntos o vida.
  - La velocidad aumenta gradualmente.
*/

const catchObjectsCategories = [
  { name: "⚽ Deportes", target: "⚽", distractors: ["🍎","🐶","🎮","🌟"] },
  { name: "🍎 Comida", target: "🍎", distractors: ["⚽","🐱","🎯","🔥"] },
  { name: "🐶 Animales", target: "🐶", distractors: ["🍌","⚽","🎮","🌟"] },
  { name: "🎮 Juegos", target: "🎮", distractors: ["🍎","🐱","⚽","🌟"] }
];

let catchObjectsInterval = null;
let catchObjectsTime = 30;
let catchObjectsScore = 0;
let catchObjectsLives = 3;
let currentCategory = null;

function initCoop(){
  const screen = document.getElementById('coopScreen');
  screen.style.display='block';
  screen.innerHTML = ''; // clear previous content

  // header
  const header = document.createElement('div');
  header.className = 'center';
  screen.appendChild(header);

  // choose random category
  currentCategory = pickRandom(catchObjectsCategories,1)[0];
  header.innerHTML = `<h2>Caza Objetos 🏹</h2>
    <p class="muted small">Categoría: <strong>${currentCategory.name}</strong></p>
  `;

  // create game area
  const areaDiv = document.createElement('div');
  areaDiv.id = 'catchArea';
  areaDiv.style.cssText = 'position:relative;width:100%;height:300px;border:1px solid #ccc;background:#f9f9f9;overflow:hidden;border-radius:12px;margin-top:12px;';
  screen.appendChild(areaDiv);

  // info & controls
  const infoDiv = document.createElement('div');
  infoDiv.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-top:10px;';
  infoDiv.innerHTML = `
    <div>Puntos: <span id="catchScore">${catchObjectsScore}</span></div>
    <div>Vidas: <span id="catchLives">${catchObjectsLives}</span></div>
    <div>Tiempo: <span id="catchTime">${catchObjectsTime}s</span></div>
    <button id="catchEndEarly" class="btn ghost">Terminar juego</button>
  `;
  screen.appendChild(infoDiv);

  document.getElementById('catchEndEarly').onclick = endCatchObjects;

  catchObjectsScore = 0;
  catchObjectsLives = 3;
  catchObjectsTime = 30;
  spawnObjectLoop();
  startCatchTimer();
}

function startCatchTimer(){
  clearInterval(catchObjectsInterval);
  catchObjectsInterval = setInterval(()=>{
    catchObjectsTime--;
    document.getElementById('catchTime').textContent = `${catchObjectsTime}s`;
    if(catchObjectsTime <= 0){
      clearInterval(catchObjectsInterval);
      finalizeCatchObjects();
    }
  },1000);
}

function spawnObjectLoop(){
  const area = document.getElementById('catchArea');
  if(!area) return;
  const spawn = ()=>{
    const isTarget = Math.random() < 0.5; // 50% probabilidad
    const emoji = isTarget ? currentCategory.target : pickRandom(currentCategory.distractors,1)[0];
    const obj = document.createElement('div');
    obj.textContent = emoji;
    obj.style.position = 'absolute';
    obj.style.fontSize = '28px';
    obj.style.cursor = 'pointer';
    obj.style.top = Math.random()*250 + 'px';
    obj.style.left = Math.random()*90 + '%';
    obj.style.transition = 'transform 0.5s linear';
    obj.onclick = ()=>{
      if(emoji === currentCategory.target){
        catchObjectsScore += 10;
        sounds.ding.play();
      } else {
        catchObjectsScore -= 5;
        catchObjectsLives--;
        sounds.pop.play();
        document.getElementById('catchLives').textContent = catchObjectsLives;
        if(catchObjectsLives <= 0) return finalizeCatchObjects();
      }
      document.getElementById('catchScore').textContent = catchObjectsScore;
      obj.remove();
    };
    area.appendChild(obj);
    setTimeout(()=>{ obj.style.transform = 'translateY(260px)'; },10);
    setTimeout(()=>{ if(obj.parentElement) obj.remove(); },2500);
  };
  const speed = Math.max(400, 1200 - (catchObjectsScore*5));
  catchObjectsInterval = setInterval(spawn, speed);
}

function endCatchObjects(){
  clearInterval(catchObjectsInterval);
  finalizeCatchObjects();
}

function finalizeCatchObjects(){
  clearInterval(catchObjectsInterval);
  alert(`Juego terminado! Obtuviste ${catchObjectsScore} puntos.`);
  saveScoreToDB('coop', catchObjectsScore);
  if(catchObjectsScore>=200) awardMedal('🎯 Maestro Cazador');
  else if(catchObjectsScore>=100) awardMedal('🏹 Cazador Hábil');
  goHome();
}


// ---------- JUEGO 4: REACT (GOLPE RÁPIDO CON OBJETIVO VISIBLE) ----------
function initReact(){
  document.getElementById('reactScreen').style.display='block';
  reactGrid = document.getElementById('reactGrid');
  reactRound = 0;
  reactTimeLeft = 30;
  startReactRound();

  clearInterval(reactInterval);
  reactInterval = setInterval(()=>{
    reactTimeLeft--;
    document.getElementById('timeDisplay').textContent = `⏱ ${reactTimeLeft}s`;
    if(reactTimeLeft<=0){
      clearInterval(reactInterval);
      endGame('react');
    }
  },1000);
}

function startReactRound(){
  reactGrid.innerHTML='';
  reactRound++;
  const target = reactTargets[Math.floor(Math.random()*reactTargets.length)];
  document.getElementById('reactTarget').textContent = `Presiona rápido: ${target}`;

  const buttons = shuffle([...reactTargets]);
  if(!buttons.includes(target)) buttons[0] = target;
  buttons.forEach(btn=>{
    const b = document.createElement('button');
    b.className='react-btn';
    b.textContent = btn;
    b.onclick = ()=>{
      if(btn === target){
        score += 15; sounds.ding.play();
      } else {
        score -= 5; sounds.pop.play();
        lives--;
        document.getElementById('livesDisplay').textContent = 'Vidas: ' + lives;
        if(lives<=0) return endGame('react');
      }
      document.getElementById('scoreDisplay').textContent = 'Puntos: ' + score;
      startReactRound();
    };
    reactGrid.appendChild(b);
  });
}

// ---------- UTIL ----------
function shuffle(arr){ return arr.sort(()=>Math.random()-0.5); }
function pickRandom(arr,n){ return shuffle(arr).slice(0,n); }

// ---------- END GAME ----------
function endGame(game){
  clearInterval(globalTimerInterval);
  clearInterval(reactInterval);
  alert(`🎮 Juego terminado! Obtuviste ${score} puntos`);
  saveScoreToDB(game, score);
  if(score>=5000) awardMedal('🏆 Leyenda');
  else if(score>=500) awardMedal('🥇 Prodigio');
  goHome();
}

// ---------- INIT ----------
document.addEventListener('DOMContentLoaded', ()=>{
  if(playerName) startSession(playerName);
  else loginScreen.style.display='block';
});
