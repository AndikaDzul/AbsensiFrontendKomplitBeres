<template>
  <div class="layout">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />

    <aside :class="['sidebar', sidebarOpen ? 'show' : '']">
      <div class="sidebar-content">
        <div class="brand">
          <div class="logo-circle"><i class="bi bi-shield-check"></i></div>
          <span>ZieSen</span>
        </div>

        <div class="sidebar-user">
          <div class="avatar-lg"><i class="bi bi-person-badge"></i></div>
          <div class="user-info">
            <span class="user-name">{{ admin.name }}</span>
            <span class="user-role">Administrator</span>
          </div>
        </div>

        <ul class="menu">
          <li :class="{ active: activeMenu === 'dashboard' }" @click="activeMenu = 'dashboard'; sidebarOpen = false">
            <i class="bi bi-grid-1x2-fill"></i> Dashboard
          </li>
          <li :class="{ active: activeMenu === 'gps' }" @click="openGpsMenu(); sidebarOpen = false">
            <i class="bi bi-geo-alt-fill"></i> Pengaturan GPS
          </li>
          <li :class="{ active: activeMenu === 'siswa' }" @click="activeMenu = 'siswa'; sidebarOpen = false">
            <i class="bi bi-people-fill"></i> Data Siswa
          </li>
          <li :class="{ active: activeMenu === 'guru' }" @click="activeMenu = 'guru'; sidebarOpen = false">
            <i class="bi bi-person-video3"></i> Guru & Jadwal
          </li>
          <li :class="{ active: activeMenu === 'absensi' }" @click="activeMenu = 'absensi'; sidebarOpen = false">
            <i class="bi bi-calendar-check-fill"></i> Log Absensi
          </li>
          <li :class="{ active: activeMenu === 'laporan' }" @click="activeMenu = 'laporan'; sidebarOpen = false">
            <i class="bi bi-file-earmark-bar-graph-fill"></i> Laporan
          </li>
        </ul>

        <div class="sidebar-footer">
          <button class="btn-logout" @click="logout">
            <i class="bi bi-box-arrow-right"></i> Keluar Sistem
          </button>
        </div>
      </div>
    </aside>

    <div v-if="sidebarOpen" class="overlay" @click="sidebarOpen = false"></div>

    <div class="main">
      <header class="navbar">
        <div class="nav-left">
          <button class="menu-btn" @click="sidebarOpen = !sidebarOpen"><i class="bi bi-list"></i></button>
          <h2 class="page-title">{{ activeMenu.toUpperCase() }}</h2>
        </div>
        <div class="navbar-right">
          <div class="notification-badge"><i class="bi bi-bell"></i></div>
          <div class="user-profile">
            <span>{{ admin.name }}</span>
            <div class="avatar"><i class="bi bi-person-fill"></i></div>
          </div>
        </div>
      </header>

      <main class="content">
        <div v-if="activeMenu === 'dashboard'" class="dashboard-wrapper fade-in">
          <div class="welcome-banner">
            <h1>Selamat Datang, {{ admin.name }}!</h1>
            <p>Panel Monitoring Real-time: Pantau kehadiran siswa berdasarkan jurusan hari ini.</p>
          </div>

          <div class="stats mb-4">
            <div class="card stat-card main-stat shadow-sm">
              <div class="stat-icon blue"><i class="bi bi-people"></i></div>
              <div class="info">
                <p>Total Seluruh Siswa</p>
                <h2>{{ totalSiswa }} <span>Siswa</span></h2>
              </div>
            </div>

            <div class="card stat-card main-stat shadow-sm">
              <div class="stat-icon green"><i class="bi bi-check-all"></i></div>
              <div class="info">
                <p>Total Hadir Hari Ini</p>
                <h2>{{ totalSiswaHadir }} <span>Hadir</span></h2>
              </div>
            </div>
          </div>

          <div class="section-header-flex mb-3">
            <h3 class="section-label">Monitoring Per Jurusan</h3>
            <select v-model="filterDashboardTingkat" class="formal-select-sm">
              <option value="">Semua Tingkat</option>
              <option v-for="l in tingkatList" :key="l" :value="l">{{ l }}</option>
            </select>
          </div>

          <div class="jurusan-grid">
            <div class="card jurusan-card shadow-sm" v-for="j in jurusanList" :key="j">
              <div class="jurusan-header">
                <div class="jurusan-icon"><i class="bi bi-mortarboard-fill"></i></div>
                <h4>Jurusan {{ j }}</h4>
              </div>
              
              <div class="jurusan-stats-row">
                <div class="j-stat hadir">
                  <span class="label">Hadir</span>
                  <span class="value">{{ getSiswaByStatus(j, 'Hadir') }}</span>
                </div>
                <div class="j-stat sakit">
                  <span class="label">Sakit</span>
                  <span class="value">{{ getSiswaByStatus(j, 'Sakit') }}</span>
                </div>
                <div class="j-stat izin">
                  <span class="label">Izin</span>
                  <span class="value">{{ getSiswaByStatus(j, 'Izin') }}</span>
                </div>
                <div class="j-stat alfa">
                  <span class="label">Alfa</span>
                  <span class="value">{{ getSiswaByStatus(j, 'Alfa') }}</span>
                </div>
              </div>
              
              <div class="jurusan-footer">
                <small>Total Siswa: {{ siswa.filter(s => s.class.includes(j) && (filterDashboardTingkat ? s.class.startsWith(filterDashboardTingkat) : true)).length }}</small>
              </div>
            </div>
          </div>

          <div class="card stat-card gps-status-card mt-4 shadow-sm" @click="openGpsMenu" style="cursor: pointer; border-left: 5px solid #3b82f6;">
            <div :class="['stat-icon', configGps.lat ? 'green' : 'red']">
              <i class="bi bi-pin-map-fill"></i>
            </div>
            <div class="info">
              <p>Status Geofencing Absensi</p>
              <h3 :class="configGps.lat ? 'text-green' : 'text-red'">
                {{ configGps.lat ? 'Sistem Geofencing Aktif' : 'Sistem Nonaktif' }}
                <small style="font-size: 0.8rem; display: block; color: #64748b;">Lokasi: {{ configGps.lat }}, {{ configGps.lng }} (Radius {{ configGps.radius }}m)</small>
              </h3>
            </div>
            <div class="ms-auto"><i class="bi bi-chevron-right text-muted"></i></div>
          </div>
        </div>

        <div v-if="activeMenu === 'gps'" class="box fade-in">
          <div class="section-header">
            <div class="header-icon"><i class="bi bi-geo-alt"></i></div>
            <div>
              <h3>Konfigurasi Lokasi</h3>
              <p>Atur titik koordinat pusat sekolah dan batas jarak absensi.</p>
            </div>
          </div>
          <div id="map" class="map-container"></div>
          <div class="gps-form-container">
            <div class="form-grid">
              <div class="input-group">
                <label>Latitude</label>
                <input v-model="configGps.lat" placeholder="-6.xxx" @input="updateMapMarker" />
              </div>
              <div class="input-group">
                <label>Longitude</label>
                <input v-model="configGps.lng" placeholder="106.xxx" @input="updateMapMarker" />
              </div>
              <div class="input-group">
                <label>Radius (Meter)</label>
                <input type="number" v-model="configGps.radius" @input="updateMapCircle" />
              </div>
            </div>
            <div class="actions-group mt-3">
              <button class="btn btn-outline" @click="getCurrentLocation">
                <i class="bi bi-crosshair"></i> Deteksi Lokasi Saya
              </button>
              <button class="btn btn-primary shadow-blue" @click="saveGpsConfig">
                <i class="bi bi-cloud-check"></i> Simpan Konfigurasi
              </button>
            </div>
          </div>
        </div>

        <div v-if="activeMenu === 'siswa'" class="box fade-in">
          <div class="section-header-flex mb-3">
            <h3>Database Siswa</h3>
            <div style="display: flex; gap: 10px;">
                <select v-model="filterSiswaTingkat" class="formal-select">
                    <option value="">Semua Tingkat</option>
                    <option v-for="l in tingkatList" :key="l" :value="l">{{ l }}</option>
                </select>
                <select v-model="filterSiswaJurusan" class="formal-select">
                    <option value="">Semua Jurusan</option>
                    <option v-for="j in jurusanList" :key="j" :value="j">{{ j }}</option>
                </select>
            </div>
          </div>
          <div class="table-responsive">
            <table class="table">
              <thead><tr><th>NIS</th><th>Nama Lengkap</th><th>Kelas</th><th>Status</th><th>Aksi</th></tr></thead>
              <tbody>
                <tr v-for="s in filteredSiswaTable" :key="s.nis">
                  <td>{{ s.nis }}</td><td class="fw-bold">{{ s.name }}</td><td>{{ s.class }}</td><td v-html="statusIcon(s.status)"></td>
                  <td><button class="btn-icon delete" @click="hapusSiswa(s.nis)"><i class="bi bi-trash3"></i></button></td>
                </tr>
                <tr v-if="filteredSiswaTable.length === 0">
                    <td colspan="5" class="text-center py-4 text-muted">Data siswa tidak ditemukan.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="form-card mt-4">
            <h4>Tambah Siswa Baru</h4>
            <div class="form-grid">
              <input v-model="formSiswa.nis" placeholder="NIS">
              <input v-model="formSiswa.name" placeholder="Nama">
              <input type="password" v-model="formSiswa.password" placeholder="Password">
              <div style="display: flex; gap: 5px;">
                <select v-model="tempSiswa.level" style="flex:1">
                  <option value="">Tingkat</option>
                  <option v-for="l in tingkatList" :key="l" :value="l">{{ l }}</option>
                </select>
                <select v-model="tempSiswa.jurusan" style="flex:2">
                  <option value="">Jurusan</option>
                  <option v-for="j in jurusanList" :key="j" :value="j">{{ j }}</option>
                </select>
                <select v-model="tempSiswa.nomor" style="flex:1">
                  <option value="">No</option>
                  <option v-for="n in nomorKelasList" :key="n" :value="n">{{ n }}</option>
                </select>
              </div>
              <button class="btn btn-primary" @click="tambahSiswa">Daftar</button>
            </div>
          </div>
        </div>

        <div v-if="activeMenu === 'guru'" class="box fade-in">
          <h3>Manajemen Guru</h3>
          <div class="table-responsive">
            <table class="table">
              <thead><tr><th>Nama Guru</th><th>Email</th><th>Mapel</th><th>Aksi</th></tr></thead>
              <tbody>
                <tr v-for="g in guru" :key="g.email">
                  <td>{{ g.name }}</td><td>{{ g.email }}</td><td>{{ g.mapel }}</td>
                  <td><button class="btn-icon delete" @click="hapusGuru(g.email)"><i class="bi bi-trash3"></i></button></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="form-card mt-4 mb-5">
            <h4>Input Data Guru</h4>
            <div class="form-grid">
              <input v-model="formGuru.name" placeholder="Nama">
              <input v-model="formGuru.email" placeholder="Email">
              <input v-model="formGuru.mapel" placeholder="Mapel">
              <input type="password" v-model="formGuru.password" placeholder="Pass">
              <button class="btn btn-primary" @click="tambahGuru">Simpan</button>
            </div>
          </div>
          
          <hr class="my-5">
          
          <div class="section-header mt-4" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
            <h3>Jadwal Pelajaran</h3>
            <div style="display: flex; gap: 10px;">
              <select v-model="selectedJadwalTingkat" class="formal-select" style="min-width: 120px;">
                <option value="">Semua Tingkat</option>
                <option v-for="l in tingkatList" :key="l" :value="l">{{ l }}</option>
              </select>
              <select v-model="selectedJadwalJurusan" class="formal-select" style="min-width: 150px;">
                <option value="">Semua Jurusan</option>
                <option v-for="j in jurusanList" :key="j" :value="j">{{ j }}</option>
              </select>
            </div>
          </div>

          <div class="table-responsive">
            <table class="table">
              <thead><tr><th>Hari</th><th>Jam</th><th>Mapel</th><th>Guru</th><th>Kelas</th><th>Aksi</th></tr></thead>
              <tbody>
                <tr v-for="j in filteredJadwalList" :key="j._id">
                  <td>{{ j.hari }}</td><td>{{ j.jam }}</td><td class="fw-bold">{{ j.mapel }}</td><td>{{ j.guru }}</td><td>{{ j.kelas }}</td>
                  <td><button class="btn-icon delete" @click="hapusJadwal(j._id)"><i class="bi bi-trash3"></i></button></td>
                </tr>
                <tr v-if="filteredJadwalList.length === 0">
                  <td colspan="6" style="text-align: center; color: #94a3b8; padding: 20px;">Tidak ada jadwal untuk filter ini.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="form-card mt-4">
            <h4>Tambah Jadwal Baru</h4>
            <div class="form-grid">
              <select v-model="formJadwal.hari">
                <option value="">Pilih Hari</option>
                <option v-for="h in hariList" :key="h" :value="h">{{ h }}</option>
              </select>
              <input v-model="formJadwal.jam" placeholder="Jam (07:00 - 08:00)">
              <input v-model="formJadwal.mapel" placeholder="Nama Mapel">
              <input v-model="formJadwal.guru" placeholder="Nama Guru">
              
              <div style="display: flex; gap: 5px;">
                <select v-model="tempJadwal.level" style="flex:1">
                  <option value="">Tingkat</option>
                  <option v-for="l in tingkatList" :key="l" :value="l">{{ l }}</option>
                </select>
                <select v-model="tempJadwal.jurusan" style="flex:2">
                  <option value="">Jurusan</option>
                  <option v-for="j in jurusanList" :key="j" :value="j">{{ j }}</option>
                </select>
                <select v-model="tempJadwal.nomor" style="flex:1">
                  <option value="">No</option>
                  <option v-for="n in nomorKelasList" :key="n" :value="n">{{ n }}</option>
                </select>
              </div>
              
              <button class="btn btn-primary" @click="tambahJadwal">Simpan Jadwal</button>
            </div>
          </div>
        </div>

        <div v-if="activeMenu === 'absensi'" class="box fade-in">
          <div class="section-header-flex mb-3">
            <h3>Monitoring Absensi</h3>
            <div style="display: flex; gap: 10px; align-items: center;">
              <select v-model="filterAbsensiTingkat" class="formal-select">
                  <option value="">Semua Tingkat</option>
                  <option v-for="l in tingkatList" :key="l" :value="l">{{ l }}</option>
              </select>
              <button class="btn btn-danger btn-sm" @click="resetAbsensi">Reset Hari Ini</button>
            </div>
          </div>
          <div class="table-responsive">
            <table class="table">
              <thead><tr><th>NIS</th><th>Siswa</th><th>Kelas</th><th>Kehadiran Terakhir</th></tr></thead>
              <tbody>
                <tr v-for="s in filteredAbsensiTable" :key="s.nis">
                  <td>{{ s.nis }}</td><td>{{ s.name }}</td><td>{{ s.class }}</td><td v-html="statusIcon(s.status)"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="activeMenu === 'laporan'" class="box fade-in report-view">
          <div class="report-header-ui mb-4">
            <div class="report-title-section">
              <h3 class="formal-title">LAPORAN KEHADIRAN SISWA ZIESEN</h3>
              <p class="formal-subtitle">Rekapitulasi Kehadiran Bulanan (Senin - Jumat)</p>
            </div>
            <div class="export-controls-formal">
              <div class="filter-group-formal">
                <label>Pilih Bulan</label>
                <select v-model="selectedExportMonth" class="formal-select">
                  <option v-for="(m, idx) in namaBulanList" :key="idx" :value="idx">{{ m }}</option>
                </select>
              </div>
              <div class="filter-group-formal">
                <label>Pilih Tahun</label>
                <select v-model="selectedExportYear" class="formal-select">
                  <option v-for="y in [2025, 2026, 2027]" :key="y" :value="y">{{ y }}</option>
                </select>
              </div>
              <div class="filter-group-formal">
                <label>Tingkat</label>
                <select v-model="selectedExportTingkat" class="formal-select">
                  <option value="">Semua Tingkat</option>
                  <option v-for="l in tingkatList" :key="l" :value="l">{{ l }}</option>
                </select>
              </div>
              <div class="filter-group-formal">
                <label>Jurusan</label>
                <select v-model="selectedExportJurusan" class="formal-select">
                  <option value="">Semua Jurusan</option>
                  <option v-for="j in jurusanList" :key="j" :value="j">{{ j }}</option>
                </select>
              </div>
              <div class="filter-group-formal">
                <label>Nomor Kelas</label>
                <select v-model="selectedExportNomor" class="formal-select">
                  <option value="">Semua No</option>
                  <option v-for="n in nomorKelasList" :key="n" :value="n">{{ n }}</option>
                </select>
              </div>
              
              <button class="btn-formal-export" @click="exportToExcel">
                <i class="bi bi-file-earmark-excel"></i> Cetak ke Excel (XLSX)
              </button>
            </div>
          </div>

          <div class="table-responsive mt-4">
            <table class="table-formal">
              <thead>
                <tr>
                  <th>NIS</th>
                  <th>Nama Lengkap</th>
                  <th>Kelas</th>
                  <th>Hari</th>
                  <th>Mata Pelajaran</th>
                  <th>Sesi Jam</th>
                  <th>Status Kehadiran</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="s in filteredSiswaReport" :key="s.nis">
                  <tr v-for="(h, idx) in formatAttendanceForTable(s)" :key="idx">
                    <td class="text-secondary">{{ s.nis }}</td>
                    <td class="text-bold">{{ s.name }}</td>
                    <td>{{ s.class }}</td>
                    <td>{{ h.day }}</td>
                    <td>{{ h.mapel }}</td>
                    <td class="text-secondary">{{ h.jam }}</td>
                    <td>
                      <span class="formal-status">{{ h.status || 'Alfa' }}</span>
                    </td>
                  </tr>
                </template>
                <tr v-if="filteredSiswaReport.length === 0">
                  <td colspan="7" style="text-align: center; color: #94a3b8; padding: 40px;">Data tidak ditemukan untuk filter ini.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, computed } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'
