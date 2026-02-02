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

// CORS Ayarları
const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

// ONLİNE KULLANICILARI TUTAN HARİTA (User ID -> Socket ID)
let onlineUsers = new Map();

// PHP'den gelen mesajı dağıtan Webhook
app.post('/webhook', (req, res) => {
  const data = req.body;
  if(data && data.mesaj) {
    io.emit('yeni_mesaj', data);
    res.status(200).send('Mesaj iletildi');
  } else {
    res.status(400).send('Veri eksik');
  }
});

io.on('connection', (socket) => {
  console.log('Kullanıcı bağlandı: ' + socket.id);

  // 1. KULLANICI GİRİŞ YAPINCA (SOCKET ID İLE EŞLEŞTİR)
  socket.on('giris_yap', (userId) => {
    onlineUsers.set(userId, socket.id);
    console.log(`Kullanıcı ID: ${userId} -> Socket: ${socket.id} eşleşti.`);
    io.emit('online_kullanicilar', Array.from(onlineUsers.keys())); // Herkese online listesini at
  });

  // 2. ARAMA BAŞLATMA İSTEĞİ (SİNYAL)
  socket.on('arama_yap', (data) => {
    // data = { alici_id, gonderen_id, gonderen_isim, gonderen_resim, tip (ses/video), offer (sinyal) }
    const aliciSocket = onlineUsers.get(parseInt(data.alici_id));
    if (aliciSocket) {
      io.to(aliciSocket).emit('gelen_arama', data);
    } else {
      // Kullanıcı offline ise arayan kişiye bildir
      io.to(socket.id).emit('kullanici_offline');
    }
  });

  // 3. ARAMAYI CEVAPLAMA
  socket.on('aramayi_cevapla', (data) => {
    const arayanSocket = onlineUsers.get(parseInt(data.to)); // Arayan kişinin ID'si
    if (arayanSocket) {
      io.to(arayanSocket).emit('arama_kabul_edildi', data.answer);
    }
  });

  // 4. ICE ADAYLARI (AĞ YOLU BULMA)
  socket.on('ice_candidate', (data) => {
    const hedefSocket = onlineUsers.get(parseInt(data.to));
    if (hedefSocket) {
      io.to(hedefSocket).emit('ice_candidate', data.candidate);
    }
  });

  // 5. ARAMAYI SONLANDIRMA
  socket.on('aramayi_kapat', (data) => {
    const hedefSocket = onlineUsers.get(parseInt(data.to));
    if (hedefSocket) {
      io.to(hedefSocket).emit('arama_kapandi');
    }
  });

  socket.on('disconnect', () => {
    // Haritadan sil
    for (let [uid, sid] of onlineUsers.entries()) {
      if (sid === socket.id) {
        onlineUsers.delete(uid);
        break;
      }
    }
    console.log('Kullanıcı ayrıldı');
    io.emit('online_kullanicilar', Array.from(onlineUsers.keys()));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`V-Chat Sunucusu ${PORT} portunda emrinizde Komutanım!`);
});
