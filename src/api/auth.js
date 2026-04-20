import axios from 'axios'
import { config } from '../config'

const API = config.baseUrl

export const loginGuru = async (payload) => {
  const res = await axios.post(`${API}/teachers/login`, payload)
  return res.data
}
