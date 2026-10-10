import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthProvider'
import { ThemeProvider } from './context/ThemeProvider'
import Layout from './components/Layout'
import AdminLayout from './components/AdminLayout'
import ProtectedRoute from './components/ProtectedRoute'
import HomePage from './pages/HomePage'
import PostDetailPage from './pages/PostDetailPage'
import TagsPage from './pages/TagsPage'
import TagDetailPage from './pages/TagDetailPage'
import CategoriesPage from './pages/CategoriesPage'
import CategoryDetailPage from './pages/CategoryDetailPage'
import ArchivePage from './pages/ArchivePage'
import SearchPage from './pages/SearchPage'
import AboutPage from './pages/AboutPage'
import NotFoundPage from './pages/NotFoundPage'
import AdminLoginPage from './pages/admin/AdminLoginPage'
import AdminDashboardPage from './pages/admin/AdminDashboardPage'
import AdminPostListPage from './pages/admin/AdminPostListPage'
import AdminPostEditPage from './pages/admin/AdminPostEditPage'
import AdminTagListPage from './pages/admin/AdminTagListPage'
import AdminAboutEditPage from './pages/admin/AdminAboutEditPage'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* 公开路由 — Layout 包裹（Navbar + Footer） */}
            <Route element={<Layout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/posts/:slug" element={<PostDetailPage />} />
              <Route path="/tags" element={<TagsPage />} />
              <Route path="/tags/:slug" element={<TagDetailPage />} />
              <Route path="/categories" element={<CategoriesPage />} />
              <Route path="/categories/:slug" element={<CategoryDetailPage />} />
              <Route path="/archive" element={<ArchivePage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/about" element={<AboutPage />} />
            </Route>

            {/* 后台登录（独立，无 Layout） */}
            <Route path="/admin/login" element={<AdminLoginPage />} />

            {/* 后台路由 — ProtectedRoute + AdminLayout */}
            <Route element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="/admin/posts" element={<AdminPostListPage />} />
              <Route path="/admin/posts/new" element={<AdminPostEditPage />} />
              <Route path="/admin/posts/:id/edit" element={<AdminPostEditPage />} />
              <Route path="/admin/tags" element={<AdminTagListPage />} />
              <Route path="/admin/about" element={<AdminAboutEditPage />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
