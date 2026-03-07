<script setup>
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'

// Logika pendaftaran Service Worker agar getar/notif bisa jalan saat aplikasi ditutup
onMounted(() => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('ZieSen Service Worker terdaftar!', reg.scope);
      })
      .catch((err) => {
        console.error('Pendaftaran Service Worker gagal:', err);
      });
  }

  // Meminta izin notifikasi secara otomatis saat aplikasi dibuka
  if ('Notification' in window) {
    Notification.requestPermission();
  }
})
</script>

<template>
  <div class="app-container">
    <router-view v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
  </div>
</template>

<style scoped>
.app-container {
  width: 100%;
  min-height: 100vh;
  padding: 0;
  background-color: transparent;
}

/* Tambahkan style transisi fade agar tidak error jika belum ada */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>