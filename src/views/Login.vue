<template>
  <div class="login-page">
    <div class="bg-decoration">
      <div class="blob blob-1"></div>
      <div class="blob blob-2"></div>
      <div class="blob blob-3"></div>
    </div>

    <Transition name="fade">
      <div v-if="loading" class="premium-loader">
        <div class="loader-content">
          <div class="loader-visual">
            <div class="spinner-ring"></div>
            <img src="../andika.jvg.png" alt="Loading..." class="loader-logo">
          </div>
          <div class="loader-text">
            <h2 class="brand-name">ZIESEN</h2>
            <p class="status-msg">Memverifikasi Sesi...</p>
            <div class="loading-bar">
              <div class="bar-fill"></div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <div class="login-card shadow-2xl">
      <div class="main-logo-container">
        <div class="logo-wrapper">
          <img src="../andika.jvg.png" alt="Logo" class="brand-image">
        </div>
      </div>

      <div class="header">
        <h1>ZIESEN<span class="plus-sign"></span></h1>
        <p class="tagline">Disiplin bukan tentang aturan, tapi tentang cara menghargai waktu sendiri</p>
      </div>

      <div class="role-selector">
        <button v-for="r in ['guru', 'siswa', 'admin']" :key="r"
          type="button" :class="{ active: role === r }" @click="role = r">
          {{ r.charAt(0).toUpperCase() + r.slice(1) }}
        </button>
      </div>

      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label>
            <i class="bi" :class="role === 'siswa' ? 'bi-person-badge' : 'bi-envelope'"></i> 
            {{ role === 'siswa' ? 'Nomor NISN' : 'Alamat Email' }}
          </label>
          <div class="input-wrapper">
            <input v-model="username" :type="role === 'siswa' ? 'text' : 'email'" 
              :placeholder="role === 'siswa' ? '007xxxxxxx' : 'nama@sekolah.com'" required />
          </div>
        </div>

        <div class="form-group">
          <label><i class="bi bi-lock"></i> Kata Sandi</label>
          <div class="input-wrapper">
            <input v-model="password" type="password" placeholder="••••••••" required />
          </div>
        </div>

        <Transition name="slide-up">
          <div v-if="error" class="error-container">
            <i class="bi bi-exclamation-circle-fill"></i>
            <span>{{ error }}</span>
          </div>
        </Transition>

        <button type="submit" class="btn-primary" :disabled="loading">
          <span v-if="!loading">MASUK SEKARANG</span>
          <span v-else>MEMPROSES...</span>
        </button>
      </form>

      <div class="support-section">
        <div class="switch-role">
          <p>Bukan {{ role.charAt(0).toUpperCase() + role.slice(1) }}?</p>
          <a href="#" class="support-link" @click.prevent="role = (role === 'siswa' ? 'guru' : 'siswa')">
            Login sebagai {{ role === 'siswa' ? 'Guru' : 'Siswa' }}
          </a>
        </div>
        
        <div class="report-area">
          <p>Kendala Aplikasi?</p>
          <a href="mailto:dika70287@gmail.com" class="report-link">
            <i class="bi bi-envelope-at"></i> Hubungi Admin
          </a>
        </div>
      </div>
      
      <div class="footer-note">
        <p class="copyright">&copy; 2026 ZieSen Team. All Rights Reserved.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const backendUrl = 'https://backend-complited.vercel.app'
const router = useRouter()
const username = ref('')
const password = ref('')
const role = ref('siswa')
const error = ref('')
const loading = ref(false)

const checkAuth = () => {
  const isLoggedIn = localStorage.getItem('isLoggedIn')
  const savedRole = localStorage.getItem('role')
  
  if (isLoggedIn === 'true' && savedRole) {
    loading.value = true
    setTimeout(() => {
      if (savedRole === 'siswa') router.replace('/student-dashboard')
      else if (savedRole === 'guru') router.push('/dashboard')
      else if (savedRole === 'admin') router.push('/admin-dashboard')
      loading.value = false
    }, 1000)
  }
}

