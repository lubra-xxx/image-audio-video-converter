import express from 'express';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import fetch from 'node-fetch';
import { writeFileSync, readFileSync, unlinkSync } from 'fs';

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
app.use(express.json({ limit: '50mb' }));

app.get('/', (req, res) => {
  res.json({ status: 'Server is running' });
});

app.post('/create-video', async (req, res) => {
  const { imageUrl, audioUrl, duration = 60 } = req.body;

  if (!imageUrl || !audioUrl) {
    return res.status(400).json({ error: 'imageUrl and audioUrl are required' });
  }

  try {
    console.log('Downloading files...');
    
    // Download files
    const [imgRes, audRes] = await Promise.all([
      fetch(imageUrl),
      fetch(audioUrl)
    ]);

    if (!imgRes.ok || !audRes.ok) {
      throw new Error('Failed to download files');
    }

    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
    const audBuffer = Buffer.from(await audRes.arrayBuffer());

    console.log('Image size:', imgBuffer.length);
    console.log('Audio size:', audBuffer.length);

    writeFileSync('/tmp/input.png', imgBuffer);
    writeFileSync('/tmp/input.mp3', audBuffer);

    console.log('Creating video...');

    // Create high-quality video
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input('/tmp/input.png')
        .inputOptions(['-loop', '1', '-framerate', '30'])
        .input('/tmp/input.mp3')
        .outputOptions([
          '-c:v', 'libx264',
          '-preset', 'slow',
          '-crf', '17',
          '-profile:v', 'high',
          '-level', '4.2',
          '-pix_fmt', 'yuv420p',
          '-vf', 'scale=2160:3840',
          '-r', '30',
          '-c:a', 'aac',
          '-b:a', '320k',
          '-ar', '48000',
          '-t', String(duration),
          '-shortest',
          '-movflags', '+faststart'
        ])
        .output('/tmp/output.mp4')
        .on('start', (cmd) => console.log('FFmpeg command:', cmd))
        .on('progress', (progress) => console.log('Processing:', progress.percent, '%'))
        .on('end', () => {
          console.log('Video created successfully');
          resolve();
        })
        .on('error', (err) => {
          console.error('FFmpeg error:', err);
          reject(err);
        })
        .run();
    });

    console.log('Reading video file...');
    const videoBuffer = readFileSync('/tmp/output.mp4');
    const base64 = videoBuffer.toString('base64');

    console.log('Video size:', videoBuffer.length, 'bytes');

    // Cleanup
    unlinkSync('/tmp/input.png');
    unlinkSync('/tmp/input.mp3');
    unlinkSync('/tmp/output.mp4');

    res.json({ 
      success: true,
      videoBase64: base64,
      videoSize: videoBuffer.length,
      message: 'Video created successfully'
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

Klick **"Commit changes"**

---

## **Teil 2: Render.com Service erstellen**

### **1. Geh zu Render.com**
- Geh zu [render.com](https://render.com)
- Klick **"Get Started"** oder **"Sign Up"**
- Melde dich mit deinem **GitHub Account** an (empfohlen)

### **2. Neuen Web Service erstellen**
- Klick auf **"New +"** oben rechts
- Wähle **"Web Service"**

### **3. Repository verbinden**
- Klick **"Build and deploy from a Git repository"** → **"Next"**
- Bei "Connect a repository": Klick **"Connect account"** (falls noch nicht verbunden)
- Wähle dein Repository `image-audio-video-converter`
- Klick **"Connect"**

### **4. Service konfigurieren**
Fülle die Felder aus:

- **Name:** `video-creator` (oder was du willst)
- **Region:** Europe (Frankfurt) – wähle was näher bei dir ist
- **Branch:** `main`
- **Runtime:** **Node**
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Instance Type:** **Free**

### **5. Environment Variables (optional aber empfohlen)**
Klick auf **"Advanced"** → **"Add Environment Variable"**

- Key: `NODE_ENV`
- Value: `production`

### **6. Deploy starten**
- Klick **"Create Web Service"** (grüner Button unten)
- Warte 3-5 Minuten während Render.com deinen Service baut

### **7. URL kopieren**
- Wenn der Deploy fertig ist, siehst du oben eine URL wie:
  `https://video-creator-abcd.onrender.com`
- **Kopiere diese URL!**

---

## **Teil 3: In n8n einbinden**

### **1. HTTP Request Node erstellen**
```
Method: POST
URL: https://deine-render-url.onrender.com/create-video

Headers:
  Content-Type: application/json

Body:
{
  "imageUrl": "{{ $('Code').item.json.imageUrl }}",
  "audioUrl": "{{ $('Code').item.json.audioUrl }}",
  "duration": 60
}
