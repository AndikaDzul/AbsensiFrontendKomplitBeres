<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import QRCode from 'qrcode'
import axios from 'axios'

const router = useRouter()
const backendUrl = 'https://backend-complited.vercel.app'

// ================= STATE =================
const user = ref({ name:'', role:'guru', mapel:'' })
const students = ref([])
const searchQuery = ref('')
const showHistoryFor = ref(null)
const activeTab = ref('hadir')

// --- Filter Jurusan ---
const selectedClass = ref('XII RPL 2') 
const classOptions = ['XII RPL 1', 'XII RPL 2', 'XII AKL 1', 'XII TJKT 1', 'XII MPLB 3']

// ===== AI CAMERA COUNT STATE =====
const showCameraModal = ref(false)
const videoRef = ref(null)
const canvasRef = ref(null)
const isDetecting = ref(false)
const aiStudentCount = ref(parseInt(localStorage.getItem('ai_count_' + selectedClass.value)) || 0)
let detectionInterval = null
let stream = null

// ===== QR GURU =====
const guruTokenPrefix = 'ABSENSI-GURU-'
const guruQr = ref('')
let qrInterval = null
const showQrModal = ref(false)

// ================= DARK MODE =================
const darkMode = ref(localStorage.getItem('darkMode') === 'true')
const toggleDarkMode = () => {
  darkMode.value = !darkMode.value
  localStorage.setItem('darkMode', darkMode.value)
}

// ================= TOAST =================
const toastVisible = ref(false)
const toastMessage = ref('')
const toastType = ref('success')
const showToast = (msg, type='success') => {
  toastMessage.value = msg
  toastType.value = type
  toastVisible.value = true
  setTimeout(() => toastVisible.value = false, 3000)
}

// ================= COMPUTED =================
const avatarInitial = computed(() =>
  user.value.name ? user.value.name[0].toUpperCase() : 'G'
)

const filteredStudents = computed(() => {
  let list = students.value
  if (selectedClass.value) {
    list = list.filter(s => (s.class || 'XII RPL 1') === selectedClass.value)
  }
  if (activeTab.value === 'hadir') {
    list = list.filter(s => ['hadir', 'izin', 'sakit', 'alfa'].includes(s.status?.toLowerCase()))
  } else if (activeTab.value === 'belum') {
    list = list.filter(s => !s.status)
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.nis.includes(q)
    )
  }
  return list
})

const hadirCount = computed(() =>
  filteredStudents.value.filter(s => ['hadir', 'izin', 'sakit', 'alfa'].includes(s.status?.toLowerCase())).length
)

// ================= AI CAMERA LOGIC =================
const startCamera = async () => {
  showCameraModal.value = true
  try {
    stream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } } 
    })
    if (videoRef.value) {
      videoRef.value.srcObject = stream
      // Tunggu metadata video termuat sebelum mulai deteksi
      videoRef.value.onloadedmetadata = () => {
        initAiDetection()
      }
    }
  } catch (err) {
    showToast('Gagal akses kamera', 'error')
    showCameraModal.value = false
  }
}

const stopCamera = () => {
  if (stream) {
    stream.getTracks().forEach(track => track.stop())
  }
  if (detectionInterval) clearInterval(detectionInterval)
  showCameraModal.value = false
  isDetecting.value = false
}

const initAiDetection = async () => {
  isDetecting.value = true
  if (!window.cocoSsd) {
    showToast('Memuat AI Model...', 'success')
  }
  
  const model = await window.cocoSsd.load()
  
  detectionInterval = setInterval(async () => {
    if (videoRef.value && videoRef.value.readyState === 4 && isDetecting.value) {
      // Pastikan dimensi canvas sama dengan dimensi video
      if (canvasRef.value) {
        canvasRef.value.width = videoRef.value.videoWidth
        canvasRef.value.height = videoRef.value.videoHeight
      }

      const predictions = await model.detect(videoRef.value)
      // Filter hanya kelas 'person' dengan akurasi di atas 50%
      const persons = predictions.filter(p => p.class === 'person' && p.score > 0.5)
      
      aiStudentCount.value = persons.length
      localStorage.setItem('ai_count_' + selectedClass.value, persons.length)
      
      const ctx = canvasRef.value.getContext('2d')
      ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height)
      
      persons.forEach(p => {
        ctx.strokeStyle = '#6366f1'
        ctx.lineWidth = 4
        ctx.strokeRect(p.bbox[0], p.bbox[1], p.bbox[2], p.bbox[3])
        
        // Tambahkan label teks kecil (opsional agar terlihat AI bekerja)
        ctx.fillStyle = '#6366f1'
        ctx.font = 'bold 12px sans-serif'
        ctx.fillText(`Siswa`, p.bbox[0], p.bbox[1] > 10 ? p.bbox[1] - 5 : 10)
      })
    }
  }, 800) // Dipercepat ke 800ms untuk responsivitas
}

