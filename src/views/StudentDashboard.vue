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
const backendUrl = 'https://backendd-andika-beres.vercel.app/api'
const apiUrl = 'https://backendd-andika-beres.vercel.app/api'

// ================= STATE SISWA & UI =================
const student = ref({ 
  name:'', 
  nis:'', 
  class:'', 
  status:'Belum Absen', 
  lastAttendance: null,
  gender: '',
  attendanceHistory: [],
  lastEvaluation: null,
  points: 100,
  vouchers: 0,
  vouchersMapel: 0,
  vouchersAlfa: 0,
  pointHistory: []
})
const attendanceStats = ref({ hadir: 0, sakit: 0, izin: 0, alfa: 0 }) 
const qrVisible = ref(false)
const scheduleVisible = ref(false)
const showGuide = ref(false)  
const profileVisible = ref(false)  
const profileImage = ref(null)      
const showLogoutConfirm = ref(false) 
const showVibrateBanner = ref(false) 
const isProcessingAbsen = ref(false)
const pointVisible = ref(false)
const voucherInput = ref('')
const claimingVoucher = ref(false)
const showSuccessModal = ref(false)
const activePointTab = ref('marketplace') // 'marketplace' or 'history'

let html5QrCode = null   
let scanning = false
const guruTokenPrefix = 'ABSENSI-GURU-'

const isNotificationEnabled = ref(localStorage.getItem('notif_active') !== 'false')

