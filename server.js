import express from 'express';
import YTMusic from 'ytmusic-api';
import ytdl from '@distube/ytdl-core';

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

// 2. ENDPOINT STREAM AUDIO (VERSI SUPER CEPAT & ANTI-TIMEOUT VERCEL)
app.get('/api/stream', async (req, res) => {
    const videoId = req.query.id;
    if (!videoId) return res.status(400).json({ error: 'Parameter ID wajib diisi' });

    try {
        // Menggunakan ytdl-core untuk mendapatkan info streaming secara instan dalam milidetik
        const info = await ytdl.getInfo(`https://youtube.com{videoId}`);
        
        // Pilih format audio murni terbaik (audioonly)
        const formatAudio = ytdl.chooseFormat(info.formats, { filter: 'audioonly', quality: 'highestaudio' });

        if (!formatAudio || !formatAudio.url) {
            return res.status(404).json({ error: 'Audio stream tidak ditemukan' });
        }

        // Kirim format JSON resmi yang ditunggu oleh Android kamu
        res.json({
            urlAudioMurni: formatAudio.url,
            kualitas: "High Quality Audio"
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Gagal mengekstrak audio' });
    }
});

app.listen(port, () => {
    console.log(`Server aktif di port ${port}`);
});
