<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Html5Qrcode } from 'html5-qrcode'
import axios from 'axios'

// Tambahkan library kompresi secara dinamis
const loadCompressionLibrary = () => {
  return new Promise((resolve) => {
    if (window.imageCompression) return resolve();
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/browser-image-compression@2.0.2/dist/browser-image-compression.js";
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
};

// ASSETS
import smkzieImg from '../smkzie.jpg'
import senamImg from '../senam.jpg'
import bacaImg from '../baca.jpg'
import KamisImg from '../Kamis.jpg'
import jumatImg from '../jumat.jpg'

const router = useRouter()
const backendUrl = 'https://project-backend-beres-5z94.vercel.app/api'


// ================= STATE SISWA & UI =================
const student = ref({ 
  name:'', 
  nis:'', 
  class:'', 
  status:'Belum Absen', 
  lastAttendance: null, 
  lastPulang: null, 
  gender: '' 
})
const attendanceStats = ref({ hadir: 0, sakit: 0, izin: 0, alfa: 0 }) 
const qrVisible = ref(false)
const scheduleVisible = ref(false)
const showGuide = ref(false)  
const profileVisible = ref(false)  
const profileImage = ref(null)      
const showLogoutConfirm = ref(false) 
const showVibrateBanner = ref(false) 
const isSendingEmail = ref(false)
const isProcessingAbsen = ref(false) // State untuk overlay loading
let html5QrCode = null   
let scanning = false
const guruTokenPrefix = 'ABSENSI-GURU-'

const isNotificationEnabled = ref(localStorage.getItem('notif_active') !== 'false')

// ================= LOGIKA KIRIM BUKTI (WHATSAPP REDIRECT) =================
const isUploading = ref(false)

const handleSendEvidenceDirect = () => {
  const phoneNumber = '6281322233928' // Format internasional tanpa '+'
  const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const dateStr = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const message = `Halo Bapak Ibu , saya ingin melaporkan kehadiran:%0A%0A` +
                  `*Nama:* ${student.value.name}%0A` +
                  `*NIS:* ${student.value.nis}%0A` +
                  `*Kelas:* ${student.value.class}%0A` +
                  `*Status:* ${student.value.status}%0A` +
                  `*Waktu:* ${timeStr} WIB%0A` +
                  `*Tanggal:* ${dateStr}%0A%0A` +
                  `Berikut saya lampirkan bukti foto kehadiran saya. Terima kasih.`;

  const waUrl = `https://wa.me/${phoneNumber}?text=${message}`;
  
  showToast('Membuka WhatsApp...', 'info')
  isUploading.value = true
  
  setTimeout(() => {
    window.open(waUrl, '_blank');
  }, 800)
}

const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible' && isUploading.value) {
    isUploading.value = false;
    showToast('Kembali ke Absensi', 'success');
    loadAttendance();
  }
}

// ================= LOGIKA GETAR & SUARA (ALARM MODE) =================
let reminderInterval = null;

const playReminderFeedback = () => {
  if (!isNotificationEnabled.value || student.value.status !== 'Belum Absen') {
    stopReminderSystem();
    return;
  }

  const audio = new Audio('https://raw.githubusercontent.com/freeCodeCamp/cdn/master/build/testable-projects-fcc/audio/BeepSound.wav');
  audio.volume = 1.0;  
  audio.play().catch(() => {
    console.log("Autoplay diblokir browser.");
  });

  if ('vibrate' in navigator) {
    navigator.vibrate([500, 200, 500, 200, 500, 200, 500]);
  }
};

const startReminderSystem = () => {
  stopReminderSystem(); 
  
  if (isNotificationEnabled.value && student.value.status === 'Belum Absen') {
    showVibrateBanner.value = true;
    updateBackgroundReminder();
    playReminderFeedback();
    
    reminderInterval = setInterval(() => {
      playReminderFeedback();
    }, 8000);
  }
};

const stopReminderSystem = () => {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
  if ('vibrate' in navigator) navigator.vibrate(0);  
  showVibrateBanner.value = false;
  updateBackgroundReminder();
};

const updateBackgroundReminder = () => {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'UPDATE_STATUS',
      status: student.value.status,
      enabled: isNotificationEnabled.value,
      name: student.value.name
    });

    if (isNotificationEnabled.value && student.value.status === 'Belum Absen') {
        navigator.serviceWorker.controller.postMessage({
            type: 'SHOW_NOTIF',
            enabled: true,
            name: student.value.name
        });
    }
  }
}

watch(isNotificationEnabled, (newVal) => {
  localStorage.setItem('notif_active', newVal)
  if (newVal) {
    requestNotificationPermission();
    if (student.value.status === 'Belum Absen') {
      startReminderSystem();
    }
  } else {
    stopReminderSystem();
  }
})

