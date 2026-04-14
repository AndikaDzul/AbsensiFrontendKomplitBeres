<script setup>
import { ref, reactive, nextTick, onUnmounted, computed } from 'vue'
import axios from 'axios'

const props = defineProps({
  category: { type: String, default: 'umum' },
  student: Object,
  backendUrl: String,
  showToast: Function,
  onGameClose: Function,
  onPointsUpdated: Function
})

// UI State
const activeGame = ref(null)
const gameState = ref('menu')
const gameScore = ref(0)
const lastReward = ref(0)
const isLoading = ref(false)

// ================= AI GOOGLE TTS ENGINE =================
const speakText = (text) => {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel() // stop existing
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'id-ID' // Bahasa Indonesia
    utter.rate = 0.9 // Biar jelas untuk belajar membaca
    utter.pitch = 1.1 // Suara agak ramah/lucu
    window.speechSynthesis.speak(utter)
  }
}

// NEW GAME CONTROL REFS
const skyControls = reactive({ left: false, right: false, shoot: false })
const setSkyControl = (action, val) => { skyControls[action] = val }
const racingDir = ref('')
const moveRacing = (dir) => { racingDir.value = dir }

// ================= AUDIO ENGINE (RETRO BEEP) =================
const playSound = (type) => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    if (type === 'coin') { // Jawaban benar / Game point
      osc.type = 'sine'; osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.start(); osc.stop(ctx.currentTime + 0.1);
    } 
    else if (type === 'jump') { // Loncat
      osc.type = 'square'; osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.start(); osc.stop(ctx.currentTime + 0.1);
    }
    else if (type === 'shoot') { // Tembak pesawat
      osc.type = 'square'; osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.start(); osc.stop(ctx.currentTime + 0.1);
    }
    else if (type === 'explosion' || type === 'wrong') { // Ledakan / salah
      osc.type = 'sawtooth'; osc.frequency.setValueAtTime(100, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.3, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(); osc.stop(ctx.currentTime + 0.3);
    }
    else if (type === 'win') { // Menang
      osc.type = 'sine'; osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.setValueAtTime(600, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(800, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.3, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start(); osc.stop(ctx.currentTime + 0.4);
    }
    else if (type === 'gameover') { // Kalah total
      osc.type = 'triangle'; osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.6);
      gain.gain.setValueAtTime(0.4, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
      osc.start(); osc.stop(ctx.currentTime + 0.6);
    }
  } catch (e) { console.log('Audio disabled') }
}

// Game List Definitions
const games = [
  { id: 'baca_huruf', name: 'Mengenal Huruf', icon: 'bi-translate', color: '#10b981', desc: 'Cocokkan huruf kapital & kecil!', difficulty: 'Dasar', reward: 10 },
  { id: 'baca_suku', name: 'Suku Kata', icon: 'bi-chat-left-text', color: '#3b82f6', desc: 'Tebak suku kata yang hilang!', difficulty: 'Menengah', reward: 15 },
  { id: 'baca_kata', name: 'Membaca Kata', icon: 'bi-journal-text', color: '#8b5cf6', desc: 'Susun huruf jadi kata beneran!', difficulty: 'Lanjut', reward: 20 },
  { id: 'baca_lawan', name: 'Lawan Kata', icon: 'bi-arrow-left-right', color: '#14b8a6', desc: 'Cari kata yang berlawanan makna!', difficulty: 'Lanjut', reward: 20 },
  { id: 'baca_kalimat', name: 'Susun Kalimat', icon: 'bi-book-half', color: '#ec4899', desc: 'Urutkan kata menjadi kalimat!', difficulty: 'Sulit', reward: 30 },
  { id: 'rintangan', name: 'Rintangan Maut', icon: 'bi-rocket-takeoff', color: '#4f46e5', desc: 'Lompati rintangan yang datang!', difficulty: 'Pilih Mode', reward: 0 },
  { id: 'skyshooter', name: 'Pesawat Tempur', icon: 'bi-airplane-fill', color: '#dc2626', desc: 'Tembak jatuh pesawat musuh!', difficulty: 'Seru', reward: 40 },
  { id: 'flappy', name: 'Flappy Ninja', icon: 'bi-cursor-fill', color: '#f59e0b', desc: 'Terbang melewati pipa rintangan!', difficulty: 'Seru', reward: 35 },
  { id: 'racing', name: 'Balap Jalanan', icon: 'bi-car-front-fill', color: '#2563eb', desc: 'Hindari tabrakan dengan mobil lain!', difficulty: 'Seru', reward: 40 },
  { id: 'tebak_gambar', name: 'Tebak Gambar', icon: 'bi-image', color: '#10b981', desc: 'Tebak benda di balik sensor!', difficulty: 'Mudah', reward: 15 },
  { id: 'math', name: 'Matematika Kilat', icon: 'bi-plus-slash-minus', color: '#f59e0b', desc: 'Hitung cepat sebelum waktu habis!', difficulty: 'Asah Otak', reward: 20 },
  { id: 'memory', name: 'Memory Card', icon: 'bi-grid-3x3-gap', color: '#ec4899', desc: 'Temukan pasangan kartu yang sama!', difficulty: 'Asah Otak', reward: 30 },
  { id: 'anagram', name: 'Susun Kata', icon: 'bi-sort-alpha-down', color: '#06b6d4', desc: 'Susun huruf menjadi kata bermakna!', difficulty: 'Mudah', reward: 15 },
  { id: 'simon', name: 'Pola Simon', icon: 'bi-lightbulb', color: '#8b5cf6', desc: 'Ikuti urutan warna yang muncul!', difficulty: 'Sulit', reward: 35 },
  { id: 'suit', name: 'Suit Jari (RPS)', icon: 'bi-hand-index-thumb', color: '#64748b', desc: 'Kalahkan AI dalam Suit!', difficulty: 'Mudah', reward: 10 },
  { id: 'snake', name: 'Ular Tangkas', icon: 'bi-activity', color: '#22c55e', desc: 'Makan point dan jangan tabrak ekor!', difficulty: 'Sedang', reward: 25 },
  { id: 'trivia', name: 'Trivia Cerdas', icon: 'bi-patch-question', color: '#ef4444', desc: 'Jawab pertanyaan pengetahuan umum!', difficulty: 'Asah Otak', reward: 20 },
  { id: 'slider', name: 'Puzzle Angka', icon: 'bi-grid-3x3', color: '#d946ef', desc: 'Urutkan angka menjadi 1-8!', difficulty: 'Sulit', reward: 50 },
  { id: 'typer', name: 'Ketik Cepat', icon: 'bi-keyboard', color: '#3b82f6', desc: 'Ketik kalimat dalam waktu singkat!', difficulty: 'Sedang', reward: 20 },
  { id: 'vision', name: 'Warna Berbeda', icon: 'bi-eye', color: '#fbbf24', desc: 'Cari 1 kotak yang warnanya berbeda!', difficulty: 'Mudah', reward: 15 },
  { id: 'balloon', name: 'Pecah Balon', icon: 'bi-balloon', color: '#f43f5e', desc: 'Pecahkan 10 balon merah!', difficulty: 'Mudah', reward: 15 },
  { id: 'guess', name: 'Tebak Angka', icon: 'bi-123', color: '#14b8a6', desc: 'Tebak angka 1-100 (Lebih Tinggi/Rendah)!', difficulty: 'Sedang', reward: 20 },
  { id: 'tictactoe', name: 'Tic-Tac-Toe', icon: 'bi-x-square', color: '#1e293b', desc: 'Kalahkan AI di papan 3x3!', difficulty: 'Sedang', reward: 25 }
]

const filteredGames = computed(() => {
  if (props.category === 'membaca') return games.filter(g => g.id.startsWith('baca_'))
  return games.filter(g => !g.id.startsWith('baca_'))
})

// ================= GAME LOGIC HANDLERS =================
let gameInterval = null
let canvasLoop = null

const selectGame = (gameId) => {
  activeGame.value = gameId
  gameState.value = 'menu'
  gameScore.value = 0
}

const rintanganDifficulty = ref('mudah') // 'mudah' or 'sulit'

const startActualPlay = (difficultyOverride = null) => {
  if (difficultyOverride) rintanganDifficulty.value = difficultyOverride
  
  gameState.value = 'playing'
  gameScore.value = 0
  const game = games.find(g => g.id === activeGame.value)
  
  // Set reward based on game/difficulty
  if (activeGame.value === 'rintangan') {
    lastReward.value = rintanganDifficulty.value === 'sulit' ? 35 : 15
  } else {
    lastReward.value = game.reward
  }
  
  if (activeGame.value === 'baca_huruf') initBacaHuruf()
  else if (activeGame.value === 'baca_suku') initBacaSuku()
  else if (activeGame.value === 'baca_kata') initBacaKata()
  else if (activeGame.value === 'baca_lawan') initBacaLawan()
  else if (activeGame.value === 'baca_kalimat') initBacaKalimat()
  else if (activeGame.value === 'rintangan') initRintangan()
  else if (activeGame.value === 'skyshooter') initSkyShooter()
  else if (activeGame.value === 'flappy') initFlappy()
  else if (activeGame.value === 'racing') initRacing()
  else if (activeGame.value === 'tebak_gambar') initTebakGambar()
  else if (activeGame.value === 'math') initMath()
  else if (activeGame.value === 'memory') initMemory()
  else if (activeGame.value === 'anagram') initAnagram()
  else if (activeGame.value === 'simon') initSimon()
  else if (activeGame.value === 'suit') initSuit()
  else if (activeGame.value === 'snake') initSnake()
  else if (activeGame.value === 'trivia') initTrivia()
  else if (activeGame.value === 'slider') initSlider()
  else if (activeGame.value === 'typer') initTyper()
  else if (activeGame.value === 'vision') initVision()
  else if (activeGame.value === 'balloon') initBalloon()
  else if (activeGame.value === 'guess') initGuess()
  else if (activeGame.value === 'tictactoe') initTicTacToe()
}

// ---------------- NEW GAMES: BELAJAR MEMBACA ----------------
const bacaState = reactive({
  level: 1, // Progress level
  hurufQ: '', hurufOptions: [],
  sukuQ: '', sukuOptions: [], sukuAns: '',
  kataScrambled: [], kataAns: '',
  lawanQ: '', lawanAns: '', lawanOptions: [],
  kalimatScrambled: [], kalimatAns: ''
})

const initBacaHuruf = () => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
  const target = letters[Math.floor(Math.random() * letters.length)]
  bacaState.hurufQ = target
  let opts = [target.toLowerCase()]
  while(opts.length < 3) {
    const l = letters[Math.floor(Math.random() * letters.length)].toLowerCase()
    if(!opts.includes(l)) opts.push(l)
  }
  bacaState.hurufOptions = opts.sort(() => Math.random() - 0.5)
  speakText('Pilih huruf kecil untuk huruf ' + target)
}
const checkBacaHuruf = (ans) => {
  if (ans === bacaState.hurufQ.toLowerCase()) {
    playSound('coin'); gameScore.value++;
    if (gameScore.value >= 5) endGame('won')
    else initBacaHuruf()
  } else { playSound('wrong'); props.showToast('Bukan yang itu, ayo coba lagi!', 'error') }
}

