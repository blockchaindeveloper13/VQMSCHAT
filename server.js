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

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Çevrimiçi kullanıcıları tutar: { "userId": "socketId" }
let onlineUsers = new Map(); 

io.on('connection', (socket) => {
    console.log('🔌 Yeni Bağlantı:', socket.id);

    // --- 1. GİRİŞ VE DURUM ---
    socket.on('giris_yap', (userId) => {
        onlineUsers.set(String(userId), socket.id);
        console.log(`✅ Kullanıcı Giriş Yaptı: ${userId}`);
        // Herkese haber ver (İsteğe bağlı, trafik yapmasın diye sadece ilgiliye dönebiliriz)
        io.emit('kullanici_durumu', { userId: userId, status: 'online' });
    });

    socket.on('durum_sorgula', (hedefId) => {
        const isOnline = onlineUsers.has(String(hedefId));
        // Sadece soran kişiye cevap dön
        socket.emit('durum_cevabi', { 
            userId: hedefId, 
            status: isOnline ? 'online' : 'offline' 
        });
    });

    // --- 2. MESAJ GÖNDERME (SPINNER BURADA YÖNETİLİYOR) ---
    socket.on('mesaj_gonder', async (data) => {
        // Data içeriği: { gonderen_id, alici_id, mesaj, image_data, file_type, tempId }
        // tempId: Android tarafında üretilen geçici kimlik (Spinner'ı durdurmak için şifre)
        
        const { gonderen_id, alici_id, mesaj, image_data, file_type, tempId } = data;
        let dbId = 0;

        // A) Veritabanına Kaydet
        if (db) {
            try {
                // Dosya tipi boşsa 'text' kabul et, doluysa (video/pdf/image) onu yaz
                const tip = file_type || (image_data ? 'image' : 'text');
                
                const [result] = await db.execute(
                    "INSERT INTO mesajlar (gonderen_id, alici_id, mesaj, dosya, dosya_tipi) VALUES (?, ?, ?, ?, ?)",
                    [gonderen_id, alici_id, mesaj, image_data || null, tip]
                );
                dbId = result.insertId;
                console.log(`💾 Mesaj Kaydedildi (ID: ${dbId}) - Tür: ${tip}`);

            } catch (err) { 
                console.error("❌ DB Hatası:", err); 
                // Hata olsa bile kullanıcıya "Hata oluştu" diyebilmek için aşağı devam ediyoruz
            }
        }

        // B) GÖNDERENE "BEN ALDIM" DE (Spinner'ı Durdurur)
        // Android bu 'mesaj_iletildi' sinyalini alınca o dönen şeyi gizleyecek.
        socket.emit('mesaj_iletildi', { 
            tempId: tempId, // Hangi mesajın gittiğini bildiriyoruz
            serverId: dbId, 
            success: true 
        });

        // C) ALICIYA İLET
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
                call_type: data.callType, // 'video' veya 'voice'
                caller_id: data.myId
            });
        } else {
            // Kullanıcı yoksa arayana bildir
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
        // Map'ten kullanıcıyı bul ve sil
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