import * as XLSX from 'xlsx'
import L from 'leaflet'

const router = useRouter()
const API = 'https://backend-complited.vercel.app'
const token = localStorage.getItem('token')
const axiosAuth = axios.create({ baseURL: API, headers: { Authorization: `Bearer ${token}` } })

// UI States
const sidebarOpen = ref(false)
const activeMenu = ref('dashboard')

// Local Filters States
const filterDashboardTingkat = ref('')
const filterSiswaTingkat = ref('')
const filterSiswaJurusan = ref('')
const filterAbsensiTingkat = ref('')

// Report Filter States
const selectedExportDay = ref('')
const selectedExportTingkat = ref('')
const selectedExportJurusan = ref('') 
const selectedExportNomor = ref('')

// NEW: Month and Year Filters (Default to current)
const now = new Date()
const selectedExportMonth = ref(now.getMonth()) 
const selectedExportYear = ref(now.getFullYear())

// Schedule Filters
const selectedJadwalJurusan = ref('')
const selectedJadwalTingkat = ref('')

const admin = ref({ name: localStorage.getItem('adminName') || 'Admin' })

const jurusanList = ['RPL', 'AKL', 'PS', 'TJKT', 'MPLB']
const tingkatList = ['X', 'XI', 'XII']
const nomorKelasList = ['1', '2', '3', '4', '5']
const hariList = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const filteredHariList = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat']
const namaBulanList = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

