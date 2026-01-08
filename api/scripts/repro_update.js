import fetch from 'node-fetch';

async function main() {
  const url = 'http://localhost:4000/api/product/list';
  try {
    const list = await fetch(url).then(r => r.json());
    if (!list || list.length === 0) {
      console.log('No products to update');
      return;
    }
    const p = list[0];
    console.log(`Updating product ${p.id} (${p.nome})...`);
    
    const updateUrl = `http://localhost:4000/api/product/update/${p.id}`;
    const payload = {
      ...p,
      nome: p.nome + ' (Updated)',
      permiteMeioAMeio: true
    };
    
    // Auth token is likely needed if I didn't disable auth.
    // But wait, the route /api/product/update/:id is protected: app.use("/api/product", authenticate, productRoutes);
    // I need a token.
    
    // Effectively I cannot easily script this without a valid token.
    // I will try to use the 'test_persistence' approach which might have bypassed auth or failed because of it?
    // Ah, previous test_persistence used http://localhost:4000/products (plural) but the route file says /product/list
    // server.js: app.use("/api/product", authenticate, productRoutes);
    
    // Wait! logic in server.js:
    // app.use("/api/product", authenticate, productRoutes);
    
    // So all product routes need auth.
    // My previous test_persistence used /products (plural) which probably doesn't exist or was 404ing?
    // Actually the previous output was ECONNREFUSED so it never connected.
    
    // If I want to test this I need to disable auth temporarily or generate a token.
    // Or I rely on the user's report.
    
    console.log('Skipping actual fetch because AUTH is required.');
  } catch(e) {
    console.error(e);
  }
}
main();
