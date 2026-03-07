<script setup>
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'

// Fungsi untuk meminta izin notifikasi saat aplikasi pertama kali dibuka
const requestPermission = async () => {
  if ('Notification' in window) {
    const permission = await Notification.requestPermission();
    console.log('Izin Notifikasi:', permission);
  }
}

onMounted(() => {
  requestPermission();

  // --- REGISTRASI SERVICE WORKER ---
  // Ini kunci agar notifikasi/getar bisa masuk meski tab di background
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        console.log('ZieSen Service Worker Active:', reg.scope);
      })
      .catch(err => {
        console.error('SW Registration Failed:', err);
      });
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

/* Transisi Fade */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>