import { initStorage, getStorage } from "./src/services/storage.ts";

// Initialize storage
const storage = initStorage();

// Test upload
const buffer = Buffer.from("test audio data");
const result = await storage.upload(buffer, "mp3");

console.log("Upload result:", JSON.stringify(result, null, 2));
console.log("URL type:", result.url.startsWith("http") ? "HTTP URL" : "data URL");

// Check if file exists
import { existsSync } from "fs";
const filePath = storage.getLocalPath(result.key);
console.log("File exists:", existsSync(filePath));
console.log("File path:", filePath);
