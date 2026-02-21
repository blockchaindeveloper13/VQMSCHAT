const express = require('express');
const router = express.Router();
const db = require('../config/db');

// 1. Günlük Rapor Listesi (Sınırsız)
router.get('/gunluk', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM gunluk_raporlar ORDER BY tarih DESC');
        res.json(rows); // Android'e JSON array olarak gider
    } catch (err) {
        res.status(500).json({ error: 'Günlük raporlar alınamadı' });
    }
});

// 2. Üretim Rapor Listesi (Sınırsız)
router.get('/uretim', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM uretim_raporlar ORDER BY id DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Üretim raporları alınamadı' });
    }
});

// 3. Kalite Rapor Listesi (Niyazi'yi yakan paketleme fireleri - Sınırsız)
router.get('/kalite', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM kalite_raporlar ORDER BY id DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Kalite raporları alınamadı' });
    }
});

// 4. Verimlilik Rapor Listesi (Sınırsız)
router.get('/verimlilik', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM verimlilik_raporlar ORDER BY id DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Verimlilik raporları alınamadı' });
    }
});

module.exports = router;

// ---------------------------------------------------------
// KALİTE KONTROL DETAY SAYFASI İÇİN API KAPISI
// ---------------------------------------------------------
router.get('/kalite-detay/:id', async (req, res) => {
    try {
        const reportId = req.params.id;
        
        // Önce Ana Rapor verisini çek
        const [anaRows] = await db.query('SELECT * FROM reports WHERE id = ?', [reportId]);
        if (anaRows.length === 0) return res.status(404).json({ error: 'Rapor bulunamadı' });
        
        // Sonra Detay (Kusur/Numune) Tablosunu çek
        const [detayRows] = await db.query('SELECT defect_name, detailed_data, defect_type FROM report_details WHERE report_id = ? ORDER BY id ASC', [reportId]);

        // Paketleyip Android'e gönder
        res.json({
            anaData: anaRows[0],
            detayListesi: detayRows
        });
    } catch (err) {
        res.status(500).json({ error: 'Kalite detayları alınamadı' });
    }
});


// raporlar.js içine eklenecek
router.get('/uretim-detay/:id', async (req, res) => {
    try {
        const uretimId = req.params.id;
        
        const [anaRows] = await db.query('SELECT * FROM uretim_ana WHERE id = ?', [uretimId]);
        if (anaRows.length === 0) return res.status(404).json({ error: 'Rapor bulunamadı' });
        
        const [detayRows] = await db.query('SELECT * FROM uretim_detay WHERE uretim_id = ?', [uretimId]);

        res.json({
            anaData: anaRows[0],
            detayListesi: detayRows
        });
    } catch (err) {
        res.status(500).json({ error: 'Detaylar alınamadı' });
    }
});
