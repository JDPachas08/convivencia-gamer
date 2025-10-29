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
  cheer: new Audio('assets/sounds/cheer.mp3')
};

// ---------- ESTADO GLOBAL ----------
let playerName = localStorage.getItem('playerName') || '';
let playerRef = null;
let score = 0;
let lives = 3;
let currentGame = null;

// ---------- UI ELEMENTS ----------
const loginScreen = document.getElementById('loginScreen');
const menuScreen = document.getElementById('menuScreen');
const gameArea = document.getElementById('gameArea');
const playerInfo = document.getElementById('playerInfo');
const rankingList = document.getElementById('rankingList');

document.getElementById('enterBtn').addEventListener('click', () => {
  const nick = document.getElementById('nickname').value.trim();
  if(!nick) return alert('Ingresa un apodo');
  startSession(nick);
});

// Start session
function startSession(nick){
  playerName = nick;
  localStorage.setItem('playerName', playerName);
  // Create player node if not exists
  playerRef = db.ref('players/' + sanitizeId(playerName));
  playerRef.once('value').then(snap=>{
    if(!snap.exists()) {
      playerRef.set({ name: playerName, score: 0, medals: [], achievements: [] });
    }
    showMenu();
  });
}

// sanitize ID for DB keys
function sanitizeId(name){ return name.replace(/[^a-z0-9]/gi,'_').toLowerCase(); }

// Show menu
function showMenu(){
  loginScreen.style.display='none';
  menuScreen.style.display='block';
  playerInfo.style.display='flex';
  document.getElementById('playerNameBadge').textContent = playerName;
  loadGlobalRanking();
  listenPlayerUpdates();
}

// Listen player updates (medals, etc)
function listenPlayerUpdates(){
  playerRef.on('value', snap=>{
    const val = snap.val();
    if(!val) return;
    const medals = val.medals || [];
    document.getElementById('medalsBadge').innerHTML = medals.map(m => `<span>${m}</span>`).join(' ');
  });
}

// Go home
function goHome(){
  currentGame = null;
  score = 0;
  lives = 3;
  document.getElementById('scoreDisplay').textContent = 'Puntos: 0';
  document.getElementById('livesDisplay').textContent = '';
  document.querySelectorAll('.screen').forEach(s=>s.style.display='none');
  document.getElementById('gameArea').style.display='none';
  document.getElementById('menuScreen').style.display='block';
  sounds.pop.play();
}

// Start game
function startGame(type){
  if(!playerName) return alert('Ingresa tu apodo primero');
  currentGame = type;
  score = 0; lives = 3;
  document.getElementById('scoreDisplay').textContent = 'Puntos: 0';
  document.getElementById('livesDisplay').textContent = 'Vidas: ' + lives;
  document.getElementById('menuScreen').style.display='none';
  document.getElementById('gameArea').style.display='block';
  document.querySelectorAll('.screen').forEach(s=>s.style.display='none');
  sounds.start.play();

  if(type==='trivia'){ initTrivia(); }
  if(type==='who'){ initWho(); }
  if(type==='coop'){ initCoop(); }
  if(type==='react'){ initReact(); }
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
  // load combined ranking by reading /players and sorting
  db.ref('players').orderByChild('score').limitToLast(20).on('value', snap=>{
    const data = snap.val() || {};
    const arr = Object.values(data).sort((a,b)=>b.score - a.score);
    rankingList.innerHTML = arr.map((p,i)=>`<li>${i+1}. ${p.name} — ${p.score || 0} pts</li>`).join('');
  });
}

// ---------- ACHIEVEMENTS / MEDALS ----------
function awardMedal(name){
  playerRef.child('medals').transaction(old=>{
    old = old || [];
    if(!old.includes(name)) old.push(name);
    return old;
  });
}

function addAchievement(name){
  playerRef.child('achievements').transaction(old=>{
    old = old || [];
    if(!old.includes(name)) old.push(name);
    return old;
  });
}

