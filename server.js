import express from 'express';
import YTMusic from 'ytmusic-api';
import fetch from 'node-fetch';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// ========================================================
// 1. ENDPOINT UNTUK MENCARI LAGU RESMI + COVER ART HD
// ========================================================
app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Parameter pencarian "q" wajib diisi' });

    try {
        const ytmusic = new YTMusic();
        await ytmusic.initialize();
        const hasilPencarian = await ytmusic.searchSongs(query);
        
        if (!hasilPencarian || hasilPencarian.length === 0) return res.json([]);

        const daftarLagu = hasilPencarian.slice(0, 15).map(lagu => {
            let namaArtis = 'Unknown Artist';
            if (lagu.artists && Array.isArray(lagu.artists)) {
                namaArtis = lagu.artists.map(a => a.name).join(', ');
            }

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
// 2. ENDPOINT STREAM AUDIO (PERBAIKAN: BEBAS SALAH KETIK)
// ========================================================
app.get('/api/stream', async (req, res) => {
    const videoId = req.query.id;
    if (!videoId) return res.status(400).json({ error: 'Parameter ID wajib diisi' });

    // Daftar server Invidious publik cadangan yang sangat stabil
    const serverInvidious = [
        'https://nerdvpn.de',
        'https://yewtu.be',
        'https://flokinet.to',
        'https://tux.digital'
    ];

    for (const baseInstance of serverInvidious) {
        try {
            console.log(`Mencoba mengekstrak audio lewat instance: ${baseInstance}`);
            const urlTarget = `${baseInstance}/api/v1/videos/${videoId}`;
            
            const response = await fetch(urlTarget, { timeout: 6000 });
            if (!response.ok) continue;

            const data = await response.json();
            
            if (data && data.adaptiveFormats) {
                const formatAudio = data.adaptiveFormats.find(f => f.type && f.type.startsWith('audio/'));

                if (formatAudio && formatAudio.url) {
                    console.log(`SUKSES mendapatkan link musik dari: ${baseInstance}`);
                    return res.json({
                        urlAudioMurni: formatAudio.url,
                        kualitas: "High Quality Audio Stream"
                    });
                }
            }
        } catch (err) {
            console.error(`Gagal di instance ${baseInstance}:`, err.message);
        }
    }

    res.status(404).json({ error: 'Semua jalur pipa audio cadangan sedang sibuk. Coba lagi.' });
});

app.listen(port, () => {
    console.log(`Server aktif di port ${port}`);
});
