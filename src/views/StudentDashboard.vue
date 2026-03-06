<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { Html5Qrcode } from 'html5-qrcode'
import axios from 'axios'

// ASSETS
import siswaImg from '../Siswa.jpg'
import senamImg from '../senam.jpg'

const router = useRouter()
const backendUrl = 'https://backend-complited.vercel.app'

// ================= STATE SISWA & UI =================
const student = ref({ name:'', nis:'', class:'', status:'Belum Absen', lastAttendance: null })
const qrVisible = ref(false)
const scheduleVisible = ref(false)
const showGuide = ref(false) 
const profileVisible = ref(false) 
const profileImage = ref(null)    
let html5QrCode = null  
let scanning = false
const guruTokenPrefix = 'ABSENSI-GURU-'

// Logic Quotes & Banner Slider
const activeBannerIndex = ref(0)
const banners = [
  { 
    img: siswaImg, 
    quote: "Pendidikan adalah tiket ke masa depan. Hari esok dimiliki oleh mereka yang mempersiapkannya hari ini." 
  },
  { 
    img: senamImg, 
    quote: "Tubuh yang sehat adalah kunci pikiran yang jernih. Jangan lupa olahraga dan tetap bugar!" 
  }
]

const onBannerScroll = (event) => {
  const scrollPosition = event.target.scrollLeft
  const width = event.target.offsetWidth
  activeBannerIndex.value = Math.round(scrollPosition / width)
}

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

// Logic Foto Profil
const handleImageUpload = (event) => {
  const file = event.target.files[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      profileImage.value = e.target.result
      localStorage.setItem(`profile_img_${student.value.nis}`, e.target.result)
    }
    reader.readAsDataURL(file)
  }
}

// Deteksi Jenis Kelamin Sederhana
const genderDetect = computed(() => {
  const name = student.value.name.toLowerCase()
  if (name.includes('putri') || name.includes('siti') || name.endsWith('a') || name.endsWith('i')) return 'Perempuan'
  return 'Laki-laki'
})

// State Jadwal & Config
const jadwalHariIni = ref([])
const schoolConfig = ref({ lat: null, lng: null, radius: 50 })

// ================= AUDIO & VIBRATION =================
const playSuccessFeedback = () => {
  const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2185/2185-preview.mp3')
  audio.play().catch((e) => console.log("Audio play blocked by browser"))
  if ('vibrate' in navigator) {
    navigator.vibrate([200, 100, 200])
  }
}

const toast = ref({ show:false, msg:'', type:'success' })
const showToast = (msg,type='success')=>{
  toast.value = { show:true, msg, type }
  setTimeout(()=>toast.value.show=false,3000)
}

// ================= LOGIKA GEOLOCATION =================
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
  if (!canAbsen.value) { 
    showToast('Tunggu 2 jam untuk absen lagi.', 'error')
    return 
  }
  
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
    
    playSuccessFeedback()
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
        if (me.status === 'Hadir' && diff > (1 * 50 * 60 * 1000)) {
          student.value.status = 'Belum Absen'
        }
        student.value.lastAttendance = lastAttendanceTime
      }
    }
  } catch(err){ console.log('Load attendance error', err) }
}

const canAbsen = computed(() => {
  if (!student.value.lastAttendance || student.value.status !== 'Hadir') return true
  const lastTime = new Date(student.value.lastAttendance).getTime()
  const now = new Date().getTime()
  return (now - lastTime) > (2 * 60 * 60 * 1000)
})

const displayStatus = computed(() => {
  if(student.value.status === 'Hadir' && student.value.lastAttendance){
    return `Hadir - ${new Date(student.value.lastAttendance).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' })}`
  }
  return student.value.status
})

const hariIniText = computed(()=> new Date().toLocaleDateString('id-ID', { weekday: 'long' }))

const closeGuide = () => {
  showGuide.value = false
  localStorage.setItem('hasSeenGuide', 'true')
}

const logout = () => { localStorage.clear(); router.push('/login') }