// ---------- JUEGO 1: TRIVIA (niveles) ----------
const triviaQuestions = [
  // fácil
  {q:"¿Qué harías si ves a alguien triste en clase?", opts:["Reírte","Preguntar si está bien","Ignorarlo"], correct:1, lvl:'easy'},
  {q:"Si un compañero comparte su merienda, eso muestra:", opts:["Egoísmo","Solidaridad","Indiferencia"], correct:1, lvl:'easy'},
  // medio
  {q:"Si te equivocas en una tarea y te culpan, lo mejor es:", opts:["Aceptar y disculparse","Culpar a otro","Callarte"], correct:0, lvl:'medium'},
  {q:"Para resolver conflicto entre amigos lo ideal es:", opts:["Ignorar","Hablar y escuchar","Pelear"], correct:1, lvl:'medium'},
  // difícil
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
  const container = document.getElementById('triviaContent');
  container.innerHTML = `<div class="phrase">${q.q}</div>`;
  const opts = document.createElement('div');
  opts.className='options';
  q.opts.forEach((o,i)=>{
    const b = document.createElement('button');
    b.className='option-btn';
    b.textContent = o;
    b.onclick = ()=> {
      if(i===q.correct){ // correct
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
  showWhoRound();
}

function showWhoRound(){
  const idx = Math.floor(Math.random()*students.length);
  const phrase = students[idx].phrase;
  document.getElementById('whoPhrase').textContent = phrase;
  const options = shuffle([...students.map(s=>s.name)]);
  // ensure correct present
  if(!options.includes(students[idx].name)) options[0] = students[idx].name;
  const optDiv = document.getElementById('whoOptions');
  optDiv.innerHTML = '';
  options.slice(0,4).forEach(name=>{
    const b = document.createElement('button');
    b.className='option-btn';
    b.textContent = name;
    b.onclick = ()=>{
      if(name===students[idx].name){
        const delta = Math.max(5, 25 - Math.floor(Math.random()*10));
        score += delta; document.getElementById('scoreDisplay').textContent='Puntos: '+score;
        sounds.ding.play();
        // possible medal
        if(score >= 80){ awardMedal('🎭 Conozco a todos'); addAchievement('Conozco a todos'); }
      } else {
        score -= 5; sounds.pop.play();
      }
      setTimeout(showWhoRound, 600);
    };
    optDiv.appendChild(b);
  });
}

// ---------- JUEGO 3: COOP (Misión en Equipo) ----------
/*
  Modo cooperativo:
  - DB node: /missions/current
  - host (first who clicks "Nuevo") can create nueva misión.
  - players see misión y pueden marcar "Completado".
  - cuando un número X de players completan -> misión completada y se reparte recompensa.
*/
const coopMissionRef = db.ref('missions/current');
let coopCompletedBy = {};

function initCoop(){
  document.getElementById('coopScreen').style.display='block';
  document.getElementById('coopStatus').textContent = 'Conectando a misión...';
  // Listen mission updates
  coopMissionRef.on('value', snap=>{
    const m = snap.val();
    if(!m || !m.text){
      document.getElementById('coopMission').textContent = 'No hay misión activa. Pide a alguien generar una.';
      document.getElementById('coopStatus').textContent = 'Sin misión';
      coopCompletedBy = {};
      return;
    }
    document.getElementById('coopMission').textContent = m.text;
    coopCompletedBy = m.completedBy || {};
    renderCoopStatus(m);
  });
  // Buttons
  document.getElementById('coopComplete').onclick = ()=>{
    // mark current player as completed
    coopMissionRef.child('completedBy').child(sanitizeId(playerName)).set(true);
    sounds.cheer.play();
  };
  // only host (first to press "Nuevo") will create next (we'll allow anyone to create for simplicity)
  document.getElementById('coopNew').onclick = ()=>{
    // generate random mission from bank
    const bank = [
      "Encuentren 3 valores que todos compartan.",
      "Decidan en equipo quién organiza una mesa para una actividad.",
      "Completen la frase: 'Para mejorar la convivencia, debemos...'",
      "Elijan 3 acciones para ayudar a un compañero nuevo."
    ];
    const next = bank[Math.floor(Math.random()*bank.length)];
    coopMissionRef.set({ text: next, createdAt: Date.now(), completedBy: {} });
    sounds.start.play();
  };
}

function renderCoopStatus(m){
  const completed = m.completedBy ? Object.keys(m.completedBy).length : 0;
  document.getElementById('coopStatus').textContent = `Completado por ${completed} jugador(es).`;
  // When ≥2 players complete (umbral) -> reward all
  if(completed >= 2 && !m.resolved){
    // reward: +30 pts to each player who is present (simple design)
    // set resolved flag to prevent double reward
    coopMissionRef.update({ resolved: true });
    // reward all players in DB players list: for simplicity we reward current player only and store record
    // In real setting, iterate known players; here we update the mission rewards node
    db.ref('missions/rewards').push({ mission: m.text, timestamp: Date.now() });
    // local reward
    score += 30;
    playerRef.child('score').transaction(old => (old||0)+30);
    awardMedal('🤝 Equipo Legendario');
    addAchievement('Equipo Legendario');
    document.getElementById('scoreDisplay').textContent = 'Puntos: '+score;
    sounds.win.play();
    setTimeout(()=> alert('¡Misión completada! Todos ganan +30 pts.'), 300);
  }
}

// ---------- JUEGO 4: REACTIONS ----------
let reactTargets = ["Respeto","Solidaridad","Tolerancia","Escuchar","Compartir","Paz"];
let reactTimer = null, reactRound = 0;

function initReact(){
  document.getElementById('reactScreen').style.display='block';
  reactRound = 0;
  showReactRound();
}

function showReactRound(){
  reactRound++;
  const grid = document.getElementById('reactGrid');
  grid.innerHTML = '';
  // pick correct target
  const correct = reactTargets[Math.floor(Math.random()*reactTargets.length)];
  // create pool with distractors
  const pool = shuffle(reactTargets).slice(0,5);
  if(!pool.includes(correct)) pool[0]=correct;
  pool.forEach(text=>{
    const b = document.createElement('button');
    b.className='react-btn';
    b.textContent = text;
    b.onclick = ()=>{
      clearTimeout(reactTimer);
      if(text===correct){
        const pts = Math.max(5, 30 - reactRound*2);
        score += pts; document.getElementById('scoreDisplay').textContent='Puntos: '+score;
        sounds.ding.play();
        // combos: award medal for streak
        if(reactRound>=10){ awardMedal('⚡ Reflejos Relámpago'); addAchievement('Reflejos Relámpago'); }
      } else {
        score -= 5; lives--; document.getElementById('livesDisplay').textContent = 'Vidas: ' + lives;
        sounds.pop.play();
        if(lives<=0) return endGame('react');
      }
      setTimeout(showReactRound, 400);
    };
    grid.appendChild(b);
  });
  // timeout to auto-advance (fail)
  reactTimer = setTimeout(()=>{
    lives--; document.getElementById('livesDisplay').textContent = 'Vidas: ' + lives;
    if(lives<=0) return endGame('react');
    showReactRound();
  }, 2000);
}

// ---------- END GAME ----------
function endGame(gameType){
  // show summary and save to DB
  sounds.win.play();
  alert(`Fin de ${gameType.toUpperCase()}! Puntos obtenidos: ${score}`);
  saveScoreToDB(gameType, score);
  // award common medals
  if(score >= 100) awardMedal('🥇 Campeón Global');
  if(score >= 30) awardMedal('🥈 Jugador Constante');
  // update player locally too
  playerRef.child('score').transaction(old => (old||0) + score);
  goHome();
}

// ---------- HELPERS ----------
function shuffle(arr){ return arr.sort(()=>Math.random()-0.5); }

// initial load
document.addEventListener('DOMContentLoaded', ()=>{
  if(playerName){
    startSession(playerName);
  } else {
    loginScreen.style.display='block';
  }
});
