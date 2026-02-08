const express = require('express')

const router = express.Router()

router.get('/', (req, res) => {
  res.send('Servidor rodando 🚀')
})

module.exports = router
