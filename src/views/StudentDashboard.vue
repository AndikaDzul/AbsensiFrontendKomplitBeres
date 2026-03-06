<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { Html5Qrcode } from 'html5-qrcode'
import axios from 'axios'

// ASSETS
import siswaImg from '../Siswa.jpg'

const router = useRouter()
const backendUrl = 'https://backend-complited.vercel.app'

// ================= STATE SISWA & UI =================
const student = ref({ name:'', nis:'', class:'', status:'Belum Absen', lastAttendance: null })
const qrVisible = ref(false)
const scheduleVisible = ref(false)
const showGuide = ref(false) // State untuk panduan
let html5QrCode = null  
let scanning = false
const guruTokenPrefix = 'ABSENSI-GURU-'

// Mood State
const selectedMood = ref(null)
const moodQuote = ref('')
const moods = [
  { emoji: '😊', label: 'Senang', type: 'happy' },
  { emoji: '🤩', label: 'Semangat', type: 'happy' },
  { emoji: '😐', label: 'Biasa', type: 'neutral' },
  { emoji: '😔', label: 'Sedih', type: 'sad' },
  { emoji: '😴', label: 'Ngantuk', type: 'sad' }
]

const setMood = (mood) => {
  selectedMood.value = mood.label
  if (mood.type === 'sad') {
    const quotes = [
      "Jangan menyerah, badai pasti berlalu. Kamu lebih kuat dari yang kamu kira!",
      "Satu kegagalan bukan berarti akhir. Istirahat sejenak, lalu bangkit lagi!",
      "Setiap hari adalah kesempatan baru untuk memulai hal hebat.",
      "Kamu berharga, dan dunia butuh cahaya darimu hari ini."
    ]
    moodQuote.value = quotes[Math.floor(Math.random() * quotes.length)]
  } else {
    const quotes = [
      "Energi positifmu menular! Pertahankan semangat luar biasa ini.",
      "Hari yang cerah untuk jiwa yang penuh syukur. Teruslah bersinar!",
      "Kebahagiaan adalah kunci kesuksesan. Selamat belajar!",
      "Wujudkan mimpimu dengan senyuman hari ini!"
    ]
    moodQuote.value = quotes[Math.floor(Math.random() * quotes.length)]
  }
}

// State Jadwal & Config
const jadwalHariIni = ref([])
const schoolConfig = ref({ lat: null, lng: null, radius: 50 })

// ================= AUDIO & TOAST =================
const playSuccessSound = () => {
  const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2185/2185-preview.mp3')
  audio.play().catch(() => {})
}

const toast = ref({ show:false, msg:'', type:'success' })
const showToast = (msg,type='success')=>{
  toast.value = { show:true, msg, type }
  setTimeout(()=>toast.value.show=false,3000)
}

// ================= LOGIKA GEOLOCATION (OPTIMIZED) =================
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3 
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

const checkLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject("Browser tidak mendukung GPS")
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = position.coords.latitude
        const userLng = position.coords.longitude
        if (!schoolConfig.value.lat || !schoolConfig.value.lng) {
          reject("Lokasi belum diatur Admin.")
          return
        }
        const distance = calculateDistance(userLat, userLng, schoolConfig.value.lat, schoolConfig.value.lng)
        if (distance <= schoolConfig.value.radius) resolve(true)
        else reject(`Di luar jangkauan (${Math.round(distance)}m).`)
      },
      (err) => reject("Gagal akses GPS. Pastikan izin lokasi aktif."),
      { enableHighAccuracy: true, timeout: 6000 }
    )
  })
}

// ================= DATA FETCHING =================
const fetchJadwalFromAdmin = async () => {
  try {
    const res = await axios.get(`${backendUrl}/schedules`)
    if (res.data && student.value.class) {
      const studentClassNormal = student.value.class.toUpperCase().trim()
      const filtered = res.data.filter(j => {
        const matchHari = j.hari.toLowerCase() === hariIniText.value.toLowerCase()
        const scheduleClassNormal = j.kelas.toUpperCase().trim()
        return matchHari && (studentClassNormal.includes(scheduleClassNormal) || scheduleClassNormal.includes(studentClassNormal))
      })
      jadwalHariIni.value = filtered.sort((a, b) => a.jam.localeCompare(b.jam))
    }
  } catch (e) { console.error('Gagal mengambil jadwal', e) }
}

