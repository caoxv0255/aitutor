console.log('EMBEDDING_PROVIDER:', JSON.stringify(process.env.EMBEDDING_PROVIDER));
console.log('DASHSCOPE_API_KEY:', process.env.DASHSCOPE_API_KEY ? 'SET' : 'NOT SET');
import('../services/embedding.js').then(m => {
  console.log('IS_LOCAL:', m.IS_LOCAL);
  console.log('EMBEDDING_MODEL:', m.EMBEDDING_MODEL);
  console.log('EMBEDDING_DIMS:', m.EMBEDDING_DIMS);
});