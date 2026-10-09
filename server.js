import express from 'express';
import YTMusic from 'ytmusic-api';
import play from 'play-dl';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// ========================================================
// 1. ENDPOINT UNTUK MENCARI LAGU RESMI + COVER ART HD
// ========================================================
app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    if (!query) {
        return res.status(400).json({ error: 'Parameter pencarian "q" wajib diisi' });
    }

    try {
        const ytmusic = new YTMusic();
        await ytmusic.initialize();
        
        const hasilPencarian = await ytmusic.searchSongs(query);
        
        if (!hasilPencarian || hasilPencarian.length === 0) {
            return res.json([]);
        }

        const daftarLagu = hasilPencarian.slice(0, 15).map(lagu => {
            let namaArtis = 'Unknown Artist';
            if (lagu.artists && Array.isArray(lagu.artists)) {
                namaArtis = lagu.artists.map(a => a.name).join(', ');
            } else if (lagu.artist && lagu.artist.name) {
                namaArtis = lagu.artist.name;
            }

            let linkCover = 'https://picsum.photos'; 
            if (lagu.thumbnails && lagu.thumbnails.length > 0) {
                let urlMentah = lagu.thumbnails[lagu.thumbnails.length - 1]?.url || lagu.thumbnails?.url || '';
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
        console.error('Eror saat mencari lagu:', error);
        res.status(500).json({ error: 'Gagal mengambil data lagu resmi', detail: error.message });
    }
});

// ========================================================
// 2. ENDPOINT STREAM AUDIO (PERBAIKAN: KIRIM TEKS LINK LANGSUNG)
// ========================================================
app.get('/api/stream', async (req, res) => {
    const videoId = req.query.id;
    if (!videoId) {
        return res.status(400).send('Parameter ID lagu "id" wajib diisi');
    }

    try {
        const infoStream = await play.stream(`https://youtube.com{videoId}`, {
            quality: 1 
        });

        if (!infoStream || !infoStream.url) {
            return res.status(404).send('Audio stream tidak ditemukan');
        }

        // KUNCI PERBAIKAN: Mengirim teks URL bersih langsung (res.send) agar dibaca mulus oleh Android
        res.setHeader('Content-Type', 'text/plain');
        res.send(infoStream.url);
    } catch (error) {
        console.error('Eror saat ekstraksi audio:', error);
        res.status(500).send('Gagal mengekstrak audio murni');
    }
});

// ========================================================
// 3. ENDPOINT UNTUK MENGAMBIL LIRIK LAGU RESMI
// ========================================================
app.get('/api/lyrics', async (req, res) => {
    const videoId = req.query.id;
    if (!videoId) {
        return res.status(400).json({ error: 'Parameter ID lagu "id" wajib diisi' });
    }

    try {
        const ytmusic = new YTMusic();
        await ytmusic.initialize();
        const detailLagu = await ytmusic.getSong(videoId);
        
        if (!detailLagu || !detailLagu.lyrics) {
            return res.status(404).json({ error: 'Lirik tidak tersedia untuk lagu ini' });
        }
        const teksLirik = await ytmusic.getLyrics(detailLagu.lyrics);
        res.json({ id: videoId, lirik: teksLirik || 'Lirik kosong' });
    } catch (error) {
        res.status(500).json({ error: 'Gagal mengambil lirik' });
    }
});

app.listen(port, () => {
    console.log(`Server aktif di port ${port}`);
});