watch(() => student.value.status, (newStatus) => {
  if (newStatus === 'Belum Absen') {
    startReminderSystem();
  } else {
    stopReminderSystem();
  }
});

// Banner Slider Logic
const activeBannerIndex = ref(0)
const banners = [
  { img: smkzieImg, quote: "Senin: Pendidikan adalah tiket ke masa depan. Hari esok dimiliki oleh mereka yang mempersiapkannya hari ini." },
  { img: senamImg, quote: "Selasa: Tubuh yang sehat adalah kunci pikiran yang jernih. Jangan lupa olahraga dan tetap bugar!" },
  { img: bacaImg,  quote: "Rabu: Membaca adalah jendela dunia. Semakin banyak kamu membaca, semakin banyak hal yang kamu ketahui." },
  { img: KamisImg, quote: "Kamis: Cintailah alam seperti dirimu sendiri. Lingkungan yang bersih menciptakan kenyamanan dalam belajar." },
  { img: jumatImg, quote: "Jumat: Hari terbaik di mana matahari terbit. Mulailah dengan bismillah." }
]

const onBannerScroll = (event) => {
  const scrollPosition = event.target.scrollLeft
  const width = event.target.offsetWidth
  activeBannerIndex.value = Math.round(scrollPosition / width)
}

// Mood Logic
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
  const happyQuotes = ["Energi positifmu menular!", "Hari yang cerah!"]
  const sadQuotes = ["Jangan menyerah!", "Kamu berharga."]
  moodQuote.value = mood.type === 'sad' ? sadQuotes[Math.floor(Math.random() * sadQuotes.length)] : happyQuotes[Math.floor(Math.random() * happyQuotes.length)]
}

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

const genderDetect = computed(() => {
  if (student.value.gender) return student.value.gender;
  const name = student.value.name.toLowerCase()
  const femaleKeywords = ['putri', 'siti', 'ani', 'dewi', 'ayu', 'nur', 'indah', 'lestari']
  if (femaleKeywords.some(key => name.includes(key))) return 'Perempuan'
  return 'Laki-laki'
})

const jadwalHariIni = ref([])
const schoolConfig = ref({ lat: null, lng: null, radius: 50 })

const playSuccessFeedback = () => {
  const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2185/2185-preview.mp3')
  audio.play().catch(() => {})
  if ('vibrate' in navigator) navigator.vibrate([200, 100, 200])
}

const toast = ref({ show:false, msg:'', type:'success' })
const showToast = (msg,type='success')=>{
  toast.value = { show:true, msg, type }
  setTimeout(()=>toast.value.show=false,3000)
}

const requestNotificationPermission = () => {
  if ("Notification" in window) {
      Notification.requestPermission().then(permission => {
          if(permission === 'granted') updateBackgroundReminder();
      });
  }
}

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3  
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2)
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)))
}

const checkLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject("Browser tidak mendukung GPS")
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const dist = calculateDistance(pos.coords.latitude, pos.coords.longitude, schoolConfig.value.lat, schoolConfig.value.lng)
        if (dist <= schoolConfig.value.radius) resolve(true)
        else reject(`Di luar jangkauan (${Math.round(dist)}m).`)
      },
      () => reject("Gagal akses GPS."), { enableHighAccuracy: true, timeout: 6000 }
    )
  })
}

// ================= DATA FETCHING =================
const fetchJadwalFromAdmin = async () => {
  try {
    const res = await axios.get(`${backendUrl}/schedules`)
    if (res.data && student.value.class) {
      const studentClassNormal = student.value.class.replace(/\s+/g, '').toUpperCase().trim()
      const todayText = hariIniText.value.toLowerCase()

      const filtered = res.data.filter(j => {
        const dbDay = j.hari.toLowerCase()
        const dbClass = j.kelas.replace(/\s+/g, '').toUpperCase().trim()
        return dbDay === todayText && (studentClassNormal.includes(dbClass) || dbClass.includes(studentClassNormal))
      })
      
      jadwalHariIni.value = filtered.sort((a, b) => a.jam.localeCompare(b.jam))
    }
  } catch (e) { console.error('Error fetch jadwal:', e) }
}

const loadGpsConfig = async () => {
  try {  
    const res = await axios.get(`${backendUrl}/config/gps`)
    if(res.data) schoolConfig.value = res.data  
  } catch (e) { console.log(e) }
}