const initBacaSuku = () => {
  const words = [
    { w: 'BU-KU', parts: ['BU', 'KU'] }, { w: 'MA-TA', parts: ['MA', 'TA'] }, 
    { w: 'BO-LA', parts: ['BO', 'LA'] }, { w: 'TO-PI', parts: ['TO', 'PI'] },
    { w: 'SA-PU', parts: ['SA', 'PU'] }
  ]
  const target = words[Math.floor(Math.random() * words.length)]
  const missingIdx = Math.random() > 0.5 ? 1 : 0
  
  bacaState.sukuAns = target.parts[missingIdx]
  bacaState.sukuQ = target.parts.map((p, i) => i === missingIdx ? '___' : p).join(' - ')
  
  const syllables = ['BU','KU','MA','TA','BO','LA','TO','PI','SA','PU','DI','KI','JU','RU']
  let opts = [bacaState.sukuAns]
  while(opts.length < 3) {
    const s = syllables[Math.floor(Math.random() * syllables.length)]
    if(!opts.includes(s)) opts.push(s)
  }
  bacaState.sukuOptions = opts.sort(() => Math.random() - 0.5)
  speakText('Cari suku kata yang hilang untuk kata ' + target.w.replace('-', ''))
}
const checkBacaSuku = (ans) => {
  if (ans === bacaState.sukuAns) {
    playSound('coin'); gameScore.value++;
    if (gameScore.value >= 5) endGame('won')
    else initBacaSuku()
  } else { playSound('wrong'); props.showToast('Suku kata kurang tepat!', 'error') }
}

const initBacaKata = () => {
  const words = ['MANGGA', 'PISANG', 'SEPATU', 'KANCING', 'BONEKA', 'PENSIL']
  const target = words[Math.floor(Math.random() * words.length)]
  bacaState.kataAns = target
  
  let s = target.split('')
  // Shuffle exactly
  while(s.join('') === target) s = s.sort(() => Math.random() - 0.5)
  
  bacaState.kataScrambled = s
  speakText('Susun huruf menjadi kata ' + target)
}
const moveBacaKata = (idx) => {
  if (bacaState.kataScrambled.length < 2) return
  const current = bacaState.kataScrambled[idx]
  if (idx > 0) { // swap with left
    bacaState.kataScrambled[idx] = bacaState.kataScrambled[idx-1]
    bacaState.kataScrambled[idx-1] = current
    playSound('jump')
  }
  if (bacaState.kataScrambled.join('') === bacaState.kataAns) {
    playSound('coin'); gameScore.value++;
    if (gameScore.value >= 5) endGame('won')
    else setTimeout(() => initBacaKata(), 500)
  }
}

const initBacaLawan = () => {
  const antonyms = [
    { q: 'BESAR', a: 'KECIL', f: ['PANJANG', 'LEBAR'] },
    { q: 'TINGGI', a: 'PENDEK', f: ['KURUS', 'DALAM'] },
    { q: 'PANAS', a: 'DINGIN', f: ['HANGAT', 'SEJUK'] },
    { q: 'GELAP', a: 'TERANG', f: ['SURAM', 'HITAM'] },
    { q: 'CEPAT', a: 'LAMBAT', f: ['KILAT', 'LAMA'] },
    { q: 'BERAT', a: 'RINGAN', f: ['KUAT', 'GEMUK'] }
  ]
  const target = antonyms[Math.floor(Math.random() * antonyms.length)]
  bacaState.lawanQ = target.q
  bacaState.lawanAns = target.a
  
  let opts = [target.a, ...target.f]
  bacaState.lawanOptions = opts.sort(() => Math.random() - 0.5)
  speakText('Apa lawan kata dari ' + target.q)
}
const checkBacaLawan = (ans) => {
  if (ans === bacaState.lawanAns) {
    playSound('coin'); gameScore.value++;
    if (gameScore.value >= 5) endGame('won')
    else initBacaLawan()
  } else { playSound('wrong'); props.showToast('Lawan kata kurang tepat!', 'error') }
}

