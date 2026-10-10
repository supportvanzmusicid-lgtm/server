import express from 'express';
import cors from 'cors';
import YTMusic from 'ytmusic-api';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const port = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public'))); 

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========================================================
// 1. ENDPOINT MENCARI LAGU (SISTEM KUNCI ID MUTLAK)
// ========================================================
app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Parameter pencarian wajib diisi' });

    const lowQuery = query.toLowerCase();

    // TRIK SAKTI: Jika terdeteksi mencari lagu Raden Rakha / Magic 5, bypass pencarian dan kunci ke ID Video Klip Aslinya!
    if (lowQuery.includes('jatuh cinta') && (lowQuery.includes('rakha') || lowQuery.includes('basmalah') || lowQuery.includes('magic') || lowQuery.includes('vanz'))) {
        console.log("Sistem mengunci hasil pencarian khusus ke lagu asli Raden Rakha!");
        return res.json([
            {
                id: "Bke1qKq9FpU", // ID Video Klip Resmi "Jatuh Cinta" Raden Rakha & Basmalah di YouTube
                judul: "Jatuh Cinta (OST Magic 5)",
                artis: "Raden Rakha & Basmalah",
                album: "Original Soundtrack Indosiar",
                coverArt: "https://youtube.com" // Mengunci cover art resmi dari thumbnail video YouTube asli
            }
        ]);
    }

    // Jika mencari lagu lain selain Raden Rakha, jalankan pencarian normal bawaan ytmusic-api
    try {
        const ytmusic = new YTMusic();
        await ytmusic.initialize();
        const hasilPencarian = await ytmusic.search(query);
        
        if (!hasilPencarian || hasilPencarian.length === 0) return res.json([]);

        const kataKunciTerlarang = ['dj', 'remix', 'jedag', 'jedug', 'instrumental', 'karaoke', 'cover', 'dygta'];
        const hasilValid = hasilPencarian.filter(item => {
            const tipeValid = item.type === 'SONG' || item.type === 'VIDEO';
            if (!tipeValid) return false;
            const judulLagu = (item.name || '').toLowerCase();
            return !kataKunciTerlarang.some(kata => judulLagu.includes(kata));
        });

        const daftarLagu = hasilValid.slice(0, 15).map(lagu => {
            let namaArtis = 'Unknown Artist';
            if (lagu.artists && Array.isArray(lagu.artists)) {
                namaArtis = lagu.artists.map(a => a.name).join(', ');
            } else if (lagu.author && lagu.author.name) {
                namaArtis = lagu.author.name;
            }

            let linkCover = 'https://picsum.photos'; 
            if (lagu.thumbnails && lagu.thumbnails.length > 0) {
                linkCover = lagu.thumbnails[lagu.thumbnails.length - 1]?.url || '';
            }

            return {
                id: lagu.videoId || '',
                judul: lagu.name || 'Unknown Title',
                artis: namaArtis,
                album: lagu.album?.name || 'Single',
                coverArt: linkCover
            };
        });
        res.json(daftarLagu);
    } catch (error) {
        res.status(500).json({ error: 'Gagal mengambil data' });
    }
});

// ========================================================
// 2. ENDPOINT STREAM AUDIO (BYPASS INSTAN TANPA LELET)
// ========================================================
app.get('/api/stream', async (req, res) => {
    const videoId = req.query.id;
    if (!videoId) return res.status(400).json({ error: 'Parameter ID wajib diisi' });

    const serverInvidious = [
        'https://yewtu.be',
        'https://nerdvpn.de',
        'https://flokinet.to',
        'https://tux.digital'
    ];

    for (const baseInstance of serverInvidious) {
        try {
            const urlTarget = `${baseInstance}/api/v1/videos/${videoId}?local=true`;
            const response = await fetch(urlTarget, { timeout: 5000 });
            if (!response.ok) continue;

            const data = await response.json();
            if (data && data.adaptiveFormats) {
                const formatAudio = data.adaptiveFormats.find(f => f.type && f.type.startsWith('audio/'));
                if (formatAudio && formatAudio.url) {
                    let finalUrl = formatAudio.url;
                    if (finalUrl.startsWith('/')) {
                        finalUrl = `${baseInstance}${finalUrl}`;
                    }
                    return res.json({ urlAudioMurni: finalUrl });
                }
            }
        } catch (err) {
            console.error(`Gagal di instance ${baseInstance}:`, err.message);
        }
    }
    res.status(404).json({ error: 'Jalur pipa audio sedang sibuk.' });
});

app.listen(port, () => {
    console.log(`Server aktif di port ${port}`);
});
