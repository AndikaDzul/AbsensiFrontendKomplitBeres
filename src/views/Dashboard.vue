<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import QRCode from 'qrcode'
import axios from 'axios'
import Chart from 'chart.js/auto'

const router = useRouter()
const backendUrl = 'https://backendd-andika-beres.vercel.app/api'
const apiUrl = 'https://project-backend-beres-5z94.vercel.app/api'

// ================= STATE =================
const user = ref({ name: '', role: 'guru', mapel: '' })
const students = ref([])
const searchQuery = ref('')
const activeTab = ref('hadir')
const isRefreshing = ref(false)
const teacherProfile = ref({ name: '', email: '', mapel: '' })

const selectedClass = ref('XII RPL 2')
const classOptions = [
  'XII PPLG-RPL 1', 'XII PPLG-RPL 2', 'X PPLG 1', 'X PPLG 2', 'X PPLG 3', 'X AKKUL 1', 'X AKKUL 2', 'X AKKUL 3',
  'X TJKT 1', 'X TJKT 2', 'X TJKT 3', 'X MPLB 1', 'X MPLB 2', 'X MPLB 3',
  'X PS 1', 'X PS 2', 'X PS 3', 'X PS 5', 'XI PPLG-RPL 1', 'XI PPLG-RPL 2', 'XI PPLG-RPL 3',
  'XI AKKUL-AK 1', 'XI AKKUL-AK 2', 'XI AKKUL-AK 3', 'XI TJKT-TK 1', 'XI TJKT-TK 2', 'XI TJKT-TK 3',
  'XI MPLB-MP 1', 'XI MPLB-MP 2', 'XI MPLB-MP 3', 'XI MPLB-ML 1', 'XI MPLB-ML 2', 'XI MPLB-ML 3', 'XI PS-BR 1', 'XI PS-BR 2', 'XI BD-PS 1', 'XI BD-PS 2', 'XI BD-PS 3',
  'XII PPLG-RPL 1', 'XII PPLG-RPL 2', 'XII RPL 1', 'XII RPL 2', 'XII AKKUL-AK 1', 'XII AKKUL-AK 2', 'XII AKKUL-AK 3',
  'XII TJKT 1', 'XII TJKT 2', 'XII TJKT 3', 'XII MPLB 1', 'XII MPLB 2', 'XII MPLB 3',
  'XII BD-PS 1', 'XII BD-PS 2', 'XII BD-PS 3', 'XII PS-BR 1', 'XII PS-BR 2', 'XII PS-BR 3'
]

// ===== STATE PENILAIAN =====
const showRatingModal = ref(false)
const selectedStudentForRating = ref(null)
const isEditing = ref(false)
const currentEvaluationId = ref(null)
let ratingChart = null

const evaluationForm = ref({
  discipline: 5, teamwork: 5, responsibility: 5, initiative: 5,
  ethics: 5, professionalism: 5, persistence: 5, notes: ''
})

const ratingCriteria = ref([
  { key: 'discipline', label: 'Kedisiplinan', icon: 'bi-clock-history', statement: 'Siswa menunjukkan kepatuhan terhadap waktu dan instruksi kerja.' },
  { key: 'teamwork', label: 'Kerja Sama', icon: 'bi-people-fill', statement: 'Siswa berkontribusi aktif dan menjaga koordinasi di dalam tim.' },
  { key: 'responsibility', label: 'Tanggung Jawab', icon: 'bi-shield-check', statement: 'Siswa menyelesaikan tugas sesuai tanggung jawab dengan tuntas.' },
  { key: 'initiative', label: 'Inisiatif', icon: 'bi-lightbulb-fill', statement: 'Siswa mampu mencari solusi mandiri dan memberikan ide baru.' },
  { key: 'ethics', label: 'Etika & Kesantunan', icon: 'bi-chat-heart-fill', statement: 'Siswa menjaga norma kesantunan, kejujuran, dan komunikasi yang baik.' },
  { key: 'professionalism', label: 'Profesionalisme', icon: 'bi-briefcase-fill', statement: 'Siswa menjaga kerapihan atribut serta kebersihan lingkungan kerja.' },
  { key: 'persistence', label: 'Ketekunan', icon: 'bi-graph-up-arrow', statement: 'Siswa menunjukkan konsentrasi tinggi dan semangat dalam menyelesaikan proyek.' }
])

