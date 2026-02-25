// src/utils/promptLoader.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function getSystemPrompt(version = 'v0.1.0') {
    // Navigate from src/utils/ up to prompts/
    const filePath = path.join(__dirname, '../../prompts', `manifold_${version}.md`);
    
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch (err) {
        console.error("Could not find prompt file:", err);
        return "You are a helpful assistant."; // Fallback
    }
}