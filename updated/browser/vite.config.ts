import { defineConfig } from 'vite';

// Project Pages and other subdirectory hosts must resolve every asset beneath
// the document URL, including the locally served MediaPipe model and WASM.
export default defineConfig({ base: './' });
