import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <Navbar />
      {/* Swiss 需要更宽的外边距来承托内容块：max-w-6xl 给网格更多呼吸位，
          px-6/px-10 让内容不贴边 */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-6 sm:px-10 py-12 sm:py-16">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
