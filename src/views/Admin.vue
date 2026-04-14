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
          <li :class="{ active: activeMenu === 'penilaian' }" @click="activeMenu = 'penilaian'; sidebarOpen = false">
            <i class="bi bi-star-fill"></i> Laporan Penilaian
          </li>
          <li :class="{ active: activeMenu === 'points' }" @click="activeMenu = 'points'; sidebarOpen = false">
            <i class="bi bi-award-fill"></i> Point Siswa
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
            <div :class="['stat-icon', (configGps.loc1.lat || configGps.loc2.lat) ? 'green' : 'red']">
              <i class="bi bi-pin-map-fill"></i>
            </div>
            <div class="info">
              <p>Status Geofencing Absensi</p>
              <h3 :class="(configGps.loc1.lat || configGps.loc2.lat) ? 'text-green' : 'text-red'">
                {{ (configGps.loc1.lat || configGps.loc2.lat) ? 'Sistem Geofencing Aktif' : 'Sistem Nonaktif' }}
                <small style="font-size: 0.8rem; display: block; color: #64748b;">
                  Lokasi 1: {{ configGps.loc1.lat ? 'Aktif' : 'Belum diset' }} | Lokasi 2: {{ configGps.loc2.lat ? 'Aktif' : 'Belum diset' }}
                </small>
              </h3>
            </div>
            <div class="ms-auto"><i class="bi bi-chevron-right text-muted"></i></div>
          </div>
        </div>

        <div v-if="activeMenu === 'gps'" class="box fade-in">
          <div class="section-header">
            <div class="header-icon"><i class="bi bi-geo-alt"></i></div>
            <div>
              <h3>Konfigurasi Lokasi (Dua Titik)</h3>
              <p>Atur dua titik koordinat pusat sekolah dan batas jarak absensi.</p>
            </div>
          </div>
          <div id="map" class="map-container"></div>
          
          <div class="gps-form-container">
            <!-- Lokasi 1 -->
            <div class="location-section mb-4">
              <h5 class="text-primary mb-3"><i class="bi bi-pin-map-fill"></i> Lokasi 1 (Utama)</h5>
              <div class="form-grid">
                <div class="input-group">
                  <label>Latitude 1</label>
                  <input v-model="configGps.loc1.lat" placeholder="-6.xxx" @input="updateMapMarker(1)" />
                </div>
                <div class="input-group">
                  <label>Longitude 1</label>
                  <input v-model="configGps.loc1.lng" placeholder="106.xxx" @input="updateMapMarker(1)" />
                </div>
                <div class="input-group">
                  <label>Radius (Meter)</label>
                  <input type="number" v-model="configGps.loc1.radius" @input="updateMapCircle(1)" />
                </div>
              </div>
              <div class="actions-group mt-2">
                <button class="btn btn-outline btn-sm" @click="getCurrentLocation(1)">
                  <i class="bi bi-crosshair"></i> Deteksi Lokasi Saya (Lokasi 1)
                </button>
              </div>
            </div>

            <hr class="my-3">

            <!-- Lokasi 2 -->
            <div class="location-section mb-4">
              <h5 class="text-success mb-3"><i class="bi bi-pin-map"></i> Lokasi 2 (Alternatif)</h5>
              <div class="form-grid">
                <div class="input-group">
                  <label>Latitude 2</label>
                  <input v-model="configGps.loc2.lat" placeholder="-6.xxx" @input="updateMapMarker(2)" />
                </div>
                <div class="input-group">
                  <label>Longitude 2</label>
                  <input v-model="configGps.loc2.lng" placeholder="106.xxx" @input="updateMapMarker(2)" />
                </div>
                <div class="input-group">
                  <label>Radius (Meter)</label>
                  <input type="number" v-model="configGps.loc2.radius" @input="updateMapCircle(2)" />
                </div>
              </div>
              <div class="actions-group mt-2">
                <button class="btn btn-outline btn-sm" @click="getCurrentLocation(2)">
                  <i class="bi bi-crosshair"></i> Deteksi Lokasi Saya (Lokasi 2)
                </button>
              </div>
            </div>

            <div class="actions-group mt-3">
              <button class="btn btn-primary shadow-blue" @click="saveGpsConfig">
                <i class="bi bi-cloud-check"></i> Simpan Semua Konfigurasi
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
                  <td><code>{{ s.nis }}</code></td><td class="fw-bold">{{ s.name }}</td><td>{{ s.class }}</td><td v-html="statusIcon(s.status)"></td>
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
                  <td><code>{{ s.nis }}</code></td><td>{{ s.name }}</td><td>{{ s.class }}</td><td v-html="statusIcon(s.status)"></td>
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
                    <td class="text-secondary"><code>{{ s.nis }}</code></td>
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

        <div v-if="activeMenu === 'points'" class="box fade-in">
          <div class="section-header-flex mb-4">
            <div>
              <h3 class="formal-title"><i class="bi bi-award-fill text-warning me-2"></i> Manajemen Point Siswa</h3>
              <p class="formal-subtitle">Aturan Baru: <strong>Hadir Mapel (+28)</strong>, <strong>Alfa/Izin (-27)</strong>, <strong>Terlewat Mapel (-12)</strong>.</p>
            </div>
          </div>
          
          <div class="alert alert-info border-0 shadow-sm d-flex justify-content-between align-items-center rounded-4 mb-4" style="background: linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%);">
             <div>
               <h6 class="fw-bold mb-1 text-primary"><i class="bi bi-gift-fill me-2"></i>Kode Token Rahasia (Voucher Gratis Siswa)</h6>
               <p class="mb-0 small text-muted">Admin/Guru dapat memberikan kode <strong>ZIESEN-BISA</strong> atau <strong>VOUCHER-ADMIN</strong> kepada siswa. Siswa dapat memasukkan kode ini di Menu Marketplace untuk mengklaim 1 Voucher Mapel dan 1 Voucher Alfa gratis.</p>
             </div>
          </div>
          
          <div class="row g-4 mb-4">
             <div class="col-md-12">
                <div class="table-responsive bg-white border rounded-4 p-4 shadow-sm" style="max-height: 700px; overflow-y: auto;">
                    <div class="d-flex justify-content-between mb-4 align-items-center flex-wrap gap-3">
                        <div>
                           <h5 class="fw-bold mb-1 text-dark">Data Saldo Point & Voucher</h5>
                           <p class="text-muted small mb-0">Klik pada angka untuk mengedit saldo secara langsung.</p>
                        </div>
                        <div class="d-flex gap-3 align-items-center flex-wrap">
                            <div class="input-group input-group-sm" style="width: 250px;">
                                <span class="input-group-text bg-white border-end-0"><i class="bi bi-search text-muted"></i></span>
                                <input v-model="searchQueryPoints" type="text" class="form-control border-start-0" placeholder="Cari Nama / NIS...">
                            </div>
                            <select v-model="filterSiswaKelasPoints" class="formal-select py-1 px-2" style="width: auto; min-width: 140px;">
                                <option value="">Semua Tingkat</option>
                                <option v-for="l in tingkatList" :key="l" :value="l">Kelas {{ l }}</option>
                            </select>
                            <button class="btn btn-primary fw-bold shadow-sm" @click="savePoints">
                               <i class="bi bi-cloud-arrow-up-fill me-1"></i> Simpan Ke Database
                            </button>
                        </div>
                    </div>

                  <table class="table table-hover align-middle border-top">
                    <thead class="table-light">
                       <tr>
                        <th style="width: 250px;">Identitas Siswa</th>
                        <th>Kelas</th>
                        <th class="text-center" style="width: 100px;">Point</th>
                        <th class="text-center" style="width: 110px;">Voucher. Mapel</th>
                        <th class="text-center" style="width: 110px;">Voucher. Alfa</th>
                        <th class="text-center" style="width: 220px;">Aksi Pinalti</th>
                        <th class="text-center">Edit</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="s in filteredSiswaPoints" :key="s.nis" class="point-row">
                        <td>
                           <div class="d-flex align-items-center gap-2">
                              <div class="avatar-sm bg-light text-primary rounded-circle d-flex align-items-center justify-content-center fw-bold" style="width:32px; height:32px; font-size: 0.75rem;">
                                 {{ s.name[0] }}
                              </div>
                              <div>
                                 <span class="fw-bold d-block text-dark mb-1" style="font-size: 0.95rem;">{{ s.name }}</span>
                                 <code class="text-primary fw-bold" style="font-size: 0.8rem; letter-spacing: 0.5px;">{{ s.nis }}</code>
                              </div>
                           </div>
                        </td>
                        <td><span class="badge bg-light text-dark border">{{ s.class }}</span></td>
                        <td class="text-center">
                           <input type="number" v-model.number="s.points" class="form-control form-control-sm text-center fw-bold border-0 bg-light rounded-pill" style="width: 70px;">
                        </td>
                        <td class="text-center">
                           <div class="input-group input-group-sm">
                              <span class="input-group-text bg-primary-subtle text-primary border-0"><i class="bi bi-bookmark-check"></i></span>
                              <input type="number" v-model.number="s.vouchersMapel" class="form-control text-center fw-bold border-primary-subtle" style="width: 50px;">
                           </div>
                        </td>
                        <td class="text-center">
                           <div class="input-group input-group-sm">
                              <span class="input-group-text bg-danger-subtle text-danger border-0"><i class="bi bi-shield-x"></i></span>
                              <input type="number" v-model.number="s.vouchersAlfa" class="form-control text-center fw-bold border-danger-subtle" style="width: 50px;">
                           </div>
                        </td>
                        <td class="text-center">
                           <div class="d-flex gap-2 justify-content-center">
                             <button class="btn btn-xs btn-success rounded-pill px-3 py-1 fw-bold" @click="editStudentPoints(s.nis, 28)">+28 Hadir</button>
                             <button class="btn btn-xs btn-warning rounded-pill px-2 py-1 fw-bold" @click="triggerPenalty(s.nis, 'mapel')">
                                -12 Mapel
                             </button>
                             <button class="btn btn-xs btn-danger rounded-pill px-2 py-1 fw-bold" @click="triggerPenalty(s.nis, 'alfa')">
                                -27 Alfa
                             </button>
                           </div>
                        </td>
                        <td class="text-center">
                           <div class="btn-group btn-group-sm">
                              <button class="btn btn-outline-secondary" @click="editStudentVouchersMapel(s.nis, -1)"><i class="bi bi-dash"></i></button>
                              <button class="btn btn-outline-primary" @click="editStudentVouchersMapel(s.nis, 1)"><i class="bi bi-plus"></i></button>
                           </div>
                        </td>
                      </tr>
                      <tr v-if="filteredSiswaPoints.length === 0">
                         <td colspan="7" class="text-center py-5 text-muted">
                            <i class="bi bi-search fs-2 d-block mb-2 opacity-25"></i>
                            Siswa tidak ditemukan.
                         </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
             </div>
          </div>
        </div>

        <div v-if="activeMenu === 'penilaian'" class="box fade-in">
          <div class="section-header-flex mb-4">
            <div>
              <h3 class="formal-title"><i class="bi bi-star-fill text-warning me-2"></i> Laporan Penilaian Siswa</h3>
              <p class="formal-subtitle">Evaluasi Kompetensi dan Sikap Siswa</p>
            </div>
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
          
          <div class="mb-4 bg-white border p-4 shadow-sm rounded-4">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <div>
                <span class="fw-bold text-dark d-block" style="font-size: 1rem;">GRAFIK RATA-RATA KOMPETENSI KELAS</span>
                <small class="text-muted">Berdasarkan filter siswa yang ditampilkan di bawah</small>
              </div>
              <i class="bi bi-hexagon-half text-primary fs-4"></i>
            </div>
            <div style="height: 300px; position: relative;">
               <canvas id="adminOverallRatingChart"></canvas>
            </div>
          </div>

          <div class="table-responsive">
            <table class="table-formal">
              <thead><tr><th>NIS</th><th>Nama Lengkap</th><th>Kelas</th><th class="text-center">Aksi</th></tr></thead>
              <tbody>
                <tr v-for="s in filteredSiswaTable" :key="s.nis">
                  <td class="text-secondary"><code>{{ s.nis }}</code></td>
                  <td class="fw-bold">{{ s.name }}</td>
                  <td>{{ s.class }}</td>
                  <td class="text-center">
                    <button @click="openRatingModal(s)" class="btn btn-primary btn-sm rounded-pill px-3 py-1 shadow-sm" style="font-size: 0.8rem; font-weight: bold;">
                      <i class="bi bi-star-fill me-1"></i> NILAI / LIHAT 
                    </button>
                  </td>
                </tr>
                <tr v-if="filteredSiswaTable.length === 0">
                    <td colspan="4" class="text-center py-4 text-muted">Data siswa tidak ditemukan.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>

    <!-- Rating Modal -->
    <Transition name="fade">
      <div v-if="showRatingModal" class="rating-modal-overlay" @click.self="showRatingModal=false">
        <div class="rating-modal-content">
          <div class="d-flex justify-content-between align-items-start mb-4">
            <div class="d-flex align-items-center gap-3">
              <div class="student-initial bg-primary text-white" style="width: 50px; height: 50px; font-size: 1.2rem; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                {{ selectedStudentForRating?.name[0] }}
              </div>
              <div>
                <h5 class="fw-bold mb-0">{{ selectedStudentForRating?.name }}</h5>
                <span class="badge bg-light text-muted border" style="font-size: 0.8rem;">{{ selectedStudentForRating?.nis }} - {{ selectedStudentForRating?.class }}</span>
              </div>
            </div>
            <div>
              <button v-if="isEditing" @click="deleteEvaluation" class="btn btn-danger btn-sm rounded-circle p-2 me-2 shadow-sm">
                <i class="bi bi-trash3-fill"></i>
              </button>
              <button @click="showRatingModal=false" class="btn btn-light btn-sm rounded-circle p-2 border shadow-sm" style="color: #64748b;">
                <i class="bi bi-x-lg"></i>
              </button>
            </div>
          </div>

          <div class="scroll-penilaian px-1" style="max-height: 60vh; overflow-y: auto;">
            <div class="mb-4 bg-white border p-3 shadow-sm rounded-3">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <span class="fw-bold text-muted" style="font-size: 0.8rem;">GRAFIK KOMPETENSI ({{ selectedStudentForRating?.name }})</span>
                <i class="bi bi-hexagon-half text-primary"></i>
              </div>
              <div style="height: 250px; position: relative;"><canvas id="adminRatingChart"></canvas></div>
            </div>

            <div class="rating-grid">
              <div v-for="crit in ratingCriteria" :key="crit.key" class="crit-item mb-3 p-3 border rounded-3 bg-white shadow-sm transition-all">
                <div class="d-flex align-items-center justify-content-between mb-2">
                  <div class="d-flex align-items-center gap-2">
                    <div class="bg-primary text-white rounded p-2 d-flex align-items-center justify-content-center" style="width: 35px; height: 35px;">
                      <i :class="['bi', crit.icon]"></i>
                    </div>
                    <span class="fw-bold" style="font-size: 0.9rem;">{{ crit.label }}</span>
                  </div>
                  <span class="badge bg-primary text-white px-3 py-1 rounded-pill">{{ evaluationForm[crit.key] }}/5</span>
                </div>
                <textarea v-model="crit.statement" class="form-control mb-3 text-muted" style="font-size: 0.8rem; line-height: 1.4; border: 1px dashed #cbd5e1; resize: none;" rows="2" placeholder="Ubah teks kriteria penilaian ini..."></textarea>
                <div class="d-flex justify-content-between align-items-center bg-light p-2 rounded">
                    <div class="d-flex gap-2">
                      <i v-for="star in 5" :key="star" 
                        @click="evaluationForm[crit.key] = star" 
                        :class="['bi fs-5 cursor-pointer', star <= evaluationForm[crit.key] ? 'bi-star-fill text-warning' : 'bi-star text-secondary opacity-25']" 
                        style="transition: 0.2s;"></i>
                    </div>
                    <span class="fw-bold text-primary" style="font-size: 0.85rem;">{{ evaluationForm[crit.key] == 5 ? 'Sangat Baik' : evaluationForm[crit.key] >= 3 ? 'Baik' : 'Cukup' }}</span>
                </div>
              </div>
            </div>

            <div class="mb-2 mt-4">
              <label class="fw-bold text-muted mb-2 ps-1" style="font-size: 0.85rem;">
                <i class="bi bi-pencil-square me-1"></i> CATATAN OBSERVASI
              </label>
              <textarea v-model="evaluationForm.notes" 
                class="form-control rounded-3 bg-white border shadow-sm p-3" 
                rows="3" 
                style="font-size: 0.9rem;"
                placeholder="Berikan masukan atau catatan khusus untuk siswa ini..."></textarea>
            </div>
          </div>

          <div class="d-flex gap-2 pt-4 border-top mt-3">
            <button @click="showRatingModal=false" class="btn btn-light flex-grow-1 py-3 fw-bold rounded-pill">BATAL</button>
            <button @click="submitEvaluation" class="btn btn-primary flex-grow-1 py-3 fw-bold shadow-sm rounded-pill">
              <i class="bi bi-cloud-check-fill me-2"></i> {{ isEditing ? 'UPDATE NILAI' : 'SIMPAN NILAI' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, computed, watch } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'
import * as XLSX from 'xlsx'
import L from 'leaflet'
import Chart from 'chart.js/auto'

const router = useRouter()
const API = 'https://backendd-andika-beres.vercel.app/api'
const token = localStorage.getItem('token')
const axiosAuth = axios.create({ baseURL: API, headers: { Authorization: `Bearer ${token}` } })

// UI States
const sidebarOpen = ref(false)
const activeMenu = ref('dashboard')

// NEW STATE FOR POINTS
const editStudentPoints = (nis, amount) => {
   const s = siswa.value.find(x => x.nis === nis)
   if (s) {
       s.points = (s.points !== undefined ? s.points : 100) + amount
   }
}
const editStudentVouchers = (nis, amount) => {
   const s = siswa.value.find(x => x.nis === nis)
   if (s) {
       s.vouchers = (s.vouchers || 0) + amount
       if (s.vouchers < 0) s.vouchers = 0
   }
}
const editStudentVouchersMapel = (nis, amount) => {
   const s = siswa.value.find(x => x.nis === nis)
   if (s) {
       s.vouchersMapel = (s.vouchersMapel || 0) + amount
       if (s.vouchersMapel < 0) s.vouchersMapel = 0
   }
}
const editStudentVouchersAlfa = (nis, amount) => {
   const s = siswa.value.find(x => x.nis === nis)
   if (s) {
       s.vouchersAlfa = (s.vouchersAlfa || 0) + amount
       if (s.vouchersAlfa < 0) s.vouchersAlfa = 0
   }
}
const triggerPenalty = async (nis, type) => {
   const s = siswa.value.find(x => x.nis === nis)
   if (!s) return;

   const desc = type === 'mapel' ? prompt('Nama Mapel (Kosongkan untuk default):', '') : 'Denda Izin/Alfa/Belum Absen';
   if (type === 'mapel' && desc === null) return; // Cancelled prompt

   try {
     const res = await axiosAuth.post(`/students/${nis}/absence-penalty`, { 
        type: type, 
        description: type === 'mapel' && desc ? `Terlewat Mapel: ${desc}` : desc 
     });
     
     // Update local state
     const idx = siswa.value.findIndex(x => x.nis === nis);
     if (idx !== -1) {
        siswa.value[idx] = res.data;
     }
     
     alert(`Berhasil menerapkan pinalti ${type === 'mapel' ? '-12' : '-27'} untuk ${s.name}`);
   } catch(err) {
     console.error(err);
     alert('Gagal menerapkan pinalti. Pastikan koneksi server aman.');
   }
}
const applyAbsencePenalty = (nis) => triggerPenalty(nis, 'alfa');
const savePoints = async () => {
   try {
      const payload = siswa.value.map(s => ({
         nis: s.nis,
         points: Number(s.points) || 0,
         vouchers: Number(s.vouchers) || 0,
         vouchersMapel: Number(s.vouchersMapel) || 0,
         vouchersAlfa: Number(s.vouchersAlfa) || 0
      }))
      await axiosAuth.post('/students/bulk-update-points', { data: payload });
      alert('Berhasil menyimpan data point dan voucher ke database!');
      loadSiswa();
   } catch(err) {
      console.error(err);
      alert('Gagal menyimpan data');
   }
}
const filterSiswaKelasPoints = ref('')
const searchQueryPoints = ref('')
const filteredSiswaPoints = computed(() => {
    return siswa.value.filter(s => {
        const matchKelas = filterSiswaKelasPoints.value ? s.class.startsWith(filterSiswaKelasPoints.value) : true
        const matchSearch = searchQueryPoints.value 
            ? s.name.toLowerCase().includes(searchQueryPoints.value.toLowerCase()) || s.nis.includes(searchQueryPoints.value)
            : true
        return matchKelas && matchSearch
    })
})

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

// ===== STATE PENILAIAN =====
const showRatingModal = ref(false)
const selectedStudentForRating = ref(null)
const isEditing = ref(false)
const currentEvaluationId = ref(null)
let ratingChart = null
let overallChart = null

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

const admin = ref({ name: localStorage.getItem('adminName') || 'Admin' })

const jurusanList = ['RPL', 'PPLG-RPL', 'AKKUL', 'AKKUL-AK', 'AKKUL-PB', 'PS', 'PS-BR', 'PPLG','BD-PS', 'MPLB-MP', 'MPLB-ML','TJKT', 'TJKT-TK', 'MPLB' ]
const tingkatList = ['X', 'XI', 'XII']
const nomorKelasList = ['1', '2', '3', '4', '5']
const hariList = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const filteredHariList = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat']
const namaBulanList = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

const siswa = ref([])
const guru = ref([])
const jadwal = ref([])

// MODIFIED: GPS Config now supports 2 locations
const configGps = ref({
  loc1: { lat: '', lng: '', radius: 50 },
  loc2: { lat: '', lng: '', radius: 50 }
})

const formSiswa = ref({ nis: '', name: '', class: '', password: '' })
const tempSiswa = ref({ level: '', jurusan: '', nomor: '' })
const formGuru = ref({ name: '', email: '', mapel: '', password: '' })
const formJadwal = ref({ mapel: '', guru: '', hari: '', jam: '', kelas: '' })
const tempJadwal = ref({ level: '', jurusan: '', nomor: '' })

let map = null
let marker1 = null, circle1 = null
let marker2 = null, circle2 = null

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

// ================= CHART & PENILAIAN LOGIC =================
const initChart = () => {
  const ctx = document.getElementById('adminRatingChart')
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
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderColor: 'rgb(59, 130, 246)',
        pointBackgroundColor: 'rgb(59, 130, 246)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgb(59, 130, 246)',
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

const initOverallChart = () => {
  const ctx = document.getElementById('adminOverallRatingChart')
  if (!ctx) return
  if (overallChart) overallChart.destroy()

  const studentsWithEvals = filteredSiswaTable.value.filter(s => s.lastEvaluation)
  
  let averages = ratingCriteria.value.map(() => 0)
  
  if (studentsWithEvals.length > 0) {
    averages = ratingCriteria.value.map(crit => {
      const sum = studentsWithEvals.reduce((acc, curr) => acc + (curr.lastEvaluation[crit.key]?.rating || 0), 0)
      return (sum / studentsWithEvals.length).toFixed(1)
    })
  }

  overallChart = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ratingCriteria.value.map(c => c.label),
      datasets: [{
        label: 'Rata-rata Skor Kompetensi',
        data: averages,
        fill: true,
        backgroundColor: 'rgba(34, 197, 94, 0.2)', // Green theme for overall class
        borderColor: 'rgb(34, 197, 94)',
        pointBackgroundColor: 'rgb(34, 197, 94)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgb(34, 197, 94)',
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
      plugins: { 
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              return ` Rata-rata: ${context.raw} / 5 (${studentsWithEvals.length} Siswa dinilai)`;
            }
          }
        }
      }
    }
  })
}

