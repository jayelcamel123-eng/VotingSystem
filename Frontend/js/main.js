document.addEventListener('DOMContentLoaded', () => {
  updateConnection()
  setupNavigation()
  setupSidebar()
  setupPageTitle()
})

function setupNavigation() {
  const menuItems = document.querySelectorAll('.menu-item')

  menuItems.forEach((item) => {
    item.addEventListener('click', () => {
      const pageId = item.getAttribute('data-page')

      if (pageId) {
        showPage(pageId, item)
      }
    })
  })
}

function setupSidebar() {
  const sidebar = document.getElementById('sidebar')

  if (!sidebar) return
}

function setupPageTitle() {
  const titleEl = document.getElementById('pageTitle')

  if (!titleEl) return

  const page = document.querySelector('.page.active')

  if (page && page.id) {
    titleEl.textContent = getPageTitle(page.id)
  }
}

function getPageTitle(pageId) {
  const titles = {
    dashboard: 'Dashboard',
    voters: 'Voter Management',
    candidates: 'Candidate Management',
    elections: 'Election Management',
    voting: 'Voting',
    results: 'Election Results',
    settings: 'System Settings',
  }

  return titles[pageId] || 'Dashboard'
}

function updateConnection() {
  const text = document.getElementById('connectionText')
  const topStatus = document.getElementById('topStatus')
  const voterMode = document.getElementById('voterMode')
  const voterModeCard = document.getElementById('voterModeCard')
  const voterConnectionMessage = document.getElementById('voterConnectionMessage')
  const offlineNotice = document.getElementById('offlineNotice')

  if (navigator.onLine) {
    if (text) text.textContent = 'Online Mode — Connected'

    if (topStatus) topStatus.textContent = 'Online'

    if (voterMode) {
      voterMode.textContent = '● Online'
      voterMode.className = 'badge mode-online'
    }

    if (voterModeCard) {
      voterModeCard.textContent = 'Online Mode'
      voterModeCard.className = 'badge mode-online'
    }

    if (voterConnectionMessage) {
      voterConnectionMessage.textContent = 'You are currently connected to the Internet.'
    }

    if (offlineNotice) {
      offlineNotice.style.display = 'none'
    }
  } else {
    if (text) text.textContent = 'Offline Mode — Local System'

    if (topStatus) topStatus.textContent = 'Offline'

    if (voterMode) {
      voterMode.textContent = '● Offline'
      voterMode.className = 'badge mode-offline'
    }

    if (voterModeCard) {
      voterModeCard.textContent = 'Offline Mode'
      voterModeCard.className = 'badge mode-offline'
    }

    if (voterConnectionMessage) {
      voterConnectionMessage.textContent = 'You are offline. Your vote can be stored locally.'
    }

    if (offlineNotice) {
      offlineNotice.style.display = 'block'
    }
  }
}

window.addEventListener('online', updateConnection)
window.addEventListener('offline', updateConnection)

function showPage(pageID, button) {
  const pages = document.querySelectorAll('.page')

  pages.forEach((page) => {
    page.classList.remove('active')
  })

  const targetPage = document.getElementById(pageID)

  if (targetPage) {
    targetPage.classList.add('active')
  }

  const menuItems = document.querySelectorAll('.menu-item')

  menuItems.forEach((item) => {
    item.classList.remove('active')
  })

  if (button) {
    button.classList.add('active')
  }

  const titleEl = document.getElementById('pageTitle')

  if (titleEl) {
    titleEl.textContent = getPageTitle(pageID)
  }

  // Close sidebar after selecting a menu item on mobile
  const sidebar = document.getElementById('sidebar')

  if (sidebar) {
    sidebar.classList.remove('open')
  }
}

/* HAMBURGER MENU */
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar')

  if (!sidebar) return

  sidebar.classList.toggle('open')
}

function openModal(id) {
  const modal = document.getElementById(id)

  if (modal) {
    modal.classList.add('show')
  }
}

function closeModal(id) {
  const modal = document.getElementById(id)

  if (modal) {
    modal.classList.remove('show')
  }
}

function logout() {
  if (confirm('Are you sure you want to logout?')) {
    const app = document.getElementById('app')
    const loginPage = document.getElementById('loginPage')

    if (app) {
      app.style.display = 'none'
    }

    if (loginPage) {
      loginPage.style.display = 'flex'
    }

    const username = document.getElementById('username')
    const password = document.getElementById('password')
    const message = document.getElementById('loginMessage')

    if (username) {
      username.value = ''
    }

    if (password) {
      password.value = ''
    }

    if (message) {
      message.style.display = 'none'
    }
  }
}

function togglePassword() {
  const password = document.getElementById('password')
  const icon = document.getElementById('eyeIcon')
  const button = document.getElementById('eyeButton')

  if (!password || !icon || !button) return

  if (password.type === 'password') {
    password.type = 'text'

    button.setAttribute('aria-label', 'Hide password')

    icon.innerHTML = `
      <path d="M3 3l18 18"></path>
      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"></path>
      <path d="M9.9 5.2A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a17.2 17.2 0 0 1-3.2 3.9"></path>
      <path d="M6.1 6.1C3.6 7.7 2 12 2 12s3.5 7 10 7a10.7 10.7 0 0 0 4.1-.8"></path>
    `
  } else {
    password.type = 'password'

    button.setAttribute('aria-label', 'Show password')

    icon.innerHTML = `
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    `
  }
}
