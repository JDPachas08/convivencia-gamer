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

// ---------- SONIDOS ----------
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
let gameTime = 30;
let timerInterval = null;

// ---------- ELEMENTOS DEL DOM ----------
const loginScreen = document.getElementById('loginScreen');
const menuScreen = document.getElementById('menuScreen');
const gameArea = document.getElementById('gameArea');
const playerInfo = document.getElementById('playerInfo');
const rankingList = document.getElementById('rankingList');
const medalsPanel = document.getElementById('medalsPanel');
const medalsList = document.getElementById('medalsList');
const scoreDisplay = document.getElementById('scoreDisplay');
const livesDisplay = document.getElementById('livesDisplay');
const timeDisplay = document.getElementById('timeDisplay');

// ---------- LOGIN ----------
document.getElementById('enterBtn').addEventListener('click', ()=>{
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
      playerRef.set({name:playerName, score:0, medals:[], achievements:[]});
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
  renderMedalsList();
  loadGlobalRanking();
}

// ---------- MEDALLAS ----------
function renderMedalsList(){
  if(!playerRef) return;
  playerRef.once('value').then(snap=>{
    const val = snap.val() || {};
    const medals = val.medals || [];
    if(medals.length===0) medalsList.innerHTML = '<li>No tienes medallas aún. ¡A jugar! 🎮</li>';
    else medalsList.innerHTML = medals.map(m=>`<li>${m}</li>`).join('');
  });
}

function toggleMedals(){
  medalsPanel.style.display = (medalsPanel.style.display==='none' || medalsPanel.style.display==='') ? 'block':'none';
}

// ---------- JUEGOS ----------
function startGame(type){
  if(!playerName) return alert('Ingresa tu apodo primero');
  currentGame = type;
  score = 0; lives = 3;
  scoreDisplay.textContent = 'Puntos: 0';
  livesDisplay.textContent = 'Vidas: ' + lives;
  timeDisplay.textContent = `⏱ ${gameTime}s`;
  menuScreen.style.display='none';
  gameArea.style.display='block';
  hideAllScreens();
  startTimer();

  if(type==='trivia'){ initTrivia(); }
  if(type==='who'){ initWho(); }
  if(type==='coop'){ initFootball(); }
  if(type==='react'){ initReact(); }
}

function hideAllScreens(){
  document.querySelectorAll('.screen').forEach(s=>s.style.display='none');
}

// ---------- TIMER ----------
function startTimer(){
  clearInterval(timerInterval);
  let timeLeft = gameTime;
  timeDisplay.textContent = `⏱ ${timeLeft}s`;
  timerInterval = setInterval(()=>{
    timeLeft--;
    timeDisplay.textContent = `⏱ ${timeLeft}s`;
    if(timeLeft<=0){
      clearInterval(timerInterval);
      alert(`Se acabó el tiempo en ${currentGame.toUpperCase()}`);
      endGame();
    }
  },1000);
}

// ---------- RANKING ----------
function saveScoreToDB(){
  if(!playerRef) return;
  playerRef.child('score').transaction(old=>(old||0)+score);
  loadGlobalRanking();
}

function loadGlobalRanking(){
  db.ref('players').orderByChild('score').limitToLast(20).once('value', snap=>{
    const data = snap.val() || {};
    const arr = Object.values(data).sort((a,b)=>b.score - a.score);
    rankingList.innerHTML = arr.map((p,i)=>`<li>${i+1}. ${p.name} — ${p.score || 0} pts</li>`).join('');
  });
}

// ---------- MEDALLAS Y LOGROS ----------
function awardMedal(name){
  if(!playerRef) return;
  playerRef.child('medals').transaction(old=>{
    old=old||[];
    if(!old.includes(name)) old.push(name);
    return old;
  });
}

// ---------- TRIVIA ----------
const triviaQuestions = [
  {q:"¿Qué harías si ves a alguien triste en clase?", opts:["Reírte","Preguntar si está bien","Ignorarlo"], correct:1},
  {q:"Si un compañero comparte su merienda, eso muestra:", opts:["Egoísmo","Solidaridad","Indiferencia"], correct:1},
  {q:"Si te equivocas en una tarea y te culpan, lo mejor es:", opts:["Aceptar y disculparse","Culpar a otro","Callarte"], correct:0},
  {q:"Para resolver conflicto entre amigos lo ideal es:", opts:["Ignorar","Hablar y escuchar","Pelear"], correct:1},
  {q:"Si hay bullying en el aula, ¿qué debes hacer?", opts:["Unirte","Informar a un docente y apoyar a la víctima","No meterte"], correct:1}
];
let triviaIndex=0;
function initTrivia(){
  triviaIndex=0;
  document.getElementById('triviaScreen').style.display='block';
  showTriviaQuestion();
}
function showTriviaQuestion(){
  const container = document.getElementById('triviaScreen');
  if(triviaIndex>=triviaQuestions.length){ endGame(); return; }
  const q = triviaQuestions[triviaIndex];
  container.innerHTML = `<div class="phrase">${q.q}</div>`;
  const opts = document.createElement('div');
  opts.className='options';
  q.opts.forEach((o,i)=>{
    const b = document.createElement('button');
    b.className='option-btn';
    b.textContent = o;
    b.onclick = ()=>{
      if(i===q.correct){ score+=10; sounds.ding.play(); }
      else{ score-=5; lives--; sounds.pop.play(); livesDisplay.textContent='Vidas: '+lives; if(lives<=0) return endGame(); }
      scoreDisplay.textContent='Puntos: '+score;
      triviaIndex++;
      setTimeout(showTriviaQuestion, 500);
    };
    opts.appendChild(b);
  });
  container.appendChild(opts);
}

// ---------- WHO ----------
const whoPhrases = [
  {frase:"Me encanta hacer peinados locos","autor":"Andrea"},
  {frase:"Nada me relaja más que dibujar","autor":"Loana"},
  {frase:"Amo tocar el ukelele","autor":"Emmanuel"},
  {frase:"Roblox todo el día","autor":"Nadiencka"},
  {frase:"Siempre con energía para el básquet","autor":"Sneijder"},
  {frase:"Mi guitarra y lentes rosados","autor":"Lucciana"}
];
function initWho(){
  document.getElementById('whoScreen').style.display='block';
  showWhoQuestion();
}
function showWhoQuestion(){
  const q = whoPhrases[Math.floor(Math.random()*whoPhrases.length)];
  document.getElementById('whoPhrase').textContent=q.frase;
  const authors = whoPhrases.map(f=>f.autor);
  const wrong = shuffle(authors.filter(a=>a!==q.autor)).slice(0,2);
  const options = shuffle([q.autor,...wrong]);
  const container=document.getElementById('whoOptions');
  container.innerHTML='';
  options.forEach(name=>{
    const b=document.createElement('button');
    b.className='option-btn';
    b.textContent=name;
    b.onclick=()=>{
      if(name===q.autor) score+=10;
      else{ score-=5; lives--; livesDisplay.textContent='Vidas: '+lives; if(lives<=0) return endGame(); }
      scoreDisplay.textContent='Puntos: '+score;
      setTimeout(showWhoQuestion,500);
    };
    container.appendChild(b);
  });
}

// ---------- JUEGO 3: MINI FÚTBOL ----------
let footballScore=0;
function initFootball(){
  document.getElementById('coopScreen').style.display='block';
  footballScore=0;
  document.getElementById('coopScore').textContent='Goles: '+footballScore;
  const btn=document.getElementById('coopGoalBtn');
  btn.onclick=()=>{
    const success=Math.random()<0.5;
    if(success){ footballScore++; score+=10; sounds.ding.play(); }
    else{ score-=5; sounds.pop.play(); lives--; livesDisplay.textContent='Vidas: '+lives; if(lives<=0) return endGame(); }
    scoreDisplay.textContent='Puntos: '+score;
    document.getElementById('coopScore').textContent='Goles: '+footballScore;
  };
}

// ---------- JUEGO 4: REACCIONES RÁPIDAS ----------
let reactRound=0;
const reactTargets=["🔴","🟢","🔵","🟡","🟠"];
function initReact(){
  document.getElementById('reactScreen').style.display='block';
  showReactRound();
}
function showReactRound(){
  reactRound++;
  const grid=document.getElementById('reactGrid');
  grid.innerHTML='';
  const target=reactTargets[Math.floor(Math.random()*reactTargets.length)];
  document.getElementById('reactTarget').textContent='Objetivo: '+target;
  const pool=shuffle(reactTargets);
  if(!pool.includes(target)) pool[0]=target;
  pool.forEach(t=>{
    const b=document.createElement('button');
    b.className='react-btn';
    b.textContent=t;
    b.onclick=()=>{
      if(t===target){ score+=10; sounds.ding.play(); }
      else{ score-=5; lives--; sounds.pop.play(); livesDisplay.textContent='Vidas: '+lives; if(lives<=0) return endGame(); }
      scoreDisplay.textContent='Puntos: '+score;
      setTimeout(showReactRound,300);
    };
    grid.appendChild(b);
  });
}

// ---------- END GAME ----------
function endGame(){
  clearInterval(timerInterval);
  alert(`Fin del juego! Puntos: ${score}`);
  if(score>=5000) awardMedal('🥇 Campeón Global');
  else if(score>=500) awardMedal('🥈 Jugador Constante');
  saveScoreToDB();
  goHome();
}

function goHome(){
  currentGame=null;
  score=0;
  lives=3;
  hideAllScreens();
  gameArea.style.display='none';
  menuScreen.style.display='block';
}

// ---------- HELPERS ----------
function shuffle(arr){ return arr.sort(()=>Math.random()-0.5); }

// ---------- INIT ----------
document.addEventListener('DOMContentLoaded', ()=>{
  if(playerName) startSession(playerName);
  else loginScreen.style.display='block';
});
