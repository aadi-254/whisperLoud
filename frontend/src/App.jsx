import LandingPage from './pages/LandingPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import CreatePostPage from './pages/CreatePostPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import AdminPage from './pages/AdminPage.jsx'
import UserProfilePage from './pages/UserProfilePage.jsx'

export default function App() {
  const path = location.pathname
  if (path === '/admin') return <AdminPage />
  if (path === '/login') return <LoginPage />
  if (path === '/dashboard') return <DashboardPage />
  if (path === '/createpost') return <CreatePostPage />
  if (path === '/profile') return <ProfilePage />
  if (path.startsWith('/user/')) return <UserProfilePage username={decodeURIComponent(path.slice(6))} />
  return <LandingPage />
}
