import express from 'express';
import YTMusic from 'ytmusic-api';
import fetch from 'node-fetch'; // Library untuk menembak API luar

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// 1. ENDPOINT UNTUK MENCARI LAGU RESMI + COVER ART HD
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

// 2. ENDPOINT STREAM AUDIO (VERSI JALUR CADANGAN - ANTI BLOKIR IP)
app.get('/api/stream', async (req, res) => {
    const videoId = req.query.id;
    if (!videoId) return res.status(400).json({ error: 'Parameter ID wajib diisi' });

    try {
        // Menggunakan API publik Cobalt yang kebal dari blokir IP Vercel biasa
        const response = await fetch('https://cobalt.tools', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                url: `https://youtube.com{videoId}`,
                downloadMode: 'audio', // Hanya mengambil suara murni
                audioFormat: 'mp3',
                audioBitrate: '128'
            })
        });

        const data = await response.json();

        // Cek apakah link audio murni berhasil didapatkan dari server Cobalt
        if (data && data.url) {
            res.json({
                urlAudioMurni: data.url,
                kualitas: "128kbps Audio"
            });
        } else {
            res.status(404).json({ error: 'Audio stream tidak ditemukan via API cadangan' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Gagal mengekstrak audio lewat jalur alternatif' });
    }
});

app.listen(port, () => {
    console.log(`Server aktif di port ${port}`);
});
