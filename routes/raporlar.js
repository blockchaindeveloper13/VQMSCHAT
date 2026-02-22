const express = require('express');
const router = express.Router();
const db = require('../config/db'); // Veritabanı bağlantısı

// ==========================================
// 1. KALİTE RAPORLARI (Android'in ?page=1 talebine uyarlandı)
// ==========================================
router.get('/kalite', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const offset = (page - 1) * limit;

        const [rows] = await db.query("SELECT * FROM reports ORDER BY id DESC LIMIT ? OFFSET ?", [limit, offset]);
        res.json(rows);
    } catch (err) {
        console.error("❌ Kalite Listesi SQL Hatası:", err.message);
        res.status(500).json({ error: 'Kalite listesi alınamadı', detay: err.message });
    }
});

// ==========================================
// 2. KALİTE DETAY (Kayıp satırları Android'e 'detayListesi' adıyla gönderir)
// ==========================================
router.get('/kalite-detay/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [anaData] = await db.query("SELECT * FROM reports WHERE id = ?", [id]);
        const [detayListesi] = await db.query("SELECT * FROM report_details WHERE report_id = ? ORDER BY id ASC", [id]);
        
        if (anaData.length === 0) {
            return res.status(404).json({ error: "Rapor bulunamadı" });
        }
        
        // Android tarafı 'detayListesi' aradığı için ismini tam eşledik
        res.json({
            anaData: anaData[0],
            detayListesi: detayListesi
        });
    } catch (err) {
        console.error("❌ Kalite Detay SQL Hatası:", err.message);
        res.status(500).json({ error: "Sunucu hatası", detay: err.message });
    }
});

// ==========================================
// 3. VERİMLİLİK RAPORLARI
// ==========================================
router.get('/verimlilik', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM uretim_verimlilik ORDER BY id DESC");
        res.json(rows);
    } catch (err) {
        console.error("❌ Verimlilik Listesi Hatası:", err.message);
        res.status(500).json({ error: 'Verimlilik raporları alınamadı' });
    }
});

// ==========================================
// 4. GÜNLÜK RAPORLAR 
// ==========================================
router.get('/gunluk', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM gunluk_raporlar ORDER BY id DESC");
        res.json(rows);
    } catch (err) {
        console.error("❌ Günlük Rapor Hatası:", err.message);
        res.status(500).json({ error: 'Günlük raporlar alınamadı' });
    }
});

// ==========================================
// 5. ÜRETİM RAPORLARI (Akıllı Sayfalama)
// ==========================================
router.get('/uretim', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        const [countResult] = await db.query("SELECT COUNT(*) as total FROM uretim_ana");
        const totalCount = countResult[0].total;

        const query = `SELECT * FROM uretim_ana ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`;
        const [rows] = await db.query(query);
        
        res.json({ data: rows, totalCount: totalCount });
    } catch (err) {
        console.error("❌ Üretim Rapor Listesi Hatası:", err.message);
        res.status(500).json({ error: 'Üretim raporları alınamadı' });
    }
});

router.get('/uretim-detay/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [anaData] = await db.query("SELECT * FROM uretim_ana WHERE id = ?", [id]);
        const [detayListesi] = await db.query("SELECT * FROM uretim_detay WHERE uretim_id = ?", [id]);
        if (anaData.length === 0) return res.status(404).json({ error: "Rapor bulunamadı" });
        res.json({ anaData: anaData[0], detayListesi: detayListesi });
    } catch (err) {
        console.error("❌ Üretim Detay Hatası:", err.message);
        res.status(500).json({ error: "Sunucu hatası" });
    }
});

// ==========================================
// 6. MAVİ TIK MOTORU (500 HATASININ ASIL MERKEZİ)
// ==========================================
router.post('/goruntulenme/ekle', async (req, res) => {
    const { rapor_turu, rapor_id, kullanici_adi } = req.body;
    try {
        // İŞTE SİHİRLİ KOD BURASI: "ON DUPLICATE KEY UPDATE"
        // Eğer Vedat bu raporu daha önce gördüyse çökme, sadece "tarih" saatini şu anki saate (NOW) çek!
        const insertQuery = `
            INSERT INTO rapor_goruntulenme (rapor_turu, rapor_id, kullanici_adi, tarih) 
            VALUES (?, ?, ?, NOW()) 
            ON DUPLICATE KEY UPDATE tarih = NOW()
        `;
        
        await db.query(insertQuery, [rapor_turu, String(rapor_id), kullanici_adi]);
        
        res.json({ success: true });
    } catch (err) {
        console.error("❌ MAVİ TIK 500 PATLAMASI:", err.message);
        res.status(500).json({ error: 'İşlem başarısız', detay: err.message });
    }
});

router.get('/goruntulenme/:turu/:id', async (req, res) => {
    const { turu, id } = req.params;
    try {
        const query = `SELECT kullanici_adi, DATE_ADD(tarih, INTERVAL 3 HOUR) as tarih FROM rapor_goruntulenme WHERE rapor_turu = ? AND rapor_id = ? ORDER BY tarih ASC`;
        const [rows] = await db.query(query, [turu, String(id)]);
        res.json(rows);
    } catch (err) {
        console.error("❌ Kimler Gördü SQL Hatası:", err.message);
        res.status(500).json({ error: 'Görenler alınamadı', detay: err.message });
    }
});

module.exports = router;
