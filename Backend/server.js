const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
require('dotenv').config()
const pool = require('./config/db')
const authRoutes = require('./routes/authRoutes')
const voterRoutes = require('./routes/voterRoutes')
const candidateRoutes = require('./routes/candidateRoutes')
const electionRoutes = require('./routes/electionRoutes')
const dashboardRoutes = require('./routes/dashboardRoutes')
const positionRoutes = require('./routes/positionRoutes')
const voteRoutes = require('./routes/voteRoutes')
const resultsRoutes = require('./routes/resultsRoutes')
const activityRoutes = require('./routes/activityRoutes')

const app = express()

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)

app.use(cookieParser())
app.use(express.json({ limit: '1mb' }))
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('X-XSS-Protection', '0')
  next()
})

app.get('/', (req, res) =>
  res.json({
    success: true,
    message: 'Election Management System API is running',
    version: '1.0.0',
  })
)

app.get('/api/health', async (req, res) => {
  try {
    const r = await pool.query('SELECT NOW() AS now')
    res.json({ success: true, database: 'connected', time: r.rows[0].now })
  } catch (e) {
    res.status(500).json({ success: false, database: 'disconnected', message: e.message })
  }
})

app.use('/api/auth', authRoutes)
app.use('/api/voters', voterRoutes)
app.use('/api/candidates', candidateRoutes)
app.use('/api/elections', electionRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/positions', positionRoutes)
app.use('/api/votes', voteRoutes)
app.use('/api/results', resultsRoutes)
app.use('/api/activities', activityRoutes)
app.use((req, res) => res.status(404).json({ success: false, message: 'API endpoint not found.' }))
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ success: false, message: 'Unexpected server error.' })
})

const PORT = Number(process.env.PORT) || 5000

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on http://localhost:${PORT}`))
