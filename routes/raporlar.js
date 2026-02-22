const express = require('express');
const router = express.Router();
const db = require('../config/db');

// 1. Günlük Rapor Listesi
router.get('/gunluk', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM gunluk_raporlar ORDER BY tarih DESC LIMIT 100');
        res.json(rows);
    } catch (err) {
        console.error("❌ Günlük Rapor SQL Hatası:", err);
        res.status(500).json({ error: 'Günlük raporlar alınamadı' });
    }
});

// 2. Üretim Rapor Listesi
router.get('/uretim', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM uretim_ana ORDER BY tarih DESC LIMIT 100');
        res.json(rows);
    } catch (err) {
        console.error("❌ Üretim Rapor SQL Hatası:", err);
        res.status(500).json({ error: 'Üretim raporları alınamadı' });
    }
});

// 3. Kalite Rapor Listesi (SAYFALAMA EKLENDİ)
router.get('/kalite', async (req, res) => {
    try {
        // İstemciden (Android'den) sayfa numarasını al, yoksa 1. sayfa kabul et
        const page = parseInt(req.query.page) || 1;
        const limit = 30; // Her sayfada en fazla 30 rapor gönder
        const offset = (page - 1) * limit;

        // Veritabanından sıradaki 30 kaydı çek
        const query = `SELECT * FROM reports ORDER BY report_date DESC LIMIT ${limit} OFFSET ${offset}`;
        const [rows] = await db.query(query);
        
        res.json(rows);
    } catch (err) {
        console.error("❌ Kalite Rapor SQL Hatası:", err);
        res.status(500).json({ error: 'Kalite raporları alınamadı' });
    }
});

// 4. Verimlilik Rapor Listesi
router.get('/verimlilik', async (req, res) => {
    try {
        // id sütunu olmayabilir, created_at ile sıralıyoruz
        const [rows] = await db.query('SELECT * FROM uretim_verimlilik ORDER BY created_at DESC LIMIT 100');
        res.json(rows);
    } catch (err) {
        console.error("❌ Verimlilik Rapor SQL Hatası:", err);
        res.status(500).json({ error: 'Verimlilik raporları alınamadı' });
    }
});

// 5. Üretim Detay Sayfası
router.get('/uretim-detay/:id', async (req, res) => {
    try {
        const uretimId = req.params.id;
        const [anaRows] = await db.query('SELECT * FROM uretim_ana WHERE id = ?', [uretimId]);
        if (anaRows.length === 0) return res.status(404).json({ error: 'Rapor bulunamadı' });
        
        const [detayRows] = await db.query('SELECT * FROM uretim_detay WHERE uretim_id = ?', [uretimId]);
        res.json({ anaData: anaRows[0], detayListesi: detayRows });
    } catch (err) {
        console.error("❌ Üretim Detay SQL Hatası:", err);
        res.status(500).json({ error: 'Detaylar alınamadı' });
    }
});

// 6. Kalite Detay Sayfası
router.get('/kalite-detay/:id', async (req, res) => {
    try {
        const reportId = req.params.id;
        const [anaRows] = await db.query('SELECT * FROM reports WHERE id = ?', [reportId]);
        if (anaRows.length === 0) return res.status(404).json({ error: 'Rapor bulunamadı' });
        
        const [detayRows] = await db.query('SELECT defect_name, detailed_data, defect_type FROM report_details WHERE report_id = ? ORDER BY id ASC', [reportId]);
        res.json({ anaData: anaRows[0], detayListesi: detayRows });
    } catch (err) {
        console.error("❌ Kalite Detay SQL Hatası:", err);
        res.status(500).json({ error: 'Kalite detayları alınamadı' });
    }
});

// ==========================================
// 🔔 BİLDİRİMLER VE MAVİ TIK (GÖRENLER) API 
// ==========================================

// 7. Android'e son bildirimleri gönder
router.get('/bildirimler', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM bildirimler ORDER BY tarih DESC LIMIT 50');
        res.json(rows);
    } catch (err) {
        console.error("❌ Bildirim çekme hatası:", err);
        res.status(500).json({ error: 'Bildirimler alınamadı' });
    }
});

// 8. Telefondan biri rapora girince (Sessizce) Görüldü at!
router.post('/goruntulenme/ekle', async (req, res) => {
    const { rapor_turu, rapor_id, kullanici_adi } = req.body;
    try {
        // IGNORE: Zaten görmüşse hata verme, boş geç
        const query = `INSERT IGNORE INTO rapor_goruntulenme (rapor_turu, rapor_id, kullanici_adi) VALUES (?, ?, ?)`;
        await db.query(query, [rapor_turu, rapor_id, kullanici_adi]);
        res.json({ success: true, message: 'Görüldü işaretlendi.' });
    } catch (err) {
        console.error("❌ Görüldü hatası:", err);
        res.status(500).json({ error: 'İşlem başarısız' });
    }
});

// 9. Android listedeki 'Göz 👁️' ikonuna basınca görenleri gönder
// Raporlar.js - 9. Metot (Görenleri Getir) sorgusunu bununla değiştir:
router.get('/goruntulenme/:turu/:id', async (req, res) => {
    const { turu, id } = req.params;
    try {
        // DATE_ADD ile tarihe otomatik 3 saat ekliyoruz
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