const initBacaKalimat = () => {
  const sentences = [
    'IBU BELI SAYUR DI PASAR', 'AYAH PINDAH KERJA KE KOTA', 'ADIK SUKA MAKAN BUBUR', 
    'BONEKA ITU SANGAT LUCU', 'SAYA RAJIN BELAJAR BUKU'
  ]
  const target = sentences[Math.floor(Math.random() * sentences.length)]
  bacaState.kalimatAns = target
  
  let p = target.split(' ')
  while(p.join(' ') === target) p = p.sort(() => Math.random() - 0.5)
  bacaState.kalimatScrambled = p
  speakText('Susun kata menjadi kalimat ' + target)
}
const swapKalimat = (i, j) => {
  const temp = bacaState.kalimatScrambled[i]
  bacaState.kalimatScrambled[i] = bacaState.kalimatScrambled[j]
  bacaState.kalimatScrambled[j] = temp
  playSound('jump')
  
  if (bacaState.kalimatScrambled.join(' ') === bacaState.kalimatAns) {
    playSound('coin'); gameScore.value++;
    if (gameScore.value >= 3) endGame('won')
    else setTimeout(() => initBacaKalimat(), 800)
  }
}

// ---------------- NEW GAME 1: SKY SHOOTER ----------------
const initSkyShooter = () => {
  nextTick(() => {
    const canvas = document.getElementById('skyCanvas')
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const box = 20
    let player = { x: 130, y: 150, w: 30, h: 30 }
    let bullets = []
    let enemies = []
    let frames = 0
    let isLeft = false, isRight = false, isShooting = false
    
    // Add touch support easily via buttons in template later
    canvasLoop = setInterval(() => {
      if (gameState.value !== 'playing') return clearInterval(canvasLoop)
      ctx.clearRect(0,0,300,200)
      
      // Move Player
      if (skyControls.left) player.x -= 5
      if (skyControls.right) player.x += 5
      if (skyControls.shoot && frames % 10 === 0) {
        bullets.push({x: player.x + 10, y: player.y, w:5, h:10})
        playSound('shoot')
      }
      if (player.x < 0) player.x = 0; if (player.x > 270) player.x = 270;
      
      // Spawn Enemies
      if (frames % 40 === 0) enemies.push({ x: Math.random()*260, y: -30, w: 30, h: 30 })
      
      // Move Bullets
      bullets.forEach((b, idx) => {
        b.y -= 8; ctx.fillStyle='yellow'; ctx.fillRect(b.x, b.y, b.w, b.h)
        if (b.y < -10) bullets.splice(idx, 1)
      })
      
      // Move Enemies & Detect collision
      enemies.forEach((e, idx) => {
        e.y += 3; ctx.fillStyle='red'; ctx.fillRect(e.x, e.y, e.w, e.h)
        // Hit Player
        if (player.x < e.x+e.w && player.x+player.w > e.x && player.y < e.y+e.h && player.y+player.h > e.y) {
           clearInterval(canvasLoop); endGame('gameover')
        }
        // Hit Bullet
        bullets.forEach((b, bI) => {
          if (b.x < e.x+e.w && b.x+b.w > e.x && b.y < e.y+e.h && b.y+b.h > e.y) {
             enemies.splice(idx,1); bullets.splice(bI, 1); gameScore.value++;
             playSound('explosion')
          }
        })
      })
      
      ctx.fillStyle = '#3b82f6'; ctx.fillRect(player.x, player.y, player.w, player.h)
      if (gameScore.value >= 15) { clearInterval(canvasLoop); endGame('won') }
      frames++
    }, 30)
  })
}

// ---------------- NEW GAME 2: FLAPPY NINJA ----------------
const initFlappy = () => {
  nextTick(() => {
    const canvas = document.getElementById('flappyCanvas')
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let bird = { x: 50, y: 100, dy: 0, w: 20, h: 20 }
    let pipes = []
    let frames = 0
    playSound('coin')
    
    canvas.onclick = () => { bird.dy = -6; playSound('jump') }
    
    canvasLoop = setInterval(() => {
      if (gameState.value !== 'playing') return clearInterval(canvasLoop)
      ctx.clearRect(0,0,300,200)
      
      bird.dy += 0.4; bird.y += bird.dy
      ctx.fillStyle = '#f59e0b'; ctx.fillRect(bird.x, bird.y, bird.w, bird.h)
      
      if (frames % 80 === 0) {
         let topH = Math.random() * 80 + 20
         pipes.push({ x: 300, y: 0, w: 30, h: topH, passed: false }) // Top
         pipes.push({ x: 300, y: topH + 70, w: 30, h: 200 - (topH + 70) }) // Bottom
      }
      
      pipes.forEach((p, idx) => {
         p.x -= 3; ctx.fillStyle = '#10b981'; ctx.fillRect(p.x, p.y, p.w, p.h)
         if (bird.x < p.x+p.w && bird.x+bird.w > p.x && bird.y < p.y+p.h && bird.y+bird.h > p.y) {
            clearInterval(canvasLoop); endGame('gameover')
         }
         if (p.x === bird.x && !p.passed && p.y === 0) { gameScore.value++; p.passed = true; playSound('coin') }
      })
      
      if (bird.y > 200 || bird.y < -20) { clearInterval(canvasLoop); endGame('gameover') }
      if (gameScore.value >= 10) { clearInterval(canvasLoop); endGame('won') }
      frames++
    }, 30)
  })
}

// ---------------- NEW GAME 3: BALAP MOBIL ----------------
const initRacing = () => {
  nextTick(() => {
    const canvas = document.getElementById('racingCanvas')
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let player = { lane: 1, y: 160 } // lanes: 0, 1, 2
    let traffic = []
    let frames = 0
    let roadY = 0
    playSound('coin')
    
    canvasLoop = setInterval(() => {
      if (gameState.value !== 'playing') return clearInterval(canvasLoop)
      ctx.clearRect(0,0,300,200)

      if (racingDir.value === 'L' && player.lane > 0) { player.lane--; racingDir.value = ''; playSound('jump') }
      if (racingDir.value === 'R' && player.lane < 2) { player.lane++; racingDir.value = ''; playSound('jump') }
      
      // Road animation
      roadY += 5; if (roadY > 50) roadY = 0
      ctx.strokeStyle = '#cbd5e1'; ctx.setLineDash([20, 20])
      ctx.beginPath(); ctx.moveTo(100, roadY-50); ctx.lineTo(100, 250); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(200, roadY-50); ctx.lineTo(200, 250); ctx.stroke();
      ctx.setLineDash([])
      
      if (frames % 40 === 0) {
        traffic.push({ lane: Math.floor(Math.random() * 3), y: -40, speed: Math.random()*2 + 3 })
      }
      
      traffic.forEach((t, i) => {
        t.y += t.speed; ctx.fillStyle = '#ef4444'; ctx.fillRect(t.lane * 100 + 30, t.y, 40, 60)
        if (t.lane === player.lane && Math.abs(t.y - player.y) < 50) { clearInterval(canvasLoop); endGame('gameover') }
        if (t.y > 200 && !t.passed) { t.passed = true; gameScore.value++; playSound('coin') }
      })
      
      ctx.fillStyle = '#2563eb'; ctx.fillRect(player.lane * 100 + 30, player.y, 40, 60)
      if (gameScore.value >= 15) { clearInterval(canvasLoop); endGame('won') }
      frames++
    }, 30)
  })
}