onMounted(() => {
  checkAuth()

  document.addEventListener('wheel', (e) => {
    if (e.ctrlKey) e.preventDefault();
  }, { passive: false });

  const savedUser = localStorage.getItem('remembered_user')
  const savedPass = localStorage.getItem('remembered_pass')
  const savedRole = localStorage.getItem('role')

  if (savedUser && savedPass) {
    username.value = savedUser
    password.value = savedPass
    if (savedRole) role.value = savedRole
  }
})

watch(role, (newRole) => {
  const savedRole = localStorage.getItem('role')
  if (newRole === savedRole) {
    username.value = localStorage.getItem('remembered_user') || ''
    password.value = localStorage.getItem('remembered_pass') || ''
  } else {
    username.value = ''
    password.value = ''
  }
})

const handleLogin = async () => {
  error.value = ''
  
  if (!navigator.onLine) {
    error.value = 'Mohon periksa koneksi Anda. Perangkat tidak terhubung ke internet.'
    return
  }

  loading.value = true
  try {
    let endpoint = role.value === 'guru' ? '/teachers/login' : 
                   role.value === 'siswa' ? '/students/login' : '/admins/login'

    const body = role.value === 'siswa' 
      ? { nis: username.value, password: password.value } 
      : { email: username.value, password: password.value }

    const response = await axios.post(`${backendUrl}${endpoint}`, body)
    const userData = response.data.user || response.data.data || response.data

    localStorage.setItem('isLoggedIn', 'true')
    localStorage.setItem('role', role.value)
    localStorage.setItem('remembered_user', username.value)
    localStorage.setItem('remembered_pass', password.value)

    if (role.value === 'siswa') {
      localStorage.setItem('studentName', userData.name || userData.nama || 'Siswa')
      localStorage.setItem('studentNis', userData.nis || username.value)
      localStorage.setItem('studentClass', userData.class || userData.kelas || 'RPL')
      router.push('/student-dashboard')
    } else {
      localStorage.setItem('userName', userData.name || userData.nama || 'User')
      router.push(role.value === 'guru' ? '/dashboard' : '/admin-dashboard')
    }
  } catch (err) {
    if (err.message === 'Network Error') {
      error.value = 'Gagal menghubungi server. Mohon periksa koneksi internet Anda.'
    } else {
      error.value = err.response?.data?.message || 'Data login tidak sesuai.'
    }
    loading.value = false
  }
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
@import url('https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css');

.login-page { 
  min-height: 100vh; 
  display: flex; 
  justify-content: center; 
  align-items: center; 
  background-color: #0f172a;
  background: radial-gradient(circle at top right, #1e3a8a, #0f172a);
  font-family: 'Plus Jakarta Sans', sans-serif; 
  overflow: hidden; 
  position: relative; 
  padding: 20px;
}

/* --- REFINED FLAT LOADING SCREEN --- */
.premium-loader {
  position: fixed;
  inset: 0;
  background: #0f172a;
  z-index: 9999;
  display: flex;
  justify-content: center;
  align-items: center;
}

.loader-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 25px;
}

.loader-visual {
  position: relative;
  width: 100px;
  height: 100px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.spinner-ring {
  position: absolute;
  width: 100%;
  height: 100%;
  border: 3px solid rgba(59, 130, 246, 0.1);
  border-top: 3px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loader-logo {
  width: 50px;
  height: 50px;
  object-fit: contain;
  opacity: 0.9;
}

.loader-text {
  text-align: center;
}

.brand-name {
  color: white;
  font-size: 1.2rem;
  font-weight: 800;
  letter-spacing: 3px;
  margin: 0;
}

.status-msg {
  color: #94a3b8;
  font-size: 0.8rem;
  margin: 5px 0 15px 0;
}

.loading-bar {
  width: 140px;
  height: 3px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  overflow: hidden;
  margin: 0 auto;
}

.bar-fill {
  height: 100%;
  width: 30%;
  background: #3b82f6;
  border-radius: 10px;
  animation: barProgress 1.5s infinite ease-in-out;
}

@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
@keyframes barProgress {
  0% { width: 0%; transform: translateX(-100%); }
  50% { width: 40%; }
  100% { width: 0%; transform: translateX(400%); }
}

/* --- BACKGROUND & CARD --- */
.bg-decoration { position: absolute; width: 100%; height: 100%; z-index: 0; }
.blob { position: absolute; border-radius: 50%; filter: blur(100px); opacity: 0.4; }
.blob-1 { width: 400px; height: 400px; background: #3b82f6; top: -100px; right: -50px; }
.blob-2 { width: 300px; height: 300px; background: #1e40af; bottom: -50px; left: -50px; }

.login-card { 
  width: 100%; max-width: 420px; 
  padding: 80px 25px 30px; 
  background: rgba(255, 255, 255, 0.98); 
  border-radius: 35px; z-index: 10; 
  text-align: center; position: relative;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  margin-top: 40px;
}

.main-logo-container { position: absolute; top: -55px; left: 50%; transform: translateX(-50%); z-index: 20; }
.logo-wrapper { width: 100px; height: 100px; background: white; padding: 10px; border-radius: 28px; border: 4px solid #1e40af; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 25px rgba(30, 64, 175, 0.3); }
.brand-image { width: 100%; height: 100%; object-fit: contain; }

.header h1 { margin: 0; font-size: 2rem; color: #1e3a8a; font-weight: 800; letter-spacing: -1px; }
.header .tagline { color: #64748b; font-size: 0.85rem; font-weight: 600; margin-top: 5px; line-height: 1.4; padding: 0 10px; }

.role-selector { display: flex; background: #f1f5f9; padding: 5px; border-radius: 18px; margin-bottom: 25px; }
.role-selector button { flex: 1; padding: 10px; border: none; background: transparent; color: #64748b; font-weight: 700; font-size: 0.8rem; cursor: pointer; border-radius: 14px; transition: 0.3s; }
.role-selector button.active { color: #ffffff; background: #1e40af; box-shadow: 0 8px 15px rgba(30, 64, 175, 0.2); }

.form-group { margin-bottom: 20px; text-align: left; }
.form-group label { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 0.8rem; color: #334155; font-weight: 700; }
.input-wrapper { position: relative; display: flex; align-items: center; }
.input-wrapper input { width: 100%; padding: 15px 18px; border-radius: 16px; background: #f8fafc; border: 2px solid #f1f5f9; color: #0f172a; font-size: 16px; transition: 0.3s; }
.input-wrapper input:focus { outline: none; border-color: #3b82f6; background: #ffffff; }

.btn-primary { width: 100%; padding: 16px; border-radius: 18px; border: none; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; font-weight: 800; font-size: 0.95rem; cursor: pointer; transition: 0.3s; }
.btn-primary:active { transform: scale(0.98); }

.support-section { margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 20px; }
.support-link, .report-link { color: #1e40af; text-decoration: none; font-weight: 800; font-size: 0.9rem; }
.report-link { color: #10b981; }

.error-container { background: #fef2f2; color: #dc2626; padding: 12px; border-radius: 14px; margin-bottom: 15px; font-size: 0.8rem; display: flex; align-items: center; gap: 8px; font-weight: 600; }

.copyright { color: #94a3b8; font-size: 0.7rem; font-weight: 500; margin-top: 20px; }

@media (max-width: 380px) {
  .login-card { padding: 70px 20px 25px; }
  .header h1 { font-size: 1.7rem; }
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.5s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.slide-up-enter-active, .slide-up-leave-active { transition: all 0.3s ease; }
.slide-up-enter-from, .slide-up-leave-to { opacity: 0; transform: translateY(10px); }
</style>