// ================= AI & QR STATE =================
const showCameraModal = ref(false)
const videoRef = ref(null)
const canvasRef = ref(null)
const isDetecting = ref(false)
const aiStudentCount = ref(0)
let animationId = null
let stream = null
let net = null
const guruQr = ref('')
const showQrModal = ref(false)

// ================= DARK MODE & TOAST =================
const darkMode = ref(localStorage.getItem('darkMode') === 'true')
const toggleDarkMode = () => {
  darkMode.value = !darkMode.value
  localStorage.setItem('darkMode', darkMode.value)
}

const toastVisible = ref(false)
const toastMessage = ref('')
const toastType = ref('success')
const showToast = (msg, type = 'success') => {
  toastMessage.value = msg
  toastType.value = type
  toastVisible.value = true
  setTimeout(() => toastVisible.value = false, 3000)
}

// ================= LOGOUT LOGIC =================
const handleLogout = () => {
  // Menampilkan notifikasi konfirmasi
  const confirmLogout = confirm("Apakah Anda yakin ingin keluar dari aplikasi?")
  
  if (confirmLogout) {
    // Membersihkan seluruh data sesi yang terkait dengan pengajar/guru
    localStorage.removeItem('isLoggedIn')
    localStorage.removeItem('role')
    localStorage.removeItem('teacherName')
    localStorage.removeItem('teacherRole')
    localStorage.removeItem('userName')
    localStorage.removeItem('session_token')
    
    // Memberikan feedback visual singkat sebelum pindah halaman
    showToast('Berhasil keluar...', 'success')
    
    // Mengarahkan kembali ke halaman login
    setTimeout(() => {
      router.replace('/login')
    }, 500)
  }
}

// ================= LOGIC RESET VISUAL (PAGI HARI) =================
const isAttendanceValidToday = (updatedAt) => {
  if (!updatedAt) return false
  
  const now = new Date()
  const lastUpdate = new Date(updatedAt)
  
  const resetTime = new Date()
  resetTime.setHours(5, 0, 0, 0)
  
  if (now < resetTime) {
    resetTime.setDate(resetTime.getDate() - 1)
  }
  
  return lastUpdate >= resetTime
}

// ================= COMPUTED =================
const avatarInitial = computed(() => user.value.name ? user.value.name[0].toUpperCase() : 'G')

const processedStudents = computed(() => {
  return students.value.map(student => {
    const isValid = isAttendanceValidToday(student.updatedAt)
    return {
      ...student,
      displayStatus: isValid ? (student.status || 'Belum Absen') : 'Belum Absen'
    }
  })
})

const filteredStudents = computed(() => {
  let list = processedStudents.value
  if (selectedClass.value) list = list.filter(s => (s.class || '').trim() === selectedClass.value)

  if (activeTab.value === 'hadir') {
    list = list.filter(s => s.displayStatus && !['Pulang', 'Sakit', 'Izin', 'Alpha', 'Belum Absen'].includes(s.displayStatus))
  } else if (activeTab.value === 'pulang') {
    list = list.filter(s => s.displayStatus === 'Pulang')
  } else if (activeTab.value === 'belum') {
    list = list.filter(s => s.displayStatus === 'Belum Absen')
  }

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(s => s.name.toLowerCase().includes(q) || s.nis.includes(q))
  }
  return list
})

const hadirCount = computed(() => {
  return processedStudents.value.filter(s => 
    (s.class || '').trim() === selectedClass.value && 
    !['Pulang', 'Belum Absen', 'Sakit', 'Izin', 'Alpha'].includes(s.displayStatus)
  ).length
})

const pulangCount = computed(() => {
  return processedStudents.value.filter(s => 
    (s.class || '').trim() === selectedClass.value && 
    s.displayStatus === 'Pulang'
  ).length
})