const loadAttendance = async ()=>{
  try{
    const res = await axios.get(`${backendUrl}/students`)
    const me = res.data.find(s => s.nis === student.value.nis)
    if(me) {
      student.value.name = me.name
      student.value.class = me.class
      student.value.gender = me.gender || ''
      student.value.status = me.status || 'Belum Absen'
      student.value.lastPulang = me.lastPulang || null 
      
      if(me.attendanceHistory) {
        const stats = { hadir: 0, sakit: 0, izin: 0, alfa: 0 }
        me.attendanceHistory.forEach(h => {
          const s = h.status.toLowerCase()
          if(s === 'hadir') stats.hadir++
          else if(s === 'sakit') stats.sakit++
          else if(s === 'izin') stats.izin++
          else if(s === 'alfa') stats.alfa++
        })
        attendanceStats.value = stats
      }

      if(['Hadir', 'Sakit', 'Izin'].includes(me.status)) {
        const lastTime = me.attendanceHistory?.[me.attendanceHistory.length-1]?.timestamp || me.updatedAt
        const diff = new Date().getTime() - new Date(lastTime).getTime()
        if (me.status === 'Hadir' && diff > (50 * 60 * 1000)) student.value.status = 'Belum Absen'
        student.value.lastAttendance = lastTime
      }
      
      if (student.value.status === 'Belum Absen') {
        startReminderSystem();
      } else {
        stopReminderSystem();
      }
    }
  } catch(err){ console.log(err) }
}

const startScan = async () => {
  if (!canAbsen.value) return showToast('Tunggu 1 jam atau Anda sudah pulang.', 'error')
  showToast('Cek Lokasi...', 'info')
  try {
    await checkLocation()
    qrVisible.value = true
    scanning = false
    await nextTick()
    if (html5QrCode) { try { await html5QrCode.stop() } catch (e) {} html5QrCode = null }
    html5QrCode = new Html5Qrcode("qr-reader")
    await html5QrCode.start({ facingMode: "environment" }, { fps: 20, qrbox: 250 }, async (text) => {
      if (scanning) return
      if (text.startsWith(guruTokenPrefix)) {  
        scanning = true
        qrVisible.value = false 
        await submitAttendance(text)  
      } else { showToast('QR Code tidak valid!', 'error') }
    })
  } catch (err) { showToast(err, 'error'); qrVisible.value = false }
}

const stopScan = async () => {
  if (html5QrCode?.isScanning) await html5QrCode.stop()
  qrVisible.value = false
}

const submitAttendance = async(token)=>{
  isProcessingAbsen.value = true 
  try{
    const now = new Date().toISOString()
    const currentMapel = jadwalHariIni.value.length > 0 ? jadwalHariIni.value[0].mapel : 'Pelajaran Umum'
    
    await new Promise(r => setTimeout(r, 1500));
    
    await axios.post(`${backendUrl}/students/attendance/${student.value.nis}`, {  
      status: 'Hadir', 
      qrToken: token, 
      mapel: currentMapel, 
      timestamp: now  
    })
    
    student.value.status = 'Hadir'
    student.value.lastAttendance = now
    stopReminderSystem();  
    playSuccessFeedback();  

    isProcessingAbsen.value = false 
    showToast('Absensi Berhasil!')
    setTimeout(() => { stopScan(); loadAttendance() }, 800)
  } catch(err){ 
    isProcessingAbsen.value = false
    showToast('Gagal mengirim data','error'); 
    scanning = false 
  }
}

// ================= LOGIKA LOG PULANG =================
const handleLogPulang = async () => {
  if (student.value.status === 'Pulang') {
    showToast('Anda sudah pulang hari ini.', 'info');
    return;
  }

  if (!confirm('Apakah Anda yakin ingin pulang?')) return;

  try {
    const now = new Date().toISOString();
    await axios.post(`${backendUrl}/students/attendance/pulang/${student.value.nis}`, {
      timestamp: now
    });

    student.value.status = 'Pulang';
    student.value.lastPulang = now;
    stopReminderSystem();
    
    showToast('Log Pulang Berhasil! Hati-hati di jalan.', 'success');
    loadAttendance(); 
  } catch (err) {
    console.error(err);
    showToast('Gagal log pulang', 'error');
  }
}

const canAbsen = computed(() => {
  if (student.value.status === 'Pulang') return false;
  if (!student.value.lastAttendance || student.value.status !== 'Hadir') return true;
  return (new Date().getTime() - new Date(student.value.lastAttendance).getTime()) > (1 * 60 * 60 * 1000)
});

const displayStatus = computed(() => {
  if(student.value.status === 'Hadir' && student.value.lastAttendance){
    return `Hadir - ${new Date(student.value.lastAttendance).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' })}`
  }
  if(student.value.status === 'Pulang' && student.value.lastPulang){
    return `Pulang - ${new Date(student.value.lastPulang).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' })}`
  }
  return student.value.status
});

const hariIniText = computed(()=> new Date().toLocaleDateString('id-ID', { weekday: 'long' }))

