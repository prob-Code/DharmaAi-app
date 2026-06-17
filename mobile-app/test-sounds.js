// Test script to verify sound URLs are accessible
const testSoundUrls = async () => {
    const urls = {
        flute: "https://archive.org/download/RelaxingIndianFluteMeditationMusic/Relaxing%20Indian%20Flute%20Meditation%20Music.mp3",
        rain: "https://archive.org/download/RainSounds_201602/Rain%20Sounds.mp3",
        waves: "https://archive.org/download/OceanWavesCrashing/Ocean%20Waves%20Crashing.mp3",
        om: "https://archive.org/download/OmChanting/Om%20Chanting.mp3"
    };

    console.log("Testing sound URLs...\n");
    
    for (const [name, url] of Object.entries(urls)) {
        try {
            const response = await fetch(url, { method: 'HEAD' });
            console.log(`${name}: ${response.ok ? '✓ OK' : '✗ FAILED'} (${response.status})`);
        } catch (error) {
            console.log(`${name}: ✗ ERROR - ${error.message}`);
        }
    }
};

testSoundUrls();
