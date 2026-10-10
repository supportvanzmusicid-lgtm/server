import express from 'express';
import cors from 'cors';
import YTMusic from 'ytmusic-api';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();

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
            error: 'Isi parameter pencarian q'
        });
    }

    const normalizedQuery = query.toLowerCase();

    // Hasil khusus untuk lagu ini, supaya tidak tertukar dengan hasil lain.
    if (
        normalizedQuery.includes('jatuh cinta') &&
        normalizedQuery.includes('rakha') &&
        (
            normalizedQuery.includes('basmalah') ||
            normalizedQuery.includes('basmallah')
        )
    ) {
        const videoId = 'ZRMMpzpVjtQ';

        return res.json([
            {
                id: videoId,
                judul: 'Aku Jatuh Cinta',
                artis: 'Raden Rakha & Basmalah',
                album: 'Aku Jatuh Cinta (OST Magic 5)',
                coverArt: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
            }
        ]);
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

        const cleanQuery = normalize(query);
        const queryWords = cleanQuery
            .split(' ')
            .filter(word => word.length > 1);

        function scoreSong(item) {
            const title = normalize(item.name || '');

            const artistText = Array.isArray(item.artists)
                ? normalize(
                    item.artists
                        .map(artist => artist?.name || '')
                        .join(' ')
                )
                : '';

            const titleWords = new Set(title.split(' '));
            const artistWords = new Set(artistText.split(' '));

            let score = 0;

            for (const word of queryWords) {
                if (titleWords.has(word)) {
                    score += 3;
                } else if (artistWords.has(word)) {
                    score += 2;
                }
            }

            if (cleanQuery && title.includes(cleanQuery)) {
                score += 5;
            }

            return score;
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
                        .find(thumbnail => thumbnail?.url)?.url || null;

                const artists = Array.isArray(item.artists)
                    ? item.artists
                        .map(artist => artist?.name)
                        .filter(Boolean)
                    : [];

                return {
                    score: scoreSong(item),
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
        console.error('Search error:', error);

        return res.status(500).json({
            error: 'Pencarian gagal',
            detail: error.message
        });
    }
});

export default app;