const confirmLogout = () => { showLogoutConfirm.value = true }
const executeLogout = () => {  
  student.value.status = 'LoggedOut';
  stopReminderSystem();
  localStorage.setItem('isLoggedIn', 'false')
  router.push('/login')  
}

onMounted(async () => {
  document.addEventListener('visibilitychange', handleVisibilityChange);
  requestNotificationPermission()
  loadCompressionLibrary();  
  const savedNis = localStorage.getItem('studentNis')
  if (!savedNis || savedNis === '') { router.replace('/login'); return }
  if (!localStorage.getItem('hasSeenGuide')) showGuide.value = true

  student.value.nis = savedNis
  student.value.name = localStorage.getItem('studentName') || 'Siswa'
  student.value.class = localStorage.getItem('studentClass') || '-'
  const savedImg = localStorage.getItem(`profile_img_${savedNis}`)
  if(savedImg) profileImage.value = savedImg

  await loadAttendance()
  await Promise.all([loadGpsConfig(), fetchJadwalFromAdmin()])
  
  const interval = setInterval(loadAttendance, 30000)  
 
  onUnmounted(() => {  
    clearInterval(interval);  
    stopReminderSystem();
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  })
})

onUnmounted(()=> {
  stopScan();
  stopReminderSystem();
  document.removeEventListener('visibilitychange', handleVisibilityChange);
})
</script>

