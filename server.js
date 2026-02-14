require('dotenv').config(); // Ayarları yükle
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const bodyParser = require('body-parser');
const cors = require('cors');

// MODÜLLERİ ÇAĞIR
const profilRoutes = require('./routes/profil');
const raporRoutes = require('./routes/raporlar');
const socketHandler = require('./sockets/aramaSocket');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ROTALARI TANIMLA (Android buraya istek atacak)
app.use('/api/profil', profilRoutes);
app.use('/api/raporlar', raporRoutes);

// WEBHOOK (Eğer PHP'den tetikleme gelirse)
app.post('/webhook', (req, res) => {
    const data = req.body;
    // Bu kısmı socketHandler'a taşımak daha şık olur ama şimdilik burada kalsın
    // io nesnesine buradan erişim karmaşık olacağından, 
    // PHP webhook'unu ileride tamamen kaldırıp Node.js üzerinden mesajlaşacağız.
    res.status(200).send('OK');
});

// SUNUCU VE SOCKET KURULUMU
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// SOCKET MANTIĞINI BAŞLAT
socketHandler(io);

// Test Rotası
app.get('/', (req, res) => {
    res.send('V-QMSPRO Güvenli Backend Çalışıyor! (v2.0)');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda aktif.`);
});
