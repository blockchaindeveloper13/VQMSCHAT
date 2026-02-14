require('dotenv').config(); // Ayarları yükle
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const bodyParser = require('body-parser');
const cors = require('cors');
const db = require('./config/db'); // MySQL bağlantı dosyan (pool.promise() kullanan)

// MODÜLLERİ ÇAĞIR
const profilRoutes = require('./routes/profil');
const raporRoutes = require('./routes/raporlar');
// const socketHandler = require('./sockets/aramaSocket'); // BUNU İPTAL ETTİK, KODU İÇERİ ALDIK

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' })); // Resimler için limiti artırdık
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// ROTALARI TANIMLA
app.use('/api/profil', profilRoutes);
app.use('/api/raporlar', raporRoutes);

app.get('/', (req, res) => {
    res.send('V-QMSPRO Sunucusu Aktif! (Online Takip + Resim Destekli + Veritabanı Kayıtlı)');
});

// SUNUCU VE SOCKET KURULUMU
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// --- HAFIZA (KİM ONLİNE?) ---
// Burası sunucunun beynidir. Kimin hangi soket ID'sine sahip olduğunu tutar.
let onlineUsers = new Map(); 

io.on('connection', (socket) => {
    console.log('Bir kullanıcı bağlandı:', socket.id);

    // --- YENİ: TÜM MESAJ GEÇMİŞİNİ YÜKLE ---
    socket.on('eski_mesajlari_yukle', async (data) => {
        try {
            // İki kullanıcı arasındaki tüm mesajları (limit olmadan) getiriyoruz
            const [rows] = await db.execute(
                `SELECT * FROM messages 
                 WHERE (gonderen_id = ? AND alici_id = ?) 
                 OR (gonderen_id = ? AND alici_id = ?) 
                 ORDER BY tarih ASC`,
                [data.myId, data.hedefId, data.hedefId, data.myId]
            );
            socket.emit('eski_mesajlar', rows);
        } catch (err) {
            console.error("Veritabanından geçmiş çekilirken hata oluştu:", err);
        }
    });

    // 1. KULLANICI GİRİŞ YAPTIĞINDA
    socket.on('giris_yap', (userId) => {
        onlineUsers.set(String(userId), socket.id);
        console.log(`Kullanıcı ID: ${userId} şimdi ONLİNE.`);
        
        // Herkese haber ver: "Bu kişi online oldu"
        io.emit('kullanici_durumu_guncelle', { userId: userId, status: 'online' });
    });

    // 2. DURUM SORGULAMA (Android: "Şu kişi online mı?")
    socket.on('durum_sorgula', (hedefId) => {
        const isOnline = onlineUsers.has(String(hedefId));
        // Sadece soran kişiye cevap dön
        socket.emit('durum_cevabi', { 
            userId: hedefId,
            status: isOnline ? 'online' : 'offline' 
        });
    });

    // 3. MESAJ VE RESİM GÖNDERME (Veritabanı Kaydı Eklendi)
    socket.on('mesaj_gonder', async (data) => {
        // data içinde: gonderen_id, alici_id, mesaj, image_data (opsiyonel) var
        console.log(`Mesaj: ${data.gonderen_id} -> ${data.alici_id}`);

        try {
            // VERİTABANINA KAYDET (Fotoğraf, video veya metin fark etmeksizin image_data içinde tutulur)
            await db.execute(
                "INSERT INTO messages (gonderen_id, alici_id, mesaj, image_data) VALUES (?, ?, ?, ?)",
                [data.gonderen_id, data.alici_id, data.mesaj, data.image_data || null]
            );

            const hedefSocketId = onlineUsers.get(String(data.alici_id));

            if (hedefSocketId) {
                // Hedef online ise direkt gönder
                io.to(hedefSocketId).emit('yeni_mesaj', data);
            } else {
                console.log('Hedef kullanıcı çevrimdışı.');
                // İleride buraya bildirim (Push Notification) eklenebilir.
            }
        } catch (err) {
            console.error("Mesaj veritabanına kaydedilirken hata:", err);
        }
    });

    // 4. "YAZIYOR..." ÖZELLİĞİ
    socket.on('yaziyor_basladi', (data) => {
        const hedefSocketId = onlineUsers.get(String(data.target_id));
        if (hedefSocketId) {
            io.to(hedefSocketId).emit('yaziyor_durumu', { typing: true });
        }
    });

    // 5. BAĞLANTI KOPTUĞUNDA (Çıkış)
    socket.on('disconnect', () => {
        let disconnectedUserId = null;
        
        // Listeden kimin çıktığını bul
        for (let [uid, sid] of onlineUsers.entries()) {
            if (sid === socket.id) {
                disconnectedUserId = uid;
                onlineUsers.delete(uid); // Listeden sil
                break;
            }
        }

        if (disconnectedUserId) {
            console.log(`Kullanıcı ID: ${disconnectedUserId} ÇIKIŞ YAPTI.`);
            // Herkese haber ver: "Bu kişi offline oldu"
            io.emit('kullanici_durumu_guncelle', { userId: disconnectedUserId, status: 'offline' });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda dinlemede...`);
});