<template>
<div class="app-container">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css" rel="stylesheet">

  <transition name="fade">
    <div v-if="isProcessingAbsen" class="guide-modal-overlay" style="z-index: 20000;">
      <div class="text-center text-white">
        <div class="spinner-border text-primary mb-3" role="status" style="width: 3rem; height: 3rem;"></div>
        <h5 class="fw-bold">Memproses Absensi...</h5>
        <p class="small opacity-75">Tunggu sebentar ya!</p>
      </div>
    </div>
  </transition>

  <transition name="slide-down">
    <div v-if="showVibrateBanner && student.status === 'Belum Absen' && isNotificationEnabled" class="vibrate-banner shadow" @click="startScan">
        <div class="d-flex align-items-center gap-3">
           <div class="vibrate-icon"><i class="bi bi-bell-fill"></i></div>
           <div class="flex-grow-1">
            <h6 class="mb-0 fw-bold">Peringatan Absensi!</h6>
            <small>Halo {{ student.name }}, kamu belum absen hari ini.</small>
           </div>
           <div class="vibrate-action">
              <span class="badge rounded-pill bg-white text-success fw-bold">ABSEN</span>
           </div>
        </div>
    </div>
  </transition>

  <transition name="fade">
    <div v-if="toast.show" class="custom-toast" :class="toast.type">
      <i :class="toast.type === 'success' ? 'bi bi-check-circle-fill' : (toast.type === 'info' ? 'bi bi-geo-alt-fill' : 'bi bi-exclamation-triangle-fill')"></i>
      {{ toast.msg }}
    </div>
  </transition>

  <transition name="fade">
    <div v-if="showLogoutConfirm" class="guide-modal-overlay" style="z-index: 12000;">
      <div class="guide-modal-content text-center p-4">
        <div class="logout-icon-box mb-3"><i class="bi bi-box-arrow-right text-danger"></i></div>
        <h5 class="fw-bold mb-2">Yakin Ingin Keluar?</h5>
        <div class="d-flex gap-2 mt-4">
          <button @click="showLogoutConfirm = false" class="btn btn-light w-100 py-2 rounded-pill fw-bold">Batal</button>
          <button @click="executeLogout" class="btn btn-danger w-100 py-2 rounded-pill fw-bold">Keluar</button>
        </div>
      </div>
    </div>
  </transition>

  <transition name="fade">
    <div v-if="showGuide" class="guide-modal-overlay">
      <div class="guide-modal-content">
        <div class="text-center mb-4">
          <div class="guide-icon-header"><i class="bi bi-rocket-takeoff-fill"></i></div>
          <h4 class="fw-bold mt-3">Halo, {{ student.name }}!</h4>
          <p class="text-muted small">Pelajari cara absen di aplikasi ini</p>
        </div>
        <div class="guide-steps">
          <div class="guide-step-item">
            <div class="step-icon"><i class="bi bi-geo-alt"></i></div>
            <div class="step-text"><h6>Aktifkan GPS</h6><p>Radius: <strong>{{ schoolConfig.radius }}m</strong>.</p></div>
          </div>
          <div class="guide-step-item">
            <div class="step-icon"><i class="bi bi-qr-code-scan"></i></div>
            <div class="step-text"><h6>Scan QR Guru</h6><p>Klik <strong>ABSENSI</strong> dan scan QR Guru.</p></div>
          </div>
        </div>
        <button @click="showGuide = false; localStorage.setItem('hasSeenGuide', 'true')" class="btn btn-primary-custom w-100 py-3 mt-3">Mulai!</button>
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
          <h6 class="mb-0 fw-bold text-dark text-truncate" style="max-width: 150px;">{{ student.name }}</h6>
          <small class="text-muted">Profil <i class="bi bi-chevron-right small"></i></small>
        </div>
      </div>
      <button @click="confirmLogout" class="btn btn-light btn-sm rounded-pill px-3 text-danger fw-bold"><i class="bi bi-box-arrow-right"></i></button>
    </div>
  </nav>

  <main class="container px-4 mt-4">
    <section class="status-card shadow-sm mb-4" :class="{
      'status-active': student.status === 'Hadir',
      'status-pulang': student.status === 'Pulang',
      'status-pending': student.status === 'Belum Absen'
    }">
      <div class="card-body p-4 text-white">
        <div class="d-flex justify-content-between opacity-75 small mb-2"><span>STATUS KEHADIRAN</span><i class="bi bi-shield-check"></i></div>
        <h2 class="display-6 fw-bold mb-3">{{ displayStatus }}</h2>
        <div class="d-flex align-items-center">
          <div class="pulse-dot me-2"></div>
          <span class="small opacity-90">{{ hariIniText }}, {{ new Date().toLocaleDateString('id-ID') }}</span>
        </div>
      </div>
    </section>

    <div class="row g-3 mb-3">
      <div class="col-6">
        <button class="action-card btn w-100 py-4 shadow-sm" @click="startScan" :disabled="!canAbsen" :class="!canAbsen ? 'disabled-card' : 'scan-active'">
          <i class="bi bi-qr-code-scan d-block mb-2 fs-2"></i><span class="fw-bold small">ABSENSI</span>
        </button>
      </div>
      <div class="col-6">
        <button class="action-card btn btn-white w-100 py-4 shadow-sm" @click="scheduleVisible = true">
          <i class="bi bi-info-circle d-block mb-2 fs-2 text-primary"></i><span class="fw-bold small">INFO & JADWAL</span>
        </button>
      </div>
    </div>

    <div class="row g-3 mb-4">
      <div class="col-6">
        <button class="action-card btn btn-white w-100 py-4 shadow-sm" @click="handleLogPulang" :disabled="student.status === 'Pulang'">
          <i class="bi bi-house-door d-block mb-2 fs-2 text-warning"></i>
          <span class="fw-bold small">LOG PULANG</span>
        </button>
      </div>
      <div class="col-6">
        <button class="action-card btn btn-white w-100 py-4 shadow-sm border-0 d-flex flex-column align-items-center justify-content-center" @click="handleSendEvidenceDirect">
          <i class="bi bi-whatsapp d-block mb-2 text-success"></i>
          <span class="fw-bold small">LAPORKAN KEHADIRAN</span>
          <small class="text-muted mt-1" style="font-size: 10px;">Opsional ke Guru</small>
        </button>
      </div>
    </div>

    <h6 class="fw-bold mb-2 text-dark px-1">Jenis Kegiatan</h6>
    <div class="banner-container mb-4 shadow-sm">
      <div class="banner-scroll-wrapper" @scroll="onBannerScroll">
        <div v-for="(banner, index) in banners" :key="index" class="banner-slide">
          <img :src="banner.img" class="banner-img"><div class="banner-overlay"></div>
        </div>
      </div>
      <div class="banner-dots"><span v-for="(_, i) in banners" :key="i" :class="{ active: activeBannerIndex === i }"></span></div>
      <div class="study-quote-bar p-3 bg-white">
        <div class="d-flex align-items-center">
            <div class="quote-lamp me-3"><i class="bi bi-lightbulb-fill text-warning"></i></div>
            <p class="mb-0 smaller fw-bold text-dark italic-quote">"{{ banners[activeBannerIndex].quote }}"</p>
        </div>
      </div>
    </div>

    <div class="mood-section bg-white p-4 rounded-4 shadow-sm border mb-4">
      <h6 class="fw-bold mb-3 text-dark text-center">Bagaimana mood kamu hari ini?</h6>
      <div class="d-flex justify-content-between mb-3 px-1">
        <button v-for="mood in moods" :key="mood.label" @click="setMood(mood)" class="btn mood-btn" :class="{ 'active': selectedMood === mood.label }">
          <span class="fs-2">{{ mood.emoji }}</span>
          <small class="d-block text-muted mt-1" style="font-size: 0.6rem;">{{ mood.label }}</small>
        </button>
      </div>
      <transition name="fade"><div v-if="moodQuote" class="quote-box p-3 rounded-3 text-center mt-2"><i class="bi bi-quote text-primary fs-4"></i><p class="mb-0 fst-italic small text-dark fw-semibold">{{ moodQuote }}</p></div></transition>
    </div>

    <div class="guide-section bg-white p-4 rounded-4 shadow-sm border mb-5">
      <h6 class="fw-bold mb-3 text-dark"><i class="bi bi-journal-text me-2 text-primary"></i>Informasi Sekolah</h6>
      <div class="small text-muted">
        <div class="d-flex mb-3"><div class="guide-num me-3">1</div><p class="m-0">Radius sekolah: <strong>{{ schoolConfig.radius }} meter</strong>.</p></div>
        <div class="d-flex"><div class="guide-num me-3">2</div><p class="m-0">Lokasi: <strong>SMK Negeri 1 Cianjur</strong></p></div>
      </div>
    </div>
  </main>

  <transition name="slide-side">
    <div v-if="profileVisible" class="profile-overlay">
      <div class="profile-header p-4">
        <button @click="profileVisible = false" class="btn btn-link text-white p-0 mb-4"><i class="bi bi-arrow-left fs-4"></i> Kembali</button>
        <div class="text-center">
          <div class="profile-img-container mx-auto mb-3">
            <img :src="profileImage || 'https://via.placeholder.com/150'" class="profile-img-main">
            <label class="btn-upload-img"><i class="bi bi-camera-fill"></i><input type="file" @change="handleImageUpload" accept="image/*" hidden></label>
          </div>
          <h4 class="fw-bold text-white mb-0">{{ student.name }}</h4>
          <p class="text-white-50 small mb-0">SMK NEGERI 1 CIANJUR</p>
        </div>
      </div>
      
      <div class="profile-body p-4">
        <label class="text-muted smaller fw-bold mb-2 d-block">REKAPITULASI & BUKTI</label>
        <div class="row g-2 mb-3">
          <div class="col-3"><div class="stat-card hadir"><span class="stat-val">{{ attendanceStats.hadir }}</span><span class="stat-lbl">Hadir</span></div></div>
          <div class="col-3"><div class="stat-card sakit"><span class="stat-val">{{ attendanceStats.sakit }}</span><span class="stat-lbl">Sakit</span></div></div>
          <div class="col-3"><div class="stat-card izin"><span class="stat-val">{{ attendanceStats.izin }}</span><span class="stat-lbl">Izin</span></div></div>
          <div class="col-3"><div class="stat-card alfa"><span class="stat-val">{{ attendanceStats.alfa }}</span><span class="stat-lbl">Alfa</span></div></div>
        </div>

        <div class="info-item shadow-sm border mb-4 bg-light">
          <div class="p-3 d-flex justify-content-between align-items-center">
            <div><span class="fw-bold d-block small">Jam Pulang Terakhir</span><small class="text-muted smaller">Hari ini</small></div>
            <span class="badge bg-warning text-dark fw-bold fs-6">
              {{ student.lastPulang ? new Date(student.lastPulang).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}) : '--:--' }}
            </span>
          </div>
        </div>

        <label class="text-muted smaller fw-bold mb-2 d-block">PENGATURAN</label>
        <div class="info-item shadow-sm border mb-4">
          <div class="p-3 d-flex justify-content-between align-items-center">
            <div><span class="fw-bold d-block small">Pengingat Absen</span><small class="text-muted smaller">Getar, Suara & Banner</small></div>
            <div class="form-check form-switch">
              <input class="form-check-input" type="checkbox" v-model="isNotificationEnabled">
            </div>
          </div>
        </div>

        <div class="info-group mb-5">
          <label class="text-muted smaller fw-bold mb-2 d-block">INFORMASI PRIBADI</label>
          <div class="info-item shadow-sm border">
            <div class="p-3 border-bottom d-flex justify-content-between"><span class="text-muted">NIS</span><span class="fw-bold">{{ student.nis }}</span></div>
            <div class="p-3 border-bottom d-flex justify-content-between"><span class="text-muted">Kelas</span><span class="fw-bold">{{ student.class }}</span></div>
            <div class="p-3 d-flex justify-content-between"><span class="text-muted">Gender</span><span class="fw-bold">{{ genderDetect }}</span></div>
          </div>
          <button @click="confirmLogout" class="btn btn-outline-danger w-100 py-3 rounded-4 fw-bold mt-4">Keluar</button>
        </div>
      </div>
    </div>
  </transition>

  <transition name="fade">
    <div v-if="qrVisible" class="scanner-fullscreen">
      <div class="scanner-nav p-3 d-flex justify-content-between align-items-center text-white">
        <button @click="stopScan" class="btn btn-outline-light btn-sm rounded-pill px-3">Batal</button>
        <span class="small fw-bold">SCAN QR GURU</span>
        <div style="width: 70px"></div>
      </div>
      <div class="scanner-body">
        <div id="qr-reader"></div>
        <div class="scan-overlay">
          <div class="scan-frame"><div class="corner t-l"></div><div class="corner t-r"></div><div class="corner b-l"></div><div class="corner b-r"></div><div class="scan-line"></div></div>
        </div>
      </div>
    </div>
  </transition>

  <transition name="sheet">
    <div v-if="scheduleVisible" class="sheet-overlay" @click.self="scheduleVisible=false">
      <div class="sheet-content">
        <div class="sheet-handle"></div>
        <div class="d-flex justify-content-between align-items-center mb-4"><h5 class="fw-bold m-0 text-dark">Jadwal Pelajaran</h5><span class="badge bg-primary-subtle text-primary">{{ student.class }}</span></div>
        <div class="schedule-items">
          <div v-for="(j,i) in jadwalHariIni" :key="i" class="schedule-card-item p-3 mb-3 shadow-sm border rounded-4">
            <div class="d-flex align-items-center">
              <div class="time-box me-3 p-2 bg-primary-subtle rounded-3 text-center" style="min-width: 65px;">
                <span class="fw-bold text-primary smaller">{{ j.jam }}</span>
              </div>
              <div class="flex-grow-1">
                <strong class="d-block text-dark small mb-1">{{ j.mapel }}</strong>
                <div class="text-muted smaller"><i class="bi bi-person me-1"></i> {{ j.guru }}</div>
              </div>
              <div class="status-dot-schedule"></div>
            </div>
          </div>
          <div v-if="jadwalHariIni.length === 0" class="text-center py-5"><i class="bi bi-calendar2-x fs-1 text-light mb-3 d-block"></i><p class="text-muted small">Tidak ada jadwal hari ini.</p></div>
        </div>
        <button @click="scheduleVisible=false" class="btn btn-primary-custom w-100 py-3 rounded-pill mt-3">Tutup</button>
      </div>
    </div>
  </transition>
