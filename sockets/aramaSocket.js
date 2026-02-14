module.exports = (io) => {
    // KULLANICI HARİTASI (ID -> Socket ID)
    let onlineUsers = new Map();

    io.on('connection', (socket) => {
        console.log(`Bağlantı: ${socket.id}`);

        // 1. KULLANICI GİRİŞİ
        socket.on('giris_yap', (userId) => {
            const uid = String(userId);
            onlineUsers.set(uid, socket.id);
            console.log(`Kullanıcı ${uid} online oldu.`);
            io.emit('online_users_update', Array.from(onlineUsers.keys()));
        });

        // 2. ARAMA BAŞLATMA
        socket.on('arama_yap', (data) => {
            const targetSocket = onlineUsers.get(String(data.alici_id));
            if (targetSocket) {
                io.to(targetSocket).emit('gelen_arama', data);
            } else {
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

        // 5. KAPATMA
        socket.on('aramayi_kapat', (data) => {
            const targetSocket = onlineUsers.get(String(data.to));
            if (targetSocket) io.to(targetSocket).emit('arama_kapandi');
            io.to(socket.id).emit('arama_kapandi');
        });

        // ÇIKIŞ
        socket.on('disconnect', () => {
            for (let [uid, sid] of onlineUsers.entries()) {
                if (sid === socket.id) {
                    onlineUsers.delete(uid);
                    break;
                }
            }
        });
    });
};
                                                        
