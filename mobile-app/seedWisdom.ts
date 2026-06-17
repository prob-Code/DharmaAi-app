import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import * as fs from 'fs';
import * as path from 'path';

// --- CONFIGURATION ---
// Replace these with your actual keys from config.ts if you want to run this script from the terminal.
const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_SERVICE_ROLE_KEY = "YOUR_SUPABASE_SERVICE_ROLE_KEY"; // Use service_role to bypass RLS!
const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// --- SAMPLE DATA ---
// You can keep adding objects to this array for teachings, podcast transcripts, book quotes, etc.
const WISDOM_CHUNKS = [
  {
    content: "When you realize nothing is lacking, the whole world belongs to you. Do not seek to follow in the footsteps of the men of old; seek what they sought.",
    metadata: { author: "Lao Tzu", topic: "Contentment" }
  },
  {
    content: "You have power over your mind - not outside events. Realize this, and you will find strength. The happiness of your life depends upon the quality of your thoughts.",
    metadata: { author: "Marcus Aurelius", topic: "Stoicism, Mindset" }
  },
  {
    content: "Letting go gives us freedom, and freedom is the only condition for happiness. If, in our heart, we still cling to anything—anger, anxiety, or possessions—we cannot be free.",
    metadata: { author: "Thich Nhat Hanh", topic: "Attachment, Freedom" }
  },
  {
    content: "The mind takes the shape of what it rests upon. If you rest upon worries, it becomes worried. If you rest upon peace, it becomes peaceful.",
    metadata: { author: "Unknown", topic: "Meditation" }
  }
];

async function seedWisdom() {
  console.log(`Starting to seed ${WISDOM_CHUNKS.length} wisdom documents...`);

  for (const chunk of WISDOM_CHUNKS) {
    try {
      console.log(`Generating embedding for: "${chunk.content.substring(0, 30)}..."`);
      
      // 1. Generate the vector embedding using Gemini 004
      const response = await ai.models.embedContent({
        model: 'text-embedding-004',
        contents: chunk.content,
      });

      const embedding = response.embeddings?.[0]?.values;

      if (!embedding) {
        console.error("Failed to generate embedding for chunk.");
        continue;
      }

      // 2. Insert into Supabase
      const { error } = await supabase
        .from('wisdom_documents')
        .insert({
          content: chunk.content,
          metadata: chunk.metadata,
          embedding: embedding
        });

      if (error) {
        console.error("Supabase insert error:", error.message);
      } else {
        console.log("✅ Successfully stored chunk.");
      }

      // Respect API rate limits
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (e) {
      console.error("Error processing chunk:", e);
    }
  }

  console.log("Seeding complete!");
}

seedWisdom();