// ================= LIFECYCLE =================
onMounted(async () => {
  const meta = document.createElement('meta')
  meta.name = "viewport"
  meta.content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
  document.getElementsByTagName('head')[0].appendChild(meta)

  document.addEventListener('touchstart', (event) => {
    if (event.touches.length > 1) {
      event.preventDefault()
    }
  }, { passive: false })

  const savedNis = localStorage.getItem('studentNis')
  if (!savedNis || savedNis === 'undefined') {
    router.replace('/login')
    return
  }

  if (!localStorage.getItem('hasSeenGuide')) {
    showGuide.value = true
  }

  student.value.nis = savedNis
  student.value.name = localStorage.getItem('studentName') || 'Siswa'
  student.value.class = localStorage.getItem('studentClass') || '-'
  
  const savedImg = localStorage.getItem(`profile_img_${savedNis}`)
  if(savedImg) profileImage.value = savedImg

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
        </div>

        <button @click="closeGuide" class="btn btn-primary-custom w-100 py-3 mt-3">
          Saya Mengerti, Mulai!
        </button>
      </div>
    </div>
  </transition>

  <nav class="navbar navbar-light bg-white sticky-top shadow-sm px-3 py-3">
    <div class="container-fluid p-0">
      <div class="d-flex align-items-center" @click="profileVisible = true" style="cursor: pointer;">
        <div class="user-avatar-glow me-3 overflow-hidden">
          <img v-if="profileImage" :src="profileImage" class="w-100 h-100 object-fit-cover">
          <span v-else>{{ student.name ? student.name.charAt(0).toUpperCase() : 'S' }}</span>
        </div>
        <div>
          <h6 class="mb-0 fw-bold text-dark text-truncate" style="max-width: 150px;">
            {{ student.name }}
          </h6>
          <small class="text-muted">Lihat Profil <i class="bi bi-chevron-right small"></i></small>
        </div>
      </div>
      <button @click="logout" class="btn btn-light btn-sm rounded-pill px-3 text-danger fw-bold">
        <i class="bi bi-box-arrow-right"></i>
      </button>
      </div>
  </nav>

  <main class="container px-4 mt-4">
    <section class="status-card shadow-sm mb-4" :class="student.status === 'Hadir' ? 'status-active' : 'status-pending'">
      <div class="card-body p-4 text-white">
        <div class="d-flex justify-content-between opacity-75 small mb-2">
          <span>STATUS KEHADIRAN</span>
          <i class="bi bi-shield-check"></i>
        </div>
        <h2 class="display-6 fw-bold mb-3">{{ displayStatus }}</h2>
        <div class="d-flex align-items-center">
          <div class="pulse-dot me-2"></div>
          <span class="small opacity-90">{{ hariIniText }}, {{ new Date().toLocaleDateString('id-ID') }}</span>
        </div>
      </div>
    </section>

    <div class="row g-3 mb-4">
      <div class="col-6">
        <button class="action-card btn w-100 py-4 shadow-sm" @click="startScan" :disabled="!canAbsen" :class="!canAbsen ? 'disabled-card' : 'scan-active'">
          <i class="bi bi-qr-code-scan d-block mb-2 fs-2"></i>
          <span class="fw-bold small">ABSENSI</span>
        </button>
      </div>
      <div class="col-6">
        <button class="action-card btn btn-white w-100 py-4 shadow-sm" @click="scheduleVisible = true">
          <i class="bi bi-info-circle d-block mb-2 fs-2 text-primary"></i>
          <span class="fw-bold small">INFO & JADWAL</span>
        </button>
      </div>
    </div>

    <div class="banner-container mb-4 shadow-sm">
      <div class="banner-scroll-wrapper" @scroll="onBannerScroll">
        <div v-for="(banner, index) in banners" :key="index" class="banner-slide">
          <img :src="banner.img" class="banner-img">
          <div class="banner-overlay"></div>
        </div>
      </div>
      <div class="banner-dots">
        <span v-for="(_, i) in banners" :key="i" :class="{ active: activeBannerIndex === i }"></span>
      </div>
      <div class="study-quote-bar p-3 bg-white">
        <div class="d-flex align-items-center">
            <div class="quote-lamp me-3">
                <i class="bi bi-lightbulb-fill text-warning"></i>
            </div>
            <p class="mb-0 smaller fw-bold text-dark italic-quote">"{{ banners[activeBannerIndex].quote }}"</p>
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
      <h6 class="fw-bold mb-3 text-dark"><i class="bi bi-journal-text me-2 text-primary"></i>Informasi Sekolah</h6>
      <div class="small text-muted">
        <div class="d-flex mb-3">
          <div class="guide-num me-3">1</div>
          <p class="m-0">Radius sekolah: <strong>{{ schoolConfig.radius }} meter</strong>.</p>
        </div>
        <div class="d-flex">
          <div class="guide-num me-3">2</div>
          <p class="m-0">Lokasi: <strong>SMK Negeri 1 Cianjur</strong></p>
        </div>
      </div>
    </div>
  </main>

  <transition name="slide-side">
    <div v-if="profileVisible" class="profile-overlay">
      <div class="profile-header p-4">
        <button @click="profileVisible = false" class="btn btn-link text-white p-0 mb-4">
          <i class="bi bi-arrow-left fs-4"></i> Kembali
        </button>
        <div class="text-center">
          <div class="profile-img-container mx-auto mb-3">
            <img :src="profileImage || 'https://via.placeholder.com/150'" class="profile-img-main">
            <label class="btn-upload-img">
              <i class="bi bi-camera-fill"></i>
              <input type="file" @change="handleImageUpload" accept="image/*" hidden>
            </label>
          </div>
          <h4 class="fw-bold text-white mb-0">{{ student.name }}</h4>
          <p class="text-white-50 small mb-0">SMK NEGERI 1 CIANJUR</p>
        </div>
      </div>
      
      <div class="profile-body p-4">
        <div class="info-group mb-4">
          <label class="text-muted smaller fw-bold mb-2 d-block">INFORMASI PRIBADI</label>
          <div class="info-item shadow-sm border">
            <div class="p-3 border-bottom d-flex justify-content-between">
              <span class="text-muted">NIS</span>
              <span class="fw-bold">{{ student.nis }}</span>
            </div>
            <div class="p-3 border-bottom d-flex justify-content-between">
              <span class="text-muted">Kelas</span>
              <span class="fw-bold">{{ student.class }}</span>
            </div>
            <div class="p-3 d-flex justify-content-between">
              <span class="text-muted">Jenis Kelamin</span>
              <span class="fw-bold">{{ genderDetect }}</span>
            </div>
          </div>
        </div>

        <div class="info-group">
          <label class="text-muted smaller fw-bold mb-2 d-block">LOKASI SEKARANG</label>
          <div class="info-item shadow-sm border p-3 d-flex align-items-center">
            <i class="bi bi-geo-alt-fill text-danger fs-4 me-3"></i>
            <div>
              <p class="mb-0 fw-bold small">Area SMK Negeri 1 Cianjur</p>
              <p class="mb-0 text-muted smaller">Kabupaten Cianjur, Jawa Barat</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>

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
              <p class="text-muted">Tidak ada jadwal hari ini.</p>
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

.app-container { 
  font-family: 'Plus Jakarta Sans', sans-serif; 
  background-color: #f8fafc; 
  min-height: 100vh; 
  max-width: 500px; 
  margin: 0 auto; 
  position: relative; 
  overflow-x: hidden;
  touch-action: pan-y;
}

/* BANNER SLIDER STYLES */
.banner-container { border-radius: 24px; overflow: hidden; position: relative; border: 1px solid #e2e8f0; background: white; }
.banner-scroll-wrapper { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; scroll-behavior: smooth; -webkit-overflow-scrolling: touch; }
.banner-scroll-wrapper::-webkit-scrollbar { display: none; }
.banner-slide { min-width: 100%; height: 160px; scroll-snap-align: start; position: relative; }
.banner-img { width: 100%; height: 100%; object-fit: cover; }
.banner-dots { position: absolute; top: 140px; left: 50%; transform: translateX(-50%); display: flex; gap: 6px; z-index: 10; }
.banner-dots span { width: 6px; height: 6px; background: rgba(255,255,255,0.5); border-radius: 50%; transition: 0.3s; }
.banner-dots span.active { width: 18px; background: white; border-radius: 10px; }

/* PROFIL STYLES */
.profile-overlay { position: fixed; inset: 0; background: #f8fafc; z-index: 5000; overflow-y: auto; }
.profile-header { background: linear-gradient(135deg, #6366f1, #4f46e5); border-radius: 0 0 40px 40px; }
.profile-img-container { width: 120px; height: 120px; position: relative; border: 4px solid rgba(255,255,255,0.3); border-radius: 40px; }
.profile-img-main { width: 100%; height: 100%; object-fit: cover; border-radius: 36px; background: white; }
.btn-upload-img { position: absolute; bottom: -5px; right: -5px; background: #10b981; color: white; width: 35px; height: 35px; border-radius: 12px; display: flex; align-items: center; justify-content: center; border: 3px solid #6366f1; cursor: pointer; }
.info-item { background: white; border-radius: 20px; overflow: hidden; }

/* STUDY QUOTES CSS */
.study-quote-bar { border-top: 1px solid #f1f5f9; min-height: 80px; display: flex; align-items: center; }
.quote-lamp { width: 35px; height: 35px; background: #fffbeb; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.italic-quote { font-style: italic; color: #475569; line-height: 1.3; font-size: 0.75rem; }

/* ANIMATIONS */
.slide-side-enter-active, .slide-side-leave-active { transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
.slide-side-enter-from { transform: translateX(100%); }
.slide-side-leave-to { transform: translateX(100%); }

.user-avatar-glow { width: 42px; height: 42px; background: linear-gradient(135deg, #6366f1, #4f46e5); color: white; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 800; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3); }
.guide-modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.8); backdrop-filter: blur(8px); z-index: 11000; display: flex; align-items: center; justify-content: center; padding: 20px; }
.guide-modal-content { background: white; width: 100%; max-width: 400px; border-radius: 32px; padding: 30px; animation: slideUp 0.5s ease-out; }
.guide-icon-header { width: 70px; height: 70px; background: #eef2ff; color: #6366f1; border-radius: 24px; display: flex; align-items: center; justify-content: center; font-size: 2rem; margin: 0 auto; }
.guide-step-item { display: flex; gap: 15px; margin-bottom: 20px; }
.step-icon { width: 40px; height: 40px; background: #f1f5f9; color: #475569; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 1.2rem; }
.step-text h6 { margin: 0; font-weight: 700; font-size: 0.95rem; }
.step-text p { margin: 0; font-size: 0.8rem; color: #64748b; line-height: 1.4; }
.btn-primary-custom { background: #6366f1; color: white; border: none; border-radius: 16px; font-weight: 700; transition: 0.3s; }
.btn-primary-custom:hover { background: #4f46e5; transform: translateY(-2px); }

.banner-overlay { position: absolute; inset: 0; background: linear-gradient(transparent, rgba(0,0,0,0.2)); }

.mood-btn { border: 2px solid transparent; transition: 0.3s; padding: 8px; border-radius: 15px; }
.mood-btn.active { background: #eef2ff; border-color: #6366f1; transform: scale(1.1); }
.quote-box { background: #f8faff; border-left: 4px solid #6366f1; animation: slideDown 0.4s ease-out; }

.status-card { border-radius: 28px; border: none; overflow: hidden; transition: 0.4s; }
.status-pending { background: linear-gradient(135deg, #1e293b, #334155); }
.status-active { background: linear-gradient(135deg, #10b981, #059669); box-shadow: 0 12px 24px rgba(16, 185, 129, 0.25) !important; }
.pulse-dot { width: 8px; height: 8px; background: #fff; border-radius: 50%; animation: pulse 2s infinite; }
@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(255,255,255,0.7); } 70% { box-shadow: 0 0 0 10px rgba(255,255,255,0); } 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0); } }

.action-card { background: white; border-radius: 24px; border: 1px solid #f1f5f9; transition: 0.2s; }
.scan-active { color: #6366f1; border: 1px solid #e0e7ff; }
.disabled-card { background: #f1f5f9 !important; color: #94a3b8 !important; border: none; cursor: not-allowed; }
.guide-num { width: 24px; height: 24px; background: #eef2ff; color: #6366f1; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.75rem; flex-shrink: 0; }

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

.sheet-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); z-index: 2000; display: flex; align-items: flex-end; }
.sheet-content { background: white; width: 100%; border-radius: 30px 30px 0 0; padding: 25px; animation: slideUp 0.4s ease-out; max-height: 80vh; overflow-y: auto; }
.sheet-handle { width: 40px; height: 5px; background: #e2e8f0; border-radius: 10px; margin: 0 auto 15px; }
.schedule-card-item { background: #f8fafc; border-radius: 18px; border: 1px solid #f1f5f9; }
.time-box { background: #eef2ff; padding: 5px 10px; border-radius: 10px; }
.custom-toast { position: fixed; top: 25px; left: 50%; transform: translateX(-50%); z-index: 10000; padding: 12px 24px; border-radius: 15px; color: white; display: flex; align-items: center; gap: 10px; font-weight: 700; box-shadow: 0 10px 20px rgba(0,0,0,0.2); background: #1e293b; min-width: 250px; justify-content: center; }
.custom-toast.error { background: #ef4444; }
.custom-toast.info { background: #6366f1; }
.smaller { font-size: 0.8rem; }
.fade-enter-active, .fade-enter-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes slideDown { from { transform: translateY(-10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
</style>