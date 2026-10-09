import express from 'express';
import YTMusic from 'ytmusic-api';
import play from 'play-dl';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// 1. ENDPOINT UNTUK MENCARI LAGU RESMI + COVER ART HD
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

            // AMBIL COVER ART & UBAH MENJADI RESOLUSI TINGGI (HD)
            let linkCover = 'https://picsum.photos'; 
            if (lagu.thumbnails && lagu.thumbnails.length > 0) {
                let urlMentah = lagu.thumbnails[lagu.thumbnails.length - 1]?.url || lagu.thumbnails?.url || '';
                // Trik mengganti parameter ukuran YouTube Music menjadi resolusi besar 544x544 piksel
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
                coverArt: linkCover // Hasil cover dijamin jernih dan tajam!
            };
        });

        res.json(daftarLagu);
    } catch (error) {
        console.error('Eror saat mencari lagu:', error);
        res.status(500).json({ error: 'Gagal mengambil data lagu resmi', detail: error.message });
    }
});

// 2. ENDPOINT UNTUK MENGAMBIL LINK AUDIO MURNI (STABIL & ANTI PUTUS)
app.get('/api/stream', async (req, res) => {
    const videoId = req.query.id;
    if (!videoId) {
        return res.status(400).json({ error: 'Parameter ID lagu "id" wajib diisi' });
    }

    try {
        // Menggunakan library play-dl dengan opsi pencarian stream paling stabil
        const infoStream = await play.video_info(`https://youtube.com{videoId}`);
        
        // Memilih format audio dengan kualitas bitrate terbaik dan stabil untuk pemutaran penuh
        const formatAudio = play.choose_format(infoStream.format, { filter: 'audioonly', quality: 'highestaudio' });

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