// ---------------- 1. RINTANGAN (Existing logic improved) ----------------
const initRintangan = () => {
  nextTick(() => {
    const canvas = document.getElementById('gameCanvas')
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width = canvas.parentElement.clientWidth
    canvas.height = 200

    let player = { x: 50, y: 140, w: 30, h: 40, dy: 0, jump: -10, grav: 0.6, grounded: false }
    let monsters = []
    let frames = 0

    const loop = () => {
      if (gameState.value !== 'playing') return
      ctx.clearRect(0,0,canvas.width, canvas.height)
      
      const speed = rintanganDifficulty.value === 'sulit' ? 7 : 4
      const spawnRate = rintanganDifficulty.value === 'sulit' ? 60 : 90

      player.dy += player.grav
      player.y += player.dy
      if (player.y + player.h > canvas.height - 20) {
        player.y = canvas.height - 20 - player.h
        player.dy = 0
        player.grounded = true
      }

      if (frames % spawnRate === 0) monsters.push({ x: canvas.width, y: canvas.height - 50, w: 25, h: 30 })
      monsters.forEach((m, idx) => {
        m.x -= speed
        ctx.fillStyle = '#ef4444'
        ctx.fillRect(m.x, m.y, m.w, m.h)
        if (player.x < m.x + m.w && player.x + player.w > m.x && player.y < m.y + m.h && player.y + player.h > m.y) {
           endGame('gameover')
        }
        if (m.x + m.w < player.x && !m.scored) { m.scored = true; gameScore.value++ }
        if (m.x < -100) monsters.splice(idx, 1)
      })

      ctx.fillStyle = '#4f46e5'
      ctx.fillRect(player.x, player.y, player.w, player.h)
      
      ctx.strokeStyle = '#e2e8f0'; ctx.strokeRect(0, canvas.height-20, canvas.width, 2);
      
      const winTarget = rintanganDifficulty.value === 'sulit' ? 30 : 10
      frames++
      if (gameScore.value >= winTarget) endGame('won')
      else canvasLoop = requestAnimationFrame(loop)
    }
    
    canvas.onclick = () => { if (player.grounded) { player.dy = player.jump; player.grounded = false } }
    loop()
  })
}

