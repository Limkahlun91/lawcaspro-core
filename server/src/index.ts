import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import dotenv from 'dotenv'
import aiRoutes from './routes/ai.routes'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(cors())
app.use(express.json({ limit: '50mb' })) // Increase limit for large PDFs
app.use(morgan('dev'))

// Routes
app.use('/api/ai', aiRoutes)

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'LawCase AI Gateway' })
})

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 AI Gateway running on port ${PORT}`)
})
