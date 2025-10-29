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

// ---------- JUEGO 3: PALABRAS EN EQUIPO (LOCAL, 60s) ----------
/*
  Reglas:
  - Dos jugadores locales (misma PC) se turnan.
  - Al iniciar se generan N letras (por ejemplo 7).
  - En 60 segundos deben formar tantas palabras válidas como puedan.
  - Cada palabra válida da puntos = longitud * 10.
  - Se utiliza un diccionario interno pequeño para validar palabras.
*/

const smallSpanishDict = new Set([
  "sol","mar","casa","mesa","silla","amor","paz","luz","niño","niña","amigo","amiga",
  "libro","agua","pan","jugar","juego","cantar","bailar","verde","rojo","azul","tierra",
  "estrella","flor","mundo","familia","escuela","docente","estudio","comer","beber",
  "caminar","hablar","escuchar","ayudar","compartir","reir","sonreir","sueño","viaje",
  "perro","gato","corazon","amable","respeto","valor","trabajo","equipo","unidad",
  "salud","tiempo","clase","orden","ayuda","cuidado","fuerza","mente","crecer"
]);

function initCoop(){
  // show coop screen and build UI dynamically inside it
  const screen = document.getElementById('coopScreen');
  screen.style.display = 'block';
  screen.innerHTML = ''; // clear previous content

  // create UI
  const header = document.createElement('div');
  header.className = 'center';
  header.innerHTML = `<h2>Palabras en Equipo 🧩</h2><p class="muted small">Dos jugadores en la misma PC. 60 segundos para formar palabras válidas.</p>`;
  screen.appendChild(header);

  const namesRow = document.createElement('div');
  namesRow.className = 'row';
  namesRow.style.marginTop = '10px';
  namesRow.innerHTML = `
    <input id="coopPlayer1" placeholder="Jugador 1 (opcional)" style="max-width:220px" />
    <input id="coopPlayer2" placeholder="Jugador 2 (opcional)" style="max-width:220px" />
    <button id="coopStartBtn" class="btn primary">Iniciar Partida</button>
  `;
  screen.appendChild(namesRow);

  const gameAreaDiv = document.createElement('div');
  gameAreaDiv.style.width = '100%';
  gameAreaDiv.style.marginTop = '14px';
  screen.appendChild(gameAreaDiv);

  // state for coop game
  let coopScore = 0;
  let letters = [];
  let currentTurn = 1; // 1 or 2
  let coopTimer = null;
  let timeLeft = 60;
  let gameRunning = false;

  // helpers
  function genLetters(n = 7){
    const alphabet = "abcdefghijklmnñopqrstuvwxyz";
    const arr = [];
    // A slightly biased generator to include vowels more often
    for(let i=0;i<n;i++){
      const isVowel = Math.random() < 0.36;
      if(isVowel){
        const vowels = "aeiou";
        arr.push(vowels[Math.floor(Math.random()*vowels.length)]);
      } else {
        arr.push(alphabet[Math.floor(Math.random()*alphabet.length)]);
      }
    }
    return arr;
  }

  function renderGameUI(){
    gameAreaDiv.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <div style="font-weight:800;color:var(--navy);">Letras:</div>
        <div id="coopLetters" style="display:flex;gap:8px;flex-wrap:wrap"></div>
        <div style="margin-left:auto;font-weight:800;color:var(--red)" id="coopTime">⏱ ${timeLeft}s</div>
      </div>
      <div style="margin-top:12px;">
        <div style="font-weight:700">Turno: <span id="coopTurn">Jugador ${currentTurn}</span></div>
        <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <input id="coopWordInput" placeholder="Escribe una palabra con las letras..." style="flex:1;min-width:180px;padding:10px;border-radius:8px;border:1px solid rgba(0,0,0,0.06)" />
          <button id="coopSubmitWord" class="btn">Enviar</button>
          <button id="coopSkip" class="btn ghost">Pasar turno</button>
        </div>
        <div id="coopFeedback" class="muted small" style="margin-top:8px"></div>
        <div style="margin-top:12px;display:flex;gap:12px;align-items:center">
          <div style="font-weight:800">Puntos del equipo: <span id="coopScoreDisplay">${coopScore}</span></div>
          <div style="margin-left:auto">
            <button id="coopEndEarly" class="btn ghost">Terminar partida</button>
          </div>
        </div>
        <div style="margin-top:12px" id="coopWordsListContainer">
          <strong>Palabras aceptadas:</strong>
          <ul id="coopWordsList" style="margin-top:8px"></ul>
        </div>
      </div>
    `;

    const lettersDiv = document.getElementById('coopLetters');
    lettersDiv.innerHTML = letters.map(l=>`<div style="padding:8px 10px;border-radius:8px;background:#fff;font-weight:800;border:1px solid rgba(0,0,0,0.06)">${l.toUpperCase()}</div>`).join('');

    document.getElementById('coopSubmitWord').onclick = submitWordHandler;
    document.getElementById('coopSkip').onclick = ()=>{ currentTurn = currentTurn===1?2:1; updateTurn(); };
    document.getElementById('coopEndEarly').onclick = endEarly;
    updateTurn();
  }

  function updateTurn(){
    const turnEl = document.getElementById('coopTurn');
    if(turnEl) turnEl.textContent = `Jugador ${currentTurn}`;
  }

  function validateWordAgainstLetters(word, lettersArr){
    // verify word uses only available letters (frequency-based)
    word = word.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // basic normalization
    const pool = lettersArr.slice();
    for(const ch of word){
      const idx = pool.indexOf(ch);
      if(idx === -1) return false;
      pool.splice(idx,1);
    }
    return true;
  }

  function submitWordHandler(){
    const input = document.getElementById('coopWordInput');
    const feedback = document.getElementById('coopFeedback');
    const listEl = document.getElementById('coopWordsList');

    if(!gameRunning) { feedback.textContent = 'La partida no está en curso.'; return; }
    const raw = input.value.trim().toLowerCase();
    input.value = '';
    if(!raw){ feedback.textContent = 'Escribe una palabra.'; return; }
    // basic normalization
    const word = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    // check dict
    if(!smallSpanishDict.has(word)){
      feedback.textContent = `"${raw}" no está en el diccionario.`;
      sounds.error.play();
      return;
    }
    // check letters usage
    if(!validateWordAgainstLetters(word, letters)){
      feedback.textContent = `"${raw}" no puede formarse con las letras disponibles.`;
      sounds.error.play();
      return;
    }
    // accepted
    const pts = Math.max(5, word.length * 10);
    coopScore += pts;
    document.getElementById('coopScoreDisplay').textContent = coopScore;
    const li = document.createElement('li');
    li.textContent = `${word} — +${pts} pts (Jugador ${currentTurn})`;
    listEl.appendChild(li);
    feedback.textContent = `✔ "${raw}" aceptada (+${pts} pts).`;
    sounds.ding.play();
    // rotate turn
    currentTurn = currentTurn===1?2:1;
    updateTurn();
  }

  function startMatch(){
    const p1input = document.getElementById('coopPlayer1');
    const p2input = document.getElementById('coopPlayer2');
    const p1 = p1input.value.trim() || 'Jugador 1';
    const p2 = p2input.value.trim() || 'Jugador 2';
    // show names on screen header
    header.innerHTML = `<h2>Palabras en Equipo 🧩</h2>
      <p class="muted small">Jugadores: <strong>${p1}</strong> &amp; <strong>${p2}</strong> — 60s</p>`;
    // initialize game state
    coopScore = 0;
    letters = genLetters(7);
    currentTurn = 1;
    timeLeft = 60;
    gameRunning = true;
    document.getElementById('coopScoreDisplay')?.textContent = coopScore;
    renderGameUI();

    // start coop timer (separate from global timer to avoid interfering)
    clearInterval(coopTimer);
    coopTimer = setInterval(()=>{
      timeLeft--;
      const timeEl = document.getElementById('coopTime');
      if(timeEl) timeEl.textContent = `⏱ ${timeLeft}s`;
      // also update main timeDisplay to sync
      document.getElementById('timeDisplay').textContent = `⏱ ${timeLeft}s`;
      if(timeLeft <= 0){
        clearInterval(coopTimer);
        gameRunning = false;
        finalizeMatch();
      }
    },1000);
  }

  function endEarly(){
    clearInterval(coopTimer);
    gameRunning = false;
    finalizeMatch();
  }

  function finalizeMatch(){
    // show results and award possible medal
    const finalMsg = `Partida terminada — Puntos del equipo: ${coopScore}`;
    alert(finalMsg);
    // award team medal if threshold reached
    if(coopScore >= 100){
      awardMedal('🤝 Equipo Legendario');
      addAchievement('Equipo Legendario');
    }
    // add coopScore to player's overall score in DB (save as coop game)
    saveScoreToDB('coop', coopScore);
    // update displayed global score and end game flow
    document.getElementById('scoreDisplay').textContent = 'Puntos: ' + coopScore;
    // stop global timer as well
    clearInterval(globalTimerInterval);
    goHome();
  }

  // bind start button
  document.getElementById('coopStartBtn').onclick = startMatch;
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