watch(filteredSiswaTable, () => {
    if (activeMenu.value === 'penilaian') {
        nextTick(() => initOverallChart())
    }
})

watch(activeMenu, (newVal) => {
    if(newVal === 'penilaian') {
        nextTick(() => initOverallChart())
    }
})

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
    const res = await axiosAuth.get(`/evaluations/student/${student.nis}`)
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
    teacherName: admin.value.name || 'Admin', // Ensure a fallback is provided just in case
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
    if (isEditing.value) await axiosAuth.put(`/evaluations/${currentEvaluationId.value}`, payload)
    else await axiosAuth.post(`/evaluations`, payload)
    
    // Explicitly update the frontend state to reflect new data
    const idx = siswa.value.findIndex(s => s.nis === payload.studentNis)
    if (idx !== -1) {
       siswa.value[idx].lastEvaluation = payload
    }
    
    alert('Berhasil menyimpan nilai!')
    showRatingModal.value = false
  } catch (err) { alert('Gagal menyimpan nilai') }
}

const deleteEvaluation = async () => {
  if (!confirm('Hapus penilaian?')) return
  try {
    await axiosAuth.delete(`/evaluations/${currentEvaluationId.value}`)
    alert('Penilaian dihapus')
    showRatingModal.value = false
  } catch (err) { alert('Gagal hapus penilaian') }
}