const loadGpsConfig = async () => {
  try { 
    const res = await axios.get(`${backendUrl}/config/gps`)
    if(res.data) schoolConfig.value = res.data 
  } catch (e) { console.log('GPS config error', e) }
}

// ================= SCANNER =================
const startScan = async () => {
  if (isWeekend.value) { showToast('Hari ini libur.', 'error'); return }
  if (!canAbsen.value) { showToast('Tunggu 2 jam untuk absen lagi.', 'error'); return }
  
  showToast('Cek Lokasi...', 'info')
  try {
    await checkLocation()
    
    qrVisible.value = true
    scanning = false
    await nextTick()
    
    if (html5QrCode) { 
        try { await html5QrCode.stop() } catch (e) {} 
        html5QrCode = null 
    }
    
    html5QrCode = new Html5Qrcode("qr-reader")
    await html5QrCode.start(
      { facingMode: "environment" }, 
      { fps: 20, qrbox: 250 }, 
      async (text) => {
        if (scanning) return
        if (text.startsWith(guruTokenPrefix)) { 
          scanning = true
          await submitAttendance(text) 
        } else {
          showToast('QR Code tidak valid!', 'error')
        }
      }
    )
  } catch (err) { 
    showToast(err, 'error')
    qrVisible.value = false 
  }
}

const stopScan = async () => {
  if (html5QrCode?.isScanning) await html5QrCode.stop()
  qrVisible.value = false
}

const submitAttendance = async(token)=>{
  try{
    const now = new Date()
    const currentMapel = jadwalHariIni.value.length > 0 ? jadwalHariIni.value[0].mapel : 'Pelajaran Umum'
    
    await axios.post(`${backendUrl}/students/attendance/${student.value.nis}`, { 
      status: 'Hadir', 
      qrToken: token, 
      mapel: currentMapel,
      timestamp: now.toISOString() 
    })
    
    student.value.status = 'Hadir'
    student.value.lastAttendance = now.toISOString()
    playSuccessSound()
    showToast('Absensi Berhasil!')
    
    setTimeout(() => { 
      stopScan()
      loadAttendance() 
    }, 800)
  } catch(err){ 
    showToast('Gagal mengirim data','error')
    scanning = false 
  }
}

const loadAttendance = async ()=>{
  try{
    const res = await axios.get(`${backendUrl}/students`)
    const me = res.data.find(s => s.nis === student.value.nis)
    
    if(me) {
      student.value.name = me.name
      student.value.class = me.class
      student.value.status = me.status || 'Belum Absen'
      
      if(me.status === 'Hadir' || me.status === 'Sakit' || me.status === 'Izin') {
        const lastAttendanceTime = me.attendanceHistory?.[me.attendanceHistory.length-1]?.timestamp || me.updatedAt
        const diff = new Date().getTime() - new Date(lastAttendanceTime).getTime()
        if (me.status === 'Hadir' && diff > (2 * 60 * 60 * 1000)) {
          student.value.status = 'Belum Absen'
        }
        student.value.lastAttendance = lastAttendanceTime
      }
    }
  } catch(err){ console.log('Load attendance error', err) }
}

const isWeekend = computed(() => {
  const day = new Date().getDay()
  return day === 0 || day === 6 
})

const canAbsen = computed(() => {
  if (isWeekend.value) return false
  if (!student.value.lastAttendance || student.value.status !== 'Hadir') return true
  const lastTime = new Date(student.value.lastAttendance).getTime()
  const now = new Date().getTime()
  return (now - lastTime) > (2 * 60 * 60 * 1000)
})

const displayStatus = computed(() => {
  if (isWeekend.value) return 'Libur Akhir Pekan'
  if(student.value.status === 'Hadir' && student.value.lastAttendance){
    return `Hadir - ${new Date(student.value.lastAttendance).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' })}`
  }
  return student.value.status
})

