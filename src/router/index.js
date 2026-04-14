import { createRouter, createWebHistory } from 'vue-router'

// Views - Pastikan path ini sesuai dengan struktur folder src/views kamu
import Login from '../views/Login.vue'
import AdminDashboard from '../views/Admin.vue'
import TeacherDashboard from '../views/Dashboard.vue'
import StudentDashboard from '../views/StudentDashboard.vue'

const routes = [
  { 
    path: '/', 
    redirect: '/login' 
  },
  { 
    path: '/login', 
    name: 'Login',
    component: Login 
  },
  { 
    path: '/admin-dashboard', 
    name: 'AdminDashboard',
    component: AdminDashboard, 
    meta: { requiresAuth: true, role: 'admin' } 
  },
  { 
    path: '/dashboard', 
    name: 'TeacherDashboard',
    component: TeacherDashboard, 
    meta: { requiresAuth: true, role: 'guru' } 
  },
  { 
    path: '/student-dashboard', 
    name: 'StudentDashboard',
    component: StudentDashboard, 
    meta: { requiresAuth: true, role: 'siswa' } 
  },
  // Fallback: Jika rute tidak ditemukan, arahkan ke login
  { 
    path: '/:pathMatch(.*)*', 
    redirect: '/login' 
  }
]

const router = createRouter({
  // Gunakan createWebHistory untuk URL bersih (tanpa #)
  history: createWebHistory(),
  routes
})

// --- Router Guard ---
router.beforeEach((to, from, next) => {
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true'
  const role = localStorage.getItem('role')

  // 1. Jika belum login mencoba akses halaman protected
  if (to.meta.requiresAuth && !isLoggedIn) {
    return next('/login')
  }

  // 2. Jika sudah login tapi role tidak cocok dengan route
  if (to.meta.role && role && to.meta.role !== role) {
    if (role === 'admin') return next('/admin-dashboard')
    else if (role === 'guru') return next('/dashboard')
    else if (role === 'siswa') return next('/student-dashboard')
    else return next('/login')
  }

  // 3. Jika sudah login mencoba akses /login, redirect ke dashboard sesuai role
  if (to.path === '/login' && isLoggedIn && role) {
    if (role === 'admin') return next('/admin-dashboard')
    else if (role === 'guru') return next('/dashboard')
    else if (role === 'siswa') return next('/student-dashboard')
  }

  // 4. Lanjutkan
  next()
})

export default router