</div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');

.app-container { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #f8fafc; min-height: 100vh; max-width: 500px; margin: 0 auto; position: relative; overflow-x: hidden; touch-action: pan-y; }
/* CSS UNTUK FIX WARNA STATUS PULANG */
.status-card {
  border-radius: 24px;
  overflow: hidden;
  transition: all 0.4s ease;
  border: none;
}

.status-active {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%); /* Hijau */
}

.status-pending {
  background: linear-gradient(135deg, #6b7280 0%, #374151 100%); /* Abu-abu */
}

/* WARNA KHUSUS UNTUK STATUS PULANG AGAR TERLIHAT JELAS */
.status-pulang {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); /* Orange Emas */
  box-shadow: 0 10px 20px rgba(245, 158, 11, 0.3);
}

.pulse-dot {
  width: 8px;
  height: 8px;
  background: #fff;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7); }
  70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(255, 255, 255, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 255, 255, 0); }
}

/* Style tambahan lainnya menyesuaikan layout anda */
.app-container { background-color: #f8f9fa; min-height: 100vh; padding-bottom: 50px; }
.btn-primary-custom { background: #007bff; color: white; border: none; border-radius: 15px; font-weight: bold; }
.action-card { background: white; border: 1px solid #eee; border-radius: 20px; transition: transform 0.2s; }
.action-card:active { transform: scale(0.95); }
.disabled-card { opacity: 0.6; grayscale: 1; cursor: not-allowed; }
/* STATISTIK */
.stat-card { padding: 12px 5px; border-radius: 16px; text-align: center; display: flex; flex-direction: column; transition: 0.3s; border: 1px solid rgba(0,0,0,0.05); }
.stat-val { font-size: 1.2rem; font-weight: 800; display: block; }
.stat-lbl { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; opacity: 0.8; }
.hadir { background: #ecfdf5; color: #10b981; }
.sakit { background: #eff6ff; color: #3b82f6; }
.izin { background: #fffbeb; color: #f59e0b; }
.alfa { background: #fef2f2; color: #ef4444; }


/* COMMON UI */
.logout-icon-box { width: 60px; height: 60px; background: #fff5f5; border-radius: 20px; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; margin: 0 auto; }
.banner-container { border-radius: 24px; overflow: hidden; position: relative; border: 1px solid #e2e8f0; background: white; }
.banner-scroll-wrapper { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; scroll-behavior: smooth; -webkit-overflow-scrolling: touch; }
.banner-scroll-wrapper::-webkit-scrollbar { display: none; }
.banner-slide { min-width: 100%; height: 160px; scroll-snap-align: start; position: relative; }
.banner-img { width: 100%; height: 100%; object-fit: cover; }
.banner-dots { position: absolute; top: 140px; left: 50%; transform: translateX(-50%); display: flex; gap: 6px; z-index: 10; }
.banner-dots span { width: 6px; height: 6px; background: rgba(255,255,255,0.5); border-radius: 50%; transition: 0.3s; }
.banner-dots span.active { width: 18px; background: white; border-radius: 10px; }

/* PROFILE STYLES */
.profile-overlay { position: fixed; inset: 0; background: #f8fafc; z-index: 5000; overflow-y: auto; }
.profile-header { background: linear-gradient(135deg, #6366f1, #4f46e5); border-radius: 0 0 40px 40px; }
.profile-img-container { width: 120px; height: 120px; position: relative; border: 4px solid rgba(255,255,255,0.3); border-radius: 40px; }
.profile-img-main { width: 100%; height: 100%; object-fit: cover; border-radius: 36px; background: white; }
.btn-upload-img { position: absolute; bottom: -5px; right: -5px; background: #10b981; color: white; width: 35px; height: 35px; border-radius: 12px; display: flex; align-items: center; justify-content: center; border: 3px solid #6366f1; cursor: pointer; }
.info-item { background: white; border-radius: 20px; overflow: hidden; }

/* HOME COMPONENTS */
.study-quote-bar { border-top: 1px solid #f1f5f9; min-height: 80px; display: flex; align-items: center; }
.quote-lamp { width: 35px; height: 35px; background: #fffbeb; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.italic-quote { font-style: italic; color: #475569; line-height: 1.3; font-size: 0.75rem; }
.user-avatar-glow { width: 42px; height: 42px; background: linear-gradient(135deg, #6366f1, #4f46e5); color: white; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 800; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3); }

/* MODALS */
.guide-modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.8); backdrop-filter: blur(8px); z-index: 11000; display: flex; align-items: center; justify-content: center; padding: 20px; }
.guide-modal-content { background: white; width: 100%; max-width: 400px; border-radius: 32px; padding: 30px; }
.guide-icon-header { width: 70px; height: 70px; background: #eef2ff; color: #6366f1; border-radius: 24px; display: flex; align-items: center; justify-content: center; font-size: 2rem; margin: 0 auto; }
.guide-step-item { display: flex; gap: 15px; margin-bottom: 20px; }
.step-icon { width: 40px; height: 40px; background: #f1f5f9; color: #475569; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 1.2rem; }
.step-text h6 { margin: 0; font-weight: 700; font-size: 0.95rem; }
.step-text p { margin: 0; font-size: 0.8rem; color: #64748b; line-height: 1.4; }
.btn-primary-custom { background: #6366f1; color: white; border: none; border-radius: 16px; font-weight: 700; transition: 0.3s; }

/* MOOD & STATUS */
.mood-btn { border: 2px solid transparent; transition: 0.3s; padding: 8px; border-radius: 15px; }
.mood-btn.active { background: #eef2ff; border-color: #6366f1; transform: scale(1.1); }
.status-card { border-radius: 28px; border: none; overflow: hidden; transition: 0.4s; }
.status-pending { background: linear-gradient(135deg, #1e293b, #334155); }
.status-active { background: linear-gradient(135deg, #10b981, #059669); box-shadow: 0 12px 24px rgba(16, 185, 129, 0.25) !important; }
.pulse-dot { width: 8px; height: 8px; background: #fff; border-radius: 50%; animation: pulse 2s infinite; }
@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(255,255,255,0.7); } 70% { box-shadow: 0 0 0 10px rgba(255,255,255,0); } 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0); } }

/* SCANNER */
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

/* SHEET */
.sheet-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); z-index: 2000; display: flex; align-items: flex-end; }
.sheet-content { background: white; width: 100%; border-radius: 30px 30px 0 0; padding: 25px; max-height: 80vh; overflow-y: auto; }
.sheet-handle { width: 40px; height: 5px; background: #e2e8f0; border-radius: 10px; margin: 0 auto 15px; }

/* TOAST */
.custom-toast { position: fixed; top: 25px; left: 50%; transform: translateX(-50%); z-index: 10000; padding: 12px 24px; border-radius: 15px; color: white; display: flex; align-items: center; gap: 10px; font-weight: 700; box-shadow: 0 10px 20px rgba(0,0,0,0.2); background: #1e293b; min-width: 250px; justify-content: center; }
.custom-toast.error { background: #ef4444; }

/* ANIMATIONS */
.slide-side-enter-active, .slide-side-leave-active { transition: transform 0.4s ease; }
.slide-side-enter-from, .slide-side-leave-to { transform: translateX(100%); }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>