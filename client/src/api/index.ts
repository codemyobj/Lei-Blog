import axios from 'axios'

/**
 * API 基础地址。
 *
 * 默认 `/api`（同域部署，由 Nginx 把 /api 反代到 127.0.0.1:8080）。
 * 若需前后端分域部署，设置 `VITE_API_BASE` 即可（Vite 在 build 期内联该值，改了必须重新构建）。
 */
const baseURL: string = import.meta.env.VITE_API_BASE ?? '/api'

const apiClient = axios.create({
  baseURL,
})

// 请求拦截器：注入 JWT token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截器：401 时清除 token 并跳转登录页
apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      // 仅在后台路由下才清除并跳转
      const isAdminRoute = window.location.pathname.startsWith('/admin')
      if (isAdminRoute) {
        localStorage.removeItem('token')
        window.location.href = '/admin/login'
      }
    }
    return Promise.reject(error)
  }
)

export default apiClient
