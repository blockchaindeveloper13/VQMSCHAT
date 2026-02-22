const express = require('express');
const router = express.Router();
// Veritabanı bağlantını kendi dosya yoluna göre ayarla (Örn: const db = require('../db');)
const db = require('../db'); 

// ==========================================
// 1. ÜRETİM RAPORLARI LİSTESİ (Akıllı Sayfalama + Total Count)
// ==========================================
router.get('/uretim', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        // Toplam rapor sayısını al (Android'deki 1-2-3 butonları için şart)
        const [countResult] = await db.query("SELECT COUNT(*) as total FROM uretim_ana");
        const totalCount = countResult[0].total;

        // Sadece o sayfanın verilerini çek
        const query = `SELECT * FROM uretim_ana ORDER BY tarih DESC LIMIT ${limit} OFFSET ${offset}`;
        const [rows] = await db.query(query);
        
        // Veriyi ve toplam sayıyı Android'e gönder
        res.json({ data: rows, totalCount: totalCount });
    } catch (err) {
        console.error("❌ Üretim Rapor Listesi Hatası:", err);
        res.status(500).json({ error: 'Üretim raporları alınamadı' });
    }
});

// ==========================================
// 2. ÜRETİM RAPORU DETAYI (404 Hatasını Çözen Kapı!)
// ==========================================
router.get('/uretim-detay/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [anaData] = await db.query("SELECT * FROM uretim_ana WHERE id = ?", [id]);
        const [detayListesi] = await db.query("SELECT * FROM uretim_detay WHERE uretim_id = ?", [id]);
        
        if (anaData.length === 0) {
            return res.status(404).json({ error: "Rapor bulunamadı" });
        }
        
        res.json({
            anaData: anaData[0],
            detayListesi: detayListesi
        });
    } catch (err) {
        console.error("❌ Üretim Detay Hatası:", err);
        res.status(500).json({ error: "Sunucu hatası" });
    }
});

// ==========================================
// 3. GÖRÜNTÜLENME (MAVİ TIK) SİNYALİNİ KAYDET
// ==========================================
router.post('/goruntulenme/ekle', async (req, res) => {
    const { rapor_turu, rapor_id, kullanici_adi } = req.body;
    try {
        // Raporu gördüğüne dair veritabanına kayıt atıyoruz
        const insertQuery = `INSERT INTO rapor_goruntulenme (rapor_turu, rapor_id, kullanici_adi) VALUES (?, ?, ?)`;
        await db.query(insertQuery, [rapor_turu, rapor_id, kullanici_adi]);
        
        res.json({ success: true });
    } catch (err) {
        // DÜZELTME: Büyük 'C' yerine küçük 'c' kullandık ki sunucu çökmesin!
        console.error("❌ Görüldü ekleme hatası:", err);
        res.status(500).json({ error: 'İşlem başarısız' });
    }
});

// ==========================================
// 4. KİMLER GÖRDÜ? POPUP'I (+3 Saat Ayarlı)
// ==========================================
router.get('/goruntulenme/:turu/:id', async (req, res) => {
    const { turu, id } = req.params;
    try {
        // DATE_ADD ile tarihe otomatik 3 saat (Türkiye Saati) ekliyoruz
        const query = `
            SELECT kullanici_adi, 
            DATE_ADD(tarih, INTERVAL 3 HOUR) as tarih 
            FROM rapor_goruntulenme 
            WHERE rapor_turu = ? AND rapor_id = ? 
            ORDER BY tarih ASC`;
            
        const [rows] = await db.query(query, [turu, id]);
        res.json(rows);
    } catch (err) {
        console.error("❌ Görenler çekme hatası:", err);
        res.status(500).json({ error: 'Görenler alınamadı' });
    }
});

module.exports = router;
