import express from 'express';
import cors from 'cors';
import YTMusic from 'ytmusic-api';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const port = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/search', async (req, res) => {
    const query = String(req.query.q || '').trim();

    if (!query) {
        return res.status(400).json({
            error: 'Parameter pencarian wajib diisi. Contoh: /api/search?q=judul%20lagu'
        });
    }

    try {
        const ytmusic = new YTMusic();
        await ytmusic.initialize();

        const results = await ytmusic.search(query);

        const normalize = (text = '') =>
            String(text)
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^\p{L}\p{N}\s]/gu, ' ')
                .replace(/\s+/g, ' ')
                .trim();

        const queryText = normalize(query);
        const queryWords = queryText
            .split(' ')
            .filter(word => word.length > 1);

        function getScore(item) {
            const title = normalize(item.name || '');

            const artistNames = Array.isArray(item.artists)
                ? item.artists.map(artist => artist?.name || '').join(' ')
                : '';

            const artistText = normalize(artistNames);
            const titleWords = new Set(title.split(' '));
            const artistWords = new Set(artistText.split(' '));

            let points = 0;

            for (const word of queryWords) {
                if (titleWords.has(word)) {
                    points += 3;
                } else if (artistWords.has(word)) {
                    points += 2;
                }
            }

            if (queryText && title.includes(queryText)) {
                points += 5;
            }

            return points;
        }

        const songs = (Array.isArray(results) ? results : [])
            .filter(item =>
                item &&
                item.type === 'SONG' &&
                item.videoId &&
                item.name
            )
            .map(item => {
                const thumbnails = Array.isArray(item.thumbnails)
                    ? item.thumbnails
                    : [];

                const coverArt =
                    [...thumbnails]
                        .reverse()
                        .find(image => image?.url)?.url || null;

                const artists = Array.isArray(item.artists)
                    ? item.artists
                        .map(artist => artist?.name)
                        .filter(Boolean)
                    : [];

                return {
                    score: getScore(item),
                    song: {
                        id: item.videoId,
                        judul: item.name,
                        artis: artists.length
                            ? artists.join(', ')
                            : 'Unknown Artist',
                        album: item.album?.name || null,
                        coverArt
                    }
                };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, 15)
            .map(result => result.song);

        return res.json(songs);
    } catch (error) {
        console.error('Gagal mencari lagu:', error);

        return res.status(500).json({
            error: 'Gagal mengambil hasil pencarian'
        });
    }
});

// Endpoint stream lama sengaja tidak disertakan.

app.listen(port, () => {
    console.log(`Server aktif di port ${port}`);
});