const loadGpsFromServer = async () => {
  try {
    const res = await axiosAuth.get('/config/gps')
    if (res.data) {
      // Mapping untuk support 2 lokasi (backward compatible dengan lama)
      configGps.value = {
        loc1: {
          lat: res.data.loc1?.lat || res.data.lat || '',
          lng: res.data.loc1?.lng || res.data.lng || '',
          radius: res.data.loc1?.radius || res.data.radius || 50
        },
        loc2: {
          lat: res.data.loc2?.lat || '',
          lng: res.data.loc2?.lng || '',
          radius: res.data.loc2?.radius || 50
        }
      }
    }
  } catch (err) {
    console.error("Gagal memuat konfigurasi GPS", err)
  }
}

const openGpsMenu = async () => {
  activeMenu.value = 'gps'
  await loadGpsFromServer()
  nextTick(() => {
    if (map) { map.remove(); map = null; }

    // Determine center point
    let centerLat = -6.2;
    let centerLng = 106.81;
    
    if (configGps.value.loc1.lat) {
      centerLat = parseFloat(configGps.value.loc1.lat);
      centerLng = parseFloat(configGps.value.loc1.lng);
    } else if (configGps.value.loc2.lat) {
      centerLat = parseFloat(configGps.value.loc2.lat);
      centerLng = parseFloat(configGps.value.loc2.lng);
    }

    map = L.map('map').setView([centerLat, centerLng], 17)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)

    // Init Marker & Circle Lokasi 1 (Biru)
    if (configGps.value.loc1.lat) {
      const pos1 = [parseFloat(configGps.value.loc1.lat), parseFloat(configGps.value.loc1.lng)]
      marker1 = L.marker(pos1, { draggable: true }).addTo(map).bindPopup("Lokasi 1")
      circle1 = L.circle(pos1, { radius: configGps.value.loc1.radius, color: '#3b82f6' }).addTo(map)
      marker1.on('dragend', (e) => {
        const p = e.target.getLatLng()
        configGps.value.loc1.lat = p.lat.toFixed(6)
        configGps.value.loc1.lng = p.lng.toFixed(6)
        circle1.setLatLng(p)
      })
    } else {
      // Default empty marker if needed
      marker1 = L.marker([centerLat, centerLng], { draggable: true, opacity: 0.5 }).addTo(map)
      marker1.on('dragend', (e) => {
        const p = e.target.getLatLng()
        configGps.value.loc1.lat = p.lat.toFixed(6)
        configGps.value.loc1.lng = p.lng.toFixed(6)
        if(circle1) circle1.setLatLng(p)
      })
    }

    // Init Marker & Circle Lokasi 2 (Hijau)
    if (configGps.value.loc2.lat) {
      const pos2 = [parseFloat(configGps.value.loc2.lat), parseFloat(configGps.value.loc2.lng)]
      marker2 = L.marker(pos2, { draggable: true }).addTo(map).bindPopup("Lokasi 2")
      circle2 = L.circle(pos2, { radius: configGps.value.loc2.radius, color: '#22c55e' }).addTo(map)
      marker2.on('dragend', (e) => {
        const p = e.target.getLatLng()
        configGps.value.loc2.lat = p.lat.toFixed(6)
        configGps.value.loc2.lng = p.lng.toFixed(6)
        circle2.setLatLng(p)
      })
    } else {
       // Create empty marker for loc 2 if needed, or just leave it
       marker2 = L.marker([centerLat, centerLng], { draggable: true, opacity: 0.5 }).addTo(map)
       marker2.on('dragend', (e) => {
        const p = e.target.getLatLng()
        configGps.value.loc2.lat = p.lat.toFixed(6)
        configGps.value.loc2.lng = p.lng.toFixed(6)
        if(circle2) circle2.setLatLng(p)
      })
    }
  })
}