// ---------------- 2. TEBAK GAMBAR ----------------
const tebakState = reactive({ img: '', answer: '', choices: [], hint: '' })
const initTebakGambar = () => {
  const dataset = [
    { a: 'EINSTEIN', h: 'Ilmuwan Fisika Terkenal', img: 'https://upload.wikimedia.org/wikipedia/commons/d/d3/Albert_Einstein_Head.jpg' },
    { a: 'GITAR', h: 'Alat musik petik', img: 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=400' },
    { a: 'BOROBUDUR', h: 'Candi Terbesar di Indonesia', img: 'https://images.unsplash.com/photo-1596402184320-417d7178b2cd?w=400' }
  ]
  const target = dataset[Math.floor(Math.random() * dataset.length)]
  tebakState.answer = target.a
  tebakState.hint = target.h
  tebakState.img = target.img
}
const checkTebak = (input) => {
  if (input.toUpperCase() === tebakState.answer) { playSound('coin'); endGame('won') }
  else { playSound('wrong'); props.showToast('Salah terka! Coba lagi', 'error') }
}

// ---------------- 3. MATH ----------------
const mathState = reactive({ q: '', a: 0 })
const initMath = () => {
  const n1 = Math.floor(Math.random() * 20) + 1
  const n2 = Math.floor(Math.random() * 20) + 1
  mathState.q = `${n1} + ${n2} = ?`
  mathState.a = n1 + n2
}
const checkMath = (ans) => {
  if (parseInt(ans) === mathState.a) {
    playSound('coin')
    gameScore.value++
    if (gameScore.value >= 5) endGame('won')
    else initMath()
  } else { playSound('wrong'); props.showToast('Hitungan salah!', 'error') }
}

// ---------------- 4. MEMORY ----------------
const cards = ref([])
const flipped = ref([])
const initMemory = () => {
  const symbols = ['🌟', '🍎', '⚽', '🚗', '🐱', '🍦']
  const deck = [...symbols, ...symbols].sort(() => Math.random() - 0.5)
  cards.value = deck.map((s, i) => ({ id: i, s, state: 'down' }))
}
const flip = (card) => {
  if (card.state !== 'down' || flipped.value.length >= 2) return
  playSound('jump')
  card.state = 'up'
  flipped.value.push(card)
  if (flipped.value.length === 2) {
    setTimeout(() => {
      if (flipped.value[0].s === flipped.value[1].s) {
        playSound('coin')
        flipped.value.forEach(c => c.state = 'matched')
        if (cards.value.every(c => c.state === 'matched')) endGame('won')
      } else {
        playSound('wrong')
        flipped.value.forEach(c => c.state = 'down')
      }
      flipped.value = []
    }, 800)
  }
}

// ---------------- 5. ANAGRAM ----------------
const anagramState = reactive({ word: '', scrambled: '' })
const initAnagram = () => {
  const words = ['SEKOLAH', 'BELAJAR', 'PINTAR', 'MERDEKA', 'CIANJUR', 'SMKZIE', 'PENDIDIKAN']
  const target = words[Math.floor(Math.random() * words.length)]
  anagramState.word = target
  let s = target.split('').sort(() => Math.random() - 0.5).join('')
  if (s === target) s = s.split('').reverse().join('') // Avoid auto-solve
  anagramState.scrambled = s
}
const checkAnagram = (input) => {
  if (input.toUpperCase() === anagramState.word) { playSound('coin'); endGame('won') }
  else { playSound('wrong'); props.showToast('Kata salah!', 'error') }
}

// ---------------- 6. SIMON ----------------
const simonSequence = ref([])
const userSequence = ref([])
const activeColor = ref(null)
const initSimon = () => {
  simonSequence.value = [Math.floor(Math.random() * 4)]
  playSimon()
}
const playSimon = async () => {
  userSequence.value = []
  for (const color of simonSequence.value) {
    await new Promise(r => setTimeout(r, 600))
    activeColor.value = color
    await new Promise(r => setTimeout(r, 400))
    activeColor.value = null
  }
}
const pressSimon = (color) => {
  if (gameState.value !== 'playing') return
  userSequence.value.push(color)
  if (color !== simonSequence.value[userSequence.value.length - 1]) return endGame('gameover')
  if (userSequence.value.length === simonSequence.value.length) {
    gameScore.value++
    if (gameScore.value >= 5) return endGame('won')
    simonSequence.value.push(Math.floor(Math.random() * 4))
    setTimeout(playSimon, 1000)
  }
}

// ---------------- 7. SUIT ----------------
const initSuit = () => {}
const playSuit = (user) => {
  const choices = ['Batu', 'Gunting', 'Kertas']
  const ai = choices[Math.floor(Math.random() * 3)]
  if (user === ai) { props.showToast('Seri!', 'info') }
  else if ((user === 'Batu' && ai === 'Gunting') || (user === 'Gunting' && ai === 'Kertas') || (user === 'Kertas' && ai === 'Batu')) {
    gameScore.value++
    props.showToast('Menang ronde!', 'success')
  } else { props.showToast('AI Menang ronde!', 'error') }
  if (gameScore.value >= 3) endGame('won')
}

// ---------------- 8. SNAKE (Classic logic) ----------------
const initSnake = () => {
  nextTick(() => {
    const canvas = document.getElementById('snakeCanvas')
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const box = 20
    let snake = [{ x: 9 * box, y: 10 * box }]
    let food = { x: Math.floor(Math.random() * 14 + 1) * box, y: Math.floor(Math.random() * 7 + 1) * box }
    let d = 'RIGHT'
    
    window.onkeydown = (e) => { 
      if (e.key === 'ArrowLeft' && d !== 'RIGHT') d = 'LEFT'
      else if (e.key === 'ArrowUp' && d !== 'DOWN') d = 'UP'
      else if (e.key === 'ArrowRight' && d !== 'LEFT') d = 'RIGHT'
      else if (e.key === 'ArrowDown' && d !== 'UP') d = 'DOWN'
    }

    const loop = setInterval(() => {
      if (gameState.value !== 'playing') return clearInterval(loop)
      ctx.fillStyle = '#f8fafc'; ctx.fillRect(0,0,canvas.width, canvas.height)
      
      for(let i=0; i<snake.length; i++){
        ctx.fillStyle = i === 0 ? '#10b981' : '#34d399'
        ctx.fillRect(snake[i].x, snake[i].y, box, box)
      }
      
      ctx.fillStyle = '#ef4444'; ctx.fillRect(food.x, food.y, box, box)
      
      let sx = snake[0].x; let sy = snake[0].y
      if (d === 'LEFT') sx -= box; if (d === 'UP') sy -= box; if (d === 'RIGHT') sx += box; if (d === 'DOWN') sy += box
      
      if (sx === food.x && sy === food.y) {
        gameScore.value++
        food = { x: Math.floor(Math.random() * 14 + 1) * box, y: Math.floor(Math.random() * 7 + 1) * box }
        if (gameScore.value >= 5) { clearInterval(loop); endGame('won') }
      } else snake.pop()
      
      let newHead = { x: sx, y: sy }
      if (sx < 0 || sx >= canvas.width || sy < 0 || sy >= canvas.height) { clearInterval(loop); endGame('gameover') }
      snake.unshift(newHead)
    }, 150)
  })
}

// ---------------- 9. TRIVIA ----------------
const triviaState = reactive({ q: '', a: '', choices: [] })
const initTrivia = () => {
  const pool = [
    { q: 'Ibukota Indonesia saat ini?', a: 'Jakarta', c: ['Bandung', 'Jakarta', 'IKN', 'Surabaya'] },
    { q: 'Siapa bapak proklamator Indonesia?', a: 'Soekarno', c: ['Hatta', 'Soekarno', 'Suharto', 'Habibie'] },
    { q: 'Apa kepanjangan dari SMK?', a: 'Sekolah Menengah Kejuruan', c: ['Sekolah Maju Kedepan', 'Sekolah Menengah Kejuruan', 'Siswa Menengah Komputer', 'Siswa Masa Kini'] },
    { q: 'Benua terkecil di dunia?', a: 'Australia', c: ['Asia', 'Eropa', 'Australia', 'Afrika'] }
  ]
  const target = pool[Math.floor(Math.random() * pool.length)]
  triviaState.q = target.q; triviaState.a = target.a; triviaState.choices = target.c
}
const checkTrivia = (ans) => {
  if (ans === triviaState.a) endGame('won')
  else props.showToast('Salah pilar!', 'error')
}

// ---------------- 10. SLIDER ----------------
const sliderTiles = ref([])
const initSlider = () => {
  let initial = [1, 2, 3, 4, 5, 6, 7, 0, 8] // Solveable-ish
  sliderTiles.value = initial.sort(() => Math.random() - 0.5)
}
const moveSlider = (idx) => {
  const emptyIdx = sliderTiles.value.indexOf(0)
  const allowed = [idx-1, idx+1, idx-3, idx+3]
  if (allowed.includes(emptyIdx)) {
    const temp = sliderTiles.value[idx]
    sliderTiles.value[idx] = 0
    sliderTiles.value[emptyIdx] = temp
    if (sliderTiles.value.join('') === '123456780') endGame('won')
  }
}

// ---------------- 11. TYPER ----------------
const typerTarget = 'SMK Negeri 1 Cianjur Unggul dan Agamis'
const typerInput = ref('')
const initTyper = () => { typerInput.value = '' }
const checkTyper = () => {
  if (typerInput.value === typerTarget) endGame('won')
}

// ---------------- 12. VISION ----------------
const visionColors = ref([])
const mainColor = ref('')
const oddColor = ref('')
const initVision = () => {
  const h = Math.floor(Math.random() * 360)
  const l = 50 + Math.random() * 20
  mainColor.value = `hsl(${h}, 70%, ${l}%)`
  oddColor.value = `hsl(${h}, 70%, ${l + 8}%)`
  const grid = Array(16).fill(mainColor.value)
  grid[Math.floor(Math.random() * 16)] = oddColor.value
  visionColors.value = grid
}
const checkVision = (color) => {
  if (color === oddColor.value) endGame('won')
  else props.showToast('Bukan yang itu!', 'error')
}

// ---------------- 13. BALLOON ----------------
const balloons = ref([])
const initBalloon = () => {
  balloons.value = []
  gameInterval = setInterval(() => {
    if (balloons.value.length < 5) balloons.value.push({
      id: Date.now(),
      x: Math.random() * 200 + 50,
      y: 300,
      s: Math.random() * 2 + 1
    })
    balloons.value.forEach(b => b.y -= b.s)
    balloons.value = balloons.value.filter(b => b.y > -50)
  }, 30)
}
const popBalloon = (id) => {
  balloons.value = balloons.value.filter(b => b.id !== id)
  gameScore.value++
  if (gameScore.value >= 10) { clearInterval(gameInterval); endGame('won') }
}

// ---------------- 14. GUESS ----------------
const guessTarget = ref(0)
const lastGuess = ref(null)
const initGuess = () => { guessTarget.value = Math.floor(Math.random() * 100) + 1 }
const makeGuess = (n) => {
  lastGuess.value = n
  if (n == guessTarget.value) endGame('won')
  else if (gameScore.value >= 10) endGame('gameover')
  else {
    gameScore.value++
    props.showToast(n > guessTarget.value ? 'Terlalu Besar!' : 'Terlalu Kecil!', 'info')
  }
}

// ---------------- 15. TICTACTOE ----------------
const board = ref(Array(9).fill(null))
const initTicTacToe = () => { board.value = Array(9).fill(null) }
const moveTTT = (i) => {
  if (board.value[i]) return
  board.value[i] = 'X'
  if (checkWinTTT('X')) return endGame('won')
  // Simple AI
  const empty = board.value.map((v, idx) => v === null ? idx : null).filter(v => v !== null)
  if (empty.length > 0) {
    const aiMove = empty[Math.floor(Math.random() * empty.length)]
    board.value[aiMove] = 'O'
    if (checkWinTTT('O')) return endGame('gameover')
  } else endGame('gameover')
}
const checkWinTTT = (p) => {
  const win = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]
  return win.some(comb => comb.every(i => board.value[i] === p))
}

// ---------------- END GAME & REWARD ----------------
const endGame = (status) => {
  gameState.value = status
  if (status === 'won') playSound('win')
  if (status === 'gameover') playSound('gameover')
  if (status === 'gameover' && activeGame.value === 'rintangan') {
    applyAutoPenalty()
  }
}