const siswa = ref([])
const guru = ref([])
const jadwal = ref([])
const configGps = ref({ lat: '', lng: '', radius: 50 })

const formSiswa = ref({ nis: '', name: '', class: '', password: '' })
const tempSiswa = ref({ level: '', jurusan: '', nomor: '' })
const formGuru = ref({ name: '', email: '', mapel: '', password: '' })
const formJadwal = ref({ mapel: '', guru: '', hari: '', jam: '', kelas: '' })
const tempJadwal = ref({ level: '', jurusan: '', nomor: '' })

let map = null, marker = null, circle = null

// --- COMPUTED PROPERTIES ---

const totalSiswa = computed(() => siswa.value.length)
const totalSiswaHadir = computed(() => siswa.value.filter(s => s.status === 'Hadir').length)

const getSiswaByStatus = (jurusan, status) => {
  return siswa.value.filter(s => {
    const checkStatus = (s.status || 'Alfa') === status;
    const checkJurusan = s.class.toUpperCase().includes(jurusan.toUpperCase());
    const checkTingkat = filterDashboardTingkat.value ? s.class.startsWith(filterDashboardTingkat.value) : true;
    return checkStatus && checkJurusan && checkTingkat;
  }).length;
}

const filteredSiswaTable = computed(() => {
    return siswa.value.filter(s => {
        const matchTingkat = filterSiswaTingkat.value ? s.class.startsWith(filterSiswaTingkat.value) : true
        const matchJurusan = filterSiswaJurusan.value ? s.class.includes(filterSiswaJurusan.value) : true
        return matchTingkat && matchJurusan
    })
})

