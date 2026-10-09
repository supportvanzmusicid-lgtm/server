import express from 'express';
import YTMusic from 'ytmusic-api';
import play from 'play-dl';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// 1. ENDPOINT UNTUK MENCARI LAGU RESMI
app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    if (!query) {
        return res.status(400).json({ error: 'Parameter pencarian "q" wajib diisi' });
    }

    try {
        const ytmusic = new YTMusic();
        await ytmusic.initialize();
        
        // Melakukan pencarian lagu
        const hasilPencarian = await ytmusic.searchSongs(query);
        
        // PENGAMAN DATA: Memastikan hasilPencarian ada isinya sebelum diproses
        if (!hasilPencarian || hasilPencarian.length === 0) {
            return res.json([]);
        }

        // Format ulang data dengan pengecekan aman agar tidak terjadi eror 'undefined'
        const daftarLagu = hasilPencarian.slice(0, 15).map(lagu => {
            // Ambil nama artis dengan aman
            let namaArtis = 'Unknown Artist';
            if (lagu.artists && Array.isArray(lagu.artists)) {
                namaArtis = lagu.artists.map(a => a.name).join(', ');
            } else if (lagu.artist && lagu.artist.name) {
                namaArtis = lagu.artist.name;
            }

            // Ambil cover art dengan aman
            let linkCover = 'https://picsum.photos'; // gambar default jika kosong
            if (lagu.thumbnails && lagu.thumbnails.length > 0) {
                linkCover = lagu.thumbnails[lagu.thumbnails.length - 1]?.url || lagu.thumbnails[0]?.url;
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
        console.error('Eror saat mencari lagu:', error);
        res.status(500).json({ 
            error: 'Gagal mengambil data lagu resmi', 
            detail: error.message 
        });
    }
});

// 2. ENDPOINT UNTUK MENGAMBIL LINK AUDIO MURNI
app.get('/api/stream', async (req, res) => {
    const videoId = req.query.id;
    if (!videoId) {
        return res.status(400).json({ error: 'Parameter ID lagu "id" wajib diisi' });
    }

    try {
        const infoStream = await play.video_info(`https://youtube.com{videoId}`);
        const formatAudio = play.choose_format(infoStream.format, { filter: 'audioonly' });

        if (!formatAudio || !formatAudio.url) {
            return res.status(404).json({ error: 'Audio stream tidak ditemukan' });
        }

        res.json({
            urlAudioMurni: formatAudio.url,
            kualitas: formatAudio.audioBitrate + 'kbps'
        });
    } catch (error) {
        console.error('Eror saat ekstraksi audio:', error);
        res.status(500).json({ 
            error: 'Gagal mengekstrak audio murni', 
            detail: error.message 
        });
    }
});

app.listen(port, () => {
    console.log(`Server aktif di port ${port}`);
});