// ================= LOGIC =================
const loadStudents = async () => {
  try {
    const res = await axios.get(`${backendUrl}/students`)
    const today = new Date().toDateString() 
    students.value = res.data.map(s => {
      const todayHistory = (s.attendanceHistory || []).filter(h => {
        if (!h.timestamp) return false
        return new Date(h.timestamp).toDateString() === today
      })
      const isPresentToday = todayHistory.length > 0
      const currentStatus = isPresentToday ? todayHistory[todayHistory.length - 1].status : null
      return {
        ...s,
        status: currentStatus, 
        attendanceHistory: todayHistory.map(h => {
          const d = new Date(h.timestamp)
          return {
            ...h,
            day: d.toLocaleDateString('id-ID', { weekday: 'long' }),
            time: d.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' })
          }
        })
      }
    })
  } catch (err) {
    console.error('Load siswa gagal:', err)
  }
}

const updateStatusManual = async (nis, newStatus) => {
  try {
    await axios.post(`${backendUrl}/students/absensi-manual`, {
      nis: nis,
      status: newStatus,
      teacherName: user.name
    })
    showToast(`Berhasil update status ke ${newStatus}`)
    await loadStudents() 
  } catch (e) {
    showToast('Gagal update status', 'error')
  }
}

const resetAllAttendance = async () => {
  if (!confirm('Bersihkan semua data kehadiran hari ini?')) return
  try {
    await axios.post(`${backendUrl}/students/reset`)
    localStorage.removeItem('ai_count_' + selectedClass.value)
    aiStudentCount.value = 0
    showToast('Database kehadiran telah direset')
    await loadStudents()
  } catch (e) {
    showToast('Gagal mereset data', 'error')
  }
}

const logout = () => {
  localStorage.clear()
  router.replace('/login')
}

const generateQr = async () => {
  const qrData = `${guruTokenPrefix}-${Date.now()}`
  guruQr.value = await QRCode.toDataURL(qrData)
}

const toggleHistory = (nis) => {
  showHistoryFor.value = showHistoryFor.value === nis ? null : nis
}

onMounted(async () => {
  if (!document.getElementById('bootstrap-js')) {
    const script = document.createElement('script')
    script.id = 'bootstrap-js'
    script.src = "https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"
    document.head.appendChild(script)
  }
  
  // Memuat Script TensorFlow secara berurutan
  if (!document.getElementById('tfjs')) {
    const tf = document.createElement('script')
    tf.id = 'tfjs'
    tf.src = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs"
    document.head.appendChild(tf)
    
    tf.onload = () => {
      const coco = document.createElement('script')
      coco.id = 'coco-ssd'
      coco.src = "https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd"
      document.head.appendChild(coco)
    }
  }

  user.value.name = localStorage.getItem('teacherName') || 'Guru'
  await loadStudents()
  await generateQr()
  qrInterval = setInterval(generateQr, 20000)
})

onUnmounted(() => {
  if (qrInterval) clearInterval(qrInterval)
  stopCamera()
})
</script>