const updateMapCircle = (locId) => {
  if (locId === 1 && circle1) circle1.setRadius(configGps.value.loc1.radius)
  if (locId === 2 && circle2) circle2.setRadius(configGps.value.loc2.radius)
}

const updateMapMarker = (locId) => {
  if (locId === 1 && marker1 && configGps.value.loc1.lat && configGps.value.loc1.lng) {
    const pos = [parseFloat(configGps.value.loc1.lat), parseFloat(configGps.value.loc1.lng)]
    marker1.setLatLng(pos)
    if (circle1) circle1.setLatLng(pos)
    map.setView(pos, 17)
  }
  if (locId === 2 && marker2 && configGps.value.loc2.lat && configGps.value.loc2.lng) {
    const pos = [parseFloat(configGps.value.loc2.lat), parseFloat(configGps.value.loc2.lng)]
    marker2.setLatLng(pos)
    if (circle2) circle2.setLatLng(pos)
    map.setView(pos, 17)
  }
}

const getCurrentLocation = (locId) => {
  navigator.geolocation.getCurrentPosition(p => {
    const lat = p.coords.latitude.toFixed(6)
    const lng = p.coords.longitude.toFixed(6)
    const newPos = [lat, lng]
    
    if (locId === 1) {
      configGps.value.loc1.lat = lat
      configGps.value.loc1.lng = lng
      if(marker1) marker1.setLatLng(newPos)
      if(circle1) circle1.setLatLng(newPos)
    } else {
      configGps.value.loc2.lat = lat
      configGps.value.loc2.lng = lng
      if(marker2) marker2.setLatLng(newPos)
      if(circle2) circle2.setLatLng(newPos)
    }
    
    map.setView(newPos, 17)
  })
}

