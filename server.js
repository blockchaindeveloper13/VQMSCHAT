require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const bodyParser = require('body-parser');
const cors = require('cors');

// --- GÜVENLİ DB BAĞLANTISI ---
let db;
try {
    db = require('./config/db'); 
    console.log("✅ Veritabanı dosyası yüklendi.");
} catch (e) {
    console.error("⚠️ Veritabanı dosyası bulunamadı, sunucu DB'siz modda çalışacak.");
    db = null;
}

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Rotaları Güvenli Yükle
try {
    const profilRoutes = require('./routes/profil');
    app.use('/api/profil', profilRoutes);
} catch (e) { console.error("⚠️ Profil rotaları yüklenemedi."); }

app.get('/', (req, res) => { res.send('V-QMSPRO Sunucusu Çalışıyor 🚀'); });

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let onlineUsers = new Map(); 

io.on('connection', (socket) => {
    console.log('Kullanıcı bağlandı:', socket.id);

    // GEÇMİŞ MESAJLARI YÜKLE
    socket.on('eski_mesajlari_yukle', async (data) => {
        if (!db) return;
        try {
            const [rows] = await db.execute(
                `SELECT * FROM mesajlar 
                 WHERE (gonderen_id = ? AND alici_id = ?) 
                 OR (gonderen_id = ? AND alici_id = ?) 
                 ORDER BY tarih ASC`,
                [data.myId, data.hedefId, data.hedefId, data.myId]
            );
            socket.emit('eski_mesajlar', rows);
        } catch (err) { console.error(err); }
    });

    socket.on('giris_yap', (userId) => {
        onlineUsers.set(String(userId), socket.id);
        io.emit('kullanici_durumu_guncelle', { userId: userId, status: 'online' });
    });

    socket.on('durum_sorgula', (hedefId) => {
        const isOnline = onlineUsers.has(String(hedefId));
        socket.emit('durum_cevabi', { userId: hedefId, status: isOnline ? 'online' : 'offline' });
    });

    socket.on('mesaj_gonder', async (data) => {
        if (db) {
            try {
                await db.execute(
                    "INSERT INTO mesajlar (gonderen_id, alici_id, mesaj, dosya, dosya_tipi) VALUES (?, ?, ?, ?, ?)",
                    [data.gonderen_id, data.alici_id, data.mesaj, data.image_data, data.image_data ? 'image' : 'text']
                );
            } catch (err) { console.error(err); }
        }
        
        const hedefSocketId = onlineUsers.get(String(data.alici_id));
        if (hedefSocketId) io.to(hedefSocketId).emit('yeni_mesaj', data);
    });

    socket.on('disconnect', () => {
        let uid = [...onlineUsers.entries()].find(([k, v]) => v === socket.id)?.[0];
        if (uid) {
            onlineUsers.delete(uid);
            io.emit('kullanici_durumu_guncelle', { userId: uid, status: 'offline' });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`Sunucu ${PORT} portunda!`); });