<template>
<div :class="['app-container', darkMode ? 'dark-theme' : 'light-theme']">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css" rel="stylesheet">

  <Transition name="toast">
    <div v-if="toastVisible" class="custom-toast" :class="toastType">
      <i :class="toastType === 'success' ? 'bi bi-check-circle-fill' : 'bi bi-exclamation-triangle-fill'"></i>
      {{ toastMessage }}
    </div>
  </Transition>

  <nav class="teacher-nav px-3">
    <div class="nav-content-web">
      <div class="d-flex align-items-center gap-3">
        <div class="teacher-avatar shadow-sm">{{ avatarInitial }}</div>
        <div class="teacher-meta">
          <small class="text-muted d-block" style="font-size: 0.7rem;">Panel Pengajar</small>
          <span class="fw-bold">{{ user.name }}</span>
        </div>
      </div>
      <div class="d-flex gap-2">
        <button @click="toggleDarkMode" class="icon-btn">
          <i :class="darkMode ? 'bi bi-sun-fill' : 'bi bi-moon-stars-fill'"></i>
        </button>
        <button @click="logout" class="icon-btn text-danger">
          <i class="bi bi-power"></i>
        </button>
      </div>
    </div>
  </nav>

  <main class="container py-4" style="max-width: 600px;">
    <div class="mb-3 px-1">
      <label class="smaller fw-bold text-muted mb-2 d-block">PILIH JURUSAN / KELAS</label>
      <select v-model="selectedClass" class="form-select border-0 shadow-sm rounded-3 fw-bold py-2">
        <option v-for="opt in classOptions" :key="opt" :value="opt">{{ opt }}</option>
      </select>
    </div>

    <section class="dashboard-hero mb-4 shadow-sm">
      <div class="row align-items-center g-0">
        <div class="col-7 p-4">
          <h4 class="fw-bold mb-1 text-white">{{ selectedClass }}</h4>
          <p class="text-white-50 small mb-0">Status Kehadiran Hari Ini</p>
          <div v-if="aiStudentCount > 0" class="mt-2">
            <span class="badge bg-primary-subtle text-primary smaller">
              <i class="bi bi-cpu-fill me-1"></i> AI Scan: {{ aiStudentCount }} Siswa
            </span>
          </div>
        </div>
        <div class="col-5 p-3">
          <div class="stat-card-inner">
            <span class="d-block small text-white-50">TERDATA</span>
            <h2 class="fw-black m-0 text-white">{{ hadirCount }}<small class="fs-6 opacity-50">/{{ filteredStudents.length }}</small></h2>
          </div>
        </div>
      </div>
    </section>

    <button @click="startCamera" class="ai-trigger-card mb-3 border-0 shadow-sm w-100 p-3">
      <div class="d-flex align-items-center gap-3">
        <div class="ai-icon-box">
          <i class="bi bi-camera-video-fill text-indigo fs-3"></i>
        </div>
        <div class="text-start flex-grow-1">
          <h6 class="fw-bold mb-0">Hitung Siswa (AI Camera)</h6>
          <small class="text-muted">Deteksi otomatis jumlah orang di kelas</small>
        </div>
        <i class="bi bi-record-circle text-danger blink"></i>
      </div>
    </button>

    <button @click="showQrModal=true" class="qr-trigger-card mb-4 border-0 shadow-sm w-100 p-3">
      <div class="d-flex align-items-center gap-3">
        <div class="qr-icon-box">
          <i class="bi bi-qr-code text-primary fs-3"></i>
        </div>
        <div class="text-start flex-grow-1">
          <h6 class="fw-bold mb-0">Tampilkan QR Absensi</h6>
          <small class="text-muted">Untuk Kelas {{ selectedClass }}</small>
        </div>
        <i class="bi bi-chevron-right text-muted"></i>
      </div>
    </button>

    <section class="list-section bg-white rounded-4 shadow-sm overflow-hidden mb-4">
      <div class="p-3 border-bottom">
        <div class="tab-pill-container mb-3">
          <button @click="activeTab = 'hadir'" :class="{ active: activeTab === 'hadir' }">Terdata</button>
          <button @click="activeTab = 'belum'" :class="{ active: activeTab === 'belum' }">Belum</button>
          <button @click="activeTab = 'semua'" :class="{ active: activeTab === 'semua' }">Semua</button>
        </div>
        <div class="search-input-group">
          <i class="bi bi-search"></i>
          <input v-model="searchQuery" placeholder="Cari nama atau NIS..." />
        </div>
      </div>

      <div class="list-body">
        <TransitionGroup name="stagger">
          <div v-for="s in filteredStudents" :key="s.nis" class="student-item-row p-3">
            <div class="d-flex align-items-center justify-content-between">
              <div class="d-flex align-items-center gap-3">
                <div class="student-initial">{{ s.name[0] }}</div>
                <div>
                  <h6 class="mb-0 fw-bold small">{{ s.name }}</h6>
                  <small class="text-muted smaller">{{ s.nis }} • {{ s.class }}</small>
                </div>
              </div>
              
              <div class="d-flex flex-column align-items-end gap-1">
                <span :class="['status-tag', 
                  s.status?.toLowerCase() === 'hadir' ? 'tag-hadir' : 
                  s.status?.toLowerCase() === 'izin' ? 'tag-izin' :
                  s.status?.toLowerCase() === 'sakit' ? 'tag-sakit' :
                  s.status?.toLowerCase() === 'alfa' ? 'tag-alfa' : 'tag-pending']">
                  <i :class="s.status ? 'bi bi-check-circle-fill' : 'bi bi-clock'"></i>
                  {{ s.status || 'Belum Absen' }}
                </span>

                <div class="dropdown">
                  <button class="btn btn-sm btn-light py-0 px-2 smaller fw-bold border" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                    Set Manual <i class="bi bi-chevron-down"></i>
                  </button>
                  <ul class="dropdown-menu dropdown-menu-end shadow border-0 smaller">
                    <li><button @click="updateStatusManual(s.nis, 'Hadir')" class="dropdown-item py-2 text-success fw-bold"><i class="bi bi-check-circle me-2"></i>Hadir</button></li>
                    <li><button @click="updateStatusManual(s.nis, 'Izin')" class="dropdown-item py-2 text-warning fw-bold"><i class="bi bi-envelope me-2"></i>Izin</button></li>
                    <li><button @click="updateStatusManual(s.nis, 'Sakit')" class="dropdown-item py-2 text-primary fw-bold"><i class="bi bi-capsule me-2"></i>Sakit</button></li>
                    <li><button @click="updateStatusManual(s.nis, 'Alfa')" class="dropdown-item py-2 text-danger fw-bold"><i class="bi bi-x-circle me-2"></i>Alfa</button></li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div v-if="s.status" class="mt-2 pt-2 border-top-dashed d-flex flex-column gap-1">
                <button @click="toggleHistory(s.nis)" class="btn-detail">
                  {{ showHistoryFor === s.nis ? 'Sembunyikan' : 'Lihat Detail Waktu' }}
                </button>
                <div v-if="showHistoryFor === s.nis">
                  <div v-for="(h, idx) in s.attendanceHistory" :key="idx" class="text-primary smaller">
                    <i class="bi bi-stopwatch me-1"></i>
                    {{ h.day }} • {{ h.time }}
                    <span class="text-muted small">({{ h.status || 'Hadir' }})</span>
                  </div>
                </div>
            </div>
          </div>
        </TransitionGroup>

        <div v-if="filteredStudents.length === 0" class="text-center py-5">
          <i class="bi bi-folder2-open display-4 text-muted mb-2"></i>
          <p class="text-muted small">Tidak ada data di kelas {{ selectedClass }}</p>
        </div>
      </div>
    </section>

    <button @click="resetAllAttendance" class="btn-reset-data">
      <i class="bi bi-trash3 me-2"></i> Reset Kehadiran Hari Ini
    </button>
  </main>

  <Transition name="sheet">
    <div v-if="showQrModal" class="sheet-overlay" @click.self="showQrModal=false">
      <div class="sheet-content">
        <div class="drag-handle mb-4"></div>
        <div class="text-center mb-4">
          <h5 class="fw-bold mb-1">QR Code Presensi</h5>
          <p class="text-muted small">Mata Pelajaran: {{ user.mapel || 'Sesi Guru' }}</p>
        </div>
        <div class="qr-display-area shadow-sm">
          <img :src="guruQr" class="img-fluid rounded-3" alt="QR Code" />
          <div class="qr-progress-bar"><div class="bar-fill"></div></div>
        </div>
        <button @click="showQrModal=false" class="btn btn-dark w-100 rounded-pill py-3 mt-4 fw-bold">Tutup</button>
      </div>
    </div>
  </Transition>

  <Transition name="sheet">
    <div v-if="showCameraModal" class="sheet-overlay">
      <div class="sheet-content h-75 position-relative">
        <button @click="stopCamera" class="btn-close-modal">
          <i class="bi bi-x-lg"></i>
        </button>

        <div class="drag-handle mb-4"></div>
        <div class="text-center mb-3">
          <h5 class="fw-bold mb-0">AI Student Scanner</h5>
          <p class="text-muted small">Mendeteksi jumlah siswa secara otomatis</p>
        </div>

        <div class="camera-container shadow-sm mb-3">
          <video ref="videoRef" autoplay muted playsinline class="video-preview"></video>
          <canvas ref="canvasRef" class="canvas-overlay"></canvas>
          <div class="ai-badge">
            <div class="pulse-red"></div> LIVE AI
          </div>
        </div>

        <div class="text-center p-3 bg-light rounded-4">
          <h1 class="fw-black text-indigo mb-0">{{ aiStudentCount }}</h1>
          <small class="fw-bold text-muted">Siswa Terdeteksi</small>
        </div>

        <div class="d-flex gap-2 mt-4">
          <button @click="stopCamera" class="btn btn-light flex-grow-1 rounded-pill py-3 fw-bold border">
            Batal
          </button>
          <button @click="stopCamera" class="btn btn-dark flex-grow-1 rounded-pill py-3 fw-bold">
            Simpan Hasil
          </button>
        </div>
      </div>
    </div>
  </Transition>
