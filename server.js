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

// Mengaktifkan fitur CORS agar aplikasi Android asli kamu bebas masuk tanpa diblokir
app.use(cors());
app.use(express.json());

// ========================================================
// MENAMPILKAN KEMBALI WEBSITE UTAMA KAMU (FRONT-END HTML)
// ========================================================
app.use(express.static(path.join(__dirname, 'public'))); 

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========================================================
// 1. ENDPOINT MENCARI LAGU (ANTI-DJ, ANTI-REMIX & AKURAT)
// ========================================================
app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Parameter pencarian "q" wajib diisi' });

    try {
        const ytmusic = new YTMusic();
        await ytmusic.initialize();
        
        // Menggunakan search umum bawaan ytmusic-api agar Video Musik resmi/OST ikut terjaring
        const hasilPencarian = await ytmusic.search(query);
        
        if (!hasilPencarian || hasilPencarian.length === 0) return res.json([]);

        // Menyaring paksa kata kunci dugem/remix ngasal yang merusak hasil asli
        const kataKunciTerlarang = ['dj', 'remix', 'jedag', 'jedug', 'instrumental', 'karaoke', 'cover'];

        const hasilValid = hasilPencarian.filter(item => {
            const tipeValid = item.type === 'SONG' || item.type === 'VIDEO';
            if (!tipeValid) return false;

            const judulLagu = (item.name || '').toLowerCase();
            return !kataKunciTerlarang.some(kata => judulLagu.includes(kata));
        });

        const daftarLagu = hasilValid.slice(0, 15).map(lagu => {
            let namaArtis = 'Raden Rakha & Basmalah'; // Fallback default untuk OST Magic 5
            
            if (lagu.artists && Array.isArray(lagu.artists)) {
                namaArtis = lagu.artists.map(a => a.name).join(', ');
            } else if (lagu.author && lagu.author.name) {
                namaArtis = lagu.author.name;
            }

            // Pemetaan gambar cover art album agar resolusinya HD (tidak blur di Android)
            let linkCover = 'https://picsum.photos'; 
            if (lagu.thumbnails && lagu.thumbnails.length > 0) {
                let urlMentah = lagu.thumbnails[lagu.thumbnails.length - 1]?.url || '';
                if (urlMentah.includes('=w120-h120')) {
                    linkCover = urlMentah.replace('=w120-h120', '=w544-h544-l90-rj');
                } else if (urlMentah.includes('=w60-h60')) {
                    linkCover = urlMentah.replace('=w60-h60', '=w544-h544-l90-rj');
                } else {
                    linkCover = urlMentah;
                }
            }

            return {
                id: lagu.videoId || '',
                judul: lagu.name || 'Unknown Title',
                artis: namaArtis,
                album: lagu.album?.name || 'Original Soundtrack',
                coverArt: linkCover
            };
        });
        res.json(daftarLagu);
    } catch (error) {
        console.error('Eror pencarian:', error);
        res.status(500).json({ error: 'Gagal mengambil data pencarian' });
    }
});

// ========================================================
// 2. ENDPOINT STREAM AUDIO (ANTI-TIMEOUT VERCEL + ANTI-403)
// ========================================================
app.get('/api/stream', async (req, res) => {
    const videoId = req.query.id;
    if (!videoId) return res.status(400).json({ error: 'Parameter ID wajib diisi' });

    // Node-fetch akan menggilir server cermin publik yang link videonya bebas IP dikunci
    const serverInvidious = [
        'https://yewtu.be',
        'https://nerdvpn.de',
        'https://flokinet.to',
        'https://tux.digital'
    ];

    for (const baseInstance of serverInvidious) {
        try {
            console.log(`Mencoba bypass lewat instance: ${baseInstance}`);
            const urlTarget = `${baseInstance}/api/v1/videos/${videoId}?local=true`;
            
            const response = await fetch(urlTarget, { timeout: 5000 });
            if (!response.ok) continue;

            const data = await response.json();
            
            if (data && data.adaptiveFormats) {
                // Mencari alur biner berformat audio murni
                const formatAudio = data.adaptiveFormats.find(f => f.type && f.type.startsWith('audio/'));

                if (formatAudio && formatAudio.url) {
                    let finalUrl = formatAudio.url;
                    
                    if (finalUrl.startsWith('/')) {
                        finalUrl = `${baseInstance}${finalUrl}`;
                    }

                    console.log(`SUKSES mendapatkan url audio publik`);
                    
                    // Mengembalikan JSON instan agar Vercel langsung selesai (bebas eror timeout)
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

    res.status(404).json({ error: 'Jalur pipa audio sedang sibuk. Silakan coba lagi.' });
});

app.listen(port, () => {
    console.log(`Server aktif di port ${port}`);
});
