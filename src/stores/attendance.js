import { reactive } from 'vue'
import axios from 'axios'
import { config } from '../config'

const API = config.baseUrl

export const store = reactive({
  students: [],
  attendanceLog: [],
  loading: false,

  async fetchStudents() {
    this.loading = true
    try {
      const res = await axios.get(`${API}/students`)
      this.students = res.data
    } catch (err) {
      this.students = []
    } finally {
      this.loading = false
    }
  },

  async markAttendance(nis) {
    try {
      await axios.patch(`${API}/students/nis/${nis}`, { status: 'Hadir' })
      const s = this.students.find(st => st.nis === nis)
      if (s) {
        s.status = 'Hadir'
        this.attendanceLog.push(s)
      }
    } catch (err) {
      console.error(err)
    }
  }
})