const filteredAbsensiTable = computed(() => {
    return siswa.value.filter(s => {
        return filterAbsensiTingkat.value ? s.class.startsWith(filterAbsensiTingkat.value) : true
    })
})

const filteredJadwalList = computed(() => {
  return jadwal.value.filter(j => {
    const matchJurusan = selectedJadwalJurusan.value ? j.kelas.toUpperCase().includes(selectedJadwalJurusan.value.toUpperCase()) : true
    const matchTingkat = selectedJadwalTingkat.value ? j.kelas.toUpperCase().split(' ')[0] === selectedJadwalTingkat.value.toUpperCase() : true
    return matchJurusan && matchTingkat
  })
})

const filteredSiswaReport = computed(() => {
  return siswa.value.filter(s => {
    const matchTingkat = selectedExportTingkat.value ? s.class.startsWith(selectedExportTingkat.value) : true
    const matchJurusan = selectedExportJurusan.value ? s.class.toUpperCase().includes(selectedExportJurusan.value.toUpperCase()) : true
    const matchNomor = selectedExportNomor.value ? s.class.endsWith(selectedExportNomor.value) : true
    return matchTingkat && matchJurusan && matchNomor
  })
})

// --- LOGIC FUNCTIONS ---

const formatAttendanceForTable = (student) => {
  const result = []
  const daysToProcess = filteredHariList 

  daysToProcess.forEach(dayName => {
    const jadwalHariSiswa = jadwal.value.filter(j => 
      j.hari === dayName && 
      student.class.toUpperCase().includes(j.kelas.toUpperCase())
    )

    if (jadwalHariSiswa.length > 0) {
      jadwalHariSiswa.forEach((j, index) => {
        const record = student.attendanceHistory?.find(h => {
          const dateObj = h.timestamp?.$date ? new Date(h.timestamp.$date) : new Date(h.timestamp)
          const isMonthMatch = dateObj.getMonth() === selectedExportMonth.value
          const isYearMatch = dateObj.getFullYear() === selectedExportYear.value
          const isMapelMatch = h.mapel?.toLowerCase() === j.mapel.toLowerCase()
          
          let isDayMatch = false
          if (h.day) {
            isDayMatch = h.day === dayName
          } else {
            isDayMatch = hariList[dateObj.getDay()] === dayName
          }
          return isDayMatch && isMapelMatch && isMonthMatch && isYearMatch
        })

        result.push({
          day: dayName,
          jam: j.jam,
          mapel: j.mapel,
          status: record ? (record.status || 'Hadir') : 'Alfa',
        })
      })
    }
  })
  return result
}