const applyAutoPenalty = async () => {
  const penalty = rintanganDifficulty.value === 'sulit' ? -5 : -7
  const game = games.find(g => g.id === activeGame.value)
  playSound('wrong')
  try {
    const res = await axios.post(`${props.backendUrl}/students/${props.student.nis}/game-reward`, {
      points: penalty,
      gameName: `${game.name} (${rintanganDifficulty.value})`
    })
    props.showToast(`Yah! Tabrak rintangan, poin berkurang ${penalty} PT`, 'error')
    props.onPointsUpdated(res.data.points)
  } catch (err) {
    console.error('Failed to sync penalty', err)
  }
}

const claimReward = async () => {
  if (isLoading.value) return
  isLoading.value = true
  const game = games.find(g => g.id === activeGame.value)
  
  try {
    const res = await axios.post(`${props.backendUrl}/students/${props.student.nis}/game-reward`, {
      points: lastReward.value,
      gameName: game.name
    })
    
    props.showToast(`Yey! ${lastReward.value} Point tersimpan ke database!`, 'success')
    props.onPointsUpdated(res.data.points)
    activeGame.value = null
  } catch (err) {
    props.showToast('Gagal Simpan Poin permanent. Cek koneksi backend!', 'error')
  } finally {
    isLoading.value = false
  }
}

onUnmounted(() => {
  if (gameInterval) clearInterval(gameInterval)
  if (canvasLoop) cancelAnimationFrame(canvasLoop)
})
</script>