// ================= CHART LOGIC =================
const initChart = () => {
  const ctx = document.getElementById('studentRatingChart')
  if (!ctx) return
  if (ratingChart) ratingChart.destroy()

  ratingChart = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ratingCriteria.value.map(c => c.label),
      datasets: [{
        label: 'Skor Kompetensi',
        data: ratingCriteria.value.map(c => evaluationForm.value[c.key]),
        fill: true,
        backgroundColor: 'rgba(99, 102, 241, 0.2)',
        borderColor: 'rgb(99, 102, 241)',
        pointBackgroundColor: 'rgb(99, 102, 241)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgb(99, 102, 241)',
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          angleLines: { color: 'rgba(226, 232, 240, 0.5)' },
          grid: { color: 'rgba(226, 232, 240, 0.5)' },
          suggestedMin: 0,
          suggestedMax: 5,
          ticks: { display: false, stepSize: 1 }
        }
      },
      plugins: { legend: { display: false } }
    }
  })
}

watch(evaluationForm, () => {
  if (ratingChart) {
    ratingChart.data.datasets[0].data = ratingCriteria.value.map(c => evaluationForm.value[c.key])
    ratingChart.update()
  }
}, { deep: true })

// ================= PENILAIAN CRUD =================
const openRatingModal = async (student) => {
  selectedStudentForRating.value = student
  evaluationForm.value = { discipline: 5, teamwork: 5, responsibility: 5, initiative: 5, ethics: 5, professionalism: 5, persistence: 5, notes: '' }
  isEditing.value = false
  currentEvaluationId.value = null

  // Restore default statements just in case they were modified
  ratingCriteria.value = [
    { key: 'discipline', label: 'Kedisiplinan', icon: 'bi-clock-history', statement: 'Siswa menunjukkan kepatuhan terhadap waktu dan instruksi kerja.' },
    { key: 'teamwork', label: 'Kerja Sama', icon: 'bi-people-fill', statement: 'Siswa berkontribusi aktif dan menjaga koordinasi di dalam tim.' },
    { key: 'responsibility', label: 'Tanggung Jawab', icon: 'bi-shield-check', statement: 'Siswa menyelesaikan tugas sesuai tanggung jawab dengan tuntas.' },
    { key: 'initiative', label: 'Inisiatif', icon: 'bi-lightbulb-fill', statement: 'Siswa mampu mencari solusi mandiri dan memberikan ide baru.' },
    { key: 'ethics', label: 'Etika & Kesantunan', icon: 'bi-chat-heart-fill', statement: 'Siswa menjaga norma kesantunan, kejujuran, dan komunikasi yang baik.' },
    { key: 'professionalism', label: 'Profesionalisme', icon: 'bi-briefcase-fill', statement: 'Siswa menjaga kerapihan atribut serta kebersihan lingkungan kerja.' },
    { key: 'persistence', label: 'Ketekunan', icon: 'bi-graph-up-arrow', statement: 'Siswa menunjukkan konsentrasi tinggi dan semangat dalam menyelesaikan proyek.' }
  ]

  try {
    const res = await axios.get(`${backendUrl}/evaluations/student/${student.nis}`)
    if (res.data && res.data.length > 0) {
      const latest = res.data[res.data.length - 1]
      isEditing.value = true
      currentEvaluationId.value = latest._id
      
      // Map ratings
      evaluationForm.value = {
        discipline: latest.discipline.rating, teamwork: latest.teamwork.rating,
        responsibility: latest.responsibility.rating, initiative: latest.initiative.rating,
        ethics: latest.ethics.rating, professionalism: latest.professionalism.rating,
        persistence: latest.persistence.rating, notes: latest.notes
      }

      // Restore saved custom statements if they exist
      ratingCriteria.value.forEach(crit => {
         if(latest[crit.key] && latest[crit.key].statement) {
            crit.statement = latest[crit.key].statement
         }
      })
    }
  } catch (err) { console.log("No previous data found.") }

  showRatingModal.value = true
  nextTick(() => initChart())
}

