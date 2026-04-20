import axios from 'axios'
import { config } from '../config'

export async function getStudents() {
  const res = await axios.get(`${config.baseUrl}/students`)
  return res.data
}
