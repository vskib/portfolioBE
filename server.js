import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { createClient } from '@supabase/supabase-js'

const { PORT = 5000, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CLIENT_ORIGIN } = process.env

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const app = express()
app.set('trust proxy', 1) // correct client IPs behind Render/Railway proxies
app.use(cors({ origin: CLIENT_ORIGIN || 'https://vskibport.vercel.app' }))
app.use(express.json({ limit: '10kb' }))

// Max 5 submissions per IP every 15 minutes
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many messages. Please try again later.' },
})

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

app.post('/api/contact', contactLimiter, async (req, res) => {
  const name = String(req.body?.name ?? '').trim()
  const email = String(req.body?.email ?? '').trim()
  const message = String(req.body?.message ?? '').trim()

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required.' })
  }
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Please provide a valid email address.' })
  }
  if (name.length > 100 || message.length > 2000) {
    return res.status(400).json({ error: 'Input is too long.' })
  }

  const { error } = await supabase.from('messages').insert({ name, email, message })

  if (error) {
    console.error('Supabase insert error:', error.message)
    return res.status(500).json({ error: 'Could not save your message. Please try again.' })
  }

  res.status(201).json({ success: true })
})

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))
