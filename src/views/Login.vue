<template>
  <div class="login-page">
    <div class="bg-decoration">
      <div class="blob blob-1"></div>
      <div class="blob blob-2"></div>
      <div class="blob blob-3"></div>
    </div>

    <div v-if="loading" class="overlay">
      <div class="spinner-wrapper">
        <div class="spinner"></div>
      </div>
      <p class="mt-3 fw-bold text-white">Memverifikasi Sesi...</p>
    </div>

    <div class="login-card shadow-2xl">
      <div class="main-logo-container">
        <div class="logo-wrapper">
          <img src="../andika.jvg.png" alt="Logo" class="brand-image">
        </div>
      </div>

      <div class="header">
        <h1>ZIESEN<span class="plus-sign"></span></h1>
        <p>Disiplin bukan tentang aturan, tapi tentang cara menghargai waktu sendiri</p>
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
            <i class="bi bi-eye-slash password-toggle"></i>
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
          <span v-else class="loading-flex">
            <span class="mini-spinner"></span> Memproses...
          </span>
        </button>
      </form>

      <div class="support-section">
        <p>Bukan {{ role.charAt(0).toUpperCase() + role.slice(1) }}?</p>
        <a href="#" class="support-link" @click.prevent="role = (role === 'siswa' ? 'guru' : 'siswa')">
          Login sebagai {{ role === 'siswa' ? 'Guru' : 'Siswa' }}
        </a>
      </div>
      
      <div class="footer-note">
        <small class="version"></small>
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