</div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');

.app-container { font-family: 'Plus Jakarta Sans', sans-serif; min-height: 100vh; transition: background 0.3s; }
.light-theme { background-color: #f8fafc; color: #1e293b; }
.dark-theme { background-color: #0f172a; color: #f1f5f9; }

.teacher-nav { height: 70px; background: rgba(255,255,255,0.8); backdrop-filter: blur(10px); position: sticky; top: 0; z-index: 100; border-bottom: 1px solid rgba(0,0,0,0.05); }
.dark-theme .teacher-nav { background: rgba(30, 41, 59, 0.8); border-color: rgba(255,255,255,0.05); }

.nav-content-web { max-width: 600px; margin: 0 auto; height: 100%; display: flex; align-items: center; justify-content: space-between; }
.teacher-avatar { width: 40px; height: 40px; border-radius: 12px; background: linear-gradient(135deg, #6366f1, #4338ca); color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; }

.icon-btn { width: 38px; height: 38px; border-radius: 50%; border: none; background: #f1f5f9; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
.dark-theme .icon-btn { background: #1e293b; color: white; }

.dashboard-hero { background: linear-gradient(135deg, #1e293b 0%, #334155 100%); border-radius: 24px; overflow: hidden; position: relative; }
.stat-card-inner { background: rgba(255,255,255,0.1); backdrop-filter: blur(5px); border-radius: 18px; padding: 15px; text-align: center; }

.ai-trigger-card { background: white; border-radius: 20px; transition: 0.2s; }
.dark-theme .ai-trigger-card { background: #1e293b; }
.ai-icon-box { width: 54px; height: 54px; border-radius: 15px; background: #e0e7ff; display: flex; align-items: center; justify-content: center; }
.text-indigo { color: #6366f1; }
.bg-primary-subtle { background: rgba(99, 102, 241, 0.2) !important; }

.camera-container { position: relative; width: 100%; height: 300px; background: #000; border-radius: 24px; overflow: hidden; }
.video-preview { width: 100%; height: 100%; object-fit: cover; }
.canvas-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
.ai-badge { position: absolute; top: 15px; right: 15px; background: rgba(0,0,0,0.6); color: white; padding: 5px 12px; border-radius: 10px; font-size: 0.7rem; font-weight: 800; display: flex; align-items: center; gap: 8px; }

.btn-close-modal { position: absolute; top: 20px; right: 20px; border: none; background: #f1f5f9; width: 35px; height: 35px; border-radius: 50%; display: flex; align-items: center; justify-content: center; z-index: 10; font-size: 1rem; color: #64748b; }
.dark-theme .btn-close-modal { background: #0f172a; color: white; }

.qr-trigger-card { background: white; border-radius: 20px; transition: 0.2s; }
.dark-theme .qr-trigger-card { background: #1e293b; }
.qr-icon-box { width: 54px; height: 54px; border-radius: 15px; background: #f1f5f9; display: flex; align-items: center; justify-content: center; }

.tab-pill-container { display: flex; gap: 5px; background: #f1f5f9; padding: 5px; border-radius: 12px; }
.dark-theme .tab-pill-container { background: #0f172a; }
.tab-pill-container button { flex: 1; border: none; padding: 8px; border-radius: 8px; font-size: 0.8rem; font-weight: 700; background: transparent; color: #64748b; }
.tab-pill-container button.active { background: white; color: #6366f1; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
.dark-theme .tab-pill-container button.active { background: #1e293b; color: white; }

.search-input-group { position: relative; display: flex; align-items: center; }
.search-input-group i { position: absolute; left: 12px; color: #94a3b8; }
.search-input-group input { width: 100%; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 10px 10px 40px; font-size: 0.85rem; outline: none; }
.dark-theme .search-input-group input { background: #0f172a; border-color: #334155; color: white; }

.student-item-row { border-bottom: 1px solid #f1f5f9; }
.dark-theme .student-item-row { border-color: rgba(255,255,255,0.05); }
.student-initial { width: 36px; height: 36px; border-radius: 50%; background: #f8fafc; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.8rem; }
.dark-theme .student-initial { background: #0f172a; }

.status-tag { font-size: 0.65rem; font-weight: 800; padding: 4px 10px; border-radius: 8px; display: flex; align-items: center; gap: 5px; }
.tag-hadir { background: #dcfce7; color: #15803d; }
.tag-izin { background: #fef9c3; color: #854d0e; }
.tag-sakit { background: #e0f2fe; color: #0369a1; }
.tag-alfa { background: #fee2e2; color: #b91c1c; }
.tag-pending { background: #f1f5f9; color: #94a3b8; }

.sheet-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); z-index: 2000; display: flex; align-items: flex-end; }
.sheet-content { background: white; width: 100%; border-radius: 30px 30px 0 0; padding: 25px; animation: slideUp 0.4s ease-out; }
.dark-theme .sheet-content { background: #1e293b; }
.drag-handle { width: 40px; height: 5px; background: #e2e8f0; border-radius: 5px; margin: 0 auto; }

.qr-display-area { background: white; padding: 25px; border-radius: 24px; text-align: center; }
.qr-progress-bar { height: 4px; background: #f1f5f9; border-radius: 2px; margin-top: 20px; overflow: hidden; }
.bar-fill { height: 100%; background: #6366f1; width: 100%; animation: qrTimer 20s linear infinite; }

.btn-reset-data { width: 100%; border: 1.5px dashed #ef4444; color: #ef4444; background: transparent; border-radius: 15px; padding: 12px; font-weight: 700; font-size: 0.8rem; }

.blink { animation: blinker 1.5s linear infinite; }
.pulse-red { width: 8px; height: 8px; background: #ef4444; border-radius: 50%; box-shadow: 0 0 0 rgba(239, 68, 68, 0.4); animation: pulse 2s infinite; }

.custom-toast { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); z-index: 9999; padding: 12px 24px; border-radius: 12px; color: white; font-weight: 700; display: flex; align-items: center; gap: 10px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
.custom-toast.success { background: #10b981; }
.custom-toast.error { background: #ef4444; }

@keyframes blinker { 50% { opacity: 0; } }
@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }
@keyframes qrTimer { from { width: 100%; } to { width: 0%; } }
@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
.smaller { font-size: 0.7rem; }
.fw-black { font-weight: 900; }
.border-top-dashed { border-top: 1px dashed #e2e8f0; }
.btn-detail { background: none; border: none; color: #6366f1; font-weight: 700; font-size: 0.75rem; padding: 0; text-align: left; }
</style>