const loadGpsFromServer = async () => {
  try {
    const res = await axiosAuth.get('/config/gps')
    if (res.data) configGps.value = { lat: res.data.lat, lng: res.data.lng, radius: res.data.radius || 50 }
  } catch (err) {}
}

const openGpsMenu = async () => {
  activeMenu.value = 'gps'
  await loadGpsFromServer()
  nextTick(() => {
    if (map) { map.remove() }
    const lat = parseFloat(configGps.value.lat) || -6.2
    const lng = parseFloat(configGps.value.lng) || 106.81
    map = L.map('map').setView([lat, lng], 17)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)
    marker = L.marker([lat, lng], { draggable: true }).addTo(map)
    circle = L.circle([lat, lng], { radius: configGps.value.radius, color: '#3742fa' }).addTo(map)
    marker.on('dragend', () => {
      const p = marker.getLatLng(); configGps.value.lat = p.lat.toFixed(6); configGps.value.lng = p.lng.toFixed(6); circle.setLatLng(p)
    })
  })
}

const updateMapCircle = () => { if (circle) circle.setRadius(configGps.value.radius) }
const updateMapMarker = () => {
  if (marker && configGps.value.lat && configGps.value.lng) {
    const pos = [parseFloat(configGps.value.lat), parseFloat(configGps.value.lng)]
    marker.setLatLng(pos); circle.setLatLng(pos); map.setView(pos, 17)
  }
}

