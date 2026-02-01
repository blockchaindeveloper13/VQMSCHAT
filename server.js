const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const server = http.createServer(app);

// CORS Ayarları (Senin sitenden gelen bağlantıları kabul etmesi için)
const io = new Server(server, {
  cors: {
    origin: "*", // Güvenlik için buraya "https://vedattunc.com" yazman daha iyi olur
    methods: ["GET", "POST"]
  }
});

// PHP'den gelen mesajı alıp dağıtan kapı (Webhook)
app.post('/webhook', (req, res) => {
  const data = req.body;
  
  // Gelen veriyi kontrol et
  if(data && data.mesaj) {
    console.log("Mesaj geldi:", data);
    
    // Tüm bağlı kullanıcılara "yeni_mesaj" olayıyla veriyi fırlat
    io.emit('yeni_mesaj', data);
    
    res.status(200).send('Mesaj iletildi');
  } else {
    res.status(400).send('Veri eksik');
  }
});

// Kullanıcı bağlandığında
io.on('connection', (socket) => {
  console.log('Bir kullanıcı bağlandı: ' + socket.id);
  
  socket.on('disconnect', () => {
    console.log('Kullanıcı ayrıldı');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Socket sunucusu ${PORT} portunda çalışıyor`);
});
