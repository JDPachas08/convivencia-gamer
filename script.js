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

// ---------- DATOS ----------
const students = [
  { name: "Andrea", phrase: "Me gusta escuchar música y hacer peinados exóticos." },
  { name: "Loana", phrase: "Siempre estoy dibujando; mi pelo es rizado." },
  { name: "Emmanuel", phrase: "Toco el ukelele y compono canciones." },
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

// ---------- ESTADO ----------
let playerName = localStorage.getItem('playerName') || '';
let playerRef = null;
let score = 0;
let lives = 3;
let currentGame = null;
let globalTime = 30; // 30 segundos
let globalTimerInterval = null;

// ---------- REACCIONES ----------
let reactTargets = ["💨", "⚡", "🔥", "⭐", "🎯", "🏹"];
let reactRound = 0;
let reactTimeLeft = globalTime;
let reactInterval = null;
let roundStart = 0;
let bestReaction = localStorage.getItem('bestReaction') ? Number(localStorage.getItem('bestReaction')) : null;

// ---------- ELEMENTOS UI ----------
const loginScreen = document.getElementById('loginScreen');
const menuScreen = document.getElementById('menuScreen');
const gameArea = document.getElementById('gameArea');
const playerInfo = document.getElementById('playerInfo');
const rankingList = document.getElementById('rankingList');
const medalsPanel = document.getElementById('medalsPanel');
const medalsList = document.getElementById('medalsList');

// ---------- HELPERS ----------
function hideAllScreens(){
  document.querySelectorAll('.screen').forEach(s=>s.style.display='none');
  medalsPanel.style.display='none';
}
function shuffle(arr){ return arr.sort(()=>Math.random()-0.5); }
function sanitizeId(name){ return name.replace(/[^a-z0-9]/gi,'_').toLowerCase(); }

// ---------- LOGIN ----------
document.getElementById('enterBtn').addEventListener('click', () => {
  const nick = document.getElementById('nickname').value.trim();
  if(!nick) return alert('Ingresa un apodo');
  startSession(nick);
});

function startSession(nick){
  playerName = nick;
  localStorage.setItem('playerName', playerName);
  playerRef = db.ref('players/'+sanitizeId(playerName));
  playerRef.once('value').then(snap=>{
    if(!snap.exists()) playerRef.set({ name: playerName, score: 0, medals: [], achievements: [] });
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
  if(!playerRef) playerRef = db.ref('players/'+sanitizeId(playerName));
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
    if(medals.length===0){
      medalsList.innerHTML = '<li>No tienes medallas aún. ¡A jugar! 🎮</li>';
    } else {
      medalsList.innerHTML = medals.map(m=>`<li style="font-size:1.1rem">${m}</li>`).join('');
    }
  });
}

function toggleMedals(){
  medalsPanel.style.display = (medalsPanel.style.display==='none'||medalsPanel.style.display==='') ? 'block' : 'none';
}

function goHome(){
  currentGame = null;
  score = 0; lives = 3;
  reactTimeLeft = globalTime;
  clearInterval(reactInterval);
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
  reactTimeLeft = globalTime;
  document.getElementById('scoreDisplay').textContent = 'Puntos: 0';
  document.getElementById('livesDisplay').textContent = 'Vidas: '+lives;
  document.getElementById('timeDisplay').textContent = `⏱ ${globalTime}s`;
  menuScreen.style.display='none';
  gameArea.style.display='block';
  hideAllScreens();
  sounds.start.play();

  if(type==='trivia'){ initTrivia(); }
  if(type==='who'){ initWho(); }
  if(type==='coop'){ initCoop(); }
  if(type==='react'){ initReact(); }
}

// ---------- TIMER ----------
function startGlobalTimer(){
  clearInterval(globalTimerInterval);
  let timeLeft = globalTime;
  document.getElementById('timeDisplay').textContent = `⏱ ${timeLeft}s`;
  globalTimerInterval = setInterval(()=>{
    timeLeft--;
    document.getElementById('timeDisplay').textContent = `⏱ ${timeLeft}s`;
    if(timeLeft<=0){
      clearInterval(globalTimerInterval);
      endGame(currentGame);
    }
  },1000);
}

// ---------- MEDALS ----------
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

// ---------- TRIVIA ----------
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
  startGlobalTimer();
}