const getCurrentLocation = () => {
  navigator.geolocation.getCurrentPosition(p => {
    configGps.value.lat = p.coords.latitude.toFixed(6); configGps.value.lng = p.coords.longitude.toFixed(6)
    const newPos = [configGps.value.lat, configGps.value.lng]; map.setView(newPos, 17); marker.setLatLng(newPos); circle.setLatLng(newPos)
  })
}

const saveGpsConfig = async () => { try { await axiosAuth.post('/config/gps', configGps.value); alert('Tersimpan!') } catch (err) {} }
const loadSiswa = async () => { try { const r = await axiosAuth.get('/students'); siswa.value = r.data; } catch(e) { console.error(e) } }

const tambahSiswa = async () => { 
  formSiswa.value.class = `${tempSiswa.value.level} ${tempSiswa.value.jurusan} ${tempSiswa.value.nomor}`.trim();
  if(!tempSiswa.value.level || !tempSiswa.value.jurusan) return alert("Lengkapi data kelas!");
  await axiosAuth.post('/students', formSiswa.value); 
  formSiswa.value = { nis: '', name: '', class: '', password: '' }; 
  tempSiswa.value = { level: '', jurusan: '', nomor: '' };
  loadSiswa() 
}

const hapusSiswa = async (nis) => { if (confirm('Hapus?')) { await axiosAuth.delete(`/students/${nis}`); loadSiswa() } }
const loadGuru = async () => { await axiosAuth.get('/teachers').then(r => guru.value = r.data) }
const tambahGuru = async () => { await axiosAuth.post('/teachers', formGuru.value); formGuru.value = { name: '', email: '', mapel: '', password: '' }; loadGuru() }
const hapusGuru = async (email) => { if (confirm('Hapus?')) { await axiosAuth.delete(`/teachers/${email}`); loadGuru() } }
const loadJadwal = async () => { await axiosAuth.get('/schedules').then(r => jadwal.value = r.data) }

const tambahJadwal = async () => { 
  formJadwal.value.kelas = `${tempJadwal.value.level} ${tempJadwal.value.jurusan} ${tempJadwal.value.nomor}`.trim();
  if(!tempJadwal.value.level || !tempJadwal.value.jurusan) return alert("Lengkapi data kelas untuk jadwal!");
  await axiosAuth.post('/schedules', formJadwal.value); 
  formJadwal.value = { mapel: '', guru: '', hari: '', jam: '', kelas: '' }; 
  tempJadwal.value = { level: '', jurusan: '', nomor: '' };
  loadJadwal() 
}

const hapusJadwal = async (id) => { if (confirm('Hapus?')) { await axiosAuth.delete(`/schedules/${id}`); loadJadwal() } }
const resetAbsensi = async () => { if(confirm("Reset semua absensi hari ini?")) { await axiosAuth.post('/students/reset'); loadSiswa(); } }

const statusIcon = status => {
  const mapColor = { 'Hadir': 'green', 'Izin': 'yellow', 'Sakit': 'blue', 'Alfa': 'red' }
  return `<span class="status-pill ${mapColor[status] || 'gray'}">${status || 'Alfa'}</span>`
}