<template>
<div class="game-zone-container">
  <!-- Game Selector -->
  <div v-if="!activeGame" class="game-selection">
    <div class="p-4">
      <h5 class="fw-bold mb-1"><i class="bi bi-controller text-primary me-2"></i>SMKZIE Game Zone</h5>
      <p class="text-muted small mb-4">Pilih permainan untuk asah otak & tambah point!</p>
      
      <div class="row g-3">
        <div v-for="g in filteredGames" :key="g.id" class="col-6">
          <div class="game-card p-3 shadow-sm border" @click="selectGame(g.id)">
            <div class="icon-box mb-3" :style="{ backgroundColor: g.color + '15', color: g.color }">
              <i class="bi" :class="g.icon"></i>
            </div>
            <h6 class="fw-bold mb-1" style="font-size: 0.85rem;">{{ g.name }}</h6>
            <div class="d-flex justify-content-between align-items-center">
               <span class="badge rounded-pill bg-light text-muted" style="font-size: 0.6rem;">{{ g.difficulty }}</span>
               <span class="fw-bold text-success" style="font-size: 0.75rem;">+{{ g.reward }} PT</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Active Game Display -->
  <div v-else class="active-game-overlay">
    <div class="game-header p-3 d-flex justify-content-between align-items-center bg-white border-bottom shadow-sm">
      <div class="d-flex align-items-center gap-2">
        <button @click="activeGame = null" class="btn btn-sm btn-light rounded-circle"><i class="bi bi-arrow-left"></i></button>
        <span class="fw-bold">{{ games.find(g => g.id === activeGame).name }}</span>
      </div>
      <span class="badge bg-warning text-dark rounded-pill fw-bold">+{{ lastReward }} POINT</span>
    </div>

    <div class="game-content p-4 text-center">
      <!-- Menu Screen -->
      <div v-if="gameState === 'menu'" class="py-5">
        <div class="mb-4">
          <i class="bi" :class="games.find(g => g.id === activeGame).icon" style="font-size: 4rem; color: #6366f1;"></i>
        </div>
        <h4 class="fw-bold">{{ games.find(g => g.id === activeGame).name }}</h4>
        <p class="text-muted mb-4">{{ games.find(g => g.id === activeGame).desc }}</p>
        
        <!-- Rintangan specific difficulty buttons -->
        <div v-if="activeGame === 'rintangan'" class="d-grid gap-3 px-4">
          <button @click="startActualPlay('mudah')" class="btn btn-outline-primary py-3 rounded-4 fw-bold">
            <i class="bi bi-emoji-smile me-2"></i> Mode Mudah (+15 PT)
            <small class="d-block opacity-75">Gagal: -7 PT</small>
          </button>
          <button @click="startActualPlay('sulit')" class="btn btn-outline-danger py-3 rounded-4 fw-bold">
            <i class="bi bi-lightning-fill me-2"></i> Mode Sulit (+35 PT)
            <small class="d-block opacity-75">Gagal: -5 PT</small>
          </button>
        </div>
        <button v-else @click="startActualPlay()" class="btn btn-primary px-5 py-3 rounded-pill fw-bold shadow-lg">MULAI BERMAIN</button>
      </div>

      <!-- Playing Area -->
      <div v-if="gameState === 'playing'" class="py-2">
        <!-- BELAJAR MEMBACA GAMES -->
        <div v-if="activeGame === 'baca_huruf'" class="text-center">
           <p class="small text-muted mb-3">Puteran: {{ gameScore }} / 5</p>
           <h1 class="display-1 fw-bold text-primary mb-4" style="font-size: 5rem;">{{ bacaState.hurufQ }}</h1>
           <p class="mb-3 fw-bold text-dark">Pilih huruf kecil yang cocok:</p>
           <div class="d-flex gap-3 justify-content-center">
              <button v-for="opt in bacaState.hurufOptions" :key="opt" class="btn btn-outline-primary fw-bold px-4 py-3 fs-3 rounded-4" @click="checkBacaHuruf(opt)">{{ opt }}</button>
           </div>
        </div>

        <div v-if="activeGame === 'baca_suku'" class="text-center">
           <p class="small text-muted mb-3">Puteran: {{ gameScore }} / 5</p>
           <h2 class="display-3 fw-bold text-dark mb-4" style="letter-spacing: 2px;">{{ bacaState.sukuQ }}</h2>
           <p class="mb-3 fw-bold text-muted">Lengkapi suku kata di atas:</p>
           <div class="d-flex gap-2 justify-content-center flex-wrap">
              <button v-for="opt in bacaState.sukuOptions" :key="opt" class="btn btn-primary fw-bold px-4 py-2 fs-3 rounded-4" @click="checkBacaSuku(opt)">{{ opt }}</button>
           </div>
        </div>

        <div v-if="activeGame === 'baca_kata'" class="text-center">
           <p class="small text-muted mb-3">Puteran: {{ gameScore }} / 5</p>
           <div class="d-flex flex-wrap gap-2 justify-content-center mb-4">
              <div v-for="(char, idx) in bacaState.kataScrambled" :key="idx" 
                   class="btn btn-warning text-dark fw-bold px-3 py-2 fs-2 shadow-sm rounded-3" 
                   @click="moveBacaKata(idx)">
                   {{ char }}
              </div>
           </div>
           <p class="small text-muted italic">Misi: Klik huruf untuk memindahkannya ke kiri, susun menjadi kata yang bermakna!</p>
        </div>

        <div v-if="activeGame === 'baca_lawan'" class="text-center">
           <p class="small text-muted mb-3">Puteran: {{ gameScore }} / 5</p>
           <h2 class="display-4 fw-bold text-dark mb-4">{{ bacaState.lawanQ }}</h2>
           <p class="mb-3 fw-bold text-muted">Apa kata yang berlawanan maknanya?</p>
           <div class="d-flex gap-2 justify-content-center flex-wrap">
              <button v-for="opt in bacaState.lawanOptions" :key="opt" class="btn btn-primary fw-bold px-4 py-2 fs-4 rounded-4" @click="checkBacaLawan(opt)">{{ opt }}</button>
           </div>
        </div>

        <div v-if="activeGame === 'baca_kalimat'" class="text-center">
           <p class="small text-muted mb-3">Puteran: {{ gameScore }} / 3</p>
           <div class="d-flex flex-column gap-2 mb-4 px-2">
              <button v-for="(word, idx) in bacaState.kalimatScrambled" :key="idx" 
                   class="btn btn-outline-danger fw-bold py-2 fs-5 w-100 shadow-sm"
                   @click="idx > 0 ? swapKalimat(idx, idx-1) : null">
                   {{ word }}
              </button>
           </div>
           <p class="small text-muted italic">Misi: Klik sebuah kata untuk menaikkannya ke atas dan susun jadi kalimat yang benar.</p>
        </div>

        <!-- 3 NEW GAMES TEMPLATES -->
        <div v-if="activeGame === 'skyshooter'">
           <p class="small text-muted mb-2">Skor: {{ gameScore }} / 15</p>
           <canvas id="skyCanvas" width="300" height="200" class="border shadow-sm rounded-3 bg-dark w-100"></canvas>
           <div class="d-flex gap-2 justify-content-center mt-3">
              <button class="btn btn-primary" @touchstart="setSkyControl('left', true)" @touchend="setSkyControl('left', false)" @mousedown="setSkyControl('left', true)" @mouseup="setSkyControl('left', false)"><i class="bi bi-arrow-left fs-3"></i></button>
              <button class="btn btn-danger px-4 fw-bold" @touchstart="setSkyControl('shoot', true)" @touchend="setSkyControl('shoot', false)" @mousedown="setSkyControl('shoot', true)" @mouseup="setSkyControl('shoot', false)"><i class="bi bi-bullseye fs-3"></i> FIRE</button>
              <button class="btn btn-primary" @touchstart="setSkyControl('right', true)" @touchend="setSkyControl('right', false)" @mousedown="setSkyControl('right', true)" @mouseup="setSkyControl('right', false)"><i class="bi bi-arrow-right fs-3"></i></button>
           </div>
        </div>

        <div v-if="activeGame === 'flappy'">
           <p class="small text-muted mb-2">Pipa Dilewati: {{ gameScore }} / 10</p>
           <canvas id="flappyCanvas" width="300" height="200" class="border shadow-sm rounded-3 w-100" style="background: linear-gradient(#3b82f6, #60a5fa)"></canvas>
           <p class="small text-muted mt-3 italic">Ketuk Area Game / Kotak Biru Secara Cepat Untuk Terbang!</p>
        </div>

        <div v-if="activeGame === 'racing'">
           <p class="small text-muted mb-2">Skor Anda: {{ gameScore }} / 15</p>
           <canvas id="racingCanvas" width="300" height="200" class="border shadow-sm rounded-3 bg-dark w-100"></canvas>
           <div class="d-flex gap-4 justify-content-center mt-3">
              <button class="btn btn-primary px-5 py-3 rounded-4" @click="moveRacing('L')"><i class="bi bi-arrow-left-circle fs-2"></i></button>
              <button class="btn btn-primary px-5 py-3 rounded-4" @click="moveRacing('R')"><i class="bi bi-arrow-right-circle fs-2"></i></button>
           </div>
        </div>

        <!-- GAME COMPONENTS -->
        <div v-if="activeGame === 'rintangan'">
           <p class="small text-muted mb-2">Skor: {{ gameScore }} / 10</p>
           <canvas id="gameCanvas" class="w-100 rounded-4 shadow-sm border bg-light"></canvas>
           <p class="small text-muted mt-3 italic">Ketuk layar untuk melompat!</p>
        </div>

        <div v-if="activeGame === 'tebak_gambar'">
           <div class="blurred-box mb-4 mx-auto" style="width: 200px; height: 200px; overflow: hidden; border-radius: 20px;">
              <img :src="tebakState.img" class="w-100 h-100" style="filter: blur(8px);">
           </div>
           <p class="fw-bold border-bottom pb-2">HINT: {{ tebakState.hint }}</p>
           <div class="d-flex gap-2 justify-content-center flex-wrap">
              <button v-for="c in ['EINSTEIN', 'GITAR', 'BOROBUDUR', 'MONALISA']" :key="c" @click="checkTebak(c)" class="btn btn-outline-primary rounded-pill px-3">{{ c }}</button>
           </div>
        </div>

        <div v-if="activeGame === 'math'">
           <h1 class="display-3 fw-bold mb-4">{{ mathState.q }}</h1>
           <p class="small text-muted">Benar: {{ gameScore }} / 5</p>
           <div class="d-flex gap-2 justify-content-center flex-wrap">
              <button v-for="n in [mathState.a, mathState.a+5, mathState.a-3, 42].sort()" :key="n" @click="checkMath(n)" class="btn btn-outline-warning fw-bold px-4 py-2 fs-4">{{ n }}</button>
           </div>
        </div>

        <div v-if="activeGame === 'memory'">
           <div class="memory-grid">
              <div v-for="c in cards" :key="c.id" @click="flip(c)" class="mem-card" :class="c.state">
                 <span v-if="c.state !== 'down'">{{ c.s }}</span>
              </div>
           </div>
        </div>

        <div v-if="activeGame === 'slider'">
           <div class="slider-grid">
              <div v-for="(t, i) in sliderTiles" :key="i" @click="moveSlider(i)" class="slider-box" :class="{ empty: t === 0 }">
                 {{ t !== 0 ? t : '' }}
              </div>
           </div>
           <p class="small text-muted mt-3">Urutkan angka 1-8!</p>
        </div>

        <div v-if="activeGame === 'snake'">
           <p class="small text-muted">Skor: {{ gameScore }} / 5</p>
           <canvas id="snakeCanvas" width="300" height="180" class="border shadow-sm rounded-3"></canvas>
           <div class="d-flex gap-2 justify-content-center mt-3">
              <button @click="window.onkeydown({key:'ArrowLeft'})" class="btn btn-sm btn-dark"><i class="bi bi-arrow-left"></i></button>
              <div class="d-flex flex-column gap-2">
                <button @click="window.onkeydown({key:'ArrowUp'})" class="btn btn-sm btn-dark"><i class="bi bi-arrow-up"></i></button>
                <button @click="window.onkeydown({key:'ArrowDown'})" class="btn btn-sm btn-dark"><i class="bi bi-arrow-down"></i></button>
              </div>
              <button @click="window.onkeydown({key:'ArrowRight'})" class="btn btn-sm btn-dark"><i class="bi bi-arrow-right"></i></button>
           </div>
        </div>

        <div v-if="activeGame === 'simon'">
           <p class="small text-muted">Ikuti Pola: {{ gameScore }} / 5</p>
           <div class="simon-grid">
              <div v-for="n in 4" :key="n" @click="pressSimon(n-1)" class="simon-box" :class="[`box-${n-1}`, { active: activeColor === n-1 }]"></div>
           </div>
        </div>

        <!-- NEWLY ADDED TEMPLATES -->
        <div v-if="activeGame === 'anagram'">
           <h2 class="fw-bold tracking-widest text-primary mb-3">{{ anagramState.scrambled }}</h2>
           <p class="small text-muted mb-4">Susun kata di atas!</p>
           <div class="input-group px-4 mb-3">
              <input v-model="typerInput" type="text" class="form-control" placeholder="Jawaban..." @keyup.enter="checkAnagram(typerInput)">
              <button @click="checkAnagram(typerInput)" class="btn btn-primary">SUBMIT</button>
           </div>
        </div>

        <div v-if="activeGame === 'suit'">
           <h4 class="fw-bold mb-4">Pilih Senjata Kamu!</h4>
           <div class="d-flex justify-content-center gap-3">
              <button @click="playSuit('Batu')" class="btn btn-outline-dark p-3 rounded-4"><i class="bi bi-hand-thumbs-up-fill fs-1"></i><br>Batu</button>
              <button @click="playSuit('Gunting')" class="btn btn-outline-dark p-3 rounded-4"><i class="bi bi-scissors fs-1"></i><br>Gunting</button>
              <button @click="playSuit('Kertas')" class="btn btn-outline-dark p-3 rounded-4"><i class="bi bi-hand-index-thumb-fill fs-1"></i><br>Kertas</button>
           </div>
           <p class="mt-4 text-muted small">Menang {{ gameScore }} dari 3 ronde!</p>
        </div>

        <div v-if="activeGame === 'trivia'">
           <h5 class="fw-bold mb-4">{{ triviaState.q }}</h5>
           <div class="d-grid gap-2 px-4">
              <button v-for="c in triviaState.choices" :key="c" @click="checkTrivia(c)" class="btn btn-outline-primary py-3 rounded-4 fw-bold">{{ c }}</button>
           </div>
        </div>

        <div v-if="activeGame === 'typer'">
           <div class="p-3 bg-light rounded-4 mb-3 border">
              <p class="mb-0 fw-bold">{{ typerTarget }}</p>
           </div>
           <input v-model="typerInput" @input="checkTyper" type="text" class="form-control p-3 rounded-4" placeholder="Ketik kalimat di atas...">
           <p class="small text-muted mt-2">Ketik dengan persis (spasi & huruf kapital)</p>
        </div>

        <div v-if="activeGame === 'vision'">
           <p class="small text-muted mb-3">Klik kotak yang warnanya berbeda!</p>
           <div class="vision-grid">
              <div v-for="(c, i) in visionColors" :key="i" @click="checkVision(c)" class="vision-box" :style="{ background: c }"></div>
           </div>
        </div>

        <div v-if="activeGame === 'balloon'">
           <p class="small text-muted mb-2">Terpecah: {{ gameScore }} / 10</p>
           <div class="balloon-area">
              <div v-for="b in balloons" :key="b.id" @click="popBalloon(b.id)" class="balloon" :style="{ left: b.x + 'px', bottom: (300 - b.y) + 'px' }">
                🎈
              </div>
           </div>
           <p class="small text-muted mt-3 italic">Tangkap balon sebelum terbang!</p>
        </div>

        <div v-if="activeGame === 'guess'">
           <h3 class="fw-bold mb-4">Tebak Angka 1-100</h3>
           <div class="input-group px-5 mb-3">
              <input id="guessInput" type="number" class="form-control p-3 rounded-start-4" placeholder="??">
              <button @click="makeGuess(document.getElementById('guessInput').value)" class="btn btn-primary px-4 rounded-end-4">TEBAK</button>
           </div>
           <p v-if="lastGuess" class="fw-bold text-primary">Tebakan terakhir: {{ lastGuess }}</p>
           <p class="small text-muted">Nyawa: {{ 10 - gameScore }}</p>
        </div>

        <div v-if="activeGame === 'tictactoe'">
           <h5 class="fw-bold mb-4">Lawan AI (X vs O)</h5>
           <div class="ttt-grid">
              <div v-for="(v, i) in board" :key="i" @click="moveTTT(i)" class="ttt-box" :class="v">
                {{ v }}
              </div>
           </div>
        </div>
      </div>

      <!-- Won Screen -->
      <div v-if="gameState === 'won'" class="py-4">
        <div class="win-circle mb-4 mx-auto">
          <i class="bi bi-trophy-fill text-warning" style="font-size: 4rem;"></i>
        </div>
        <h3 class="fw-bold mb-2">Hebat! Kamu Menang!</h3>
        <p class="text-muted">Database siap menyimpan <strong>{{ lastReward }} poin</strong> kamu.</p>
        <button @click="claimReward" class="btn btn-success w-100 py-3 rounded-pill fw-bold shadow-lg" :disabled="isLoading">
          <span v-if="isLoading" class="spinner-border spinner-border-sm me-2"></span>
          SIMPAN POINT KE DATABASE & PERINGKAT
        </button>
      </div>

      <!-- Game Over -->
      <div v-if="gameState === 'gameover'" class="py-5">
        <i class="bi bi-x-circle-fill text-danger mb-3" style="font-size: 5rem;"></i>
        <h3 class="fw-bold">Yahhh, Gagal!</h3>
        <p class="text-muted">Jangan menyerah, coba asah lagi otakmu!</p>
        <div class="d-grid gap-2 mt-4">
           <button @click="startActualPlay" class="btn btn-primary py-3 rounded-pill fw-bold">COBA LAGI</button>
           <button @click="activeGame = null" class="btn btn-light py-3 rounded-pill fw-bold">PILIH GAME LAIN</button>
        </div>
      </div>
    </div>
  </div>