onMounted(() => {
  const savedUser = localStorage.getItem('remembered_user')
  const savedPass = localStorage.getItem('remembered_pass')
  const savedRole = localStorage.getItem('role')

  if (savedUser && savedPass) {
    username.value = savedUser
    password.value = savedPass
    if (savedRole) role.value = savedRole
  }

  const isLoggedIn = localStorage.getItem('isLoggedIn')
  if (isLoggedIn === 'true' && savedRole) {
    loading.value = true
    if (savedRole === 'siswa') {
      router.replace('/student-dashboard')
    } else if (savedRole === 'guru') {
      router.replace('/dashboard')
    } else if (savedRole === 'admin') {
      router.replace('/admin-dashboard')
    }
    setTimeout(() => { loading.value = false }, 500)
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
      const finalName = userData.name || userData.nama || userData.full_name || 'Siswa'
      const finalClass = userData.class || userData.kelas || 'RPL'
      const finalNis = userData.nis || username.value

      localStorage.setItem('studentName', finalName)
      localStorage.setItem('studentNis', finalNis)
      localStorage.setItem('studentClass', finalClass)
      router.push('/student-dashboard')
    } else {
      localStorage.setItem('userName', userData.name || userData.nama || 'User')
      router.push(role.value === 'guru' ? '/dashboard' : '/admin-dashboard')
    }
  } catch (err) {
    error.value = err.response?.data?.message || 'Gagal masuk. Periksa kembali data Anda.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
@import url('https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css');

/* Main Theme Colors */
:root {
  --primary-blue: #1e40af;
  --accent-blue: #3b82f6;
  --soft-blue: #eff6ff;
  --dark-text: #0f172a;
}

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

.bg-decoration { position: absolute; width: 100%; height: 100%; z-index: 0; }
.blob { position: absolute; border-radius: 50%; filter: blur(100px); opacity: 0.4; }
.blob-1 { width: 500px; height: 500px; background: #3b82f6; top: -150px; right: -100px; }
.blob-2 { width: 400px; height: 400px; background: #1e40af; bottom: -100px; left: -100px; }
.blob-3 { width: 300px; height: 300px; background: #60a5fa; top: 20%; left: 10%; opacity: 0.2; }

.login-card { 
  width: 100%; 
  max-width: 440px; 
  padding: 60px 35px 35px; 
  background: rgba(255, 255, 255, 0.98); 
  backdrop-filter: blur(20px);
  border-radius: 40px; 
  z-index: 10; 
  text-align: center;
  position: relative;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

.main-logo-container {
  position: absolute;
  top: -55px;
  left: 50%;
  transform: translateX(-50%);
}

.logo-wrapper {
  width: 110px;
  height: 110px;
  background: white; 
  padding: 12px;
  border-radius: 32px;
  border: 4px solid #1e40af;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 25px rgba(30, 64, 175, 0.3);
}

.brand-image { width: 100%; height: 100%; object-fit: contain; }

.header { margin-top: 30px; margin-bottom: 25px; }
.header h1 { 
  margin: 0; 
  font-size: 2.2rem; 
  color: #1e3a8a; 
  font-weight: 800; 
  letter-spacing: -1px;
}
.plus-sign { color: #3b82f6; }
.header p { color: #64748b; font-size: 0.9rem; font-weight: 600; margin-top: 2px; }

.role-selector { 
  display: flex; 
  background: #f1f5f9; 
  padding: 6px; 
  border-radius: 20px; 
  margin-bottom: 30px; 
  border: 1px solid #e2e8f0;
}
.role-selector button { 
  flex: 1; 
  padding: 12px; 
  border: none; 
  background: transparent; 
  color: #64748b; 
  font-weight: 700; 
  font-size: 0.85rem;
  cursor: pointer; 
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  border-radius: 16px;
}
.role-selector button.active { 
  color: #ffffff; 
  background: #1e40af; 
  box-shadow: 0 10px 15px -3px rgba(30, 64, 175, 0.3); 
}

.form-group { margin-bottom: 24px; text-align: left; }
.form-group label { 
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px; 
  font-size: 0.85rem; 
  color: #334155; 
  font-weight: 700; 
  padding-left: 5px;
}

.input-wrapper { position: relative; display: flex; align-items: center; }
.input-wrapper input { 
  width: 100%; 
  padding: 16px 20px; 
  border-radius: 18px; 
  background: #f8fafc; 
  border: 2px solid #f1f5f9; 
  color: #0f172a; 
  font-size: 1rem;
  transition: 0.3s;
}
.input-wrapper input:focus {
  outline: none;
  border-color: #3b82f6;
  background: #ffffff;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
}

.password-toggle {
  position: absolute;
  right: 20px;
  color: #94a3b8;
  cursor: pointer;
  font-size: 1.2rem;
}

.btn-primary { 
  width: 100%; 
  padding: 18px; 
  border-radius: 20px; 
  border: none; 
  background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); 
  color: white; 
  font-weight: 800; 
  font-size: 1rem;
  cursor: pointer; 
  transition: 0.4s;
  margin-top: 10px;
  box-shadow: 0 10px 25px rgba(30, 64, 175, 0.25);
  letter-spacing: 1px;
}
.btn-primary:hover {
  transform: translateY(-3px);
  box-shadow: 0 15px 30px rgba(30, 64, 175, 0.4);
  filter: brightness(1.1);
}
.btn-primary:active { transform: translateY(-1px); }

.support-section { margin-top: 35px; border-top: 1px solid #f1f5f9; padding-top: 25px; }
.support-section p { color: #64748b; font-size: 0.9rem; margin-bottom: 5px; }
.support-link { color: #1e40af; text-decoration: none; font-weight: 800; font-size: 0.95rem; }
.support-link:hover { text-decoration: underline; }

.error-container { 
  background: #fef2f2; 
  color: #dc2626; 
  padding: 14px; 
  border-radius: 16px; 
  margin-bottom: 20px; 
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid #fee2e2;
}

/* Loading Overlay */
.overlay {
  position: fixed; inset: 0; background: rgba(15, 23, 42, 0.9);
  z-index: 9999; display: flex; flex-direction: column;
  align-items: center; justify-content: center; backdrop-filter: blur(8px);
}
.spinner {
  width: 50px; height: 50px; border: 5px solid rgba(255,255,255,0.1);
  border-top: 5px solid #3b82f6; border-radius: 50%;
  animation: spin 1s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite;
}
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

.footer-note { margin-top: 30px; }
.version { color: #94a3b8; font-weight: 700; display: block; margin-bottom: 4px; }
.copyright { color: #cbd5e1; font-size: 0.75rem; font-weight: 500; margin: 0; }

.slide-up-enter-active, .slide-up-leave-active { transition: all 0.4s ease; }
.slide-up-enter-from, .slide-up-leave-to { opacity: 0; transform: translateY(20px); }
</style>