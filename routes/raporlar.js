const express = require('express');
const router = express.Router();
const db = require('../config/db'); // Veritabanı bağlantısı

// ==========================================
// 1. KALİTE RAPORLARI (Tablo adı 'reports' olarak düzeltildi!)
// ==========================================
router.get('/kalite', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM reports ORDER BY tarih DESC");
        res.json(rows);
    } catch (err) {
        console.error("❌ Kalite Listesi Hatası:", err);
        res.status(500).json({ error: 'Kalite raporları alınamadı' });
    }
});

// ==========================================
// 2. VERİMLİLİK RAPORLARI (Tablo adı 'uretim_verimlilik' olarak düzeltildi!)
// ==========================================
router.get('/verimlilik', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM uretim_verimlilik ORDER BY created_at DESC");
        res.json(rows);
    } catch (err) {
        console.error("❌ Verimlilik Listesi Hatası:", err);
        res.status(500).json({ error: 'Verimlilik raporları alınamadı' });
    }
});

// ==========================================
// 3. ÜRETİM RAPORLARI LİSTESİ (Akıllı Sayfalama + Total Count)
// ==========================================
router.get('/uretim', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        const [countResult] = await db.query("SELECT COUNT(*) as total FROM uretim_ana");
        const totalCount = countResult[0].total;

        const query = `SELECT * FROM uretim_ana ORDER BY tarih DESC LIMIT ${limit} OFFSET ${offset}`;
        const [rows] = await db.query(query);
        
        res.json({ data: rows, totalCount: totalCount });
    } catch (err) {
        console.error("❌ Üretim Rapor Listesi Hatası:", err);
        res.status(500).json({ error: 'Üretim raporları alınamadı' });
    }
});

// ==========================================
// 4. ÜRETİM RAPORU DETAYI
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
// 5. GÖRÜNTÜLENME (MAVİ TIK) SİNYALİNİ KAYDET
// ==========================================
router.post('/goruntulenme/ekle', async (req, res) => {
    const { rapor_turu, rapor_id, kullanici_adi } = req.body;
    try {
        const insertQuery = `INSERT INTO rapor_goruntulenme (rapor_turu, rapor_id, kullanici_adi) VALUES (?, ?, ?)`;
        await db.query(insertQuery, [rapor_turu, rapor_id, kullanici_adi]);
        
        res.json({ success: true });
    } catch (err) {
        console.error("❌ Görüldü ekleme hatası:", err);
        res.status(500).json({ error: 'İşlem başarısız' });
    }
});

// ==========================================
// 6. KİMLER GÖRDÜ? POPUP'I (+3 Saat Ayarlı)
// ==========================================
router.get('/goruntulenme/:turu/:id', async (req, res) => {
    const { turu, id } = req.params;
    try {
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
