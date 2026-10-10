import express from 'express';
import YTMusic from 'ytmusic-api';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const port = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());

// ========================================================
// MENAMPILKAN KEMBALI WEBSITE UTAMA KAMU (FRONT-END HTML)
// ========================================================
app.use(express.static(path.join(__dirname, 'public'))); 

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========================================================
// 1. ENDPOINT MENCARI LAGU (PERBAIKAN: HASIL PAS & COCOK UNTUK OST)
// ========================================================
app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Parameter pencarian "q" wajib diisi' });

    try {
        const ytmusic = new YTMusic();
        await ytmusic.initialize();
        
        // Menggunakan search umum tanpa filter kaku agar Video Musik/OST Resmi ikut terjaring
        const hasilPencarian = await ytmusic.search(query);
        
        if (!hasilPencarian || hasilPencarian.length === 0) return res.json([]);

        // Menyaring hanya item yang berjenis lagu resmi (SONG) atau video musik (VIDEO)
        const hasilValid = hasilPencarian.filter(item => item.type === 'SONG' || item.type === 'VIDEO');

        const daftarLagu = hasilValid.slice(0, 15).map(lagu => {
            let namaArtis = 'Unknown Artist';
            
            // Mengambil nama penyanyi atau nama channel pengunggah video asli
            if (lagu.artists && Array.isArray(lagu.artists)) {
                namaArtis = lagu.artists.map(a => a.name).join(', ');
            } else if (lagu.author && lagu.author.name) {
                namaArtis = lagu.author.name;
            } else if (lagu.artists && lagu.artists.name) {
                namaArtis = lagu.artists.name;
            }

            // Pemetaan gambar cover art agar kualitasnya HD (tidak pecah di Android)
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
                album: lagu.album?.name || 'Single / OST',
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
            console.log(`Mencoba mengambil link publik dari: ${baseInstance}`);
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

                    console.log(`SUKSES mendapatkan url audio murni`);
                    
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

    res.status(404).json({ error: 'Semua jalur pipa audio cadangan sedang sibuk. Coba lagi nanti.' });
});

app.listen(port, () => {
    console.log(`Server aktif di port ${port}`);
});
