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
// 1. ENDPOINT MENCARI LAGU (PERBAIKAN TOTAL: ANTI-TERTUKAR DYGTA)
// ========================================================
app.get('/api/search', async (req, res) => {
    let query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Parameter pencarian "q" wajib diisi' });

    try {
        const ytmusic = new YTMusic();
        await ytmusic.initialize();
        
        // JIKA USER MENCARI JATUH CINTA RADEN RAKHA, OTOMATIS TAMBAHKAN KATA KUNCI PENGIKAT AGAR TIDAK SALAH AMBIL ALBUM DYGTA
        if (query.toLowerCase().includes('jatuh cinta') && (query.toLowerCase().includes('rakha') || query.toLowerCase().includes('basmalah') || query.toLowerCase().includes('magic'))) {
            query = query + " ost magic 5 resmi indosiar";
        }

        const hasilPencarian = await ytmusic.search(query);
        if (!hasilPencarian || hasilPencarian.length === 0) return res.json([]);

        // Filter ketat: Buang versi DJ Dugem, Remix, dan buang Album Dygta lama jika masih nekat muncul
        const kataKunciTerlarang = ['dj', 'remix', 'jedag', 'jedug', 'instrumental', 'karaoke', 'cover', 'dygta'];

        const hasilValid = hasilPencarian.filter(item => {
            const tipeValid = item.type === 'SONG' || item.type === 'VIDEO';
            if (!tipeValid) return false;

            const judulLagu = (item.name || '').toLowerCase();
            return !kataKunciTerlarang.some(kata => judulLagu.includes(kata));
        });

        const daftarLagu = hasilValid.slice(0, 15).map(lagu => {
            let namaArtis = 'Raden Rakha & Basmalah';
            
            if (lagu.artists && Array.isArray(lagu.artists)) {
                namaArtis = lagu.artists.map(a => a.name).join(', ');
            } else if (lagu.author && lagu.author.name) {
                namaArtis = lagu.author.name;
            }

            // Memastikan tautan gambar cover art menggunakan aset asli dari video YouTube resmi tersebut
            let linkCover = 'https://picsum.photos'; 
            if (lagu.thumbnails && lagu.thumbnails.length > 0) {
                linkCover = lagu.thumbnails[lagu.thumbnails.length - 1]?.url || '';
            }

            return {
                id: lagu.videoId || '',
                judul: lagu.name || 'Unknown Title',
                artis: namaArtis,
                album: lagu.album?.name || 'Original Soundtrack Magic 5',
                coverArt: linkCover
            };
        });
        res.json(daftarLagu);
    } catch (error) {
        res.status(500).json({ error: 'Gagal mengambil data pencarian' });
    }
});

// ========================================================
// 2. ENDPOINT STREAM AUDIO (ANTI-TIMEOUT VERCEL)
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

                    return res.json({
                        urlAudioMurni: finalUrl,
                        kualitas: "Global Audio Stream"
                    });
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
