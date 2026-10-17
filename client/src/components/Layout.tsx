import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'
import Doodles from './Doodles'

export default function Layout() {
  return (
    <>
      {/*
        涂鸦层必须是**内容层的兄弟**而不是父子：
        外层固定定位 z-index:0，内容层 position:relative; z-index:1。
        若把涂鸦塞进内容层内部，内容层自身的 z-index 会形成层叠上下文，
        涂鸦（z-0）会盖在正常流文本之上 —— 那是 bug 不是装饰。
        底色由 body 提供（index.css），内容层**不**再铺一层不透明背景，
        否则涂鸦会被完全遮住。
      */}
      <Doodles />
      <div className="relative z-[1] min-h-screen flex flex-col">
        <Navbar />
        {/* max-w-6xl 承托 3 列卡片网格，px-6/px-10 让内容不贴边 */}
        <main className="flex-1 w-full max-w-6xl mx-auto px-6 sm:px-10 py-12 sm:py-16">
          <Outlet />
        </main>
        <Footer />
      </div>
    </>
  )
}