const exportToExcel = () => {
  const year = selectedExportYear.value;
  const month = selectedExportMonth.value;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const periodStr = `${namaBulanList[month]} ${year}`;
  const targetTingkat = selectedExportTingkat.value || 'Semua';
  const targetJurusan = selectedExportJurusan.value || 'Semua Jurusan';

  // Header Row 1: Info Dasar
  const infoHeader = [
    ["LAPORAN ABSENSI SISWA ZIESEN"],
    ["Unit Kerja", ": SMK Negeri 1 (ZieSen System)"],
    ["Periode", ": " + periodStr],
    ["Tingkat/Jurusan", ": " + targetTingkat + " " + targetJurusan],
    [""], // Spacer
  ];

  // Table Columns Header
  const dateHeaders = [];
  for (let d = 1; d <= daysInMonth; d++) {
    dateHeaders.push(d);
  }
  const tableHeader = ["NIS", "NAMA LENGKAP", "KELAS", ...dateHeaders];

  const dataRows = [];
  filteredSiswaReport.value.forEach(student => {
    const row = [student.nis, student.name, student.class];
    
    // Check status for each day in the month
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month, day);
      const dayName = hariList[currentDate.getDay()];

      // Logic: Jika hari Minggu, tulis 'Minggu'
      if (dayName === 'Minggu') {
        row.push("Minggu");
        continue;
      }

      // Cari di attendanceHistory apakah ada record di tanggal ini
      const record = student.attendanceHistory?.find(h => {
        const hDate = h.timestamp?.$date ? new Date(h.timestamp.$date) : new Date(h.timestamp);
        return hDate.getDate() === day && hDate.getMonth() === month && hDate.getFullYear() === year;
      });

      if (record) {
        // Ambil inisial status
        const s = record.status || 'Hadir';
        if (s === 'Hadir') row.push('H');
        else if (s === 'Sakit') row.push('S');
        else if (s === 'Izin') row.push('I');
        else row.push('A');
      } else {
        // Jika tidak ada record dan bukan minggu, anggap belum absen/Alfa
        // Untuk hari Sabtu/Minggu yang tidak sekolah bisa dikosongkan jika perlu, 
        // tapi sesuai instruksi kita tampilkan status.
        row.push('A');
      }
    }
    dataRows.push(row);
  });

  const fullData = [...infoHeader, tableHeader, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(fullData);
  const wb = XLSX.utils.book_new();

  // Atur Lebar Kolom agar tidak terpotong
  const colWidths = [
    { wch: 15 }, // NIS
    { wch: 30 }, // NAMA
    { wch: 12 }, // KELAS
  ];
  // Lebar kolom tanggal (kecil saja)
  for (let i = 0; i < daysInMonth; i++) {
    colWidths.push({ wch: 4 });
  }
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, "Laporan_Absensi");
  XLSX.writeFile(wb, `Laporan_ZieSen_${periodStr}.xlsx`);
}

const logout = () => { localStorage.clear(); router.push('/login') }

onMounted(() => { 
  loadSiswa(); 
  loadGuru(); 
  loadJadwal(); 
  loadGpsFromServer(); 
  setInterval(loadSiswa, 10000); 
})
</script>

