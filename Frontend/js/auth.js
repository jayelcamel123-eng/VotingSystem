let loginType = 'admin'
let loggedVoter = getLoggedVoter()

const AUTH_KEYS = {
  isLoggedIn: 'isLoggedIn',
  userRole: 'userRole',
  currentVoter: 'currentVoter',
  authRedirectMessage: 'authRedirectMessage',
}

function getLoginPageUrl() {
  return window.location.pathname.includes('/pages/') ? '../../index.html' : 'index.html'
}

function setAuthSession(role, voter = null) {
  localStorage.setItem(AUTH_KEYS.isLoggedIn, 'true')
  localStorage.setItem(AUTH_KEYS.userRole, role)

  if (role === 'voter' && voter) {
    localStorage.setItem(AUTH_KEYS.currentVoter, JSON.stringify(voter))
    saveLoggedVoter(voter)
    loggedVoter = voter
  } else {
    localStorage.removeItem(AUTH_KEYS.currentVoter)
  }
}

async function serverLogout() {
  try {
    await apiJson('/auth/logout', { method: 'POST' })
  } catch (e) {}
}

let adminHeartbeatTimer = null

function startAdminHeartbeat() {
  if (adminHeartbeatTimer) {
    clearInterval(adminHeartbeatTimer)
  }

  if (localStorage.getItem(AUTH_KEYS.userRole) !== 'admin' || !localStorage.getItem('authToken')) {
    return
  }

  const sendHeartbeat = async () => {
    try {
      await apiJson('/auth/heartbeat', {
        method: 'POST',
      })
    } catch (error) {
      console.error('Admin heartbeat failed:', error)
    }
  }

  // Send immediately
  sendHeartbeat()

  // Then every 20 seconds
  adminHeartbeatTimer = setInterval(sendHeartbeat, 20 * 1000)
}

function clearAuthSession() {
  localStorage.removeItem(AUTH_KEYS.isLoggedIn)
  localStorage.removeItem(AUTH_KEYS.userRole)
  localStorage.removeItem(AUTH_KEYS.currentVoter)
  localStorage.removeItem('loggedVoter')
  localStorage.removeItem(AUTH_KEYS.authRedirectMessage)
  localStorage.removeItem('authToken')
  loggedVoter = null
}

function showAuthMessage(message, type = 'error') {
  const box = document.getElementById('loginMessage')
  if (!box) return

  box.className = 'login-message ' + (type === 'success' ? 'success' : 'error')
  box.textContent = message
}

function redirectToLogin(message = 'Please log in first.') {
  localStorage.setItem(AUTH_KEYS.authRedirectMessage, message)
  window.location.replace(getLoginPageUrl())
}

function requireLogin() {
  if (localStorage.getItem(AUTH_KEYS.isLoggedIn) !== 'true' || !localStorage.getItem('authToken')) {
    redirectToLogin()
    return false
  }

  return true
}

function requireAdmin() {
  if (!requireLogin()) return false

  const currentRole = localStorage.getItem(AUTH_KEYS.userRole)

  if (currentRole === 'voter') {
    window.location.replace('../../pages/voter/dashboard.html')
    return false
  }

  if (currentRole !== 'admin') {
    redirectToLogin()
    return false
  }

  return true
}

function requireVoter() {
  if (!requireLogin()) return false

  const currentRole = localStorage.getItem(AUTH_KEYS.userRole)

  if (currentRole === 'admin') {
    window.location.replace('../../pages/admin/dashboard.html')
    return false
  }

  if (currentRole !== 'voter') {
    redirectToLogin()
    return false
  }

  return true
}

function setLoginType(type) {
  loginType = type

  const adminBtn = document.getElementById('adminLoginBtn')
  const voterBtn = document.getElementById('voterLoginBtn')
  const label = document.querySelector('#loginForm .form-group label')
  const usernameInput = document.getElementById('username')

  if (!adminBtn || !voterBtn || !label || !usernameInput) return

  if (type === 'admin') {
    adminBtn.classList.add('active')
    voterBtn.classList.remove('active')
    label.textContent = 'Username'
    usernameInput.placeholder = 'Enter username'
  } else {
    voterBtn.classList.add('active')
    adminBtn.classList.remove('active')
    label.textContent = 'Voter ID'
    usernameInput.placeholder = 'Enter your LRN number'
  }
}

function forgotPassword(event) {
  event.preventDefault()
  alert('Please contact the election administrator to reset your password.')
}

