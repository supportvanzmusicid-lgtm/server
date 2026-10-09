import express from 'express';
import YTMusic from 'ytmusicapi';
import play from 'play-dl';

const app = express();
const port = process.env.PORT || 3000;

// Inisialisasi ytmusicapi (Tanpa memerlukan API Key dari Anda)
const ytmusic = new YTMusic();

app.use(express.json());

// 1. ENDPOINT UNTUK MENCARI LAGU RESMI
// Jalur tembak Android: https://vercel.app
app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    if (!query) {
        return res.status(400).json({ error: 'Parameter pencarian "q" wajib diisi' });
    }

    try {
        // Mengunci pencarian pada jenis "SONG" untuk memastikan lagu yang didapat 100% resmi
        const hasilPencarian = await ytmusic.search(query, 'SONG');
        
        // Format ulang struktur data agar rapi dan mudah dibaca oleh Android
        const daftarLagu = hasilPencarian.map(lagu => ({
            id: lagu.videoId,
            judul: lagu.title,
            artis: lagu.artists.map(a => a.name).join(', '),
            album: lagu.album?.name || 'Single',
            coverArt: lagu.thumbnails[lagu.thumbnails.length - 1]?.url // Cover kotak kualitas tertinggi
        }));

        res.json(daftarLagu);
    } catch (error) {
        console.error('Eror saat mencari lagu:', error);
        res.status(500).json({ error: 'Gagal mengambil data lagu resmi' });
    }
});

// 2. ENDPOINT UNTUK MENGAMBIL LINK AUDIO MURNI
// Jalur tembak Android: https://vercel.app
app.get('/api/stream', async (req, res) => {
    const videoId = req.query.id;
    if (!videoId) {
        return res.status(400).json({ error: 'Parameter ID lagu "id" wajib diisi' });
    }

    try {
        // Mengambil informasi streaming audio dari YouTube Music menggunakan play-dl
        const infoStream = await play.video_info(`https://youtube.com{videoId}`);
        
        // Memilih format yang suara saja (audioonly), membuang visual videonya
        const formatAudio = play.choose_format(infoStream.format, { filter: 'audioonly' });

        if (!formatAudio || !formatAudio.url) {
            return res.status(404).json({ error: 'Audio stream tidak ditemukan' });
        }

        // Mengirimkan tautan direct audio murni ke aplikasi Android
        res.json({
            urlAudioMurni: formatAudio.url,
            kualitas: formatAudio.audioBitrate + 'kbps'
        });
    } catch (error) {
        console.error('Eror saat ekstraksi audio:', error);
        res.status(500).json({ error: 'Gagal mengekstrak audio murni' });
    }
});

// Jalankan server lokal (untuk keperluan uji coba di PC)
app.listen(port, () => {
    console.log(`Server aktif di port ${port}`);
});