const hariIniText = computed(()=> new Date().toLocaleDateString('id-ID', { weekday: 'long' }))

// Logic Tutup Panduan
const closeGuide = () => {
  showGuide.value = false
  localStorage.setItem('hasSeenGuide', 'true')
}

const logout = () => { localStorage.clear(); router.push('/login') }

onMounted(async () => {
  const savedNis = localStorage.getItem('studentNis')
  if (!savedNis || savedNis === 'undefined') {
    router.replace('/login')
    return
  }

  // Cek apakah user pertama kali login/lihat panduan
  if (!localStorage.getItem('hasSeenGuide')) {
    showGuide.value = true
  }

  student.value.nis = savedNis
  student.value.name = localStorage.getItem('studentName') || 'Siswa'
  student.value.class = localStorage.getItem('studentClass') || '-'

  await Promise.all([
    loadAttendance(),
    loadGpsConfig(),
    fetchJadwalFromAdmin()
  ])

  const interval = setInterval(loadAttendance, 30000) 
  onUnmounted(() => clearInterval(interval))
})

onUnmounted(()=> stopScan())
</script>

<template>
<div class="app-container">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css" rel="stylesheet">

  <transition name="toast-fade">
    <div v-if="toast.show" class="custom-toast" :class="toast.type">
      <i :class="toast.type === 'success' ? 'bi bi-check-circle-fill' : (toast.type === 'info' ? 'bi bi-geo-alt-fill' : 'bi bi-exclamation-triangle-fill')"></i>
      {{ toast.msg }}
    </div>
  </transition>

  <transition name="fade">
    <div v-if="showGuide" class="guide-modal-overlay">
      <div class="guide-modal-content">
        <div class="text-center mb-4">
          <div class="guide-icon-header">
            <i class="bi bi-rocket-takeoff-fill"></i>
          </div>
          <h4 class="fw-bold mt-3">Halo, {{ student.name }}!</h4>
          <p class="text-muted small">Yuk, pelajari cara absen di aplikasi ini</p>
        </div>
        
        <div class="guide-steps">
          <div class="guide-step-item">
            <div class="step-icon"><i class="bi bi-geo-alt"></i></div>
            <div class="step-text">
              <h6>Aktifkan GPS</h6>
              <p>Pastikan kamu berada dalam radius <strong>{{ schoolConfig.radius }}m</strong> dari sekolah.</p>
            </div>
          </div>
          <div class="guide-step-item">
            <div class="step-icon"><i class="bi bi-qr-code-scan"></i></div>
            <div class="step-text">
              <h6>Scan QR Guru</h6>
              <p>Klik tombol <strong>ABSENSI</strong> dan arahkan kamera ke QR Code yang diberikan Guru.</p>
            </div>
          </div>
          <div class="guide-step-item">
            <div class="step-icon"><i class="bi bi-clock-history"></i></div>
            <div class="step-text">
              <h6>Interval Absen</h6>
              <p>Absensi hanya bisa dilakukan sesuai jadwal mapel <strong></strong> untuk mata pelajaran berikutnya.</p>
            </div>
          </div>
        </div>

        <button @click="closeGuide" class="btn btn-primary-custom w-100 py-3 mt-3">
          Saya Mengerti, Mulai!
        </button>
      </div>
    </div>
  </transition>

  <nav class="navbar navbar-light bg-white sticky-top shadow-sm px-3 py-3">
    <div class="container-fluid p-0">
      <div class="d-flex align-items-center">
        <div class="user-avatar-glow me-3">
          {{ student.name ? student.name.charAt(0).toUpperCase() : 'S' }}
        </div>
        <div>
          <h6 class="mb-0 fw-bold text-dark text-truncate" style="max-width: 150px;">
            {{ student.name }}
          </h6>
          <small class="text-muted">{{ student.class }}</small>
        </div>
      </div>
      <button @click="logout" class="btn btn-light btn-sm rounded-pill px-3 text-danger fw-bold">
        <i class="bi bi-box-arrow-right"></i>
      </button>
    </div>
  </nav>

  <main class="container px-4 mt-4">
    <section class="status-card shadow-sm mb-4" :class="student.status === 'Hadir' ? 'status-active' : (isWeekend ? 'status-weekend' : 'status-pending')">
      <div class="card-body p-4 text-white">
        <div class="d-flex justify-content-between opacity-75 small mb-2">
          <span>STATUS KEHADIRAN</span>
          <i class="bi bi-shield-check"></i>
        </div>
        <h2 class="display-6 fw-bold mb-3">{{ displayStatus }}</h2>
        <div class="d-flex align-items-center">
          <div class="pulse-dot me-2" v-if="!isWeekend"></div>
          <span class="small opacity-90">{{ hariIniText }}, {{ new Date().toLocaleDateString('id-ID') }}</span>
        </div>
      </div>
    </section>

    <div class="row g-3 mb-4">
      <div class="col-6">
        <button class="action-card btn w-100 py-4 shadow-sm" @click="startScan" :disabled="!canAbsen" :class="!canAbsen ? 'disabled-card' : 'scan-active'">
          <i class="bi bi-qr-code-scan d-block mb-2 fs-2"></i>
          <span class="fw-bold small">{{ isWeekend ? 'HARI LIBUR' : 'ABSENSI' }}</span>
        </button>
      </div>
      <div class="col-6">
        <button class="action-card btn btn-white w-100 py-4 shadow-sm" @click="scheduleVisible = true">
          <i class="bi bi-info-circle d-block mb-2 fs-2 text-primary"></i>
          <span class="fw-bold small">INFO & JADWAL</span>
        </button>
      </div>
    </div>

    <div class="banner-container mb-4 shadow-sm" v-if="siswaImg">
      <div class="banner-wrapper">
        <img :src="siswaImg" alt="Siswa" class="banner-img">
        <div class="banner-overlay">
          <p class="banner-text"></p>
        </div>
      </div>
    </div>

    <div class="mood-section bg-white p-4 rounded-4 shadow-sm border mb-4">
      <h6 class="fw-bold mb-3 text-dark text-center">Bagaimana mood kamu hari ini?</h6>
      <div class="d-flex justify-content-between mb-3 px-1">
        <button v-for="mood in moods" :key="mood.label" @click="setMood(mood)" 
          class="btn mood-btn" :class="{ 'active': selectedMood === mood.label }">
          <span class="fs-2">{{ mood.emoji }}</span>
          <small class="d-block text-muted mt-1" style="font-size: 0.6rem;">{{ mood.label }}</small>
        </button>
      </div>
      <transition name="fade">
        <div v-if="moodQuote" class="quote-box p-3 rounded-3 text-center mt-2">
          <i class="bi bi-quote text-primary fs-4"></i>
          <p class="mb-0 fst-italic small text-dark fw-semibold">{{ moodQuote }}</p>
        </div>
      </transition>
    </div>

    <div class="guide-section bg-white p-4 rounded-4 shadow-sm border mb-5">
      <h6 class="fw-bold mb-3 text-dark"><i class="bi bi-journal-text me-2 text-primary"></i>Informasi Akun</h6>
      <div class="small text-muted">
        <div class="d-flex mb-3">
          <div class="guide-num me-3">1</div>
          <p class="m-0">Radius sekolah: <strong>{{ schoolConfig.radius }} meter</strong>.</p>
        </div>
        <div class="d-flex mb-3">
          <div class="guide-num me-3">2</div>
          <p class="m-0">Kelas & Jurusan: <strong>{{ student.class }}</strong></p>
        </div>
        <div class="d-flex">
          <div class="guide-num me-3">3</div>
          <p class="m-0">Jadwal otomatis menyesuaikan jurusan Anda.</p>
        </div>
      </div>
    </div>
  </main>

  <transition name="fade">
    <div v-if="qrVisible" class="scanner-fullscreen">
      <div class="scanner-nav p-3 d-flex justify-content-between align-items-center text-white">
        <button @click="stopScan" class="btn btn-outline-light btn-sm rounded-pill px-3">
          <i class="bi bi-x-lg me-1"></i> Batal
        </button>
        <span class="small fw-bold">ARAHKAN KE QR GURU</span>
        <div style="width: 70px"></div>
      </div>
      <div class="scanner-body">
        <div id="qr-reader"></div>
        <div class="scan-overlay">
          <div class="scan-frame">
            <div class="corner t-l"></div><div class="corner t-r"></div>
            <div class="corner b-l"></div><div class="corner b-r"></div>
            <div class="scan-line"></div>
          </div>
        </div>
      </div>
    </div>
  </transition>

  <transition name="sheet">
    <div v-if="scheduleVisible" class="sheet-overlay" @click.self="scheduleVisible=false">
      <div class="sheet-content">
        <div class="sheet-handle"></div>
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h5 class="fw-bold m-0 text-dark">Jadwal Pelajaran</h5>
            <span class="badge bg-primary-subtle text-primary">{{ student.class }}</span>
        </div>
        <div class="schedule-items">
          <div v-for="(j,i) in jadwalHariIni" :key="i" class="schedule-card-item p-3 mb-3">
            <div class="d-flex align-items-center">
              <div class="time-box me-3">
                <span class="fw-bold text-primary smaller">{{ j.jam }}</span>
              </div>
              <div>
                <strong class="d-block text-dark small mb-1">{{ j.mapel }}</strong>
                <div class="text-muted smaller d-flex align-items-center">
                  <i class="bi bi-person me-1"></i> {{ j.guru }}
                </div>
              </div>
            </div>
          </div>
          <div v-if="jadwalHariIni.length === 0" class="text-center py-5">
              <i class="bi bi-calendar2-x fs-1 text-light mb-3 d-block"></i>
              <p class="text-muted">Tidak ada jadwal untuk {{ student.class }} hari ini.</p>
          </div>
        </div>
        <button @click="scheduleVisible=false" class="btn btn-light w-100 rounded-pill mt-2">Tutup</button>
      </div>
    </div>
  </transition>
