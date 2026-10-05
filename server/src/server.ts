import './env.js'
import { app } from './app.js'

const port = Number(process.env.PORT) || 3000

app.listen(port, (err) => {
  if (err) throw err
  console.log(`Server listening on http://localhost:${port}`)
})
