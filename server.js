require('dotenv').config(); // Küçük 'r' ile düzeltildi
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const bodyParser = require('body-parser');
const cors = require('cors');
const db = require('./config/db');

const app = express();
app.use(cors());

app.use(bodyParser.json({ limit: '100mb' }));
app.use(bodyParser.urlencoded({ limit: '100mb', extended: true }));

// Ana sayfa testi
app.get('/', (req, res) => { res.send('V-QMSPRO Chat Sunucusu Aktif! 🚀'); });

// API YÖNLENDİRMELERİ
app.use('/api/raporlar', require('./routes/raporlar')); 
app.use('/api/profil', require('./routes/profil')); 
app.use('/api/auth', require('./routes/auth'));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// SİHİRLİ SATIR: Socket'i Express'e tanıtıyoruz
app.set('socketio', io);

// ==========================================
// 1. ROTA: BİLDİRİMLERİ LİSTELEME (GET)
// ==========================================
app.get('/api/bildirimler', async (req, res) => {
    try {
        if (db) {
            const [rows] = await db.execute(
                "SELECT id, baslik, mesaj, tarih, tur, rapor_id FROM bildirimler ORDER BY id DESC LIMIT 50"
            );
            res.json(rows);
        } else {
            res.status(500).json({ error: "Veritabanı bağlantısı yok" });
        }
    } catch (err) {
        console.error("❌ Liste Çekme Hatası:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 2. ROTA: BİLDİRİM TETİKLEME (POST)
// ==========================================
app.post('/api/bildirim-tetikle', async (req, res) => {
    const { tur, mesaj, rapor_id } = req.body;

    // Profesyonel Başlık Belirleme
    let baslik = "VQMS PRO Bilgilendirme";
    if (tur === "kalite") baslik = "Kalite Raporu Paylaşıldı";
    else if (tur === "uretim") baslik = "Üretim Raporu Paylaşıldı";
    else if (tur === "verimlilik") baslik = "Verimlilik Raporu Paylaşıldı";
    else if (tur === "gunluk") baslik = "Günlük Rapor Paylaşıldı";

    // Türkiye Saati Oluşturma
    const trTarih = new Intl.DateTimeFormat('tr-TR', {
        timeZone: 'Europe/Istanbul',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).format(new Date());

    try {
        if (db) {
            await db.execute(
                "INSERT INTO bildirimler (baslik, mesaj, tarih, tur, rapor_id) VALUES (?, ?, ?, ?, ?)",
                [baslik, mesaj, trTarih, tur, rapor_id || 0]
            );
        }

        const io = req.app.get('socketio'); 
        if (io) {
            io.emit('yeni_bildirim', {
                baslik: baslik,
                mesaj: mesaj,
                tur: tur,
                tarih: trTarih,
                rapor_id: rapor_id || 0,
                okundu: false
            });
            console.log(`📢 ${baslik} Android'e fırlatıldı!`);
        }
        res.json({ success: true });
    } catch (err) {
        console.error("❌ Bildirim Hatası:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// SOCKET.IO BAĞLANTI YÖNETİMİ
// ==========================================
let onlineUsers = new Map(); 

io.on('connection', (socket) => {
    console.log('🔌 Yeni Bağlantı:', socket.id);

    socket.on('giris_yap', (userId) => {
        onlineUsers.set(String(userId), socket.id);
        io.emit('kullanici_durumu', { userId: userId, status: 'online' });
    });

    socket.on('mesaj_gonder', async (data) => {
        const { gonderen_id, alici_id, mesaj, image_data, file_type, tempId } = data;
        let dbId = 0;
        if (db) {
            try {
                const tip = file_type || (image_data ? 'image' : 'text');
                const [result] = await db.execute(
                    "INSERT INTO mesajlar (gonderen_id, alici_id, mesaj, dosya, dosya_tipi) VALUES (?, ?, ?, ?, ?)",
                    [gonderen_id, alici_id, mesaj, image_data || null, tip]
                );
                dbId = result.insertId;
            } catch (err) { console.error("DB Hatası:", err); }
        }
        socket.emit('mesaj_iletildi', { tempId, serverId: dbId, success: true });

        const hedefSocketId = onlineUsers.get(String(alici_id));
        if (hedefSocketId) {
            io.to(hedefSocketId).emit('yeni_mesaj', {
                id: dbId, gonderen_id, mesaj, image_data, 
                file_type: file_type || 'text', tarih: new Date().toISOString()
            });
        }
    });

    socket.on('arama_yap', (data) => {
        const hedefSocketId = onlineUsers.get(String(data.hedefId));
        if (hedefSocketId) {
            io.to(hedefSocketId).emit('gelen_arama', {
                caller_name: data.callerName, call_type: data.callType, caller_id: data.myId
            });
        }
    });

    socket.on('disconnect', () => {
        let uid = [...onlineUsers.entries()].find(([k, v]) => v === socket.id)?.[0];
        if (uid) {
            onlineUsers.delete(uid);
            io.emit('kullanici_durumu', { userId: uid, status: 'offline' });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`🚀 Sunucu ${PORT} portunda aktif!`); });
