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
  console.log('Bağlantı:', socket.id);

  // 1. GİRİŞ (ID'yi String'e çevirerek kaydet)
  socket.on('giris_yap', (userId) => {
    const uid = String(userId);
    onlineUsers.set(uid, socket.id);
    console.log(`User ${uid} online.`);
    io.emit('online_users_update', Array.from(onlineUsers.keys()));
  });

  // 2. ARAMA YAP (SİNYAL)
  socket.on('arama_yap', (data) => {
    const targetSocket = onlineUsers.get(String(data.alici_id));
    if (targetSocket) {
      io.to(targetSocket).emit('gelen_arama', data);
    } else {
      io.to(socket.id).emit('kullanici_offline');
    }
  });

  // 3. ARAMAYI CEVAPLA
  socket.on('aramayi_cevapla', (data) => {
    const targetSocket = onlineUsers.get(String(data.to));
    if (targetSocket) {
      io.to(targetSocket).emit('arama_kabul_edildi', data.answer);
    }
  });

  // 4. ICE CANDIDATE (BAĞLANTI YOLU)
  socket.on('ice_candidate', (data) => {
    const targetSocket = onlineUsers.get(String(data.to));
    if (targetSocket) {
      io.to(targetSocket).emit('ice_candidate', data.candidate);
    }
  });

  // 5. KAPAT
  socket.on('aramayi_kapat', (data) => {
    const targetSocket = onlineUsers.get(String(data.to));
    if (targetSocket) {
      io.to(targetSocket).emit('arama_kapandi');
    }
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
server.listen(PORT, () => console.log(`Sunucu ${PORT} portunda.`));