</div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');

.app-container { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #f8fafc; min-height: 100vh; max-width: 500px; margin: 0 auto; position: relative; }
.user-avatar-glow { width: 42px; height: 42px; background: linear-gradient(135deg, #6366f1, #4f46e5); color: white; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 800; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3); }

/* --- MODAL PANDUAN STYLING --- */
.guide-modal-overlay {
  position: fixed; inset: 0; background: rgba(15, 23, 42, 0.8);
  backdrop-filter: blur(8px); z-index: 11000;
  display: flex; align-items: center; justify-content: center; padding: 20px;
}
.guide-modal-content {
  background: white; width: 100%; max-width: 400px;
  border-radius: 32px; padding: 30px; animation: slideUp 0.5s ease-out;
}
.guide-icon-header {
  width: 70px; height: 70px; background: #eef2ff; color: #6366f1;
  border-radius: 24px; display: flex; align-items: center; justify-content: center;
  font-size: 2rem; margin: 0 auto;
}
.guide-step-item { display: flex; gap: 15px; margin-bottom: 20px; }
.step-icon {
  width: 40px; height: 40px; background: #f1f5f9; color: #475569;
  border-radius: 12px; display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; font-size: 1.2rem;
}
.step-text h6 { margin: 0; font-weight: 700; font-size: 0.95rem; }
.step-text p { margin: 0; font-size: 0.8rem; color: #64748b; line-height: 1.4; }
.btn-primary-custom {
  background: #6366f1; color: white; border: none; border-radius: 16px;
  font-weight: 700; transition: 0.3s;
}
.btn-primary-custom:hover { background: #4f46e5; transform: translateY(-2px); }

/* Banner Styling */
.banner-container { border-radius: 20px; overflow: hidden; position: relative; }
.banner-wrapper { position: relative; width: 100%; height: 200px; }
.banner-img { width: 100%; height: 156%; object-fit: cover; }
.banner-overlay { 
  position: absolute; bottom: 0; left: 0; right: 0; 
  background: linear-gradient(to top, rgba(0,0,0,0.8), transparent); 
  padding: 20px 15px 10px; display: flex; align-items: flex-end;
}
.banner-text { 
  color: white; font-weight: 800; font-size: 0.85rem; line-height: 1.2;
  margin: 0; text-transform: uppercase; letter-spacing: 0.5px;
  text-shadow: 0 2px 4px rgba(0,0,0,0.5);
}

/* Mood Section Styling */
.mood-btn { border: 2px solid transparent; transition: 0.3s; padding: 8px; border-radius: 15px; }
.mood-btn.active { background: #eef2ff; border-color: #6366f1; transform: scale(1.1); }
.quote-box { background: #f8faff; border-left: 4px solid #6366f1; animation: slideDown 0.4s ease-out; }

/* Status Cards */
.status-card { border-radius: 28px; border: none; overflow: hidden; transition: 0.4s; }
.status-pending { background: linear-gradient(135deg, #1e293b, #334155); }
.status-weekend { background: linear-gradient(135deg, #ef4444, #b91c1c); }
.status-active { background: linear-gradient(135deg, #10b981, #059669); box-shadow: 0 12px 24px rgba(16, 185, 129, 0.25) !important; }
.pulse-dot { width: 8px; height: 8px; background: #fff; border-radius: 50%; animation: pulse 2s infinite; }
@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(255,255,255,0.7); } 70% { box-shadow: 0 0 0 10px rgba(255,255,255,0); } 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0); } }

.action-card { background: white; border-radius: 24px; border: 1px solid #f1f5f9; transition: 0.2s; }
.scan-active { color: #6366f1; border: 1px solid #e0e7ff; }
.disabled-card { background: #f1f5f9 !important; color: #94a3b8 !important; border: none; cursor: not-allowed; }
.guide-num { width: 24px; height: 24px; background: #eef2ff; color: #6366f1; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.75rem; flex-shrink: 0; }

/* Scanner */
.scanner-fullscreen { position:fixed; inset:0; background:#000; z-index:9999; display:flex; flex-direction:column; }
.scanner-nav { z-index: 10; background: rgba(0,0,0,0.5); }
.scanner-body { flex:1; position:relative; overflow: hidden; }
#qr-reader { width: 100% !important; height: 100% !important; border: none !important; }
.scan-overlay { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; z-index: 5; }
.scan-frame { width: 260px; height: 260px; position: relative; }
.corner { position: absolute; width: 30px; height: 30px; border: 4px solid #6366f1; }
.t-l { top: 0; left: 0; border-right: none; border-bottom: none; border-radius: 15px 0 0 0; }
.t-r { top: 0; right: 0; border-left: none; border-bottom: none; border-radius: 0 15px 0 0; }
.b-l { bottom: 0; left: 0; border-right: none; border-top: none; border-radius: 0 0 0 15px; }
.b-r { bottom: 0; right: 0; border-left: none; border-top: none; border-radius: 0 0 15px 0; }
.scan-line { position: absolute; width: 100%; height: 2px; background: #6366f1; box-shadow: 0 0 15px #6366f1; animation: moveLine 2.5s infinite linear; }
@keyframes moveLine { 0% { top: 0% } 50% { top: 100% } 100% { top: 0% } }

/* Sheet & Toast */
.sheet-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); z-index: 2000; display: flex; align-items: flex-end; }
.sheet-content { background: white; width: 100%; border-radius: 30px 30px 0 0; padding: 25px; animation: slideUp 0.4s ease-out; max-height: 80vh; overflow-y: auto; }
.sheet-handle { width: 40px; height: 5px; background: #e2e8f0; border-radius: 10px; margin: 0 auto 15px; }
.schedule-card-item { background: #f8fafc; border-radius: 18px; border: 1px solid #f1f5f9; }
.time-box { background: #eef2ff; padding: 5px 10px; border-radius: 10px; }
.custom-toast { position: fixed; top: 25px; left: 50%; transform: translateX(-50%); z-index: 10000; padding: 12px 24px; border-radius: 15px; color: white; display: flex; align-items: center; gap: 10px; font-weight: 700; box-shadow: 0 10px 20px rgba(0,0,0,0.2); background: #1e293b; min-width: 250px; justify-content: center; }
.custom-toast.error { background: #ef4444; }
.custom-toast.info { background: #6366f1; }
.smaller { font-size: 0.8rem; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes slideDown { from { transform: translateY(-10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
</style>