function showTriviaQuestion(){
  if(triviaIndex >= triviaPool.length){
    endGame('trivia'); return;
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
    b.onclick = ()=>{
      if(i===q.correct){
        let pts = q.lvl==='easy'?10:q.lvl==='medium'?20:30;
        score += pts; document.getElementById('scoreDisplay').textContent='Puntos: '+score;
        sounds.ding.play();
        if(q.lvl==='hard'){ awardMedal('🧠 Maestro del Respeto'); addAchievement('Maestro del Respeto'); }
      } else {
        score -= 5; lives--; document.getElementById('livesDisplay').textContent='Vidas: '+lives;
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

// ---------- WHO ----------
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
  startGlobalTimer();
}

function loadWhoQuestion(){
  const q = frasesBank[Math.floor(Math.random()*frasesBank.length)];
  document.getElementById('whoPhrase').textContent = q.frase;
  const authors = frasesBank.map(f=>f.autor);
  const wrong = pickRandom(authors.filter(a=>a!==q.autor),3);
  const options = shuffle([q.autor,...wrong]);
  const optDiv = document.getElementById('whoOptions');
  optDiv.innerHTML = '';
  options.forEach(name=>{
    const b = document.createElement('button');
    b.className='option-btn';
    b.textContent = name;
    b.onclick = ()=>{
      if(name===q.autor){
        const delta = Math.max(5, 20 - Math.floor(Math.random()*10));
        score += delta; document.getElementById('scoreDisplay').textContent='Puntos: '+score;
        sounds.ding.play();
        if(score>=80){ awardMedal('🎭 Conozco a todos'); addAchievement('Conozco a todos'); }
      } else { score-=5; sounds.pop.play(); }
      setTimeout(loadWhoQuestion,600);
    };
    optDiv.appendChild(b);
  });
}

function pickRandom(arr,n){
  const copy = arr.slice(), res=[];
  for(let i=0;i<n && copy.length>0;i++){
    const idx = Math.floor(Math.random()*copy.length);
    res.push(copy.splice(idx,1)[0]);
  }
  return res;
}

// ---------- FÚTBOL COOPERATIVO ----------
let coopScore = 0;
function initCoop(){
  document.getElementById('coopScreen').style.display='block';
  coopScore=0;
  document.getElementById('coopMission').textContent = "¡Haz pases y disparos rápidos para anotar!";
  document.getElementById('coopStatus').textContent = `Puntos: ${coopScore}`;
  startGlobalTimer();

  document.getElementById('coopComplete').onclick = ()=>{
    coopScore += Math.floor(Math.random()*10)+1;
    score += coopScore; document.getElementById('scoreDisplay').textContent='Puntos: '+score;
    document.getElementById('coopStatus').textContent = `Puntos: ${coopScore}`;
    sounds.ding.play();
    if(score>=500){ awardMedal('🥈 Jugador Constante'); }
    if(score>=5000){ awardMedal('🥇 Campeón Global'); }
  };

  document.getElementById('coopNew').onclick = ()=>{
    coopScore=0;
    document.getElementById('coopStatus').textContent = `Puntos: ${coopScore}`;
    sounds.start.play();
  };
}

// ---------- DUEL REFLEJOS ----------
function initReact(){
  document.getElementById('reactScreen').style.display='block';
  reactRound=0;
  reactTimeLeft=globalTime;
  document.getElementById('reactBest').textContent = bestReaction ? `Mejor reacción: ${bestReaction} ms` : 'Aún sin mejor tiempo';
  startGlobalTimer();
  showReactRound();
}

function showReactRound(){
  reactRound++;
  const grid = document.getElementById('reactGrid');
  grid.innerHTML='';
  const target = reactTargets[Math.floor(Math.random()*reactTargets.length)];
  const btn = document.createElement('button');
  btn.className='react-btn';
  btn.textContent = target;
  btn.onclick = ()=>{
    const reactionTime = Date.now() - roundStart;
    if(!bestReaction || reactionTime<bestReaction){
      bestReaction = reactionTime;
      localStorage.setItem('bestReaction', bestReaction);
      document.getElementById('reactBest').textContent = `Mejor reacción: ${bestReaction} ms`;
      if(bestReaction<1000){ awardMedal('⚡ Reflejos Relámpago'); }
    }
    score += 10;
    document.getElementById('scoreDisplay').textContent='Puntos: '+score;
    sounds.ding.play();
    showReactRound();
  };
  grid.appendChild(btn);
  roundStart = Date.now();
}

// ---------- END GAME ----------
function endGame(type){
  clearInterval(globalTimerInterval);
  hideAllScreens();
  alert(`¡Juego terminado!\nTu puntaje: ${score}`);
  if(score>=500){ awardMedal('🥈 Jugador Constante'); }
  if(score>=5000){ awardMedal('🥇 Campeón Global'); }
  saveScoreToDB(type,score);
  goHome();
}

// ---------- DB SCORE ----------
function saveScoreToDB(gameType, pts){
  const id = sanitizeId(playerName);
  const playerScoreRef = db.ref(`scores/${gameType}/${id}`);
  playerScoreRef.set({ name: playerName, score: pts, ts: Date.now() });
  playerRef.child('score').transaction(old => (old||0)+pts);
}
function loadGlobalRanking(){
  db.ref('players').orderByChild('score').limitToLast(20).on('value', snap=>{
    const data = snap.val() || {};
    const arr = Object.values(data).sort((a,b)=>b.score - a.score);
    rankingList.innerHTML = arr.map((p,i)=>`<li>${i+1}. ${p.name} — ${p.score || 0} pts</li>`).join('');
  });
}