const saveGpsConfig = async () => {
  try {
    // Backend GPS format is simply { lat, lng, radius, loc1, loc2 }
    const payload = {
       lat: configGps.value.loc1.lat,
       lng: configGps.value.loc1.lng,
       radius: configGps.value.loc1.radius,
       loc1: {
          lat: configGps.value.loc1.lat,
          lng: configGps.value.loc1.lng,
          radius: Number(configGps.value.loc1.radius)
       },
       loc2: {
          lat: configGps.value.loc2.lat,
          lng: configGps.value.loc2.lng,
          radius: Number(configGps.value.loc2.radius)
       }
    }
    
    const res = await axiosAuth.post('/config/gps', payload)
    if (res.data) {
       alert('Konfigurasi GPS (2 Lokasi) Tersimpan!')
    }
  } catch (err) {
    console.error(err)
    alert('Gagal menyimpan konfigurasi')
  }
}

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

  const infoHeader = [
    ["LAPORAN ABSENSI SISWA ZIESEN"],
    ["Unit Kerja", ": SMK Negeri 1 (ZieSen System)"],
    ["Periode", ": " + periodStr],
    ["Tingkat/Jurusan", ": " + targetTingkat + " " + targetJurusan],
    [""],
  ];

  const dateHeaders = [];
  for (let d = 1; d <= daysInMonth; d++) {
    dateHeaders.push(d);
  }
  const tableHeader = ["NIS", "NAMA LENGKAP", "KELAS", ...dateHeaders];

  const dataRows = [];
  filteredSiswaReport.value.forEach(student => {
    const row = [student.nis, student.name, student.class];
    
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month, day);
      const dayName = hariList[currentDate.getDay()];

      if (dayName === 'Minggu') {
        row.push("Minggu");
        continue;
      }

      const record = student.attendanceHistory?.find(h => {
        const hDate = h.timestamp?.$date ? new Date(h.timestamp.$date) : new Date(h.timestamp);
        return hDate.getDate() === day && hDate.getMonth() === month && hDate.getFullYear() === year;
      });

      if (record) {
        const s = record.status || 'Hadir';
        if (s === 'Hadir') row.push('H');
        else if (s === 'Sakit') row.push('S');
        else if (s === 'Izin') row.push('I');
        else row.push('A');
      } else {
        row.push('A');
      }
    }
    dataRows.push(row);
  });

  const fullData = [...infoHeader, tableHeader, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(fullData);
  const wb = XLSX.utils.book_new();

  const colWidths = [
    { wch: 15 },
    { wch: 30 },
    { wch: 12 },
  ];
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
.status-pill { padding: 6px 14px; border-radius: 20px; font-size: 0.75rem; font-weight: 800; display: inline-block; text-transform: uppercase; letter-spacing: 0.5px; }
.formal-title { font-weight: 800; color: #0f172a; margin-bottom: 4px; font-size: 1.6rem; letter-spacing: -0.5px; }
.formal-subtitle { color: #64748b; font-size: 0.9rem; font-weight: 500; }
code { font-family: 'JetBrains Mono', 'Fira Code', monospace; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; }
.table-formal th { padding: 20px 15px; text-align: left; background: #f8fafc; color: #475569; font-size: 0.8rem; font-weight: 800; border-bottom: 2px solid #e2e8f0; text-transform: uppercase; letter-spacing: 0.05em; }

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

/* CUSTOM SCROLLBAR */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: #f1f5f9; }
::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

/* POINT ROW HOVER */
.point-row:hover { background-color: #f0f9ff !important; }
.btn-xs { padding: 0.25rem 0.5rem; font-size: 0.7rem; line-height: 1.5; border-radius: 0.2rem; }
.bg-primary-subtle { background-color: #eff6ff !important; }
.bg-danger-subtle { background-color: #fef2f2 !important; }
.bg-success-subtle { background-color: #f0fdf4 !important; }
.bg-warning-subtle { background-color: #fffbeb !important; }

.overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; }
@media (max-width: 768px) {
  .sidebar { position: fixed; left: -280px; }
  .sidebar.show { left: 0; }
  .export-controls-formal { flex-direction: column; align-items: stretch; }
  .jurusan-grid { grid-template-columns: 1fr; }
}

.rating-modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(5px); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 20px; }
.rating-modal-content { background: white; width: 100%; max-width: 600px; border-radius: 20px; padding: 30px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); animation: zoomIn 0.3s ease-out; }
.scroll-penilaian::-webkit-scrollbar { width: 6px; }
.scroll-penilaian::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; }
.cursor-pointer { cursor: pointer; }
.transition-all { transition: all 0.3s ease; }
@keyframes zoomIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
</style>