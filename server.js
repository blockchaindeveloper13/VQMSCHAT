require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const bodyParser = require('body-parser');
const cors = require('cors');
const db = require('./config/db'); // Veritabanı bağlantısı

const app = express();
app.use(cors());

// Dosya limitini artırdık (Video/PDF için kritik)
app.use(bodyParser.json({ limit: '100mb' }));
app.use(bodyParser.urlencoded({ limit: '100mb', extended: true }));

// Ana sayfa testi
app.get('/', (req, res) => { res.send('V-QMSPRO Chat Sunucusu Aktif! 🚀'); });

// ==========================================
// API YÖNLENDİRMELERİ (BUNLAR EKSİKTİ)
// ==========================================
app.use('/api/raporlar', require('./routes/raporlar')); 

// Eğer profil.js dosyan routes klasöründe hazırsa alttaki satırı da aktif et (değilse silinebilir):
app.use('/api/profil', require('./routes/profil')); 


const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
// BU SİHİRLİ SATIR, DİĞER DOSYALARIN DA SOCKET'İ KULLANMASINI SAĞLAR
app.set('socketio', io);
// PHP'den gelen bildirim sinyalini yakalayan profesyonel rota
app.post('/api/bildirim-tetikle', async (req, res) => {
    try {
        if (db) {
            // Son 50 bildirimi en yeniden en eskiye çekiyoruz
            const [rows] = await db.execute(
                "SELECT id, baslik, mesaj, tarih, tur, rapor_id FROM bildirimler ORDER BY id DESC LIMIT 50"
            );
            res.json(rows);
        } else {
            res.status(500).json({ error: "Veritabanı bağlantısı yok" });
        }
    } catch (err) {
        console.error("❌ Bildirim Çekme Hatası:", err.message);
        res.status(500).json({ error: err.message });
    }
});
    const { tur, mesaj } = req.body;

    // 1. Profesyonel Başlık Belirleme
    let baslik = "VQMS PRO Bilgilendirme";
    if (tur === "kalite") baslik = "Kalite Raporu Paylaşıldı";
    else if (tur === "uretim") baslik = "Üretim Raporu Paylaşıldı";
    else if (tur === "verimlilik") baslik = "Verimlilik Raporu Paylaşıldı";
    else if (tur === "gunluk") baslik = "Günlük Rapor Paylaşıldı";

    // 2. Türkiye Saati ve Tarihi Oluşturma (Europe/Istanbul)
    const trTarih = new Intl.DateTimeFormat('tr-TR', {
        timeZone: 'Europe/Istanbul',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).format(new Date());

    try {
        // 3. Bildirimi Veritabanına Kaydet (Android'deki bildirim listesi için)
        if (db) {
            await db.execute(
                "INSERT INTO bildirimler (baslik, mesaj, tarih) VALUES (?, ?, ?)",
                [baslik, mesaj, trTarih]
            );
        }

        // 4. Canlı Yayın: Socket.io ile Android'e Fırlat
        const io = req.app.get('socketio'); 
        if (io) {
            io.emit('yeni_bildirim', {
                baslik: baslik,
                mesaj: mesaj,
                tur: tur,
                tarih: trTarih,
                okundu: false // Başlangıçta okunmadı (Mavi arka plan için)
            });
            console.log(`📢 ${baslik} Android'e gönderildi. Saat: ${trTarih}`);
        }

        res.json({ success: true, status: "Bildirim dağıtıldı" });

    } catch (err) {
        console.error("❌ Bildirim Dağıtım Hatası:", err.message);
        res.status(500).json({ error: "Sinyal dağıtılamadı" });
    }
});

 


// Çevrimiçi kullanıcıları tutar: { "userId": "socketId" }
let onlineUsers = new Map(); 

io.on('connection', (socket) => {
    console.log('🔌 Yeni Bağlantı:', socket.id);

    // --- 1. GİRİŞ VE DURUM ---
    socket.on('giris_yap', (userId) => {
        onlineUsers.set(String(userId), socket.id);
        console.log(`✅ Kullanıcı Giriş Yaptı: ${userId}`);
        io.emit('kullanici_durumu', { userId: userId, status: 'online' });
    });

    socket.on('durum_sorgula', (hedefId) => {
        const isOnline = onlineUsers.has(String(hedefId));
        socket.emit('durum_cevabi', { 
            userId: hedefId, 
            status: isOnline ? 'online' : 'offline' 
        });
    });

    // --- 2. MESAJ GÖNDERME (SPINNER BURADA YÖNETİLİYOR) ---
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
                console.log(`💾 Mesaj Kaydedildi (ID: ${dbId}) - Tür: ${tip}`);

            } catch (err) { 
                console.error("❌ DB Hatası:", err); 
            }
        }

        socket.emit('mesaj_iletildi', { 
            tempId: tempId, 
            serverId: dbId, 
            success: true 
        });

        const hedefSocketId = onlineUsers.get(String(alici_id));
        if (hedefSocketId) {
            io.to(hedefSocketId).emit('yeni_mesaj', {
                id: dbId,
                gonderen_id,
                mesaj,
                image_data,
                file_type: file_type || 'text',
                tarih: new Date().toISOString()
            });
        }
    });

    // --- 3. ARAMA (SESLİ / GÖRÜNTÜLÜ) ---
    socket.on('arama_yap', (data) => {
        const hedefSocketId = onlineUsers.get(String(data.hedefId));
        if (hedefSocketId) {
            console.log(`📞 Arama Başladı: ${data.callerName} -> ${data.hedefId}`);
            io.to(hedefSocketId).emit('gelen_arama', {
                caller_name: data.callerName,
                call_type: data.callType, 
                caller_id: data.myId
            });
        } else {
            socket.emit('arama_hatasi', { mesaj: "Kullanıcı çevrimdışı" });
        }
    });

    socket.on('arama_bitir', (data) => {
        const hedefSocketId = onlineUsers.get(String(data.hedefId));
        if (hedefSocketId) {
            io.to(hedefSocketId).emit('arama_bitir', {});
        }
    });

    // --- 4. YAZIYOR EFEKTİ ---
    socket.on('yaziyor_basladi', (data) => {
        const hedefSocketId = onlineUsers.get(String(data.target_id));
        if (hedefSocketId) io.to(hedefSocketId).emit('karsi_taraf_yaziyor', { status: true });
    });

    // --- 5. ÇIKIŞ ---
    socket.on('disconnect', () => {
        let uid = [...onlineUsers.entries()].find(([k, v]) => v === socket.id)?.[0];
        if (uid) {
            onlineUsers.delete(uid);
            console.log(`❌ Kullanıcı Ayrıldı: ${uid}`);
            io.emit('kullanici_durumu', { userId: uid, status: 'offline' });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`🚀 Sunucu ${PORT} portunda dinlemede!`); });
