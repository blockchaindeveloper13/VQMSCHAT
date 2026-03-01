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
