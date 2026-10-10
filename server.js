import express from 'express';
import cors from 'cors';
import YTMusic from 'ytmusic-api';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, 'public');

app.use(cors());
app.use(express.json());
app.use(express.static(publicDir));

app.get('/', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
});

app.get('/api/search', async (req, res) => {
    const query = String(req.query.q || '').trim();

    if (!query) {
        return res.status(400).json({
            error: 'Isi parameter pencarian q'
        });
    }

    const q = query
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    // Pakai cover lokal untuk lagu ini, bukan thumbnail hasil pencarian.
    if (
        q.includes('aku jatuh cinta') &&
        (
            q.includes('rakha') ||
            q.includes('basmalah') ||
            q.includes('basmallah') ||
            !q.includes('kartika')
        )
    ) {
        return res.json([
            {
                id: 'ZRMMpzpVjtQ',
                judul: 'Aku Jatuh Cinta',
                artis: 'Raden Rakha & Basmalah',
                album: 'Aku Jatuh Cinta (OST Magic 5)',
                coverArt:
                    'https://server-kappa-black-72.vercel.app/covers/aku-jatuh-cinta.jpg'
            }
        ]);
    }

    try {
        const ytmusic = new YTMusic();
        await ytmusic.initialize();

        const results = await ytmusic.search(query);

        const normalize = text =>
            String(text || '')
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^\p{L}\p{N}\s]/gu, ' ')
                .replace(/\s+/g, ' ')
                .trim();

        const normalizedQuery = normalize(query);
        const queryWords = normalizedQuery
            .split(' ')
            .filter(word => word.length > 1);

        function getScore(item) {
            const title = normalize(item.name);

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

            if (normalizedQuery && title.includes(normalizedQuery)) {
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
        console.error('Search error:', error);

        return res.status(500).json({
            error: 'Pencarian gagal',
            detail: error.message
        });
    }
});

export default app;