</div>
</template>

<style scoped>
.game-zone-container { font-family: 'Plus Jakarta Sans', sans-serif; background: #fff; min-height: 500px; width: 100%; }
.game-card { border-radius: 20px; cursor: pointer; transition: 0.2s; background: #fff; height: 100%; border-color: #f1f5f9 !important; }
.game-card:hover { transform: translateY(-5px); border-color: #6366f1 !important; box-shadow: 0 10px 20px rgba(99,102,241,0.1) !important; }
.icon-box { width: 45px; height: 45px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; }
.active-game-overlay { min-height: 500px; display: flex; flex-direction: column; }
.game-canvas { border-bottom: 4px solid #4f46e5; height: 200px; }
.win-circle { width: 120px; height: 120px; background: #f0fdf4; border-radius: 50%; display: flex; align-items: center; justify-content: center; }

/* MEMORY GRID */
.memory-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; max-width: 250px; margin: 0 auto; }
.mem-card { height: 70px; background: #f1f5f9; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 2rem; cursor: pointer; transition: 0.3s; }
.mem-card.up { background: #fff; transform: rotateY(180deg); border: 2px solid #6366f1; }
.mem-card.matched { background: #dcfce7; cursor: default; }

/* SLIDER GRID */
.slider-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; width: 200px; margin: 0 auto; }
.slider-box { width: 60px; height: 60px; background: #6366f1; color: white; border-radius: 8px; font-weight: 800; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.slider-box.empty { background: #e2e8f0; }

/* SIMON GRID */
.simon-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; width: 220px; margin: 0 auto; }
.simon-box { height: 100px; border-radius: 20px; cursor: pointer; opacity: 0.5; transition: 0.2s; }
.simon-box.active { opacity: 1; transform: scale(1.05); }
.box-0 { background: #ef4444; }
.box-1 { background: #3b82f6; }
.box-2 { background: #f59e0b; }
.box-3 { background: #10b981; }

.vision-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; width: 240px; margin: 0 auto; }
.vision-box { height: 50px; border-radius: 8px; cursor: pointer; }

.balloon-area { height: 300px; background: #f0f9ff; border-radius: 20px; position: relative; overflow: hidden; border: 1px solid #e0f2fe; }
.balloon { position: absolute; font-size: 2.5rem; cursor: pointer; transition: bottom 0.1s linear; }

.ttt-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; width: 210px; margin: 0 auto; }
.ttt-box { height: 65px; border: 2px solid #e2e8f0; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 900; cursor: pointer; }
.ttt-box:hover { background: #f8fafc; }
.ttt-box.X { color: #6366f1; }
.ttt-box.O { color: #f43f5e; }
</style>
