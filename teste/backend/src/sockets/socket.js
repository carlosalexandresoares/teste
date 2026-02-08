module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('Usuário conectado:', socket.id)

    socket.on('message', (data) => {
      io.emit('message', data)
    })

    socket.on('disconnect', () => {
      console.log('Usuário desconectado:', socket.id)
    })
  })
}
