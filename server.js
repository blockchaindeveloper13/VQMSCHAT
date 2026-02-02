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

const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

// KULLANICI HARİTASI (ID -> Socket ID)
let onlineUsers = new Map();

// PHP Webhook
app.post('/webhook', (req, res) => {
  const data = req.body;
  if(data && data.mesaj) {
    io.emit('yeni_mesaj', data);
    res.status(200).send('OK');
  } else {
    res.status(400).send('Eksik');
  }
});

io.on('connection', (socket) => {
  
  // 1. KULLANICI GİRİŞİ (KESİN KAYIT)
  socket.on('giris_yap', (userId) => {
    const uid = String(userId);
    // Varsa eski kaydı sil, yenisini ekle
    onlineUsers.set(uid, socket.id);
    console.log(`User ${uid} online: ${socket.id}`);
    io.emit('online_users_update', Array.from(onlineUsers.keys()));
  });

  // 2. ARAMA BAŞLATMA
  socket.on('arama_yap', (data) => {
    const targetSocket = onlineUsers.get(String(data.alici_id));
    if (targetSocket) {
      io.to(targetSocket).emit('gelen_arama', data);
    } else {
      // Hedef online değilse arayana bildir
      io.to(socket.id).emit('arama_kapandi', { sebep: 'offline' });
    }
  });

  // 3. CEVAPLAMA
  socket.on('aramayi_cevapla', (data) => {
    const targetSocket = onlineUsers.get(String(data.to));
    if (targetSocket) {
      io.to(targetSocket).emit('arama_kabul_edildi', data.answer);
    }
  });

  // 4. ICE CANDIDATE
  socket.on('ice_candidate', (data) => {
    const targetSocket = onlineUsers.get(String(data.to));
    if (targetSocket) {
      io.to(targetSocket).emit('ice_candidate', data.candidate);
    }
  });

  // 5. ARAMAYI KAPAT (HER İKİ TARAFA DA BİLDİR)
  socket.on('aramayi_kapat', (data) => {
    const targetSocket = onlineUsers.get(String(data.to));
    // Karşı tarafa kapat
    if (targetSocket) {
      io.to(targetSocket).emit('arama_kapandi');
    }
    // Kendine de kapat (Garanti olsun)
    io.to(socket.id).emit('arama_kapandi');
  });

  socket.on('disconnect', () => {
    for (let [uid, sid] of onlineUsers.entries()) {
      if (sid === socket.id) {
        onlineUsers.delete(uid);
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Sunucu ${PORT} portunda aktif.`));