const submitEvaluation = async () => {
  const payload = {
    studentNis: selectedStudentForRating.value.nis,
    teacherName: user.value.name,
    discipline: { statement: ratingCriteria.value[0].statement, rating: evaluationForm.value.discipline },
    teamwork: { statement: ratingCriteria.value[1].statement, rating: evaluationForm.value.teamwork },
    responsibility: { statement: ratingCriteria.value[2].statement, rating: evaluationForm.value.responsibility },
    initiative: { statement: ratingCriteria.value[3].statement, rating: evaluationForm.value.initiative },
    ethics: { statement: ratingCriteria.value[4].statement, rating: evaluationForm.value.ethics },
    professionalism: { statement: ratingCriteria.value[5].statement, rating: evaluationForm.value.professionalism },
    persistence: { statement: ratingCriteria.value[6].statement, rating: evaluationForm.value.persistence },
    notes: evaluationForm.value.notes
  }
  try {
    if (isEditing.value) await axios.put(`${backendUrl}/evaluations/${currentEvaluationId.value}`, payload)
    else await axios.post(`${backendUrl}/evaluations`, payload)
    
    // Explicitly update the frontend state to reflect new data
    const idx = students.value.findIndex(s => s.nis === payload.studentNis)
    if (idx !== -1) {
       students.value[idx].lastEvaluation = payload
    }
    
    showToast('Berhasil menyimpan nilai!'); showRatingModal.value = false
  } catch (err) { showToast('Gagal menyimpan nilai', 'error') }
}

const deleteEvaluation = async () => {
  if (!confirm('Hapus penilaian?')) return
  try {
    await axios.delete(`${backendUrl}/evaluations/${currentEvaluationId.value}`)
    showToast('Dihapus', 'warning'); showRatingModal.value = false
  } catch (err) { showToast('Gagal hapus', 'error') }
}

// ================= AI CAMERA =================
const startCamera = async () => {
  showCameraModal.value = true
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: 640, height: 480 } })
    if (videoRef.value) {
      videoRef.value.srcObject = stream
      videoRef.value.onloadedmetadata = () => initAiDetection()
    }
  } catch (err) { showToast('Kamera Error', 'error'); showCameraModal.value = false }
}

const stopCamera = () => {
  if (stream) stream.getTracks().forEach(track => track.stop())
  if (animationId) cancelAnimationFrame(animationId)
  showCameraModal.value = false; isDetecting.value = false
}

const initAiDetection = async () => {
  isDetecting.value = true
  if (!net) net = await window.cocoSsd.load({ base: 'mobilenet_v2' })
  let frameCount = 0
  const detectFrame = async () => {
    if (!isDetecting.value || !videoRef.value) return
    if (videoRef.value.readyState === 4 && frameCount % 4 === 0) {
      const predictions = await net.detect(videoRef.value)
      const persons = predictions.filter(p => p.class === 'person' && p.score > 0.45)
      aiStudentCount.value = persons.length
      if (canvasRef.value) {
        const ctx = canvasRef.value.getContext('2d')
        canvasRef.value.width = videoRef.value.videoWidth
        canvasRef.value.height = videoRef.value.videoHeight
        ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height)
        persons.forEach(p => {
          ctx.strokeStyle = '#6366f1'; ctx.lineWidth = 4; ctx.strokeRect(p.bbox[0], p.bbox[1], p.bbox[2], p.bbox[3])
        })
      }
    }
    frameCount++; animationId = requestAnimationFrame(detectFrame)
  }
  detectFrame()
}

// ================= CORE LOGIC =================
const loadStudents = async (isManual = false) => {
  if (isManual) isRefreshing.value = true
  try {
    const res = await axios.get(`${apiUrl}/students`)
    students.value = res.data
    if (isManual) showToast('Data Updated')
  } catch (err) { if (isManual) showToast('Sync Failed', 'error') }
  finally { if (isManual) isRefreshing.value = false }
}

const fetchTeacherProfile = async () => {
  try {
    const email = localStorage.getItem('remembered_user')
    if (!email) return
    const res = await axios.get(`${backendUrl}/teachers`)
    const matched = res.data.find(t => t.email === email)
    if (matched) {
      teacherProfile.value = matched
      user.value.name = matched.name
      user.value.mapel = matched.mapel
    }
  } catch (err) {
    console.error('Fetch teacher profile error:', err)
  }
}