// ================= JAM BATAS ABSEN =================
const getCurrentTimeMinutes = () => {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

const isSchoolTime = computed(() => {
  const currentMinutes = getCurrentTimeMinutes()
  return currentMinutes >= 360 && currentMinutes <= 900
})

const canAbsen = computed(() => {
  if (!isSchoolTime.value) return false
  
  const today = new Date().toDateString()
  const currentMapel = getCurrentMapel()

  // Jika ada mapel aktif sekarang
  if (currentMapel) {
    const alreadyAbsen = student.value.attendanceHistory?.some(h =>
      new Date(h.timestamp).toDateString() === today && h.mapel === currentMapel
    )
    return !alreadyAbsen
  }

  // Jika tidak ada mapel aktif, cek apakah ada mapel terbaru yang terlewat (bisa absen telat)
  const lateMapel = getLateMapel()
  if (lateMapel) {
    const alreadyAbsen = student.value.attendanceHistory?.some(h =>
      new Date(h.timestamp).toDateString() === today && h.mapel === lateMapel
    )
    return !alreadyAbsen
  }

  return false
})

const getCurrentMapel = () => {
  const currentMinutes = getCurrentTimeMinutes()
  const found = jadwalHariIni.value.find(j => {
    const [startRange, endRange] = j.jam.split('-')
    const [startHour, startMin] = startRange.split(':').map(Number)
    const [endHour, endMin] = endRange ? endRange.split(':').map(Number) : [startHour + 2, startMin]
    
    const startTotal = startHour * 60 + startMin
    const endTotal = endHour * 60 + endMin
    return currentMinutes >= startTotal && currentMinutes <= endTotal
  })
  return found ? found.mapel : null
}

// Cari mapel TERAKHIR yang sudah selesai tapi belum diabsen siswa (untuk deteksi telat)
const getLateMapel = () => {
  const currentMinutes = getCurrentTimeMinutes()
  const today = new Date().toDateString()

  // Ambil semua mapel yang sudah selesai, urutkan dari yang paling baru selesai
  const passedMapels = jadwalHariIni.value
    .filter(j => {
      if (!j.jam || !j.jam.includes('-')) return false
      const parts = j.jam.split('-')
      if (parts.length < 2) return false
      const [endHour, endMin] = parts[1].trim().split(':').map(Number)
      if (isNaN(endHour) || isNaN(endMin)) return false
      return currentMinutes > (endHour * 60 + endMin)
    })
    .sort((a, b) => {
      const getEnd = j => { const [h, m] = j.jam.split('-')[1].trim().split(':').map(Number); return h * 60 + m }
      return getEnd(b) - getEnd(a) // terbaru dulu
    })

  // Kembalikan mapel terbaru yang belum diabsen
  for (const jadwal of passedMapels) {
    const hasAttended = student.value.attendanceHistory?.some(h =>
      new Date(h.timestamp).toDateString() === today && h.mapel === jadwal.mapel
    )
    if (!hasAttended) return jadwal.mapel
  }
  return null
}

// Get the teacher name for the currently active mapel based on the schedule
const getCurrentGuruMapel = () => {
  const currentMinutes = getCurrentTimeMinutes()
  const found = jadwalHariIni.value.find(j => {
    if (!j.jam || !j.jam.includes('-')) return false
    const [startRange, endRange] = j.jam.split('-')
    const [startHour, startMin] = startRange.trim().split(':').map(Number)
    const [endHour, endMin] = endRange ? endRange.trim().split(':').map(Number) : [startHour + 2, startMin]
    const startTotal = startHour * 60 + startMin
    const endTotal = endHour * 60 + endMin
    return currentMinutes >= startTotal && currentMinutes <= endTotal
  })
  return found ? (found.guru || found.teacher || null) : null
}

// ================= LOGIKA PENILAIAN =================
const evaluationSummary = computed(() => {
  if (!student.value.lastEvaluation) return [];
  const ev = student.value.lastEvaluation;

  return [
    { label: 'Kedisiplinan', rating: ev.discipline?.rating, statement: ev.discipline?.statement, icon: 'bi-clock-history' },
    { label: 'Kerja Sama', rating: ev.teamwork?.rating, statement: ev.teamwork?.statement, icon: 'bi-people' },
    { label: 'Tanggung Jawab', rating: ev.responsibility?.rating, statement: ev.responsibility?.statement, icon: 'bi-shield-check' },
    { label: 'Inisiatif', rating: ev.initiative?.rating, statement: ev.initiative?.statement, icon: 'bi-lightbulb' },
    { label: 'Etika', rating: ev.ethics?.rating, statement: ev.ethics?.statement, icon: 'bi-chat-heart' },
    { label: 'Profesionalisme', rating: ev.professionalism?.rating, statement: ev.professionalism?.statement, icon: 'bi-briefcase' },
    { label: 'Ketekunan', rating: ev.persistence?.rating, statement: ev.persistence?.statement, icon: 'bi-graph-up' }
  ];
});

// ================= LOGIKA KIRIM BUKTI (WHATSAPP REDIRECT) =================
const isUploading = ref(false)

const handleSendEvidenceDirect = () => {
  const phoneNumber = '6281322233928'
  const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const dateStr = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const statusText = student.value.status

  const message = `Halo Bapak Ibu , saya ingin melaporkan kehadiran:%0A%0A` +
                  `*Nama:* ${student.value.name}%0A` +
                  `*NIS:* ${student.value.nis}%0A` +
                  `*Kelas:* ${student.value.class}%0A` +
                  `*Status:* ${statusText}%0A` +
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

// ================= LOGIKA GETAR & SUARA =================
let reminderInterval = null;

const playReminderFeedback = () => {
  if (!isNotificationEnabled.value || student.value.status === 'Hadir' || !isSchoolTime.value) {
    stopReminderSystem();
    return;
  }

  const audio = new Audio('https://raw.githubusercontent.com/freeCodeCamp/cdn/master/build/testable-projects-fcc/audio/BeepSound.wav');
  audio.volume = 1.0;  
  audio.play().catch(() => {});

  if ('vibrate' in navigator) {
    navigator.vibrate([500, 200, 500, 200, 500, 200, 500]);
  }
};

const startReminderSystem = () => {
  stopReminderSystem(); 
  if (isNotificationEnabled.value && student.value.status !== 'Hadir' && isSchoolTime.value) {
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
  }
}

watch(isNotificationEnabled, (newVal) => {
  localStorage.setItem('notif_active', newVal)
  if (newVal) {
    if (student.value.status !== 'Hadir' && isSchoolTime.value) startReminderSystem();
  } else {
    stopReminderSystem();
  }
})

watch(() => student.value.status, (newStatus) => {
  if (newStatus !== 'Hadir' && isSchoolTime.value) {
    startReminderSystem();
  } else {
    stopReminderSystem();
  }
});

// Banner Slider
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

const handleImageUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  const formData = new FormData()
  formData.append('file', file)

  showToast('Mengunggah foto...', 'info')
  try {
    const res = await axios.post(`${backendUrl}/students/${student.value.nis}/upload-profile`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    
    if (res.data && res.data.profileImage) {
      if (res.data.profileImage.startsWith('data:image')) {
        profileImage.value = res.data.profileImage
      } else {
        const baseUrl = backendUrl.replace('/api', '')
        profileImage.value = `${baseUrl}/uploads/${res.data.profileImage}`
      }
      showToast('Foto profil diperbarui!', 'success')
    }
  } catch (err) {
    console.error('Upload error details:', err)
    const errorMsg = err.response?.data?.message || 'Gagal mengunggah foto'
    showToast(errorMsg, 'error')
  }
}

const genderDetect = computed(() => {
  if (student.value.gender) return student.value.gender;
  const name = (student.value.name || '').toLowerCase()
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
        let isWithinAnyLocation = false;
        
        // Handle newer dual-location config format
        if (schoolConfig.value.loc1 || schoolConfig.value.loc2) {
          if (schoolConfig.value.loc1 && schoolConfig.value.loc1.lat) {
             const dist1 = calculateDistance(pos.coords.latitude, pos.coords.longitude, schoolConfig.value.loc1.lat, schoolConfig.value.loc1.lng);
             if (dist1 <= schoolConfig.value.loc1.radius) isWithinAnyLocation = true;
          }
          if (schoolConfig.value.loc2 && schoolConfig.value.loc2.lat) {
             const dist2 = calculateDistance(pos.coords.latitude, pos.coords.longitude, schoolConfig.value.loc2.lat, schoolConfig.value.loc2.lng);
             if (dist2 <= schoolConfig.value.loc2.radius) isWithinAnyLocation = true;
          }
        } 
        // Fallback for older single-location config format
        else if (schoolConfig.value.lat) {
          const dist = calculateDistance(pos.coords.latitude, pos.coords.longitude, schoolConfig.value.lat, schoolConfig.value.lng);
          if (dist <= schoolConfig.value.radius) isWithinAnyLocation = true;
        }

        if (isWithinAnyLocation) {
           resolve(true)
        } else {
           reject(`Mohon harus di area sekolah. Anda berada di luar radius GPS.`)
        }
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
    const res = await axios.get(`${backendUrl}/students/${student.value.nis}`)
    const me = res.data
    if(me) {
      student.value.name = me.name
      student.value.class = me.class
      student.value.gender = me.gender || ''
      student.value.attendanceHistory = me.attendanceHistory || []
      student.value.lastEvaluation = me.lastEvaluation || null 
      student.value.points = me.points !== undefined ? me.points : 100
      student.value.vouchers = me.vouchers !== undefined ? me.vouchers : 0
      student.value.vouchersMapel = me.vouchersMapel !== undefined ? me.vouchersMapel : 0
      student.value.vouchersAlfa = me.vouchersAlfa !== undefined ? me.vouchersAlfa : 0
      student.value.pointHistory = me.pointHistory || []
      
      if (me.profileImage) {
        if (me.profileImage.startsWith('data:image')) {
          profileImage.value = me.profileImage
        } else {
          const baseUrl = backendUrl.replace('/api', '')
          profileImage.value = `${baseUrl}/uploads/${me.profileImage}`
        }
      }
      
      const today = new Date().toDateString();
      const currentMapel = getCurrentMapel();
      const todayAbsensi = student.value.attendanceHistory.filter(h => 
        new Date(h.timestamp).toDateString() === today
      );

      const currentMapelAbsen = todayAbsensi.find(h => h.mapel === currentMapel);
      
      if (currentMapelAbsen) {
        student.value.status = currentMapelAbsen.status;
        student.value.lastAttendance = currentMapelAbsen.timestamp;
      } else {
        student.value.status = 'Belum Absen';
        student.value.lastAttendance = null;
      }

      const stats = { hadir: 0, sakit: 0, izin: 0, alfa: 0 }
      student.value.attendanceHistory.forEach(h => {
        const s = h.status.toLowerCase()
        if(s === 'hadir') stats.hadir++
        else if(s === 'sakit') stats.sakit++
        else if(s === 'izin') stats.izin++
        else if(s === 'alfa') stats.alfa++
      })
      attendanceStats.value = stats
      
      if (student.value.status === 'Belum Absen' && isSchoolTime.value) {
        startReminderSystem();
      } else {
        stopReminderSystem();
      }
    }
  } catch(err){ console.log(err) }
}

const startScan = async () => {
  if (!canAbsen.value) {
    if (!isSchoolTime.value) return showToast('Absensi hanya bisa dilakukan jam 06:00 - 15:00.', 'error')
    return showToast('Kamu sudah absen untuk mata pelajaran ini!', 'info')
  }
  
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
    const currentMapel = getCurrentMapel()
    const lateMapel = !currentMapel ? getLateMapel() : null
    const targetMapel = currentMapel || lateMapel || 'Pelajaran Umum'
    const isLate = !currentMapel && !!lateMapel
    const status = isLate ? 'Telat' : 'Hadir'
    
    await new Promise(r => setTimeout(r, 1500));
    await axios.post(`${backendUrl}/students/attendance/${student.value.nis}`, { 
      status: status, 
      qrToken: token, 
      mapel: targetMapel, 
      timestamp: now  
    })
    
    student.value.status = status
    student.value.lastAttendance = now

    if (isLate) {
      // Telat: kurangi 27 poin
      try {
        await axios.post(`${backendUrl}/students/${student.value.nis}/absence-penalty`, {
          type: 'alfa',
          description: `Telat hadir: ${targetMapel}`
        })
        student.value.points = Math.max(0, (student.value.points || 0) - 27)
      } catch(penaltyErr) {
        console.warn('Gagal apply telat penalty:', penaltyErr)
      }
      stopReminderSystem()
      isProcessingAbsen.value = false
      showToast(`Tercatat TELAT -27 Poin (${targetMapel})`, 'error')
      showSuccessModal.value = true
    } else {
      // Hadir tepat waktu: tambah 28 poin
      student.value.points = (student.value.points || 100) + 28
      stopReminderSystem()
      playSuccessFeedback()
      isProcessingAbsen.value = false
      showSuccessModal.value = true
    }

    setTimeout(() => { stopScan(); loadAttendance() }, 800)
  } catch(err){ 
    isProcessingAbsen.value = false
    showToast('Gagal mengirim data','error'); 
    scanning = false 
  }
}

const displayStatus = computed(() => {
  const currentMapel = getCurrentMapel();
  const today = new Date().toDateString();
  
  const hasAbsenNow = student.value.attendanceHistory?.find(h => 
    new Date(h.timestamp).toDateString() === today && h.mapel === currentMapel
  );

  if(hasAbsenNow && student.value.lastAttendance){
    return `${hasAbsenNow.status} - ${new Date(student.value.lastAttendance).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' })}`
  }
  
  return !isSchoolTime.value ? 'Sudah Pulang, Diluar Jam Mapel' : 'Belum Absen'
});

const buyVoucher = async (itemType = 'generic') => {
  if (claimingVoucher.value) return
  
  // Semua jenis voucher harganya sama: 15 poin
  const cost = 10;

  if ((student.value.points || 0) < cost) {
    return showToast(`Point tidak cukup! (butuh ${cost} point)`, 'error');
  }

  // Optimistic Update
  const originalStudent = JSON.parse(JSON.stringify(student.value))
  student.value.points -= cost
  if (itemType === 'mapel') student.value.vouchersMapel++
  else if (itemType === 'alfa') student.value.vouchersAlfa++
  else student.value.vouchers++

  claimingVoucher.value = true;
  try {
    const res = await axios.post(`${backendUrl}/students/${student.value.nis}/buy-voucher`, { cost, itemType })
    showToast(`Berhasil membeli voucher!`, 'success');
    // Silent sync to ensure final state is correct
    loadAttendance()
  } catch(err) {
    // Revert on error
    student.value = originalStudent
    showToast('Gagal memproses transaksi', 'error');
  } finally {
    claimingVoucher.value = false;
  }
}

const clearPointHistory = async () => {
  if (!confirm('Apakah Anda yakin ingin menghapus semua riwayat point? Tindakan ini tidak dapat dibatalkan.')) return
  try {
    await axios.delete(`${backendUrl}/students/${student.value.nis}/point-history`)
    showToast('Riwayat berhasil dihapus', 'success')
    loadAttendance()
  } catch (err) {
    showToast('Gagal menghapus riwayat', 'error')
  }
}

// ================= SIMPAN JENIS KELAMIN =================
const saveGender = async () => {
  if (!student.value.gender) return
  try {
    await axios.patch(`${backendUrl}/students/${student.value.nis}/gender`, {
      gender: student.value.gender
    })
    showToast(`Jenis kelamin disimpan: ${student.value.gender} ✓`, 'success')
  } catch (err) {
    // Fallback: coba via update student biasa jika endpoint khusus tidak ada
    try {
      await axios.put(`${backendUrl}/students/${student.value.nis}`, {
        gender: student.value.gender
      })
      showToast(`Jenis kelamin disimpan: ${student.value.gender} ✓`, 'success')
    } catch (err2) {
      showToast('Gagal menyimpan jenis kelamin', 'error')
    }
  }
}

const hariIniText = computed(()=> new Date().toLocaleDateString('id-ID', { weekday: 'long' }))

const confirmLogout = () => { showLogoutConfirm.value = true }
const executeLogout = () => {  
  student.value.status = 'LoggedOut';
  stopReminderSystem();
  // Clear the device session lock so the student can log in on any device next time
  const savedNis = localStorage.getItem('studentNis')
  if (savedNis) {
    localStorage.removeItem(`session_device_${savedNis}`)
  }
  localStorage.setItem('isLoggedIn', 'false')
  router.push('/login')  
}

onMounted(async () => {
  document.addEventListener('visibilitychange', handleVisibilityChange);
  loadCompressionLibrary(); 
  const savedNis = localStorage.getItem('studentNis')
  if (!savedNis) { router.replace('/login'); return }
  if (!localStorage.getItem('hasSeenGuide')) showGuide.value = true

  student.value.nis = savedNis
  student.value.name = localStorage.getItem('studentName') || 'Siswa'
  student.value.class = localStorage.getItem('studentClass') || '-'
  const savedImg = localStorage.getItem(`profile_img_${savedNis}`)
  if(savedImg) profileImage.value = savedImg

  // Parallelized Initial Load
  await Promise.all([
    loadAttendance(),
    loadGpsConfig(),
    fetchJadwalFromAdmin()
  ])

  // Context-aware background sync
  let interval = setInterval(() => {
    if (document.visibilityState === 'visible') loadAttendance()
  }, 30000) 
  
  onUnmounted(() => {
    clearInterval(interval)
    stopReminderSystem()
  })
})

onUnmounted(()=>{
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
      </div>
    </div>
  </transition>

  <transition name="slide-down">
    <div v-if="showVibrateBanner && student.status === 'Belum Absen' && isNotificationEnabled && isSchoolTime" class="vibrate-banner shadow" @click="startScan">
        <div class="d-flex align-items-center gap-3">
           <div class="vibrate-icon"><i class="bi bi-bell-fill"></i></div>
           <div class="flex-grow-1">
            <h6 class="mb-0 fw-bold">Peringatan Absensi!</h6>
            <small>Halo {{ student.name }}, kamu belum absen.</small>
           </div>
           <div class="vibrate-action"><span class="badge rounded-pill bg-white text-success fw-bold">ABSEN</span></div>
        </div>
    </div>
  </transition>

  <transition name="fade">
    <div v-if="toast.show" class="custom-toast" :class="toast.type">
      <i :class="toast.type === 'success' ? 'bi bi-check-circle-fill' : 'bi bi-exclamation-triangle-fill'"></i> {{ toast.msg }}
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
      'status-hadir': displayStatus.includes('Hadir'),
      'status-telat': displayStatus.includes('Telat'),
      'status-sakit': student.status === 'Sakit',
      'status-izin': student.status === 'Izin',
      'status-alfa': student.status === 'Alfa',
      'status-pending': displayStatus === 'Belum Absen',
      'status-pulang': !isSchoolTime
    }">
      <div class="card-body p-4 text-white">
        <div class="d-flex justify-content-between opacity-75 small mb-2">
          <span>
            KEHADIRAN MAPEL: <strong class="text-white">{{ getCurrentMapel() || '-' }}</strong>
            <br>
            <span style="font-size: 0.75rem;" class="opacity-75" v-if="getCurrentGuruMapel()">
               Guru: {{ getCurrentGuruMapel() }}
            </span>
          </span>
          <i class="bi bi-shield-check fs-4"></i>
        </div>
        <h2 class="display-6 fw-bold mb-3">{{ displayStatus }}</h2>
        <div class="d-flex align-items-center">
          <div class="pulse-dot me-2"></div>
          <span class="small opacity-90">{{ hariIniText }}, {{ new Date().toLocaleDateString('id-ID') }}</span>
        </div>
      </div>
    </section>

    <div class="row g-3 mb-3">
      <div class="col-6">
        <button class="action-card btn w-100 py-4 shadow-sm" @click="startScan" :disabled="!canAbsen" :class="{ 'disabled-card': !canAbsen, 'scan-active': canAbsen }">
          <i class="bi bi-qr-code-scan d-block mb-2 fs-2"></i><span class="fw-bold small">ABSENSI</span>
        </button>
      </div>
      <div class="col-6">
        <button class="action-card btn btn-white w-100 py-4 shadow-sm" @click="scheduleVisible = true">
          <i class="bi bi-info-circle d-block mb-2 fs-2 text-primary"></i><span class="fw-bold small">INFO & JADWAL</span>
        </button>
      </div>
    </div>

    <!-- NEW POINT SISWA BUTTON ROW -->
    <div class="row g-3 mb-3">
      <div class="col-12">
        <button class="action-card btn btn-white w-100 py-4 shadow-sm bg-white" @click="pointVisible = true" style="background: linear-gradient(135deg, #ffffff 0%, #fffbeb 100%);">
          <div class="d-flex align-items-center justify-content-center gap-3">
            <div class="p-2 rounded-circle bg-warning bg-opacity-10">
              <i class="bi bi-star-fill fs-2 text-warning"></i>
            </div>
            <div class="text-start">
              <span class="fw-bold d-block text-dark" style="font-size: 1.1rem;">POINT SISWA SMKN 1 CIANJUR</span>
              <span class="badge bg-warning text-dark px-3 rounded-pill fw-bold" style="font-size: 0.9rem;">{{ student.points || 0 }} POINT</span>
            </div>
          </div>
        </button>
      </div>
    </div>

    <div class="row g-3 mb-4">
      <div class="col-12">
        <button class="action-card btn btn-white w-100 py-4 shadow-sm border-0 d-flex flex-column align-items-center justify-content-center" @click="handleSendEvidenceDirect">
          <i class="bi bi-whatsapp d-block mb-2 text-success fs-2"></i>
          <span class="fw-bold small">LAPORKAN KEHADIRAN KE GURU</span>
          <small class="text-muted mt-1" style="font-size: 10px;">Opsional melalui WhatsApp</small>
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

    <div class="mood-section bg-white p-4 rounded-4 shadow-sm border mb-4 text-center">
      <h6 class="fw-bold mb-3 text-dark">Bagaimana mood kamu hari ini?</h6>
      <div class="d-flex justify-content-between mb-3 px-1">
        <button v-for="mood in moods" :key="mood.label" @click="setMood(mood)" class="btn mood-btn" :class="{ 'active': selectedMood === mood.label }">
          <span class="fs-2">{{ mood.emoji }}</span>
          <small class="d-block text-muted mt-1" style="font-size: 0.6rem;">{{ mood.label }}</small>
        </button>
      </div>
      <transition name="fade"><div v-if="moodQuote" class="quote-box p-3 rounded-3 mt-2"><i class="bi bi-quote text-primary fs-4"></i><p class="mb-0 fst-italic small text-dark fw-semibold">{{ moodQuote }}</p></div></transition>
    </div>
  </main>

    <transition name="sheet">
    <div v-if="profileVisible" class="sheet-overlay" @click.self="profileVisible = false">
      <div class="sheet-content profile-sheet" style="border-radius: 28px 28px 0 0; max-height: 92vh; display: flex; flex-direction: column;">
        <div class="drag-handle mb-0" style="padding-top: 12px;"></div>

        <!-- Hero Profile Header -->
        <div class="profile-hero-header px-4 pb-4 pt-4" style="background: linear-gradient(135deg, #4f46e5 0%, #6366f1 60%, #818cf8 100%); border-radius: 0; flex-shrink: 0;">
          <div class="d-flex justify-content-between align-items-start mb-3">
            <span class="badge" style="background: rgba(255,255,255,0.2); color: white; font-size: 0.7rem; border-radius: 20px; padding: 5px 12px; backdrop-filter: blur(10px);">PROFIL SISWA</span>
            <button @click="profileVisible = false" class="btn btn-sm" style="background: rgba(255,255,255,0.2); color: white; border: none; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
              <i class="bi bi-x-lg" style="font-size: 0.9rem;"></i>
            </button>
          </div>
          <div class="d-flex align-items-center gap-3 mb-4">
            <div class="position-relative">
              <div class="profile-avatar-large shadow" style="border: 3px solid rgba(255,255,255,0.5); width: 80px; height: 80px; border-radius: 28px; overflow: hidden; background: white; display: flex; align-items: center; justify-content: center; font-size: 2rem; font-weight: 800; color: #4f46e5;">
                <img v-if="profileImage" :src="profileImage" class="w-100 h-100 object-fit-cover">
                <span v-else>{{ student.name?.charAt(0).toUpperCase() }}</span>
              </div>
              <label class="position-absolute" style="bottom: -5px; right: -5px; background: white; border-radius: 12px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.2); border: 2px solid #6366f1;">
                <i class="bi bi-camera-fill text-primary" style="font-size: 0.9rem;"></i>
                <input type="file" @change="handleImageUpload" class="d-none" accept="image/*">
              </label>
            </div>
            <div class="flex-grow-1">
              <h5 class="fw-bold mb-1" style="color: white; font-size: 1.25rem;">{{ student.name }}</h5>
              <div class="d-flex gap-2 flex-wrap mb-2">
                <span class="badge" style="background: rgba(255,255,255,0.2); color: white; font-size: 0.65rem; border-radius: 8px;"><i class="bi bi-person-badge me-1"></i>{{ student.nis }}</span>
                <span class="badge" style="background: rgba(255,255,255,0.2); color: white; font-size: 0.65rem; border-radius: 8px;"><i class="bi bi-building me-1"></i>{{ student.class }}</span>
                <span class="badge" style="background: rgba(255,255,255,0.2); color: white; font-size: 0.65rem; border-radius: 8px;">
                  <i :class="['bi me-1', genderDetect === 'Perempuan' ? 'bi-gender-female' : 'bi-gender-male']"></i>
                  {{ genderDetect }}
                </span>
              </div>
            </div>
          </div>

          <!-- Wallet Section Inside Profile -->
          <div class="profile-wallet-card p-3 shadow-lg" style="background: white; border-radius: 24px; display: flex; align-items: center; justify-content: space-between;">
            <div @click="profileVisible = false; pointVisible = true" style="cursor: pointer;">
              <small class="text-muted fw-bold d-block mb-1" style="font-size: 0.6rem; letter-spacing: 0.5px;">SALDO POINT</small>
              <div class="d-flex align-items-center gap-2">
                <i class="bi bi-star-fill text-warning"></i>
                <span class="fw-bold text-dark" style="font-size: 1.2rem;">{{ student.points || 0 }} <small class="text-muted" style="font-size: 0.8rem;">POINT</small></span>
              </div>
            </div>
            <div class="vr mx-3 opacity-10"></div>
            <div class="flex-grow-1 d-flex gap-2">
               <div class="text-center">
                  <small class="text-muted d-block" style="font-size: 0.55rem;">MAPEL</small>
                  <span class="badge bg-primary rounded-pill" style="font-size: 0.7rem;">{{ student.vouchersMapel || 0 }}</span>
               </div>
               <div class="text-center">
                  <small class="text-muted d-block" style="font-size: 0.55rem;">ALFA</small>
                  <span class="badge bg-danger rounded-pill" style="font-size: 0.7rem;">{{ student.vouchersAlfa || 0 }}</span>
               </div>
            </div>
            <button @click="profileVisible = false; pointVisible = true" class="btn btn-sm btn-light rounded-pill px-3 fw-bold" style="font-size: 0.7rem; background: #f1f5f9;">MARKET <i class="bi bi-chevron-right"></i></button>
          </div>
        </div>

        <!-- Scrollable Content -->
        <div class="profile-scroll-area px-4 pt-4" style="overflow-y: auto; flex: 1;">

          <!-- Stat Cards -->
          <div class="row g-2 mb-4">
            <div class="col-3">
              <div class="text-center p-2 rounded-3" style="background: linear-gradient(135deg, #d1fae5, #a7f3d0); border: 1px solid #6ee7b7;">
                <b class="d-block" style="font-size: 1.2rem; color: #065f46;">{{ attendanceStats.hadir }}</b>
                <small style="font-size: 0.65rem; color: #047857; font-weight: 600;">HADIR</small>
              </div>
            </div>
            <div class="col-3">
              <div class="text-center p-2 rounded-3" style="background: linear-gradient(135deg, #fef3c7, #fde68a); border: 1px solid #fcd34d;">
                <b class="d-block" style="font-size: 1.2rem; color: #92400e;">{{ attendanceStats.sakit }}</b>
                <small style="font-size: 0.65rem; color: #b45309; font-weight: 600;">SAKIT</small>
              </div>
            </div>
            <div class="col-3">
              <div class="text-center p-2 rounded-3" style="background: linear-gradient(135deg, #dbeafe, #bfdbfe); border: 1px solid #93c5fd;">
                <b class="d-block" style="font-size: 1.2rem; color: #1e40af;">{{ attendanceStats.izin }}</b>
                <small style="font-size: 0.65rem; color: #1d4ed8; font-weight: 600;">IZIN</small>
              </div>
            </div>
            <div class="col-3">
              <div class="text-center p-2 rounded-3" style="background: linear-gradient(135deg, #fee2e2, #fecaca); border: 1px solid #fca5a5;">
                <b class="d-block" style="font-size: 1.2rem; color: #991b1b;">{{ attendanceStats.alfa }}</b>
                <small style="font-size: 0.65rem; color: #dc2626; font-weight: 600;">ALFA</small>
              </div>
            </div>
          </div>

          <!-- Info Pribadi -->
          <div class="mb-4">
            <div class="d-flex align-items-center gap-2 mb-3">
              <div style="width: 32px; height: 32px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                <i class="bi bi-person-lines-fill" style="color: white; font-size: 0.85rem;"></i>
              </div>
              <h6 class="fw-bold text-dark mb-0" style="font-size: 0.9rem;">Informasi Akun</h6>
            </div>
            <div class="p-3 rounded-4" style="background: #f8fafc; border: 1px solid #e2e8f0;">
              
              <!-- NIS -->
              <div class="d-flex justify-content-between align-items-center py-2" style="border-bottom: 1px solid #f1f5f9;">
                <div class="d-flex align-items-center gap-2">
                  <i class="bi bi-person-badge text-primary" style="font-size: 0.85rem;"></i>
                  <small class="text-muted fw-bold" style="font-size: 0.75rem;">NIS</small>
                </div>
                <span class="fw-bold text-dark" style="font-size: 0.85rem;">{{ student.nis }}</span>
              </div>

              <!-- Kelas -->
              <div class="d-flex justify-content-between align-items-center py-2" style="border-bottom: 1px solid #f1f5f9;">
                <div class="d-flex align-items-center gap-2">
                  <i class="bi bi-mortarboard-fill text-indigo" style="font-size: 0.85rem; color: #6366f1;"></i>
                  <small class="text-muted fw-bold" style="font-size: 0.75rem;">KELAS</small>
                </div>
                <span class="fw-bold text-dark" style="font-size: 0.85rem;">{{ student.class }}</span>
              </div>

              <!-- Jenis Kelamin -->
              <div class="d-flex justify-content-between align-items-center py-2">
                <div class="d-flex align-items-center gap-2">
                  <i :class="['bi', genderDetect === 'Perempuan' ? 'bi-gender-female text-pink' : 'bi-gender-male text-info']" style="font-size: 0.85rem;"></i>
                  <small class="text-muted fw-bold" style="font-size: 0.75rem;">JENIS KELAMIN</small>
                </div>
                <div class="d-flex align-items-center gap-2">
                  <select v-model="student.gender" class="form-select form-select-sm border-0 bg-transparent fw-bold text-dark" style="font-size: 0.85rem; width: auto; padding: 2px 8px;" @change="saveGender">
                    <option value="">Pilih...</option>
                    <option value="Laki-laki">Laki-laki</option>
                    <option value="Perempuan">Perempuan</option>
                  </select>
                  <i class="bi bi-pencil-fill text-muted" style="font-size: 0.7rem;"></i>
                </div>
              </div>

            </div>
          </div>

          <!-- Evaluation Box -->
          <div v-if="student.lastEvaluation" class="evaluation-box mb-4">
            <div class="d-flex align-items-center gap-2 mb-3">
              <div style="width: 32px; height: 32px; background: linear-gradient(135deg, #3b82f6, #06b6d4); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                <i class="bi bi-award-fill" style="color: white; font-size: 0.85rem;"></i>
              </div>
              <div>
                <h6 class="fw-bold text-dark mb-0" style="font-size: 0.9rem;">Penilaian Karakter Terbaru</h6>
                <small class="text-muted" style="font-size: 0.7rem;">dari Guru/Admin</small>
              </div>
            </div>
            <div class="evaluation-list">
              <div v-for="item in evaluationSummary" :key="item.label" class="mb-2 p-3 rounded-3" style="background: #f8fafc; border: 1px solid #e2e8f0;">
                <div class="d-flex justify-content-between align-items-center mb-1">
                  <div class="d-flex align-items-center gap-2">
                    <i :class="['bi', item.icon]" style="color: #3b82f6; font-size: 0.85rem;"></i>
                    <span class="fw-bold" style="font-size: 0.82rem; color: #1e293b;">{{ item.label }}</span>
                  </div>
                  <div class="d-flex gap-1">
                    <i v-for="s in 5" :key="s" :class="['bi', s <= item.rating ? 'bi-star-fill' : 'bi-star']" :style="{ color: s <= item.rating ? '#f59e0b' : '#cbd5e1', fontSize: '10px' }"></i>
                  </div>
                </div>
                <p class="mb-0 text-muted" style="font-size: 0.74rem; line-height: 1.4;">{{ item.statement }}</p>
              </div>
            </div>
            <div v-if="student.lastEvaluation.notes" class="mt-3 p-3 rounded-3" style="background: linear-gradient(135deg, #eff6ff, #dbeafe); border: 1px solid #bfdbfe;">
              <small class="fw-bold d-block mb-1" style="color: #1d4ed8; font-size: 0.75rem;"><i class="bi bi-chat-quote-fill me-1"></i>CATATAN GURU:</small>
              <p class="fst-italic mb-0" style="font-size: 0.82rem; color: #1e293b;">"{{ student.lastEvaluation.notes }}"</p>
            </div>
          </div>

          <div v-else class="text-center py-4 mb-4 rounded-4" style="background: #f8fafc; border: 1px dashed #cbd5e1;">
            <i class="bi bi-journal-x mb-2 d-block" style="font-size: 2rem; color: #94a3b8;"></i>
            <p class="small text-muted mb-0">Belum ada penilaian karakter dari guru.</p>
          </div>

          <!-- Notification Toggle -->
          <div class="d-flex justify-content-between align-items-center p-3 rounded-3 mb-5" style="background: #f8fafc; border: 1px solid #e2e8f0;">
            <div class="d-flex align-items-center gap-3">
              <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #dbeafe, #bfdbfe); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                <i class="bi bi-bell-fill" style="color: #2563eb; font-size: 0.85rem;"></i>
              </div>
              <div>
                <h6 class="mb-0 fw-bold" style="font-size: 0.85rem;">Peringatan Getar</h6>
                <small class="text-muted" style="font-size: 0.72rem;">Ingatkan jika belum absen</small>
              </div>
            </div>
            <div class="form-check form-switch mb-0">
              <input class="form-check-input custom-switch" type="checkbox" v-model="isNotificationEnabled">
            </div>
          </div>
        </div>

        <!-- Back button -->
        <div class="px-4 pb-4" style="flex-shrink: 0;">
          <button @click="profileVisible = false" class="btn w-100 py-3 fw-bold rounded-pill shadow" style="background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; font-size: 0.9rem; letter-spacing: 0.5px;">
            <i class="bi bi-arrow-left me-2"></i>KEMBALI KE BERANDA
          </button>
        </div>
      </div>
    </div>
  </transition>

  <!-- POINT SISWA OVERLAY -->
  <transition name="sheet">
    <div v-if="pointVisible" class="sheet-overlay" @click.self="pointVisible = false">
      <div class="sheet-content profile-sheet bg-white p-0" style="border-radius: 28px 28px 0 0; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden;">
        <div class="drag-handle my-3"></div>
        
        <div class="px-4 pb-3">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h5 class="fw-bold mb-0 text-dark"><i class="bi bi-star-fill text-warning me-2"></i>Point Siswa SMKN 1 Cianjur</h5>
            <button @click="pointVisible = false" class="btn btn-sm btn-light rounded-circle"><i class="bi bi-x-lg"></i></button>
          </div>

          <!-- Balance Card -->
          <div class="text-center p-3 rounded-4 mb-3" style="background: linear-gradient(135deg, #fef3c7, #fde68a); border: 1px solid #fcd34d;">
            <h1 class="display-5 fw-bold mb-0 text-warning" style="text-shadow: 1px 1px 0px #fff;">{{ student.points || 0 }}</h1>
            <p class="text-dark fw-bold mb-0 opacity-75 small">Total Point Tersedia</p>
          </div>

          <!-- Tab Switcher -->
          <div class="d-flex bg-light p-1 rounded-pill mb-3">
            <button @click="activePointTab = 'marketplace'" class="btn btn-sm w-100 rounded-pill py-2 fw-bold" :class="activePointTab === 'marketplace' ? 'bg-white shadow-sm text-primary' : 'text-muted'">Marketplace</button>
            <button @click="activePointTab = 'history'" class="btn btn-sm w-100 rounded-pill py-2 fw-bold" :class="activePointTab === 'history' ? 'bg-white shadow-sm text-primary' : 'text-muted'">Riwayat</button>
          </div>
        </div>

        <div class="flex-grow-1 overflow-auto px-4 pb-4">
          <!-- MARKETPLACE TAB -->
          <div v-if="activePointTab === 'marketplace'">
            <div class="mb-4">
               <h6 class="fw-bold small text-muted text-uppercase mb-3">Voucher Tersedia</h6>
               
               <!-- Item 1: Voucher Mapel -->
               <div class="market-item p-3 mb-3 rounded-4 border shadow-sm">
                  <div class="d-flex justify-content-between align-items-center">
                    <div class="d-flex align-items-center">
                      <div class="item-icon bg-primary-subtle text-primary me-3"><i class="bi bi-calendar-check"></i></div>
                      <div>
                        <h6 class="mb-0 fw-bold">Voucher Absen Mapel</h6>
                        <small class="text-muted">Gunakan saat telat per mapel</small>
                      </div>
                    </div>
                    <div class="text-end">
                      <div class="badge bg-warning text-dark mb-1">10 Point</div>
                      <div class="small fw-bold text-primary mt-1">Milik: {{ student.vouchersMapel || 0 }}</div>
                    </div>
                  </div>
                  <button class="btn btn-primary w-100 mt-3 rounded-pill fw-bold" @click="buyVoucher('mapel')" :disabled="claimingVoucher">Beli Sekarang</button>
               </div>

               <!-- Item 2: Voucher Izin/Alfa -->
               <div class="market-item p-3 mb-3 rounded-4 border shadow-sm">
                  <div class="d-flex justify-content-between align-items-center">
                    <div class="d-flex align-items-center">
                      <div class="item-icon bg-danger-subtle text-danger me-3"><i class="bi bi-person-x"></i></div>
                      <div>
                        <h6 class="mb-0 fw-bold">Voucher Izin / Alfa</h6>
                        <small class="text-muted">Gantikan Alfa/Izin jadi aman</small>
                      </div>
                    </div>
                    <div class="text-end">
                      <div class="badge bg-warning text-dark mb-1">10 Point</div>
                      <div class="small fw-bold text-primary mt-1">Milik: {{ student.vouchersAlfa || 0 }}</div>
                    </div>
                  </div>
                  <button class="btn btn-danger w-100 mt-3 rounded-pill fw-bold" @click="buyVoucher('alfa')" :disabled="claimingVoucher">Beli Sekarang</button>
               </div>
            </div>
            
            <div class="alert alert-info py-3 rounded-4 border-0 shadow-sm mb-4">
               <h6 class="fw-bold mb-2"><i class="bi bi-info-circle-fill me-2"></i>Aturan Point Siswa SMKN 1 Cianjur</h6>
               <ul class="list-unstyled mb-0 small" style="line-height: 1.6;">
                 <li class="d-flex justify-content-between">
                   <span><i class="bi bi-plus-circle text-success me-2"></i>Absen Berhasil:</span>
                   <span class="fw-bold text-success">+28 Point</span>
                 </li>
                 <li class="d-flex justify-content-between">
                   <span><i class="bi bi-dash-circle text-warning me-2"></i>Terlewat Mapel:</span>
                   <span class="fw-bold text-warning">-12 Point</span>
                 </li>
                 <li class="d-flex justify-content-between">
                   <span><i class="bi bi-dash-circle text-danger me-2"></i>Izin / Alfa / Belum Absen:</span>
                   <span class="fw-bold text-danger">-27 Point</span>
                 </li>
               </ul>
               <hr class="my-2 opacity-25">
               <div class="x-small text-muted italic">
                  <p class="mb-1"><i class="bi bi-check-circle-fill text-success"></i> Point bertambah +28 saat absen berhasil.</p>
                  <p class="mb-1"><i class="bi bi-exclamation-circle-fill text-danger"></i> Point berkurang 27 untuk Izin/Alfa/Belum Absen.</p>
                  <p class="mb-0"><i class="bi bi-info-circle-fill text-primary"></i> Pinalti otomatis memotong Voucher jika tersedia.</p>
               </div>
            </div>
          </div>

          <!-- HISTORY TAB -->
          <div v-if="activePointTab === 'history'">
             <div class="d-flex justify-content-between align-items-center mb-3">
               <h6 class="fw-bold small text-muted text-uppercase mb-0">Riwayat Poin</h6>
               <button v-if="student.pointHistory && student.pointHistory.length > 0" @click="clearPointHistory" class="btn btn-sm btn-outline-danger py-1 px-3 rounded-pill fw-bold" style="font-size: 0.7rem;">
                 <i class="bi bi-trash-fill me-1"></i> Hapus Riwayat
               </button>
             </div>
             
             <div v-if="!student.pointHistory || student.pointHistory.length === 0" class="text-center py-5">
                <i class="bi bi-clock-history text-muted fs-1 opacity-50"></i>
                <p class="text-muted small mt-2">Belum ada riwayat transaksi</p>
             </div>
             <div v-else class="history-list">
                <div v-for="(h, i) in [...student.pointHistory].reverse()" :key="i" class="history-item d-flex justify-content-between align-items-center p-3 mb-2 rounded-3 border-bottom">
                   <div class="d-flex align-items-center">
                      <div class="history-icon me-3" :class="h.type === 'reward' ? 'text-success' : 'text-danger'">
                         <i :class="h.type === 'reward' ? 'bi bi-plus-circle' : 'bi bi-dash-circle'"></i>
                      </div>
                      <div>
                         <h6 class="mb-0 fw-bold small text-dark">{{ h.activity }}</h6>
                         <small class="text-muted" style="font-size: 10px;">
                            <i class="bi bi-clock me-1"></i>
                            {{ new Date(h.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }} • 
                            {{ new Date(h.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) }}
                         </small>
                      </div>
                   </div>
                   <div class="fw-bold" :class="h.points > 0 ? 'text-success' : 'text-danger'">
                      {{ h.points > 0 ? '+' : '' }}{{ h.points }}
                   </div>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  </transition>

  <transition name="sheet">
    <div v-if="scheduleVisible" class="sheet-overlay" @click.self="scheduleVisible = false">
      <div class="sheet-content">
        <div class="drag-handle mb-4"></div>
        <div class="d-flex justify-content-between align-items-center mb-4 px-1">
           <h5 class="fw-bold mb-0">Jadwal {{ hariIniText }}</h5>
           <span class="badge bg-primary-subtle text-primary px-3 rounded-pill">{{ student.class }}</span>
        </div>
        <div class="schedule-list mb-4 px-1" style="max-height: 50vh; overflow-y: auto;">
          <div v-if="jadwalHariIni.length === 0" class="text-center py-5">
            <i class="bi bi-calendar-x text-muted fs-1 mb-3 d-block"></i>
            <p class="text-muted small">Tidak ada jadwal hari ini</p>
          </div>
          <div v-for="(j, i) in jadwalHariIni" :key="i" class="schedule-item-new mb-3 p-3 rounded-4 shadow-sm" :class="{ 'current-mapel-active': j.mapel === getCurrentMapel() }">
            <div class="d-flex justify-content-between">
               <div>
                 <small class="text-muted d-block mb-1"><i class="bi bi-clock me-1"></i> {{ j.jam }}</small>
                 <h6 class="fw-bold mb-0 text-dark">{{ j.mapel }}</h6>
                 <small class="text-muted d-block mt-1" v-if="j.guru || j.teacher">
                   <i class="bi bi-person-fill me-1"></i> Guru: <strong>{{ j.guru || j.teacher }}</strong>
                 </small>
               </div>
               <div v-if="j.mapel === getCurrentMapel()" class="badge-running"><span class="pulse-red"></span><small class="fw-bold">Sedang Berlangsung</small></div>
            </div>
          </div>
        </div>
        <button @click="scheduleVisible = false" class="btn btn-indigo w-100 rounded-pill py-3 fw-bold shadow-lg">TUTUP JADWAL</button>
      </div>
    </div>
  </transition>

  <transition name="fade">
    <div v-if="qrVisible" class="qr-overlay">
      <div class="qr-container shadow-lg">
        <div class="qr-header d-flex justify-content-between align-items-center p-3">
          <h6 class="fw-bold m-0 text-white">SCAN QR GURU</h6>
          <button @click="stopScan" class="btn-close btn-close-white"></button>
        </div>
        <div id="qr-reader" class="qr-scanner"></div>
        <div class="p-3 text-center text-white"><small><i class="bi bi-info-circle me-1"></i> Pastikan QR Code berada di dalam kotak</small></div>
      </div>
    </div>
  </transition>

  <!-- SUCCESS ATTENDANCE MODAL -->
  <transition name="fade">
    <div v-if="showSuccessModal" class="guide-modal-overlay" style="z-index: 30000;">
      <div class="success-modal-card text-center p-5 shadow-lg">
        <div class="success-check-icon mb-4">
          <i class="bi bi-check2-circle"></i>
        </div>
        <h3 class="fw-bold mb-2">Absensi Berhasil!</h3>
        <p class="text-muted mb-4 px-3">Terima kasih sudah hadir tepat waktu. <strong>Point bertambah +28</strong> karena absen berhasil!</p>
        <div class="reward-pill mb-4 mx-auto">
          <i class="bi bi-star-fill text-warning me-2"></i>
          <span class="fw-bold text-primary">+28 Point Siswa SMKN 1 Cianjur</span>
        </div>
        <button @click="showSuccessModal = false" class="btn btn-primary w-100 py-3 rounded-pill fw-bold shadow">KEMBALI KE BERANDA</button>
      </div>
    </div>
  </transition>
</div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');

.success-modal-card {
  background: white;
  width: 90%;
  max-width: 380px;
  border-radius: 40px;
  position: relative;
  overflow: hidden;
}

.success-check-icon {
  font-size: 5rem;
  color: #10b981;
  animation: bounceIn 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

.reward-pill {
  width: fit-content;
  background: #f0fdf4;
  padding: 10px 20px;
  border-radius: 50px;
  border: 1px solid #10b981;
}

@keyframes bounceIn {
  from { opacity: 0; transform: scale(0.3); }
  to { opacity: 1; transform: scale(1); }
}

.app-container { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #f8fafc; min-height: 100vh; max-width: 500px; margin: 0 auto; position: relative; overflow-x: hidden; touch-action: pan-y; }
/* CSS UNTUK FIX WARNA STATUS PULANG */
.status-card {
  border-radius: 24px;
  overflow: hidden;
  transition: all 0.4s ease;
  border: none;
}
/* CSS WARNA STATUS KEHADIRAN */

/* Status Hadir: Hijau */
.status-hadir {
  background: linear-gradient(135deg, #28a745 0%, #20c997 100%) !important;
}

/* Status Sakit: Kuning/Oranye */
.status-sakit {
  background: linear-gradient(135deg, #ffc107 0%, #fd7e14 100%) !important;
}

/* Status Izin: Biru */
.status-izin {
  background: linear-gradient(135deg, #0d6efd 0%, #0dcaf0 100%) !important;
}

/* Status Alfa: Merah */
.status-alfa {
  background: linear-gradient(135deg, #dc3545 0%, #f8d7da 100%) !important;
  color: white !important;
}

/* Status Terlewat Mapel */
.status-terlewat-mapel {
  background: linear-gradient(135deg, #64748b 0%, #475569 100%) !important;
}

/* Status Belum Absen / Pending */
.status-pending {
  background: linear-gradient(135deg, #6c757d 0%, #adb5bd 100%) !important;
}

/* Di luar jam sekolah */
.status-pulang {
  background: linear-gradient(135deg, #343a40 0%, #495057 100%) !important;
}

/* Style tambahan untuk Stat Card di Profil */
.stat-card.hadir { background: #e8f5e9; color: #2e7d32; }
.stat-card.sakit { background: #fff8e1; color: #f57f17; }
.stat-card.izin { background: #e3f2fd; color: #1565c0; }
.stat-card.alfa { background: #ffebee; color: #c62828; }

/* Struktur Umum App */
.app-container {
  max-width: 500px;
  margin: 0 auto;
  min-height: 100vh;
  background-color: #f8f9fa;
  font-family: 'Inter', sans-serif;
  position: relative;
}

.status-card {
  border-radius: 24px;
  border: none;
  overflow: hidden;
  transition: all 0.3s ease;
}

.action-card {
  background: white;
  border-radius: 20px;
  border: 1px solid #eee;
  transition: transform 0.2s;
}

.action-card:active { transform: scale(0.95); }

.scan-active {
  background: #f0fdf4;
  border: 1px solid #22c55e;
  color: #15803d;
}

.disabled-card {
  opacity: 0.6;
  background: #f1f5f9;
}

/* Animasi */
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* Custom CSS lainnya untuk menunjang tampilan yang kamu buat */
.user-avatar-glow {
  width: 45px;
  height: 45px;
  background: #0d6efd;
  color: white;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
}

.banner-container {
  position: relative;
  border-radius: 20px;
  overflow: hidden;
}

.banner-scroll-wrapper {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
}

.banner-slide {
  min-width: 100%;
  height: 160px;
  scroll-snap-align: start;
  position: relative;
}

.banner-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.banner-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(transparent, rgba(0,0,0,0.4));
}

.banner-dots {
  position: absolute;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 6px;
}

.banner-dots span {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: rgba(255,255,255,0.5);
}

.banner-dots span.active {
  background: white;
  width: 15px;
  border-radius: 10px;
}

.stat-card {
  padding: 10px 5px;
  border-radius: 12px;
  text-align: center;
  display: flex;
  flex-direction: column;
}

.stat-val { font-weight: 800; font-size: 1.1rem; }
.stat-lbl { font-size: 0.65rem; font-weight: 600; }

.sheet-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  z-index: 1050;
  display: flex;
  align-items: flex-end;
}

.sheet-content {
  background: white;
  width: 100%;
  max-width: 500px;
  margin: 0 auto;
  border-top-left-radius: 30px;
  border-top-right-radius: 30px;
  padding: 20px 25px 40px;
  max-height: 85vh;
  overflow-y: auto;
}

.sheet-handle {
  width: 40px; height: 5px;
  background: #e2e8f0;
  border-radius: 10px;
  margin: 0 auto 20px;
}

/* Tambahkan style scanner agar pas di mobile */
.scanner-fullscreen {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: #000;
  z-index: 9999;
  display: flex;
  flex-direction: column;
}

#qr-reader {
  width: 100% !important;
  height: 100% !important;
  border: none !important;
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

/* MARKETPLACE & HISTORY STYLES */
.market-item {
  background: white;
  transition: all 0.2s ease;
}
.market-item:hover {
  border-color: #3b82f6 !important;
  transform: translateY(-2px);
}
.item-icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
}
.history-item {
  transition: background 0.2s;
}
.history-item:hover {
  background: #f8fafc;
}
.history-icon {
  font-size: 1.1rem;
}
.bg-primary-subtle { background-color: #e0e7ff !important; }
.bg-danger-subtle { background-color: #fee2e2 !important; }

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