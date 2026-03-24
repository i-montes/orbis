import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = true;
env.useBrowserCache = false;

async function run() {
  console.log('Testing Xenova/bge-m3 loading...');
  try {
    const extractor = await pipeline('feature-extraction', 'Xenova/bge-m3', {
      quantized: true,
    } as any);
    
    console.log('Model loaded successfully!');
    
    const output = await extractor('hola mundo', { pooling: 'mean', normalize: true });
    console.log('Vector dimensions:', output.data.length);
    console.log('Success!');
  } catch (error) {
    console.error('Failed to load or run model:');
    console.error(error);
    process.exit(1);
  }
}

run();