const updateStatusManual = async (nis, newStatus) => {
  try {
    await axios.post(`${apiUrl}/students/absensi-manual`, {
      nis,
      status: newStatus,
      teacherName: user.value.name
    })
    showToast(`Status: ${newStatus}`, 'success')
    await loadStudents()
  } catch (e) {
    showToast('Gagal update status', 'error')
  }
}

onMounted(async () => {
  user.value.name = localStorage.getItem('teacherName') || 'Guru'
  await Promise.all([loadStudents(), fetchTeacherProfile()])
  guruQr.value = await QRCode.toDataURL(`ABSENSI-GURU-${Date.now()}`)
})
</script>

<template>
  <div :class="['app-container', darkMode ? 'dark-theme' : 'light-theme']">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css" rel="stylesheet">

    <Transition name="toast">
      <div v-if="toastVisible" class="custom-toast" :class="toastType">
        <i :class="toastType === 'success' ? 'bi bi-check-circle-fill' : 'bi bi-info-circle-fill'"></i>
        {{ toastMessage }}
      </div>
    </Transition>

    <nav class="teacher-nav px-3 py-2 shadow-sm">
      <div class="nav-content-web d-flex justify-content-between align-items-center mx-auto" style="max-width: 600px;">
        <div class="d-flex align-items-center gap-3">
          <div class="teacher-avatar shadow-sm">{{ avatarInitial }}</div>
          <div>
            <small class="text-muted d-block smaller">Panel Pengajar</small>
            <span class="fw-bold">{{ user.name }}</span>
          </div>
        </div>
        <div class="d-flex gap-2">
          <button @click="toggleDarkMode" class="icon-btn"><i :class="darkMode ? 'bi bi-sun-fill' : 'bi bi-moon-stars-fill'"></i></button>
          <button @click="handleLogout" class="icon-btn text-danger"><i class="bi bi-power"></i></button>
        </div>
      </div>
    </nav>

    <main class="container py-4" style="max-width: 600px;">
      <div class="mb-3">
        <label class="smaller fw-bold text-muted mb-2 d-block">KELAS / JURUSAN</label>
        <select v-model="selectedClass" class="form-select border-0 shadow-sm rounded-4 fw-bold py-2">
          <option v-for="opt in classOptions" :key="opt" :value="opt">{{ opt }}</option>
        </select>
      </div>

      <section class="dashboard-hero mb-4 shadow-sm p-4 text-white">
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <h4 class="fw-bold mb-1">{{ selectedClass }}</h4>
            <div class="d-flex gap-2 mt-2">
              <span class="badge bg-white bg-opacity-25 smaller">AI: {{ aiStudentCount }}</span>
              <span class="badge bg-white bg-opacity-25 smaller">Pulang: {{ pulangCount }}</span>
            </div>
          </div>
          <div class="text-center">
            <small class="d-block opacity-75 smaller">HADIR</small>
            <h1 class="fw-black m-0">{{ hadirCount }}<small class="fs-6 opacity-50">/{{ filteredStudents.length }}</small></h1>
          </div>
        </div>
      </section>

      <div class="row g-3 mb-4">
        <div class="col-6">
          <button @click="startCamera" class="action-card border-0 shadow-sm w-100 p-3 bg-white rounded-4">
            <i class="bi bi-camera-video-fill text-indigo mb-1 d-block fs-3"></i>
            <span class="fw-bold smaller d-block">AI Camera</span>
            <small class="text-muted smaller">Hitung Siswa</small>
          </button>
        </div>
        <div class="col-6">
          <button @click="showQrModal=true" class="action-card border-0 shadow-sm w-100 p-3 bg-white rounded-4">
            <i class="bi bi-qr-code text-primary mb-1 d-block fs-3"></i>
            <span class="fw-bold smaller d-block">QR Code</span>
            <small class="text-muted smaller">Scan Absensi</small>
          </button>
        </div>
      </div>

      <!-- PROFIL PENGAJAR PANEL (SEPERTI STUDENT DASHBOARD) -->
      <section class="teacher-profile-card mb-4 shadow-sm overflow-hidden" style="border-radius: 24px; background: white; border: 1px solid #e2e8f0;">
        <div class="p-4" style="background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%);">
          <div class="d-flex align-items-center gap-3">
            <div class="avatar-glow shadow-sm" style="width: 60px; height: 60px; background: rgba(255,255,255,0.2); border: 2px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 1.5rem;">
              {{ avatarInitial }}
            </div>
            <div>
              <h5 class="fw-bold mb-0 text-white">{{ teacherProfile.name || user.name }}</h5>
              <span class="badge" style="background: rgba(255,255,255,0.2); color: white; border-radius: 10px; font-size: 0.7rem;">
                <i class="bi bi-person-badge me-1"></i>AKUN GURU AKTIF
              </span>
            </div>
          </div>
        </div>
        <div class="p-3">
          <div class="row g-2">
            <div class="col-6">
              <div class="p-2 rounded-3" style="background: #f8fafc; border: 1px solid #e2e8f0;">
                <small class="text-muted d-block" style="font-size: 0.65rem; font-weight: 700;">EMAIL</small>
                <span class="fw-bold text-dark text-truncate d-block" style="font-size: 0.8rem;">{{ teacherProfile.email || 'Belum diatur' }}</span>
              </div>
            </div>
            <div class="col-6">
              <div class="p-2 rounded-3" style="background: #f8fafc; border: 1px solid #e2e8f0;">
                <small class="text-muted d-block" style="font-size: 0.65rem; font-weight: 700;">MATA PELAJARAN</small>
                <span class="fw-bold text-dark text-truncate d-block" style="font-size: 0.8rem;">{{ teacherProfile.mapel || 'Belum diatur' }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="list-section bg-white rounded-4 shadow-sm overflow-hidden mb-5">
        <div class="p-3 border-bottom">
          <div class="tab-pill-container d-flex gap-2 overflow-auto mb-3 bg-light p-1 rounded-3">
            <button v-for="tab in ['hadir','pulang','belum','semua']" :key="tab" 
              @click="activeTab = tab" :class="['flex-grow-1 border-0 py-1 rounded-2 smaller fw-bold', activeTab === tab ? 'bg-white shadow-sm text-primary' : 'bg-transparent text-muted']">
              {{ tab.toUpperCase() }}
            </button>
          </div>
          <div class="search-input-group position-relative">
            <i class="bi bi-search position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"></i>
            <input v-model="searchQuery" class="form-control border-light rounded-pill ps-5" placeholder="Cari Siswa..." />
          </div>
        </div>

        <div class="list-body">
          <div v-for="s in filteredStudents" :key="s.nis" class="p-3 border-bottom student-row">
            <div class="d-flex justify-content-between align-items-center">
              <div class="d-flex align-items-center gap-3">
                <div class="student-initial shadow-sm">{{ s.name[0] }}</div>
                <div>
                  <h6 class="mb-0 fw-bold small">{{ s.name }}</h6>
                  <div class="d-flex gap-2 align-items-center">
                    <small class="text-muted smaller">{{ s.nis }}</small>
                    <span v-if="s.displayStatus !== 'Belum Absen'" :class="['badge rounded-pill smaller-badge', 
                      s.displayStatus === 'Hadir' ? 'bg-success-subtle text-success' : 
                      s.displayStatus === 'Sakit' ? 'bg-warning-subtle text-warning' : 
                      s.displayStatus === 'Izin' ? 'bg-info-subtle text-info' : 'bg-danger-subtle text-danger']">
                      {{ s.displayStatus }}
                    </span>
                  </div>
                </div>
              </div>
              <div class="d-flex flex-column align-items-end gap-2">
                <div class="manual-absensi-btns d-flex gap-1">
                  <button @click="updateStatusManual(s.nis, 'Hadir')" class="btn btn-xs btn-outline-success py-0 px-2 fw-bold" title="Hadir">H</button>
                  <button @click="updateStatusManual(s.nis, 'Sakit')" class="btn btn-xs btn-outline-warning py-0 px-2 fw-bold" title="Sakit">S</button>
                  <button @click="updateStatusManual(s.nis, 'Izin')" class="btn btn-xs btn-outline-info py-0 px-2 fw-bold" title="Izin">I</button>
                  <button @click="updateStatusManual(s.nis, 'Alpha')" class="btn btn-xs btn-outline-danger py-0 px-2 fw-bold" title="Alpha">A</button>
                </div>
                <button @click="openRatingModal(s)" class="btn btn-primary btn-sm rounded-pill px-3 py-1 smaller fw-bold shadow-sm">
                  <i class="bi bi-star-fill me-1"></i> NILAI
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>

    <Transition name="sheet">
      <div v-if="showRatingModal" class="sheet-overlay" @click.self="showRatingModal=false">
        <div class="sheet-content">
          <div class="drag-handle mb-3"></div>
          <div class="d-flex justify-content-between align-items-start mb-4">
            <div class="d-flex align-items-center gap-3">
              <div class="student-initial bg-primary text-white" style="width: 50px; height: 50px; font-size: 1.2rem;">
                {{ selectedStudentForRating?.name[0] }}
              </div>
              <div>
                <h5 class="fw-bold mb-0">{{ selectedStudentForRating?.name }}</h5>
                <span class="badge bg-light text-muted border smaller">{{ selectedStudentForRating?.nis }}</span>
              </div>
            </div>
            <button v-if="isEditing" @click="deleteEvaluation" class="btn btn-soft-danger rounded-circle p-2">
              <i class="bi bi-trash3-fill"></i>
            </button>
          </div>

          <div class="scroll-penilaian px-1" style="max-height: 65vh; overflow-y: auto; scrollbar-width: none;">
            <div class="chart-card mb-4 bg-white border rounded-4 p-3 shadow-sm">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <span class="fw-bold smaller text-muted">GRAFIK KOMPETENSI</span>
                <i class="bi bi-hexagon-half text-indigo"></i>
              </div>
              <div style="height: 220px;"><canvas id="studentRatingChart"></canvas></div>
            </div>

            <div class="rating-grid">
              <div v-for="crit in ratingCriteria" :key="crit.key" class="crit-item mb-3">
                <div class="p-3 border rounded-4 bg-white shadow-sm hover-border">
                  <div class="d-flex align-items-center justify-content-between mb-2">
                    <div class="d-flex align-items-center gap-2">
                      <div class="icon-box bg-indigo-subtle text-indigo rounded-3 p-2">
                        <i :class="['bi', crit.icon]"></i>
                      </div>
                      <span class="fw-bold smaller">{{ crit.label }}</span>
                    </div>
                    <span class="badge rounded-pill bg-indigo text-white px-3">{{ evaluationForm[crit.key] }}/5</span>
                  </div>
                  <textarea v-model="crit.statement" class="form-control mb-3 text-muted" style="font-size: 0.75rem; line-height: 1.4; border: 1px dashed #cbd5e1; resize: none; border-radius: 8px;" rows="2" placeholder="Ubah teks kriteria penilaian ini..."></textarea>
                  <div class="star-rating-wrapper d-flex justify-content-between align-items-center bg-light p-2 rounded-3">
                      <div class="stars d-flex gap-2">
                        <i v-for="star in 5" :key="star" 
                          @click="evaluationForm[crit.key] = star" 
                          :class="['bi fs-4 transition-all', star <= evaluationForm[crit.key] ? 'bi-star-fill text-warning scale-up' : 'bi-star text-secondary opacity-25']" 
                          style="cursor: pointer;"></i>
                      </div>
                      <span class="smaller fw-bold text-indigo">{{ evaluationForm[crit.key] == 5 ? 'Sangat Baik' : evaluationForm[crit.key] >= 3 ? 'Baik' : 'Cukup' }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="mb-4 mt-2">
              <label class="smaller fw-bold text-muted mb-2 ps-1">
                <i class="bi bi-pencil-square me-1"></i> CATATAN OBSERVASI GURU
              </label>
              <textarea v-model="evaluationForm.notes" 
                class="form-control rounded-4 bg-white border shadow-sm p-3 smaller" 
                rows="3" 
                placeholder="Berikan masukan atau catatan khusus untuk siswa ini..."></textarea>
            </div>
          </div>

          <div class="footer-actions d-flex gap-2 pt-3 border-top mt-2">
            <button @click="showRatingModal=false" class="btn btn-light flex-grow-1 rounded-pill py-3 fw-bold">BATAL</button>
            <button @click="submitEvaluation" class="btn btn-indigo flex-grow-1 rounded-pill py-3 fw-bold shadow-lg">
              <i class="bi bi-cloud-check-fill me-2"></i> {{ isEditing ? 'UPDATE NILAI' : 'SIMPAN NILAI' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="fade">
      <div v-if="showCameraModal" class="ai-camera-overlay">
        <div class="camera-wrapper">
          <video ref="videoRef" autoplay playsinline muted class="camera-stream"></video>
          <canvas ref="canvasRef" class="camera-overlay"></canvas>
          <div class="camera-footer text-center">
            <div class="ai-status mb-3">
              <div class="pulse-red"></div>
              <span class="fw-bold text-white">TERDETEKSI: {{ aiStudentCount }} SISWA</span>
            </div>
            <button @click="stopCamera" class="btn btn-danger rounded-pill px-5 py-2 fw-bold">TUTUP KAMERA</button>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="sheet">
      <div v-if="showQrModal" class="sheet-overlay" @click.self="showQrModal=false">
        <div class="sheet-content text-center">
          <div class="drag-handle mb-4"></div>
          <h6 class="fw-bold mb-3">QR ABSENSI {{ selectedClass }}</h6>
          <div class="bg-white p-3 rounded-4 shadow-sm d-inline-block mb-4">
            <img :src="guruQr" style="width: 250px;" class="img-fluid" />
          </div>
          <button @click="showQrModal=false" class="btn btn-dark w-100 rounded-pill py-3 fw-bold">TUTUP</button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');

.app-container { 
  font-family: 'Plus Jakarta Sans', sans-serif; 
  min-height: 100vh; 
  transition: background 0.3s; 
  user-select: none; 
  touch-action: manipulation; 
  -webkit-user-drag: none;
}

/* CUSTOM STYLE PENILAIAN */
.bg-indigo-soft { background: #e0e7ff; }
.text-indigo { color: #6366f1; }
.custom-range::-webkit-slider-thumb { background: #6366f1; }
.custom-range::-moz-range-thumb { background: #6366f1; }

.qr-brightness-active {
  background: rgba(255, 255, 255, 0.95) !important; 
  backdrop-filter: brightness(1.5) blur(10px) !important;
}

.zoom-qr {
  transform: scale(1.1); 
  transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 0 50px rgba(99, 102, 241, 0.4) !important;
}

.qr-main-img {
  filter: contrast(1.2) brightness(1.1); 
}

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
.bg-primary-subtle { background: rgba(99, 102, 241, 0.2) !important; }

.camera-container { position: relative; width: 100%; height: 300px; background: #000; border-radius: 24px; overflow: hidden; }
.video-preview { width: 100%; height: 100%; object-fit: cover; }
.canvas-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }

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

.btn-refresh { border: none; background: #f1f5f9; width: 40px; height: 40px; border-radius: 12px; color: #6366f1; font-size: 1.2rem; display: flex; align-items: center; justify-content: center; transition: 0.3s; }
.dark-theme .btn-refresh { background: #0f172a; color: white; }
.spinning { animation: rotate 1s linear infinite; }
@keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

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

.btn-reset-data { width: 100%; border: 1.5px dashed #ef4444; color: #ef4444; background: transparent; border-radius: 15px; padding: 12px; font-weight: 700; font-size: 0.8rem; }

.blink { animation: blinker 1.5s linear infinite; }

.custom-toast { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); z-index: 9999; padding: 12px 24px; border-radius: 12px; color: white; font-weight: 700; display: flex; align-items: center; gap: 10px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
.custom-toast.success { background: #10b981; }
.custom-toast.error { background: #ef4444; }

@keyframes blinker { 50% { opacity: 0; } }
@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
.smaller { font-size: 0.7rem; }
.fw-black { font-weight: 900; }
.border-top-dashed { border-top: 1px dashed #e2e8f0; }
.btn-detail { background: none; border: none; color: #6366f1; font-weight: 700; font-size: 0.75rem; padding: 0; text-align: left; }
</style>