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
        // Inisialisasi baru setiap kali request agar koneksinya selalu segar
        const ytmusic = new YTMusic();
        await ytmusic.initialize(); // WAJIB di-initialize dulu agar tidak eror di Vercel
        
        // Melakukan pencarian lagu murni
        const hasilPencarian = await ytmusic.searchSongs(query);
        
        // Ambil data penting saja untuk dikirim ke Android kamu
        const daftarLagu = hasilPencarian.slice(0, 15).map(lagu => ({
            id: lagu.videoId,
            judul: lagu.name,
            artis: lagu.artists.map(a => a.name).join(', '),
            album: lagu.album?.name || 'Single',
            coverArt: lagu.thumbnails[lagu.thumbnails.length - 1]?.url // Cover kualitas tertinggi
        }));

        res.json(daftarLagu);
    } catch (error) {
        console.error('Eror saat mencari lagu:', error);
        res.status(500).json({ error: 'Gagal mengambil data lagu resmi', detail: error.message });
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
        res.status(500).json({ error: 'Gagal mengekstrak audio murni', detail: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server aktif di port ${port}`);
});