<style scoped>
@import "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css";
.layout { display: flex; height: 100vh; width: 100vw; overflow: hidden; background: #f8fafc; }
.sidebar { width: 280px; height: 100vh; background: #1e293b; color: #f1f2f6; z-index: 1001; transition: 0.3s; }
.brand { padding: 25px; display: flex; align-items: center; gap: 12px; font-size: 1.4rem; font-weight: 800; background: #0f172a; }
.logo-circle { width: 35px; height: 35px; background: #3b82f6; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
.sidebar-user { padding: 20px; display: flex; align-items: center; gap: 15px; border-bottom: 1px solid #334155; }
.avatar-lg { width: 50px; height: 50px; background: #334155; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
.menu { list-style: none; padding: 15px 0; flex: 1; overflow-y: auto; }
.menu li { padding: 12px 25px; margin: 4px 15px; cursor: pointer; border-radius: 8px; color: #94a3b8; display: flex; align-items: center; gap: 12px; }
.menu li.active { background: #3b82f6; color: white; }
.main { flex: 1; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
.navbar { height: 70px; background: #fff; padding: 0 30px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
.content { padding: 30px; overflow-y: auto; flex: 1; }
.welcome-banner { background: linear-gradient(135deg, #1d4ed8, #1e40af); padding: 30px; border-radius: 16px; color: white; margin-bottom: 30px; }

/* Dashboard Styling */
.section-label { font-size: 1.1rem; font-weight: 700; color: #334155; }
.main-stat { flex: 1; min-width: 300px; }
.jurusan-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }
.jurusan-card { background: white; border-radius: 16px; border: 1px solid #e2e8f0; padding: 20px; transition: 0.3s; }
.jurusan-card:hover { transform: translateY(-5px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
.jurusan-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #f1f5f9; }
.jurusan-icon { width: 40px; height: 40px; border-radius: 10px; background: #eff6ff; color: #3b82f6; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; }
.jurusan-header h4 { margin: 0; color: #1e293b; font-weight: 700; }
.jurusan-stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.j-stat { display: flex; flex-direction: column; align-items: center; padding: 10px 5px; border-radius: 10px; }
.j-stat .label { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; margin-bottom: 4px; }
.j-stat .value { font-size: 1.2rem; font-weight: 800; }
.j-stat.hadir { background: #f0fdf4; color: #166534; }
.j-stat.sakit { background: #eff6ff; color: #1e40af; }
.j-stat.izin { background: #fffbeb; color: #92400e; }
.j-stat.alfa { background: #fef2f2; color: #991b1b; }
.jurusan-footer { margin-top: 15px; padding-top: 10px; border-top: 1px dashed #e2e8f0; color: #94a3b8; text-align: right; }

.stat-card { background: white; padding: 20px; border-radius: 12px; display: flex; align-items: center; gap: 15px; border: 1px solid #e2e8f0; }
.stat-icon { width: 50px; height: 50px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; }
.stat-icon.blue { background: #eff6ff; color: #3b82f6; }
.stat-icon.green { background: #f0fdf4; color: #22c55e; }
.stat-icon.red { background: #fef2f2; color: #ef4444; }
.text-green { color: #22c55e; }
.text-red { color: #ef4444; }

/* UI Form & Table */
.box { background: white; padding: 25px; border-radius: 16px; border: 1px solid #e2e8f0; margin-bottom: 25px; }
.map-container { height: 350px; border-radius: 12px; margin-bottom: 20px; border: 4px solid #f1f5f9; z-index: 1; }
.table { width: 100%; border-collapse: collapse; }
.table th { padding: 15px; text-align: left; background: #f8fafc; color: #64748b; font-size: 0.8rem; text-transform: uppercase; }
.table td { padding: 15px; border-bottom: 1px solid #f1f5f9; }
.status-pill { padding: 5px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; display: inline-block; }
.status-pill.green { background: #dcfce7; color: #166534; }
.status-pill.red { background: #fee2e2; color: #991b1b; }
.status-pill.yellow { background: #fef9c3; color: #854d0e; }
.status-pill.blue { background: #dbeafe; color: #1e40af; }

.report-view { background: #ffffff; border: 1px solid #cbd5e1; }
.formal-title { font-weight: 800; color: #0f172a; margin-bottom: 4px; font-size: 1.5rem; }
.formal-subtitle { color: #64748b; font-size: 0.95rem; }
.export-controls-formal { display: flex; align-items: flex-end; justify-content: flex-start; gap: 20px; margin-top: 25px; padding-bottom: 20px; border-bottom: 2px solid #f1f5f9; flex-wrap: wrap; }
.filter-group-formal label { display: block; font-size: 0.75rem; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 8px; }
.formal-select { padding: 10px 15px; border: 1.5px solid #e2e8f0; border-radius: 6px; min-width: 200px; outline: none; transition: 0.2s; background: #fcfcfc; }
.btn-formal-export { background: #0f172a; color: white; border: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: 0.3s; margin-top: 5px; }
.table-formal { width: 100%; border-collapse: collapse; margin-top: 10px; }
.table-formal th { padding: 18px 15px; text-align: left; background: #f8fafc; color: #334155; font-size: 0.85rem; font-weight: 700; border-bottom: 2px solid #e2e8f0; text-transform: uppercase; }
.table-formal td { padding: 16px 15px; border-bottom: 1px solid #f1f5f9; font-size: 0.95rem; color: #1e293b; }

.btn { padding: 10px 20px; border-radius: 8px; border: none; cursor: pointer; font-weight: 600; display: inline-flex; align-items: center; gap: 8px; }
.btn-primary { background: #3b82f6; color: white; }
.btn-danger { background: #ef4444; color: white; }
.btn-outline { border: 1.5px solid #e2e8f0; background: white; color: #475569; }
.form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
.form-grid input, .form-grid select { padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; }
.btn-logout { background: #ef4444; color: white; border: none; padding: 12px; border-radius: 8px; width: calc(100% - 30px); margin: 15px; cursor: pointer; }
.fade-in { animation: fadeIn 0.4s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

.overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; }
@media (max-width: 768px) {
  .sidebar { position: fixed; left: -280px; }
  .sidebar.show { left: 0; }
  .export-controls-formal { flex-direction: column; align-items: stretch; }
  .jurusan-grid { grid-template-columns: 1fr; }
}
</style>