async function handleLoginSubmit(event) {
  event.preventDefault()

  const usernameInput = document.getElementById('username')
  const passwordInput = document.getElementById('password')
  const message = document.getElementById('loginMessage')

  const username = usernameInput.value.trim()
  const password = passwordInput.value.trim()

  if (!username || !password) {
    if (message) {
      message.className = 'login-message error'
      message.textContent = 'Username and password are required.'
    }
    return
  }

  // Backend API
  const API_URL = 'http://localhost:5000/api/auth/login'

  // Show loading message
  if (message) {
    message.className = 'login-message'
    message.textContent = 'Logging in...'
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: username,
        password: password,
      }),
    })

    const data = await response.json()

    if (!response.ok || !data.success) {
      if (message) {
        message.className = 'login-message error'
        message.textContent = data.message || 'Invalid username or password.'
      }
      return
    }

    // Check selected login type against backend role
    if (loginType === 'admin' && data.user.role !== 'admin') {
      if (message) {
        message.className = 'login-message error'
        message.textContent = 'This account is not an admin account.'
      }
      return
    }

    if (loginType === 'voter' && data.user.role !== 'voter') {
      if (message) {
        message.className = 'login-message error'
        message.textContent = 'This account is not a voter account.'
      }
      return
    }

    // Save authenticated session
    setAuthSession(data.user.role, data.voter)
    localStorage.setItem('authToken', data.token)

    // Save complete backend user information
    localStorage.setItem('currentUser', JSON.stringify(data.user))

    if (data.voter) {
      localStorage.setItem('currentVoter', JSON.stringify(data.voter))
    }

    // Success message
    if (message) {
      message.className = 'login-message success'

      if (data.user.role === 'admin') {
        message.textContent = 'Admin login successful!'
      } else {
        message.textContent = 'Voter login successful!'
      }
    }

    // Redirect based on backend role
    setTimeout(() => {
      if (data.user.role === 'admin') {
        window.location.href = 'pages/admin/dashboard.html'
      } else if (data.user.role === 'voter') {
        window.location.href = 'pages/voter/dashboard.html'
      }
    }, 500)
  } catch (error) {
    console.error('Login request error:', error)

    if (message) {
      message.className = 'login-message error'
      message.textContent =
        'Unable to connect to the server. Please make sure the backend is running.'
    }
  }
}

async function adminLogout() {
  if (confirm('Are you sure you want to logout?')) {
    await serverLogout()
    clearAuthSession()
    window.location.replace('../../index.html')
  }
}

async function voterLogout() {
  if (confirm('Are you sure you want to logout?')) {
    await serverLogout()
    clearAuthSession()
    window.location.replace('../../index.html')
  }
}

function initializePageProtection() {
  const isLoginPage =
    window.location.pathname.endsWith('/index.html') ||
    window.location.pathname === '/' ||
    window.location.pathname.endsWith('Web-Based Election Management and Voting System')

  if (isLoginPage) {
    const redirectMessage = localStorage.getItem(AUTH_KEYS.authRedirectMessage)
    const messageBox = document.getElementById('loginMessage')

    if (redirectMessage && messageBox) {
      showAuthMessage(redirectMessage, 'error')
      localStorage.removeItem(AUTH_KEYS.authRedirectMessage)
    }

    if (
      localStorage.getItem(AUTH_KEYS.isLoggedIn) === 'true' &&
      localStorage.getItem('authToken')
    ) {
      const role = localStorage.getItem(AUTH_KEYS.userRole)
      if (role === 'admin') {
        window.location.replace('pages/admin/dashboard.html')
        return
      }
      if (role === 'voter') {
        window.location.replace('pages/voter/dashboard.html')
        return
      }
    }

    return
  }

  if (window.location.pathname.includes('/pages/admin/')) {
    requireAdmin()
    return
  }

  if (window.location.pathname.includes('/pages/voter/')) {
    requireVoter()
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initializePageProtection()
  startAdminHeartbeat()

  const loginForm = document.getElementById('loginForm')
  if (loginForm) {
    loginForm.addEventListener('submit', handleLoginSubmit)
  }

  const defaultLoginType = document.getElementById('adminLoginBtn')
  if (defaultLoginType) {
    setLoginType('admin')
  }

  if (typeof updateConnection === 'function') {
    updateConnection()
  }

  window.addEventListener('pageshow', () => {
    initializePageProtection()
  })

  window.addEventListener('popstate', () => {
    initializePageProtection()
  })
})
