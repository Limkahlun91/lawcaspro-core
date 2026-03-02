import { Router } from 'express'
import { aiService } from '../services/vertexAi.service'

const router = Router()

// Middleware to verify session would go here
const requireAuth = (req: any, res: any, next: any) => {
  // Mock Auth Check
  req.user = { id: 'user_123', firm_id: 'firm_abc' }
  next()
}

router.post('/extract-structured', requireAuth, async (req: any, res: any) => {
  const { text, type } = req.body
  try {
    const result = await aiService.extractStructured(req.user.id, req.user.firm_id, text, type)
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/analyze-document', requireAuth, async (req: any, res: any) => {
  const { text, type } = req.body
  try {
    const result = await aiService.analyzeDocument(req.user.id, req.user.firm_id, text, type)
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
